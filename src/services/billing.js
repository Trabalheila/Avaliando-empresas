import { buildApiUrl } from "../utils/apiBase";

/**
 * Redireciona para o Mercado Pago Checkout (Assinaturas).
 * Prioriza CNPJ quando disponível e usa companySlug como fallback de vínculo.
 * O backend deve criar a sessao no endpoint /api/create-checkout-session.
 */
export async function handleCheckout({ cnpj, companySlug, companyName, audience, paymentMethod, apoiadorId, tier } = {}) {
  const cleanedCnpjRaw = (cnpj || "").toString().replace(/\D/g, "");
  const cleanedCnpj = cleanedCnpjRaw.length === 14 ? cleanedCnpjRaw : "";
  const normalizedCompanySlug = (companySlug || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const cleanedApoiadorId = (apoiadorId || "").toString().trim();
  const normalizedTier = ["essential", "premium"].includes(tier) ? tier : "essential";

  if (!cleanedCnpj && !normalizedCompanySlug && !cleanedApoiadorId) {
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
      tier: normalizedTier,
      paymentMethod: paymentMethod === "pix" ? "pix" : "card",
      apoiadorId: cleanedApoiadorId || null,
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
    throw new Error("URL de checkout ausente. Verifique a configuracao do servidor.");
  }

  throw new Error("Resposta de checkout invalida.");
}

/**
 * Inicia uma consulta avulsa intermediada pela plataforma com split de pagamento.
 * Reaproveita o mesmo endpoint `/api/create-checkout-session` usando audience="consultation".
 */
export async function requestConsultation({ apoiadorId, apoiadorNome, tier, amount, workerId, especialidade } = {}) {
  if (!apoiadorId) throw new Error("Apoiador não identificado.");
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    throw new Error("Valor da consulta inválido.");
  }
  const safeTier = ["essential", "premium"].includes(tier) ? tier : "essential";

  const response = await fetch(buildApiUrl("/api/create-checkout-session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audience: "consultation",
      apoiadorId,
      apoiadorNome: apoiadorNome || "",
      tier: safeTier,
      amount: safeAmount,
      workerId: workerId || "",
      especialidade: especialidade || "",
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "Não foi possível iniciar a consulta.");

  if (payload?.checkoutUrl) {
    window.location.assign(payload.checkoutUrl);
    return payload;
  }
  throw new Error("Resposta de consulta inválida.");
}
