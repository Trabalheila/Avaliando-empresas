// src/components/Specialist/SpecialistDemandInsights.jsx
//
// Card "Visão Geral da Demanda" exibido no painel do especialista
// (ApoiadorRequisicoes) APENAS para usuários do Plano Gratuito.
//
// Mostra dados agregados/anonimizados (mock determinístico baseado
// na especialidade e cidade) que dão noção do potencial da
// plataforma. Inclui CTA "Desbloquear Oportunidades" -> /especialista/beneficios
// e botão "Experimente o Fluxo do Cliente" -> /trabalhador/encontrar-especialista?tour=1

import React, { useMemo } from "react";

function hashString(s) {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pickDemandTone(searches) {
  if (searches >= 80) {
    return {
      tone: "Alta demanda",
      msg: "Há uma alta demanda por profissionais como você! Aproveite o momento.",
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-100 dark:bg-emerald-900/40",
    };
  }
  if (searches >= 35) {
    return {
      tone: "Demanda crescente",
      msg: "Sua especialidade tem demanda recorrente — vale destacar seu perfil.",
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-100 dark:bg-blue-900/40",
    };
  }
  return {
    tone: "Mercado em formação",
    msg: "Especialistas que se posicionam primeiro ganham os primeiros clientes.",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-900/40",
  };
}

export default function SpecialistDemandInsights({ apoiador, navigate }) {
  const especialidade =
    apoiador?.especialidade ||
    apoiador?.area ||
    apoiador?.profissao ||
    "Sua especialidade";
  const cidade =
    apoiador?.cidade || apoiador?.localizacao || apoiador?.uf || "online";

  // Mock determinístico para o MVP: parece realista e é estável por usuário.
  const { searches, activeSpecialists } = useMemo(() => {
    const seed = hashString(`${especialidade}|${cidade}`);
    return {
      searches: 18 + (seed % 110), // 18..127 buscas/semana
      activeSpecialists: 2 + ((seed >> 3) % 22), // 2..23 ativos
    };
  }, [especialidade, cidade]);

  const tone = pickDemandTone(searches);

  return (
    <section className="mb-6 p-5 rounded-2xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300">
            Plano Gratuito · Visão Geral da Demanda
          </p>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 mt-1">
            Como está o mercado para você
          </h2>
        </div>
        <span
          className={`text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${tone.bg} ${tone.color}`}
        >
          {tone.tone}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Sua especialidade
          </p>
          <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {especialidade}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {cidade}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Buscas na última semana
          </p>
          <p className="mt-1 text-2xl font-extrabold text-blue-700 dark:text-blue-300">
            {searches}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            na sua região / online
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Especialistas ativos na área
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            {activeSpecialists}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            disputando essas buscas
          </p>
        </div>
      </div>

      <p className={`mt-4 text-sm font-semibold ${tone.color}`}>{tone.msg}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate("/especialista/beneficios")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
        >
          🔓 Desbloquear Oportunidades
        </button>
        <button
          type="button"
          onClick={() =>
            navigate("/trabalhador/encontrar-especialista?tour=1")
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
        >
          👀 Experimente o Fluxo do Cliente
        </button>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        Os números são agregados e anonimizados. Faça upgrade para receber e
        responder solicitações dos clientes.
      </p>
    </section>
  );
}
