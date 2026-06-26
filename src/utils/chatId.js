// src/utils/chatId.js
//
// Helpers para gerar e interpretar o identificador de conversa do chat
// trabalhador × especialista.
//
// PRIVACIDADE: o `conversationId` precisa ser ÚNICO e CONSISTENTE para cada
// par (trabalhador, especialista). Antes, o id era apenas `spec_<especialista>`,
// o que fazia DOIS trabalhadores diferentes conversando com o MESMO
// especialista compartilharem a mesma conversa (vazamento de mensagens).
//
// Formato atual: `spec_<especialistaId>__u_<trabalhadorId>`
//   - mantém o prefixo `spec_` por compatibilidade com fluxos existentes
//     (ex.: extração do id do especialista no fluxo Ad Exitum);
//   - o segmento `__u_<trabalhadorId>` isola a conversa por trabalhador,
//     garantindo um chat exclusivo para cada par.
//
// O mesmo id é reconstruído de forma idêntica nos dois lados (trabalhador e
// especialista), pois ambos conhecem o `especialistaId` e o `trabalhadorId`.

const PARTICIPANT_SEPARATOR = "__u_";

/** Mantém apenas caracteres seguros para uso em chave/rota. */
function clean(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Monta o conversationId único do par (trabalhador, especialista).
 * Quando o trabalhador não está identificado, cai no formato legado
 * `spec_<especialistaId>` apenas para não quebrar a navegação.
 *
 * @param {string} workerId      UID do trabalhador logado.
 * @param {string} specialistId  ID do especialista (doc apoiadores/{id}).
 * @returns {string} conversationId determinístico para o par.
 */
export function buildSpecialistConversationId(workerId, specialistId) {
  const specialist = clean(specialistId);
  const worker = clean(workerId);
  if (!specialist) return "";
  if (!worker) return `spec_${specialist}`;
  return `spec_${specialist}${PARTICIPANT_SEPARATOR}${worker}`;
}

/**
 * Extrai o id do especialista de um conversationId (formato novo ou legado).
 * @param {string} conversationId
 * @returns {string} id do especialista, ou "" se não aplicável.
 */
export function getSpecialistIdFromConversationId(conversationId) {
  const id = String(conversationId || "");
  if (!id.startsWith("spec_")) return "";
  return id.replace(/^spec_/, "").split(PARTICIPANT_SEPARATOR)[0];
}

/**
 * Extrai o id do trabalhador de um conversationId.
 * @param {string} conversationId
 * @returns {string} id do trabalhador, ou "" no formato legado.
 */
export function getWorkerIdFromConversationId(conversationId) {
  const id = String(conversationId || "");
  const idx = id.indexOf(PARTICIPANT_SEPARATOR);
  return idx === -1 ? "" : id.slice(idx + PARTICIPANT_SEPARATOR.length);
}
