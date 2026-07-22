// src/services/caseManagement.js
//
// Serviço de acompanhamento completo do processo, usado pelo painel do
// advogado em /especialista/advogado/caso/:caseId.
//
// Estrutura no Firestore (sob o caso do especialista):
//   apoiadores/{specialistId}/cases/{caseId}
//     processDetails { processNumber, court, status, processValue,
//                      nextActionText, nextActionDate }
//     checklist [{ id, label, done, custom }]
//     updatedBy / updatedAt
//   apoiadores/{specialistId}/cases/{caseId}/history/{id}        (cronológico)
//   apoiadores/{specialistId}/cases/{caseId}/privateNotes/{id}   (SÓ advogado)
//   apoiadores/{specialistId}/cases/{caseId}/deadlines/{id}      (prazos)
//   apoiadores/{specialistId}/cases/{caseId}/caseDocuments/{id}  (docs + Storage)
//
// SEGURANÇA: as regras do Firestore garantem que `privateNotes` NUNCA seja
// legível pelo UID do trabalhador — apenas pelo especialista dono do perfil.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage, auth } from "../firebase";

/** Referência ao documento do caso. */
function caseRef(specialistId, caseId) {
  return doc(db, "apoiadores", String(specialistId), "cases", String(caseId));
}

/** Referência a uma subcoleção do caso. */
function caseSubcol(specialistId, caseId, sub) {
  return collection(db, "apoiadores", String(specialistId), "cases", String(caseId), sub);
}

/** UID do especialista autenticado (usado em updatedBy / auditoria). */
function currentUid() {
  return auth.currentUser?.uid || "";
}

// ─────────────────────────────────────────────────────────────────────────
// DETALHES DO PROCESSO (campo `processDetails` no doc do caso)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Salva/atualiza os detalhes do processo no doc do caso e registra a
 * alteração no histórico. Retorna os detalhes salvos.
 */
