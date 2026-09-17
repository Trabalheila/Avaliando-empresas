// api/_caseDocuments.js
//
// Handlers do fluxo "Documento para Assinatura" (Detalhes do caso →
// Gov.br). Consolidado em api/send-contact-request.js (op=notify-send |
// client-view | govbr-start | govbr-callback) para manter a contagem de
// Serverless Functions dentro do limite do plano Vercel (arquivos
// prefixados com "_" não viram função própria).
//
// Documento no Firestore:
//   apoiadores/{specialistId}/cases/{caseId}/documentsForSignature/{docId}
//
// O cliente nunca recebe specialistId/caseId/docId — apenas um token opaco
// (`clientAccessToken`). Todas as rotas aqui resolvem o token via
// `collectionGroup("documentsForSignature")`, usando o Admin SDK (que
// ignora as regras do Firestore), então não é necessário expor esses IDs.

import { Resend } from 'resend';
import { getStorage } from 'firebase-admin/storage';
import { getAdminResources } from './_firebaseAdmin.js';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || 'https://www.trabalheila.com.br').replace(/\/+$/, '');
}

/** Busca o documento pelo token opaco enviado ao cliente. Retorna o snapshot ou null. */
async function findDocumentByToken(db, token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const snap = await db
      .collectionGroup('documentsForSignature')
      .where('clientAccessToken', '==', token)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
    return null;
  } catch (err) {
    // A collection-group index can be unavailable in a newly configured
    // Firebase project. Fall back to the known document hierarchy so an
    // already-sent link remains usable while the index is repaired.
    console.warn('[case-documents] collectionGroup falhou; usando fallback:', err?.message || err);
    const specialists = await db.collection('apoiadores').get();
    for (const specialist of specialists.docs) {
      const cases = await specialist.ref.collection('cases').get();
      for (const caseDoc of cases.docs) {
        const documents = await caseDoc.ref
          .collection('documentsForSignature')
          .where('clientAccessToken', '==', token)
          .limit(1)
          .get();
        if (!documents.empty) return documents.docs[0];
      }
    }
    return null;
  }
}

async function resolveEmail(db, collectionName, docId) {
  try {
    const snap = await db.collection(collectionName).doc(String(docId)).get();
    return snap.exists ? String(snap.data()?.email || '').trim() : '';
  } catch {
    return '';
  }
}

