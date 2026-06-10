// api/send-receipt.js
//
// Envia o recibo emitido pelo profissional (especialista) para o e-mail
// do trabalhador (cliente/paciente) de um caso/consulta.
//
// Fluxo: o painel do profissional (CaseDetailsPage) lê o arquivo do recibo,
// converte para base64 e faz POST para este endpoint. O e-mail real do
// trabalhador nunca é exposto no response — é resolvido no servidor a
// partir de `workerUid` (coleção `users`) quando disponível, ou usa o
// `toEmail` informado pelo profissional.
//
// Best-effort: se RESEND_API_KEY / EMAIL_FROM_ADDRESS não estão
// configurados, retorna 200 com `emailed: false`.
//
// Variáveis de ambiente:
//   RESEND_API_KEY        chave da Resend
//   EMAIL_FROM_ADDRESS    remetente verificado
//   APP_BASE_URL          base URL pública do app (opcional)
//   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

import { Resend } from "resend";
import { getAdminResources } from "./_firebaseAdmin.js";

// Limite do arquivo do recibo (2 MB). base64 infla ~33%, mantendo o corpo
// da requisição com folga abaixo do limite das funções serverless da Vercel.
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function resolveWorkerEmail(workerUid) {
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
    const snap = await admin.firestore().doc(`users/${workerUid}`).get();
    if (!snap.exists) return null;
    return String(snap.data()?.email || "").trim().toLowerCase() || null;
  } catch (err) {
    console.warn("[send-receipt] resolveWorkerEmail falhou:", err?.message || err);
    return null;
  }
}

// Registra o envio do recibo no histórico para auditoria:
//   consultas/{consultaId}.recibos[]  (apenas metadados, nunca o arquivo).
// Best-effort: falha de log não invalida o envio do e-mail.
async function logReceiptHistory(consultaId, entry) {
  if (!consultaId) return { logged: false, reason: "no_consulta_id" };
  try {
    const { db, FieldValue, Timestamp } = await getAdminResources();
    const record = {
      ...entry,
      sentAt: Timestamp.now(),
    };
    await db
      .collection("consultas")
      .doc(consultaId)
      .set(
        {
          recibos: FieldValue.arrayUnion(record),
          ultimoReciboEnviadoEm: record.sentAt,
        },
        { merge: true }
      );
    return { logged: true };
  } catch (err) {
    console.warn("[send-receipt] logReceiptHistory falhou:", err?.message || err);
    return { logged: false, reason: "exception" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const body = req.body || {};
  const caseId = String(body.caseId || "").trim();
  const consultaId = String(body.consultaId || "").trim();
  const apoiadorId = String(body.apoiadorId || "").trim();
  const workerUid = String(body.workerUid || "").trim();
  const toEmail = String(body.toEmail || "").trim().toLowerCase();
  const specialistName = String(body.specialistName || "").trim();
  const note = String(body.note || "").trim().slice(0, 1000);
  const fileName = String(body.fileName || "recibo").trim().slice(0, 160);
  const fileType = String(body.fileType || "").trim().toLowerCase();
  const fileContentBase64 = String(body.fileContentBase64 || "").trim();

  // ── Validações ────────────────────────────────────────────────────
  if (!fileContentBase64) {
    return res
      .status(400)
      .json({ ok: false, error: "Arquivo do recibo ausente." });
  }
  if (fileType && !ALLOWED_MIME.has(fileType)) {
    return res.status(400).json({
      ok: false,
      error: "Formato inválido. Envie PDF, PNG, JPG ou WEBP.",
    });
  }

  let buffer;
  try {
    buffer = Buffer.from(fileContentBase64, "base64");
  } catch {
    return res.status(400).json({ ok: false, error: "Arquivo inválido." });
  }
  if (!buffer?.length) {
    return res.status(400).json({ ok: false, error: "Arquivo vazio." });
  }
  if (buffer.length > MAX_RECEIPT_BYTES) {
    return res.status(400).json({
      ok: false,
      error: "Arquivo muito grande. O limite é de 2 MB.",
    });
  }

  // ── Resolve o destinatário ────────────────────────────────────────
  let recipient = null;
  if (workerUid) {
    recipient = await resolveWorkerEmail(workerUid);
  }
  if (!recipient && toEmail) {
    if (!EMAIL_RE.test(toEmail)) {
      return res
        .status(400)
        .json({ ok: false, error: "E-mail do destinatário inválido." });
    }
    recipient = toEmail;
  }
  if (!recipient) {
    return res.status(400).json({
      ok: false,
      error: "Não foi possível determinar o e-mail do trabalhador.",
    });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!resendKey || !fromAddress) {
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "email_disabled" });
  }

  const subject = "Seu recibo de atendimento — Trabalhei Lá";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#0f766e;">Recibo de atendimento</h2>
      <p>Olá!</p>
      <p>${
        specialistName
          ? `O profissional <strong>${escapeHtml(specialistName)}</strong> enviou`
          : "O profissional enviou"
      } o recibo referente ao seu atendimento${
        caseId ? ` (caso ${escapeHtml(caseId)})` : ""
      } realizado pela plataforma Trabalhei Lá.</p>
      ${
        note
          ? `<blockquote style="border-left:4px solid #5eead4;padding:8px 12px;background:#f0fdfa;color:#134e4a;">${escapeHtml(
              note
            ).replace(/\n/g, "<br>")}</blockquote>`
          : ""
      }
      <p>O recibo está anexado a este e-mail. Guarde-o para fins de
      comprovação e declaração.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:20px;">
        Você está recebendo este e-mail porque realizou um atendimento com um
        profissional no Trabalhei Lá.
      </p>
    </div>
  `;
  const text = [
    "Recibo de atendimento — Trabalhei Lá",
    "",
    specialistName
      ? `O profissional ${specialistName} enviou o recibo do seu atendimento${
          caseId ? ` (caso ${caseId})` : ""
        }.`
      : `Recibo do seu atendimento${caseId ? ` (caso ${caseId})` : ""}.`,
    note ? `\n${note}` : "",
    "",
    "O recibo está anexado a este e-mail. Guarde-o para comprovação.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: recipient,
      replyTo: fromAddress,
      subject,
      html,
      text,
      attachments: [
        {
          filename: fileName,
          content: buffer,
        },
      ],
    });
    if (error) {
      console.error("[send-receipt] Resend erro:", error);
      return res
        .status(200)
        .json({ ok: true, emailed: false, reason: "send_failed" });
    }

    // Registra o histórico do recibo enviado (auditoria) — best-effort.
    const { logged } = await logReceiptHistory(consultaId, {
      caseId: caseId || null,
      apoiadorId: apoiadorId || null,
      specialistName: specialistName || null,
      workerUid: workerUid || null,
      recipientEmail: recipient,
      fileName,
      fileType: fileType || null,
      fileSizeBytes: buffer.length,
      note: note || null,
    });

    return res.status(200).json({ ok: true, emailed: true, logged });
  } catch (err) {
    console.error("[send-receipt] erro inesperado:", err?.message || err);
    return res
      .status(200)
      .json({ ok: true, emailed: false, reason: "exception" });
  }
}
