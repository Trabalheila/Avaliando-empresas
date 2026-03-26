const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

/**
 * Cloud Function: webhookStripe
 * Escuta checkout.session.completed, pega o client_reference_id (CNPJ)
 * e atualiza /empresas/{CNPJ} com isPremium=true e dataExpiracao.
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
    const cnpj = (session.client_reference_id || session.metadata?.cnpj || "")
      .toString()
      .replace(/\D/g, "");

    if (!cnpj || cnpj.length !== 14) {
      logger.warn("checkout.session.completed sem CNPJ valido", { sessionId: session.id });
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

    const empresaRef = db.collection("empresas").doc(cnpj);
    await empresaRef.set(
      {
        isPremium: true,
        dataExpiracao,
        stripe: {
          checkoutSessionId: session.id,
          customerId: session.customer || null,
          subscriptionId: session.subscription || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    logger.info("Empresa atualizada para premium", { cnpj, sessionId: session.id });
  }

  return res.status(200).json({ received: true });
});
