// /api/payments — dispatcher unico para todas as rotas de pagamento.
// Consolidado em 1 funcao serverless para respeitar o limite do plano
// Vercel Hobby (12 functions). Rewrites em vercel.json mapeiam as URLs
// publicas para esta funcao.
//
// Rotas (selecionadas via querystring ?op= ou path no rewrite):
//   POST /api/payments/create-charge          -> op=create-charge      (Checkout Pro generico)
//   POST /api/payments/mercado-pago-checkout  -> op=mp-checkout        (Split nativo MP /v1/payments)
//   POST /api/payments/webhook                -> op=webhook            (publico)
//   POST /api/payments/mp-webhook             -> op=webhook            (alias)
//   POST /api/payments/release-funds          -> op=release-funds      (interno)
//
// Modelo de dados (Firestore):
//
// Colecao `especialistas/{id}` (e `apoiadores/{id}` legado):
//   gateway_recipient_id           // alias generico (compat)
//   mercado_pago_collector_id      // ID da conta MP (collector_id) do especialista
//   mercado_pago_access_token      // (opcional) access_token OAuth do especialista
//   plan: 'essencial' | 'premium'
//   precoConsulta                  // valor customizado (apenas Premium)
//
// Colecao `consultas/{id}`:
//   trabalhador_id, especialista_id,
//   modalidade: 'chat' | 'video',
//   valor_total, valor_comissao, valor_repasse,
//   status_pagamento: 'pending'|'approved'|'in_process'|'rejected'|'refunded'|'released'|'failed'|'paga',
//   gateway, gateway_charge_id, gateway_payment_id,
//   sala_video_url, sala_chat_url, custody: { held, released_at },
//   created_at, updated_at

import { getAdminResources } from "./_firebaseAdmin.js";
import {
  computeSplit,
  getMercadoPagoAccessToken,
  verifyWebhookSignature,
  isInternalCallAuthorized,
  buildVideoRoomUrl,
  buildChatRoomUrl,
  resolveConsultaPrice,
  normalizeModalidade,
} from "./_paymentsHelpers.js";

export default async function handler(req, res) {
  // Aceita op via querystring (?op=...) ou via path sufixo /api/payments/<op>.
  const opFromPath = (() => {
    const url = (req.url || "").split("?")[0];
    const m = url.match(/\/api\/payments\/?([\w-]+)?$/);
    return m && m[1] ? m[1] : "";
  })();
  const op = (req.query?.op || opFromPath || "").toString();

  try {
    if (op === "create-charge") return await handleCreateCharge(req, res);
    if (op === "mp-checkout" || op === "mercado-pago-checkout") return await handleMpCheckout(req, res);
    if (op === "webhook" || op === "mp-webhook") return await handleWebhook(req, res);
    if (op === "release-funds") return await handleReleaseFunds(req, res);
    return res.status(404).json({ error: "op invalido. Use create-charge | mp-checkout | webhook | release-funds." });
  } catch (err) {
    console.error(`[payments:${op}] erro:`, err);
    return res.status(500).json({ error: err.message || "Erro interno." });
  }
}

