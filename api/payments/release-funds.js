// POST /api/payments/release-funds
//
// Libera o `valor_repasse` retido ao especialista. Disparado:
//   - Automaticamente apos confirmacao do termino da videochamada, OU
//   - Apos prazo de garantia (ex.: 24h pos-consulta via cron / scheduled job).
//
// Autenticacao: header `Authorization: Bearer <INTERNAL_API_TOKEN>`.
// Body: { consulta_id: string }

import { getAdminResources } from "../_firebaseAdmin.js";
import {
  getMercadoPagoAccessToken,
  isInternalCallAuthorized,
} from "./_helpers.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isInternalCallAuthorized(req)) {
    return res.status(401).json({ error: "Nao autorizado." });
  }

  try {
    const { consulta_id } = req.body || {};
    if (!consulta_id || typeof consulta_id !== "string") {
      return res.status(400).json({ error: "consulta_id obrigatorio." });
    }

    const { db, FieldValue } = await getAdminResources();
    const consultaRef = db.collection("consultas").doc(consulta_id);
    const snap = await consultaRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Consulta nao encontrada." });

    const consulta = snap.data() || {};

    if (consulta.status_pagamento !== "approved") {
      return res.status(409).json({ error: "Consulta nao esta paga." });
    }
    if (consulta.custody && consulta.custody.held === false) {
      return res.status(409).json({ error: "Valor ja liberado." });
    }
    if (!consulta.gateway_payment_id) {
      return res.status(400).json({ error: "Sem gateway_payment_id." });
    }

    // Libera no gateway.
    await releaseMercadoPagoPayment(consulta.gateway_payment_id);

    // Atualiza estado local.
    await consultaRef.update({
      status_pagamento: "released",
      custody: { held: false, released_at: FieldValue.serverTimestamp() },
      updated_at: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[release-funds] erro:", err);
    return res.status(500).json({ error: err.message || "Erro interno." });
  }
}

// =========================================================================
// Mercado Pago — liberacao de valor retido (release).
// Para Advanced Payments: PUT /v1/advanced_payments/:id/disbursements/:disb_id
// Para "Saldo em garantia" do Marketplace: voce libera o pagamento via
// endpoint de release configurado no produto.
// Veja: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/release
// =========================================================================
async function releaseMercadoPagoPayment(paymentId) {
  const token = getMercadoPagoAccessToken();

  // Exemplo generico — ajuste o endpoint conforme o produto MP que voce usa.
  const resp = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}/release`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `release-${paymentId}`,
      },
    }
  );

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(`MP release ${resp.status}: ${data?.message || ""}`);
  }
  return true;
}

/*
// Asaas — antecipacao/liberacao manual nao se aplica do mesmo modo:
// no Asaas o split ja envia o valor para o walletId do especialista quando
// a cobranca e confirmada. Para "custody", voce mantem o split apenas para
// a sua wallet e depois faz uma transferencia interna para o walletId do
// especialista via POST /v3/transfers.
*/
