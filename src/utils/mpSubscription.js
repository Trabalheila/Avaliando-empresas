/**
 * Constroi a URL de checkout de assinatura do Mercado Pago para um
 * preapproval_plan_id pre-cadastrado no painel do Mercado Pago.
 *
 * O ID deve estar exposto como variavel de ambiente do React
 * (prefixo REACT_APP_) para ficar acessivel no bundle do frontend.
 */
export function buildMpSubscriptionUrl(planId) {
  let id = (planId || "").toString().trim();
  if (!id) return "";

  // Tolera valores colados de forma incorreta na variavel de ambiente, como:
  // - "preapproval_plan_id=abc123"
  // - "?preapproval_plan_id=abc123"
  // - "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=abc123"
  // Em todos os casos, queremos apenas o ID puro.
  try {
    if (id.includes("preapproval_plan_id=")) {
      const match = id.match(/preapproval_plan_id=([^&\s#]+)/i);
      if (match && match[1]) id = decodeURIComponent(match[1]);
    }
  } catch {
    /* mantem id como esta */
  }
  id = id.replace(/^[?&]+/, "").trim();

  if (!id) return "";
  return `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${id}`;
}

/**
 * IDs dos planos no Mercado Pago, lidos das variaveis de ambiente do React.
 * Lembrete: no Vercel, as variaveis precisam ter o prefixo REACT_APP_ para serem
 * incluidas no build de producao do CRA. Sem esse prefixo, retornarao undefined.
 */
export const MP_PLAN_IDS = {
  worker: {
    essential: process.env.REACT_APP_MP_PLAN_WORKER_ESSENTIAL,
    premium: process.env.REACT_APP_MP_PLAN_WORKER_PREMIUM,
  },
  supporter: {
    essential: process.env.REACT_APP_MP_PLAN_SUPPORTER_ESSENTIAL,
    premium: process.env.REACT_APP_MP_PLAN_SUPPORTER_PREMIUM,
  },
  employer: {
    premium: process.env.REACT_APP_MP_PLAN_EMPLOYER_PREMIUM,
  },
};

export function getMpPlanUrl(audience, tier) {
  const planId = MP_PLAN_IDS?.[audience]?.[tier];
  return buildMpSubscriptionUrl(planId);
}