// =========================================================================
// 1) POST create-charge
// =========================================================================
async function handleCreateCharge(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { consulta_id, payment_method = "pix" } = req.body || {};
  if (!consulta_id || typeof consulta_id !== "string") {
    return res.status(400).json({ error: "consulta_id obrigatorio." });
  }

  const { db, FieldValue } = await getAdminResources();

  const consultaRef = db.collection("consultas").doc(consulta_id);
  const consultaSnap = await consultaRef.get();
  if (!consultaSnap.exists) return res.status(404).json({ error: "Consulta nao encontrada." });
  const consulta = consultaSnap.data() || {};
  if (consulta.status_pagamento === "approved") {
    return res.status(409).json({ error: "Consulta ja paga." });
  }

  const especialistaId = consulta.especialista_id;
  if (!especialistaId) return res.status(400).json({ error: "Consulta sem especialista_id." });

  let especialistaSnap = await db.collection("especialistas").doc(especialistaId).get();
  if (!especialistaSnap.exists) {
    especialistaSnap = await db.collection("apoiadores").doc(especialistaId).get();
  }
  if (!especialistaSnap.exists) return res.status(404).json({ error: "Especialista nao encontrado." });
  const especialista = especialistaSnap.data() || {};
  const gatewayRecipientId = (especialista.gateway_recipient_id || "").toString().trim();
  if (!gatewayRecipientId) {
    return res.status(400).json({ error: "Especialista nao possui conta no gateway." });
  }

  // SEGURANCA: valor sempre do banco, nunca do body.
  const { valor_total, valor_comissao, valor_repasse } = computeSplit(consulta.valor_total);

  const gatewayResult = await createMercadoPagoCharge({
    consultaId: consulta_id,
    payerEmail: consulta.trabalhador_email || "",
    amount: valor_total,
    applicationFee: valor_comissao,
    sellerRecipientId: gatewayRecipientId,
    paymentMethod: payment_method,
    description: `Consulta Trabalhei La #${consulta_id}`,
  });

  await consultaRef.update({
    valor_total,
    valor_comissao,
    valor_repasse,
    gateway: "mercadopago",
    gateway_charge_id: gatewayResult.id,
    status_pagamento: "pending",
    custody: { held: true },
    sala_video_url_pending: buildVideoRoomUrl(consulta_id),
    updated_at: FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    ok: true,
    gateway_charge_id: gatewayResult.id,
    payment: gatewayResult.public,
  });
}

// =========================================================================
// 2) POST webhook (publico)
// =========================================================================
async function handleWebhook(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!verifyWebhookSignature(req, "mercadopago")) {
    return res.status(401).json({ error: "Assinatura invalida." });
  }

  const body = req.body || {};
  const type = body.type || body.action || req.query?.type || "";
  const paymentId =
    body?.data?.id || body?.resource || req.query?.id || req.query?.["data.id"];
  if (!paymentId) return res.status(200).json({ ok: true, skipped: "no_payment_id" });

  const payment = await fetchMercadoPagoPayment(paymentId);
  if (!payment) return res.status(200).json({ ok: true, skipped: "payment_not_found" });

  const status = (payment.status || "").toLowerCase();
  const externalReference = payment.external_reference || "";
  const preferenceId = payment.order?.id || payment.preference_id || "";

  const { db, FieldValue } = await getAdminResources();

  let consultaRef = null;
  if (externalReference) {
    const ref = db.collection("consultas").doc(externalReference);
    const snap = await ref.get();
    if (snap.exists) consultaRef = ref;
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
  if (!consultaRef) return res.status(200).json({ ok: true, skipped: "consulta_not_found" });

  const update = {
    gateway_payment_id: String(paymentId),
    status_pagamento: status,
    gateway_status_detail: payment.status_detail || null,
    updated_at: FieldValue.serverTimestamp(),
  };
  if (status === "approved") {
    update.paid_at = FieldValue.serverTimestamp();
    update.custody = { held: true };
    update.status_pagamento = "paga"; // alias semantico solicitado
    const modalidade = (consultaRef && (await consultaRef.get()).data()?.modalidade) || "";
    if (modalidade === "chat") {
      update.sala_chat_url = buildChatRoomUrl(consultaRef.id);
    } else {
      update.sala_video_url = buildVideoRoomUrl(consultaRef.id);
    }
  } else if (status === "refunded" || status === "cancelled") {
    update.custody = { held: false, released_at: null };
  }
  await consultaRef.update(update);

  return res.status(200).json({ ok: true, type, status });
}

// =========================================================================
// 3) POST release-funds (interno)
// =========================================================================
async function handleReleaseFunds(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isInternalCallAuthorized(req)) return res.status(401).json({ error: "Nao autorizado." });

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

  await releaseMercadoPagoPayment(consulta.gateway_payment_id);

  await consultaRef.update({
    status_pagamento: "released",
    custody: { held: false, released_at: FieldValue.serverTimestamp() },
    updated_at: FieldValue.serverTimestamp(),
  });
  return res.status(200).json({ ok: true });
}

