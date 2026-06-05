import React from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";

/* ──────────────────────────────────────────────
   /para-empresas
   Página dedicada para empresas/empresários:
   apresenta os planos voltados a empresas (Essencial e
   Premium Empresa / Fundador) com benefícios e CTA.
   É o único ponto de entrada para a jornada da Empresa
   acessível pelo footer (link "Para Empresas").
   ────────────────────────────────────────────── */

const CHECK = (
  <svg
    className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ESSENCIAL_BENEFITS = [
  "Visualização da nota geral por critério",
  "Painel básico de avaliações recebidas",
  "Resposta pública oficial às avaliações",
  "5 Créditos de Contato/mês com Especialistas Premium",
];

const PREMIUM_BENEFITS = [
  "Tudo do plano Essencial",
  "Painel completo de avaliações por critério com filtros e séries históricas",
  "Benchmark com até 3 concorrentes do setor (cultura, liderança, salário, equilíbrio)",
  "Avaliar Fornecedores/Clientes por CNPJ e Reputação de Parceiros",
  "Ferramenta de resposta pública oficial às avaliações",
  "Relatório executivo com pontos fortes, riscos e oportunidades",
  "Dashboard de desempenho da reputação",
  "20 Créditos de Contato/mês com Especialistas Premium",
  "Página Meus Contatos",
  "Marketplace de consultores de RH com 20% de desconto",
  "Marketplace de prestadores de serviços corporativos com 15% de desconto",
];

const IN_DEVELOPMENT = [
  "Análise de sentimento e sugestões de IA na resposta",
  "Exportação de relatórios em PDF/CSV",
  "10 Créditos/mês com Trabalhadores Premium",
  "Relatório executivo automatizado",
  "Índice de reputação de mercado",
];

function PlanCard({
  badge,
  title,
  price,
  priceNote,
  description,
  benefits,
  ctaLabel,
  onCta,
  highlighted = false,
}) {
  return (
    <div
      className={`relative bg-white dark:bg-slate-900 rounded-2xl border ${
        highlighted
          ? "border-blue-500 dark:border-blue-400 shadow-xl"
          : "border-slate-200 dark:border-slate-700 shadow-sm"
      } p-6 flex flex-col`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider rounded-full bg-blue-600 text-white shadow">
            Mais completo
          </span>
        </div>
      )}
      {badge && (
        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
          {badge}
        </p>
      )}
      <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <div className="mt-2">
        <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
          {price}
        </p>
        {priceNote && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {priceNote}
          </p>
        )}
      </div>
      {description && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {description}
        </p>
      )}
      <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200 flex-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-2">
            {CHECK}
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCta}
        className={`mt-5 w-full py-3 rounded-lg font-bold text-sm transition ${
          highlighted
            ? "bg-blue-600 hover:bg-blue-700 text-white shadow"
            : "bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white"
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function ParaEmpresas({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const goRegister = () => navigate("/empresa/cadastro");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Para Empresas" />

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-10">
        {/* Hero */}
        <header className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Trabalhei Lá para Empresas
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold">
            Transforme reputação em vantagem competitiva
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300">
            Acompanhe o que dizem sobre a sua marca empregadora, responda
            publicamente às avaliações, faça benchmark com concorrentes do seu
            setor e conecte-se com Especialistas Premium para agir sobre os
            pontos mais críticos.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={goRegister}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow"
            >
              Cadastrar minha empresa
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
            >
              Voltar para o site
            </Link>
          </div>
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
            Gratuito durante o período Fundador (até 31/07/2026).
          </p>
        </header>

        {/* Planos */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <PlanCard
            title="Empresa Essencial"
            badge="Plano Fundador"
            price="Gratuito"
            priceNote="Até 31/07/2026 • depois R$ 899,90/mês"
            description="Para empresas que querem começar a gerenciar a reputação e responder às avaliações recebidas."
            benefits={ESSENCIAL_BENEFITS}
            ctaLabel="Começar grátis"
            onCta={goRegister}
          />
          <PlanCard
            title="Premium Empresa"
            badge="Plano Fundador"
            price="Gratuito"
            priceNote="Até 31/07/2026 • depois R$ 1.649,90/mês"
            description="Para empresas que querem o pacote completo: dashboards, benchmark com concorrentes, avaliação de parceiros e acesso prioritário a Especialistas."
            benefits={PREMIUM_BENEFITS}
            ctaLabel="Quero o Premium Empresa"
            onCta={goRegister}
            highlighted
          />
        </section>

        {/* Em desenvolvimento */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            Em desenvolvimento — liberado sem custo adicional para assinantes
          </h2>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm text-slate-700 dark:text-slate-200">
            {IN_DEVELOPMENT.map((item) => (
              <li key={item} className="flex items-start gap-2">
                {CHECK}
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Quem entra durante o período Fundador garante acesso a essas novas
            funcionalidades sem pagar a diferença quando forem lançadas.
          </p>
        </section>

        {/* CTA final */}
        <section className="bg-blue-600 text-white rounded-2xl p-6 sm:p-8 text-center">
          <h2 className="text-xl sm:text-2xl font-extrabold">
            Pronto para começar?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-blue-100">
            O cadastro é simples e leva poucos minutos. Após a verificação do
            CNPJ, sua empresa já pode responder às avaliações e usar o painel.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={goRegister}
              className="px-5 py-2.5 rounded-lg bg-white text-blue-700 text-sm font-bold shadow hover:bg-blue-50"
            >
              Cadastrar empresa
            </button>
            <a
              href="mailto:contato@trabalheila.com.br?subject=Quero%20conhecer%20o%20plano%20Premium%20Empresa"
              className="px-5 py-2.5 rounded-lg border border-white/60 hover:bg-white/10 text-sm font-semibold"
            >
              Falar com o time comercial
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ParaEmpresas;
