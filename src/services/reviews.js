import { auth, db } from "../firebase";
import { signInAnonymously } from "firebase/auth";
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
  deleteDoc,
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
  // Evita depender de índice composto (companySlug + createdAt).
  const q = query(ref, where("companySlug", "==", slug), limit(take));

  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toDate === "function") {
      return value.toDate().getTime();
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
}

export async function listRecentReviews(take = 1000) {
  const ref = collection(db, "reviews");
  const q = query(ref, orderBy("createdAt", "desc"), limit(take));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveReview(review) {
  if (!review?.company || !review?.pseudonym) {
    throw new Error("Empresa e pseudônimo são obrigatórios para salvar a avaliação.");
  }

  // Certifica que há um usuário autenticado (pode ser anônimo) antes de gravar no Firestore.
  if (!auth.currentUser) {
    await signInAnonymously(auth);
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

export function isReviewOwnedByCurrentUser(review, options = {}) {
  const currentProfileId = (options.profileId || "").toString().trim();
  const reviewProfileId = (review?.authorProfileId || review?.profileId || "").toString().trim();

  if (currentProfileId && reviewProfileId) {
    return currentProfileId === reviewProfileId;
  }

  const currentPseudonymSlug = slugifyCompany(options.pseudonym || "");
  const reviewPseudonymSlug = slugifyCompany(review?.pseudonym || "");

  return Boolean(currentPseudonymSlug && reviewPseudonymSlug && currentPseudonymSlug === reviewPseudonymSlug);
}

export async function deleteOwnReview({ reviewId, currentProfileId = "", currentPseudonym = "" }) {
  if (!reviewId) {
    throw new Error("Avaliação inválida para exclusão.");
  }

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const reviewRef = doc(db, "reviews", reviewId);
  const existing = await getDoc(reviewRef);

  if (!existing.exists()) {
    return { deleted: false, reason: "not_found" };
  }

  const review = { id: existing.id, ...existing.data() };
  if (!isReviewOwnedByCurrentUser(review, { profileId: currentProfileId, pseudonym: currentPseudonym })) {
    throw new Error("Você só pode apagar avaliações feitas pelo seu próprio perfil.");
  }

  await deleteDoc(reviewRef);

  const reactionSnap = await getDocs(query(collection(db, "reviewReactions"), where("reviewId", "==", reviewId), limit(200)));
  await Promise.all(reactionSnap.docs.map((reactionDoc) => deleteDoc(reactionDoc.ref)));

  return { deleted: true, review };
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
