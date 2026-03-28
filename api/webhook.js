import Stripe from "stripe";

function normalizeCompanySlug(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length > 0) {
    return Buffer.concat(chunks);
  }

  if (req.body && typeof req.body === "object") {
    return Buffer.from(JSON.stringify(req.body));
  }

  return Buffer.from("");
}

let stripeClient;
function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY nao configurado.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }
  return stripeClient;
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

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET nao configurado." });
  }

  let event;
  const stripe = getStripeClient();

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Invalid webhook signature", err);
    return res.status(400).json({ error: `Webhook Error: ${err?.message || "assinatura invalida"}` });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const { db, FieldValue, Timestamp } = await getAdminResources();
    const session = event.data.object;
    const rawClientReference = (session.client_reference_id || "").toString().trim();
    const metadata = session.metadata || {};

    const cnpjFromReference = rawClientReference.replace(/\D/g, "");
    const cnpjFromMetadata = (metadata.cnpj || "").toString().replace(/\D/g, "");
    const cnpj = cnpjFromMetadata.length === 14
      ? cnpjFromMetadata
      : (cnpjFromReference.length === 14 ? cnpjFromReference : "");

    const companySlugFromReference = rawClientReference.startsWith("slug:")
      ? rawClientReference.slice(5)
      : "";
    const companySlug = normalizeCompanySlug(metadata.companySlug || companySlugFromReference);
    const companyName = (metadata.companyName || "").toString().trim();
    const audience = ["worker", "employer"].includes(metadata.audience)
      ? metadata.audience
      : "worker";
    const paymentMethod = metadata.paymentMethod === "pix" ? "pix" : "card";
    const billingMode = metadata.billingMode === "payment_pix" ? "payment_pix" : "subscription_card";

    if (!cnpj && !companySlug) {
      return res.status(200).json({ received: true, ignored: true });
    }

    let dataExpiracao = null;

    if (session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription.toString());
      if (subscription?.current_period_end) {
        dataExpiracao = Timestamp.fromDate(new Date(subscription.current_period_end * 1000));
      }
    } else if (billingMode === "payment_pix") {
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      dataExpiracao = Timestamp.fromDate(new Date(Date.now() + thirtyDaysMs));
    }

    const stripeData = {
      checkoutSessionId: session.id,
      customerId: session.customer || null,
      subscriptionId: session.subscription || null,
      cnpj: cnpj || null,
      companySlug: companySlug || null,
      audience,
      paymentMethod,
      billingMode,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const writes = [];

    if (cnpj) {
      writes.push(
        db.collection("empresas").doc(cnpj).set(
          {
            isPremium: true,
            dataExpiracao,
            stripe: stripeData,
          },
          { merge: true }
        )
      );
    }

    if (companySlug) {
      const companyPayload = {
        slug: companySlug,
        isPremium: true,
        dataExpiracao,
        stripe: stripeData,
      };
      if (companyName) {
        companyPayload.name = companyName;
      }

      writes.push(
        db.collection("companies").doc(companySlug).set(companyPayload, { merge: true })
      );
    }

    await Promise.all(writes);

    return res.status(200).json({ received: true, updated: true });
  } catch (err) {
    console.error("Erro ao processar webhook", err);
    return res.status(500).json({ error: "Falha ao processar webhook" });
  }
}
