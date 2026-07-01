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
  deleteObject,
} from "firebase/storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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

// Categorias de documento do trabalhador:
//   "cliente"  → documentos gerais do trabalhador (RG, CPF, comprovantes…)
//   "processo" → documentos específicos do caso com aquele especialista.
export const DOC_CATEGORY_CLIENT = "cliente";
export const DOC_CATEGORY_PROCESS = "processo";

// Parâmetros de otimização de imagens (antes do upload).
const IMAGE_MAX_DIMENSION = 1920; // largura/altura máxima em px
const IMAGE_JPEG_QUALITY = 0.8; // 80% de qualidade JPEG

/**
 * Otimiza uma imagem no navegador antes do upload: redimensiona para no
 * máximo IMAGE_MAX_DIMENSION (mantendo a proporção) e recomprime em JPEG a
 * IMAGE_JPEG_QUALITY. Apenas para arquivos `image/*` (PDF/MP3/MP4 passam
 * intactos). Se a otimização falhar ou não reduzir o tamanho, devolve o
 * arquivo original — nunca aumenta o upload.
 *
 * @param {File} file
 * @returns {Promise<File>} arquivo otimizado (ou o original).
 */
export async function optimizeImageFile(file) {
  if (!file || !String(file.type || "").startsWith("image/")) return file;
  // GIFs animados perderiam a animação ao recomprimir em JPEG: não mexe.
  if (file.type === "image/gif") return file;

  try {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("read-failed"));
      r.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode-failed"));
      i.src = dataUrl;
    });

    const srcW = img.width || 1;
    const srcH = img.height || 1;
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => resolve(b), "image/jpeg", IMAGE_JPEG_QUALITY);
      } else {
        resolve(null);
      }
    });
    if (!blob || blob.size >= file.size) return file; // não piora o tamanho

    const baseName = String(file.name || "imagem").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Qualquer falha (CSP de canvas, imagem corrompida): envia o original.
    return file;
  }
}

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
  category,
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

  // Otimiza imagens antes do upload (PDF/MP3/MP4 passam intactos).
  const uploadFile = await optimizeImageFile(file);

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

  const safeName = String(uploadFile.name || "documento")
    .replace(/[^\w.-]+/g, "_")
    .slice(-160);
  const path = `adExitumDocs/${encodeURIComponent(conversationId)}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, path);

  // Upload resumível para emitir progresso por arquivo. O percentual é
  // reportado via `onProgress` enquanto os bytes são transferidos.
  if (typeof onProgress === "function") onProgress(0);
  const task = uploadBytesResumable(fileRef, uploadFile, {
    contentType: uploadFile.type || undefined,
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
    name: String(uploadFile.name || "documento").slice(0, 200),
    url,
    storagePath: path,
    size: Number(uploadFile.size) || 0,
    contentType: String(uploadFile.type || ""),
    senderId: String(senderUid),
    receiverId: String(receiverUid || ""),
    senderName: String(senderName || "").slice(0, 160),
    category: String(category || DOC_CATEGORY_PROCESS),
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
      attachment: {
        name: meta.name,
        size: meta.size,
        contentType: meta.contentType,
        url,
        storagePath: path,
      },
    });
  } catch (err) {
    console.warn("Falha ao publicar documento no chat:", err);
  }

  return { id: ref.id, ...meta };
}

/**
 * FASE 1 (upload em duas etapas): envia APENAS os bytes do arquivo para o
 * Firebase Storage, reportando o progresso (0-100). NÃO grava metadados no
 * Firestore nem publica no chat — isso fica para `commitWorkerDocuments`,
 * chamado quando o trabalhador confirma o envio (botão "Enviar"). Assim a
 * barra de progresso enche primeiro e o especialista só é notificado quando
 * o trabalhador de fato confirma.
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {File}   args.file
 * @param {string} args.senderUid
 * @param {string} args.senderName
 * @param {string} [args.peerName]
 * @param {(percent:number)=>void} [args.onProgress]
 * @returns {Promise<object>} metadados prontos para commit: { name, url,
 *   storagePath, size, contentType }.
 */
export async function stageWorkerDocument({
  conversationId,
  file,
  senderUid,
  senderName,
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

  const uploadFile = await optimizeImageFile(file);

  // Garante a conversa antes de gravar no Storage (as regras validam os
  // participantes) e para que os metadados de commit encontrem a conversa.
  await ensureConversation({
    conversationId,
    currentUid: senderUid,
    currentName: senderName,
    peerName: peerName || "Especialista",
    peerRole: "especialista",
    kind: "adExitum",
  });

  const safeName = String(uploadFile.name || "documento")
    .replace(/[^\w.-]+/g, "_")
    .slice(-160);
  const path = `adExitumDocs/${encodeURIComponent(conversationId)}/${Date.now()}_${safeName}`;
  const fileRef = storageRef(storage, path);

  if (typeof onProgress === "function") onProgress(0);
  const task = uploadBytesResumable(fileRef, uploadFile, {
    contentType: uploadFile.type || undefined,
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

  return {
    name: String(uploadFile.name || "documento").slice(0, 200),
    url,
    storagePath: path,
    size: Number(uploadFile.size) || 0,
    contentType: String(uploadFile.type || ""),
  };
}

/**
 * FASE 2: grava os metadados (Firestore) dos documentos já enviados ao
 * Storage por `stageWorkerDocument` e NOTIFICA o especialista publicando uma
 * mensagem no chat (atualiza `lastMessage` → sininho + "Mensagens recentes").
 * Envia uma única mensagem-resumo quando há vários arquivos.
 *
 * @param {object} args
 * @param {string} args.conversationId
 * @param {Array<object>} args.docs   itens vindos de `stageWorkerDocument`.
 * @param {string} args.senderUid
 * @param {string} args.senderName
 * @param {string} [args.receiverUid]
 * @param {string} [args.category]    "cliente" | "processo".
 * @returns {Promise<Array>} documentos gravados (com id).
 */
export async function commitWorkerDocuments({
  conversationId,
  docs,
  senderUid,
  senderName,
  receiverUid,
  category,
}) {
  const list = Array.isArray(docs) ? docs.filter(Boolean) : [];
  if (!conversationId || !senderUid || list.length === 0) return [];

  const cat = String(category || DOC_CATEGORY_PROCESS);
  const saved = [];
  for (const d of list) {
    const meta = {
      name: String(d.name || "documento").slice(0, 200),
      url: String(d.url || ""),
      storagePath: String(d.storagePath || ""),
      size: Number(d.size) || 0,
      contentType: String(d.contentType || ""),
      senderId: String(senderUid),
      receiverId: String(receiverUid || ""),
      senderName: String(senderName || "").slice(0, 160),
      category: cat,
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    };
    const ref = await addDoc(
      collection(db, "conversations", conversationId, "documents"),
      meta
    );
    saved.push({ id: ref.id, ...meta });
  }

  // Notifica o especialista: uma mensagem-resumo no chat.
  try {
    const label =
      cat === DOC_CATEGORY_CLIENT
        ? "Documentos do Cliente"
        : "Documentos para o especialista";
    const summary =
      saved.length === 1
        ? `📎 Enviei um novo documento (${label}): ${saved[0].name}`
        : `📎 Enviei ${saved.length} novos documentos (${label}).`;
    await sendChatMessage({
      conversationId,
      senderUid,
      senderName,
      text: summary,
    });
  } catch (err) {
    console.warn("Falha ao notificar o especialista sobre os documentos:", err);
  }

  return saved;
}

/**
 * Exclui um documento: remove o arquivo do Firebase Storage e a entrada de
 * metadados no Firestore. A operação é resiliente — se o arquivo já não
 * existir no Storage, ainda assim remove o registro no Firestore para manter
 * a lista consistente.
 *
 * @param {object} args
 * @param {string} args.conversationId  id da conversa.
 * @param {string} args.docId           id do documento no Firestore.
 * @param {string} [args.storagePath]   caminho do arquivo no Storage.
 * @returns {Promise<void>}
 */
export async function deleteWorkerDocument({ conversationId, docId, storagePath }) {
  if (!conversationId || !docId) {
    throw new Error("conversationId e docId são obrigatórios.");
  }

  // 1) Remove o arquivo do Storage (best-effort: ignora "object-not-found").
  if (storagePath) {
    try {
      await deleteObject(storageRef(storage, storagePath));
    } catch (err) {
      if (err?.code !== "storage/object-not-found") {
        console.warn("Falha ao remover arquivo do Storage:", err);
      }
    }
  }

  // 2) Remove o registro de metadados no Firestore.
  await deleteDoc(doc(db, "conversations", conversationId, "documents", docId));
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