export async function saveProcessDetails(specialistId, caseId, details) {
  if (!specialistId || !caseId) throw new Error("specialistId e caseId obrigatórios.");
  const clean = {
    processNumber: String(details?.processNumber || "").slice(0, 120),
    court: String(details?.court || "").slice(0, 160),
    status: String(details?.status || "").slice(0, 60),
    processValue: Number(details?.processValue) || 0,
    nextActionText: String(details?.nextActionText || "").slice(0, 300),
    nextActionDate: String(details?.nextActionDate || "").slice(0, 30),
  };

  await setDoc(
    caseRef(specialistId, caseId),
    {
      processDetails: clean,
      updatedBy: currentUid(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return clean;
}

// ─────────────────────────────────────────────────────────────────────────
// HISTÓRICO DE ATUALIZAÇÕES (subcoleção `history`, imutável após salvo)
// ─────────────────────────────────────────────────────────────────────────

/** Adiciona uma entrada ao histórico do caso (data/hora automática). */
export async function addHistoryEntry(specialistId, caseId, text, meta = {}) {
  if (!specialistId || !caseId) throw new Error("specialistId e caseId obrigatórios.");
  const payload = {
    text: String(text || "").slice(0, 1000),
    createdBy: currentUid(),
    createdAt: serverTimestamp(),
    ...meta,
  };
  const ref = await addDoc(caseSubcol(specialistId, caseId, "history"), payload);
  return ref.id;
}

/** Lista o histórico do caso em ordem cronológica crescente. */
export async function listHistory(specialistId, caseId) {
  const snap = await getDocs(
    query(caseSubcol(specialistId, caseId, "history"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────────────────
// NOTAS PRIVADAS DO ADVOGADO (subcoleção `privateNotes`, visibleTo=specialist)
// ─────────────────────────────────────────────────────────────────────────

export async function addPrivateNote(specialistId, caseId, text) {
  if (!String(text || "").trim()) throw new Error("A anotação não pode ficar vazia.");
  const payload = {
    text: String(text).slice(0, 5000),
    visibleTo: "specialist",
    createdBy: currentUid(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(caseSubcol(specialistId, caseId, "privateNotes"), payload);
  return ref.id;
}

export async function listPrivateNotes(specialistId, caseId) {
  const snap = await getDocs(
    query(caseSubcol(specialistId, caseId, "privateNotes"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updatePrivateNote(specialistId, caseId, noteId, text) {
  await updateDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "privateNotes", String(noteId)),
    { text: String(text || "").slice(0, 5000), updatedAt: serverTimestamp() }
  );
}

export async function deletePrivateNote(specialistId, caseId, noteId) {
  await deleteDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "privateNotes", String(noteId))
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CHECKLIST (campo `checklist` no doc do caso)
// ─────────────────────────────────────────────────────────────────────────

/** Salva o array completo do checklist no doc do caso. */
export async function saveChecklist(specialistId, caseId, items) {
  const clean = (Array.isArray(items) ? items : []).slice(0, 100).map((it, i) => ({
    id: String(it.id || `chk_${i}`),
    label: String(it.label || "").slice(0, 200),
    done: Boolean(it.done),
    custom: Boolean(it.custom),
  }));
  await setDoc(
    caseRef(specialistId, caseId),
    { checklist: clean, updatedBy: currentUid(), updatedAt: serverTimestamp() },
    { merge: true }
  );
  return clean;
}

// ─────────────────────────────────────────────────────────────────────────
// PRAZOS (subcoleção `deadlines`)
// ─────────────────────────────────────────────────────────────────────────

export async function addDeadline(specialistId, caseId, { description, dueDate }) {
  if (!String(description || "").trim()) throw new Error("Descrição do prazo obrigatória.");
  if (!dueDate) throw new Error("Data limite obrigatória.");
  const payload = {
    description: String(description).slice(0, 300),
    dueDate: String(dueDate).slice(0, 30),
    status: "pendente",
    reminderSent: false,
    createdBy: currentUid(),
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(caseSubcol(specialistId, caseId, "deadlines"), payload);
  return ref.id;
}

export async function listDeadlines(specialistId, caseId) {
  const snap = await getDocs(
    query(caseSubcol(specialistId, caseId, "deadlines"), orderBy("dueDate", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setDeadlineStatus(specialistId, caseId, deadlineId, status) {
  await updateDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "deadlines", String(deadlineId)),
    { status: status === "concluido" ? "concluido" : "pendente", updatedAt: serverTimestamp() }
  );
}

export async function deleteDeadline(specialistId, caseId, deadlineId) {
  await deleteDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "deadlines", String(deadlineId))
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DOCUMENTOS DO CASO (subcoleção `caseDocuments` + Firebase Storage)
// ─────────────────────────────────────────────────────────────────────────

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
];

/** Faz upload de um documento do caso ao Storage e registra no Firestore. */
export async function uploadCaseDocument(specialistId, caseId, file, { description = "", visibleToWorker = false } = {}) {
  if (!file) throw new Error("Selecione um arquivo.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Arquivo excede o limite de 25 MB.");
  if (file.type && !ALLOWED_DOC_TYPES.includes(file.type)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, DOC/DOCX ou imagem.");
  }
  const safeName = (file.name || "documento").replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `caseDocuments/${specialistId}/${caseId}/${Date.now()}-${safeName}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(sRef);

  const payload = {
    name: file.name || safeName,
    description: String(description || "").slice(0, 300),
    type: file.type || "",
    size: file.size || 0,
    storagePath: path,
    url,
    visibleToWorker: Boolean(visibleToWorker),
    uploadedBy: currentUid(),
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(caseSubcol(specialistId, caseId, "caseDocuments"), payload);
  return { id: ref.id, ...payload, url };
}

export async function listCaseDocuments(specialistId, caseId) {
  const snap = await getDocs(
    query(caseSubcol(specialistId, caseId, "caseDocuments"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setDocumentVisibility(specialistId, caseId, docId, visibleToWorker) {
  await updateDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "caseDocuments", String(docId)),
    { visibleToWorker: Boolean(visibleToWorker), updatedAt: serverTimestamp() }
  );
}

export async function deleteCaseDocument(specialistId, caseId, docItem) {
  if (docItem?.storagePath) {
    try {
      await deleteObject(storageRef(storage, docItem.storagePath));
    } catch {
      /* segue: remove o registro mesmo se o objeto já não existir */
    }
  }
  await deleteDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "caseDocuments", String(docItem.id))
  );
}

// ─────────────────────────────────────────────────────────────────────────
// LEITURA CONSOLIDADA / STATUS DE COMISSÃO
// ─────────────────────────────────────────────────────────────────────────

/** Lê o doc do caso (processDetails, checklist, campos de pagamento). */
export async function getCaseDoc(specialistId, caseId) {
  const snap = await getDoc(caseRef(specialistId, caseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
