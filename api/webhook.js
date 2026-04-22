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
  const token = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").toString().trim();
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
  }
  return token;
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
        const hasCredentials =
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY;

        if (!hasCredentials) {
          throw new Error("Credenciais FIREBASE_* nao configuradas no ambiente da Vercel.");
        }

        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
          }),
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

  return handleMercadoPagoWebhook(req, res);
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
      return res.status(200).json({ received: true, updated: true });
    }

    const paymentId = getMercadoPagoPaymentId(req);
    if (!paymentId) {
      return res.status(200).json({ received: true, ignored: true, reason: "missing_payment_id" });
    }

    const payment = await fetchMercadoPagoPayment(paymentId);
    if ((payment?.status || "").toString().toLowerCase() !== "approved") {
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

    return res.status(200).json({ received: true, updated: true, provider: "mercadopago" });
  } catch (err) {
    console.error("Erro ao processar webhook Mercado Pago", err);
    return res.status(500).json({ error: err?.message || "Falha ao processar webhook Mercado Pago" });
  }
}
