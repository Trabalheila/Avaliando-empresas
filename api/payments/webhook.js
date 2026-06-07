// POST /api/payments/webhook  (publico)
//
// Recebe notificacoes assincronas do gateway de pagamento.
// Para evitar manipulacao, sempre re-consultamos a API do gateway com o
// `id` recebido (nao confiamos no payload bruto).
//
// Quando o pagamento e aprovado:
//   1) Marca status_pagamento = 'approved'
//   2) Ativa sala_video_url
//   3) Mantem custody.held = true (liberacao via /release-funds)

import { getAdminResources } from "../_firebaseAdmin.js";
import {
  getMercadoPagoAccessToken,
  verifyWebhookSignature,
  buildVideoRoomUrl,
} from "./_helpers.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Valida assinatura/origem.
  if (!verifyWebhookSignature(req, "mercadopago")) {
    return res.status(401).json({ error: "Assinatura invalida." });
  }

  try {
    const body = req.body || {};
    // MP envia { type, data: { id } } ou query ?type=payment&id=...
    const type = body.type || body.action || req.query?.type || "";
    const paymentId =
      body?.data?.id || body?.resource || req.query?.id || req.query?.["data.id"];

    if (!paymentId) {
      // Aceita ping de teste do MP (200 sem corpo) sem ruido nos logs.
      return res.status(200).json({ ok: true, skipped: "no_payment_id" });
    }

    // 2. Re-consulta o pagamento na API do gateway (fonte da verdade).
    const payment = await fetchMercadoPagoPayment(paymentId);
    if (!payment) {
      return res.status(200).json({ ok: true, skipped: "payment_not_found" });
    }

    const status = (payment.status || "").toLowerCase(); // approved, pending, rejected, refunded...
    const externalReference = payment.external_reference || ""; // consulta_id
    const preferenceId = payment.order?.id || payment.preference_id || "";

    const { db, FieldValue } = await getAdminResources();

    // 3. Localiza a consulta. Preferimos external_reference; fallback por
    //    gateway_charge_id (preference) ou gateway_payment_id.
    let consultaRef = null;
    if (externalReference) {
      consultaRef = db.collection("consultas").doc(externalReference);
      const snap = await consultaRef.get();
      if (!snap.exists) consultaRef = null;
    }
    if (!consultaRef && preferenceId) {
      const q = await db
        .collection("consultas")
        .where("gateway_charge_id", "==", String(preferenceId))
        .limit(1)
        .get();
      if (!q.empty) consultaRef = q.docs[0].ref;
    }
    if (!consultaRef) {
      const q = await db
        .collection("consultas")
        .where("gateway_payment_id", "==", String(paymentId))
        .limit(1)
        .get();
      if (!q.empty) consultaRef = q.docs[0].ref;
    }
    if (!consultaRef) {
      return res.status(200).json({ ok: true, skipped: "consulta_not_found" });
    }

    // 4. Atualiza status conforme retorno do gateway.
    const update = {
      gateway_payment_id: String(paymentId),
      status_pagamento: status,
      gateway_status_detail: payment.status_detail || null,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (status === "approved") {
      update.sala_video_url = buildVideoRoomUrl(consultaRef.id);
      update.paid_at = FieldValue.serverTimestamp();
      update.custody = { held: true }; // segura ate /release-funds
    } else if (status === "refunded" || status === "cancelled") {
      update.custody = { held: false, released_at: null };
    }

    await consultaRef.update(update);

    return res.status(200).json({ ok: true, type, status });
  } catch (err) {
    console.error("[webhook] erro:", err);
    // Sempre retorne 200 para o gateway nao tentar reenviar indefinidamente
    // em erros internos. Logue e processe via fila se precisar reprocessar.
    return res.status(200).json({ ok: false, error: err.message });
  }
}

async function fetchMercadoPagoPayment(paymentId) {
  const token = getMercadoPagoAccessToken();
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    if (resp.status === 404) return null;
    throw new Error(`MP fetch payment ${resp.status}`);
  }
  return resp.json();
}
