import React from "react";


const PremiumCardWorker = () => (
  <div className="bg-slate-50 rounded-2xl shadow-lg p-7 max-w-xs mx-auto mb-6 border border-slate-200">
    <h2 className="text-blue-700 font-extrabold text-2xl text-center mb-1 uppercase">PREMIUM PARA TRABALHADOR</h2>
    <div className="text-slate-900 font-bold text-center mb-2 text-lg">R$ 29,90/mês</div>
    <p className="font-medium text-center mb-4">
      Tenha acesso a informações privilegiadas para escolher melhor onde trabalhar e evitar ciladas.
    </p>
    <ul className="text-sm text-slate-800 mb-4 pl-4 list-disc text-left max-w-xs mx-auto">
      <li>Compare empresas antes de aceitar propostas</li>
      <li>Veja avaliações reais e tendências do mercado</li>
      <li>Receba relatórios executivos com pontos fortes e riscos</li>
      <li>Dashboard detalhado para análise de ambiente e cultura</li>
      <li>Mais segurança e transparência na sua decisão</li>
    </ul>
    <div className="bg-blue-100 rounded-xl p-3 mb-3 text-blue-900 text-sm font-medium shadow-inner">
      <span className="font-bold">Destaque:</span> Quem é Premium sente até <span className="font-bold">3x mais segurança</span> na escolha do novo emprego.
    </div>
    <button className="w-full py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition mb-2">
      Quero ser Premium
    </button>
    <div className="text-xs text-slate-500 text-center mt-1">
      Pagamento via Mercado Pago. Escolha PIX, cartão ou boleto no checkout.
    </div>
  </div>
);

export default PremiumCardWorker;
