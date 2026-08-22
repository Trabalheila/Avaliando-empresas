import { Resend } from "resend";
import { getAuth } from "firebase-admin/auth";
import { getApp } from "firebase-admin/app";
import { getAdminResources } from "./_firebaseAdmin.js";

const PROFILE_URL = "https://www.trabalheila.com.br/apoiador/perfil";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function requireAdmin(req) {
  await getAdminResources();
  const authorization = String(req.headers?.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");

  const decoded = await getAuth(getApp()).verifyIdToken(token);
  const adminUid = String(process.env.ADMIN_UID || process.env.REACT_APP_ADMIN_UID || "").trim();
  if (!adminUid || decoded.uid !== adminUid) throw new Error("FORBIDDEN");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    await requireAdmin(req);
    const ids = Array.isArray(req.body?.supporterIds)
      ? [...new Set(req.body.supporterIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 100)
      : [];
    if (ids.length === 0) return res.status(400).json({ error: "supporterIds obrigatório" });

    const { db } = await getAdminResources();
    const supporters = await Promise.all(
      ids.map(async (id) => {
        const snapshot = await db.collection("apoiadores").doc(id).get();
        return snapshot.exists ? { id, ...snapshot.data() } : null;
      })
    );
    const recipients = supporters.filter((supporter) => isValidEmail(supporter?.email));
    if (recipients.length === 0) return res.status(400).json({ error: "Nenhum especialista possui e-mail válido." });

    const resendKey = String(process.env.RESEND_API_KEY || "").trim();
    const fromAddress = String(process.env.EMAIL_FROM_ADDRESS || "").trim();
    if (!resendKey || !fromAddress) return res.status(500).json({ error: "Serviço de e-mail não configurado." });

    const resend = new Resend(resendKey);
    const results = await Promise.allSettled(
      recipients.map((supporter) => {
        const name = String(supporter.nome || supporter.name || "Especialista").trim();
        const greeting = escapeHtml(name || "Especialista");
        const subject = "Complete seu perfil de especialista no Trabalhei Lá";
        const text = `Olá, ${name}!\n\nSeu perfil é o cartão de visita para os trabalhadores que procuram um especialista. Por isso, é fundamental completar seu cadastro e manter suas informações atualizadas.\n\nAcesse agora: ${PROFILE_URL}\n\nAtenciosamente,\nEquipe Trabalhei Lá`;
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a"><h2 style="color:#1d4ed8">Complete seu perfil</h2><p>Olá, <strong>${greeting}</strong>!</p><p>Seu perfil é o <strong>cartão de visita para os trabalhadores</strong> que procuram um especialista. Por isso, é <strong>fundamental completar seu cadastro</strong> e manter suas informações atualizadas.</p><p style="text-align:center;margin:24px 0"><a href="${PROFILE_URL}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Completar meu cadastro</a></p><p style="font-size:12px;color:#475569">Ou acesse: <a href="${PROFILE_URL}">${PROFILE_URL}</a></p><p>Atenciosamente,<br>Equipe Trabalhei Lá</p></div>`;
        return resend.emails.send({ from: fromAddress, to: supporter.email, subject, html, text });
      })
    );

    const sent = results.filter((result) => result.status === "fulfilled" && !result.value?.error).length;
    return res.status(200).json({ sent, failed: recipients.length - sent, skipped: ids.length - recipients.length });
  } catch (err) {
    if (err?.message === "UNAUTHORIZED") return res.status(401).json({ error: "Autenticação obrigatória." });
    if (err?.message === "FORBIDDEN") return res.status(403).json({ error: "Acesso restrito ao administrador." });
    console.error("[send-profile-reminder] erro:", err?.message || err);
    return res.status(500).json({ error: "Não foi possível enviar os lembretes." });
  }
}
