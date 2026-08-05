// src/services/chat.js
//
// Serviço de chat trabalhador × especialista persistido no Firestore.
//
// MOTIVAÇÃO: o chat era um MVP em localStorage — cada navegador guardava as
// próprias mensagens, então o especialista NUNCA via as mensagens enviadas
// pelo trabalhador (e vice-versa). Aqui as mensagens passam a ser gravadas em
// /conversations/{conversationId}/messages, com o documento da conversa
// guardando o array `participants` (UIDs do Firebase Auth) para garantir
// privacidade e permitir que ambos os lados leiam a MESMA conversa.
//
// Estrutura no Firestore:
//   conversations/{conversationId}
//     participants: [workerUid, specialistUid]   // UIDs do Auth
//     workerId / specialistId / specialistDocId
//     workerName / specialistName / peerNames {uid: name}
//     kind: "adExitum" | "consulta" | "caso" | "chat"
//     lastMessage: { text, senderUid, createdAt, attachmentName }
//     createdAt / updatedAt
//   conversations/{conversationId}/messages/{messageId}
//     senderUid / senderName / text / attachment? / createdAt

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  getSpecialistIdFromConversationId,
  getWorkerIdFromConversationId,
} from "../utils/chatId";
import { buildApiUrl } from "../utils/apiBase";

/** Resolve o UID de Auth do especialista a partir do doc apoiadores/{id}. */
async function resolveSpecialistUid(specialistDocId) {
  if (!specialistDocId) return "";
  try {
    const snap = await getDoc(doc(db, "apoiadores", String(specialistDocId)));
    if (snap.exists()) {
      const d = snap.data() || {};
      return String(d.uid || d.authUid || d.userId || specialistDocId);
    }
  } catch {
    /* silencioso */
  }
  return String(specialistDocId);
}

/**
 * Garante que o documento da conversa exista, com o array `participants`
 * preenchido com os UIDs do trabalhador e do especialista. Idempotente:
 * usa merge para não sobrescrever dados existentes.
 *
 * @param {object} args
 * @param {string} args.conversationId  id no padrão spec_<docId>__u_<workerUid>.
 * @param {string} args.currentUid      UID do usuário logado (Auth).
 * @param {string} args.currentName     Nome do usuário logado.
 * @param {string} args.peerName        Nome do interlocutor (vindo da rota).
 * @param {string} args.peerRole        "trabalhador" | "especialista".
 * @param {string} [args.kind]          Classificação da conversa.
 * @returns {Promise<string[]>} lista de participantes resolvida.
 */