// =========================================================================
// 4) POST mp-checkout — Split nativo Mercado Pago (/v1/payments).
// Recebe { consulta_id, modalidade, payment_method?, payer? }.
// - Calcula valor_total a partir do plano do especialista + modalidade.
// - Comissao da plataforma = 10% via application_fee.
// - Liquidacao do restante (90%) para `mercado_pago_collector_id` do especialista.
// =========================================================================
async function handleMpCheckout(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { consulta_id, modalidade, payment_method = "pix", payer } = req.body || {};
  if (!consulta_id || typeof consulta_id !== "string") {
    return res.status(400).json({ error: "consulta_id obrigatorio." });
  }
  const mod = normalizeModalidade(modalidade);

  const { db, FieldValue } = await getAdminResources();

  // 1. Carrega a consulta.
  const consultaRef = db.collection("consultas").doc(consulta_id);
  const consultaSnap = await consultaRef.get();
  if (!consultaSnap.exists) return res.status(404).json({ error: "Consulta nao encontrada." });
  const consulta = consultaSnap.data() || {};
  if (consulta.status_pagamento === "approved" || consulta.status_pagamento === "paga") {
    return res.status(409).json({ error: "Consulta ja paga." });
  }

  // 2. Carrega o especialista (especialistas -> apoiadores fallback).
  const especialistaId = consulta.especialista_id;
  if (!especialistaId) return res.status(400).json({ error: "Consulta sem especialista_id." });
  let especialistaSnap = await db.collection("especialistas").doc(especialistaId).get();
  if (!especialistaSnap.exists) {
    especialistaSnap = await db.collection("apoiadores").doc(especialistaId).get();
  }
  if (!especialistaSnap.exists) return res.status(404).json({ error: "Especialista nao encontrado." });
  const especialista = especialistaSnap.data() || {};

  const collectorId = (
    especialista.mercado_pago_collector_id ||
    especialista.gateway_recipient_id ||
    ""
  ).toString().trim();
  if (!collectorId) {
    return res.status(400).json({
      error: "Especialista nao possui conta Mercado Pago vinculada (mercado_pago_collector_id).",
      code: "MP_COLLECTOR_MISSING",
    });
  }

  // 3. Define valor_total por plano + modalidade (servidor, nao confia no body).
  const valor_total = Number(resolveConsultaPrice(especialista, mod));
  if (!(valor_total > 0)) {
    return res.status(400).json({ error: "Nao foi possivel calcular o valor da consulta." });
  }
  const { valor_comissao, valor_repasse } = computeSplit(valor_total);

  // 4. Cria o pagamento no MP com application_fee = comissao da plataforma.
  let paymentResult;
  try {
    paymentResult = await createMercadoPagoSplitPayment({
      consultaId: consulta_id,
      amount: valor_total,
      applicationFee: valor_comissao,
      collectorId,
      sellerAccessToken: (especialista.mercado_pago_access_token || "").toString().trim(),
      paymentMethod: payment_method,
      description: `Consulta Trabalhei La ${mod.toUpperCase()} #${consulta_id}`,
      payer: payer || { email: consulta.trabalhador_email || "" },
    });
  } catch (err) {
    console.error("[mp-checkout] falha ao criar pagamento MP:", err);
    return res.status(502).json({ error: err.message || "Falha no gateway de pagamento." });
  }

  // 5. Persiste a consulta com dados do pagamento.
  await consultaRef.update({
    modalidade: mod,
    valor_total,
    valor_comissao,
    valor_repasse,
    gateway: "mercadopago",
    gateway_charge_id: String(paymentResult.id),
    gateway_payment_id: String(paymentResult.id),
    mercado_pago_collector_id: collectorId,
    status_pagamento: (paymentResult.status || "pending").toLowerCase(),
    custody: { held: true },
    updated_at: FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    ok: true,
    payment_id: paymentResult.id,
    status: paymentResult.status,
    valor_total,
    valor_comissao,
    valor_repasse,
    pix: paymentResult.pix,
    boleto: paymentResult.boleto,
  });
}

