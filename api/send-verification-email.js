// api/send-verification-email.js
//
// Endpoint duplo (rota por método HTTP):
//
//   POST → Gera um JWT (24h) e envia o link por e-mail via Resend.
//          Body: { userId, email, pseudonym? }
//
//   GET  → Endpoint clicado a partir do e-mail. Valida o JWT, marca o
//          usuário como verificado no Firestore e redireciona para a
//          home com ?verified=1 (sucesso) ou ?verified=0&reason=... (erro).
//          Query: ?token=...
//
// Variáveis de ambiente:
//   EMAIL_VERIFICATION_SECRET  — segredo HMAC do JWT (obrigatório)
//   RESEND_API_KEY             — chave da Resend (obrigatório p/ POST)
//   EMAIL_FROM_ADDRESS         — remetente verificado (obrigatório p/ POST)
//   APP_BASE_URL               — base URL pública (obrigatório)
//   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (GET)

import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Configuração do Firebase Admin incompleta (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }
  let privateKey = privateKeyRaw.replace(/^\uFEFF/, '').trim();
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r/g, '');
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function buildRedirect(baseUrl, params) {
  const base = (baseUrl || '').replace(/\/+$/, '') || '/';
  const qs = new URLSearchParams(params).toString();
  return `${base}/?${qs}`;
}

async function handleVerify(req, res) {
  const baseUrl = process.env.APP_BASE_URL || '';
  const secret = process.env.EMAIL_VERIFICATION_SECRET;

  const token = (req.query?.token || '').toString();
  if (!token) {
    return res.redirect(302, buildRedirect(baseUrl, { verified: '0', reason: 'missing_token' }));
  }
  if (!secret) {
    console.error('[verify-email] EMAIL_VERIFICATION_SECRET ausente');
    return res.redirect(302, buildRedirect(baseUrl, { verified: '0', reason: 'server_misconfigured' }));
  }

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (err) {
    const reason = err?.name === 'TokenExpiredError' ? 'expired' : 'invalid_token';
    console.warn('[verify-email] token rejeitado:', err?.name || err?.message);
    return res.redirect(302, buildRedirect(baseUrl, { verified: '0', reason }));
  }

  const userId = String(payload?.userId || '').trim();
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!userId || !email) {
    return res.redirect(302, buildRedirect(baseUrl, { verified: '0', reason: 'invalid_payload' }));
  }

  try {
    ensureAdmin();
    const db = getFirestore();
    await db.collection('users').doc(userId).set(
      {
        email,
        emailVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[verify-email] falha ao atualizar Firestore:', err?.message || err);
    return res.redirect(302, buildRedirect(baseUrl, { verified: '0', reason: 'persist_failed' }));
  }

  return res.redirect(302, buildRedirect(baseUrl, { verified: '1' }));
}

async function handleSend(req, res) {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const appBaseUrl = (process.env.APP_BASE_URL || '').replace(/\/+$/, '');

  if (!secret) {
    console.error('[send-verification-email] EMAIL_VERIFICATION_SECRET ausente');
    return res.status(500).json({ ok: false, error: 'Servidor de verificação não configurado.' });
  }
  if (!resendKey || !fromAddress) {
    console.error('[send-verification-email] RESEND_API_KEY ou EMAIL_FROM_ADDRESS ausente');
    return res.status(500).json({ ok: false, error: 'Serviço de e-mail não configurado.' });
  }
  if (!appBaseUrl) {
    console.error('[send-verification-email] APP_BASE_URL ausente');
    return res.status(500).json({ ok: false, error: 'APP_BASE_URL não configurado.' });
  }

  const body = req.body || {};
  const userId = String(body.userId || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const pseudonymRaw = String(body.pseudonym || '').trim();
  const pseudonym = pseudonymRaw.slice(0, 80);

  if (!userId) return res.status(400).json({ ok: false, error: 'userId obrigatório' });
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: 'E-mail inválido' });

  const token = jwt.sign({ userId, email }, secret, { expiresIn: '24h' });
  // GET no mesmo endpoint executa a verificação.
  const verifyUrl = `${appBaseUrl}/api/send-verification-email?token=${encodeURIComponent(token)}`;

  const greetingName = pseudonym ? escapeHtml(pseudonym) : '';
  const greeting = greetingName ? `Olá, ${greetingName}!` : 'Olá!';

  const subject = 'Confirme seu e-mail no Trabalhei Lá';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1d4ed8;">Confirme seu e-mail</h2>
      <p>${greeting} Para concluir o cadastro no <strong>Trabalhei Lá</strong>, confirme que este e-mail é seu clicando no botão abaixo.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${verifyUrl}"
           style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
          Confirmar e-mail
        </a>
      </p>
      <p style="font-size:12px;color:#475569;">Ou copie e cole este link no navegador:<br>
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="font-size:12px;color:#94a3b8;">Este link expira em 24 horas. Se você não solicitou esta verificação, ignore este e-mail.</p>
    </div>
  `;
  const text =
    `${pseudonym ? `Olá, ${pseudonym}!` : 'Olá!'} ` +
    `Confirme seu e-mail no Trabalhei Lá acessando o link abaixo (expira em 24h):\n\n${verifyUrl}\n\n` +
    `Se você não solicitou esta verificação, ignore este e-mail.`;

  try {
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('[send-verification-email] Resend erro:', error);
      return res.status(500).json({ ok: false, error: 'Falha ao enviar e-mail de verificação.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[send-verification-email] erro inesperado:', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Erro inesperado ao enviar e-mail.' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') return handleVerify(req, res);
  if (req.method === 'POST') return handleSend(req, res);
  return res.status(405).json({ ok: false, error: 'Método não permitido' });
}
