import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { handleCheckout } from "../services/billing";
import { db } from "../firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { isPremium, getUserRole } from "../utils/rbac";
import { resolveProfileId } from "../utils/profileIdentity";
import AppHeader from "../components/AppHeader";
import PaymentInfoModal from "../components/Specialist/PaymentInfoModal";
import { getMpPlanUrl } from "../utils/mpSubscription";

const EMPLOYER_FREE_PERIOD_END_ISO = "2026-07-31T23:59:59-03:00";
const EMPLOYER_FREE_PERIOD_LABEL = "31 de julho de 2026";

// Flag temporaria: assinaturas pagas via Mercado Pago. Mantida aqui para
// permitir desativar rapidamente em caso de incidente. Defina como `true`
// para bloquear novos checkouts.
const PAID_CHECKOUT_DISABLED = false;
const PAID_CHECKOUT_DISABLED_MSG = "Em breve";

function extractProfileCnpj(profile) {
  const candidates = [
    profile?.cnpj,
    profile?.companyCnpj,
    profile?.empresaCnpj,
    profile?.business?.cnpj,
    profile?.company?.cnpj,
  ];
  const found = candidates.find((value) => value != null && String(value).trim());
  return (found || "").toString().replace(/\D/g, "");
}

function EscolhaPerfil({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const workerRef = useRef(null);
  const employerRef = useRef(null);
  const supporterRef = useRef(null);
  const [checkoutLoadingAudience, setCheckoutLoadingAudience] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [consultores, setConsultores] = useState([]);
  const [prestadores, setPrestadores] = useState([]);
  const [guardChecked, setGuardChecked] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [empresaSoonOpen, setEmpresaSoonOpen] = useState(false);
  const userIsPremium = React.useMemo(() => isPremium(), []);
  const userRole = React.useMemo(() => getUserRole(), []);
  const isEmpresaPremium = userIsPremium && (userRole === "admin_empresa" || userRole === "empresa");
  const viewingPlans = React.useMemo(
    () => new URLSearchParams(location.search).get("planos") === "1",
    [location.search]
  );
  const isEmployerFreeWindowActive = Date.now() <= new Date(EMPLOYER_FREE_PERIOD_END_ISO).getTime();

  // Guard: se o usuário já escolheu o tipo de perfil, redirecionar para /minha-conta
  // Exceto quando o usuário está acessando via ?planos=1 (ver benefícios premium)
  useEffect(() => {
    if (viewingPlans) {
      setGuardChecked(true);
      return;
    }
    let cancelled = false;
    async function checkProfileType() {
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        // Checar no localStorage primeiro
        if (stored?.profileTypeChosen) {
          if (!cancelled) navigate("/minha-conta", { replace: true });
          return;
        }
        // Checar no Firestore
        const pid = stored?.profileId || resolveProfileId(stored, { persistGeneratedId: false });
        if (pid) {
          const userRef = doc(db, "users", pid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data?.profileTypeChosen || data?.userType || data?.profileType) {
              // Salvar localmente para evitar futuras consultas
              const updated = { ...stored, profileTypeChosen: data.profileTypeChosen || data.userType || data.profileType };
              localStorage.setItem("userProfile", JSON.stringify(updated));
              if (!cancelled) navigate("/minha-conta", { replace: true });
              return;
            }
          }
        }
      } catch { /* silencioso */ }
      if (!cancelled) setGuardChecked(true);
    }
    checkProfileType();
    return () => { cancelled = true; };
  }, [navigate, viewingPlans]);

  useEffect(() => {
    (async () => {
      try {
        const [consSnap, prestSnap] = await Promise.all([
          getDocs(query(collection(db, "consultores"), where("status", "==", "ativo"))),
          getDocs(query(collection(db, "prestadores"), where("status", "==", "ativo"))),
        ]);
        setConsultores(consSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setPrestadores(prestSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        /* silencioso */
      }
    })();
  }, []);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePremiumUnlock = async (audience = "worker", tier = "essential") => {
    // [DEBUG] Confirma que o clique chegou na funcao (problema de binding -> nao aparece)
    console.log("[handlePremiumUnlock] CLICADO", { audience, tier, ts: new Date().toISOString() });

    // BLOQUEIO opcional: respeita a flag PAID_CHECKOUT_DISABLED para permitir
    // desativar checkouts em caso de incidente. Empresas dentro da janela
    // gratuita continuam com acesso liberado normalmente.
    const isEmployerFreeFlow = audience === "employer" && isEmployerFreeWindowActive;
    if (PAID_CHECKOUT_DISABLED && !isEmployerFreeFlow) {
      setCheckoutError(
        "Assinaturas pagas temporariamente indisponiveis. Tente novamente em instantes."
      );
      return;
    }

    const loadingKey = `${audience}-${tier}`;
    setCheckoutLoadingAudience(loadingKey);
    setCheckoutError("");
    setCheckoutSuccess("");
    try {
      let stored = {};
      try {
        stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
      } catch {
        stored = {};
      }
      console.log("[handlePremiumUnlock] userProfile lido", stored);

      const isEmployer = audience === "employer";
      const canGrantEmployerForFree = isEmployer && isEmployerFreeWindowActive;

      // Caminho 1: redirect direto para o checkout de assinatura do Mercado Pago
      // usando preapproval_plan_id da variavel de ambiente. Funciona para todos os
      // tiers exceto quando o empregador esta dentro da janela gratuita.
      const directMpUrl = getMpPlanUrl(audience, tier);
      const hasConfiguredPlanId = !!(
        (typeof process !== "undefined" && process.env) &&
        process.env[`REACT_APP_MP_PLAN_${String(audience).toUpperCase()}_${String(tier).toUpperCase()}`]
      );
      console.log("[handlePremiumUnlock] getMpPlanUrl ->", { directMpUrl, canGrantEmployerForFree, hasConfiguredPlanId });

      // Se a variavel de ambiente esta presente mas a URL nao pode ser construida,
      // significa que o valor configurado e invalido. Falha rapido com mensagem
      // clara em vez de chamar o backend e gerar mais confusao.
      if (hasConfiguredPlanId && !directMpUrl && !canGrantEmployerForFree) {
        setCheckoutError(
          "Plano de assinatura mal configurado (preapproval_plan_id invalido). Avise o suporte."
        );
        return;
      }

      if (directMpUrl && !canGrantEmployerForFree) {
        // Persistir intencao de perfil antes do redirect.
        const updatedProfile = { ...stored, profileTypeChosen: audience };
        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
        const pid = updatedProfile?.profileId || resolveProfileId(updatedProfile, { persistGeneratedId: false });
        if (pid) {
          const userRef = doc(db, "users", pid);
          await setDoc(userRef, { profileTypeChosen: audience }, { merge: true });
        }
        // Dica para o caso #1 (botao 'Pagar assinatura' desabilitado no MP):
        // o Mercado Pago bloqueia o pagador quando ele e o mesmo dono do plano,
        // ou quando faltam dados (CPF) no perfil MP. Deixamos um aviso no
        // sessionStorage para a tela de retorno conseguir orientar o usuario.
        try {
          sessionStorage.setItem(
            "trabalheiLa_mpCheckoutHint",
            JSON.stringify({
              ts: Date.now(),
              audience,
              tier,
              hint:
                "Se o botao 'Pagar assinatura' aparecer desabilitado no Mercado Pago, " +
                "saia da conta MP e entre com uma conta diferente da que criou o plano, " +
                "e confirme que seu CPF esta cadastrado no perfil do Mercado Pago.",
            })
          );
        } catch { /* sessionStorage indisponivel */ }
        window.location.assign(directMpUrl);
        return;
      }

      if (canGrantEmployerForFree) {
        const updatedProfile = {
          ...stored,
          profileTypeChosen: "employer",
          role: "admin_empresa",
          is_premium: true,
          premiumAudience: "employer",
          premiumSource: "launch_free_period",
          premiumStatus: "active",
          premiumExpiresAt: EMPLOYER_FREE_PERIOD_END_ISO,
          companyCnpj: extractProfileCnpj(stored) || null,
        };

        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));

        const pid = updatedProfile?.profileId || resolveProfileId(updatedProfile, { persistGeneratedId: false });
        if (pid) {
          const userRef = doc(db, "users", pid);
          await setDoc(
            userRef,
            {
              profileTypeChosen: "employer",
              role: "admin_empresa",
              is_premium: true,
              premiumAudience: "employer",
              premiumSource: "launch_free_period",
              premiumStatus: "active",
              premiumExpiresAt: EMPLOYER_FREE_PERIOD_END_ISO,
              companyCnpj: extractProfileCnpj(stored) || null,
            },
            { merge: true }
          );
        }

        window.dispatchEvent(new Event("trabalheiLa_user_updated"));
        setCheckoutSuccess(`Plano Empresarial liberado gratuitamente ate ${EMPLOYER_FREE_PERIOD_LABEL}.`);
        navigate("/minha-conta", { replace: true });
        return;
      }

      const updatedProfile = {
        ...stored,
        profileTypeChosen: audience,
      };
      localStorage.setItem("userProfile", JSON.stringify(updatedProfile));

      const pid = updatedProfile?.profileId || resolveProfileId(updatedProfile, { persistGeneratedId: false });
      if (pid) {
        const userRef = doc(db, "users", pid);
        await setDoc(userRef, { profileTypeChosen: audience }, { merge: true });
      }

      console.log("[handlePremiumUnlock] sem directMpUrl, chamando handleCheckout()", { audience, tier });
      await handleCheckout({
        cnpj: "",
        companySlug: "trabalhei-la",
        companyName: "Trabalheila",
        audience,
        tier,
      });
      console.log("[handlePremiumUnlock] handleCheckout() retornou sem lancar erro");
    } catch (err) {
      console.error("[handlePremiumUnlock] ERRO capturado:", err);
      console.error("[handlePremiumUnlock] err.message:", err?.message);
      console.error("[handlePremiumUnlock] err.stack:", err?.stack);
      setCheckoutError(err?.message || "Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setCheckoutLoadingAudience(null);
    }
  };

  // Aguardar verificação do guard
  if (!guardChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500 dark:text-slate-400 text-lg animate-pulse">Carregando…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      {checkoutSuccess && (
        <div className="w-full max-w-5xl mx-auto px-4 pt-4">
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300 text-center">
            {checkoutSuccess}
          </div>
        </div>
      )}

      {/* Erro de checkout */}
      {checkoutError && (
        <div className="w-full max-w-5xl mx-auto px-4 pt-4">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 text-center">
            {checkoutError}
          </div>
        </div>
      )}

      {/* ═══════════════ SEÇÃO 1 — Escolha seu perfil ═══════════════ */}
      <section className="w-full max-w-5xl px-4 pt-6 pb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-center text-slate-900 dark:text-white mb-2">
          Escolha seu perfil
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10 text-lg">
          Descubra os benefícios exclusivos para cada perfil.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl mx-auto" style={{ justifyItems: 'center' }}>
          {/* Card Trabalhador */}
          <button
            type="button"
            onClick={() => scrollTo(workerRef)}
            className="group relative rounded-3xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="w-full overflow-hidden" style={{ height: 280 }}>
              <img
                src="/Trampo.jpg"
                alt="Trabalhadores"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                style={{ objectPosition: 'center 20%' }}
              />
            </div>
            <div className="p-6 flex flex-col items-center text-center flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sou Trabalhador</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Avalie empresas, acesse avaliações verificadas e conecte-se diretamente com advogados
                trabalhistas, psicólogos e consultores — tudo dentro da plataforma.
                <span className="block mt-1 text-blue-700 dark:text-blue-300 font-semibold">
                  Plano Premium libera consultas diretas com profissionais verificados.
                </span>
              </p>
              <span className="mt-4 inline-block text-blue-600 dark:text-blue-400 font-semibold text-sm group-hover:underline">
                Ver benefícios →
              </span>
            </div>
          </button>

          {/* Card Empresário */}
          <button
            type="button"
            onClick={() => scrollTo(employerRef)}
            className="group relative rounded-3xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="w-full overflow-hidden" style={{ height: 280 }}>
              <img
                src="/empresário.jpg"
                alt="Empresários"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
            <div className="p-6 flex flex-col items-center text-center flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sou Empresário</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Gerencie sua reputação, responda avaliações e conecte-se com consultores de RH,
                contadores e advogados especializados em gestão empresarial.
                <span className="block mt-1 text-indigo-700 dark:text-indigo-300 font-semibold">
                  Plano Fundador gratuito até 31 de julho de 2026.
                </span>
              </p>
              <span className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 font-semibold text-sm group-hover:underline">
                Ver benefícios →
              </span>
            </div>
          </button>

          {/* Card Apoiador */}
          <button
            type="button"
            onClick={() => scrollTo(supporterRef)}
            className="group relative rounded-3xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="w-full overflow-hidden" style={{ height: 280 }}>
              <img
                src="/plans-banner.jpg"
                alt="Especialistas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                style={{ objectPosition: 'center 15%' }}
              />
            </div>
            <div className="p-6 flex flex-col items-center text-center flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sou Especialista</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Ofereça seus serviços a trabalhadores e empresas que precisam de apoio especializado.
                Receba requisições de consulta diretamente pela plataforma com split automático de
                pagamento via Mercado Pago.
              </p>
              <span className="mt-4 inline-block text-blue-600 dark:text-blue-400 font-semibold text-sm group-hover:underline">
                Ver benefícios →
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 2 — Benefícios Trabalhador ═══════════════ */}
      <section
        ref={workerRef}
        className="w-full bg-white dark:bg-slate-900 py-10 scroll-mt-8"
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-blue-700 dark:text-blue-400 mb-2">
            Sou Trabalhador
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
            Avalie empresas, acesse avaliações verificadas e conecte-se diretamente
            com advogados trabalhistas, psicólogos e consultores — tudo dentro da plataforma.
          </p>

          <h3 className="text-lg md:text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-6">
            Benefícios para Trabalhadores
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto mb-8 items-stretch">
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-6 flex flex-col">
              <h4 className="text-lg font-extrabold text-blue-700 dark:text-blue-300">Plano Essencial</h4>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Grátis</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 flex-1">
                Encontre o especialista ideal, inicie um chat limitado e tenha acesso a um{" "}
                <strong>desconto exclusivo na primeira consulta</strong> com especialistas Essenciais.
                Perfeito para resolver dúvidas pontuais.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 flex flex-col">
              <h4 className="text-lg font-extrabold text-amber-700 dark:text-amber-300">Plano Premium</h4>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Assinatura</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 flex-1">
                Para quem busca acompanhamento contínuo. Tenha{" "}
                <strong>consultas gratuitas ou créditos</strong> para usar com qualquer especialista,
                chat ilimitado, videoconferência integrada e ferramentas de gestão de caso.
              </p>
            </div>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/trabalhador/beneficios")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
            >
              Ver Detalhes dos Planos →
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 3 — Benefícios Empresário ═══════════════ */}
      <section
        ref={employerRef}
        className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-950 dark:to-indigo-950/30 py-10 scroll-mt-8"
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-indigo-700 dark:text-indigo-400 mb-2">
            Sou Empresa
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
            Gerencie sua reputação, responda avaliações e conecte-se com consultores
            de RH, contadores e advogados especializados em gestão empresarial.
          </p>

          <h3 className="text-lg md:text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">
            Benefícios para Empresas
          </h3>
          <p className="text-center text-sm font-semibold text-amber-600 dark:text-amber-400 mb-6">
            (em desenvolvimento)
          </p>

          <div className="max-w-3xl mx-auto rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 p-6 mb-6">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              O <strong>Plano Fundador</strong> tem gratuidade válida até{" "}
              <strong>31 de julho de 2026</strong>. A partir de agosto de 2026,
              o <strong>Plano Essencial Empresa</strong> será{" "}
              <strong>R$ 899,90/mês</strong> — quem entra dentro do período
              Fundador mantém o preço promocional para sempre.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              type="button"
              onClick={() => setEmpresaSoonOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
            >
              Ver Detalhes dos Planos →
            </button>
            {isEmployerFreeWindowActive && (
              <button
                type="button"
                onClick={() => handlePremiumUnlock("employer", "essential")}
                disabled={!!checkoutLoadingAudience}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {checkoutLoadingAudience === "employer-essential"
                  ? "Ativando…"
                  : "Ativar Fundador grátis até 31/07/2026"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 4 — Benefícios Especialista ═══════════════ */}
      <section
        ref={supporterRef}
        className="w-full bg-white dark:bg-slate-900 py-10 scroll-mt-8"
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-blue-700 dark:text-blue-400 mb-2">
            Sou Especialista
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
            Ofereça seus serviços a trabalhadores e empresas que precisam de apoio
            especializado. Receba requisições de consulta diretamente pela plataforma.
          </p>

          <h3 className="text-lg md:text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-6">
            Benefícios para Especialistas
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto mb-6 items-stretch">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-6 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-lg font-extrabold text-slate-700 dark:text-slate-200">Plano Gratuito</h4>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-slate-700 dark:text-slate-200">R$ 0</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 flex-1">
                Comece a aparecer na plataforma <strong>sem custo</strong>: perfil
                público, listagem geral e visão geral da demanda na sua área.
                Contato inicial exclusivo via Chat Interno, sem gestão ativa de
                casos.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-6 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-lg font-extrabold text-blue-700 dark:text-blue-300">Plano Essencial</h4>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-blue-700 dark:text-blue-300">R$ 49/mês</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 flex-1">
                Pague uma mensalidade e receba <strong>100% do valor</strong> de
                suas consultas. Tenha um perfil profissional, gestão de casos e
                videoconferência com limitações. Ideal para iniciar e gerenciar
                atendimentos pontuais.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="text-lg font-extrabold text-amber-700 dark:text-amber-300">Plano Premium</h4>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-amber-700 dark:text-amber-300">R$ 89,90/mês</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 flex-1">
                Pague uma mensalidade maior e receba <strong>100% do valor</strong>{" "}
                de suas consultas. Acesso ilimitado a todas as funcionalidades,
                videoconferência sem limites, maior visibilidade e fluxo contínuo
                de oportunidades de clientes.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              type="button"
              onClick={() => navigate("/especialista/beneficios")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
            >
              Ver Detalhes dos Planos →
            </button>
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
            >
              Como funciona o pagamento?
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 5 — Consultores Parceiros ═══════════════ */}
      <section className="w-full bg-white dark:bg-slate-900 py-16 scroll-mt-8">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-slate-800 dark:text-white mb-2">
            Consultores Parceiros
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
            Profissionais verificados prontos para transformar dados em ação na sua empresa.
          </p>

          {consultores.length === 0 ? (
            <p className="text-center text-sm text-slate-500 italic mb-8">
              Em breve — consultores parceiros verificados serão listados aqui.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {consultores.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    {c.foto ? (
                      <img src={c.foto} alt={c.nome} className="w-12 h-12 rounded-full object-cover border-2 border-blue-200" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold text-lg">
                        {(c.nome || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{c.nome}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{c.especialidade}</p>
                    </div>
                  </div>
                  {c.descricao && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 flex-1">{c.descricao}</p>
                  )}
                  {userIsPremium ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (c.whatsapp) {
                          window.open(`https://wa.me/${c.whatsapp.replace(/\D/g, "")}?text=Olá! Vi seu perfil no Trabalhei Lá e gostaria de saber mais sobre seus serviços.`, "_blank");
                        } else if (c.email) {
                          window.location.href = `mailto:${c.email}?subject=Contato via Trabalhei Lá`;
                        }
                      }}
                      className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition"
                    >
                      Contratar com 20% de desconto
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-semibold cursor-not-allowed"
                    >
                      Disponível no Plano Premium Empresa
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/consultores/cadastro"
              className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              Cadastre-se como consultor parceiro →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 5 — Prestadores de Serviços Corporativos ═══════════════ */}
      <section className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-16 scroll-mt-8">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-slate-800 dark:text-white mb-2">
            Prestadores de Serviços Corporativos
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
            Empresas verificadas que oferecem serviços especializados para o seu negócio.
          </p>

          {prestadores.length === 0 ? (
            <p className="text-center text-sm text-slate-500 italic mb-8">
              Em breve — prestadores de serviços corporativos verificados serão listados aqui.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {prestadores.map((p) => (
                <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 flex flex-col">
                  <div className="mb-3">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{p.razaoSocial || p.nome || "Empresa"}</h3>
                    {p.segmentos && p.segmentos.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.segmentos.map((s) => (
                          <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {p.descricao && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 flex-1">{p.descricao}</p>
                  )}
                  {isEmpresaPremium ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (p.telefone) {
                          window.open(`https://wa.me/${p.telefone.replace(/\D/g, "")}?text=Olá! Vi o perfil da empresa no Trabalhei Lá e gostaria de solicitar uma proposta.`, "_blank");
                        } else if (p.email) {
                          window.location.href = `mailto:${p.email}?subject=Solicitação de proposta via Trabalhei Lá`;
                        }
                      }}
                      className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition"
                    >
                      Solicitar proposta com 15% de desconto Premium
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-semibold cursor-not-allowed"
                    >
                      Disponível no Plano Premium Empresa
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-center">
            <Link
              to="/prestadores/cadastro"
              className="text-sm text-slate-600 dark:text-slate-400 font-semibold hover:underline"
            >
              Cadastre sua empresa como prestadora de serviços →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer leve */}
      <footer className="w-full py-8 text-center text-xs text-slate-500 dark:text-slate-600">
        © {new Date().getFullYear()} Trabalheila — Todos os direitos reservados.
      </footer>

      {/* Modal: Como funciona o pagamento (especialista) */}
      <PaymentInfoModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        audience="specialist"
      />

      {/* Modal: Planos Empresa em breve */}
      {empresaSoonOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEmpresaSoonOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400 mb-2">
              Planos para Empresas em breve
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-200 mb-4">
              Estamos finalizando a página de detalhes dos planos empresariais.
              Enquanto isso, o <strong>Plano Fundador</strong> está gratuito até{" "}
              <strong>31 de julho de 2026</strong>. Quem ativar agora mantém o
              preço promocional para sempre.
            </p>
            <button
              type="button"
              onClick={() => setEmpresaSoonOpen(false)}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EscolhaPerfil;
