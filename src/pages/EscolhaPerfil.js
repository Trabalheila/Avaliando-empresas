import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { handleCheckout } from "../services/billing";
import { db } from "../firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { isPremium, getUserRole } from "../utils/rbac";
import { resolveProfileId } from "../utils/profileIdentity";
import {
  FiCheck, FiX, FiClock,
} from "react-icons/fi";
import AppHeader from "../components/AppHeader";
import PlanosApoiador from "../components/PlanosApoiador";
import { getMpPlanUrl } from "../utils/mpSubscription";

const EMPLOYER_FREE_PERIOD_END_ISO = "2026-07-31T23:59:59-03:00";
const EMPLOYER_FREE_PERIOD_LABEL = "31 de julho de 2026";

// Flag temporario: assinaturas pagas via Mercado Pago estao desativadas ate
// que o CNPJ da plataforma seja fornecido / a conta MP seja homologada para
// preapproval. Empresas dentro da janela gratuita continuam liberadas.
const PAID_CHECKOUT_DISABLED = true;
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

    // BLOQUEIO TEMPORARIO: assinaturas Mercado Pago estao desativadas ate que
    // o CNPJ da plataforma seja fornecido / conta MP seja homologada para
    // assinaturas recorrentes. Empresas dentro da janela gratuita continuam
    // tendo acesso liberado normalmente.
    const isEmployerFreeFlow = audience === "employer" && isEmployerFreeWindowActive;
    if (!isEmployerFreeFlow) {
      setCheckoutError(
        "Assinaturas pagas temporariamente indisponiveis. Estamos finalizando a homologacao com o Mercado Pago. Em breve liberaremos novamente."
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
      console.log("[handlePremiumUnlock] getMpPlanUrl ->", { directMpUrl, canGrantEmployerForFree });
      if (directMpUrl && !canGrantEmployerForFree) {
        // Persistir intencao de perfil antes do redirect.
        const updatedProfile = { ...stored, profileTypeChosen: audience };
        localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
        const pid = updatedProfile?.profileId || resolveProfileId(updatedProfile, { persistGeneratedId: false });
        if (pid) {
          const userRef = doc(db, "users", pid);
          await setDoc(userRef, { profileTypeChosen: audience }, { merge: true });
        }
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
        className="w-full bg-white dark:bg-slate-900 py-6 scroll-mt-8"
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-blue-700 dark:text-blue-400 mb-2">
            Benefícios para Trabalhadores
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
            Veja o que muda ao se tornar Premium.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10 items-stretch">
            {/* Gratuito */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Gratuito</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">R$ 0</p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 flex-1">
                <FeatureRow ok>Avaliar empresas anonimamente</FeatureRow>
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Comentários públicos</FeatureRow>
                <FeatureRow>Comparar empresas lado a lado</FeatureRow>
                <FeatureRow>Relatórios executivos completos</FeatureRow>
                <FeatureRow>Dashboard de cultura e ambiente</FeatureRow>
                <FeatureRow>Tendências e análises exclusivas</FeatureRow>
                <FeatureRow>Assessoria jurídica trabalhista gratuita</FeatureRow>
                <FeatureRow>Apoio Psicológico</FeatureRow>
              </ul>
            </div>

            {/* Essencial — RECOMENDADO */}
            <div className="rounded-2xl border-2 border-blue-400 dark:border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-6 relative overflow-hidden flex flex-col md:scale-[1.02] shadow-lg">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                RECOMENDADO
              </div>
              <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-1">Trabalhador Essencial</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                R$ 29,90<span className="text-sm font-medium text-slate-600 dark:text-slate-400">/mês</span>
              </p>
              <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 flex-1">
                <FeatureRow ok>Avaliar empresas anonimamente</FeatureRow>
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Comentários públicos</FeatureRow>
                <FeatureRow ok>Comparar empresas lado a lado</FeatureRow>
                <FeatureRow ok>Relatórios executivos completos</FeatureRow>
                <FeatureRow ok>Dashboard de cultura e ambiente</FeatureRow>
                <FeatureRow ok>Tendências e análises exclusivas</FeatureRow>
                <FeatureRow ok>Assessoria jurídica trabalhista — 1 consulta gratuita única com advogado parceiro</FeatureRow>
                <FeatureRow ok>Orientação sobre rescisão indevida, assédio moral e discriminação</FeatureRow>
                <FeatureRow ok>Acesso ao marketplace de advogados com OAB verificada</FeatureRow>
                <FeatureRow ok>Avaliações de outros usuários Essencial sobre advogados parceiros</FeatureRow>
                <FeatureRow>Apoio Psicológico</FeatureRow>
              </ul>
              <button
                type="button"
                className="mt-6 w-full py-3 rounded-lg bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                style={PAID_CHECKOUT_DISABLED ? undefined : { animation: "premiumGlow 2s ease-in-out infinite" }}
                onClick={() => handlePremiumUnlock("worker", "essential")}
                disabled={PAID_CHECKOUT_DISABLED || !!checkoutLoadingAudience}
                title={PAID_CHECKOUT_DISABLED ? "Assinaturas pagas temporariamente indisponiveis" : undefined}
              >
                {PAID_CHECKOUT_DISABLED
                  ? PAID_CHECKOUT_DISABLED_MSG
                  : checkoutLoadingAudience === "worker-essential"
                    ? "Abrindo checkout…"
                    : "Assinar Essencial"}
              </button>
            </div>

            {/* Premium */}
            <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 relative overflow-hidden flex flex-col shadow-lg">
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                COMPLETO
              </div>
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-1">Premium Trabalhador</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                R$ 79,90<span className="text-sm font-medium text-slate-600 dark:text-slate-400">/mês</span>
              </p>
              <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 flex-1">
                <FeatureRow ok>Avaliar empresas anonimamente</FeatureRow>
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Comentários públicos</FeatureRow>
                <FeatureRow ok>Comparar empresas lado a lado</FeatureRow>
                <FeatureRow ok>Relatórios executivos completos</FeatureRow>
                <FeatureRow ok>Dashboard de cultura e ambiente</FeatureRow>
                <FeatureRow ok>Tendências e análises exclusivas</FeatureRow>
                <FeatureRow ok>Assessoria jurídica trabalhista — 1 consulta gratuita por mês com advogado parceiro + atendimento prioritário</FeatureRow>
                <FeatureRow ok>Acesso estendido a advogados parceiros (mais consultas e horas inclusas)</FeatureRow>
                <FeatureRow ok>Orientação sobre rescisão indevida, assédio moral e discriminação</FeatureRow>
                <FeatureRow ok>Acesso ao marketplace de advogados com OAB verificada</FeatureRow>
                <FeatureRow ok>Avaliações de outros usuários Premium sobre advogados parceiros</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Apoio Psicológico</span> — acesso a psicólogos parceiros, primeira consulta gratuita e descontos em sessões</FeatureRow>
                <FeatureRow ok>Consultoria de Carreira Personalizada (1 sessão/mês com mentor parceiro)</FeatureRow>
                <FeatureRow ok>Workshops exclusivos sobre carreira, negociação e direitos trabalhistas</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Conexão Premium com Empresas</span> — seja encontrado por Empresas Premium que buscam talentos</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Ative sua disponibilidade para contato</span> — controle quando quer receber propostas de empresas</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Gerencie seus pedidos de contato</span> — acesse sua página exclusiva "Meus Contatos" para gerenciar todas as interações</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Notificações prioritárias</span> — receba alertas em tempo real sobre oportunidades de emprego relevantes</FeatureRow>
              </ul>
              <button
                type="button"
                className="mt-6 w-full py-3 rounded-lg bg-amber-500 text-white text-base font-bold hover:bg-amber-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => handlePremiumUnlock("worker", "premium")}
                disabled={PAID_CHECKOUT_DISABLED || !!checkoutLoadingAudience}
                title={PAID_CHECKOUT_DISABLED ? "Assinaturas pagas temporariamente indisponiveis" : undefined}
              >
                {PAID_CHECKOUT_DISABLED
                  ? PAID_CHECKOUT_DISABLED_MSG
                  : checkoutLoadingAudience === "worker-premium"
                    ? "Abrindo checkout…"
                    : "Assinar Premium"}
              </button>
            </div>
          </div>

          {/* Destaque */}
          <div className="max-w-md mx-auto text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 mb-4 text-blue-900 dark:text-blue-200 text-sm font-medium shadow-inner">
              <span className="font-bold">Destaque:</span> Quem é Premium sente até{" "}
              <span className="font-bold">3× mais segurança</span> na escolha do emprego.
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Pagamento via Mercado Pago. Escolha PIX, cartão ou boleto no checkout.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 3 — Benefícios Empresário ═══════════════ */}
      <section
        ref={employerRef}
        className="w-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-950 dark:to-indigo-950/30 py-16 scroll-mt-8"
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-indigo-700 dark:text-indigo-400 mb-2">
            Benefícios para Empresários
          </h2>
          <p className="text-center text-sm font-semibold text-amber-600 dark:text-amber-400 mb-1">
            (em desenvolvimento)
          </p>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10">
            Dados estratégicos para decisões assertivas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10 items-stretch">
            {/* Gratuito */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Gratuito</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">R$ 0</p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 flex-1">
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Acompanhar avaliações públicas (resumo)</FeatureRow>
                <FeatureRow>Nota geral da empresa por critério</FeatureRow>
                <FeatureRow>Painel básico de avaliações recebidas</FeatureRow>
                <FeatureRow>Resposta pública oficial a avaliações</FeatureRow>
                <FeatureRow>Avaliar fornecedores e clientes por CNPJ</FeatureRow>
                <FeatureRow>Reputação de parceiros (consulta por CNPJ)</FeatureRow>
                <FeatureRow>Benchmark de setor (CNAE)</FeatureRow>
                <FeatureRow>Relatório executivo mensal</FeatureRow>
              </ul>
            </div>

            {/* Plano Essencial Empresa (Fundador) */}
            <div className="rounded-2xl border-2 border-indigo-400 dark:border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 p-6 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                ESSENCIAL
              </div>
              <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mb-1">Plano Essencial Empresa</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Gratuito</p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-4">Plano Fundador: gratuito até 31 de julho de 2026 · após essa data: R$ 899,90/mês</p>
              <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 flex-1">
                <FeatureRow ok>Visão da <span className="font-semibold">nota geral da empresa por critério</span> (salário, cultura, liderança, benefícios e mais)</FeatureRow>
                <FeatureRow ok>Acesso ao <span className="font-semibold">painel básico de avaliações recebidas</span> com filtros simples</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Resposta pública oficial</span> a avaliações, identificada como “Resposta oficial da empresa”</FeatureRow>
                <FeatureRow ok>Acesso prioritário aos próximos recursos (comparação com concorrentes, benchmarks de setor)</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Conexão com consultores empresariais parceiros</span> — Inclui <span className="font-semibold">5 Créditos de Contato/mês</span> para iniciar conversas com Especialistas Premium e transformar dados em plano de ação</FeatureRow>
                <FeatureRow ok>Acesso à página <span className="font-semibold">"Meus Contatos"</span> para gerenciar interações com Especialistas</FeatureRow>
              </ul>
              <p className="mt-3 text-xs text-indigo-700 dark:text-indigo-300 italic">
                {isEmployerFreeWindowActive
                  ? "O Plano Fundador tem gratuidade válida até 31 de julho de 2026. A partir de agosto de 2026, o Plano Essencial Empresa será R$ 899,90/mês — quem entra dentro do período Fundador mantem o preço promocional para sempre."
                  : "Quem entra agora garante o preço Fundador para sempre. Quando os recursos avançados forem lançados, você não paga a diferença."}
              </p>
            </div>

            {/* Empresa Premium */}
            <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 relative overflow-hidden flex flex-col shadow-lg">
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                COMPLETO
              </div>
              <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400 mb-1">Empresa Premium</h3>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                Tudo do Plano Essencial Empresa + recursos avançados de inteligência de mercado.
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Gratuito</p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-4">Após 31 de julho de 2026: R$ 1.649,90/mês</p>
              <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200 flex-1">
                <li className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Tudo do Plano Essencial Empresa, em versão avançada:
                </li>
                <FeatureRow ok>Painel de avaliações por critério com filtros e séries históricas</FeatureRow>
                <FeatureRow ok>Comparação de reputação por setor e concorrentes (benchmark CNAE)</FeatureRow>
                <FeatureRow ok>Ferramenta de resposta pública oficial a avaliações</FeatureRow>
                <FeatureRow ok>Acesso antecipado a todos os recursos em desenvolvimento, sem custo adicional</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Conexão com consultores empresariais parceiros</span> — Inclui <span className="font-semibold">20 Créditos de Contato/mês</span> para iniciar conversas com Especialistas Premium e transformar dados em plano de ação</FeatureRow>
                <FeatureRow ok>Acesso à página <span className="font-semibold">"Meus Contatos"</span> para gerenciar interações com Especialistas</FeatureRow>
                <li className="pt-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  E mais, exclusivo do Premium:
                </li>
                <FeatureRow ok><span className="font-semibold">Avaliar Fornecedores e Clientes por CNPJ</span> — publique avaliações verificadas em nome da sua empresa</FeatureRow>
                <FeatureRow ok><span className="font-semibold">Reputação de Parceiros</span> — consulte CNPJ e veja nota geral, número de avaliações e data mais recente</FeatureRow>
                <FeatureRow ok>Benchmark com até 3 concorrentes diretos do seu setor (cultura, liderança, salário e equilíbrio)</FeatureRow>
                <FeatureRow ok>Dashboard dinâmico para análise de desempenho da reputação</FeatureRow>
                <li className="pt-2 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Em breve (incluído no plano sem custo adicional):
                </li>
                <FeatureRow soon><span className="font-semibold">Conexão Exclusiva com Talentos</span> — <span className="font-semibold">10 Créditos de Contato/mês</span> para encontrar e conectar-se com Trabalhadores Premium de alto Índice de Credibilidade e disponibilidade</FeatureRow>
                <FeatureRow soon>Gerenciamento Centralizado também para contatos com Trabalhadores Premium</FeatureRow>
                <FeatureRow soon>Análise de sentimento e sugestões de IA na ferramenta de resposta</FeatureRow>
                <FeatureRow soon>Exportação de relatórios e séries históricas (PDF/CSV)</FeatureRow>
                <FeatureRow soon>Identificação automática de tendências e riscos do mercado</FeatureRow>
                <FeatureRow soon>Relatório executivo mensal com oportunidades, ameaças e recomendações</FeatureRow>
                <FeatureRow soon>Índice de reputação de mercado (score consolidado)</FeatureRow>
              </ul>
              <button
                type="button"
                className="mt-6 w-full py-3 rounded-lg bg-amber-500 text-white text-base font-bold hover:bg-amber-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => handlePremiumUnlock("employer", "premium")}
                disabled={PAID_CHECKOUT_DISABLED || !!checkoutLoadingAudience}
                title={PAID_CHECKOUT_DISABLED ? "Assinaturas pagas temporariamente indisponiveis" : undefined}
              >
                {PAID_CHECKOUT_DISABLED
                  ? PAID_CHECKOUT_DISABLED_MSG
                  : checkoutLoadingAudience === "employer-premium"
                    ? "Abrindo checkout…"
                    : "Assinar Empresa Premium"}
              </button>
            </div>
          </div>

          {/* Manifesto Fundador */}
          <div className="max-w-3xl mx-auto mb-12 bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-lg p-8 md:p-10">
            <h3 className="text-2xl md:text-3xl font-extrabold text-indigo-700 dark:text-indigo-400 mb-4 leading-tight">
              Seja um Empresário Fundador do Trabalhei Lá
            </h3>
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
              Você está chegando antes de todo mundo. E isso tem valor.
            </p>

            <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
              O Trabalhei Lá é a primeira plataforma brasileira de avaliação de empresas com foco em{" "}
              <span className="font-bold">autenticidade</span> — cada avaliação é feita por quem de fato trabalhou lá,
              verificada e publicada sob pseudônimo protegido. Transparência real, sem manipulação.
            </p>

            <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
              Hoje, empresas que entram como <span className="font-bold text-indigo-700 dark:text-indigo-400">Parceiras Fundadoras</span> têm acesso imediato a:
            </p>

            <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300 mb-6 pl-1">
              <FeatureRow ok>
                <span><span className="font-semibold">Perfil completo da empresa</span> com painel de avaliações por critério — salário, cultura, liderança, benefícios e muito mais.</span>
              </FeatureRow>
              <FeatureRow ok>
                <span><span className="font-semibold">Relatório de reputação</span> com visão geral do que seus funcionários e ex-funcionários pensam de verdade.</span>
              </FeatureRow>
              <FeatureRow ok>
                <span><span className="font-semibold">Ferramenta de resposta a avaliações</span>, mostrando ao mercado que sua empresa ouve e evolui.</span>
              </FeatureRow>
              <FeatureRow ok>
                <span><span className="font-semibold">Acesso prioritário</span> a todos os novos recursos em desenvolvimento — comparação com concorrentes, benchmarks de setor e análise de tendências — assim que forem lançados, sem custo adicional.</span>
              </FeatureRow>
            </ul>

            <p className="text-slate-700 dark:text-slate-300 mb-6 leading-relaxed">
              E o diferencial que nenhuma plataforma oferece:{" "}
              <span className="font-bold text-indigo-700 dark:text-indigo-400">conexão com consultores empresariais parceiros</span>{" "}
              que transformam os dados da sua reputação em plano de ação concreto.
              Você não vai só ver o problema — vai ter quem te ajude a resolver.
            </p>

            <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-4 mb-6 border border-indigo-200 dark:border-indigo-700">
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                {isEmployerFreeWindowActive ? (
                  <>
                    O Plano Fundador tem gratuidade válida até{" "}
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">31 de julho de 2026</span>.
                    {" "}A partir de agosto de 2026, o plano equivalente será{" "}
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">R$ 1.499,90/mês</span>{" "}
                    — quem já estiver dentro mantém o preço de Fundador{" "}
                    <span className="font-bold">para sempre</span>.
                  </>
                ) : (
                  <>
                    Quem entra agora paga{" "}
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">R$ 1.499,90/mês</span>{" "}
                    no Plano Fundador. Quando os recursos avançados forem lançados, o valor aumenta.{" "}
                    <span className="font-bold">Quem já estiver dentro, não paga a diferença.</span>
                  </>
                )}
              </p>
            </div>

            <p className="text-slate-800 dark:text-slate-200 font-semibold text-center text-lg">
              São poucas vagas nessa condição.<br />
              Empresas que entendem que reputação é estratégia não esperam.
            </p>
          </div>

          {/* Destaque + botão */}
          <div className="max-w-md mx-auto text-center">
            <button
              type="button"
              className="w-full max-w-xs mx-auto py-3 rounded-lg bg-indigo-600 text-white text-lg font-bold hover:bg-indigo-700 transition"
              style={{ animation: "premiumGlowIndigo 2s ease-in-out infinite" }}
              onClick={() => handlePremiumUnlock("employer", "essential")}
              disabled={!!checkoutLoadingAudience}
            >
              {checkoutLoadingAudience === "employer-essential"
                ? (isEmployerFreeWindowActive ? "Ativando acesso gratuito…" : "Abrindo checkout…")
                : (isEmployerFreeWindowActive ? "Ativar gratis ate 31/07/2026" : "Quero ser Fundador")}
            </button>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              {isEmployerFreeWindowActive
                ? "Oferta de lancamento valida para ativacao provisoria do plano empresarial."
                : "Plano mensal para gestores e RH."}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 4 — Benefícios Apoiador ═══════════════ */}
      <div ref={supporterRef} className="scroll-mt-8">
        <PlanosApoiador />
      </div>

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
    </div>
  );
}

/* Linha de feature com ícone check/x */
function FeatureRow({ ok, soon, children }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <FiCheck className="mt-0.5 w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : soon ? (
        <FiClock className="mt-0.5 w-4 h-4 text-blue-500 flex-shrink-0" aria-label="Em breve" />
      ) : (
        <FiX className="mt-0.5 w-4 h-4 text-slate-400 flex-shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}

export default EscolhaPerfil;
