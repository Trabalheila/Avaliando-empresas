// api/send-verification-email.js
//
// Gera um JWT de verificação de e-mail (24h) e envia o link por e-mail
// usando Resend. O link clicado pelo usuário aciona /api/verify-email?token=...
//
// Variáveis de ambiente (todas obrigatórias):
//   EMAIL_VERIFICATION_SECRET  — segredo HMAC para assinar o JWT.
//   RESEND_API_KEY             — chave da Resend.
//   EMAIL_FROM_ADDRESS         — remetente verificado na Resend.
//   APP_BASE_URL               — base URL pública (ex.: https://www.trabalheila.com.br).
//
// Body (POST JSON): { userId: string, email: string, pseudonym?: string }

import jwt from 'jsonwebtoken';
import { Resend } from 'resend';

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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

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
  const pseudonym = pseudonymRaw.slice(0, 80); // limite simples para evitar abuso no template

  if (!userId) return res.status(400).json({ ok: false, error: 'userId obrigatório' });
  if (!isValidEmail(email)) return res.status(400).json({ ok: false, error: 'E-mail inválido' });

  // Token assinado no servidor (segredo nunca exposto ao cliente).
  const token = jwt.sign({ userId, email }, secret, { expiresIn: '24h' });
  const verifyUrl = `${appBaseUrl}/api/verify-email?token=${encodeURIComponent(token)}`;

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
