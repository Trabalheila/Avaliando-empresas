function getAppOrigin(req) {
  const headerOrigin = req.headers.origin;
  if (headerOrigin) return headerOrigin;

  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

function getServerBaseUrl(req) {
  const configured = (process.env.APP_BASE_URL || "").toString().trim();
  if (configured) return configured.replace(/\/+$/, "");

  const proto = (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString().split(",")[0].trim();

  if (host) return `${proto}://${host}`;

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

function normalizeProviderValue(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function getCheckoutProvider() {
  const raw = (process.env.CHECKOUT_PROVIDER || "stripe").toString();
  const normalized = normalizeProviderValue(raw);
  return normalized || "stripe";
}

function isMercadoPagoProvider(provider) {
  const normalized = normalizeProviderValue(provider);
  return normalized === "mercadopago" || normalized === "mp";
}

async function createMercadoPagoCheckout({ req, cnpj, companySlug, companyName, audience, paymentMethod }) {
  const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").toString().trim();
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
  }

  const appOrigin = getAppOrigin(req);
  const serverBase = getServerBaseUrl(req);
  const externalReference = cnpj ? cnpj : `slug:${companySlug}`;

  const unitPrice = audience === "employer" ? 1499.9 : audience === "supporter" ? 199.9 : 29.9;
  const planLabel = audience === "employer" ? "Fundador" : audience === "supporter" ? "Apoiador" : "Trabalhador";

  const payload = {
    items: [
      {
        title: `Premium ${planLabel} Trabalhei La - ${companyName || companySlug || "empresa"}`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: unitPrice,
      },
    ],
    back_urls: {
      success: `${appOrigin}/?billing=success`,
      pending: `${appOrigin}/?billing=pending`,
      failure: `${appOrigin}/?billing=cancelled`,
    },
    auto_return: "approved",
    external_reference: externalReference,
    metadata: {
      cnpj: cnpj || "",
      companySlug: companySlug || "",
      companyName: companyName || "",
      audience,
      paymentMethod,
      billingMode: paymentMethod === "pix" ? "payment_pix" : "payment_single",
    },
    notification_url: `${serverBase}/api/webhook?provider=mercadopago`,
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let json;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message = json?.message || json?.cause?.[0]?.description || "Falha ao criar preferencia no Mercado Pago.";
    throw new Error(message);
  }

  const checkoutUrl = json?.init_point || json?.sandbox_init_point;
  if (!checkoutUrl) {
    throw new Error("Resposta do Mercado Pago invalida: init_point ausente.");
  }

  return {
    provider: "mercadopago",
    redirectMode: "url",
    checkoutUrl,
    preferenceId: json?.id || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cnpj, companySlug, companyName, audience, paymentMethod } = req.body || {};
  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");
  const hasValidCnpj = cleanedCnpj.length === 14;
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const normalizedCompanyName = (companyName || "").toString().trim();
  const normalizedAudience = ["worker", "employer", "supporter"].includes(audience) ? audience : "worker";
  const normalizedPaymentMethod = paymentMethod === "pix" ? "pix" : "card";

  if (!hasValidCnpj && !normalizedCompanySlug) {
    return res.status(400).json({ error: "Informe CNPJ valido ou companySlug para vincular o checkout." });
  }

  const provider = getCheckoutProvider();
  if (isMercadoPagoProvider(provider)) {
    try {
      const payload = await createMercadoPagoCheckout({
        req,
        cnpj: hasValidCnpj ? cleanedCnpj : "",
        companySlug: normalizedCompanySlug,
        companyName: normalizedCompanyName,
        audience: normalizedAudience,
        paymentMethod: normalizedPaymentMethod,
      });
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Falha ao iniciar checkout Mercado Pago." });
    }
  }

  // Fluxo Stripe: valida apenas quando provider for Stripe.
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: "STRIPE_SECRET_KEY nao configurado." });
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  const subscriptionPriceId = normalizedAudience === "employer"
    ? process.env.STRIPE_PRICE_COMPANY
    : normalizedAudience === "supporter"
      ? process.env.STRIPE_PRICE_SUPPORT
      : process.env.STRIPE_PRICE_WORKER;
  const pixPriceId = process.env.STRIPE_PRICE_ID_PREMIUM_PIX;

  if (normalizedPaymentMethod === "card" && !subscriptionPriceId) {
    const envName = normalizedAudience === "employer" ? "STRIPE_PRICE_COMPANY" : normalizedAudience === "supporter" ? "STRIPE_PRICE_SUPPORT" : "STRIPE_PRICE_WORKER";
    return res.status(500).json({ error: `${envName} nao configurado.` });
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
