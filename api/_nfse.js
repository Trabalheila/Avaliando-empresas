// api/_nfse.js
// Helper de emissao de NFS-e via Focus NFe (https://focusnfe.com.br).
//
// Por que Focus NFe?
//   - Padroniza a comunicacao com ~5.000 prefeituras (cada uma tem um padrao
//     proprio de NFS-e). Implementar direto seria inviavel.
//   - API REST simples, autenticacao Basic com token, suporta o certificado
//     digital A1 cadastrado no painel deles.
//   - Ambiente de homologacao gratuito para validar antes de ir a producao.
//
// Esta funcao e idempotente: o `ref` enviado para a Focus NFe e o id do
// pagamento Mercado Pago. Reenvios do mesmo `ref` retornam o status atual
// em vez de duplicar.
//
// Em caso de falha NAO lancamos excecao para o chamador: apenas logamos e
// retornamos { ok: false, ... }. A persistencia do status fica a cargo do
// caller (webhook) para que possamos fazer retry manual posteriormente.

const FOCUS_NFE_ENV_URLS = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

function getFocusBaseUrl() {
  const env = (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase();
  return FOCUS_NFE_ENV_URLS[env] || FOCUS_NFE_ENV_URLS.homologacao;
}

function toDigits(value) {
  return (value || "").toString().replace(/\D/g, "");
}

function parsePlatformConfig() {
  const cnpj = toDigits(process.env.PLATFORM_CNPJ);
  return {
    cnpj,
    razaoSocial: (process.env.PLATFORM_RAZAO_SOCIAL || "").trim(),
    nomeFantasia: (process.env.PLATFORM_NOME_FANTASIA || "").trim(),
    inscricaoMunicipal: (process.env.PLATFORM_INSCRICAO_MUNICIPAL || "").trim(),
    codigoMunicipio: toDigits(process.env.PLATFORM_CODIGO_MUNICIPIO),
    uf: (process.env.PLATFORM_UF || "").trim().toUpperCase(),
    itemListaServico: (process.env.PLATFORM_ITEM_LISTA_SERVICO || "1.05").trim(),
    codigoTributarioMunicipio: (process.env.PLATFORM_CODIGO_TRIBUTARIO_MUNICIPIO || "").trim(),
    aliquotaIss: Number(process.env.PLATFORM_ALIQUOTA_ISS || 0),
    issRetido: String(process.env.PLATFORM_ISS_RETIDO || "false").toLowerCase() === "true",
    descricaoServico:
      (process.env.PLATFORM_DESCRICAO_SERVICO || "").trim() ||
      "Assinatura mensal da plataforma Trabalhei La",
  };
}

function isAutoEmitEnabled() {
  return String(process.env.NFSE_AUTO_EMIT || "false").toLowerCase() === "true";
}

function isFocusConfigured() {
  return !!(process.env.FOCUS_NFE_TOKEN || "").trim();
}

function buildTomador({ payerEmail, payerName, payerDocument }) {
  // Para tomador pessoa fisica sem documento informado, varias prefeituras
  // aceitam emitir como "Consumidor Final" omitindo CPF. Focus NFe trata
  // a ausencia de "cpf"/"cnpj" do tomador como tomador nao identificado.
  const documentDigits = toDigits(payerDocument);
  const tomador = {
    razao_social: (payerName || "Consumidor").toString().trim() || "Consumidor",
    email: (payerEmail || "").toString().trim() || undefined,
  };
  if (documentDigits.length === 11) {
    tomador.cpf = documentDigits;
  } else if (documentDigits.length === 14) {
    tomador.cnpj = documentDigits;
  }
  return tomador;
}

function buildNfsePayload({ platform, amount, descricao, tomador }) {
  return {
    data_emissao: new Date().toISOString(),
    prestador: {
      cnpj: platform.cnpj,
      inscricao_municipal: platform.inscricaoMunicipal || undefined,
      codigo_municipio: platform.codigoMunicipio || undefined,
    },
    tomador,
    servico: {
      aliquota: platform.aliquotaIss,
      discriminacao: descricao,
      iss_retido: platform.issRetido,
      item_lista_servico: platform.itemListaServico,
      codigo_tributario_municipio: platform.codigoTributarioMunicipio || undefined,
      codigo_municipio: platform.codigoMunicipio || undefined,
      valor_servicos: Number(amount).toFixed(2),
    },
  };
}

/**
 * Emite (ou agenda emissao de) NFS-e no Focus NFe.
 * @param {object} params
 * @param {string} params.ref            Id idempotente (use o paymentId).
 * @param {number} params.amount         Valor do servico em reais.
 * @param {string} [params.descricao]    Descricao customizada do servico.
 * @param {string} [params.payerEmail]
 * @param {string} [params.payerName]
 * @param {string} [params.payerDocument] CPF ou CNPJ do tomador.
 */
export async function emitNfse({ ref, amount, descricao, payerEmail, payerName, payerDocument }) {
  if (!isAutoEmitEnabled()) {
    return { ok: false, skipped: true, reason: "auto_emit_disabled" };
  }
  if (!isFocusConfigured()) {
    return { ok: false, skipped: true, reason: "focus_nfe_token_missing" };
  }

  const platform = parsePlatformConfig();
  if (!platform.cnpj || platform.cnpj.length !== 14) {
    return { ok: false, skipped: true, reason: "platform_cnpj_invalid" };
  }
  if (!platform.codigoMunicipio) {
    return { ok: false, skipped: true, reason: "platform_codigo_municipio_missing" };
  }
  if (!ref) {
    return { ok: false, skipped: true, reason: "missing_ref" };
  }
  const valor = Number(amount);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, skipped: true, reason: "invalid_amount" };
  }

  const tomador = buildTomador({ payerEmail, payerName, payerDocument });
  const payload = buildNfsePayload({
    platform,
    amount: valor,
    descricao: (descricao || platform.descricaoServico).toString(),
    tomador,
  });

  const baseUrl = getFocusBaseUrl();
  const url = `${baseUrl}/v2/nfse?ref=${encodeURIComponent(ref)}`;
  const token = (process.env.FOCUS_NFE_TOKEN || "").trim();
  const basicAuth = Buffer.from(`${token}:`).toString("base64");

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[nfse] Falha de rede ao chamar Focus NFe:", err?.message || err);
    return { ok: false, error: "network_error", message: err?.message || "Falha de rede" };
  }

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  // Focus NFe responde 202 quando aceita o pedido e ira processar de forma
  // assincrona. O status final (emitida/cancelada/erro) pode ser consultado
  // depois por GET /v2/nfse?ref=...
  if (response.status === 202 || response.status === 201 || response.status === 200) {
    return {
      ok: true,
      status: response.status,
      ref,
      provider: "focusnfe",
      env: (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase(),
      data: json,
    };
  }

  console.warn("[nfse] Focus NFe rejeitou emissao", { status: response.status, body: json });
  return {
    ok: false,
    status: response.status,
    error: json?.codigo || json?.erro || "focus_nfe_error",
    message: json?.mensagem || json?.message || `HTTP ${response.status}`,
    data: json,
  };
}

