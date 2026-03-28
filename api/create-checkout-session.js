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

  const { cnpj, companySlug, companyName, audience, paymentMethod } = req.body || {};
  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");
  const hasValidCnpj = cleanedCnpj.length === 14;
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const normalizedCompanyName = (companyName || "").toString().trim();
  const normalizedAudience = ["worker", "employer"].includes(audience) ? audience : "worker";
  const normalizedPaymentMethod = paymentMethod === "pix" ? "pix" : "card";

  if (!hasValidCnpj && !normalizedCompanySlug) {
    return res.status(400).json({ error: "Informe CNPJ valido ou companySlug para vincular o checkout." });
  }

  const subscriptionPriceId = process.env.STRIPE_PRICE_ID_PREMIUM;
  const pixPriceId = process.env.STRIPE_PRICE_ID_PREMIUM_PIX;

  if (normalizedPaymentMethod === "card" && !subscriptionPriceId) {
    return res.status(500).json({ error: "STRIPE_PRICE_ID_PREMIUM nao configurado." });
  }

  if (normalizedPaymentMethod === "pix" && !pixPriceId) {
    return res.status(500).json({
      error: "Pagamento via PIX ainda nao configurado. Defina STRIPE_PRICE_ID_PREMIUM_PIX no Vercel.",
    });
  }

  const origin = getAppOrigin(req);

  try {
    const clientReferenceId = hasValidCnpj
      ? cleanedCnpj
      : `slug:${normalizedCompanySlug}`;

    const metadata = {
      cnpj: hasValidCnpj ? cleanedCnpj : "",
      companySlug: normalizedCompanySlug || "",
      companyName: normalizedCompanyName || "",
      audience: normalizedAudience,
      paymentMethod: normalizedPaymentMethod,
      billingMode: normalizedPaymentMethod === "pix" ? "payment_pix" : "subscription_card",
    };

    const sessionPayload = {
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
      client_reference_id: clientReferenceId,
      metadata,
    };

    if (normalizedPaymentMethod === "pix") {
      sessionPayload.mode = "payment";
      sessionPayload.payment_method_types = ["pix"];
      sessionPayload.line_items = [
        {
          price: pixPriceId,
          quantity: 1,
        },
      ];
    } else {
      sessionPayload.mode = "subscription";
      sessionPayload.payment_method_types = ["card"];
      sessionPayload.line_items = [
        {
          price: subscriptionPriceId,
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    return res.status(200).json({
      provider: "stripe",
      redirectMode: "stripe_session",
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Erro create-checkout-session:", err);
    const stripeMessage = err?.raw?.message || err?.message || "Falha ao criar sessao de checkout.";
    return res.status(500).json({ error: `Falha ao criar sessao de checkout: ${stripeMessage}` });
  }
}
