import React from "react";


const PremiumCardEmployer = () => (
  <div className="bg-slate-50 rounded-2xl shadow-lg p-7 max-w-xs mx-auto mb-6 border border-slate-200">
    <style>{`
      @keyframes premiumGlowIndigo {
        0%, 100% { box-shadow: 0 0 8px rgba(99,102,241,0.4); }
        50% { box-shadow: 0 0 20px rgba(99,102,241,0.8), 0 0 40px rgba(99,102,241,0.3); }
      }
    `}</style>
    <h2 className="text-blue-700 font-extrabold text-2xl text-center mb-1 uppercase">PLANO FUNDADOR</h2>
    <p className="text-center text-sm font-semibold text-amber-600 mb-1">(em desenvolvimento)</p>
    <div className="text-slate-900 font-bold text-center mb-2 text-lg">R$ 1.499,90/mês</div>
    <p className="font-medium text-center mb-4">
      Garanta acesso antecipado e preço exclusivo de fundador para sempre.
    </p>
    <ul className="text-sm text-slate-800 mb-4 pl-4 list-disc text-left max-w-xs mx-auto">
      <li>Painel completo de avaliações por critério</li>
      <li>Relatório de reputação da empresa</li>
      <li>Ferramenta de resposta a avaliações</li>
      <li>Acesso prioritário a recursos em desenvolvimento (comparação com concorrentes, benchmarks de setor)</li>
      <li>Conexão com consultores empresariais parceiros para transformar dados em ação</li>
    </ul>
    <div className="bg-blue-100 rounded-xl p-3 mb-3 text-blue-900 text-sm font-medium shadow-inner">
      <span className="font-bold">Destaque:</span> Fundadores garantem acesso vitalício ao preço atual, mesmo quando novos recursos forem lançados.
    </div>
    <p className="text-xs text-blue-800 italic mb-3">
      Quem entra agora garante o preço Fundador. Quando os recursos avançados forem lançados, você não paga a diferença.
    </p>
    <button className="w-full py-3 rounded-lg bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition mb-2" style={{ animation: 'premiumGlowIndigo 2s ease-in-out infinite' }}>
      Quero ser Fundador
    </button>
    <div className="text-xs text-slate-500 text-center mt-1">
      Pagamento via Mercado Pago. Escolha PIX, cartão ou boleto no checkout.
    </div>
  </div>
);

export default PremiumCardEmployer;
