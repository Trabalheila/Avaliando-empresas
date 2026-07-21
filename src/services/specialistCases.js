// src/services/specialistCases.js
//
// Serviço de "casos ativos" do especialista, persistidos no Firestore em
// /apoiadores/{specialistId}/cases/{caseId}.
//
// MOTIVAÇÃO: quando um trabalhador inicia uma conversa no chat, o
// especialista precisa de uma ação clara para ACEITAR o cliente e
// transformá-lo num caso ativo gerenciável — aparecendo na lista
// "Meus clientes / casos ativos" do dashboard e acessível pela página
// de detalhes do caso (/especialista/:tipo/caso/:caseId).
//
// Estrutura no Firestore:
//   apoiadores/{specialistId}/cases/{caseId}
//     specialistId / specialistUid / conversationId / workerUid
//     clientAlias / specialistType / caseType / status
//     nextAction / createdAt / updatedAt
//
// SEGURANÇA: a escrita só é permitida ao próprio especialista dono do
// documento /apoiadores/{specialistId} (regra do Firestore checa
// auth.uid == apoiador.uid). O caseId é DETERMINÍSTICO a partir do
// conversationId, então aceitar duas vezes ATUALIZA o mesmo caso
// (idempotente) em vez de criar duplicatas.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { getWorkerIdFromConversationId } from "../utils/chatId";

/** Mantém apenas caracteres seguros para uso em id de documento/rota. */
function cleanId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 200);
}

/**
 * Gera o caseId determinístico a partir do conversationId. Assim, aceitar
 * o mesmo cliente mais de uma vez atualiza o MESMO caso (idempotente).
 * @param {string} conversationId
 * @returns {string}
 */
export function buildCaseIdFromConversation(conversationId) {
  const id = cleanId(conversationId);
  if (!id) return "";
  return id.startsWith("case_") ? id : `case_${id}`;
}

/**
 * Aceita o cliente da conversa e cria/atualiza o caso ativo do especialista.
 *
 * @param {object} args
 * @param {string} args.specialistId     id do doc /apoiadores/{id}.
 * @param {string} args.specialistUid    UID do Auth do especialista (dono).
 * @param {string} args.conversationId   id da conversa do chat.
 * @param {string} [args.workerUid]      UID do trabalhador/cliente.
 * @param {string} [args.clientAlias]    pseudônimo do cliente exibido no chat.
 * @param {string} [args.specialistType] tipo do especialista (advogado, etc.).
 * @param {string} [args.caseType]       descrição inicial do caso.
 * @returns {Promise<string>} caseId criado/atualizado.
 */
