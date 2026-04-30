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
      // Idempotência: se o doc pendente já foi consumido mas alguma
      // empresa já foi gravada com este token como id (fluxo antigo)
      // ou o usuário já existe no Auth, considera confirmado.
      const legacyRef = firestore.collection('companies').doc(token);
      const legacySnap = await legacyRef.get();
      if (legacySnap.exists) {
        return res.status(200).json({
          success: true,
          alreadyConfirmed: true,
          message: 'Empresa já confirmada anteriormente.',
        });
      }
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

    if (!data.email || !data.password || !data.cnpj) {
      return res.status(400).json({
        error: 'Dados de confirmação incompletos. Refaça o cadastro.',
      });
    }

    const cnpjDigits = String(data.cnpj).replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido no cadastro.' });
    }

    // 1) Cria o usuário no Firebase Auth (idempotente: se já existir,
    //    reaproveita o uid existente — fluxo de re-confirmação).
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: data.email,
        password: data.password,
        displayName: data.companyName || data.email,
        emailVerified: true,
      });
    } catch (authErr) {
      if (authErr?.code === 'auth/email-already-exists') {
        userRecord = await admin.auth().getUserByEmail(data.email);
        // Garante que a senha cadastrada agora seja a válida e o e-mail
        // fique marcado como verificado.
        await admin.auth().updateUser(userRecord.uid, {
          password: data.password,
          emailVerified: true,
        });
      } else {
        console.error('ERRO ao criar usuário no Firebase Auth:', authErr);
        return res.status(500).json({ error: 'Erro ao criar conta de acesso.' });
      }
    }

    // 2) Grava a empresa em companies/{cnpjDigits} com ownerUid e SEM senha.
    const companyRef = firestore.collection('companies').doc(cnpjDigits);
    await companyRef.set({
      cnpj: cnpjDigits,
      email: data.email,
      companyName: data.companyName,
      razaoSocial: data.companyName,
      cnaeCodigo: data.cnaeCodigo ?? null,
      cnaeDescricao: data.cnaeDescricao ?? null,
      setor: data.setor ?? null,
      responsavel: data.responsavel ?? null,
      cargo: data.cargo ?? null,
      ownerUid: userRecord.uid,
      verified: true,
      status: 'active',
      createdAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // 3) Apaga o doc pendente (remove a senha do Firestore).
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
