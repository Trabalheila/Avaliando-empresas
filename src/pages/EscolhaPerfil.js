import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { handleCheckout } from "../services/billing";
import { db } from "../firebase";
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "firebase/firestore";
import { isPremium, getUserRole } from "../utils/rbac";
import { resolveProfileId } from "../utils/profileIdentity";
import {
  FiCheck, FiX,
} from "react-icons/fi";
import AppHeader from "../components/AppHeader";
import PlanosApoiador from "../components/PlanosApoiador";

function EscolhaPerfil({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const workerRef = useRef(null);
  const employerRef = useRef(null);
  const supporterRef = useRef(null);
  const [checkoutLoadingAudience, setCheckoutLoadingAudience] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [consultores, setConsultores] = useState([]);
  const [prestadores, setPrestadores] = useState([]);
  const [guardChecked, setGuardChecked] = useState(false);
  const userIsPremium = React.useMemo(() => isPremium(), []);
  const userRole = React.useMemo(() => getUserRole(), []);
  const isEmpresaPremium = userIsPremium && (userRole === "admin_empresa" || userRole === "empresa");
  const viewingPlans = new URLSearchParams(window.location.search).get("planos") === "1";

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
  }, [navigate]);

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

  const handlePremiumUnlock = async (audience = "worker") => {
    setCheckoutLoadingAudience(audience);
    setCheckoutError("");
    try {
      // Marcar que o usuário já fez a escolha de perfil
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        stored.profileTypeChosen = audience;
        localStorage.setItem("userProfile", JSON.stringify(stored));
        // Salvar no Firestore
        const pid = stored?.profileId || resolveProfileId(stored, { persistGeneratedId: false });
        if (pid) {
          const userRef = doc(db, "users", pid);
          await setDoc(userRef, { profileTypeChosen: audience }, { merge: true });
        }
      } catch { /* silencioso */ }

      await handleCheckout({
        cnpj: "",
        companySlug: "trabalhei-la",
        companyName: "Trabalheila",
        audience,
      });
    } catch (err) {
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
                Compare empresas, veja avaliações reais e tome decisões mais seguras na sua carreira.
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
                Monitore reputação, compare concorrentes e tome decisões estratégicas com dados reais.
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
                alt="Apoiadores"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                style={{ objectPosition: 'center 15%' }}
              />
            </div>
            <div className="p-6 flex flex-col items-center text-center flex-1">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sou Apoiador</h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Crie seu perfil de consultor ou advogado. Receba contatos gratuitos de potenciais clientes e destaque suas habilidades.
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
            {/* Gratuito */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Gratuito</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">R$ 0</p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <FeatureRow ok>Avaliar empresas anonimamente</FeatureRow>
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Comentários públicos</FeatureRow>
                <FeatureRow>Comparar empresas lado a lado</FeatureRow>
                <FeatureRow>Relatórios executivos completos</FeatureRow>
                <FeatureRow>Dashboard de cultura e ambiente</FeatureRow>
                <FeatureRow>Tendências e análises exclusivas</FeatureRow>
                <FeatureRow>Assessoria jurídica trabalhista gratuita</FeatureRow>
              </ul>
            </div>

            {/* Premium Trabalhador */}
            <div className="rounded-2xl border-2 border-blue-400 dark:border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                RECOMENDADO
              </div>
              <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mb-1">Premium</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                R$ 29,90<span className="text-sm font-medium text-slate-600 dark:text-slate-400">/mês</span>
              </p>
              <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
                <FeatureRow ok>Avaliar empresas anonimamente</FeatureRow>
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Comentários públicos</FeatureRow>
                <FeatureRow ok>Comparar empresas lado a lado</FeatureRow>
                <FeatureRow ok>Relatórios executivos completos</FeatureRow>
                <FeatureRow ok>Dashboard de cultura e ambiente</FeatureRow>
                <FeatureRow ok>Tendências e análises exclusivas</FeatureRow>
                <FeatureRow ok>Assessoria jurídica trabalhista — primeira consulta gratuita com advogados parceiros</FeatureRow>
                <FeatureRow ok>Primeira consulta gratuita com advogado trabalhista parceiro verificado</FeatureRow>
                <FeatureRow ok>Orientação sobre rescisão indevida, assédio moral e discriminação</FeatureRow>
                <FeatureRow ok>Acesso ao marketplace de advogados com OAB verificada</FeatureRow>
                <FeatureRow ok>Avaliações de outros usuários Premium sobre advogados parceiros</FeatureRow>
              </ul>
            </div>
          </div>

          {/* Destaque + botão */}
          <div className="max-w-md mx-auto text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 mb-4 text-blue-900 dark:text-blue-200 text-sm font-medium shadow-inner">
              <span className="font-bold">Destaque:</span> Quem é Premium sente até{" "}
              <span className="font-bold">3× mais segurança</span> na escolha do emprego.
            </div>
            <button
              type="button"
              className="w-full max-w-xs mx-auto py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition"
              style={{ animation: "premiumGlow 2s ease-in-out infinite" }}
              onClick={() => handlePremiumUnlock("worker")}
              disabled={!!checkoutLoadingAudience}
            >
              {checkoutLoadingAudience === "worker" ? "Abrindo checkout…" : "Quero ser Premium"}
            </button>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
            {/* Gratuito */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Gratuito</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">R$ 0</p>
              <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <FeatureRow ok>Ver nota geral da empresa</FeatureRow>
                <FeatureRow ok>Acompanhar avaliações públicas</FeatureRow>
                <FeatureRow>Painel completo de avaliações por critério</FeatureRow>
                <FeatureRow>Relatório de reputação da empresa</FeatureRow>
                <FeatureRow>Ferramenta de resposta a avaliações</FeatureRow>
                <FeatureRow>Acesso prioritário a recursos em desenvolvimento</FeatureRow>
                <FeatureRow>Conexão com consultores empresariais parceiros</FeatureRow>
              </ul>
            </div>

            {/* Plano Fundador */}
            <div className="rounded-2xl border-2 border-indigo-400 dark:border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                FUNDADOR
              </div>
              <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mb-1">Plano Fundador</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                R$ 1.499,90<span className="text-sm font-medium text-slate-600 dark:text-slate-400">/mês</span>
              </p>
              <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
                <FeatureRow ok>Painel completo de avaliações por critério</FeatureRow>
                <FeatureRow ok>Relatório de reputação da empresa</FeatureRow>
                <FeatureRow ok>Ferramenta de resposta a avaliações</FeatureRow>
                <FeatureRow ok>Direito de resposta pública às avaliações — responda comentários dos funcionários diretamente na página da empresa, com identificação de "Resposta oficial da empresa"</FeatureRow>
                <FeatureRow ok>Acesso prioritário a recursos em desenvolvimento (comparação com concorrentes, benchmarks de setor)</FeatureRow>
                <FeatureRow ok>Conexão com consultores empresariais parceiros para transformar dados em ação</FeatureRow>
              </ul>
              <p className="mt-3 text-xs text-indigo-700 dark:text-indigo-300 italic">
                Quem entra agora garante o preço Fundador. Quando os recursos avançados forem lançados, você não paga a diferença.
              </p>
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
                Quem entra agora paga{" "}
                <span className="font-bold text-indigo-700 dark:text-indigo-400">R$ 1.499,90/mês</span>{" "}
                no Plano Fundador. Quando os recursos avançados forem lançados, o valor aumenta.{" "}
                <span className="font-bold">Quem já estiver dentro, não paga a diferença.</span>
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
              onClick={() => handlePremiumUnlock("employer")}
              disabled={!!checkoutLoadingAudience}
            >
              {checkoutLoadingAudience === "employer" ? "Abrindo checkout…" : "Quero ser Fundador"}
            </button>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              Plano mensal para gestores e RH.
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
function FeatureRow({ ok, children }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <FiCheck className="mt-0.5 w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <FiX className="mt-0.5 w-4 h-4 text-slate-400 flex-shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}

export default EscolhaPerfil;
