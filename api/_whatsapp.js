// api/_whatsapp.js
//
// Envio de notificações via WhatsApp Cloud API (Meta / Graph API).
//
// Mensagens iniciadas pela empresa (fora da janela de 24h de atendimento)
// EXIGEM um template previamente aprovado pela Meta. Configure o template no
// WhatsApp Manager com um corpo contendo dois parâmetros:
//   {{1}} = nome do especialista
//   {{2}} = quem entrou em contato (trabalhador/empresa)
//
// Variáveis de ambiente (todas opcionais; sem elas o envio é no-op):
//   WHATSAPP_TOKEN             token de acesso da API do WhatsApp (permanente)
//   WHATSAPP_PHONE_NUMBER_ID   ID do número remetente (Phone Number ID)
//   WHATSAPP_GRAPH_VERSION     versão da Graph API (default "v21.0")
//   WHATSAPP_TEMPLATE_NAME     nome do template aprovado (default "novo_contato")
//   WHATSAPP_TEMPLATE_LANG     código de idioma do template (default "pt_BR")

/** Normaliza um telefone brasileiro para E.164 sem o "+": só dígitos, com DDI 55. */
export function normalizeBrazilPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  digits = digits.replace(/^0+/, "");
  // Já em formato internacional brasileiro (55 + DDD + número).
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // Número local: fixo (10) ou celular (11) com DDD → prefixa o DDI 55.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  // Outros formatos (já internacionais de outros países, etc.): melhor esforço.
  return digits;
}

/** Indica se as credenciais mínimas do WhatsApp Cloud API estão configuradas. */
export function isWhatsAppConfigured() {
  return Boolean(
    (process.env.WHATSAPP_TOKEN || "").trim() &&
      (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim()
  );
}

/**
 * Envia uma mensagem de template pelo WhatsApp Cloud API.
 * Best-effort: nunca lança — retorna { sent, reason?, id? }.
 *
 * @param {object}   args
 * @param {string}   args.to             telefone destino (será normalizado)
 * @param {string}   [args.templateName] nome do template (default via env)
 * @param {string}   [args.languageCode] idioma do template (default via env)
 * @param {string[]} [args.bodyParams]   parâmetros de texto do corpo ({{1}}, {{2}}…)
 * @param {string}   [args.buttonUrlParam] sufixo dinâmico do botão de URL (index 0)
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode,
  bodyParams,
  buttonUrlParam,
} = {}) {
  const token = (process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!token || !phoneNumberId) {
    return { sent: false, reason: "whatsapp_disabled" };
  }

  const toDigits = normalizeBrazilPhone(to);
  if (!toDigits) return { sent: false, reason: "no_phone" };

  const version = (process.env.WHATSAPP_GRAPH_VERSION || "v21.0").trim();
  const name = (templateName || process.env.WHATSAPP_TEMPLATE_NAME || "novo_contato").trim();
  const lang = (languageCode || process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR").trim();

  const components = [];
  if (Array.isArray(bodyParams) && bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParams.map((p) => ({
        type: "text",
        text: String(p ?? "").slice(0, 300),
      })),
    });
  }
  // Botão de URL dinâmica (index 0): o valor é anexado ao final da URL
  // definida no template (ex.: .../my-contacts?req={{1}}).
  if (buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: String(buttonUrlParam).slice(0, 300) }],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: toDigits,
    type: "template",
    template: {
      name,
      language: { code: lang },
      ...(components.length ? { components } : {}),
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(
        "[whatsapp] envio falhou:",
        res.status,
        data?.error?.message || data
      );
      return { sent: false, reason: "send_failed", detail: data?.error?.message || null };
    }
    return { sent: true, id: data?.messages?.[0]?.id || null };
  } catch (err) {
    console.warn("[whatsapp] exceção no envio:", err?.message || err);
    return { sent: false, reason: "exception" };
  }
}

/**
 * Conveniência: notifica um especialista, no WhatsApp cadastrado, de que
 * recebeu um novo contato/pedido na plataforma.
 *
 * Template esperado (corpo com 3 variáveis + botão de URL dinâmica):
 *   {{1}} = nome do especialista
 *   {{2}} = quem entrou em contato
 *   {{3}} = trecho da mensagem recebida
 *   botão URL: .../apoiador/my-contacts?req={{1}}  → sufixo = requestId
 */
export async function notifySpecialistWhatsApp({
  to,
  specialistName,
  fromName,
  messageSnippet,
  urlSuffix,
} = {}) {
  // Corpos de template não aceitam quebras de linha nem espaços em excesso.
  const snippet =
    String(messageSnippet || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "—";
  return sendWhatsAppTemplate({
    to,
    bodyParams: [
      String(specialistName || "Especialista"),
      String(fromName || "um contato"),
      snippet,
    ],
    buttonUrlParam: String(urlSuffix || "novo-contato"),
  });
}
