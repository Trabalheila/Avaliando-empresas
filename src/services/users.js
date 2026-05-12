import { db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc, collection, getDocs, limit, query, where } from "firebase/firestore";

export async function saveUserProfile(profile) {
  if (!profile) return null;
  const id = profile.id || profile.uid || profile.userId;
  if (!id) {
    throw new Error("Usuário precisa de um identificador (id) para ser salvo.");
  }

  // Auto-define o status do cadastro a partir do pseudônimo, sem aprovação manual:
  //   pseudônimo preenchido  -> 'ativo'
  //   pseudônimo vazio       -> 'incompleto'
  // Só aplica quando o caller não passou um status explícito, para não
  // sobrescrever ações do admin (ex.: 'rejected').
  let derivedStatus;
  if (profile.status === undefined || profile.status === null || profile.status === "") {
    const hasPseudonym = Boolean(
      (profile.pseudonimo || profile.pseudonym || "").toString().trim()
    );
    derivedStatus = hasPseudonym ? "ativo" : "incompleto";
  }

  const payload = {
    ...profile,
    ...(derivedStatus ? { status: derivedStatus } : {}),
    updatedAt: serverTimestamp(),
  };

  const ref = doc(db, "users", id.toString());
  await setDoc(ref, payload, { merge: true });
  return { id: id.toString(), ...payload };
}

export async function getUserProfile(id) {
  if (!id) return null;
  const ref = doc(db, "users", id.toString());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getUserProfileByCpf(cpf) {
  const normalizedCpf = (cpf || "").toString().replace(/\D/g, "");
  if (!normalizedCpf) return null;

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("cpf", "==", normalizedCpf), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
}

export async function getUserProfileByEmail(email) {
  const normalized = (email || "").toString().trim().toLowerCase();
  if (!normalized) return null;

  const usersRef = collection(db, "users");
  const q = query(usersRef, where("email", "==", normalized), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const first = snap.docs[0];
  return { id: first.id, ...first.data() };
}

/**
 * Tenta encontrar um perfil unificado por qualquer identificador disponível.
 * Ordem: ID direto → email → CPF. Retorna o primeiro encontrado.
 */
export async function findUnifiedProfile({ id, email, cpf } = {}) {
  // 1. Tenta pelo ID direto
  if (id) {
    const byId = await getUserProfile(id);
    if (byId) return byId;
  }

  // 2. Tenta pelo email (pode estar salvo com outro ID de provider)
  if (email) {
    const byEmail = await getUserProfileByEmail(email);
    if (byEmail) return byEmail;
  }

  // 3. Tenta pelo CPF
  if (cpf) {
    const byCpf = await getUserProfileByCpf(cpf);
    if (byCpf) return byCpf;
  }

  return null;
}

export async function deleteUserProfile(id) {
  if (!id) return false;
  const ref = doc(db, "users", id.toString());
  await deleteDoc(ref);
  return true;
}
