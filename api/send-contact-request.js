// api/send-contact-request.js
//
// Endpoint unificado de notificação de pedido de contato.
// - body.type === "apoiador" → notifica um Apoiador Premium (coleção `apoiadores`)
// - caso contrário          → notifica um trabalhador (coleção `users`)
//
// Best-effort: se RESEND_API_KEY/EMAIL_FROM_ADDRESS/Admin SDK não estão
// configurados, retorna 200 com `emailed: false`. O e-mail real nunca
// é exposto no response — só é usado para enviar a notificação.
//
// Variáveis de ambiente (todas opcionais, mas recomendadas):
//   RESEND_API_KEY        chave da Resend
//   EMAIL_FROM_ADDRESS    remetente verificado
//   APP_BASE_URL          base URL pública do app
//   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

import { Resend } from "resend";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Normaliza um array de evidências [{url,name,type,size}] removendo entradas
// inválidas e limitando a 10 itens para evitar e-mails enormes.
function sanitizeEvidence(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item) continue;
    const url = String(item.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      url,
      name: String(item.name || "arquivo").slice(0, 160),
      type: String(item.type || ""),
      size: Number(item.size) || 0,
    });
    if (out.length >= 10) break;
  }
  return out;
}

function evidenceHtmlBlock(evidence, accentColor) {
  if (!evidence.length) return "";
  const items = evidence
    .map((f) => {
      const isVideo = (f.type || "").startsWith("video/");
      const icon = isVideo ? "🎬" : "🖼️";
      const sizeMb = f.size ? ` (${(f.size / (1024 * 1024)).toFixed(2)} MB)` : "";
      return `<li style="margin:4px 0;"><a href="${escapeHtml(f.url)}" style="color:${accentColor};word-break:break-all;">${icon} ${escapeHtml(f.name)}</a><span style="color:#64748b;font-size:12px;">${escapeHtml(sizeMb)}</span></li>`;
    })
    .join("");
  return `
      <h3 style="margin-top:20px;margin-bottom:6px;color:${accentColor};font-size:15px;">
        Provas e Evidências anexadas (${evidence.length})
      </h3>
      <p style="font-size:12px;color:#475569;margin:0 0 6px;">
        Os links abaixo apontam para arquivos no Firebase Storage do Trabalhei Lá.
        Trate o material como confidencial.
      </p>
      <ul style="padding-left:18px;margin:0;">${items}</ul>
  `;
}

function evidenceTextBlock(evidence) {
  if (!evidence.length) return "";
  const lines = evidence.map(
    (f) => `- ${f.name}${f.size ? ` (${(f.size / (1024 * 1024)).toFixed(2)} MB)` : ""}: ${f.url}`
  );
  return ["", `Provas e Evidências anexadas (${evidence.length}):`, ...lines].join("\n");
}

async function tryResolveEmail(collectionName, docId, tag) {
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
    const snap = await admin.firestore().doc(`${collectionName}/${docId}`).get();
    if (!snap.exists) return null;
    return String(snap.data()?.email || "").trim().toLowerCase() || null;
  } catch (err) {
    console.warn(`[${tag}] resolveEmail falhou:`, err?.message || err);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const body = req.body || {};
  const type = String(body.type || "worker").toLowerCase();
  const fromCompanyName = String(body.fromCompanyName || "").trim();
  const message = String(body.message || "").trim();
  const requestId = String(body.requestId || "").trim();
  const evidence = sanitizeEvidence(body.evidenceFiles);

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const appBaseUrl = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");

  // ── Fluxo Apoiador ────────────────────────────────────────────────
  if (type === "apoiador") {
    const tag = "send-contact-request:apoiador";
    const toApoiadorId = String(body.toApoiadorId || "").trim();
    const toApoiadorName = String(body.toApoiadorName || "").trim();

    if (!toApoiadorId || !message) {
      return res
        .status(400)
        .json({ ok: false, error: "Parâmetros obrigatórios ausentes." });
    }
    if (!resendKey || !fromAddress) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_disabled" });
    }

    const apoiadorEmail = await tryResolveEmail(
      "apoiadores",
      toApoiadorId,
      tag
    );
    if (!apoiadorEmail) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_unknown" });
    }

    const subject =
      "Você recebeu um pedido de contato de uma empresa no Trabalhei Lá";
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
      ${evidenceHtmlBlock(evidence, "#0f766e")}
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
      evidenceTextBlock(evidence),
      "",
      `Acesse para responder: ${link}`,
    ].filter(Boolean).join("\n");

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
        console.error(`[${tag}] Resend erro:`, error);
        return res
          .status(200)
          .json({ ok: true, emailed: false, reason: "send_failed" });
      }
      return res.status(200).json({ ok: true, emailed: true });
    } catch (err) {
      console.error(`[${tag}] erro inesperado:`, err?.message || err);
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "exception" });
    }
  }

  // ── Fluxo Trabalhador (default) ───────────────────────────────────
  const tag = "send-contact-request:worker";
  const toUid = String(body.toUid || "").trim();
  const toPseudonym = String(body.toPseudonym || "").trim();

  if (!toUid || !message) {
    return res
      .status(400)
      .json({ ok: false, error: "Parâmetros obrigatórios ausentes." });
  }
  if (!resendKey || !fromAddress) {
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "email_disabled" });
  }

  const workerEmail = await tryResolveEmail("users", toUid, tag);
  if (!workerEmail) {
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "email_unknown" });
  }

  const subject = "Você recebeu um pedido de contato no Trabalhei Lá";
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
      ${evidenceHtmlBlock(evidence, "#7e22ce")}
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
    fromCompanyName ? `Empresa: ${fromCompanyName}` : "Empresa Apoiadora Premium",
    "",
    "Mensagem:",
    message,
    evidenceTextBlock(evidence),
    "",
    `Acesse para responder: ${link}`,
  ].filter(Boolean).join("\n");

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
      console.error(`[${tag}] Resend erro:`, error);
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "send_failed" });
    }
    return res.status(200).json({ ok: true, emailed: true });
  } catch (err) {
    console.error(`[${tag}] erro inesperado:`, err?.message || err);
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "exception" });
  }
}
