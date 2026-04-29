import { Resend } from 'resend';
// Importe o Firebase Admin SDK
import * as admin from 'firebase-admin';

// Inicialize o Firebase Admin SDK APENAS UMA VEZ
// Verifique se já não foi inicializado para evitar erros em ambientes de desenvolvimento
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Importante para chaves com quebras de linha
    }),
    // Se você usa Realtime Database ou Storage, adicione o databaseURL ou storageBucket
  });
}

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, companyName, token } = req.body;

  // --- Adicione logs para depuração ---
  console.log('Requisição recebida para send-confirmation:', { email, companyName, token });

  if (!email || !companyName || !token) {
    console.error('Dados incompletos na requisição:', { email, companyName, token });
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  // --- 1. Salvar o token e os dados da empresa no Firestore ---
  try {
    const firestore = admin.firestore();
    const companyRef = firestore.collection('pendingCompanyConfirmations').doc(token); // Use o token como ID do documento para fácil busca

    const companyData = {
      email,
      companyName,
      token, // Salve o token também dentro do documento
      status: 'pending', // Status inicial
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // Data de criação
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expira em 24 horas
    };

    await companyRef.set(companyData);
    console.log('Dados da empresa salvos no Firestore com sucesso para o token:', token);

  } catch (firestoreError) {
    console.error('ERRO ao salvar dados no Firestore:', firestoreError);
    return res.status(500).json({ error: 'Erro interno ao salvar dados da empresa.' });
  }

  // --- 2. Enviar o e-mail com Resend ---
  const confirmationLink = `https://trabalheila.vercel.app/empresa/confirmar?token=${token}`;
  console.log('Link de confirmação enviado no e-mail:', confirmationLink); // Log do link

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