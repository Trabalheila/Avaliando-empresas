const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function normalizeCompanySlug(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Cloud Function: webhookStripe
 * Escuta checkout.session.completed e atualiza premium.
 * Prioriza vinculo por CNPJ e usa companySlug como fallback.
 */
exports.webhookStripe = onRequest({
  cors: false,
  region: "southamerica-east1",
}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing stripe-signature");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error("Invalid webhook signature", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const rawClientReference = (session.client_reference_id || "").toString().trim();
    const metadata = session.metadata || {};

    const cnpjFromReference = rawClientReference
      .toString()
      .replace(/\D/g, "");
    const cnpjFromMetadata = (metadata.cnpj || "")
      .toString()
      .replace(/\D/g, "");
    const cnpj = cnpjFromMetadata.length === 14
      ? cnpjFromMetadata
      : (cnpjFromReference.length === 14 ? cnpjFromReference : "");

    const companySlugFromReference = rawClientReference.startsWith("slug:")
      ? rawClientReference.slice(5)
      : "";
    const companySlug = normalizeCompanySlug(metadata.companySlug || companySlugFromReference);
    const companyName = (metadata.companyName || "").toString().trim();

    if (!cnpj && !companySlug) {
      logger.warn("checkout.session.completed sem vinculo valido", {
        sessionId: session.id,
        rawClientReference,
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    let dataExpiracao = null;

    // Para assinaturas, recupera current_period_end no objeto subscription.
    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription.toString());
        if (subscription?.current_period_end) {
          dataExpiracao = admin.firestore.Timestamp.fromDate(
            new Date(subscription.current_period_end * 1000)
          );
        }
      } catch (err) {
        logger.error("Falha ao recuperar subscription", err);
      }
    }

    const stripeData = {
      checkoutSessionId: session.id,
      customerId: session.customer || null,
      subscriptionId: session.subscription || null,
      cnpj: cnpj || null,
      companySlug: companySlug || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const writes = [];

    if (cnpj) {
      const empresaRef = db.collection("empresas").doc(cnpj);
      writes.push(
        empresaRef.set(
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
      const companyRef = db.collection("companies").doc(companySlug);
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
        companyRef.set(
          companyPayload,
          { merge: true }
        )
      );
    }

    await Promise.all(writes);

    logger.info("Empresa atualizada para premium", {
      cnpj: cnpj || null,
      companySlug: companySlug || null,
      sessionId: session.id,
    });
  }

  return res.status(200).json({ received: true });
});
