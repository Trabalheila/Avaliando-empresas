import Stripe from "stripe";

function getAppOrigin(req) {
  const headerOrigin = req.headers.origin;
  if (headerOrigin) return headerOrigin;

  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

function normalizeCompanySlug(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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

  const { cnpj, companySlug, companyName } = req.body || {};
  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");
  const hasValidCnpj = cleanedCnpj.length === 14;
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const normalizedCompanyName = (companyName || "").toString().trim();

  if (!hasValidCnpj && !normalizedCompanySlug) {
    return res.status(400).json({ error: "Informe CNPJ valido ou companySlug para vincular o checkout." });
  }

  if (!process.env.STRIPE_PRICE_ID_PREMIUM) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID_PREMIUM nao configurado." });
  }

  const origin = getAppOrigin(req);

  try {
    const clientReferenceId = hasValidCnpj
      ? cleanedCnpj
      : `slug:${normalizedCompanySlug}`;

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
      client_reference_id: clientReferenceId,
      metadata: {
        cnpj: hasValidCnpj ? cleanedCnpj : "",
        companySlug: normalizedCompanySlug || "",
        companyName: normalizedCompanyName || "",
      },
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error("Erro create-checkout-session:", err);
    const stripeMessage = err?.raw?.message || err?.message || "Falha ao criar sessao de checkout.";
    return res.status(500).json({ error: `Falha ao criar sessao de checkout: ${stripeMessage}` });
  }
}
