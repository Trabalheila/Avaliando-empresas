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
//   FIREBASE_SERVICE_ACCOUNT  JSON completo da Service Account

import { Resend } from "resend";
import { handleSendReceipt } from "./_sendReceipt.js";
import { getServiceAccount } from "./_firebaseAdmin.js";
import { notifySpecialistWhatsApp } from "./_whatsapp.js";

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
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) return null;

    const admin = await import("firebase-admin");
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
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

// Resolve, no SERVIDOR, o WhatsApp/telefone cadastrado de um especialista
// (coleção `apoiadores`). Retorna a string do número ou null. Usado para
// disparar a notificação de novo contato pelo WhatsApp Cloud API.
async function tryResolveApoiadorWhatsApp(docId, tag) {
  try {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) return null;

    const admin = await import("firebase-admin");
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    const snap = await admin.firestore().doc(`apoiadores/${docId}`).get();
    if (!snap.exists) return null;
    const d = snap.data() || {};
    return String(d.whatsapp || d.telefone || "").trim() || null;
  } catch (err) {
    console.warn(`[${tag}] resolveWhatsApp falhou:`, err?.message || err);
    return null;
  }
}

// Resolve, no SERVIDOR, o autor de uma avaliação a partir do `reviewId`.
// Fluxo: reviews/{reviewId} (coleção pública) → uid do autor → users/{uid}.email.
// Isso garante que apenas o autor REAL daquela avaliação possa ser notificado
// por e-mail e que o endereço nunca precise trafegar pelo cliente.
// Retorna { email, pseudonym } — email é null para autores anônimos/sem conta.
async function resolveReviewAuthor(reviewId, tag) {
  try {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) return { email: null, pseudonym: "" };

    const admin = await import("firebase-admin");
    if (!admin.apps?.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    const reviewSnap = await admin.firestore().doc(`reviews/${reviewId}`).get();
    if (!reviewSnap.exists) return { email: null, pseudonym: "" };

    const review = reviewSnap.data() || {};
    const uid = String(review.uid || "").trim();
    const pseudonym = String(review.pseudonym || "").trim();
    if (!uid) return { email: null, pseudonym };

    const userSnap = await admin.firestore().doc(`users/${uid}`).get();
    const email = userSnap.exists
      ? String(userSnap.data()?.email || "").trim().toLowerCase()
      : "";
    return { email: email || null, pseudonym };
  } catch (err) {
    console.warn(`[${tag}] resolveReviewAuthor falhou:`, err?.message || err);
    return { email: null, pseudonym: "" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Rota consolidada: /api/send-receipt → /api/send-contact-request?op=receipt
  // (mantém a contagem de Serverless Functions dentro do limite da Vercel).
  if (String(req.query?.op || "").toLowerCase() === "receipt") {
    return handleSendReceipt(req, res);
  }

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

  // ── Fluxo Atividade (reação/resposta em avaliação) ────────────────
  // Notifica por e-mail o AUTOR de uma avaliação quando seu comentário recebe
  // uma reação ou resposta. Disparado logo após a criação da notificação
  // in-app (ver src/services/notifications.js). O e-mail é resolvido no
  // servidor a partir do `reviewId`, de modo que o endereço nunca trafega pelo
  // cliente e apenas o autor real daquela avaliação pode ser notificado.
  if (type === "activity") {
    const tag = "send-contact-request:activity";
    const reviewId = String(body.reviewId || "").trim();
    const activityType =
      String(body.activityType || "").toLowerCase() === "reply"
        ? "reply"
        : "reaction";
    const companyName = String(body.companyName || "").trim();
    const itemLabel = String(body.itemLabel || "").trim();

    // Só aceita caminho relativo do próprio app no link (previne open redirect).
    const rawLink = String(body.link || "").trim();
    const safePath = rawLink.startsWith("/") ? rawLink : "/";
    const link = `${appBaseUrl || ""}${safePath}`;

    if (!reviewId) {
      return res.status(400).json({ ok: false, error: "reviewId obrigatório." });
    }
    if (!resendKey || !fromAddress) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_disabled" });
    }

    const { email: authorEmail, pseudonym } = await resolveReviewAuthor(
      reviewId,
      tag
    );
    // Autor anônimo (sem conta/e-mail) ou não encontrado: ignora silenciosamente.
    if (!authorEmail) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_unknown" });
    }

    const activityWord = activityType === "reply" ? "resposta" : "reação";
    const subject = "Nova atividade em seu comentário no Trabalhei Lá";
    const greeting = pseudonym ? `Olá, ${escapeHtml(pseudonym)}!` : "Olá!";
    const criterionPart = itemLabel
      ? ` sobre <strong>${escapeHtml(itemLabel)}</strong>`
      : "";
    const companyPart = companyName
      ? ` na empresa <strong>${escapeHtml(companyName)}</strong>`
      : "";
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1d4ed8;">Nova atividade no seu comentário</h2>
      <p>${greeting}</p>
      <p>Seu comentário${criterionPart}${companyPart} recebeu uma nova
      <strong>${activityWord}</strong> no Trabalhei Lá.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${link}"
           style="background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Ver comentário
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">
        Você está recebendo este e-mail porque publicou uma avaliação no
        Trabalhei Lá. Sua identidade permanece anônima para os demais usuários.
      </p>
    </div>
  `;
    const text = [
      "Nova atividade no seu comentário no Trabalhei Lá",
      "",
      `${pseudonym ? `Olá, ${pseudonym}!` : "Olá!"}`,
      "",
      `Seu comentário${itemLabel ? ` sobre ${itemLabel}` : ""}${
        companyName ? ` na empresa ${companyName}` : ""
      } recebeu uma nova ${activityWord}.`,
      "",
      `Acesse para ver: ${link}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: authorEmail,
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

  // ── Fluxo Ad Exitum ───────────────────────────────────────────────
  // Notifica o especialista (coleção `apoiadores`) de que um trabalhador
  // iniciou um pedido Ad Exitum. O e-mail é enviado para o endereço
  // cadastrado em "Gerenciar perfil" (campo `email` do doc apoiadores).
  if (type === "adexitum") {
    const tag = "send-contact-request:adExitum";
    const toApoiadorId = String(body.toApoiadorId || "").trim();
    const toApoiadorName = String(body.toApoiadorName || "").trim();
    const conversationId = String(body.conversationId || "").trim();

    if (!toApoiadorId) {
      return res
        .status(400)
        .json({ ok: false, error: "toApoiadorId obrigatório." });
    }

    // Notificação por WhatsApp (best-effort, independe da config de e-mail).
    try {
      const wa = await tryResolveApoiadorWhatsApp(toApoiadorId, tag);
      if (wa) {
        await notifySpecialistWhatsApp({
          to: wa,
          specialistName: toApoiadorName,
          fromName: fromCompanyName || "Um trabalhador",
          messageSnippet: message,
          urlSuffix: requestId,
        });
      }
    } catch (err) {
      console.warn(`[${tag}] WhatsApp falhou:`, err?.message || err);
    }

    if (!resendKey || !fromAddress) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_disabled" });
    }

    // Prioriza o e-mail cadastrado no perfil (resolvido no servidor);
    // cai no e-mail enviado pelo cliente apenas como último recurso.
    const apoiadorEmail =
      (await tryResolveEmail("apoiadores", toApoiadorId, tag)) ||
      String(body.toEmail || "").trim().toLowerCase() ||
      null;
    if (!apoiadorEmail) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_unknown" });
    }

    const subject = "Novo pedido Ad Exitum no Trabalhei Lá";
    const link = `${appBaseUrl || ""}/apoiador/my-contacts`;
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1d4ed8;">Novo pedido Ad Exitum</h2>
      <p>${toApoiadorName ? `Olá, ${escapeHtml(toApoiadorName)}!` : "Olá!"}</p>
      <p>O trabalhador${
        fromCompanyName ? ` <strong>${escapeHtml(fromCompanyName)}</strong>` : ""
      } iniciou um pedido <strong>Ad Exitum</strong> e deseja iniciar um
      atendimento com você.</p>
      <blockquote style="border-left:4px solid #93c5fd;padding:8px 12px;background:#eff6ff;color:#1e3a8a;">
        ${escapeHtml(message).replace(/\n/g, "<br>")}
      </blockquote>
      <p>A troca de documentos no chat só é liberada após você <strong>aceitar</strong>
      o contato. Acesse a área "Meus Contatos" para aceitar ou recusar:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${link}"
           style="background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Ver pedido Ad Exitum
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">
        ID: ${escapeHtml(requestId)}${
          conversationId ? ` · Conversa: ${escapeHtml(conversationId)}` : ""
        }. Você está recebendo este e-mail porque é um especialista cadastrado
        no Trabalhei Lá.
      </p>
    </div>
  `;
    const text = [
      "Novo pedido Ad Exitum no Trabalhei Lá",
      "",
      fromCompanyName ? `Trabalhador: ${fromCompanyName}` : "Um trabalhador",
      "",
      "Mensagem:",
      message,
      "",
      `Acesse para aceitar ou recusar: ${link}`,
    ]
      .filter(Boolean)
      .join("\n");

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

  // ── Fluxo Iniciar Conversa ───────────────────────────────────────
  // Notifica o especialista (coleção `apoiadores`) de que um trabalhador
  // iniciou uma conversa pelo chat — usado quando o valor da consulta está
  // indefinido ("Valor a combinar"). Envia e-mail (Resend) para o endereço
  // cadastrado e, se houver telefone/WhatsApp, dispara a notificação por
  // WhatsApp Cloud API. Best-effort: nunca bloqueia o fluxo do chat.
  if (type === "iniciar-conversa") {
    const tag = "send-contact-request:iniciarConversa";
    const toApoiadorId = String(body.toApoiadorId || "").trim();
    const toApoiadorName = String(body.toApoiadorName || "").trim();
    const conversationId = String(body.conversationId || "").trim();

    if (!toApoiadorId) {
      return res
        .status(400)
        .json({ ok: false, error: "toApoiadorId obrigatório." });
    }

    // Notificação por telefone/WhatsApp (best-effort, independe do e-mail).
    // Reutiliza o serviço WhatsApp Cloud API já configurado no projeto.
    // Placeholder para SMS: caso deseje adicionar um provedor de SMS (ex.:
    // Twilio) como fallback quando o WhatsApp não estiver configurado,
    // implemente aqui usando o telefone resolvido em `tryResolveApoiadorWhatsApp`.
    try {
      const wa = await tryResolveApoiadorWhatsApp(toApoiadorId, tag);
      if (wa) {
        await notifySpecialistWhatsApp({
          to: wa,
          specialistName: toApoiadorName,
          fromName: fromCompanyName || "Um trabalhador",
          messageSnippet: message,
          urlSuffix: requestId,
        });
      }
      // else: sem telefone/WhatsApp cadastrado — nada a enviar por telefone.
    } catch (err) {
      console.warn(`[${tag}] WhatsApp falhou:`, err?.message || err);
    }

    if (!resendKey || !fromAddress) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_disabled" });
    }

    const apoiadorEmail =
      (await tryResolveEmail("apoiadores", toApoiadorId, tag)) ||
      String(body.toEmail || "").trim().toLowerCase() ||
      null;
    if (!apoiadorEmail) {
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "email_unknown" });
    }

    const subject = "Um trabalhador iniciou contato no Trabalhei Lá";
    const link = `${appBaseUrl || ""}/apoiador/my-contacts`;
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1d4ed8;">Novo contato de um trabalhador</h2>
      <p>${toApoiadorName ? `Olá, ${escapeHtml(toApoiadorName)}!` : "Olá!"}</p>
      <p>${
        fromCompanyName
          ? `<strong>${escapeHtml(fromCompanyName)}</strong>`
          : "Um trabalhador"
      } iniciou uma conversa com você pelo chat do Trabalhei Lá. O valor da
      consulta ficou como <strong>"a combinar"</strong> — alinhe os detalhes
      diretamente pelo chat.</p>
      ${
        message
          ? `<blockquote style="border-left:4px solid #93c5fd;padding:8px 12px;background:#eff6ff;color:#1e3a8a;">${escapeHtml(
              message
            ).replace(/\n/g, "<br>")}</blockquote>`
          : ""
      }
      <p style="text-align:center;margin:24px 0;">
        <a href="${link}"
           style="background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Abrir conversa
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">
        ${
          conversationId ? `Conversa: ${escapeHtml(conversationId)}. ` : ""
        }Você está recebendo este e-mail porque é um especialista cadastrado no
        Trabalhei Lá.
      </p>
    </div>
  `;
    const text = [
      "Novo contato de um trabalhador no Trabalhei Lá",
      "",
      fromCompanyName ? `De: ${fromCompanyName}` : "Um trabalhador",
      message ? `Mensagem: ${message}` : null,
      "",
      `Abra a conversa: ${link}`,
    ]
      .filter((l) => l !== null)
      .join("\n");

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

    // Notificação por WhatsApp (best-effort, independe da config de e-mail).
    try {
      const wa = await tryResolveApoiadorWhatsApp(toApoiadorId, tag);
      if (wa) {
        await notifySpecialistWhatsApp({
          to: wa,
          specialistName: toApoiadorName,
          fromName: fromCompanyName || "Uma empresa",
          messageSnippet: message,
          urlSuffix: requestId,
        });
      }
    } catch (err) {
      console.warn(`[${tag}] WhatsApp falhou:`, err?.message || err);
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

  // ── Fluxo Especialista Interessado ───────────────────────────────
  // Um especialista (ex.: psicólogo) demonstra interesse em atender um
  // trabalhador identificado por suas avaliações. Notifica o trabalhador por
  // e-mail (Resend), informando o interesse e o link do perfil do especialista.
  if (type === "especialista-interesse") {
    const tag = "send-contact-request:especialistaInteresse";
    const toUid = String(body.toUid || "").trim();
    const toPseudonym = String(body.toPseudonym || "").trim();
    const specialistName = String(body.specialistName || "").trim();
    const specialistId = String(body.specialistId || "").trim();

    if (!toUid) {
      return res.status(400).json({ ok: false, error: "toUid obrigatório." });
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

    const profileLink = specialistId
      ? `${appBaseUrl || ""}/apoiadores/perfil/${encodeURIComponent(specialistId)}`
      : `${appBaseUrl || ""}/apoiadores`;
    const subject = "Um especialista tem interesse em te atender no Trabalhei Lá";
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#7e22ce;">Um especialista quer te ajudar</h2>
      <p>${toPseudonym ? `Olá, ${escapeHtml(toPseudonym)}!` : "Olá!"}</p>
      <p>${
        specialistName
          ? `<strong>${escapeHtml(specialistName)}</strong>`
          : "Um especialista"
      } demonstrou interesse em atender o seu caso a partir das avaliações que
      você publicou no Trabalhei Lá. O atendimento e a troca de mensagens
      acontecem com segurança, dentro da plataforma.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${profileLink}"
           style="background:#7e22ce;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Ver perfil do especialista
        </a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">
        Sua identidade real permanece privada. Você decide se deseja iniciar a
        conversa. É possível ignorar este contato a qualquer momento.
      </p>
    </div>
  `;
    const text = [
      "Um especialista tem interesse em te atender no Trabalhei Lá",
      "",
      specialistName ? `Especialista: ${specialistName}` : "Um especialista",
      "",
      `Ver perfil do especialista: ${profileLink}`,
    ]
      .filter(Boolean)
      .join("\n");

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
