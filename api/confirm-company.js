import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Inicialização única do Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { token } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token não informado.' });
  }

  // Validação básica do formato do token (defesa contra IDs maliciosos)
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return res.status(400).json({ error: 'Formato de token inválido.' });
  }

  try {
    const firestore = getFirestore();
    const pendingRef = firestore.collection('pendingCompanyConfirmations').doc(token);
    const snap = await pendingRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Token inválido ou não encontrado.' });
    }

    const data = snap.data();

    // expiresAt foi gravado pelo Admin SDK como Firestore Timestamp
    const expiresMs =
      (data.expiresAt && typeof data.expiresAt.toMillis === 'function')
        ? data.expiresAt.toMillis()
        : (data.expiresAt instanceof Date ? data.expiresAt.getTime() : null);

    if (!expiresMs || Date.now() > expiresMs) {
      return res.status(400).json({
        error: 'Token expirado',
        email: data.email,
        companyName: data.companyName,
      });
    }

    // Migra para a coleção companies usando o mesmo token como ID
    const companyRef = firestore.collection('companies').doc(token);
    await companyRef.set({
      email: data.email,
      companyName: data.companyName,
      verified: true,
      status: 'active',
      createdAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await pendingRef.delete();

    return res.status(200).json({
      success: true,
      message: 'Empresa confirmada com sucesso.',
    });
  } catch (err) {
    console.error('ERRO em /api/confirm-company:', err);
    return res.status(500).json({ error: 'Erro interno ao confirmar empresa.' });
  }
}
