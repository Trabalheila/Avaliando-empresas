import { loadStripe } from "@stripe/stripe-js";
import { buildApiUrl } from "../utils/apiBase";

let stripePromise;

function getStripe() {
  if (!stripePromise) {
    const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error("REACT_APP_STRIPE_PUBLISHABLE_KEY nao configurada.");
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

/**
 * Redireciona para o Stripe Checkout e envia o CNPJ como client_reference_id.
 * O backend deve criar a sessao no endpoint /api/create-checkout-session.
 */
export async function handleCheckout(cnpj) {
  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");
  if (cleanedCnpj.length !== 14) {
    throw new Error("CNPJ invalido. Informe 14 digitos.");
  }

  const response = await fetch(buildApiUrl("/api/create-checkout-session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cnpj: cleanedCnpj }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.sessionId) {
    throw new Error(payload?.error || "Nao foi possivel iniciar o checkout.");
  }

  const stripe = await getStripe();
  if (!stripe) {
    throw new Error("Falha ao inicializar Stripe.js.");
  }

  const { error } = await stripe.redirectToCheckout({
    sessionId: payload.sessionId,
  });

  if (error) {
    throw new Error(error.message || "Falha ao redirecionar para o checkout.");
  }
}
