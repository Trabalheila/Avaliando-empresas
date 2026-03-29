import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { handleCheckout } from "../services/billing";
import {
  FiCheck, FiX, FiArrowLeft,
} from "react-icons/fi";

function EscolhaPerfil({ theme, toggleTheme }) {
  const workerRef = useRef(null);
  const employerRef = useRef(null);
  const [checkoutLoadingAudience, setCheckoutLoadingAudience] = useState(null);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePremiumUnlock = async (audience = "worker") => {
    setCheckoutLoadingAudience(audience);
    try {
      await handleCheckout({
        cnpj: "",
        companySlug: "trabalhei-la",
        companyName: "Trabalheila",
        audience,
      });
    } catch {
      // checkout error handled by billing service
    } finally {
      setCheckoutLoadingAudience(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center">
      {/* Top bar */}
      <div className="w-full max-w-5xl px-4 pt-6 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold hover:underline"
        >
          <FiArrowLeft /> Voltar
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? "🌙 Tema" : "☀️ Tema"}
        </button>
      </div>

      {/* ═══════════════ SEÇÃO 1 — Escolha seu perfil ═══════════════ */}
      <section className="w-full max-w-5xl px-4 pt-10 pb-16">
        <h1 className="text-3xl md:text-4xl font-extrabold text-center text-slate-900 dark:text-white mb-2">
          Escolha seu perfil
        </h1>
        <p className="text-center text-slate-600 dark:text-slate-400 mb-10 text-lg">
          Descubra os benefícios exclusivos para cada perfil.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Card Trabalhador */}
          <button
            type="button"
            onClick={() => scrollTo(workerRef)}
            className="group relative rounded-3xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 overflow-hidden shadow-lg hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="w-full h-52 overflow-hidden">
              <img
                src="/Trampo.jpg"
                alt="Trabalhadores"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
            <div className="w-full h-52 overflow-hidden">
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
        </div>
      </section>

      {/* ═══════════════ SEÇÃO 2 — Benefícios Trabalhador ═══════════════ */}
      <section
        ref={workerRef}
        className="w-full bg-white dark:bg-slate-900 py-16 scroll-mt-8"
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