/**
 * Wrapper conveniente: emite NFS-e a partir do payload do Mercado Pago e
 * persiste o resultado em Firestore para auditoria. Nunca lanca erro.
 */
export async function tryEmitNfseForMercadoPagoPayment({
  payment,
  cnpj,
  companySlug,
  apoiadorId,
  audience,
  descricao,
  db,
  FieldValue,
}) {
  try {
    const ref = `mp_${payment?.id || ""}`;
    const amount = Number(payment?.transaction_amount || 0);
    const payerEmail = payment?.payer?.email || null;
    const payerName =
      [payment?.payer?.first_name, payment?.payer?.last_name].filter(Boolean).join(" ") ||
      payment?.payer?.email ||
      null;
    const payerDocument =
      payment?.payer?.identification?.number ||
      payment?.additional_info?.payer?.identification?.number ||
      null;

    const result = await emitNfse({
      ref,
      amount,
      descricao,
      payerEmail,
      payerName,
      payerDocument,
    });

    if (db) {
      const nfseDoc = {
        provider: "focusnfe",
        env: (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase(),
        ref,
        paymentId: payment?.id || null,
        amount,
        cnpj: cnpj || null,
        companySlug: companySlug || null,
        apoiadorId: apoiadorId || null,
        audience: audience || null,
        ok: !!result.ok,
        skipped: !!result.skipped,
        reason: result.reason || null,
        status: result.status || null,
        message: result.message || null,
        raw: result.data || null,
        createdAt: FieldValue?.serverTimestamp?.() || new Date(),
      };
      try {
        await db.collection("nfse_emissoes").doc(ref).set(nfseDoc, { merge: true });
      } catch (writeErr) {
        console.warn("[nfse] Falha ao persistir resultado em nfse_emissoes:", writeErr?.message || writeErr);
      }
    }

    return result;
  } catch (err) {
    console.error("[nfse] Erro inesperado em tryEmitNfseForMercadoPagoPayment:", err?.message || err);
    return { ok: false, error: "unexpected_error", message: err?.message || String(err) };
  }
}
