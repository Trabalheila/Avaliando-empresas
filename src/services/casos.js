// src/services/casos.js
//
// Modelo de dados de "Casos" (atendimentos) — Fase 1.
//
// Um "caso" representa um atendimento específico entre um TRABALHADOR e um
// ESPECIALISTA, opcionalmente vinculado a uma EMPRESA avaliada. Diferente da
// subcoleção `apoiadores/{id}/cases` (que é a visão do especialista sobre seus
// clientes), esta é uma coleção TOP-LEVEL, legível por ambos os lados, que
// será a fonte de verdade para:
//   - "Atendimentos Ativos" do trabalhador (casos individuais);
//   - "Contatos Liberados" agrupados por especialista;
//   - múltiplos casos por par trabalhador×especialista.
//
// Estrutura no Firestore (coleção `casos`):
//   casos/{casoId}
//     trabalhadorId    string  (UID do trabalhador)
//     especialistaId   string  (id do doc /apoiadores/{id})
//     especialistaUid  string  (UID do Auth do especialista — usado nas regras)
//     empresaId        string  (id/slug da empresa avaliada — pode ser "")
//     nomeDoCaso       string  (ex.: "Processo contra Empresa X")
//     status           "ativo" | "finalizado" | "pendente"
//     origem           string  (ex.: "adExitum", "contato")
//     conversationId   string  (chat vinculado, quando houver)
//     contactRequestId string  (pedido de contato que originou o caso)
//     createdAt / updatedAt  serverTimestamp
//
// SEGURANÇA (ver firestore.rules → match /casos/{casoId}): apenas o próprio
// trabalhador (trabalhadorId == auth.uid) ou o próprio especialista
// (especialistaUid == auth.uid) podem ler/criar/atualizar o caso.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/** Status válidos de um caso. */
export const CASO_STATUS = {
  ATIVO: "ativo",
  FINALIZADO: "finalizado",
  PENDENTE: "pendente",
};

/** Mantém apenas caracteres seguros para uso em id de documento. */
function cleanId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 200);
}

/**
 * Gera um casoId determinístico a partir do id do pedido de contato. Assim,
 * aceitar o mesmo pedido mais de uma vez ATUALIZA o mesmo caso (idempotente)
 * em vez de criar duplicatas.
 * @param {string} contactRequestId
 * @returns {string}
 */
export function buildCasoIdFromRequest(contactRequestId) {
  const id = cleanId(contactRequestId);
  return id ? `caso_${id}` : "";
}

/**
 * Cria (ou atualiza, quando `id` já existe) um caso na coleção `casos`.
 *
 * @param {object} args
 * @param {string} [args.id]              id determinístico do caso (idempotência).
 * @param {string} args.trabalhadorId     UID do trabalhador (obrigatório).
 * @param {string} args.especialistaId    id do doc /apoiadores/{id} (obrigatório).
 * @param {string} [args.especialistaUid] UID do Auth do especialista.
 * @param {string} [args.nomeDoEspecialista] nome do especialista (exibição).
 * @param {string} [args.specialtyId]     área de atuação do especialista.
 * @param {string} [args.empresaId]       id/slug da empresa avaliada.
 * @param {string} [args.nomeDoCaso]      nome descritivo do caso.
 * @param {string} [args.status]          status inicial (default: "ativo").
 * @param {string} [args.origem]          origem do caso (ex.: "adExitum").
 * @param {string} [args.conversationId]  id da conversa do chat vinculada.
 * @param {string} [args.contactRequestId] id do pedido que originou o caso.
 * @returns {Promise<string>} casoId criado/atualizado.
 */
