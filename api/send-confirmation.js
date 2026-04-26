import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, companyName, token } = req.body;

  if (!email || !companyName || !token) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

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
        <a href="https://trabalheila.vercel.app/empresa/confirmar?token=${token}" 
           style="background:#1a237e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">
          Confirmar Cadastro
        </a>
        <p style="color:#888;font-size:12px">Este link expira em 24 horas. Se não foi você, ignore este e-mail.</p>
      </div>
    `
  });

  if (error) return res.status(500).json({ error });
  return res.status(200).json({ success: true, data });
}
