import React from "react";
import { useNavigate } from "react-router-dom";

export default function CompanySubmitted({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const featureItems = [
    {
      label: "Diagnóstico real de clima organizacional",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
    {
      label: "Benchmark com empresas do mesmo segmento",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      label: "Conexão com consultores especializados em gestão de pessoas, cultura e liderança",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  const steps = [
    "Confirme seu e-mail para ativar o acesso",
    "Acesse o painel da empresa e veja as avaliações do seu time",
    "Explore relatórios, benchmarks e conecte-se com especialistas do mercado.",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10">
        {/* Header */}
        <div className="text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
            ACESSO EMPRESARIAL
          </div>
          <div className="mt-6 mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg className="h-9 w-9 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-800 dark:text-slate-100">Cadastro enviado com sucesso!</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-snug">
            Verifique seu e-mail corporativo para confirmar o acesso à plataforma.
          </p>
        </div>

        {/* Mensagem institucional */}
        <section className="mt-8 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 p-5">
          <h2 className="text-base font-bold text-blue-800 dark:text-blue-200">Nossa missão com sua empresa</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            O Trabalhei Lá não tem como objetivo prejudicar ou expor empresas de forma negativa. Nossa missão é mapear pontos
            de melhoria no ambiente de trabalho, identificar falhas de gestão e cultura organizacional, e transformar esse
            diagnóstico em oportunidades reais de crescimento. Empresas que utilizam nossa plataforma têm acesso a dados
            honestos que grandes consultorias cobram fortunas para levantar.
          </p>

          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {featureItems.map((item, i) => (
              <li
                key={i}
                className="flex sm:flex-col items-start sm:items-start gap-3 sm:gap-2 bg-white dark:bg-slate-900 border border-blue-100 dark:border-slate-700 rounded-lg p-3"
              >
                <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {item.icon}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Próximos passos */}
        <section className="mt-6">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">O que acontece agora?</h2>
          <ol className="mt-3 space-y-2.5">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-blue-700 text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Rodapé */}
        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex-1 h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Voltar à página principal
          </button>
          {toggleTheme && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition inline-flex items-center justify-center gap-2"
            >
              {theme === "dark" ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              <span className="text-sm font-semibold">Tema</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
