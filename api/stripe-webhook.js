import Stripe from "stripe";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 30,
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function ensureAdmin() {
  if (getApps().length) return;

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Stripe webhook (Vercel API Route)
 * Evento alvo: checkout.session.completed
 * Referencia: client_reference_id = CNPJ
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET nao configurado." });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature" });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature invalida: ${err.message}` });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const session = event.data.object;
    const cnpj = (session?.client_reference_id || session?.metadata?.cnpj || "")
      .toString()
      .replace(/\D/g, "");

    if (cnpj.length !== 14) {
      return res.status(200).json({ received: true, ignored: true, reason: "cnpj_invalido" });
    }

    let dataExpiracao = null;
    if (session?.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription.toString());
      if (subscription?.current_period_end) {
        dataExpiracao = Timestamp.fromDate(new Date(subscription.current_period_end * 1000));
      }
    }

    ensureAdmin();
    const db = getFirestore();

    await db.collection("empresas").doc(cnpj).set(
      {
        isPremium: true,
        dataExpiracao,
        stripe: {
          checkoutSessionId: session.id,
          customerId: session.customer || null,
          subscriptionId: session.subscription || null,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    return res.status(200).json({ received: true, cnpj, isPremium: true });
  } catch (err) {
    console.error("Erro no webhook Stripe:", err);
    return res.status(500).json({ error: "Falha ao processar webhook." });
  }
}
