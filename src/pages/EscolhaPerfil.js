import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { handleCheckout } from "../services/billing";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { resolveProfileId } from "../utils/profileIdentity";
import AppHeader from "../components/AppHeader";
import PaymentInfoModal from "../components/Specialist/PaymentInfoModal";
import { getMpPlanUrl } from "../utils/mpSubscription";

// Flag temporaria: assinaturas pagas via Mercado Pago. Mantida aqui para
// permitir desativar rapidamente em caso de incidente. Defina como `true`
// para bloquear novos checkouts.
const PAID_CHECKOUT_DISABLED = false;
const PAID_CHECKOUT_DISABLED_MSG = "Em breve";

function EscolhaPerfil({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const workerRef = useRef(null);
  const supporterRef = useRef(null);
  const [checkoutLoadingAudience, setCheckoutLoadingAudience] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [guardChecked, setGuardChecked] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const viewingPlans = React.useMemo(
    () => new URLSearchParams(location.search).get("planos") === "1",
    [location.search]
  );

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

  const handlePremiumUnlock = async (audience = "worker", tier = "essential") => {
    // [DEBUG] Confirma que o clique chegou na funcao (problema de binding -> nao aparece)
    console.log("[handlePremiumUnlock] CLICADO", { audience, tier, ts: new Date().toISOString() });

    // BLOQUEIO opcional: respeita a flag PAID_CHECKOUT_DISABLED para permitir
    // desativar checkouts em caso de incidente.
    if (PAID_CHECKOUT_DISABLED) {
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

      // Caminho 1: redirect direto para o checkout de assinatura do Mercado Pago
      // usando preapproval_plan_id da variavel de ambiente.
      const directMpUrl = getMpPlanUrl(audience, tier);
      const hasConfiguredPlanId = !!(
        (typeof process !== "undefined" && process.env) &&
        process.env[`REACT_APP_MP_PLAN_${String(audience).toUpperCase()}_${String(tier).toUpperCase()}`]
      );
      console.log("[handlePremiumUnlock] getMpPlanUrl ->", { directMpUrl, hasConfiguredPlanId });

      // Se a variavel de ambiente esta presente mas a URL nao pode ser construida,
      // significa que o valor configurado e invalido. Falha rapido com mensagem
      // clara em vez de chamar o backend e gerar mais confusao.
      if (hasConfiguredPlanId && !directMpUrl) {
        setCheckoutError(
          "Plano de assinatura mal configurado (preapproval_plan_id invalido). Avise o suporte."
        );
        return;
      }

      if (directMpUrl) {
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
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10 text-2xl">
          Descubra os benefícios exclusivos para cada perfil.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl mx-auto" style={{ justifyItems: 'center' }}>
          {/* Card Trabalhador */}
          <button
            type="button"
            onClick={() => navigate("/trabalhador/beneficios")}
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

          {/* Card Apoiador */}
          <button
            type="button"
            onClick={() => navigate("/especialista/beneficios")}
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
                Ofereça seus serviços a trabalhadores que precisam de apoio especializado.
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
              <p className="mt-1 text-2xl font-extrabold text-blue-700 dark:text-blue-300">R$ 0</p>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 flex-1">
                Encontre o especialista ideal, inicie um chat limitado e tenha acesso a um{" "}
                <strong>desconto exclusivo na primeira consulta</strong> com especialistas Essenciais.
                Perfeito para resolver dúvidas pontuais.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 flex flex-col">
              <h4 className="text-lg font-extrabold text-amber-700 dark:text-amber-300">Plano Premium</h4>
              <p className="mt-1 text-2xl font-extrabold text-amber-700 dark:text-amber-300">R$ 29,90/mês</p>
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

      {/* ═══════════════ SEÇÃO 3 — Benefícios Especialista ═══════════════ */}
      <section
        ref={supporterRef}
        className="w-full bg-white dark:bg-slate-900 py-10 scroll-mt-8"
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-extrabold text-center text-blue-700 dark:text-blue-400 mb-2">
            Sou Especialista
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
            Ofereça seus serviços a trabalhadores que precisam de apoio
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
    </div>
  );
}

export default EscolhaPerfil;
