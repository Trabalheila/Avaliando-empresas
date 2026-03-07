import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

export function slugifyCompany(name) {
  return (name ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "");
}

export function getCompanyBySlug(companies, slug) {
  const target = (slug ?? "").toString().trim().toLowerCase();

  return (
    (companies ?? []).find((c) => {
      const name = c?.name ?? c?.companyName ?? c?.nome ?? "";
      const cSlug = (c?.slug ?? slugifyCompany(name)).toLowerCase();
      return cSlug === target;
    }) ?? null
  );
}

export async function listReviewsByCompanySlug(slug, take = 80) {
  const ref = collection(db, "reviews");
  const q = query(
    ref,
    where("companySlug", "==", slug),
    orderBy("createdAt", "desc"),
    limit(take)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveReview(review) {
  if (!review?.company || !review?.pseudonym) {
    throw new Error("Empresa e pseudônimo são obrigatórios para salvar a avaliação.");
  }

  const companySlug = slugifyCompany(review.company);
  const pseudonymSlug = slugifyCompany(review.pseudonym);
  const reviewId = `${companySlug}_${pseudonymSlug}`;
  const reviewRef = doc(db, "reviews", reviewId);

  const existing = await getDoc(reviewRef);
  if (existing.exists()) {
    throw new Error("Você já avaliou essa empresa com este pseudônimo.");
  }

  const payload = {
    ...review,
    companySlug,
    createdAt: serverTimestamp(),
  };

  await setDoc(reviewRef, payload);
  return { id: reviewId, ...payload };
}

export async function reactToReview({ reviewId, uid, reaction }) {
  // Guarda 1 reação por usuário por review (evita inflar contador repetindo clique)
  const reactionId = `${reviewId}_${uid}`;
  const reactionRef = doc(db, "reviewReactions", reactionId);

  const existing = await getDoc(reactionRef);
  if (existing.exists()) return; // já reagiu, não conta de novo

  await setDoc(reactionRef, {
    reviewId,
    uid,
    reaction,
    createdAt: serverTimestamp(),
  });

  const reviewRef = doc(db, "reviews", reviewId);
  await updateDoc(reviewRef, {
    [`reactions.${reaction}`]: increment(1),
  });
}