export async function ensureConversation({
  conversationId,
  currentUid,
  currentName,
  peerName,
  peerRole,
  kind = "chat",
}) {
  if (!conversationId || !currentUid) return [];

  const specialistDocId = getSpecialistIdFromConversationId(conversationId);
  let workerUid = getWorkerIdFromConversationId(conversationId);
  let specialistUid = "";

  // Descobre quem é quem. O usuário logado é especialista quando conversa
  // com um "trabalhador"; caso contrário, é o próprio trabalhador.
  const iAmSpecialist = peerRole === "trabalhador";
  if (iAmSpecialist) {
    specialistUid = currentUid;
    if (!workerUid) workerUid = ""; // pode estar ausente em ids legados
  } else {
    if (!workerUid) workerUid = currentUid;
    specialistUid = await resolveSpecialistUid(specialistDocId);
  }

  const participants = Array.from(
    new Set([workerUid, specialistUid].filter(Boolean))
  );
  if (!participants.includes(currentUid)) participants.push(currentUid);

  console.log("[chat] ensureConversation()", {
    conversationId,
    currentUid,
    peerRole,
    specialistDocId,
    workerUid,
    specialistUid,
    participants,
  });

  const peerNames = {};
  if (currentUid) peerNames[currentUid] = currentName || "";
  // Nome do interlocutor associado ao UID conhecido do outro lado.
  const otherUid = iAmSpecialist ? workerUid : specialistUid;
  if (otherUid) peerNames[otherUid] = peerName || "";

  const ref = doc(db, "conversations", conversationId);
  try {
    const snap = await getDoc(ref);
    console.log("[chat] ensureConversation: doc existe?", snap.exists());

    if (!snap.exists()) {
      // Documento novo: cria com o array `participants` (UIDs do Auth). A
      // regra de create exige que o usuário atual esteja em participants.
      console.log("[chat] ensureConversation: criando conversa", participants);
      await setDoc(ref, {
        participants,
        workerId: workerUid || null,
        specialistId: specialistUid || null,
        specialistDocId: specialistDocId || null,
        peerNames,
        kind,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return participants;
    }

    // Documento já existe.
    const existing = snap.data() || {};
    const existingParticipants = Array.isArray(existing.participants)
      ? existing.participants
      : [];

    // Se o usuário atual não faz parte da conversa (ex.: conversationId
    // legado compartilhado por vários trabalhadores), NÃO escrevemos — isso
    // violaria as regras e vazaria mensagens entre usuários. Apenas
    // devolvemos os participantes existentes.
    if (!existingParticipants.includes(currentUid)) {
      console.warn(
        "[chat] Conversa existente não inclui o usuário atual (possível id legado); nenhuma escrita realizada.",
        { conversationId, currentUid, existingParticipants }
      );
      return existingParticipants;
    }

    // Atualiza apenas metadados, mantendo `participants` INALTERADO — a regra
    // de update exige request.resource.data.participants == resource.data.participants.
    console.log("[chat] ensureConversation: atualizando metadados");
    await updateDoc(ref, {
      peerNames: { ...(existing.peerNames || {}), ...peerNames },
      kind: existing.kind || kind,
      updatedAt: serverTimestamp(),
    });
    return existingParticipants;
  } catch (err) {
    console.error("Falha ao garantir a conversa no Firestore:", {
      code: err?.code,
      message: err?.message,
      conversationId,
      error: err,
    });
  }
  return participants;
}

/**
 * Envia uma mensagem para a conversa e atualiza o resumo (lastMessage).
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {string} args.senderUid
 * @param {string} args.senderName
 * @param {string} [args.text]
 * @param {object} [args.attachment]
 * @param {string} [args.recipientUid]
 *        UID do destinatário (Auth). Opcional: quando ausente, o backend
 *        deriva o destinatário a partir dos `participants` da conversa.
 * @param {"trabalhador"|"especialista"} [args.senderRole]
 *        Papel de quem envia. Quando o TRABALHADOR envia, marcamos
 *        `hasUnreadMessages: true` na conversa (para o badge e o push do
 *        especialista). Quando o ESPECIALISTA envia, ele está ativo na
 *        conversa, então zeramos o marcador.
 * @returns {Promise<void>}
 */
export async function sendChatMessage({
  conversationId,
  senderUid,
  senderName,
  text,
  attachment,
  recipientUid,
  senderRole,
}) {
  if (!conversationId || !senderUid) {
    throw new Error("conversationId e senderUid são obrigatórios.");
  }
  const createdAt = new Date().toISOString();
  const message = {
    senderUid: String(senderUid),
    senderName: String(senderName || "").slice(0, 160),
    text: text ? String(text).slice(0, 4000) : "",
    createdAt,
    createdAtServer: serverTimestamp(),
  };
  if (attachment && attachment.url) {
    message.attachment = {
      name: String(attachment.name || "arquivo").slice(0, 200),
      size: Number(attachment.size) || 0,
      url: String(attachment.url),
      storagePath: attachment.storagePath ? String(attachment.storagePath) : "",
      contentType: attachment.contentType ? String(attachment.contentType) : "",
    };
  }

  await addDoc(
    collection(db, "conversations", conversationId, "messages"),
    message
  );

  // Determina o estado de "não lida" a partir do papel do remetente. Só
  // escrevemos o campo quando conhecemos o papel, para não sobrescrever o
  // marcador em fluxos legados que não o informam.
  const workerSent = senderRole === "trabalhador";
  const specialistSent = senderRole === "especialista";

  // Atualiza o resumo da conversa para a lista "Mensagens recentes".
  try {
    const summary = {
      updatedAt: serverTimestamp(),
      lastMessage: {
        text: message.text,
        senderUid: message.senderUid,
        attachmentName: message.attachment ? message.attachment.name : "",
        createdAt,
      },
    };
    if (workerSent) summary.hasUnreadMessages = true;
    else if (specialistSent) summary.hasUnreadMessages = false;
    await updateDoc(doc(db, "conversations", conversationId), summary);
  } catch (err) {
    console.warn("Falha ao atualizar o resumo da conversa:", err);
  }

  // Dispara (best-effort) a notificação de nova mensagem/documento para o
  // DESTINATÁRIO — em QUALQUER direção (trabalhador → especialista e
  // especialista → trabalhador). Falhas aqui nunca bloqueiam o envio.
  notifyNewMessage({
    conversationId,
    senderUid,
    recipientUid,
    kind: message.attachment ? "documento" : "mensagem",
  });
}

/**
 * Dispara o endpoint que notifica o DESTINATÁRIO sobre uma nova mensagem ou
 * documento na conversa (e-mail + push best-effort). Erros são apenas
 * logados: a mensagem já foi entregue via Firestore. O backend resolve o
 * e-mail do destinatário e o nome do remetente a partir da conversa.
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {string} args.senderUid
 * @param {string} [args.recipientUid]
 * @param {"mensagem"|"documento"} [args.kind]
 */
function notifyNewMessage({ conversationId, senderUid, recipientUid, kind }) {
  try {
    fetch(buildApiUrl("/api/notify-new-message"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        senderUid,
        recipientUid: recipientUid || "",
        kind: kind || "mensagem",
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silencioso — a mensagem já foi entregue via Firestore */
  }
}

/**
 * Marca a conversa como lida pelo especialista (zera `hasUnreadMessages`).
 * Best-effort: não lança em caso de falha.
 */
export async function markConversationRead(conversationId) {
  if (!conversationId) return;
  try {
    await updateDoc(doc(db, "conversations", conversationId), {
      hasUnreadMessages: false,
    });
  } catch (err) {
    console.warn("Falha ao marcar a conversa como lida:", err);
  }
}

/**
 * Assina as mensagens de uma conversa em tempo real (ordenadas por data).
 * @returns {() => void} função para cancelar a assinatura.
 */
export function subscribeToMessages(conversationId, callback) {
  if (!conversationId) return () => {};
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
    fbLimit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(msgs);
    },
    (err) => {
      console.warn("Falha ao escutar mensagens da conversa:", err);
    }
  );
}

/**
 * Lista (uma vez) as conversas em que `uid` é participante, mais recentes
 * primeiro. Usado pela dashboard do especialista em "Mensagens recentes".
 */
export async function listConversationsForParticipant(uid, max = 20) {
  if (!uid) return [];
  try {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", uid),
      fbLimit(max)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) =>
        String(b.lastMessage?.createdAt || b.updatedAt || "").localeCompare(
          String(a.lastMessage?.createdAt || a.updatedAt || "")
        )
      );
  } catch (err) {
    console.warn("Falha ao listar conversas do participante:", err);
    return [];
  }
}

/**
 * Assina EM TEMPO REAL as conversas em que `uid` é participante. Usado pela
 * dashboard do especialista para exibir o badge de mensagens não lidas
 * (`hasUnreadMessages`) assim que o trabalhador envia uma nova mensagem.
 *
 * @param {string} uid  UID do especialista (Auth).
 * @param {(convs: object[]) => void} callback  recebe a lista ordenada.
 * @param {number} [max]
 * @returns {() => void} função para cancelar a assinatura.
 */
export function subscribeToConversationsForParticipant(uid, callback, max = 50) {
  if (!uid) return () => {};
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid),
    fbLimit(max)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          String(b.lastMessage?.createdAt || b.updatedAt || "").localeCompare(
            String(a.lastMessage?.createdAt || a.updatedAt || "")
          )
        );
      callback(list);
    },
    (err) => {
      console.warn("Falha ao escutar conversas do participante:", err);
    }
  );
}
