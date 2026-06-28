import { tryEmitNfseForMercadoPagoPayment } from "./_nfse.js";
import { getServiceAccount } from "./_firebaseAdmin.js";

function normalizeCompanySlug(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function normalizeAudience(value) {
  return ["worker", "employer", "supporter"].includes(value) ? value : "worker";
}

function toDigits(value) {
  return (value || "").toString().replace(/\D/g, "");
}

function parseCompanyFromReference(reference) {
  const ref = (reference || "").toString().trim();
  const digits = toDigits(ref);

  if (digits.length === 14) {
    return { cnpj: digits, companySlug: "" };
  }

  if (ref.startsWith("slug:")) {
    return { cnpj: "", companySlug: normalizeCompanySlug(ref.slice(5)) };
  }

  return { cnpj: "", companySlug: normalizeCompanySlug(ref) };
}

function getMercadoPagoAccessToken() {
  const token = (process.env.MERCADOPAGO_ACCESS_TOKEN || "").toString().trim();
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN nao configurado.");
  }
  return token;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Libera o contato do especialista para o trabalhador após o pagamento
 * aprovado de uma consulta.
 *
 * Efeitos (best-effort, nunca lança — apenas loga falhas):
 *   1. Grava users/{workerId}/releasedContacts/{consultaId} com e-mail e
 *      WhatsApp do especialista (para a seção "Contatos Liberados" de Minha
 *      Conta).
 *   2. Envia um e-mail ao trabalhador com esses dados de contato.
 *
 * NÃO expõe contatos em nenhum response HTTP — os dados ficam apenas no
 * documento do próprio usuário (lido sob regra de dono) e no e-mail.
 */
async function releaseSpecialistContact({ db, FieldValue, apoiadorId, workerId, consultaId }) {
  try {
    if (!apoiadorId || !workerId || !consultaId) return;

    const apoiadorSnap = await db.collection("apoiadores").doc(apoiadorId).get();
    const apoiador = apoiadorSnap.exists ? apoiadorSnap.data() || {} : {};
    const especialistaEmail = String(apoiador.email || "").trim();
    const especialistaWhatsapp = String(
      apoiador.whatsapp || apoiador.telefone || ""
    ).trim();
    const apoiadorNome = String(apoiador.nome || apoiador.displayName || "Especialista").trim();
    const especialidade = String(apoiador.tipo || apoiador.profissao || "").trim();

    // 1. Persiste o contato liberado no documento do trabalhador.
    await db
      .collection("users")
      .doc(workerId)
      .collection("releasedContacts")
      .doc(consultaId)
      .set(
        {
          apoiadorId,
          apoiadorNome,
          especialidade: especialidade || null,
          especialistaEmail: especialistaEmail || null,
          especialistaWhatsapp: especialistaWhatsapp || null,
          consultaId,
          releasedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    // 2. Envia o e-mail com os dados de contato ao trabalhador.
    const resendKey = (process.env.RESEND_API_KEY || "").toString().trim();
    const fromAddress = (process.env.EMAIL_FROM_ADDRESS || "").toString().trim();
    if (!resendKey || !fromAddress) {
      console.warn("[webhook] RESEND_API_KEY/EMAIL_FROM_ADDRESS ausente; e-mail de contato não enviado.");
      return;
    }

    const workerSnap = await db.collection("users").doc(workerId).get();
    const workerEmail = workerSnap.exists
      ? String(workerSnap.data()?.email || "").trim().toLowerCase()
      : "";
    if (!workerEmail) {
      console.warn("[webhook] e-mail do trabalhador não encontrado; contato salvo, e-mail não enviado.");
      return;
    }

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    const waDigits = especialistaWhatsapp.replace(/\D/g, "");
    const contactRows = [
      especialistaEmail
        ? `<p style="margin:4px 0;">📧 <strong>E-mail:</strong> <a href="mailto:${escapeHtml(especialistaEmail)}">${escapeHtml(especialistaEmail)}</a></p>`
        : "",
      especialistaWhatsapp
        ? `<p style="margin:4px 0;">📱 <strong>WhatsApp:</strong> <a href="https://wa.me/${waDigits}">${escapeHtml(especialistaWhatsapp)}</a></p>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    await resend.emails.send({
      from: fromAddress,
      to: workerEmail,
      subject: `Contato liberado: ${apoiadorNome}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;">
          <h2 style="color:#1d4ed8;">Pagamento confirmado ✅</h2>
          <p>Sua consulta com <strong>${escapeHtml(apoiadorNome)}</strong> foi confirmada.
          Seguem os dados de contato do especialista:</p>
          <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:16px 0;">
            ${contactRows || "<p>Os dados de contato serão disponibilizados em breve.</p>"}
          </div>
          <p style="font-size:13px;color:#64748b;">Você também pode acessar estes dados a qualquer momento na seção <strong>Contatos Liberados</strong> em Minha Conta.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[webhook] releaseSpecialistContact falhou:", err?.message || err);
  }
}

/**
 * Notifica o especialista por e-mail quando uma "Consulta Especializada"
 * (atendimento premium diferenciado) é paga. Envia os dados de acesso ao
 * atendimento (link da sala) e o resumo do repasse (split): valor bruto, taxa
 * da plataforma e valor líquido a receber na conta Mercado Pago.
 *
 * Best-effort: nunca lança — apenas loga falhas. Não bloqueia o webhook.
 */
async function notifySpecialistEspecializada({
  db,
  apoiadorId,
  consultaId,
  amount,
  marketplaceFee,
  amountDueToSpecialist,
  salaUrl,
  workerNome,
}) {
  try {
    if (!apoiadorId || !consultaId) return;

    const resendKey = (process.env.RESEND_API_KEY || "").toString().trim();
    const fromAddress = (process.env.EMAIL_FROM_ADDRESS || "").toString().trim();
    if (!resendKey || !fromAddress) {
      console.warn("[webhook] RESEND/EMAIL_FROM ausente; e-mail ao especialista (especializada) não enviado.");
      return;
    }

    const apoiadorSnap = await db.collection("apoiadores").doc(apoiadorId).get();
    const apoiador = apoiadorSnap.exists ? apoiadorSnap.data() || {} : {};
    const especialistaEmail = String(apoiador.email || "").trim().toLowerCase();
    const apoiadorNome = String(apoiador.nome || apoiador.displayName || "Especialista").trim();
    const mpEmail = String(apoiador.mercadoPagoEmail || apoiador.mpEmail || "").trim();
    if (!especialistaEmail) {
      console.warn("[webhook] especialista sem e-mail; notificação de Consulta Especializada não enviada.");
      return;
    }

    const fmt = (v) =>
      Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: fromAddress,
      to: especialistaEmail,
      subject: `Nova Consulta Especializada paga — ${fmt(amount)}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;">
          <h2 style="color:#b45309;">Consulta Especializada confirmada 🌟</h2>
          <p>Olá, <strong>${escapeHtml(apoiadorNome)}</strong>! Você recebeu uma nova
          Consulta Especializada${workerNome ? ` de <strong>${escapeHtml(workerNome)}</strong>` : ""}.</p>
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;"><strong>Acesse o atendimento:</strong></p>
            ${salaUrl ? `<p style="margin:4px 0;"><a href="${escapeHtml(salaUrl)}">${escapeHtml(salaUrl)}</a></p>` : "<p style=\"margin:4px 0;\">O link da sala estará disponível no seu painel.</p>"}
          </div>
          <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="margin:4px 0;">💰 <strong>Valor pago:</strong> ${fmt(amount)}</p>
            <p style="margin:4px 0;">🏷️ <strong>Taxa da plataforma:</strong> ${fmt(marketplaceFee)}</p>
            <p style="margin:4px 0;">✅ <strong>Você recebe:</strong> ${fmt(amountDueToSpecialist)}</p>
            ${mpEmail ? `<p style="margin:8px 0 4px;font-size:13px;color:#64748b;">Repasse para a conta Mercado Pago: <strong>${escapeHtml(mpEmail)}</strong></p>` : "<p style=\"margin:8px 0 4px;font-size:13px;color:#b91c1c;\">⚠️ Cadastre seu e-mail do Mercado Pago no perfil para receber o repasse.</p>"}
          </div>
          <p style="font-size:13px;color:#64748b;">Você também acompanha esta consulta no seu painel de especialista.</p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("[webhook] notifySpecialistEspecializada falhou:", err?.message || err);
  }
}

let adminResourcesPromise;
async function getAdminResources() {
  if (!adminResourcesPromise) {
    adminResourcesPromise = (async () => {
      const adminApp = await import("firebase-admin/app");
      const adminFirestore = await import("firebase-admin/firestore");

      const { initializeApp, getApps, cert } = adminApp;
      const { getFirestore, FieldValue, Timestamp } = adminFirestore;

      if (!getApps().length) {
        const serviceAccount = getServiceAccount();

        if (!serviceAccount) {
          throw new Error("FIREBASE_SERVICE_ACCOUNT nao configurada ou invalida no ambiente da Vercel.");
        }

        initializeApp({
          credential: cert(serviceAccount),
        });
      }

      return {
        db: getFirestore(),
        FieldValue,
        Timestamp,
      };
    })();
  }

  return adminResourcesPromise;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Modo manual de teste de emissao NFS-e (sem passar pelo Mercado Pago).
  // Acionado via querystring ?nfse_test=1&key=<NFSE_TEST_KEY>.
  // Protegido por env NFSE_TEST_KEY: se a env nao existir, o modo nao responde.
  if (req.query?.nfse_test === "1" || req.query?.nfse_test === "true") {
    return handleNfseManualTest(req, res);
  }

  return handleMercadoPagoWebhook(req, res);
}

async function handleNfseManualTest(req, res) {
  const expectedKey = (process.env.NFSE_TEST_KEY || "").trim();
  if (!expectedKey) {
    return res.status(404).json({ error: "Not found" });
  }
  const providedKey = (req.query?.key || req.headers?.["x-nfse-test-key"] || "")
    .toString()
    .trim();
  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const amount = Number(body.amount || 1.0);
  const descricao = (body.descricao || "Teste manual de emissao NFS-e").toString();
  const payerEmail = (body.payerEmail || "teste@trabalheila.com.br").toString();
  const payerName = (body.payerName || "Cliente Teste").toString();
  const payerDocument = (body.payerDocument || "").toString();
  const ref = (body.ref || `manual_${Date.now()}`).toString();

  const fakePayment = {
    id: ref,
    transaction_amount: amount,
    payer: {
      email: payerEmail,
      first_name: payerName,
      identification: payerDocument ? { number: payerDocument } : undefined,
    },
  };

  let db = null;
  let FieldValue = null;
  try {
    ({ db, FieldValue } = await getAdminResources());
  } catch (err) {
    console.warn("[nfse-test] firebase indisponivel, seguindo sem persistir:", err?.message);
  }

  try {
    const result = await tryEmitNfseForMercadoPagoPayment({
      payment: fakePayment,
      cnpj: null,
      companySlug: "teste-manual",
      apoiadorId: null,
      audience: "test",
      descricao,
      db,
      FieldValue,
      force: true,
    });
    return res.status(200).json({
      ref: `mp_${ref}`,
      sentTo: (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase(),
      result,
    });
  } catch (err) {
    console.error("[nfse-test] erro inesperado", err);
    return res.status(500).json({ error: err?.message || "erro inesperado" });
  }
}

function getMercadoPagoPaymentId(req) {
  const queryDataId = req.query?.["data.id"];
  const queryId = req.query?.id;
  const bodyDataId = req.body?.data?.id;
  const bodyId = req.body?.id;

  const selected = queryDataId || bodyDataId || queryId || bodyId || "";
  const digits = toDigits(selected);
  return digits || "";
}

function getMercadoPagoNotificationType(req) {
  const values = [
    req.query?.type,
    req.query?.topic,
    req.body?.type,
    req.body?.action,
  ];

  return values
    .map((value) => (value || "").toString().trim().toLowerCase())
    .find(Boolean) || "";
}

function mapMercadoPagoMethod(paymentMethodId) {
  if ((paymentMethodId || "").toString().toLowerCase() === "pix") return "pix";
  return "card";
}

async function fetchMercadoPagoPayment(paymentId) {
  const token = getMercadoPagoAccessToken();
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const responseText = await response.text();
  let json;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message = json?.message || "Falha ao consultar pagamento no Mercado Pago.";
    throw new Error(message);
  }

  return json;
}

async function fetchMercadoPagoPreapproval(preapprovalId) {
  const token = getMercadoPagoAccessToken();
  const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const responseText = await response.text();
  let json;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message = json?.message || "Falha ao consultar assinatura no Mercado Pago.";
    throw new Error(message);
  }

  return json;
}

async function handleMercadoPagoWebhook(req, res) {
  try {
    const notificationType = getMercadoPagoNotificationType(req);
    const isPayment = !notificationType || notificationType === "payment" || notificationType.startsWith("payment.");
    const isSubscription = notificationType.startsWith("subscription");

    if (!isPayment && !isSubscription) {
      return res.status(200).json({ received: true, ignored: true, reason: "unsupported_notification_type" });
    }

    // Contexto da notification_url (passado na criacao do plano)
    const qCnpj = toDigits(req.query?.cnpj || "");
    const qCompanySlug = normalizeCompanySlug(req.query?.companySlug || "");
    const qAudience = normalizeAudience((req.query?.audience || "").toString());
    const qAudienceRaw = (req.query?.audience || "").toString().trim().toLowerCase();
    const qApoiadorId = (req.query?.apoiadorId || "").toString().trim();

    if (isSubscription) {
      const preapprovalId = (req.query?.["data.id"] || req.body?.data?.id || req.query?.id || req.body?.id || "").toString().trim();
      if (!preapprovalId) {
        return res.status(200).json({ received: true, ignored: true, reason: "missing_preapproval_id" });
      }

      const preapproval = await fetchMercadoPagoPreapproval(preapprovalId);
      const preapprovalStatus = (preapproval?.status || "").toString().toLowerCase();

      if (preapprovalStatus !== "authorized") {
        return res.status(200).json({ received: true, ignored: true, reason: "subscription_not_authorized" });
      }

      // Assinatura Premium do trabalhador: ativa o plano em users/{workerId}.
      if (qAudienceRaw === "worker_premium") {
        const externalRefWorker = (preapproval?.external_reference || "").toString();
        const refWorkerId = externalRefWorker.startsWith("worker_premium:")
          ? (externalRefWorker.split(":")[1] || "").trim()
          : "";
        const workerId = (req.query?.workerId || "").toString().trim() || refWorkerId;
        if (!workerId) {
          return res.status(200).json({ received: true, ignored: true, reason: "missing_worker_id" });
        }

        const { db, FieldValue, Timestamp } = await getAdminResources();
        const premiumExpiraEm = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

        await db.collection("users").doc(workerId).set(
          {
            plano: "premium",
            premiumAtivadoEm: FieldValue.serverTimestamp(),
            premiumExpiraEm,
            billing: {
              provider: "mercadopago",
              preapprovalId: preapproval.id || null,
              planId: preapproval.preapproval_plan_id || null,
              status: preapproval.status || null,
              payerEmail: preapproval?.payer_email || null,
              audience: "worker_premium",
              billingMode: "subscription_recurring",
              updatedAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );

        return res.status(200).json({ received: true, updated: true, audience: "worker_premium" });
      }

      const fromReference = parseCompanyFromReference(preapproval?.external_reference || "");
      const cnpj = qCnpj.length === 14 ? qCnpj : fromReference.cnpj;
      const companySlug = qCompanySlug || fromReference.companySlug;
      const audience = qAudience;
      const apoiadorId = qApoiadorId;

      if (!cnpj && !companySlug && !apoiadorId) {
        return res.status(200).json({ received: true, ignored: true, reason: "missing_company_reference" });
      }

      const { db, FieldValue, Timestamp } = await getAdminResources();
      const isAnnual = audience === "employer";
      const expirationMs = isAnnual ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
      const dataExpiracao = Timestamp.fromDate(new Date(Date.now() + expirationMs));

      const billingData = {
        provider: "mercadopago",
        preapprovalId: preapproval.id || null,
        planId: preapproval.preapproval_plan_id || null,
        status: preapproval.status || null,
        payerEmail: preapproval?.payer_email || null,
        cnpj: cnpj || null,
        companySlug: companySlug || null,
        audience,
        billingMode: "subscription_recurring",
        updatedAt: FieldValue.serverTimestamp(),
      };

      const writes = [];

      if (audience === "supporter" && apoiadorId) {
        writes.push(db.collection("apoiadores").doc(apoiadorId).set({ plano: "premium", dataExpiracao, billing: billingData, mercadopago: billingData }, { merge: true }));
      }
      if (cnpj) {
        writes.push(db.collection("empresas").doc(cnpj).set({ isPremium: true, dataExpiracao, billing: billingData, mercadopago: billingData }, { merge: true }));
      }
      if (companySlug && audience !== "supporter") {
        writes.push(db.collection("companies").doc(companySlug).set({ slug: companySlug, isPremium: true, dataExpiracao, billing: billingData, mercadopago: billingData }, { merge: true }));
      }

      await Promise.all(writes);

      // Emissao automatica de NFS-e (best-effort). A primeira fatura do plano
      // chega via webhook payment.updated; aqui, na confirmacao da assinatura,
      // ja tentamos emitir caso o valor venha exposto no preapproval.
      try {
        const recurringAmount = Number(preapproval?.auto_recurring?.transaction_amount || 0);
        if (recurringAmount > 0) {
          const fakePayment = {
            id: preapproval.id,
            transaction_amount: recurringAmount,
            payer: { email: preapproval?.payer_email || null },
          };
          await tryEmitNfseForMercadoPagoPayment({
            payment: fakePayment,
            cnpj,
            companySlug,
            apoiadorId,
            audience,
            descricao: `Assinatura Trabalhei La (preapproval ${preapproval.id})`,
            db,
            FieldValue,
          });
        }
      } catch (nfseErr) {
        console.warn("[webhook] Falha NFS-e (subscription, ignorada):", nfseErr?.message || nfseErr);
      }

      return res.status(200).json({ received: true, updated: true });
    }

    const paymentId = getMercadoPagoPaymentId(req);
    if (!paymentId) {
      return res.status(200).json({ received: true, ignored: true, reason: "missing_payment_id" });
    }

    const payment = await fetchMercadoPagoPayment(paymentId);
    const paymentStatus = (payment?.status || "").toString().toLowerCase();

    /* ──────────────────────────────────────────────────────────
       Consultas intermediadas (split): kind=consultation
       external_reference: consulta:<apoiadorId>:<workerId>:<timestamp>

       Tratado ANTES do guard genérico de "approved" porque o PIX é
       assíncrono: a primeira notificação chega como `pending` (QR Code
       gerado) e só depois como `approved` (após o pagador concluir o PIX).
       A consulta é registrada exclusivamente na APROVAÇÃO — nunca antes —
       de modo que o especialista jamais veja uma solicitação não paga.
       ────────────────────────────────────────────────────────── */
    const qKind = (req.query?.kind || "").toString().toLowerCase();
    const externalRef = (payment?.external_reference || "").toString();
    if (qKind === "consultation" || externalRef.startsWith("consulta:")) {
      // PIX/boleto pendente (ou em processamento): apenas confirma o
      // recebimento do webhook. Não cria a consulta e aguarda a próxima
      // notificação (`payment.updated`) com status `approved`.
      if (paymentStatus !== "approved") {
        const pendingLike = ["pending", "in_process", "in_mediation", "authorized"].includes(paymentStatus);
        return res.status(200).json({
          received: true,
          ignored: true,
          kind: "consultation",
          status: paymentStatus || "unknown",
          reason: pendingLike ? "consultation_awaiting_payment" : "consultation_not_approved",
        });
      }

      const parts = externalRef.split(":");
      const apoiadorIdConsulta = (parts[1] || "").trim();
      const workerIdConsulta = (parts[2] || "").trim();
      if (!apoiadorIdConsulta || !workerIdConsulta) {
        return res.status(200).json({ received: true, ignored: true, reason: "missing_consultation_reference" });
      }
      const { db, FieldValue } = await getAdminResources();
      const meta = payment?.metadata || {};
      const amount = Number(payment.transaction_amount) || 0;
      const tier = (meta.tier || req.query?.tier || "essential").toString();
      const requesterAudience =
        (meta.requesterAudience || req.query?.requesterAudience || "worker").toString() === "employer"
          ? "employer"
          : "worker";
      const feePct = tier === "premium" ? 0.125 : 0.10;
      const marketplaceFee = Number((amount * feePct).toFixed(2));
      const modalidade = (meta.modalidade || "").toString() === "video" ? "video" : "chat";
      const message = (meta.message || "").toString();
      const originalAmount = Number(meta.originalAmount);
      const discountApplied = Number(meta.discountAmount);
      // Meio de pagamento usado (ex.: "pix", "visa", "bolbradesco") — útil
      // para auditoria/relatório no painel do especialista.
      const paymentMethod = mapMercadoPagoMethod(payment?.payment_method_id || "");
      // Comissao exibida ao especialista (snapshot). Mantemos a mesma
      // referencia de split aplicada na preferencia (feePct).
      const platformCommission = marketplaceFee;
      const amountDueToSpecialist = Number((amount - marketplaceFee).toFixed(2));
      // Tipo da consulta: "especializada" (atendimento premium diferenciado)
      // ou "comum". Define se o especialista recebe a notificação dedicada.
      const consultationType =
        (meta.consultationType || "").toString().toLowerCase() === "especializada"
          ? "especializada"
          : "comum";
      const salaUrl =
        modalidade === "video"
          ? `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/sala-video/${apoiadorIdConsulta}_${workerIdConsulta}_${payment.id}`
          : `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/chat/${apoiadorIdConsulta}_${workerIdConsulta}_${payment.id}`;
      const consultaDoc = {
        apoiadorId: apoiadorIdConsulta,
        apoiadorNome: (meta.apoiadorNome || "").toString() || null,
        workerId: workerIdConsulta,
        workerNome: (meta.workerNome || "").toString() || null,
        requesterAudience,
        // Tipo/modalidade da consulta avulsa (compat. com painel do especialista).
        tipo: "avulsa",
        type: "avulsa",
        consultationType,
        modalidade,
        message: message || null,
        amount,
        originalAmount: Number.isFinite(originalAmount) ? originalAmount : amount,
        discountApplied: Number.isFinite(discountApplied) ? discountApplied : 0,
        platformCommission,
        amountDueToSpecialist,
        marketplaceFee,
        tier,
        especialidade: (meta.especialidade || "").toString() || null,
        provider: "mercadopago",
        gateway: "mercadopago",
        paymentId: payment.id || null,
        gateway_payment_id: payment.id || null,
        paymentMethod,
        paymentMethodId: payment?.payment_method_id || null,
        payerEmail: payment?.payer?.email || null,
        status: "approved",
        paymentStatus: "paid",
        readByApoiador: false,
        // Sala de atendimento liberada apenas apos pagamento aprovado.
        ...(modalidade === "video"
          ? { sala_video_url: `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/sala-video/${apoiadorIdConsulta}_${workerIdConsulta}_${payment.id}` }
          : { sala_chat_url: `${(process.env.APP_BASE_URL || "").replace(/\/+$/, "")}/chat/${apoiadorIdConsulta}_${workerIdConsulta}_${payment.id}` }),
        paidAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      };
      const consultaId = `${apoiadorIdConsulta}_${workerIdConsulta}_${payment.id}`;
      await db.collection("consultas").doc(consultaId).set(consultaDoc, { merge: true });

      // Libera o contato do especialista para o trabalhador (salva em
      // users/{workerId}/releasedContacts e envia e-mail). Best-effort: nunca
      // bloqueia a confirmação do webhook.
      await releaseSpecialistContact({
        db,
        FieldValue,
        apoiadorId: apoiadorIdConsulta,
        workerId: workerIdConsulta,
        consultaId,
      });

      // Consulta Especializada: notifica o especialista por e-mail com os dados
      // de acesso e o resumo do repasse (split). Best-effort.
      if (consultationType === "especializada") {
        await notifySpecialistEspecializada({
          db,
          apoiadorId: apoiadorIdConsulta,
          consultaId,
          amount,
          marketplaceFee,
          amountDueToSpecialist,
          salaUrl,
          workerNome: (meta.workerNome || "").toString(),
        });
      }

      return res.status(200).json({ received: true, updated: true, kind: "consultation" });
    }

    // Demais pagamentos (assinatura avulsa de empresa/apoiador) exigem
    // aprovação. PIX pendente para esses fluxos também é ignorado aqui.
    if (paymentStatus !== "approved") {
      return res.status(200).json({ received: true, ignored: true, reason: "payment_not_approved" });
    }

    const metadata = payment?.metadata || {};
    const fromReference = parseCompanyFromReference(payment?.external_reference || "");
    const cnpjFromMetadata = toDigits(metadata.cnpj);
    const cnpj = cnpjFromMetadata.length === 14 ? cnpjFromMetadata : (qCnpj.length === 14 ? qCnpj : fromReference.cnpj);
    const companySlug = normalizeCompanySlug(metadata.companySlug || qCompanySlug || fromReference.companySlug);
    const companyName = (metadata.companyName || "").toString().trim();
    const audience = normalizeAudience((metadata.audience || qAudience || "").toString());
    const apoiadorId = (metadata.apoiador_id || metadata.apoiadorId || qApoiadorId || "").toString().trim();
    const paymentMethod = mapMercadoPagoMethod(payment?.payment_method_id || "");
    const billingMode = paymentMethod === "pix" ? "payment_pix" : "payment_single";

    if (!cnpj && !companySlug && !apoiadorId) {
      return res.status(200).json({ received: true, ignored: true, reason: "missing_company_reference" });
    }

    const { db, FieldValue, Timestamp } = await getAdminResources();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const dataExpiracao = Timestamp.fromDate(new Date(Date.now() + thirtyDaysMs));

    const mercadoPagoData = {
      provider: "mercadopago",
      paymentId: payment.id || null,
      status: payment.status || null,
      statusDetail: payment.status_detail || null,
      paymentMethodId: payment.payment_method_id || null,
      payerEmail: payment?.payer?.email || null,
      transactionAmount: payment.transaction_amount || null,
      currencyId: payment.currency_id || "BRL",
      cnpj: cnpj || null,
      companySlug: companySlug || null,
      audience,
      paymentMethod,
      billingMode,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const writes = [];

    if (audience === "supporter" && apoiadorId) {
      writes.push(
        db.collection("apoiadores").doc(apoiadorId).set(
          {
            plano: "premium",
            dataExpiracao,
            billing: mercadoPagoData,
            mercadopago: mercadoPagoData,
          },
          { merge: true }
        )
      );
    }

    if (cnpj) {
      writes.push(
        db.collection("empresas").doc(cnpj).set(
          {
            isPremium: true,
            dataExpiracao,
            billing: mercadoPagoData,
            mercadopago: mercadoPagoData,
          },
          { merge: true }
        )
      );
    }

    if (companySlug && audience !== "supporter") {
      const companyPayload = {
        slug: companySlug,
        isPremium: true,
        dataExpiracao,
        billing: mercadoPagoData,
        mercadopago: mercadoPagoData,
      };
      if (companyName) {
        companyPayload.name = companyName;
      }

      writes.push(
        db.collection("companies").doc(companySlug).set(companyPayload, { merge: true })
      );
    }

    await Promise.all(writes);

    // Emissao automatica de NFS-e (best-effort). Nao quebra o webhook em caso
    // de falha: o resultado fica persistido em /nfse_emissoes/{ref} para retry.
    try {
      await tryEmitNfseForMercadoPagoPayment({
        payment,
        cnpj,
        companySlug,
        apoiadorId,
        audience,
        descricao: `Assinatura/servico Trabalhei La (pagamento ${payment.id})`,
        db,
        FieldValue,
      });
    } catch (nfseErr) {
      console.warn("[webhook] Falha NFS-e (payment, ignorada):", nfseErr?.message || nfseErr);
    }

    return res.status(200).json({ received: true, updated: true, provider: "mercadopago" });
  } catch (err) {
    console.error("Erro ao processar webhook Mercado Pago", err);
    return res.status(500).json({ error: err?.message || "Falha ao processar webhook Mercado Pago" });
  }
}
