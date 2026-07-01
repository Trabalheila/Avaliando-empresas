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
// Segmento que isola a conversa por CASO (atendimento). Um mesmo par
// (trabalhador, especialista) pode ter vários casos, cada um com sua própria
// thread de mensagens. Ex.: `spec_<esp>__u_<worker>__c_<casoId>`.
const CASE_SEPARATOR = "__c_";

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
  if (idx === -1) return "";
  let rest = id.slice(idx + PARTICIPANT_SEPARATOR.length);
  // Remove o segmento do caso, se presente, para não contaminar o UID.
  const caseIdx = rest.indexOf(CASE_SEPARATOR);
  if (caseIdx !== -1) rest = rest.slice(0, caseIdx);
  return rest;
}

/**
 * Monta um conversationId ESPECÍFICO de um caso, a partir do par
 * (trabalhador, especialista) + o id do caso. Cada caso ganha assim uma
 * thread de chat isolada. Se faltar o casoId, cai no id do par (compat.).
 *
 * @param {string} workerId     UID do trabalhador.
 * @param {string} specialistId id do especialista (doc apoiadores/{id}).
 * @param {string} casoId       id do caso.
 * @returns {string} conversationId da conversa do caso.
 */
export function buildCaseConversationId(workerId, specialistId, casoId) {
  const base = buildSpecialistConversationId(workerId, specialistId);
  const caso = clean(casoId);
  if (!base || !caso) return base;
  return `${base}${CASE_SEPARATOR}${caso}`;
}

/**
 * Extrai o id do caso de um conversationId (quando presente).
 * @param {string} conversationId
 * @returns {string} casoId, ou "" se a conversa não é vinculada a um caso.
 */
export function getCaseIdFromConversationId(conversationId) {
  const id = String(conversationId || "");
  const idx = id.indexOf(CASE_SEPARATOR);
  return idx === -1 ? "" : id.slice(idx + CASE_SEPARATOR.length);
}
