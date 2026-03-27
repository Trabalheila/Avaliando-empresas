import Stripe from "stripe";

function getAppOrigin(req) {
  const headerOrigin = req.headers.origin;
  if (headerOrigin) return headerOrigin;

  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "STRIPE_SECRET_KEY nao configurado." });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  const { cnpj } = req.body || {};
  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");

  if (cleanedCnpj.length !== 14) {
    return res.status(400).json({ error: "CNPJ invalido." });
  }

  if (!process.env.STRIPE_PRICE_ID_PREMIUM) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID_PREMIUM nao configurado." });
  }

  const origin = getAppOrigin(req);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_PREMIUM,
          quantity: 1,
        },
      ],
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
      client_reference_id: cleanedCnpj,
      metadata: {
        cnpj: cleanedCnpj,
      },
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error("Erro create-checkout-session:", err);
    const stripeMessage = err?.raw?.message || err?.message || "Falha ao criar sessao de checkout.";
    return res.status(500).json({ error: `Falha ao criar sessao de checkout: ${stripeMessage}` });
  }
}
