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

  const { email, companyName, token } = req.body;

  console.log('Requisição recebida para send-confirmation:', { email, companyName, token });

  if (!email || !companyName || !token) {
    console.error('Dados incompletos na requisição:', { email, companyName, token });
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  // --- 1. Salvar o token e os dados da empresa no Firestore ---
  try {
    // Use getFirestore() para obter a instância do Firestore
    const firestore = getFirestore(); // <--- ALTERE ESTA LINHA
    const companyRef = firestore.collection('pendingCompanyConfirmations').doc(token);

    const companyData = {
      email,
      companyName,
      token,
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