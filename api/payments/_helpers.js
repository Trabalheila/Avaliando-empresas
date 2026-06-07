// Helpers compartilhados das rotas /api/payments/*
//
// Modelo de dados (Firestore):
//
// Colecao `especialistas/{id}` (ou `apoiadores/{id}` legado) — adicione:
//   gateway_recipient_id: string  // ID da conta digital do especialista no
//                                 // provedor (MP: collector_id; Asaas: walletId)
//
// Colecao `consultas/{id}` — documentos com:
//   id                   (auto)
//   trabalhador_id       string  (uid do comprador)
//   especialista_id      string  (id do doc do especialista)
//   valor_total          number  (BRL, calculado no servidor)
//   valor_comissao       number  (10% do total — plataforma)
//   valor_repasse        number  (90% do total — especialista)
//   status_pagamento     'pending' | 'approved' | 'in_process' | 'rejected' | 'refunded' | 'released' | 'failed'
//   gateway              'mercadopago' | 'asaas' | 'stripe'
//   gateway_charge_id    string  (id da preference/payment/charge)
//   gateway_payment_id   string? (id do pagamento aprovado, quando aplicavel)
//   sala_video_url       string? (ativada apos status=approved)
//   custody              { held: boolean, released_at?: Timestamp }
//   created_at           Timestamp
//   updated_at           Timestamp

export const PLATFORM_COMMISSION_PCT = 0.1; // 10% comissao da plataforma

export function computeSplit(valorTotal) {
  const total = Number(valorTotal) || 0;
  if (total <= 0) {
    throw new Error("valor_total invalido.");
  }
  const valor_comissao = Math.round(total * PLATFORM_COMMISSION_PCT * 100) / 100;
  const valor_repasse = Math.round((total - valor_comissao) * 100) / 100;
  return { valor_total: total, valor_comissao, valor_repasse };
}

export function getMercadoPagoAccessToken() {
  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").toString().trim();
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
  }
  return token;
}

export function getAsaasApiKey() {
  const key = (process.env.ASAAS_API_KEY || "").toString().trim();
  if (!key) {
    throw new Error("ASAAS_API_KEY nao configurado.");
  }
  return key;
}

// Gera URL unica de sala de video (ativada apenas apos pagamento aprovado).
// Substitua pela sua integracao real (Daily.co, Jitsi, 100ms, Twilio etc.).
export function buildVideoRoomUrl(consultaId) {
  const base = (process.env.VIDEO_ROOM_BASE_URL || "https://meet.jit.si/trabalheila").replace(/\/+$/, "");
  // Token simples derivado do id da consulta. Em producao, gere um JWT curto
  // assinado pelo provedor de video para evitar acesso direto via guess de URL.
  return `${base}-${consultaId}`;
}

// Verificacao de assinatura HMAC do webhook (compartilhada).
// Mercado Pago: header `x-signature` (ts,v1). Asaas: header `asaas-access-token`.
// Adapte conforme o gateway escolhido.
export function verifyWebhookSignature(req, gateway = "mercadopago") {
  if (gateway === "mercadopago") {
    const secret = (process.env.MERCADO_PAGO_WEBHOOK_SECRET || "").trim();
    // Em desenvolvimento, permite sem secret para facilitar testes locais.
    if (!secret) return process.env.NODE_ENV !== "production";

    const signature = (req.headers["x-signature"] || "").toString();
    if (!signature) return false;
    // TODO: implementar validacao HMAC SHA-256 conforme docs MP:
    // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
    return true;
  }
  if (gateway === "asaas") {
    const expected = (process.env.ASAAS_WEBHOOK_TOKEN || "").trim();
    const received = (req.headers["asaas-access-token"] || "").toString().trim();
    return Boolean(expected) && expected === received;
  }
  return true;
}

// Autorizacao para rotas internas (release-funds, retries admin).
export function isInternalCallAuthorized(req) {
  const token = (process.env.INTERNAL_API_TOKEN || "").trim();
  if (!token) return false;
  const header = (req.headers["authorization"] || "").toString();
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return bearer === token;
}
