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
      <h3 className="text-lg font-extrabold text-blue-700 mb-1 uppercase text-center">PLANO PREMIUM</h3>
      <div className="text-sm font-bold text-slate-800 mb-3 text-center">Benefícios para Trabalhador</div>
      <div className="flex justify-center mb-3">
        <button className="px-4 py-1 rounded-l-xl bg-blue-700 text-white font-bold">Trabalhador</button>
        <button className="px-4 py-1 rounded-r-xl bg-white border border-blue-700 text-blue-700 font-bold">Empresario</button>
      </div>
      <ul className="text-sm text-slate-800 mb-4 pl-4 list-disc">
        <li>Comparacao clara entre empresas antes de aceitar proposta</li>
        <li>Tendencia real de avaliacao para evitar cilada</li>
        <li>Relatorio com pontos fortes e riscos para decidir melhor</li>
      </ul>
      <div className="flex flex-col items-center">
        {!isPremium && (
          <button
            type="button"
            onClick={onUnlock}
            disabled={isUnlocking}
            className="px-6 py-2 rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition mb-3"
          >
            Desbloquear Premium
          </button>
        )}
        <div className="text-lg font-bold text-black text-center mt-2">Através do Mercado Pago</div>
        <div className="text-xs text-slate-700 text-center">PIX usa pagamento unico. Cartao segue assinatura recorrente.</div>
      </div>
    </section>
  );
}