// ── POST /api/documents/upload-signed ──────────────────────────────────
// Recebe o PDF assinado através do link opaco e atualiza o documento
// correspondente usando o Admin SDK, sem exigir login no navegador.
export async function handleCaseDocUploadSigned(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  const token = String(req.body?.token || '').trim();
  const fileName = String(req.body?.fileName || 'documento_assinado.pdf').trim();
  const contentType = String(req.body?.contentType || '').toLowerCase();
  const fileContentBase64 = String(req.body?.fileContentBase64 || '').trim();
  if (!token || !fileContentBase64) {
    return res.status(400).json({ ok: false, error: 'Token e arquivo são obrigatórios.' });
  }
  if (contentType !== 'application/pdf' && !/\.pdf$/i.test(fileName)) {
    return res.status(400).json({ ok: false, error: 'Envie apenas um arquivo PDF.' });
  }

  const buffer = Buffer.from(fileContentBase64, 'base64');
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'O PDF deve ter até 4 MB.' });
  }

  const { db, FieldValue } = await getAdminResources();
  const docSnap = await findDocumentByToken(db, token);
  if (!docSnap) return res.status(404).json({ ok: false, error: 'Documento não encontrado ou link inválido.' });

  const caseRef = docSnap.ref.parent.parent;
  const specialistId = caseRef?.parent?.parent?.id || '';
  const caseId = caseRef?.id || '';
  if (!specialistId || !caseId) {
    return res.status(500).json({ ok: false, error: 'Caminho do documento inválido.' });
  }

  const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'documento_assinado.pdf';
  const path = `documentsForSignature/${specialistId}/${caseId}/signed/${Date.now()}-${safeName}`;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'trabalheila.firebasestorage.app';
  const file = getStorage().bucket(bucketName).file(path);
  await file.save(buffer, { metadata: { contentType: 'application/pdf' } });
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  await docSnap.ref.update({
    status: 'signed',
    signedUrl,
    signedAt: FieldValue.serverTimestamp(),
    signedByUserId: docSnap.data()?.workerUid || null,
  });

  // A notificação não pode invalidar um upload já concluído.
  try {
    const baseUrl = getAppBaseUrl();
    await fetch(`${baseUrl}/api/send-contact-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'document-signed',
        workerUid: docSnap.data()?.workerUid || '',
        specialistId,
        caseId,
        documentTitle: docSnap.data()?.documentTitle || '',
      }),
    });
  } catch (err) {
    console.warn('[case-documents] Falha ao notificar especialista:', err?.message || err);
  }

  return res.status(200).json({ ok: true, signedUrl });
}

// ── POST /api/documents/notify-send ─────────────────────────────────────
// Disparado pelo cliente logo após registrar o documento no Firestore.
// Envia e-mail + notificação in-app (sino) ao cliente com o link de acesso.
export async function handleCaseDocNotifySend(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  const {
    specialistId,
    caseId,
    documentId,
    documentTitle,
    workerUid,
    specialistName,
    clientAccessLink,
    reminder,
  } = req.body || {};

  if (!workerUid || !clientAccessLink || !documentTitle) {
    return res.status(400).json({ ok: false, error: 'Dados incompletos.' });
  }

  const { db, FieldValue } = await getAdminResources();

  // Notificação in-app (sino) — mesma coleção usada por NotificationsBell.
  try {
    await db.collection('notifications').add({
      toUid: String(workerUid),
      fromUid: String(specialistId || ''),
      type: 'documentSignature',
      message: reminder
        ? `Lembrete: assine o documento "${documentTitle}"`
        : `${specialistName || 'Seu especialista'} enviou "${documentTitle}" para sua assinatura`,
      link: clientAccessLink,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[case-documents] Falha ao criar notificação in-app:', err?.message || err);
  }

  // E-mail (best-effort).
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  let emailed = false;
  if (resendKey && fromAddress) {
    const email = await resolveEmail(db, 'clientProfiles', workerUid) || await resolveEmail(db, 'users', workerUid);
    if (email) {
      try {
        const resend = new Resend(resendKey);
        const subject = reminder
          ? `Lembrete: assinatura pendente — ${documentTitle}`
          : `Documento para assinatura — ${documentTitle}`;
        const html = `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#1d4ed8;">Você tem um documento para assinar</h2>
            <p><strong>${escapeHtml(specialistName || 'Seu especialista')}</strong> enviou o documento
            <strong>${escapeHtml(documentTitle)}</strong> para sua assinatura digital via Gov.br.</p>
            <p style="text-align:center;margin:24px 0;">
              <a href="${escapeHtml(clientAccessLink)}"
                 style="background:#1d4ed8;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold;">
                Visualizar e assinar
              </a>
            </p>
            <p style="font-size:12px;color:#94a3b8;">Este link é pessoal e intransferível.</p>
          </div>
        `;
        const { error } = await resend.emails.send({
          from: fromAddress,
          to: email,
          subject,
          html,
          text: `${specialistName || 'Seu especialista'} enviou "${documentTitle}" para sua assinatura.\nAcesse: ${clientAccessLink}`,
        });
        emailed = !error;
      } catch (err) {
        console.warn('[case-documents] Falha ao enviar e-mail:', err?.message || err);
      }
    }
  }

  return res.status(200).json({ ok: true, emailed });
}

// ── GET /api/documents/client-view?token=... ────────────────────────────
// Devolve os dados do documento (sem expor specialistId/caseId/docId) para
// a tela pública de assinatura do cliente.
export async function handleCaseDocClientView(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  const token = String(req.query?.token || '');
  const { db } = await getAdminResources();
  const docSnap = await findDocumentByToken(db, token);
  if (!docSnap) return res.status(404).json({ ok: false, error: 'Documento não encontrado ou link inválido.' });

  const data = docSnap.data();
  return res.status(200).json({
    ok: true,
    document: {
      documentTitle: data.documentTitle || '',
      originalUrl: data.originalUrl || '',
      signedUrl: data.signedUrl || null,
      status: data.status || 'pending',
      sentAt: data.sentAt?.toDate?.()?.toISOString?.() || null,
      signedAt: data.signedAt?.toDate?.()?.toISOString?.() || null,
    },
  });
}

// ── POST /api/documents/govbr-start ──────────────────────────────────────
// Inicia a assinatura no Gov.br. Aqui entraria a chamada real à API do
// Gov.br (assinatura eletrônica / conecta gov.br) — este endpoint apenas
// prepara o framework: valida o token e devolve a URL para onde o
// frontend deve redirecionar o usuário.
export async function handleCaseDocGovBrStart(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método não permitido.' });

  const token = String((req.body || {}).token || '');
  const { db } = await getAdminResources();
  const docSnap = await findDocumentByToken(db, token);
  if (!docSnap) return res.status(404).json({ ok: false, error: 'Documento não encontrado ou link inválido.' });

  // TODO(integração Gov.br): trocar este bloco pela chamada real à API de
  // assinatura eletrônica do Gov.br (ex.: "Assinatura Eletrônica" do
  // Conecta gov.br), enviando `originalUrl` do documento e recebendo a URL
  // de redirecionamento do usuário para lá. É necessário credenciamento
  // (client_id/client_secret) do órgão junto ao Gov.br e HTTPS público para
  // o callback abaixo. Documentação: https://www.gov.br/governodigital/pt-br/conecta-gov-br
  const callbackUrl = `${getAppBaseUrl()}/api/documents/govbr-callback?state=${encodeURIComponent(token)}`;
  const govBrAuthorizeUrlPlaceholder = `https://sso.acesso.gov.br/authorize?placeholder=1&state=${encodeURIComponent(token)}&redirect_uri=${encodeURIComponent(callbackUrl)}`;

  try {
    await docSnap.ref.update({ status: 'awaiting_signature' });
  } catch {
    /* segue mesmo assim — não bloqueia o redirecionamento */
  }

  return res.status(200).json({ ok: true, redirectUrl: govBrAuthorizeUrlPlaceholder });
}

// ── GET/POST /api/documents/govbr-callback ──────────────────────────────
// Callback de retorno do Gov.br após a assinatura. Atualiza o status do
// documento e notifica o especialista, depois redireciona o cliente de
// volta para a tela de confirmação no app.
export async function handleCaseDocGovBrCallback(req, res) {
  const token = String(req.query?.state || req.body?.state || '');
  const { db, FieldValue } = await getAdminResources();
  const docSnap = await findDocumentByToken(db, token);
  if (!docSnap) {
    return res.redirect(302, `${getAppBaseUrl()}/assinatura/${encodeURIComponent(token)}?status=error`);
  }

  const data = docSnap.data();

  // TODO(integração Gov.br): validar aqui a assinatura/autenticidade do
  // retorno (ex.: verificar um JWT/assertion assinado pelo Gov.br) antes de
  // confiar no callback, e obter a URL real do documento assinado (PAdES)
  // para salvar em `signedUrl`. Por ora, mantemos um placeholder.
  const signedUrlPlaceholder = data.originalUrl;

  try {
    await docSnap.ref.update({
      status: 'signed',
      signedUrl: signedUrlPlaceholder,
      signedAt: FieldValue.serverTimestamp(),
      signedByUserId: data.workerUid || null,
    });
  } catch (err) {
    console.error('[case-documents] Falha ao atualizar documento assinado:', err?.message || err);
  }

  // Notifica o especialista (sino + e-mail best-effort).
  const specialistId = docSnap.ref.parent.parent.parent.parent.id; // .../apoiadores/{specialistId}/cases/{caseId}/documentsForSignature/{docId}
  try {
    const apoiadorSnap = await db.collection('apoiadores').doc(specialistId).get();
    const apoiador = apoiadorSnap.exists ? apoiadorSnap.data() : {};
    const specialistUid = apoiador?.uid || specialistId;

    await db.collection('notifications').add({
      toUid: specialistUid,
      fromUid: data.workerUid || '',
      type: 'documentSignature',
      message: `O documento "${data.documentTitle}" foi assinado pelo cliente`,
      link: `${getAppBaseUrl()}/especialista/advogado/caso/${docSnap.ref.parent.parent.id}`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const resendKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    const specialistEmail = apoiador?.email || (await resolveEmail(db, 'users', specialistUid));
    if (resendKey && fromAddress && specialistEmail) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: fromAddress,
        to: specialistEmail,
        subject: `Documento assinado — ${data.documentTitle}`,
        html: `<p>O documento <strong>${escapeHtml(data.documentTitle)}</strong> foi assinado pelo cliente via Gov.br.</p>`,
        text: `O documento "${data.documentTitle}" foi assinado pelo cliente via Gov.br.`,
      });
    }
  } catch (err) {
    console.warn('[case-documents] Falha ao notificar especialista:', err?.message || err);
  }

  return res.redirect(302, `${getAppBaseUrl()}/assinatura/${encodeURIComponent(token)}?status=signed`);
}
