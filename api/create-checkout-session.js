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


async function createMercadoPagoCheckout({ req, cnpj, companySlug, companyName, audience, tier, paymentMethod, apoiadorId }) {
  const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").toString().trim();
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
  }

  const appOrigin = getAppOrigin(req);
  const serverBase = getServerBaseUrl(req);
  // MP rejeita caracteres especiais (ex: ':') em external_reference.
  // Mantemos apenas [a-zA-Z0-9_-] e usamos prefixo 'slug-' em vez de 'slug:'.
  const rawExternalRef = cnpj ? cnpj : `slug-${companySlug}`;
  const externalReference = rawExternalRef.toString().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 250);

  // Mapeamento tier -> preco + nome do plano + variavel de preapproval_plan_id pre-criado.
  // Se a variavel de ambiente correspondente estiver definida, o checkout usa o
  // preapproval_plan_id ja existente em vez de criar um novo plano dinamicamente.
  const PLAN_MATRIX = {
    worker: {
      essential: {
        amount: 29.90,
        reason: "Plano Trabalhador Essencial - Trabalhei La",
        envPlanId: "MP_PLAN_WORKER_ESSENTIAL",
      },
      premium: {
        amount: 79.90,
        reason: "Plano Premium Trabalhador - Trabalhei La",
        envPlanId: "MP_PLAN_WORKER_PREMIUM",
      },
    },
    supporter: {
      essential: {
        amount: 199.90,
        reason: "Apoiador Essencial - Trabalhei La",
        envPlanId: "MP_PLAN_SUPPORTER_ESSENTIAL",
      },
      premium: {
        amount: 399.90,
        reason: "Apoiador Premium - Trabalhei La",
        envPlanId: "MP_PLAN_SUPPORTER_PREMIUM",
      },
    },
    employer: {
      essential: {
        amount: 1499.90,
        reason: "Plano Empresa Fundador - Trabalhei La",
        envPlanId: "MP_PLAN_EMPLOYER_ESSENTIAL",
      },
      premium: {
        amount: 1499.90,
        reason: "Plano Empresa Fundador - Trabalhei La",
        envPlanId: "MP_PLAN_EMPLOYER_ESSENTIAL",
      },
    },
  };

  const planConfig = PLAN_MATRIX[audience]?.[tier] || PLAN_MATRIX.worker.essential;
  const transactionAmount = planConfig.amount;
  const planReason = planConfig.reason;
  const rawPreapprovalPlanId = (process.env[planConfig.envPlanId] || "").toString().trim();
  // Valida o preapproval_plan_id: o ID real do Mercado Pago é um hash
  // alfanumérico longo. Descarta valores claramente inválidos (placeholders
  // como "preapproval_plan_id", "YOUR_PLAN_ID", strings curtas, etc.) para
  // que o backend caia automaticamente no fluxo dinâmico (Caminho 2) em vez
  // de propagar o erro "The template with id X does not exist" do MP.
  const looksLikePlaceholder =
    !rawPreapprovalPlanId ||
    rawPreapprovalPlanId.length < 16 ||
    /^(preapproval_plan_id|your_plan_id|plan_id|todo|changeme|xxx+)$/i.test(rawPreapprovalPlanId) ||
    !/^[a-zA-Z0-9_-]+$/.test(rawPreapprovalPlanId);
  const preapprovalPlanId = looksLikePlaceholder ? "" : rawPreapprovalPlanId;
  if (rawPreapprovalPlanId && looksLikePlaceholder) {
    console.warn(
      `[create-checkout-session] ${planConfig.envPlanId} parece ser placeholder ("${rawPreapprovalPlanId}"); usando criação dinâmica.`
    );
  }

  // notification_url: omitir params vazios para evitar payload "sujo" rejeitado pelo MP.
  const notifEntries = {
    provider: "mercadopago",
    cnpj: cnpj || "",
    companySlug: companySlug || "",
    audience,
    tier,
    apoiadorId: apoiadorId || "",
  };
  const notificationParams = new URLSearchParams();
  Object.entries(notifEntries).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length > 0) {
      notificationParams.set(k, String(v));
    }
  });

  // Caminho 1: usar preapproval_plan_id pre-cadastrado no Mercado Pago.
  if (preapprovalPlanId) {
    const subscriptionPayload = {
      preapproval_plan_id: preapprovalPlanId,
      external_reference: externalReference,
      back_url: `${appOrigin}/?billing=success`,
      notification_url: `${serverBase}/api/webhook?${notificationParams.toString()}`,
    };

    const response = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(subscriptionPayload),
    });

    const responseText = await response.text();
    let json;
    try {
      json = responseText ? JSON.parse(responseText) : {};
    } catch {
      json = {};
    }

    if (!response.ok) {
      const message = json?.message || json?.cause?.[0]?.description || "Falha ao criar assinatura no Mercado Pago.";
      const isTemplateMissing =
        /template with id .* does not exist/i.test(message) ||
        /preapproval_plan.*not.*(exist|found)/i.test(message);
      if (isTemplateMissing) {
        console.warn(
          `[create-checkout-session] preapproval_plan_id "${preapprovalPlanId}" não existe na conta MP. Caindo no fluxo dinâmico.`
        );
        // Não lança: deixa o código abaixo (Caminho 2) executar.
      } else {
        throw new Error(message);
      }
    } else {
      const checkoutUrl = json?.init_point;
      if (!checkoutUrl) {
        throw new Error("Resposta do Mercado Pago invalida: init_point ausente.");
      }
      return {
        provider: "mercadopago",
        redirectMode: "url",
        checkoutUrl,
        planId: preapprovalPlanId,
      };
    }
  }

  // Caminho 2: criar plano dinamicamente (fallback).
  const frequency = 1;
  const frequencyType = "months";

  const payload = {
    reason: planReason,
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

  console.log("[create-checkout-session] MP preapproval_plan payload:", JSON.stringify(payload));
  console.log("[create-checkout-session] appOrigin=", appOrigin, "serverBase=", serverBase);

  const response = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log("[create-checkout-session] MP preapproval_plan status=", response.status, "body=", responseText);
  let json;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    console.error("[create-checkout-session] MP rejeitou. message=", json?.message, "cause=", JSON.stringify(json?.cause));
    const causeDesc = Array.isArray(json?.cause) && json.cause[0]?.description ? ` (${json.cause[0].description})` : "";
    const message = (json?.message ? json.message : "Falha ao criar plano de assinatura no Mercado Pago.") + causeDesc;
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

/**
 * Cria uma `preference` (one-shot) no Mercado Pago para uma consulta
 * avulsa entre trabalhador Premium e Apoiador. Usa `marketplace_fee`
 * para o split (10% essential / 12.5% premium) — funcional quando o
 * MERCADO_PAGO_ACCESS_TOKEN é de uma conta com marketplace habilitado;
 * sem isso, o pagamento é processado normalmente e o split deve ser
 * reconciliado manualmente.
 */
async function createConsultationPreference({ req, apoiadorId, apoiadorNome, tier, amount, workerId, especialidade, requesterAudience }) {
  const accessToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").toString().trim();
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN nao configurado.");
  }
  if (!apoiadorId) {
    throw new Error("apoiadorId é obrigatório para a consulta.");
  }

  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    throw new Error("Valor da consulta inválido.");
  }

  const feePct = tier === "premium" ? 0.125 : 0.1;
  const marketplaceFee = Number((safeAmount * feePct).toFixed(2));

  const appOrigin = getAppOrigin(req);
  const serverBase = getServerBaseUrl(req);

  const notificationParams = new URLSearchParams({
    provider: "mercadopago",
    kind: "consultation",
    apoiadorId,
    tier,
    workerId: workerId || "",
    requesterAudience: requesterAudience === "employer" ? "employer" : "worker",
  });

  const preferencePayload = {
    items: [
      {
        title: `Consulta — ${apoiadorNome || especialidade || "Apoiador"}`,
        description: especialidade
          ? `Consulta intermediada — ${especialidade}`
          : "Consulta intermediada via Trabalhei Lá",
        quantity: 1,
        unit_price: safeAmount,
        currency_id: "BRL",
      },
    ],
    marketplace_fee: marketplaceFee,
    external_reference: `consulta:${apoiadorId}:${workerId || "anon"}:${Date.now()}`,
    back_urls: {
      success: `${appOrigin}/apoiadores/perfil/${encodeURIComponent(apoiadorId)}?consulta=success`,
      failure: `${appOrigin}/apoiadores/perfil/${encodeURIComponent(apoiadorId)}?consulta=failure`,
      pending: `${appOrigin}/apoiadores/perfil/${encodeURIComponent(apoiadorId)}?consulta=pending`,
    },
    auto_return: "approved",
    notification_url: `${serverBase}/api/webhook?${notificationParams.toString()}`,
    metadata: {
      kind: "consultation",
      apoiadorId,
      tier,
      workerId: workerId || null,
      especialidade: especialidade || null,
      requesterAudience: requesterAudience === "employer" ? "employer" : "worker",
      feePct,
      marketplaceFee,
    },
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preferencePayload),
  });

  const responseText = await response.text();
  let json;
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = {};
  }

  if (!response.ok) {
    const message = json?.message || json?.cause?.[0]?.description || "Falha ao criar preferência de consulta.";
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
    marketplaceFee,
    amount: safeAmount,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cnpj, companySlug, companyName, audience, tier, paymentMethod, apoiadorId } = req.body || {};

  // Consulta avulsa (one-shot) com split: usa um fluxo diferente da assinatura
  // recorrente. Mantém o mesmo endpoint para reaproveitar a estrutura existente.
  if (String(audience).toLowerCase() === "consultation") {
    try {
      const payload = await createConsultationPreference({
        req,
        apoiadorId: (apoiadorId || "").toString().trim(),
        apoiadorNome: (req.body?.apoiadorNome || "").toString().trim(),
        tier: ["essential", "premium"].includes(tier) ? tier : "essential",
        amount: Number(req.body?.amount),
        workerId: (req.body?.workerId || "").toString().trim(),
        especialidade: (req.body?.especialidade || "").toString().trim(),
        requesterAudience: (req.body?.requesterAudience || "worker").toString().trim(),
      });
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Falha ao iniciar consulta." });
    }
  }

  const cleanedCnpj = (cnpj || "").toString().replace(/\D/g, "");
  const hasValidCnpj = cleanedCnpj.length === 14;
  const normalizedCompanySlug = normalizeCompanySlug(companySlug);
  const normalizedCompanyName = (companyName || "").toString().trim();
  const normalizedAudience = ["worker", "employer", "supporter"].includes(audience) ? audience : "worker";
  const normalizedTier = ["essential", "premium"].includes(tier) ? tier : "essential";
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
      tier: normalizedTier,
      paymentMethod: normalizedPaymentMethod,
      apoiadorId: cleanedApoiadorId,
    });
    return res.status(200).json(checkoutPayload);
  } catch (err) {
    console.error("[create-checkout-session] handler erro:", err?.message, err?.stack);
    return res.status(500).json({ error: err?.message || "Falha ao iniciar checkout Mercado Pago." });
  }
}
