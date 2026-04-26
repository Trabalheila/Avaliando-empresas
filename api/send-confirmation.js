const { Resend } = require('resend');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

// Inicialização do Firebase Admin
if (!global._firebaseAdminInitialized) {
  initializeApp({ credential: applicationDefault() });
  global._firebaseAdminInitialized = true;
}
const db = getFirestore();

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const { cnpj, razaoSocial, responsavel, email, empresaId } = req.body;
  if (!email || !empresaId || !responsavel || !razaoSocial) return res.status(400).json({ error: 'Dados obrigatórios ausentes' });

  const token = crypto.randomUUID();
  const expires = Date.now() + 24 * 60 * 60 * 1000;

  // Salva token e expiração no Firestore
  await db.collection('companies').doc(empresaId).set({
    confirmationToken: token,
    tokenExpiresAt: expires,
    status: 'pendente',
  }, { merge: true });

  const confirmUrl = `https://trabalheila.vercel.app/empresa/confirmar?token=${token}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Confirme o cadastro da sua empresa no Trabalhei Lá</h2>
      <p>Olá, <b>${responsavel}</b>!</p>
      <p>Recebemos um pedido de cadastro para a empresa <b>${razaoSocial}</b>.<br>
      Para ativar o perfil empresarial, clique no botão abaixo:</p>
      <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;font-weight:bold;border-radius:8px;text-decoration:none;margin:16px 0">Confirmar Cadastro</a>
      <p>Se não foi você, ignore este e-mail.</p>
      <p style="font-size:12px;color:#888">Este link expira em 24 horas.</p>
    </div>
  `;

  await resend.emails.send({
    from: 'Trabalhei Lá <confirmacao@trabalheila.com.br>',
    to: email,
    subject: 'Confirme o cadastro da sua empresa no Trabalhei Lá',
    html,
    reply_to: 'faleconosco@trabalheila.com.br',
  });

  res.status(200).json({ ok: true });
};
