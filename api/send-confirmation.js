import { Resend } from 'resend';
import * as admin from 'firebase-admin';
// Importe getFirestore do módulo firebase-admin/firestore
import { getFirestore } from 'firebase-admin/firestore'; // <--- ADICIONE ESTA LINHA

// Inicialize o Firebase Admin SDK APENAS UMA VEZ
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    email,
    companyName,
    token,
    password,
    cnpj,
    cnaeCodigo,
    cnaeDescricao,
    setor,
    responsavel,
    cargo,
  } = req.body || {};

  console.log('Requisição recebida para send-confirmation:', { email, companyName, token, cnpj });

  if (!email || !companyName || !token || !password || !cnpj) {
    console.error('Dados incompletos na requisição:', { email, companyName, token, hasPassword: !!password, cnpj });
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  // Validações básicas (defesa em profundidade — front também valida).
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

  // --- 1. Salvar o token e os dados da empresa no Firestore ---
  // A senha é guardada temporariamente no doc pendente (acessível
  // apenas via Admin SDK, regras negam leitura ao cliente). Após a
  // confirmação, /api/confirm-company cria o usuário no Firebase Auth
  // e apaga este documento, removendo a senha do Firestore.
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
    return res.status(500).json({ error: 'Erro interno ao salvar dados da empresa.' });
  }

  // --- 2. Enviar o e-mail com Resend ---
  const confirmationLink = `https://trabalheila.vercel.app/empresa/confirmar?token=${token}`;
  console.log('Link de confirmação enviado no e-mail:', confirmationLink);

  const { data, error } = await resend.emails.send({
    from: 'Trabalhei Lá <confirmacao@trabalheila.com.br>',
    to: email,
    reply_to: 'faleconosco@trabalheila.com.br',
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
    `
  });

  if (error) {
    console.error('ERRO ao enviar e-mail com Resend:', error);
    return res.status(500).json({ error: 'Erro interno ao enviar e-mail.' });
  }

  console.log('E-mail de confirmação enviado com sucesso para:', email);
  return res.status(200).json({ success: true, data });
}