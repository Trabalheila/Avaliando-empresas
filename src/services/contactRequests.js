/**
 * contactRequests.js
 * --------------------------------------------------------------
 * Serviços para a "Conexão Premium" entre Apoiadores Premium
 * e Trabalhadores. Mantém privacidade: o e-mail real do
 * trabalhador nunca é exposto ao Apoiador antes de uma resposta
 * voluntária do trabalhador.
 *
 * Coleções no Firestore:
 *   - contactRequests/{id}
 *       fromUid           string  (Apoiador)
 *       fromCompanyName   string
 *       toUid             string  (Trabalhador)
 *       toPseudonym       string
 *       message           string
 *       status            "pending" | "accepted" | "declined"
 *       createdAt         ISO string
 *       respondedAt       ISO string | null
 *       reply             string | null   (mensagem do trabalhador)
 *       readByWorker      boolean
 *       revealEmail       boolean         (se o trabalhador autorizou
 *                                          revelar o e-mail dele)
 *
 *   - users/{uid}.isAvailableForContact   boolean
 *   - apoiadores/{uid}.contactCredits     number
 */

import {
  addDoc,
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
import { buildApiUrl } from "../utils/apiBase";
import { getSpecialistIdFromConversationId } from "../utils/chatId";

/* ──────────────────────────────────────────────────────────────
 *  Disponibilidade do trabalhador
 * ────────────────────────────────────────────────────────────── */

export async function setWorkerAvailability(uid, isAvailable) {
  if (!uid) throw new Error("uid obrigatório");
  await setDoc(
    doc(db, "users", uid),
    {
      isAvailableForContact: Boolean(isAvailable),
      isAvailableForContactUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function getWorkerAvailability(uid) {
  if (!uid) return false;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? Boolean(snap.data()?.isAvailableForContact) : false;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────
 *  Créditos de contato (Apoiador Premium / empresa)
 * ────────────────────────────────────────────────────────────── */

export async function getContactCredits(apoiadorUid) {
  if (!apoiadorUid) return 0;
  try {
    const snap = await getDoc(doc(db, "apoiadores", apoiadorUid));
    if (!snap.exists()) return 0;
    const value = Number(snap.data()?.contactCredits || 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export async function consumeContactCredit(apoiadorUid) {
  if (!apoiadorUid) throw new Error("apoiadorUid obrigatório");
  const ref = doc(db, "apoiadores", apoiadorUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Especialista não encontrado.");
  const current = Number(snap.data()?.contactCredits || 0);
  if (current <= 0) {
    const err = new Error("NO_CREDITS");
    err.code = "NO_CREDITS";
    throw err;
  }
  await updateDoc(ref, { contactCredits: current - 1 });
  return current - 1;
}

/* ──────────────────────────────────────────────────────────────
 *  Criação / leitura de pedidos de contato
 * ────────────────────────────────────────────────────────────── */

export async function createContactRequest({
  fromUid,
  fromCompanyName,
  toUid,
  toPseudonym,
  message,
  evidenceFiles,
}) {
  if (!fromUid) throw new Error("fromUid obrigatório");
  if (!toUid) throw new Error("toUid obrigatório");
  if (!message || !String(message).trim()) {
    throw new Error("Mensagem obrigatória.");
  }

  const safeEvidence = Array.isArray(evidenceFiles)
    ? evidenceFiles
        .filter((f) => f && /^https?:\/\//i.test(String(f.url || "")))
        .slice(0, 10)
        .map((f) => ({
          url: String(f.url),
          name: String(f.name || "arquivo").slice(0, 160),
          type: String(f.type || ""),
          size: Number(f.size) || 0,
        }))
    : [];

  const payload = {
    fromUid: String(fromUid),
    fromCompanyName: String(fromCompanyName || "").slice(0, 200),
    toUid: String(toUid),
    toPseudonym: String(toPseudonym || "").slice(0, 120),
    message: String(message).trim().slice(0, 2000),
    evidenceFiles: safeEvidence,
    status: "pending",
    readByWorker: false,
    revealEmail: false,
    reply: null,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    respondedAt: null,
  };

  const ref = await addDoc(collection(db, "contactRequests"), payload);

  /* Best-effort: notificar via e-mail (ignora erro de rede). */
  try {
    await fetch(buildApiUrl("/api/send-contact-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: ref.id, ...payload }),
    });
  } catch {
    /* silencioso – o pedido já foi salvo no Firestore */
  }

  return ref.id;
}

export async function listIncomingRequests(toUid, max = 100) {
  if (!toUid) return [];
  try {
    const q = query(
      collection(db, "contactRequests"),
      where("toUid", "==", toUid),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    /* fallback sem orderBy se índice ainda não foi criado */
    try {
      const q2 = query(
        collection(db, "contactRequests"),
        where("toUid", "==", toUid),
        limit(max)
      );
      const snap = await getDocs(q2);
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );
    } catch {
      console.warn("listIncomingRequests:", err);
      return [];
    }
  }
}

export async function countUnreadRequests(toUid) {
  const items = await listIncomingRequests(toUid, 100);
  return items.filter((r) => !r.readByWorker && r.status === "pending").length;
}

export async function markRequestRead(requestId) {
  if (!requestId) return;
  try {
    await updateDoc(doc(db, "contactRequests", requestId), {
      readByWorker: true,
    });
  } catch (err) {
    console.warn("markRequestRead:", err);
  }
}

export async function respondToRequest(requestId, { accept, reply, revealEmail }) {
  if (!requestId) throw new Error("requestId obrigatório");
  await updateDoc(doc(db, "contactRequests", requestId), {
    status: accept ? "accepted" : "declined",
    reply: accept ? String(reply || "").slice(0, 2000) : null,
    revealEmail: Boolean(accept && revealEmail),
    respondedAt: new Date().toISOString(),
    readByWorker: true,
  });
}

/* ════════════════════════════════════════════════════════════════
 *  Empresa Premium → Apoiador
 *  Coleção: contactRequestsApoiador
 *  Documento da empresa: companies/{companyId}.contactCredits
 * ════════════════════════════════════════════════════════════════ */

export async function getCompanyContactCredits(companyId) {
  if (!companyId) return 0;
  try {
    const snap = await getDoc(doc(db, "companies", companyId));
    if (!snap.exists()) return 0;
    const v = Number(snap.data()?.contactCredits || 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export async function consumeCompanyContactCredit(companyId) {
  if (!companyId) throw new Error("companyId obrigatório");
  const ref = doc(db, "companies", companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Empresa não encontrada.");
  const current = Number(snap.data()?.contactCredits || 0);
  if (current <= 0) {
    const err = new Error("NO_CREDITS");
    err.code = "NO_CREDITS";
    throw err;
  }
  await updateDoc(ref, { contactCredits: current - 1 });
  return current - 1;
}

export async function createApoiadorContactRequest({
  fromCompanyId,
  fromCompanyName,
  fromUid,
  toApoiadorId,
  toApoiadorName,
  message,
  evidenceFiles,
}) {
  if (!fromCompanyId) throw new Error("fromCompanyId obrigatório");
  if (!toApoiadorId) throw new Error("toApoiadorId obrigatório");
  if (!message || !String(message).trim()) {
    throw new Error("Mensagem obrigatória.");
  }

  // Busca o uid do Apoiador no Firestore para que as regras possam
  // validar a leitura/atualização pelo apoiador autenticado.
  let toApoiadorUid = "";
  try {
    const apoiadorSnap = await getDoc(doc(db, "apoiadores", String(toApoiadorId)));
    if (apoiadorSnap.exists()) {
      const d = apoiadorSnap.data() || {};
      toApoiadorUid = String(d.uid || d.authUid || d.userId || "");
    }
  } catch {
    /* silencioso */
  }

  const payload = {
    fromCompanyId: String(fromCompanyId),
    fromCompanyName: String(fromCompanyName || "").slice(0, 200),
    fromUid: String(fromUid || ""),
    toApoiadorId: String(toApoiadorId),
    toApoiadorUid,
    toApoiadorName: String(toApoiadorName || "").slice(0, 200),
    message: String(message).trim().slice(0, 2000),
    evidenceFiles: Array.isArray(evidenceFiles)
      ? evidenceFiles
          .filter((f) => f && /^https?:\/\//i.test(String(f.url || "")))
          .slice(0, 10)
          .map((f) => ({
            url: String(f.url),
            name: String(f.name || "arquivo").slice(0, 160),
            type: String(f.type || ""),
            size: Number(f.size) || 0,
          }))
      : [],
    status: "pending",
    readByApoiador: false,
    revealEmail: false,
    reply: null,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    respondedAt: null,
  };

  const ref = await addDoc(collection(db, "contactRequestsApoiador"), payload);

  try {
    await fetch(buildApiUrl("/api/send-contact-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "apoiador", requestId: ref.id, ...payload }),
    });
  } catch {
    /* silencioso */
  }

  return ref.id;
}

export async function listIncomingApoiadorRequests(toApoiadorId, max = 100, authUid = "") {
  // Consulta os pedidos endereçados ao especialista. Usamos DUAS chaves para
  // robustez: `toApoiadorId` (id do documento apoiadores) e `toApoiadorUid`
  // (UID do Firebase Auth). A regra do Firestore autoriza a leitura por
  // `toApoiadorUid == auth.uid`; consultar também por esse campo evita o
  // "0 pedidos" quando o id do documento e o UID diferem entre si.
  const keys = [];
  if (toApoiadorId) keys.push(["toApoiadorId", String(toApoiadorId)]);
  if (authUid && authUid !== toApoiadorId) keys.push(["toApoiadorUid", String(authUid)]);
  if (keys.length === 0) return [];

  const runQuery = async (field, value) => {
    try {
      const q = query(
        collection(db, "contactRequestsApoiador"),
        where(field, "==", value),
        orderBy("createdAt", "desc"),
        limit(max)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      // Sem índice composto: consulta sem ordenação e ordena em memória.
      try {
        const q2 = query(
          collection(db, "contactRequestsApoiador"),
          where(field, "==", value),
          limit(max)
        );
        const snap = await getDocs(q2);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        return [];
      }
    }
  };

  const results = await Promise.all(keys.map(([f, v]) => runQuery(f, v)));
  // Mescla e remove duplicatas (um pedido pode casar nas duas chaves).
  const byId = new Map();
  results.flat().forEach((r) => {
    if (r && r.id && !byId.has(r.id)) byId.set(r.id, r);
  });
  return Array.from(byId.values()).sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

export async function markApoiadorRequestRead(requestId) {
  if (!requestId) return;
  try {
    await updateDoc(doc(db, "contactRequestsApoiador", requestId), {
      readByApoiador: true,
    });
  } catch {
    /* silencioso */
  }
}

export async function respondToApoiadorRequest(
  requestId,
  { accept, reply, revealEmail }
) {
  if (!requestId) throw new Error("requestId obrigatório");
  await updateDoc(doc(db, "contactRequestsApoiador", requestId), {
    status: accept ? "accepted" : "declined",
    reply: accept ? String(reply || "").slice(0, 2000) : null,
    revealEmail: Boolean(accept && revealEmail),
    respondedAt: new Date().toISOString(),
    readByApoiador: true,
  });
}

/* ──────────────────────────────────────────────────────────────
 *  Pedidos de contato "Ad Exitum" (Trabalhador → Especialista)
 *
 *  Modelo exclusivo de advogados: o trabalhador pede para iniciar um
 *  atendimento sem custo inicial. O especialista precisa ACEITAR antes de
 *  qualquer troca de documentos. Reutilizamos a coleção
 *  `contactRequestsApoiador` (já lida pelo dashboard do especialista),
 *  marcando o pedido com `kind: "adExitum"`.
 * ────────────────────────────────────────────────────────────── */

export async function createAdExitumRequest({
  fromUid,
  fromName,
  toApoiadorId,
  toApoiadorName,
  specialtyId,
  conversationId,
  message,
}) {
  if (!fromUid) throw new Error("fromUid obrigatório");
  if (!toApoiadorId) throw new Error("toApoiadorId obrigatório");

  // Descobre o uid (e e-mail) do especialista para que as regras do
  // Firestore permitam a leitura/aceite pelo apoiador autenticado e para
  // que a notificação por e-mail seja enviada ao endereço cadastrado.
  let toApoiadorUid = "";
  let toApoiadorEmail = "";
  try {
    const apoiadorSnap = await getDoc(doc(db, "apoiadores", String(toApoiadorId)));
    if (apoiadorSnap.exists()) {
      const d = apoiadorSnap.data() || {};
      toApoiadorUid = String(d.uid || d.authUid || d.userId || "");
      toApoiadorEmail = String(d.email || "");
    }
  } catch {
    /* silencioso */
  }

  const payload = {
    kind: "adExitum",
    fromUid: String(fromUid),
    fromCompanyName: String(fromName || "Trabalhador").slice(0, 200),
    toApoiadorId: String(toApoiadorId),
    toApoiadorUid,
    toApoiadorName: String(toApoiadorName || "").slice(0, 200),
    specialtyId: String(specialtyId || "advogado"),
    conversationId: String(conversationId || ""),
    message: String(
      message ||
        "Pedido de contato Ad Exitum: o trabalhador deseja iniciar um atendimento sem custo inicial. Você aceita entrar em contato para avaliar o caso?"
    )
      .trim()
      .slice(0, 2000),
    evidenceFiles: [],
    status: "pending",
    readByApoiador: false,
    revealEmail: false,
    reply: null,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    respondedAt: null,
  };

  const ref = await addDoc(collection(db, "contactRequestsApoiador"), payload);

  /* Best-effort: notifica o especialista por e-mail (ignora erro de rede). */
  try {
    await fetch(buildApiUrl("/api/send-contact-request"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "adExitum",
        requestId: ref.id,
        toEmail: toApoiadorEmail,
        ...payload,
      }),
    });
  } catch {
    /* silencioso – o pedido já foi salvo no Firestore */
  }

  return ref.id;
}

/**
 * Retorna o status do pedido Ad Exitum mais recente entre um trabalhador
 * (`fromUid`) e um especialista (`toApoiadorId`): "pending" | "accepted" |
 * "declined" | "" (nenhum). Usado pelo chat para liberar o envio de
 * documentos apenas após o aceite do especialista.
 */
export async function getAdExitumRequestStatus(fromUid, toApoiadorId) {
  if (!fromUid || !toApoiadorId) return "";
  try {
    const q = query(
      collection(db, "contactRequestsApoiador"),
      where("fromUid", "==", fromUid),
      limit(50)
    );
    const snap = await getDocs(q);
    const matches = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter(
        (r) => r.kind === "adExitum" && String(r.toApoiadorId) === String(toApoiadorId)
      )
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
    return matches[0]?.status || "";
  } catch {
    return "";
  }
}

/**
 * Verifica se EXISTE um pedido Ad Exitum ACEITO para a conversa, considerando
 * tanto o lado do trabalhador (fromUid == uid) quanto o do especialista
 * (toApoiadorUid == uid). Usado pelo chat para liberar o upload de documentos
 * apenas após o aceite. `conversationId` segue o padrão
 * `spec_<apoiadorId>__u_<trabalhadorId>` (ou o legado `spec_<apoiadorId>`).
 */
export async function isAdExitumAccepted({ conversationId, uid }) {
  if (!conversationId || !uid) return false;
  const toApoiadorId = getSpecialistIdFromConversationId(conversationId);

  // 1) Como trabalhador solicitante.
  try {
    const q1 = query(
      collection(db, "contactRequestsApoiador"),
      where("fromUid", "==", uid),
      limit(50)
    );
    const s1 = await getDocs(q1);
    if (
      s1.docs.some((d) => {
        const r = d.data() || {};
        return (
          r.kind === "adExitum" &&
          String(r.toApoiadorId) === toApoiadorId &&
          r.status === "accepted"
        );
      })
    ) {
      return true;
    }
  } catch {
    /* silencioso */
  }

  // 2) Como especialista destinatário.
  try {
    const q2 = query(
      collection(db, "contactRequestsApoiador"),
      where("toApoiadorUid", "==", uid),
      limit(50)
    );
    const s2 = await getDocs(q2);
    if (
      s2.docs.some((d) => {
        const r = d.data() || {};
        return r.kind === "adExitum" && r.status === "accepted";
      })
    ) {
      return true;
    }
  } catch {
    /* silencioso */
  }

  return false;
}

/**
 * Lista os pedidos Ad Exitum ACEITOS em que o trabalhador (`fromUid`) é o
 * solicitante. Cada item traz o especialista (`toApoiadorId`,
 * `toApoiadorUid`, `toApoiadorName`, `specialtyId`) e o `conversationId`,
 * permitindo abrir o chat e enviar documentos. Usado pela página
 * "Minha Conta" (Contatos Liberados + Meus Documentos para Especialistas).
 *
 * @param {string} fromUid  UID do trabalhador logado.
 * @param {number} [max]    limite de leitura.
 * @returns {Promise<Array>} pedidos aceitos, mais recentes primeiro.
 */
export async function listAcceptedAdExitumForWorker(fromUid, max = 50) {
  if (!fromUid) return [];
  try {
    const q = query(
      collection(db, "contactRequestsApoiador"),
      where("fromUid", "==", fromUid),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.kind === "adExitum" && r.status === "accepted")
      .sort((a, b) =>
        String(b.respondedAt || b.createdAt || "").localeCompare(
          String(a.respondedAt || a.createdAt || "")
        )
      );
  } catch (err) {
    console.warn("listAcceptedAdExitumForWorker:", err);
    return [];
  }
}
