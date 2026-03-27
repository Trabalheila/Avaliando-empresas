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
 * Redireciona para o Stripe Checkout.
 * Prioriza CNPJ quando disponível e usa companySlug como fallback de vínculo.
 * O backend deve criar a sessao no endpoint /api/create-checkout-session.
 */
export async function handleCheckout({ cnpj, companySlug, companyName } = {}) {
  const cleanedCnpjRaw = (cnpj || "").toString().replace(/\D/g, "");
  const cleanedCnpj = cleanedCnpjRaw.length === 14 ? cleanedCnpjRaw : "";
  const normalizedCompanySlug = (companySlug || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleanedCnpj && !normalizedCompanySlug) {
    throw new Error("Nao foi possivel identificar a empresa para iniciar o checkout.");
  }

  const response = await fetch(buildApiUrl("/api/create-checkout-session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cnpj: cleanedCnpj || null,
      companySlug: normalizedCompanySlug || null,
      companyName: (companyName || "").toString().trim() || null,
    }),
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
