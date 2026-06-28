import { Resend } from 'resend';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getServiceAccount } from './_firebaseAdmin.js';

// Endpoint duplo (rota por body.action):
//   action: "send"    (padrão) → envia e-mail de confirmação para a empresa
//   action: "confirm"           → confirma o cadastro (cria usuário Auth + companies/{cnpj})
//
// Inicialização preguiçosa para evitar crash no carregamento do módulo
// quando alguma variável de ambiente está ausente — o handler retorna
// 500 com mensagem JSON ao invés de a função falhar antes do try/catch.
function ensureAdmin() {
  if (admin.apps.length) return;
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    throw new Error(
      'Configuração do Firebase Admin incompleta no servidor (FIREBASE_SERVICE_ACCOUNT ausente ou inválida).'
    );
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function handleConfirm(req, res) {
  const { token } = req.body || {};

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token não informado.' });
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return res.status(400).json({ error: 'Formato de token inválido.' });
  }

  try {
    const firestore = getFirestore();
    const pendingRef = firestore.collection('pendingCompanyConfirmations').doc(token);
    const snap = await pendingRef.get();

    if (!snap.exists) {
      // Idempotência: se já existe a empresa criada, considera confirmada.
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
        await admin.auth().updateUser(userRecord.uid, {
          password: data.password,
          emailVerified: true,
        });
      } else {
        console.error('ERRO ao criar usuário no Firebase Auth:', authErr);
        return res.status(500).json({ error: 'Erro ao criar conta de acesso.' });
      }
    }

    const companyRef = firestore.collection('companies').doc(cnpjDigits);
    await companyRef.set({
      cnpj: cnpjDigits,
      email: data.email,
      companyName: data.companyName,
      razaoSocial: data.companyName,
      cnaeCodigo: data.cnaeCodigo ?? null,
      cnaeDescricao: data.cnaeDescricao ?? null,
      setor: data.setor ?? null,
      ramoAtuacao: data.ramoAtuacao ?? null,
      responsavel: data.responsavel ?? null,
      cargo: data.cargo ?? null,
      ownerUid: userRecord.uid,
      verified: true,
      status: 'active',
      createdAt: data.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await pendingRef.delete();

    return res.status(200).json({
      success: true,
      message: 'Empresa confirmada com sucesso.',
    });
  } catch (err) {
    console.error('ERRO em /api/send-confirmation (confirm):', err);
    return res.status(500).json({ error: 'Erro interno ao confirmar empresa.' });
  }
}

async function handleSend(req, res) {
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY ausente no ambiente do servidor.');
    return res.status(500).json({ error: 'Serviço de e-mail não configurado (RESEND_API_KEY ausente).' });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const {
    email,
    companyName,
    token,
    password,
    cnpj,
    cnaeCodigo,
    cnaeDescricao,
    setor,
    ramoAtuacao,
    responsavel,
    cargo,
  } = req.body || {};

  console.log('Requisição recebida para send-confirmation:', { email, companyName, token, cnpj });

  if (!email || !companyName || !token || !password || !cnpj) {
    console.error('Dados incompletos na requisição:', { email, companyName, token, hasPassword: !!password, cnpj });
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const cnpjDigits = String(cnpj).replace(/\D/g, '');
  if (cnpjDigits.length !== 14) {
    return res.status(400).json({ error: 'CNPJ inválido.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Senha inválida.' });
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return res.status(400).json({ error: 'Token inválido.' });
  }

  try {
    const firestore = getFirestore();
    const companyRef = firestore.collection('pendingCompanyConfirmations').doc(token);

    const companyData = {
      email,
      companyName,
      token,
      password,
      cnpj: cnpjDigits,
      cnaeCodigo: cnaeCodigo || null,
      cnaeDescricao: cnaeDescricao || null,
      setor: setor || null,
      ramoAtuacao: ramoAtuacao || null,
      responsavel: responsavel || null,
      cargo: cargo || null,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    await companyRef.set(companyData);
    console.log('Dados da empresa salvos no Firestore com sucesso para o token:', token);

  } catch (firestoreError) {
    console.error('ERRO ao salvar dados no Firestore:', firestoreError);
    return res.status(500).json({
      error: `Erro ao salvar dados da empresa: ${firestoreError?.message || 'desconhecido'}`,
    });
  }

  const confirmationLink = `https://trabalheila.vercel.app/empresa/confirmar?token=${token}`;
  console.log('Link de confirmação enviado no e-mail:', confirmationLink);

  let data;
  let error;
  try {
    const result = await resend.emails.send({
      from: 'Trabalhei Lá <confirmacao@trabalheila.com.br>',
      to: email,
      replyTo: 'faleconosco@trabalheila.com.br',
      subject: 'Confirme o cadastro da sua empresa no Trabalhei Lá',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto">
          <h2>Cadastro recebido!</h2>
          <p>Olá! O cadastro da empresa <strong>${companyName}</strong> foi recebido com sucesso.</p>
          <p>Clique no botão abaixo para confirmar e ativar seu acesso:</p>
          <a href="${confirmationLink}"
             style="background:#1a237e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
            Confirmar Cadastro
          </a>
          <p style="color:#888;font-size:12px">Este link expira em 24 horas. Se não foi você, ignore este e-mail.</p>
        </div>
      `,
    });
    data = result?.data;
    error = result?.error;
  } catch (sendErr) {
    console.error('Exceção ao chamar Resend:', sendErr);
    return res.status(500).json({
      error: `Falha ao chamar serviço de e-mail: ${sendErr?.message || 'erro desconhecido'}`,
    });
  }

  if (error) {
    console.error('ERRO ao enviar e-mail com Resend:', error);
    const detail = error?.message || error?.name || 'erro desconhecido';
    return res.status(500).json({ error: `Erro ao enviar e-mail: ${detail}` });
  }

  console.log('E-mail de confirmação enviado com sucesso para:', email);
  return res.status(200).json({ success: true, data });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    ensureAdmin();
  } catch (initErr) {
    console.error('Falha na inicialização do Firebase Admin:', initErr);
    return res.status(500).json({ error: initErr?.message || 'Erro de configuração do servidor.' });
  }

  const action = String((req.body || {}).action || 'send').toLowerCase();
  if (action === 'confirm') return handleConfirm(req, res);
  return handleSend(req, res);
}