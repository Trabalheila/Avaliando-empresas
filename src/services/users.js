import { db } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp, deleteDoc, collection, getDocs, limit, query, where } from "firebase/firestore";

export async function saveUserProfile(profile) {
  if (!profile) return null;
  const id = profile.id || profile.uid || profile.userId;
  if (!id) {
    throw new Error("Usuário precisa de um identificador (id) para ser salvo.");
  }

  const payload = {
    ...profile,
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

export async function deleteUserProfile(id) {
  if (!id) return false;
  const ref = doc(db, "users", id.toString());
  await deleteDoc(ref);
  return true;
}
