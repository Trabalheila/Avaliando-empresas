import { buildApiUrl } from "../utils/apiBase";

/**
 * Redireciona para o Stripe/MercadoPago Checkout.
 * Prioriza CNPJ quando disponível e usa companySlug como fallback de vínculo.
 * O backend deve criar a sessao no endpoint /api/create-checkout-session.
 */
export async function handleCheckout({ cnpj, companySlug, companyName, audience, paymentMethod } = {}) {
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
      audience: ["worker", "employer", "supporter"].includes(audience) ? audience : "worker",
      paymentMethod: paymentMethod === "pix" ? "pix" : "card",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "Nao foi possivel iniciar o checkout.");
  }

  if (payload?.redirectMode === "url" && payload?.checkoutUrl) {
    window.location.assign(payload.checkoutUrl);
    return;
  }

  // Fallback: se o backend retornou sessionId sem URL, monta a URL
  if (payload?.sessionId) {
    // Stripe Checkout Session URLs seguem este padrão se a URL direta não foi fornecida
    throw new Error("URL de checkout ausente. Verifique a configuração do servidor.");
  }

  throw new Error("Resposta de checkout invalida.");
}
