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

import crypto from "crypto";

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

// Gera URL da sala de chat. Use sua rota interna que valida a consulta paga.
export function buildChatRoomUrl(consultaId) {
  const base = (process.env.CHAT_ROOM_BASE_URL || `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/consulta-chat`).replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(consultaId)}`;
}

// Tabela de precos por plano + modalidade. Premium usa o valor customizado
// salvo em `precoConsulta` no perfil do especialista.
export const CONSULTA_PRICE_TABLE = {
  essencial: { chat: 45, video: 75 },
};
export const PREMIUM_DEFAULT_PRICE = 150;

export function normalizePlan(v) {
  const s = String(v || "").toLowerCase().trim();
  if (!s) return "";
  if (s.includes("premium")) return "premium";
  if (s.includes("essencial") || s.includes("essential") || s === "free" || s === "gratuito" || s.includes("basic")) {
    return "essencial";
  }
  return s;
}

export function normalizeModalidade(v) {
  const s = String(v || "").toLowerCase().trim();
  return s === "video" || s === "videochamada" || s === "videocall" ? "video" : "chat";
}

// Calcula valor_total a partir do plano do especialista + modalidade.
export function resolveConsultaPrice(especialista, modalidade) {
  const plan = normalizePlan(especialista?.plan || especialista?.plano || especialista?.planStatus);
  const mod = normalizeModalidade(modalidade);
  if (plan === "essencial") {
    return CONSULTA_PRICE_TABLE.essencial[mod];
  }
  // Premium (default): valor customizado do especialista.
  const custom = Number(especialista?.precoConsulta || especialista?.preco || 0);
  return custom > 0 ? custom : PREMIUM_DEFAULT_PRICE;
}

// Verificacao de assinatura HMAC do webhook (compartilhada).
// Mercado Pago: header `x-signature` (ts,v1). Asaas: header `asaas-access-token`.
// Adapte conforme o gateway escolhido.
export function verifyWebhookSignature(req, gateway = "mercadopago") {
  if (gateway === "mercadopago") {
    const secret = (
      process.env.MERCADOPAGO_WEBHOOK_SECRET ||
      process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
      ""
    ).trim();
    // Em desenvolvimento, permite sem secret para facilitar testes locais.
    if (!secret) return process.env.NODE_ENV !== "production";

    const signature = (req.headers["x-signature"] || "").toString();
    if (!signature) return false;

    // Header `x-signature` do MP tem o formato "ts=TIMESTAMP,v1=HASH".
    let ts = "";
    let v1 = "";
    for (const part of signature.split(",")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (key === "ts") ts = value;
      else if (key === "v1") v1 = value;
    }
    if (!ts || !v1) return false;

    const requestId = (req.headers["x-request-id"] || "").toString();
    // id do recurso notificado (data.id). Conforme docs do MP, quando
    // alfanumerico deve entrar no manifesto em minusculas.
    const dataId = (req.query?.["data.id"] || req.query?.id || "")
      .toString()
      .toLowerCase();

    // Manifesto oficial do MP: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
    // Campos ausentes sao omitidos (o MP nao os inclui quando vazios).
    let manifest = "";
    if (dataId) manifest += `id:${dataId};`;
    if (requestId) manifest += `request-id:${requestId};`;
    manifest += `ts:${ts};`;

    const computed = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    // Comparacao em tempo constante para evitar timing attacks.
    try {
      const a = Buffer.from(computed, "hex");
      const b = Buffer.from(v1, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
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
