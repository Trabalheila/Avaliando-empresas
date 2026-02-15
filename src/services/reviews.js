import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export function slugifyCompany(name) {
  return (name ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+|-+/g, ""); // <- não pode quebrar linha aqui
}



/**
 * review esperado (exemplo):
 * {
 *  companyName, companySlug,
 *  tenure: "2018–2022" (ou "1–2 anos"),
 *  ratings: { geral, rh, salario, estrutura, lideranca, carreira, bemestar, organizacao },
 *  commentGeral,
 *  comments: { geral, rh, salario ... } // opcionais
 * }
 */
export async function createReview(review) {
  const reviewsRef = collection(db, "reviews");
  const payload = {
    ...review,
    createdAt: serverTimestamp(),
    reactions: { like: 0, dislike: 0, heart: 0, wow: 0, angry: 0 },
  };
  const res = await addDoc(reviewsRef, payload);
  return res.id;
}

export async function listReviewsByCompanySlug(companySlug, max = 50) {
  const q = query(
    collection(db, "reviews"),
    where("companySlug", "==", companySlug),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getCompanyBySlug(companySlug) {
  const ref = doc(db, "companies", companySlug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Reação por review com proteção contra múltiplos votos:
 * - grava a reação do user em: reviewReactions/{reviewId}/users/{uid}
 * - ajusta contadores em reviews/{reviewId}.reactions
 */
export async function reactToReview({ reviewId, uid, reaction }) {
  const valid = ["like", "dislike", "heart", "wow", "angry"];
  if (!valid.includes(reaction)) throw new Error("Reação inválida.");

  const reviewRef = doc(db, "reviews", reviewId);
  const userReactionRef = doc(db, "reviewReactions", reviewId, "users", uid);

  await runTransaction(db, async (tx) => {
    const [reviewSnap, userSnap] = await Promise.all([
      tx.get(reviewRef),
      tx.get(userReactionRef),
    ]);

    if (!reviewSnap.exists()) throw new Error("Review não encontrado.");

    const current = reviewSnap.data()?.reactions || {};
    const prev = userSnap.exists() ? userSnap.data()?.reaction : null;

    const nextCounts = { ...current };

    if (prev && nextCounts[prev] != null) {
      nextCounts[prev] = Math.max(0, nextCounts[prev] - 1);
    }

    nextCounts[reaction] = (nextCounts[reaction] || 0) + 1;

    tx.set(
      userReactionRef,
      { reaction, updatedAt: serverTimestamp() },
      { merge: true }
    );
    tx.set(reviewRef, { reactions: nextCounts }, { merge: true });
  });
}

/**
 * Seed opcional: cria/atualiza company doc
 * companies/{slug} { name, logoUrl, google: { ... } }
 */
export async function upsertCompany({ name, logoUrl = "" }) {
  const slug = slugifyCompany(name);
  await setDoc(
    doc(db, "companies", slug),
    { name, slug, logoUrl, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return slug;
}
