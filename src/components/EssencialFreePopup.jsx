import React, { useEffect, useState } from "react";

/**
 * Popup contextual de gratuidade dos planos Essencial até 30/06/2026.
 *
 * Props:
 * - planName: nome do plano (ex.: "Trabalhador Essencial")
 * - storageKey: chave única no localStorage para não exibir mais de uma vez
 * - ctaLabel?: rótulo do botão principal (default "Quero Aproveitar!")
 * - onCta?: callback opcional ao clicar no CTA. Se não informado, apenas fecha.
 * - accent?: "blue" | "indigo" | "amber" (cor do botão e badge)
 */
const ACCENT_STYLES = {
  blue: {
    btn: "bg-blue-600 hover:bg-blue-700",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    ring: "ring-blue-200 dark:ring-blue-900/40",
  },
  indigo: {
    btn: "bg-indigo-600 hover:bg-indigo-700",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    ring: "ring-indigo-200 dark:ring-indigo-900/40",
  },
  amber: {
    btn: "bg-amber-500 hover:bg-amber-600",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ring: "ring-amber-200 dark:ring-amber-900/40",
  },
};

export default function EssencialFreePopup({
  planName,
  storageKey,
  ctaLabel = "Quero Aproveitar!",
  onCta,
  accent = "blue",
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  const close = () => {
    try {
      if (storageKey) localStorage.setItem(storageKey, String(Date.now()));
    } catch { /* silencioso */ }
    setOpen(false);
  };

  const handleCta = () => {
    close();
    if (typeof onCta === "function") onCta();
  };

  if (!open) return null;

  const styles = ACCENT_STYLES[accent] || ACCENT_STYLES.blue;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="essencial-free-popup-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 text-center ring-4 ${styles.ring}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          ✕
        </button>

        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-2xl">
          🎁
        </div>

        <span
          className={`inline-block mt-3 text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full ${styles.badge}`}
        >
          OFERTA LIMITADA
        </span>

        <h2
          id="essencial-free-popup-title"
          className="mt-3 text-xl font-extrabold text-slate-800 dark:text-slate-100"
        >
          Aproveite!
        </h2>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          O plano <span className="font-bold">{planName}</span> está{" "}
          <span className="font-bold text-emerald-600 dark:text-emerald-400">GRATUITO</span>{" "}
          com todos os recursos até{" "}
          <span className="font-bold">30 de junho de 2026</span>! Cadastre-se agora e experimente!
        </p>

        <button
          type="button"
          onClick={handleCta}
          className={`mt-6 w-full py-2.5 rounded-xl text-white font-bold text-sm transition ${styles.btn}`}
        >
          {ctaLabel}
        </button>

        <button
          type="button"
          onClick={close}
          className="mt-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline-offset-2 hover:underline"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
