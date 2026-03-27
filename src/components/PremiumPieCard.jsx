import React from "react";

/**
 * Exemplo de bloqueio visual para grafico premium.
 *
 * Props:
 * - isPremium: boolean
 * - title: string
 * - children: conteudo do grafico
 * - onUnlock: callback do botao "Ver Dados Premium"
 */
export default function PremiumPieCard({
  isPremium,
  title,
  children,
  onUnlock,
  isUnlocking = false,
}) {
  return (
    <section className="relative bg-white rounded-2xl border border-slate-200 p-4 overflow-hidden">
      <h3 className="text-sm font-extrabold text-slate-800 mb-3">{title}</h3>

      <div className={isPremium ? "" : "pointer-events-none select-none blur-[6px] opacity-75"}>
        {children}
      </div>

      {!isPremium && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/10 via-white/40 to-white/90">
          <button
            type="button"
            onClick={onUnlock}
            disabled={isUnlocking}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition"
          >
            {isUnlocking ? "Abrindo checkout..." : "Ver Dados Premium"}
          </button>
        </div>
      )}
    </section>
  );
}
