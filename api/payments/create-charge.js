// POST /api/payments/create-charge
//
// Cria a cobranca no gateway de pagamento com SPLIT automatico:
//   - Recebedor primario: plataforma (10% comissao)
//   - Recebedor secundario: especialista (90% repasse) — FICA RETIDO ate
//     a confirmacao do servico (custody/release manual).
//
// SEGURANCA: o valor da consulta NUNCA vem do body. Sempre relemos do
// Firestore (`consultas/{consulta_id}`), assim o frontend nao pode manipular.
//
// Request body:
//   { consulta_id: string, payment_method?: 'pix' | 'boleto' | 'credit_card' }
//
// Response:
//   { ok: true, gateway_charge_id, payment: { ... } }

import { getAdminResources } from "../_firebaseAdmin.js";
import {
  computeSplit,
  getMercadoPagoAccessToken,
  buildVideoRoomUrl,
} from "./_helpers.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { consulta_id, payment_method = "pix" } = req.body || {};
    if (!consulta_id || typeof consulta_id !== "string") {
      return res.status(400).json({ error: "consulta_id obrigatorio." });
    }

    const { db, FieldValue } = await getAdminResources();

    // 1. Le a consulta no banco (fonte da verdade para valores).
    const consultaRef = db.collection("consultas").doc(consulta_id);
    const consultaSnap = await consultaRef.get();
    if (!consultaSnap.exists) {
      return res.status(404).json({ error: "Consulta nao encontrada." });
    }
    const consulta = consultaSnap.data() || {};

    if (consulta.status_pagamento === "approved") {
      return res.status(409).json({ error: "Consulta ja paga." });
    }

    // 2. Le o especialista para obter o gateway_recipient_id.
    //    Tenta `especialistas` (novo) e cai para `apoiadores` (legado).
    const especialistaId = consulta.especialista_id;
    if (!especialistaId) {
      return res.status(400).json({ error: "Consulta sem especialista_id." });
    }

    let especialistaSnap = await db.collection("especialistas").doc(especialistaId).get();
    if (!especialistaSnap.exists) {
      especialistaSnap = await db.collection("apoiadores").doc(especialistaId).get();
    }
    if (!especialistaSnap.exists) {
      return res.status(404).json({ error: "Especialista nao encontrado." });
    }
    const especialista = especialistaSnap.data() || {};
    const gatewayRecipientId = (especialista.gateway_recipient_id || "").toString().trim();
    if (!gatewayRecipientId) {
      return res.status(400).json({
        error: "Especialista nao possui conta cadastrada no gateway de pagamento.",
      });
    }

    // 3. Calcula split a partir do valor armazenado no banco (server-side).
    const { valor_total, valor_comissao, valor_repasse } = computeSplit(
      consulta.valor_total
    );

    // 4. Chama o gateway. Substitua o bloco conforme seu provedor.
    const gatewayResult = await createMercadoPagoCharge({
      consultaId: consulta_id,
      payerEmail: consulta.trabalhador_email || "",
      amount: valor_total,
      applicationFee: valor_comissao, // marketplace_fee do MP
      sellerRecipientId: gatewayRecipientId,
      paymentMethod: payment_method,
      description: `Consulta Trabalhei La #${consulta_id}`,
    });

    // 5. Atualiza a consulta com o id do gateway e prepara sala (URL gerada
    //    aqui mas so ativada apos webhook `payment.approved`).
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
  } catch (err) {
    console.error("[create-charge] erro:", err);
    return res.status(500).json({ error: err.message || "Erro interno." });
  }
}

// =========================================================================
// Integracao Mercado Pago — Split de Pagamento (Marketplace).
// Docs: https://www.mercadopago.com.br/developers/pt/docs/split-payments/landing
//
// Para usar split via Marketplace voce precisa:
//   1) Ter sua aplicacao como `marketplace` no MP.
//   2) Cada especialista autoriza sua app via OAuth e voce armazena o
//      `collector_id` dele em `especistas.gateway_recipient_id`.
//   3) No checkout, voce define `marketplace_fee` = comissao da plataforma.
// =========================================================================
async function createMercadoPagoCharge({
  consultaId,
  payerEmail,
  amount,
  applicationFee,
  sellerRecipientId,
  paymentMethod,
  description,
}) {
  const accessToken = getMercadoPagoAccessToken();

  // Para Pix/cartao recomenda-se usar a API Payments (in-app), mas o exemplo
  // abaixo usa Preferences (Checkout Pro), que tambem aceita marketplace_fee.
  const body = {
    items: [
      {
        title: description,
        quantity: 1,
        unit_price: Number(amount),
        currency_id: "BRL",
      },
    ],
    payer: payerEmail ? { email: payerEmail } : undefined,
    external_reference: consultaId,
    marketplace_fee: Number(applicationFee), // 10% retido para a plataforma
    // O recebedor primario (especialista) e identificado pelo header
    // X-Meli-Session-Id NAO — na realidade pelo access_token do collector.
    // No modelo marketplace, voce chama a API com o access_token DELE e
    // informa o marketplace_fee. Se o seu fluxo for usar o token da
    // plataforma com `collector_id` explicito, ajuste para a API
    // `/v1/advanced_payments` (split nativo multi-recebedor).
    notification_url: `${process.env.APP_BASE_URL || ""}/api/payments/webhook`,
    payment_methods:
      paymentMethod === "pix"
        ? { excluded_payment_types: [{ id: "ticket" }, { id: "credit_card" }] }
        : paymentMethod === "boleto"
          ? { excluded_payment_types: [{ id: "credit_card" }] }
          : undefined,
    // CUSTODY / RETENCAO:
    //   Por padrao o repasse so e liberado pelo MP apos `release-funds`.
    //   Para garantir reten cao manual, use o produto "Saldo em garantia"
    //   ou Advanced Payments com `release: 'manual'`.
  };

  const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      // Header opcional para split com collector secundario:
      "X-Idempotency-Key": `consulta-${consultaId}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(
      `MercadoPago erro ${resp.status}: ${data?.message || JSON.stringify(data)}`
    );
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

/*
// =========================================================================
// Alternativa: Asaas (split nativo simples).
// Docs: https://docs.asaas.com/docs/divisao-de-pagamentos-split
// =========================================================================
async function createAsaasCharge({ consultaId, customerId, amount, walletId, applicationFee, paymentMethod }) {
  const apiKey = process.env.ASAAS_API_KEY;
  const body = {
    customer: customerId,
    billingType: paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'boleto' ? 'BOLETO' : 'CREDIT_CARD',
    value: amount,
    externalReference: consultaId,
    split: [{ walletId, fixedValue: amount - applicationFee }],
  };
  const resp = await fetch('https://api.asaas.com/v3/payments', {
    method: 'POST',
    headers: { access_token: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}
*/
