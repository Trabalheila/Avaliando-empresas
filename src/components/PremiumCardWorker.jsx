import React from "react";

const PremiumCardWorker = () => (
  <div className="bg-slate-50 rounded-2xl shadow-lg p-7 max-w-xs mx-auto mb-6 border border-slate-200">
    <h2 className="text-blue-700 font-extrabold text-2xl text-center mb-1 uppercase">PLANO PREMIUM</h2>
    <div className="text-slate-900 font-bold text-center mb-2">Workers</div>
    <p className="font-medium text-center mb-4">
      Acesso exclusivo a relatórios, comparativos e tendências para tomar decisões melhores.
    </p>
    <ul className="text-sm text-slate-800 mb-4 pl-4 list-disc text-left max-w-xs mx-auto">
      <li>Compare empresas antes de aceitar propostas</li>
      <li>Veja tendências reais de avaliação e evite ciladas</li>
      <li>Receba relatórios executivos com pontos fortes e riscos</li>
      <li>Dashboard detalhado para análise de desempenho</li>
    </ul>
    <div className="bg-blue-100 rounded-xl p-3 mb-3 text-blue-900 text-sm font-medium shadow-inner">
      <span className="font-bold">Destaque:</span> Usuários Premium relatam até <span className="font-bold">3x mais segurança</span> na escolha de empresas.
    </div>
    <button className="w-full py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition mb-2">
      Quero ser Premium — R$ 29,90
    </button>
    <div className="text-xs text-slate-500 text-center mt-1">
      Pagamento via Mercado Pago. Escolha PIX, cartão ou boleto no checkout.
    </div>
  </div>
);

export default PremiumCardWorker;
