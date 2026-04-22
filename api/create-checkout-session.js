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


async function createMercadoPagoCheckout({ req, cnpj, companySlug, companyName, audience, paymentMethod, apoiadorId }) {
  const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").toString().trim();
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
  }

  const appOrigin = getAppOrigin(req);
  const serverBase = getServerBaseUrl(req);
  const externalReference = cnpj ? cnpj : `slug:${companySlug}`;

  const isEmployer = audience === "employer";
  const planLabel = isEmployer ? "Empresa" : "Trabalhador";
  const transactionAmount = isEmployer ? 1499.90 : 29.90;
  const frequency = 1;
  const frequencyType = "months";

  const notificationParams = new URLSearchParams({
    provider: "mercadopago",
    cnpj: cnpj || "",
    companySlug: companySlug || "",
    audience,
    apoiadorId: apoiadorId || "",
  });

  const payload = {
    reason: `Plano ${planLabel} Premium - Trabalhei La`,
    auto_recurring: {
      frequency,
      frequency_type: frequencyType,
      transaction_amount: transactionAmount,
      currency_id: "BRL",
    },
    back_url: `${appOrigin}/?billing=success`,
    external_reference: externalReference,
    notification_url: `${serverBase}/api/webhook?${notificationParams.toString()}`,
  };

  const response = await fetch("https://api.mercadopago.com/preapproval_plan", {
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
    const message = json?.message || json?.cause?.[0]?.description || "Falha ao criar plano de assinatura no Mercado Pago.";
    throw new Error(message);
  }

  const checkoutUrl = json?.init_point;
  if (!checkoutUrl) {
    throw new Error("Resposta do Mercado Pago invalida: init_point ausente.");
  }

  return {
    provider: "mercadopago",
    redirectMode: "url",
    checkoutUrl,
    planId: json?.id || null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cnpj, companySlug, companyName, audience, paymentMethod, apoiadorId } = req.body || {};
  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");
  const hasValidCnpj = cleanedCnpj.length === 14;
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const normalizedCompanyName = (companyName || "").toString().trim();
  const normalizedAudience = ["worker", "employer", "supporter"].includes(audience) ? audience : "worker";
  const normalizedPaymentMethod = paymentMethod === "pix" ? "pix" : "card";
  const cleanedApoiadorId = (apoiadorId || "").toString().trim();

  if (!hasValidCnpj && !normalizedCompanySlug && !cleanedApoiadorId) {
    return res.status(400).json({ error: "Informe CNPJ valido, companySlug ou apoiadorId para vincular o checkout." });
  }

  try {
    const checkoutPayload = await createMercadoPagoCheckout({
      req,
      cnpj: hasValidCnpj ? cleanedCnpj : "",
      companySlug: normalizedCompanySlug,
      companyName: normalizedCompanyName,
      audience: normalizedAudience,
      paymentMethod: normalizedPaymentMethod,
      apoiadorId: cleanedApoiadorId,
    });
    return res.status(200).json(checkoutPayload);
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Falha ao iniciar checkout Mercado Pago." });
  }
}
