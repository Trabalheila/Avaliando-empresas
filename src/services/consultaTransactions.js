// src/services/consultaTransactions.js
//
// Cliente do endpoint placeholder /api/register-consultation-transaction.
// Registra a transação financeira de uma consulta avulsa após a "simulação"
// de pagamento. Não realiza repasse real ao especialista — apenas grava os
// valores no Firestore para auditoria/relatórios futuros.

import { buildApiUrl } from "../utils/apiBase";

/**
 * Registra a transação no backend.
 *
 * @param {object} payload
 * @param {string} payload.userId            UID do trabalhador pagante.
 * @param {string} payload.specialistId      ID do apoiador/especialista.
 * @param {string} payload.consultationId    ID do doc em /consultas.
 * @param {number} payload.originalAmount    Preço base da consulta (R$).
 * @param {number} payload.discountApplied   Desconto em R$ (0 se não aplicável).
 * @param {number} payload.finalAmountPaid   Valor efetivamente cobrado (R$).
 * @param {number} payload.platformCommission Comissão da plataforma (R$).
 * @param {number} payload.amountDueToSpecialist Valor devido ao especialista (R$).
 * @param {object} [payload.paymentMeta]     Metadados do gateway (last4, brand, paymentMethodId).
 */
export async function registerConsultationTransaction(payload) {
  const res = await fetch(buildApiUrl("/api/register-consultation-transaction"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && data.error) || `Falha ao registrar transação (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return data;
}
