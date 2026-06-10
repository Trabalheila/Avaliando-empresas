// src/components/ConsultaAvulsaIntroModal.jsx
//
// Modal de introdução ao fluxo "Consulta Avulsa".
// Explica em 3 passos como funciona e direciona ao seletor de
// especialistas (ConsultaAvulsaModal). Reutiliza os mesmos tokens
// visuais (rounded-3xl, shadow-xl, bordas leves) dos cards principais.

import React, { useEffect } from "react";
import { FaInfoCircle, FaUserMd, FaLock, FaVideo } from "react-icons/fa";

const STEPS = [
  {
    icon: FaUserMd,
    title: "Escolha o especialista",
    desc: "Selecione o especialista ideal para o seu caso.",
  },
  {
    icon: FaLock,
    title: "Pague com segurança",
    desc: "Faça o pagamento seguro da taxa da consulta direto pelo nosso app.",
  },
  {
    icon: FaVideo,
    title: "Atendimento por vídeo",
    desc:
      "Acesse a sala de vídeo exclusiva e envie seus arquivos protegidos por criptografia.",
  },
];

export default function ConsultaAvulsaIntroModal({ open, onClose, onContinue }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:px-4 sm:py-6 bg-slate-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consulta-avulsa-intro-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 sm:px-8 pt-6 pb-2 flex items-start justify-between gap-4 shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
              <FaInfoCircle aria-hidden="true" /> Como funciona
            </p>
            <h2
              id="consulta-avulsa-intro-title"
              className="mt-1 text-xl sm:text-2xl font-extrabold text-blue-800 dark:text-blue-200"
            >
              Consulta Avulsa em 3 passos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none -mt-1"
          >
            ×
          </button>
        </div>

        <div className="px-6 sm:px-8 py-6 overflow-y-auto overscroll-contain">
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/60 dark:bg-slate-800 px-4 py-4 shadow-sm flex flex-col items-center text-center"
                >
                  <span className="absolute -top-2 -left-2 h-7 w-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shadow">
                    {i + 1}
                  </span>
                  <span className="h-10 w-10 rounded-full bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 flex items-center justify-center text-blue-700 dark:text-blue-300 text-lg mb-2">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                    {step.desc}
                  </p>
                </li>
              );
            })}
          </ol>

          <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 text-center">
            Pagamento processado pela plataforma. Você só fala com o
            especialista após o aceite e a confirmação do pagamento.
          </p>
        </div>

        <div className="px-6 sm:px-8 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 sm:justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center items-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow hover:bg-blue-700 transition"
          >
            Ver Especialistas Disponíveis
          </button>
        </div>
      </div>
    </div>
  );
}