export async function acceptClientCase({
  specialistId,
  specialistUid,
  conversationId,
  workerUid,
  clientAlias,
  specialistType,
  caseType,
}) {
  if (!specialistId || !conversationId) {
    throw new Error("specialistId e conversationId são obrigatórios.");
  }

  const caseId = buildCaseIdFromConversation(conversationId);
  if (!caseId) {
    throw new Error("Não foi possível gerar o identificador do caso.");
  }

  const resolvedWorkerUid =
    cleanId(workerUid) || getWorkerIdFromConversationId(conversationId) || "";

  const ref = doc(db, "apoiadores", String(specialistId), "cases", caseId);

  // Preserva createdAt/caseType de um eventual rascunho existente.
  let existing = null;
  try {
    const snap = await getDoc(ref);
    existing = snap.exists() ? snap.data() : null;
  } catch {
    existing = null;
  }

  const payload = {
    caseId,
    specialistId: String(specialistId),
    specialistUid: String(specialistUid || ""),
    conversationId: String(conversationId),
    workerUid: resolvedWorkerUid,
    userId: resolvedWorkerUid,
    clientAlias: String(clientAlias || "Cliente").slice(0, 160),
    specialistType: String(specialistType || "outro"),
    caseType:
      String(caseType || existing?.caseType || "Atendimento iniciado pelo cliente").slice(
        0,
        300
      ),
    status: "Ativo",
    nextAction: existing?.nextAction || "Analisar caso do cliente",
    createdAt: existing?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });

  // Marca a conversa como aceita/ativa. Best-effort: não falha o aceite se a
  // atualização de metadados for negada (participants permanecem inalterados).
  try {
    await updateDoc(doc(db, "conversations", String(conversationId)), {
      accepted: true,
      acceptedBy: String(specialistUid || ""),
      caseId,
      status: "active",
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[cases] Falha ao marcar conversa como aceita:", err);
  }

  return caseId;
}

/**
 * Lista os casos ativos de um especialista, já no formato usado pelo
 * dashboard (clientAlias, caseType, status, nextAction, ...).
 * @param {string} specialistId
 * @returns {Promise<object[]>}
 */
export async function listSpecialistCases(specialistId) {
  if (!specialistId) return [];
  try {
    const snap = await getDocs(
      collection(db, "apoiadores", String(specialistId), "cases")
    );
    return snap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          id: d.id,
          clientAlias: data.clientAlias || "Cliente",
          caseType: data.caseType || "Atendimento",
          status: data.status || "Ativo",
          nextAction: data.nextAction || "—",
          nextActionDate: data.nextActionDate || "",
          processNumber: data.processNumber || "",
          court: data.court || "",
          conversationId: data.conversationId || "",
          specialistType: data.specialistType || "outro",
          _updatedAt: data.updatedAt || null,
        };
      })
      .sort((a, b) => {
        const ta = a._updatedAt?.seconds || 0;
        const tb = b._updatedAt?.seconds || 0;
        return tb - ta;
      });
  } catch (err) {
    console.warn("[cases] Falha ao listar casos do especialista:", err);
    return [];
  }
}

/**
 * Busca um caso específico do especialista.
 * @param {string} specialistId
 * @param {string} caseId
 * @returns {Promise<object|null>}
 */
export async function getSpecialistCase(specialistId, caseId) {
  if (!specialistId || !caseId) return null;
  try {
    const snap = await getDoc(
      doc(db, "apoiadores", String(specialistId), "cases", String(caseId))
    );
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.warn("[cases] Falha ao buscar caso do especialista:", err);
    return null;
  }
}

/**
 * Encerra (finaliza) um caso ativo do especialista. Atualiza o status do
 * documento em /apoiadores/{specialistId}/cases/{caseId} para "finalizado",
 * de modo que ele saia da lista de casos ativos e passe ao histórico.
 *
 * A permissão é garantida pelas regras do Firestore (apenas o próprio
 * especialista dono do perfil pode atualizar seus casos).
 *
 * @param {string} specialistId  id do doc /apoiadores/{id}.
 * @param {string} caseId        id do caso a encerrar.
 * @returns {Promise<void>}
 */
export async function closeSpecialistCase(specialistId, caseId) {
  if (!specialistId || !caseId) {
    throw new Error("specialistId e caseId são obrigatórios.");
  }
  const ref = doc(db, "apoiadores", String(specialistId), "cases", String(caseId));
  await setDoc(
    ref,
    {
      status: "finalizado",
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Salva (ou atualiza) a anamnese do paciente vinculada ao caso, em
 * /apoiadores/{specialistId}/cases/{caseId} no campo `anamnese`.
 *
 * A permissão é garantida pelas regras do Firestore (apenas o próprio
 * especialista dono do perfil pode gravar em seus casos).
 *
 * @param {string} specialistId  id do doc /apoiadores/{id}.
 * @param {string} caseId        id do caso.
 * @param {object} anamnese      dados da anamnese (doenças, queixas, etc.).
 * @returns {Promise<void>}
 */
export async function saveCaseAnamnese(specialistId, caseId, anamnese) {
  if (!specialistId || !caseId) {
    throw new Error("specialistId e caseId são obrigatórios.");
  }
  const ref = doc(db, "apoiadores", String(specialistId), "cases", String(caseId));
  await setDoc(
    ref,
    {
      anamnese: { ...(anamnese || {}), updatedAt: new Date().toISOString() },
      anamneseUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

