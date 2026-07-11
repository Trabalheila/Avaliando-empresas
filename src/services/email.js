import { buildApiUrl } from "../utils/apiBase";

/**
 * Serviço de e-mail (cliente) — notificações de atividade.
 *
 * Dispara, de forma ASSÍNCRONA e best-effort, o e-mail que avisa o autor de
 * uma avaliação quando seu comentário recebe uma reação ou resposta.
 *
 * Privacidade / segurança:
 *  - O e-mail do destinatário NUNCA trafega pelo cliente. Enviamos apenas o
 *    `reviewId`; o backend (api/send-contact-request, fluxo `type: "activity"`)
 *    resolve o endereço no servidor via Firebase Admin
 *    (reviews/{reviewId} → uid do autor → users/{uid}.email). Assim, apenas o
 *    autor real daquela avaliação pode ser notificado.
 *  - Se o autor for anônimo (sem conta/e-mail), o backend responde
 *    `emailed: false` sem erro.
 *
 * Configuração no backend (Vercel) — variáveis de ambiente:
 *   RESEND_API_KEY           chave da Resend (provedor de e-mail)
 *   EMAIL_FROM_ADDRESS       remetente verificado (ex.: no-reply@seu-dominio)
 *   APP_BASE_URL             URL pública do app (para montar o link do e-mail)
 *   FIREBASE_SERVICE_ACCOUNT JSON da Service Account (Admin SDK)
 * Se ausentes, o envio é ignorado silenciosamente (não quebra o fluxo in-app).
 *
 * @param {Object} params
 * @param {string} params.reviewId      ID da avaliação cujo autor será avisado.
 * @param {"reaction"|"reply"} params.activityType Tipo de atividade.
 * @param {string} [params.companyName] Nome da empresa avaliada.
 * @param {string} [params.itemLabel]   Rótulo do critério (quando aplicável).
 * @param {string} [params.link]        Caminho relativo do app até o comentário.
 */
export function sendActivityEmailNotification({
  reviewId,
  activityType,
  companyName = "",
  itemLabel = "",
  link = "",
} = {}) {
  const id = (reviewId || "").toString().trim();
  if (!id) return;

  try {
    // Fire-and-forget: não aguardamos a resposta para não bloquear a UI.
    fetch(buildApiUrl("/api/send-contact-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "activity",
        reviewId: id,
        activityType: activityType === "reply" ? "reply" : "reaction",
        companyName,
        itemLabel,
        link,
      }),
      keepalive: true,
    }).catch(() => {
      /* best-effort: falha no e-mail nunca afeta o fluxo do usuário */
    });
  } catch {
    /* ignore */
  }
}
