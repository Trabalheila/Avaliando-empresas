// src/services/workerCasos.js
//
// Camada de agregação dos "casos" na perspectiva do TRABALHADOR (Fase 2).
//
// Une duas fontes para robustez e compatibilidade retroativa:
//   1. A coleção top-level `casos` (fonte de verdade, criada no aceite).
//   2. Os pedidos Ad Exitum ACEITOS (`contactRequestsApoiador`) que ainda não
//      possuem um caso correspondente — sintetizados como "casos virtuais"
//      para que atendimentos aceitos ANTES desta funcionalidade continuem
//      visíveis. O casoId virtual é o mesmo determinístico do pedido, então
//      quando o caso real for criado ele substitui o virtual sem duplicar.

import {
  listCasosByTrabalhador,
  buildCasoIdFromRequest,
  CASO_STATUS,
} from "./casos";
import { listAcceptedAdExitumForWorker } from "./contactRequests";
import { buildSpecialistConversationId } from "../utils/chatId";

/** Chave de agrupamento por especialista (id do doc apoiadores/{id}). */
export function especialistaKey(caso) {
  return String(caso?.especialistaId || caso?.especialistaUid || "").trim();
}

/**
 * Lista todos os casos do trabalhador, já enriquecidos e mesclados com os
 * pedidos Ad Exitum aceitos sem caso.
 * @param {string} uid UID do trabalhador logado.
 * @returns {Promise<object[]>} casos (mais recentes primeiro).
 */
export async function listWorkerCasosEnriched(uid) {
  if (!uid) return [];
  const [casos, accepted] = await Promise.all([
    listCasosByTrabalhador(uid).catch(() => []),
    listAcceptedAdExitumForWorker(uid).catch(() => []),
  ]);

  const byId = new Map();
  for (const c of casos) {
    byId.set(String(c.id), { ...c, _virtual: false });
  }

  // Backfill: Ad Exitum aceitos sem caso real correspondente.
  for (const r of accepted) {
    const casoId = buildCasoIdFromRequest(r.id) || `virtual_${r.id}`;
    if (byId.has(casoId)) continue;
    const conversationId =
      r.conversationId || buildSpecialistConversationId(uid, r.toApoiadorId);
    byId.set(casoId, {
      id: casoId,
      casoId,
      trabalhadorId: uid,
      especialistaId: String(r.toApoiadorId || r.toApoiadorUid || ""),
      especialistaUid: String(r.toApoiadorUid || ""),
      nomeDoEspecialista: r.toApoiadorName || "Especialista",
      specialtyId: r.specialtyId || "",
      empresaId: "",
      nomeDoCaso: r.nomeDoCaso || "Atendimento",
      status: CASO_STATUS.ATIVO,
      origem: "adExitum",
      conversationId,
      contactRequestId: r.id,
      _virtual: true,
    });
  }

  return Array.from(byId.values());
}

/**
 * Agrupa uma lista de casos por especialista.
 * @param {object[]} casos
 * @returns {Array<{ especialistaId, nomeDoEspecialista, specialtyId, casos }>}
 */
export function groupCasosByEspecialista(casos) {
  const groups = new Map();
  for (const c of casos || []) {
    const key = especialistaKey(c);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, {
        especialistaId: c.especialistaId || key,
        especialistaUid: c.especialistaUid || "",
        nomeDoEspecialista: c.nomeDoEspecialista || "Especialista",
        specialtyId: c.specialtyId || "",
        casos: [],
      });
    }
    groups.get(key).casos.push(c);
  }
  return Array.from(groups.values());
}

/**
 * Rótulo de exibição de um caso, com diferenciação. Usa o nome da empresa
 * avaliada quando disponível; senão o `nomeDoCaso`; senão "Caso N".
 * @param {object} caso
 * @param {number} index posição do caso dentro do grupo (0-based).
 * @returns {string}
 */
export function casoLabel(caso, index = 0) {
  const empresa = String(caso?.empresaNome || caso?.empresaId || "").trim();
  if (empresa) return empresa;
  const nome = String(caso?.nomeDoCaso || "").trim();
  if (nome && nome.toLowerCase() !== "atendimento") return nome;
  return `Caso ${index + 1}`;
}
