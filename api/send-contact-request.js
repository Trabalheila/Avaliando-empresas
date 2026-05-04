// api/send-contact-request.js
//
// Notifica por e-mail um trabalhador que recebeu um pedido de contato
// de um Apoiador Premium. Esse endpoint é "best effort": o pedido já
// foi salvo em Firestore (coleção `contactRequests`) pelo cliente. Se
// as variáveis de ambiente de e-mail não estiverem presentes, o
// endpoint retorna 200 com `emailed: false`.
//
// O endpoint NUNCA expõe o e-mail real do trabalhador no response —
// apenas aciona o envio do e-mail. A resposta voltará para o
// Apoiador APENAS se o trabalhador clicar em "Responder" e marcar
// "Autorizar revelar e-mail" em /my-contacts.
//
// Variáveis de ambiente (todas opcionais, mas recomendadas):
//   RESEND_API_KEY        chave da Resend
//   EMAIL_FROM_ADDRESS    remetente verificado
//   APP_BASE_URL          base URL pública do app
//   FIREBASE_*            (não obrigatório aqui — buscamos email
//                          via Admin SDK opcional)

import { Resend } from "resend";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function tryResolveWorkerEmail(toUid) {
  // Tenta usar firebase-admin se configurado. Caso não esteja, retorna null
  // e o e-mail simplesmente não é enviado.
  try {
    const projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(
      /\\n/g,
      "\n"
    );
    if (!projectId || !clientEmail || !privateKey) return null;

    const admin = await import("firebase-admin");
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    const userSnap = await admin.firestore().doc(`users/${toUid}`).get();
    if (!userSnap.exists) return null;
    return String(userSnap.data()?.email || "").trim().toLowerCase() || null;
  } catch (err) {
    console.warn("[send-contact-request] resolveWorkerEmail falhou:", err?.message || err);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const body = req.body || {};
  const toUid = String(body.toUid || "").trim();
  const fromCompanyName = String(body.fromCompanyName || "").trim();
  const toPseudonym = String(body.toPseudonym || "").trim();
  const message = String(body.message || "").trim();
  const requestId = String(body.requestId || "").trim();

  if (!toUid || !message) {
    return res.status(400).json({ ok: false, error: "Parâmetros obrigatórios ausentes." });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

  if (!resendKey || !fromAddress) {
    return res.status(200).json({ ok: true, emailed: false, reason: "email_disabled" });
  }

  const workerEmail = await tryResolveWorkerEmail(toUid);
  if (!workerEmail) {
    return res.status(200).json({ ok: true, emailed: false, reason: "email_unknown" });
  }

  const subject = `Você recebeu um pedido de contato no Trabalhei Lá`;
  const link = `${appBaseUrl || ""}/my-contacts`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#7e22ce;">Novo pedido de contato</h2>
      <p>${toPseudonym ? `Olá, ${escapeHtml(toPseudonym)}!` : "Olá!"}</p>
      <p>Uma empresa Apoiadora Premium${
        fromCompanyName ? ` (${escapeHtml(fromCompanyName)})` : ""
      } enviou um pedido de contato com base no seu Índice de Credibilidade
      e nas avaliações que você publicou no Trabalhei Lá.</p>
      <blockquote style="border-left:4px solid #c4b5fd;padding:8px 12px;background:#f5f3ff;color:#312e81;">
        ${escapeHtml(message).replace(/\n/g, "<br>")}
      </blockquote>
      <p>Sua identidade real <strong>permanece privada</strong>. Acesse a área
      "Meus Contatos" para responder ou recusar:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${link}"
           style="background:#7e22ce;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Ver pedido de contato
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">
        ID: ${escapeHtml(requestId)}. Você está recebendo este e-mail porque
        ativou a opção "Disponível para Contato" no seu perfil. É possível
        desativar a qualquer momento.
      </p>
    </div>
  `;
  const text = [
    "Novo pedido de contato no Trabalhei Lá",
    "",
    fromCompanyName
      ? `Empresa: ${fromCompanyName}`
      : "Empresa Apoiadora Premium",
    "",
    "Mensagem:",
    message,
    "",
    `Acesse para responder: ${link}`,
  ].join("\n");

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: workerEmail,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[send-contact-request] Resend erro:", error);
      return res.status(200).json({ ok: true, emailed: false, reason: "send_failed" });
    }
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error("[send-contact-request] erro inesperado:", err?.message || err);
    return res.status(200).json({ ok: true, emailed: false, reason: "exception" });
  }
}
