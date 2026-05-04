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
  if (!snap.exists()) throw new Error("Apoiador não encontrado.");
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
}) {
  if (!fromUid) throw new Error("fromUid obrigatório");
  if (!toUid) throw new Error("toUid obrigatório");
  if (!message || !String(message).trim()) {
    throw new Error("Mensagem obrigatória.");
  }

  const payload = {
    fromUid: String(fromUid),
    fromCompanyName: String(fromCompanyName || "").slice(0, 200),
    toUid: String(toUid),
    toPseudonym: String(toPseudonym || "").slice(0, 120),
    message: String(message).trim().slice(0, 2000),
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
    await fetch(buildApiUrl("/api/send-contact-request-apoiador"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: ref.id, ...payload }),
    });
  } catch {
    /* silencioso */
  }

  return ref.id;
}

export async function listIncomingApoiadorRequests(toApoiadorId, max = 100) {
  if (!toApoiadorId) return [];
  try {
    const q = query(
      collection(db, "contactRequestsApoiador"),
      where("toApoiadorId", "==", toApoiadorId),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const q2 = query(
        collection(db, "contactRequestsApoiador"),
        where("toApoiadorId", "==", toApoiadorId),
        limit(max)
      );
      const snap = await getDocs(q2);
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