export async function createCaso({
  id,
  trabalhadorId,
  especialistaId,
  especialistaUid,
  nomeDoEspecialista,
  specialtyId,
  empresaId,
  nomeDoCaso,
  status,
  origem,
  conversationId,
  contactRequestId,
}) {
  const trabalhador = cleanId(trabalhadorId);
  const especialista = cleanId(especialistaId);
  if (!trabalhador) throw new Error("trabalhadorId é obrigatório.");
  if (!especialista) throw new Error("especialistaId é obrigatório.");

  const casoId =
    cleanId(id) ||
    buildCasoIdFromRequest(contactRequestId) ||
    `caso_${trabalhador}_${especialista}_${Date.now()}`;

  const ref = doc(db, "casos", casoId);

  // Preserva createdAt / nomeDoCaso de um caso já existente (idempotência).
  let existing = null;
  try {
    const snap = await getDoc(ref);
    existing = snap.exists() ? snap.data() : null;
  } catch {
    existing = null;
  }

  const validStatus = Object.values(CASO_STATUS);
  const finalStatus = validStatus.includes(status)
    ? status
    : existing?.status || CASO_STATUS.ATIVO;

  const payload = {
    casoId,
    trabalhadorId: trabalhador,
    especialistaId: especialista,
    especialistaUid: String(especialistaUid || existing?.especialistaUid || ""),
    nomeDoEspecialista: String(
      nomeDoEspecialista || existing?.nomeDoEspecialista || "Especialista"
    ).slice(0, 160),
    specialtyId: String(specialtyId || existing?.specialtyId || "").slice(0, 60),
    empresaId: String(empresaId || existing?.empresaId || ""),
    nomeDoCaso: String(
      nomeDoCaso || existing?.nomeDoCaso || "Novo atendimento"
    ).slice(0, 200),
    status: finalStatus,
    origem: String(origem || existing?.origem || "contato").slice(0, 40),
    conversationId: String(conversationId || existing?.conversationId || ""),
    contactRequestId: String(
      contactRequestId || existing?.contactRequestId || ""
    ),
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  return casoId;
}

/** Normaliza um snapshot de caso para o formato usado pela UI. */
function mapCaso(d) {
  const data = d.data() || {};
  return { id: d.id, ...data };
}

/** Ordena casos por updatedAt desc (em memória, robusto a falta de índice). */
function sortByUpdatedDesc(casos) {
  return casos.sort((a, b) => {
    const ta = a.updatedAt?.seconds || 0;
    const tb = b.updatedAt?.seconds || 0;
    return tb - ta;
  });
}

/**
 * Lista os casos de um trabalhador.
 * @param {string} trabalhadorId UID do trabalhador.
 * @param {number} [max=100]
 * @returns {Promise<object[]>}
 */
export async function listCasosByTrabalhador(trabalhadorId, max = 100) {
  const id = cleanId(trabalhadorId);
  if (!id) return [];
  const col = collection(db, "casos");
  try {
    const q = query(
      col,
      where("trabalhadorId", "==", id),
      orderBy("updatedAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapCaso);
  } catch {
    // Sem índice composto: consulta sem ordenação e ordena em memória.
    try {
      const snap = await getDocs(
        query(col, where("trabalhadorId", "==", id), limit(max))
      );
      return sortByUpdatedDesc(snap.docs.map(mapCaso));
    } catch {
      return [];
    }
  }
}

/**
 * Lista os casos de um especialista. Consulta por `especialistaId` (id do doc)
 * e por `especialistaUid` (UID do Auth) para robustez, mesclando os resultados.
 * @param {string} especialistaId  id do doc /apoiadores/{id}.
 * @param {string} [especialistaUid] UID do Auth do especialista.
 * @param {number} [max=100]
 * @returns {Promise<object[]>}
 */
export async function listCasosByEspecialista(
  especialistaId,
  especialistaUid = "",
  max = 100
) {
  const keys = [];
  if (especialistaId) keys.push(["especialistaId", cleanId(especialistaId)]);
  if (especialistaUid && especialistaUid !== especialistaId) {
    keys.push(["especialistaUid", cleanId(especialistaUid)]);
  }
  if (keys.length === 0) return [];

  const col = collection(db, "casos");
  const runQuery = async (field, value) => {
    try {
      const snap = await getDocs(
        query(col, where(field, "==", value), limit(max))
      );
      return snap.docs.map(mapCaso);
    } catch {
      return [];
    }
  };

  const results = await Promise.all(keys.map(([f, v]) => runQuery(f, v)));
  const byId = new Map();
  results.flat().forEach((c) => {
    if (c && c.id && !byId.has(c.id)) byId.set(c.id, c);
  });
  return sortByUpdatedDesc(Array.from(byId.values()));
}

/**
 * Busca um caso específico.
 * @param {string} casoId
 * @returns {Promise<object|null>}
 */
export async function getCaso(casoId) {
  const id = cleanId(casoId);
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "casos", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch {
    return null;
  }
}

/**
 * Atualiza o status de um caso.
 * @param {string} casoId
 * @param {string} status  um de CASO_STATUS.
 * @returns {Promise<void>}
 */
export async function updateCasoStatus(casoId, status) {
  const id = cleanId(casoId);
  if (!id) throw new Error("casoId obrigatório.");
  if (!Object.values(CASO_STATUS).includes(status)) {
    throw new Error("status inválido.");
  }
  await updateDoc(doc(db, "casos", id), {
    status,
    updatedAt: serverTimestamp(),
  });
}
