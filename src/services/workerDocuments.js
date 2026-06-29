// src/services/workerDocuments.js
//
// Upload e listagem de documentos enviados pelo trabalhador aos
// especialistas (fluxo Ad Exitum / consulta). Os arquivos vão para o
// Firebase Storage e os metadados ficam em uma subcoleção
// `documents` dentro da conversa correspondente:
//
//   conversations/{conversationId}/documents/{documentId}
//     name / url / storagePath / size / contentType
//     senderId / receiverId / senderName / createdAt
//
// Ao enviar, o documento também é publicado como mensagem no chat
// (sendChatMessage com attachment) — assim ele aparece na conversa e
// atualiza o `lastMessage`, notificando o especialista pelo mesmo canal
// já existente (sininho + "Mensagens recentes").

import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  addDoc,
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { ensureConversation, sendChatMessage } from "./chat";

// Limite de tamanho por documento (em MB). Mantido em sincronia com a regra
// do Firebase Storage para `adExitumDocs/`.
export const MAX_FILE_SIZE_MB = 60;
export const WORKER_DOC_MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Envia um documento do trabalhador para um especialista.
 *
 * @param {object} args
 * @param {string} args.conversationId  id da conversa (spec_<id>__u_<uid>).
 * @param {File}   args.file            arquivo selecionado.
 * @param {string} args.senderUid       UID do trabalhador (Auth).
 * @param {string} args.senderName      nome do trabalhador.
 * @param {string} [args.receiverUid]   UID do especialista (Auth), se conhecido.
 * @param {string} [args.peerName]      nome do especialista (para metadados da conversa).
 * @param {(percent:number)=>void} [args.onProgress]  callback de progresso (0-100).
 * @returns {Promise<object>} metadados do documento gravado.
 */
export async function uploadWorkerDocument({
  conversationId,
  file,
  senderUid,
  senderName,
  receiverUid,
  peerName,
  onProgress,
}) {
  if (!conversationId || !file || !senderUid) {
    throw new Error("conversationId, file e senderUid são obrigatórios.");
  }
  if (file.size > WORKER_DOC_MAX_BYTES) {
    const err = new Error("FILE_TOO_LARGE");
    err.code = "FILE_TOO_LARGE";
    throw err;
  }

  // Garante que a conversa exista (com o trabalhador em `participants`)
  // ANTES de gravar — as regras do Firestore validam a escrita na
  // subcoleção `documents` consultando os participantes da conversa.
  await ensureConversation({
    conversationId,
    currentUid: senderUid,
    currentName: senderName,
    peerName: peerName || "Especialista",
    peerRole: "especialista",
    kind: "adExitum",
  });

  const safeName = String(file.name || "documento")
    .replace(/[^\w.-]+/g, "_")
    .slice(-160);
  const path = `adExitumDocs/${encodeURIComponent(conversationId)}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, path);

  // Upload resumível para emitir progresso por arquivo. O percentual é
  // reportado via `onProgress` enquanto os bytes são transferidos.
  if (typeof onProgress === "function") onProgress(0);
  const task = uploadBytesResumable(fileRef, file, {
    contentType: file.type || undefined,
  });
  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (typeof onProgress === "function" && snap.totalBytes > 0) {
          onProgress(
            Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          );
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });
  const url = await getDownloadURL(fileRef);
  if (typeof onProgress === "function") onProgress(100);

  const createdAt = new Date().toISOString();
  const meta = {
    name: String(file.name || "documento").slice(0, 200),
    url,
    storagePath: path,
    size: Number(file.size) || 0,
    contentType: String(file.type || ""),
    senderId: String(senderUid),
    receiverId: String(receiverUid || ""),
    senderName: String(senderName || "").slice(0, 160),
    createdAt,
    createdAtServer: serverTimestamp(),
  };

  const ref = await addDoc(
    collection(db, "conversations", conversationId, "documents"),
    meta
  );

  // Publica o documento como mensagem no chat para notificar o especialista
  // pelo canal já existente (atualiza lastMessage da conversa). Falha aqui
  // é silenciosa: o documento já foi registrado na subcoleção.
  try {
    await sendChatMessage({
      conversationId,
      senderUid,
      senderName,
      text: "",
      attachment: { name: meta.name, size: meta.size, url, storagePath: path },
    });
  } catch (err) {
    console.warn("Falha ao publicar documento no chat:", err);
  }

  return { id: ref.id, ...meta };
}

/**
 * Lista os documentos de uma conversa (mais recentes primeiro).
 * @param {string} conversationId
 * @param {number} [max]
 * @returns {Promise<Array>}
 */
export async function listWorkerDocuments(conversationId, max = 100) {
  if (!conversationId) return [];
  try {
    const q = query(
      collection(db, "conversations", conversationId, "documents"),
      orderBy("createdAt", "desc"),
      fbLimit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    // Fallback sem orderBy (índice ainda não disponível).
    try {
      const snap = await getDocs(
        collection(db, "conversations", conversationId, "documents")
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );
    } catch {
      return [];
    }
  }
}
