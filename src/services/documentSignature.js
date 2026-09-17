// src/services/documentSignature.js
//
// Envio de documentos do caso para assinatura do cliente via Gov.br.
//
// Estrutura no Firestore (mesmo padrão de src/services/caseManagement.js):
//   apoiadores/{specialistId}/cases/{caseId}/documentsForSignature/{docId}
//     documentTitle, originalUrl, signedUrl, status ('pending'|'signed'|'rejected'),
//     sentAt, signedAt, sentByUserId, signedByUserId, workerUid, clientAccessToken
//
// O link enviado ao cliente (`clientAccessLink`) NUNCA expõe o caminho
// interno do documento — carrega apenas um token opaco. Quem resolve o
// token em (specialistId, caseId, docId) é sempre o backend
// (api/case-documents.js), via Admin SDK, então o token pode ser lido por
// qualquer pessoa com o link sem violar as regras do Firestore.

import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  collectionGroup,
  where,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase";
import { buildApiUrl } from "../utils/apiBase";

/** Traduz erros comuns do Firebase Storage para mensagens amigáveis ao usuário. */
export function friendlyStorageErrorMessage(err) {
  if (err?.code === "storage/unauthorized" && !auth.currentUser) {
    return "Sua sessão do Firebase expirou. Faça login novamente e tente enviar o documento.";
  }
  if (err?.code === "storage/unauthorized") {
    return "Erro de permissão ao enviar o documento. Por favor, verifique suas permissões ou tente novamente mais tarde.";
  }
  return err?.message || "Não foi possível enviar o documento. Tente novamente.";
}

function caseSubcol(specialistId, caseId, sub) {
  return collection(db, "apoiadores", String(specialistId), "cases", String(caseId), sub);
}

function currentUid() {
  return auth.currentUser?.uid || "";
}

/** Gera um token opaco e aleatório para o link de acesso do cliente. */
function generateAccessToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback improvável (ambientes sem Web Crypto): ainda assim único o
  // bastante para um link de curta duração.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function buildClientAccessLink(token) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/assinatura/${token}`;
}

