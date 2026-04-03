import React from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";

/* ── Dados dos cards ── */
const CHECK = (
  <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const LOCK = (
  <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const FREE_BENEFITS = [
  "Avaliar empresas onde trabalhou ou trabalha",
  "Publicar comentários sob pseudônimo anônimo",
  "Visualizar avaliações públicas de outras empresas",
  "Criar perfil com pseudônimo e avatar",
  "Importar experiências via LinkedIn ou currículo",
];

const FREE_LOCKED = [
  "Comparar empresas lado a lado",
  "Relatórios executivos",
  "Assessoria jurídica trabalhista",
  "Dashboard de análise detalhada",
  "Tendências de mercado",
];

const PREMIUM_WORKER_BENEFITS = [
  "Tudo do plano gratuito",
  "Comparação de empresas antes de aceitar propostas",
  "Avaliações reais com tendências de mercado",
  "Relatórios executivos com pontos fortes e riscos",
  "Dashboard detalhado de ambiente e cultura",
  "Acesso à Assessoria Jurídica Trabalhista — advogados parceiros com primeira consulta gratuita",
  "Selo de perfil verificado com maior visibilidade",
];

const PREMIUM_COMPANY_BENEFITS = [
  "Comparar sua empresa com concorrentes em tempo real",
  "Identificar tendências e riscos do setor",
  "Relatórios executivos com oportunidades e ameaças",
  "Dashboard dinâmico de desempenho e contratos",
  "Acesso ao marketplace de consultores de RH com 20% de desconto",
  "Acesso ao marketplace de prestadores de serviços corporativos com 15% de desconto",
  "Benchmarks exclusivos e reputação de mercado",
  "Respostas públicas às avaliações dos trabalhadores",
];

export default function Purpose({ theme, toggleTheme }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-10">
        {/* ── Banner ── */}
        <img
          src="/plans-banner.jpg"
          alt="Equipe profissional sorrindo"
          className="w-full h-[200px] object-cover rounded-xl"
        />

        {/* ── Grid de Cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ═══ Card Gratuito ═══ */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Plano Gratuito</h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-full">
                GRÁTIS
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Trabalhador</p>

            <ul className="space-y-2.5 mb-6 flex-1">
              {FREE_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  {CHECK} <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mb-6">
              <ul className="space-y-2.5">
                {FREE_LOCKED.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-400 dark:text-slate-500">
                    {LOCK} <span className="line-through">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              to="/escolha-perfil"
              className="block w-full text-center py-3 rounded-xl font-semibold border-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
            >
              Criar conta gratuita
            </Link>
          </div>

          {/* ═══ Card Premium Trabalhador (destacado) ═══ */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-600 dark:border-blue-500 p-6 flex flex-col shadow-xl lg:-mt-4 lg:mb-4 relative">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Premium Trabalhador</h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-full">
                MAIS POPULAR
              </span>
            </div>
            <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mb-1">
              R$ 29,90<span className="text-sm font-semibold text-slate-500 dark:text-slate-400">/mês</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Trabalhador</p>

            <ul className="space-y-2.5 mb-6 flex-1">
              {PREMIUM_WORKER_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  {CHECK} <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-6 text-center">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Quem é Premium sente até 3x mais segurança na escolha do emprego.
              </p>
            </div>

            <Link
              to="/escolha-perfil"
              className="block w-full text-center py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Assinar Premium
            </Link>
          </div>

          {/* ═══ Card Premium Empresa ═══ */}
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Premium Empresa</h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full">
                PARA EMPRESAS
              </span>
            </div>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mb-1">
              R$ 1.499,90<span className="text-sm font-semibold text-slate-500 dark:text-slate-400">/mês</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Empresa</p>

            <ul className="space-y-2.5 mb-6 flex-1">
              {PREMIUM_COMPANY_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  {CHECK} <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-6 text-center">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                Empresas Premium aumentam em até 3x a assertividade nas decisões.
              </p>
            </div>

            <Link
              to="/escolha-perfil"
              className="block w-full text-center py-3 rounded-xl font-semibold bg-amber-600 text-white hover:bg-amber-700 transition"
            >
              Contratar Plano Empresa
            </Link>
          </div>
        </div>

        {/* ── Rodapé ── */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Todos os planos incluem proteção de dados e anonimato garantido.
        </p>
      </main>
    </div>
  );
}
