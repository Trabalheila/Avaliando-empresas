// api/send-contact-request-apoiador.js
//
// Notifica por e-mail um Apoiador Premium que recebeu um pedido de
// contato de uma empresa Premium. Esse endpoint é "best effort": o
// pedido já foi salvo em Firestore (coleção `contactRequestsApoiador`)
// pelo cliente. Se as variáveis de ambiente de e-mail não estiverem
// presentes, retorna 200 com `emailed: false`.
//
// O endpoint NUNCA expõe o e-mail real do apoiador no response —
// apenas aciona o envio do e-mail. A resposta voltará para a empresa
// APENAS se o apoiador clicar em "Responder" e marcar
// "Autorizar revelar e-mail" em /apoiador/my-contacts.

import { Resend } from "resend";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function tryResolveApoiadorEmail(toApoiadorId) {
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
    const snap = await admin.firestore().doc(`apoiadores/${toApoiadorId}`).get();
    if (!snap.exists) return null;
    return String(snap.data()?.email || "").trim().toLowerCase() || null;
  } catch (err) {
    console.warn(
      "[send-contact-request-apoiador] resolveApoiadorEmail falhou:",
      err?.message || err
    );
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const body = req.body || {};
  const toApoiadorId = String(body.toApoiadorId || "").trim();
  const toApoiadorName = String(body.toApoiadorName || "").trim();
  const fromCompanyName = String(body.fromCompanyName || "").trim();
  const message = String(body.message || "").trim();
  const requestId = String(body.requestId || "").trim();

  if (!toApoiadorId || !message) {
    return res
      .status(400)
      .json({ ok: false, error: "Parâmetros obrigatórios ausentes." });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

  if (!resendKey || !fromAddress) {
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "email_disabled" });
  }

  const apoiadorEmail = await tryResolveApoiadorEmail(toApoiadorId);
  if (!apoiadorEmail) {
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "email_unknown" });
  }

  const subject = `Você recebeu um pedido de contato de uma empresa no Trabalhei Lá`;
  const link = `${appBaseUrl || ""}/apoiador/my-contacts`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#0f766e;">Novo pedido de contato de uma empresa</h2>
      <p>${toApoiadorName ? `Olá, ${escapeHtml(toApoiadorName)}!` : "Olá!"}</p>
      <p>Uma empresa Premium${
        fromCompanyName ? ` (${escapeHtml(fromCompanyName)})` : ""
      } enviou um pedido de contato para consultoria/apoio especializado.</p>
      <blockquote style="border-left:4px solid #5eead4;padding:8px 12px;background:#f0fdfa;color:#134e4a;">
        ${escapeHtml(message).replace(/\n/g, "<br>")}
      </blockquote>
      <p>Sua identidade e e-mail <strong>permanecem privados</strong>. Acesse a
      área "Meus Contatos" para responder ou recusar:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${link}"
           style="background:#0f766e;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Ver pedido de contato
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">
        ID: ${escapeHtml(requestId)}. Você está recebendo este e-mail porque é
        um Apoiador Premium ativo no Trabalhei Lá.
      </p>
    </div>
  `;
  const text = [
    "Novo pedido de contato de uma empresa no Trabalhei Lá",
    "",
    fromCompanyName ? `Empresa: ${fromCompanyName}` : "Empresa Premium",
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
      to: apoiadorEmail,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[send-contact-request-apoiador] Resend erro:", error);
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "send_failed" });
    }
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error(
      "[send-contact-request-apoiador] erro inesperado:",
      err?.message || err
    );
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "exception" });
  }
}