/** Aceita tanto o token puro quanto o `clientAccessLink` completo (`.../assinatura/{token}`). */
function extractToken(tokenOrLink) {
  const value = String(tokenOrLink || "").trim();
  const match = value.match(/\/assinatura\/([^/?#]+)/);
  return match ? match[1] : value;
}

/**
 * Busca os detalhes do documento a partir do `clientAccessLink` (ou token
 * puro) recebido pelo cliente. Resolvido no backend (Admin SDK), que nunca
 * expõe specialistId/caseId/docId ao cliente.
 */
export async function getDocumentByAccessToken(tokenOrLink) {
  const token = extractToken(tokenOrLink);
  if (!token) throw new Error("Link de acesso inválido.");
  const resp = await fetch(
    buildApiUrl(`/api/documents/client-view?token=${encodeURIComponent(token)}`)
  );
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.ok) {
    throw new Error(json?.error || "Documento não encontrado ou link inválido.");
  }
  return json.document;
}

/**
 * Inicia o fluxo de assinatura via Gov.br para o documento identificado
 * pelo `clientAccessLink`/token. Retorna a URL para onde o navegador deve
 * ser redirecionado.
 */
export async function startGovBrSignature(tokenOrLink) {
  const token = extractToken(tokenOrLink);
  if (!token) throw new Error("Link de acesso inválido.");
  const resp = await fetch(buildApiUrl("/api/documents/govbr-start"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.ok || !json?.redirectUrl) {
    throw new Error(json?.error || "Não foi possível iniciar a assinatura via Gov.br.");
  }
  return json.redirectUrl;
}

/** Lista os documentos enviados para assinatura neste caso (mais recentes primeiro). */
export async function listDocumentsForSignature(specialistId, caseId) {
  if (!specialistId || !caseId) return [];
  const snap = await getDocs(
    query(caseSubcol(specialistId, caseId, "documentsForSignature"), orderBy("sentAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Registra o envio de um documento para assinatura e dispara a notificação
 * (e-mail + sino de notificações) ao cliente. Retorna o documento criado,
 * incluindo `clientAccessLink`.
 */
export async function sendDocumentForSignature(
  specialistId,
  caseId,
  { documentTitle, originalUrl, workerUid, specialistName = "" }
) {
  if (!specialistId || !caseId) throw new Error("specialistId e caseId obrigatórios.");
  if (!String(documentTitle || "").trim()) throw new Error("Informe o título do documento.");
  if (!String(originalUrl || "").trim()) throw new Error("Selecione ou envie o documento.");
  if (!String(workerUid || "").trim()) {
    throw new Error("Não foi possível identificar o cliente deste caso.");
  }

  const clientAccessToken = generateAccessToken();
  const payload = {
    documentTitle: String(documentTitle).slice(0, 200),
    originalUrl: String(originalUrl),
    signedUrl: null,
    status: "pending",
    sentAt: serverTimestamp(),
    signedAt: null,
    sentByUserId: currentUid(),
    signedByUserId: null,
    workerUid: String(workerUid),
    clientAccessToken,
  };

  const ref = await addDoc(caseSubcol(specialistId, caseId, "documentsForSignature"), payload);
  const clientAccessLink = buildClientAccessLink(clientAccessToken);

  // Notificação best-effort: nunca deve quebrar o fluxo de envio.
  try {
    await fetch(buildApiUrl("/api/documents/notify-send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialistId,
        caseId,
        documentId: ref.id,
        documentTitle: payload.documentTitle,
        workerUid,
        specialistName,
        clientAccessLink,
      }),
      keepalive: true,
    });
  } catch {
    /* silencioso — o documento já foi registrado no Firestore */
  }

  return { id: ref.id, ...payload, clientAccessLink };
}

/** Reenvia o e-mail/notificação de lembrete para um documento pendente. */
export async function resendSignatureReminder(specialistId, caseId, documentItem) {
  if (!documentItem?.clientAccessToken) return { ok: false };
  const clientAccessLink = buildClientAccessLink(documentItem.clientAccessToken);
  try {
    await fetch(buildApiUrl("/api/documents/notify-send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialistId,
        caseId,
        documentId: documentItem.id,
        documentTitle: documentItem.documentTitle,
        workerUid: documentItem.workerUid,
        clientAccessLink,
        reminder: true,
      }),
      keepalive: true,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Marca um documento como recusado pelo cliente (usado por telas internas, se necessário). */
export async function markDocumentRejected(specialistId, caseId, documentId) {
  await updateDoc(
    doc(
      db,
      "apoiadores",
      String(specialistId),
      "cases",
      String(caseId),
      "documentsForSignature",
      String(documentId)
    ),
    { status: "rejected" }
  );
}

/** Lista, via collectionGroup, todos os documentos para assinatura vinculados ao trabalhador logado. */
export async function listDocumentsForWorker(workerUid) {
  if (!workerUid) return [];
  const snap = await getDocs(
    query(collectionGroup(db, "documentsForSignature"), where("workerUid", "==", String(workerUid)))
  );
  return snap.docs.map((d) => {
    // Caminho: apoiadores/{specialistId}/cases/{caseId}/documentsForSignature/{docId}
    const caseRef = d.ref.parent.parent;
    const specialistId = caseRef?.parent?.parent?.id || "";
    const caseId = caseRef?.id || "";
    return { id: d.id, specialistId, caseId, ...d.data() };
  });
}

/**
 * Faz o upload do documento assinado (baixado do Gov.br) de volta para o
 * Storage e atualiza o Firestore (signedUrl/status/signedAt/signedByUserId).
 * Chamado pelo próprio trabalhador logado a partir do seu painel.
 */
export async function uploadSignedDocument(specialistId, caseId, documentId, { file, workerUid }) {
  if (!specialistId || !caseId || !documentId) throw new Error("Documento inválido.");
  if (!file) throw new Error("Selecione o arquivo assinado para enviar.");
  if (!workerUid) throw new Error("Não foi possível identificar o usuário logado.");

  const safeName = String(file.name || "documento_assinado").replace(/[^\w.-]+/g, "_").slice(0, 120);
  const path = `documentsForSignature/${specialistId}/${caseId}/signed/${Date.now()}-${safeName}`;
  const sRef = storageRef(storage, path);
  let signedUrl;
  try {
    await uploadBytes(sRef, file);
    signedUrl = await getDownloadURL(sRef);
  } catch (err) {
    console.error("Erro detalhado de permissão no Firebase Storage:", err);
    throw err;
  }

  await updateDoc(
    doc(db, "apoiadores", String(specialistId), "cases", String(caseId), "documentsForSignature", String(documentId)),
    {
      status: "signed",
      signedUrl,
      signedAt: serverTimestamp(),
      signedByUserId: workerUid,
    }
  );

  return { signedUrl };
}
