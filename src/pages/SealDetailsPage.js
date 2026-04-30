import React from "react";
import { Link } from "react-router-dom";

export default function SealDetailsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300 hover:underline"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Voltar para a página inicial
        </Link>

        <header className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <SealIcon className="h-24 w-24 drop-shadow" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Selo Trabalhei Lá de Excelência
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Reconhecimento das empresas mais bem avaliadas pelos próprios trabalhadores na nossa plataforma.
          </p>
        </header>

        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">O que é o selo?</h2>
          <p className="mt-3 text-slate-700 dark:text-slate-200 leading-relaxed">
            O <strong>Selo Trabalhei Lá de Excelência</strong> é uma distinção concedida automaticamente
            às empresas que mantêm uma reputação consistentemente positiva entre seus trabalhadores. Ele
            é calculado de forma transparente, com base apenas em avaliações reais publicadas na
            plataforma — não há indicação, pagamento ou seleção manual.
          </p>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Critérios para obter o selo</h2>
          <ul className="mt-4 space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold">
                ★
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                <strong>Pontuação média ≥ 4,5</strong> (em uma escala de 1 a 5), considerando todas as avaliações da empresa.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold">
                #
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                <strong>Mínimo de 10 avaliações</strong> publicadas, para garantir representatividade estatística.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold">
                ↻
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                <strong>Reavaliação contínua:</strong> o selo é recalculado automaticamente a cada nova avaliação. Se a empresa deixa de atender aos critérios, o selo é removido.
              </span>
            </li>
          </ul>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Por que ele importa?</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-sm font-bold text-blue-700 dark:text-blue-300">Para trabalhadores</div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                Um sinal confiável e auditável de empresas que tratam bem suas equipes — útil para escolher onde se candidatar.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Para empresas</div>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                Vantagem reputacional em recrutamento e contratos: o selo demonstra cultura saudável validada pelos próprios funcionários.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Perguntas frequentes</h2>
          <div className="mt-4 space-y-4">
            <Faq q="A empresa pode comprar o selo?">
              Não. O selo é totalmente automático e baseado em avaliações reais da plataforma. Não há pagamento, indicação ou intervenção humana na concessão.
            </Faq>
            <Faq q="Avaliações antigas contam?">
              Sim. Todas as avaliações válidas e não removidas entram na média. Avaliações apagadas pelo autor ou por moderação são desconsideradas.
            </Faq>
            <Faq q="O selo pode ser perdido?">
              Sim. A cada nova avaliação a média é recalculada. Se a empresa cair abaixo dos critérios, o selo é automaticamente removido até que volte a atendê-los.
            </Faq>
            <Faq q="Como uma empresa contesta uma avaliação?">
              Empresas com plano Premium podem responder publicamente a cada avaliação direto pelo dashboard. Conteúdo que viole os Termos pode ser denunciado para análise.
            </Faq>
          </div>
        </section>
      </div>
    </div>
  );
}

function Faq({ q, children }) {
  return (
    <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 group">
      <summary className="cursor-pointer font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
        <span>{q}</span>
        <span className="ml-4 text-blue-700 dark:text-blue-300 group-open:rotate-45 transition-transform">+</span>
      </summary>
      <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{children}</div>
    </details>
  );
}

export function SealIcon({ className = "h-6 w-6", title = "Selo Trabalhei Lá de Excelência" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      {/* Fitas */}
      <path d="M20 44 L14 60 L22 56 L26 62 L30 48 Z" fill="#1D4ED8" />
      <path d="M44 44 L50 60 L42 56 L38 62 L34 48 Z" fill="#1D4ED8" />
      {/* Medalha */}
      <circle cx="32" cy="28" r="20" fill="url(#sealGold)" stroke="#92400E" strokeWidth="2" />
      <circle cx="32" cy="28" r="14" fill="none" stroke="#FFFBEB" strokeWidth="1.5" opacity="0.7" />
      {/* Estrela */}
      <path
        d="M32 17 l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1 Z"
        fill="#FFFBEB"
        stroke="#92400E"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