// Cria pagamento no /v1/payments com application_fee (split nativo MP).
// Se o especialista tiver `mercado_pago_access_token` (OAuth) armazenado,
// usa esse token (modelo marketplace tradicional). Caso contrario, usa o
// access_token da plataforma (modo split sponsor, onde a propria aplicacao
// possui o collector_id do vendedor por previa autorizacao).
async function createMercadoPagoSplitPayment({
  consultaId,
  amount,
  applicationFee,
  collectorId,
  sellerAccessToken,
  paymentMethod,
  description,
  payer,
}) {
  const accessToken = sellerAccessToken || getMercadoPagoAccessToken();

  const isPix = paymentMethod === "pix";
  const isBoleto = paymentMethod === "boleto" || paymentMethod === "ticket";

  const body = {
    transaction_amount: Number(amount),
    description,
    external_reference: consultaId,
    notification_url: `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/api/payments/mp-webhook`,
    application_fee: Number(applicationFee), // 10% para a plataforma
    // collector_id informativo no metadata — quando se usa OAuth do seller,
    // o destino dos 90% e implicito (o proprio token do seller). Mantemos
    // a referencia para auditoria.
    metadata: { consulta_id: consultaId, collector_id: collectorId },
    payer: {
      email: payer?.email || undefined,
      first_name: payer?.first_name || undefined,
      last_name: payer?.last_name || undefined,
      identification: payer?.identification || undefined,
    },
  };

  if (isPix) {
    body.payment_method_id = "pix";
  } else if (isBoleto) {
    body.payment_method_id = "bolbradesco";
  } else {
    // Cartao de credito requer token previamente gerado no client (Bricks/JS).
    if (!payer?.token) {
      throw new Error("Para cartao envie payer.token (gerado via SDK MP no client).");
    }
    body.token = payer.token;
    body.installments = Number(payer?.installments || 1);
    body.payment_method_id = payer.payment_method_id; // ex.: 'visa'
    if (payer.issuer_id) body.issuer_id = payer.issuer_id;
  }

  const resp = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `mp-pay-${consultaId}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`MercadoPago /v1/payments ${resp.status}: ${data?.message || JSON.stringify(data)}`);
  }

  return {
    id: data.id,
    status: data.status,
    pix: isPix
      ? {
          qr_code: data?.point_of_interaction?.transaction_data?.qr_code || null,
          qr_code_base64: data?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
          ticket_url: data?.point_of_interaction?.transaction_data?.ticket_url || null,
        }
      : null,
    boleto: isBoleto
      ? {
          barcode: data?.barcode?.content || null,
          ticket_url: data?.transaction_details?.external_resource_url || null,
        }
      : null,
  };
}

// =========================================================================
// Mercado Pago helpers (Split via Marketplace).
// Docs: https://www.mercadopago.com.br/developers/pt/docs/split-payments/landing
// =========================================================================
async function createMercadoPagoCharge({
  consultaId,
  payerEmail,
  amount,
  applicationFee,
  paymentMethod,
  description,
}) {
  const accessToken = getMercadoPagoAccessToken();

  const body = {
    items: [
      { title: description, quantity: 1, unit_price: Number(amount), currency_id: "BRL" },
    ],
    payer: payerEmail ? { email: payerEmail } : undefined,
    external_reference: consultaId,
    marketplace_fee: Number(applicationFee), // 10% retido pela plataforma
    notification_url: `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/api/payments/webhook`,
    payment_methods:
      paymentMethod === "pix"
        ? { excluded_payment_types: [{ id: "ticket" }, { id: "credit_card" }] }
        : paymentMethod === "boleto"
          ? { excluded_payment_types: [{ id: "credit_card" }] }
          : undefined,
  };

  const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `consulta-${consultaId}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`MercadoPago ${resp.status}: ${data?.message || JSON.stringify(data)}`);
  }
  return {
    id: data.id,
    public: {
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      qr_code: data?.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64: data?.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      ticket_url: data?.point_of_interaction?.transaction_data?.ticket_url || null,
    },
  };
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

async function releaseMercadoPagoPayment(paymentId) {
  const token = getMercadoPagoAccessToken();
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
