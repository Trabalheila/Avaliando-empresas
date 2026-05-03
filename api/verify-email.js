// api/verify-email.js
//
// Endpoint clicado a partir do e-mail de verificação. Valida o JWT,
// marca o usuário como verificado no Firestore e redireciona o navegador
// para a home com ?verified=1 (sucesso) ou ?verified=0&reason=... (erro).
//
// Variáveis de ambiente:
//   EMAIL_VERIFICATION_SECRET   (obrigatória) — mesmo segredo usado para assinar o JWT.
//   APP_BASE_URL                (obrigatória) — para onde redirecionar.
//   FIREBASE_PROJECT_ID         — credenciais Firebase Admin (já usadas em outras rotas).
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY

import jwt from 'jsonwebtoken';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

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
