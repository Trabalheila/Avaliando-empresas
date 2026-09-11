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
import { buildApiUrl } from "../utils/apiBase";
import { createNotification } from "./notifications";

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

// Calcula o doc id determinístico usado em `reviews` para (empresa, pseudônimo/uid).
function buildReviewId(companyName, pseudonym, uid) {
  const companySlug = slugifyCompany(companyName);
  const rawPseudonym = (pseudonym || "").toString().trim();
  const pseudonymSlug = rawPseudonym
    ? slugifyCompany(rawPseudonym)
    : `anon-${(uid || "").slice(0, 12)}`;
  return { companySlug, reviewId: `${companySlug}_${pseudonymSlug}` };
}

/**
 * Busca uma avaliação já existente do usuário (por pseudônimo ou UID
 * anônimo) para a empresa informada. Usada para oferecer edição em vez de
 * bloquear com erro de duplicidade.
 */
export async function findExistingReview(companyName, pseudonym) {
  if (!companyName) return null;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch {
      return null;
    }
  }
  const uid = auth.currentUser?.uid;
  const { reviewId } = buildReviewId(companyName, pseudonym, uid);
  const snap = await getDoc(doc(db, "reviews", reviewId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Atualiza uma avaliação existente (fluxo de edição). Preserva `createdAt`
 * e `uid` originais, atualizando os demais campos e marcando `updatedAt`.
 */
export async function updateReview(reviewId, review) {
  if (!reviewId) {
    throw new Error("reviewId é obrigatório para editar a avaliação.");
  }
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  const reviewRef = doc(db, "reviews", reviewId);
  const existing = await getDoc(reviewRef);
  if (!existing.exists()) {
    throw new Error("Avaliação original não encontrada para edição.");
  }

  const rawPseudonym = (review.pseudonym || "").toString().trim();
  const payload = {
    ...review,
    pseudonym: rawPseudonym,
    companySlug: slugifyCompany(review.company),
    isAnonymousAuthor: !rawPseudonym,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(reviewRef, payload);
  return { id: reviewId, ...existing.data(), ...payload };
}

export async function saveReview(review) {
  if (!review?.company) {
    throw new Error("Empresa é obrigatória para salvar a avaliação.");
  }

  // Certifica que há um usuário autenticado (pode ser anônimo) antes de gravar no Firestore.
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const uid = auth.currentUser.uid;
  const { companySlug, reviewId } = buildReviewId(review.company, review.pseudonym, uid);
  const rawPseudonym = (review.pseudonym || "").toString().trim();
  const reviewRef = doc(db, "reviews", reviewId);

  const existing = await getDoc(reviewRef);
  if (existing.exists()) {
    throw new Error(
      rawPseudonym
        ? "Você já avaliou essa empresa com este pseudônimo."
        : "Você já enviou uma avaliação para esta empresa nesta sessão."
    );
  }

  const payload = {
    ...review,
    pseudonym: rawPseudonym,
    companySlug,
    uid,
    // Marca explícita para facilitar backfill e exibição como "Anônimo".
    isAnonymousAuthor: !rawPseudonym,
    createdAt: serverTimestamp(),
  };

  await setDoc(reviewRef, payload);

  // Fire-and-forget: dispara verificação server-side de autenticidade
  // via histórico LinkedIn. Em caso de match, o endpoint marca
  // `isVerifiedLinkedIn: true` no doc — nada do perfil LinkedIn é exposto.
  try {
    fetch(buildApiUrl("/api/verify-review-linkedin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId, uid }),
      keepalive: true,
    }).catch(() => {
      /* silencioso: a verificação é best-effort */
    });
  } catch {
    /* ignore */
  }

  return { id: reviewId, ...payload };
}

/**
 * Vincula avaliações enviadas anonimamente (sem pseudônimo) ao novo
 * pseudônimo escolhido pelo usuário. Procura por reviews do UID atual
 * onde `pseudonym` está vazio ou onde `isAnonymousAuthor === true`.
 *
 * Não realoca o doc id — apenas atualiza os campos identificadores
 * (`pseudonym`, `authorProfileId`, `isAnonymousAuthor`). Os doc ids
 * `companySlug_anon-<uid...>` permanecem como ficaram para preservar a
 * regra de unicidade já gravada.
 */
export async function linkAnonymousReviewsToPseudonym({ uid, pseudonym, authorProfileId } = {}) {
  const cleanPseudonym = (pseudonym || "").toString().trim();
  if (!uid || !cleanPseudonym) return { updated: 0 };

  const ref = collection(db, "reviews");
  const q = query(ref, where("uid", "==", uid), limit(200));
  const snap = await getDocs(q);

  let updated = 0;
  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() || {};
      const alreadyHasPseudonym = Boolean((data.pseudonym || "").toString().trim());
      if (alreadyHasPseudonym && !data.isAnonymousAuthor) return;
      try {
        await updateDoc(d.ref, {
          pseudonym: cleanPseudonym,
          authorProfileId: authorProfileId || data.authorProfileId || "",
          isAnonymousAuthor: false,
          linkedFromAnonymousAt: serverTimestamp(),
        });
        updated += 1;
      } catch (err) {
        console.warn("[reviews] Falha ao vincular avaliação anônima ao pseudônimo:", err?.message || err);
      }
    })
  );

  return { updated };
}

/**
 * Salva uma avaliação de processo seletivo (usuário NÃO contratado) em
 * coleção separada (`selectionProcessReviews`). Mantém os mesmos princípios
 * de identificação por pseudônimo + companySlug e impede duplicatas.
 */
export async function saveSelectionProcessReview(review) {
  if (!review?.company || !review?.pseudonym) {
    throw new Error(
      "Empresa e pseudônimo são obrigatórios para salvar a avaliação."
    );
  }

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const companySlug = slugifyCompany(review.company);
  const pseudonymSlug = slugifyCompany(review.pseudonym);
  const docId = `${companySlug}_${pseudonymSlug}`;
  const ref = doc(db, "selectionProcessReviews", docId);

  const existing = await getDoc(ref);
  if (existing.exists()) {
    throw new Error(
      "Você já enviou uma avaliação de processo seletivo para esta empresa com este pseudônimo."
    );
  }

  const payload = {
    ...review,
    type: "selectionProcess",
    companySlug,
    uid: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
  return { id: docId, ...payload };
}

export async function updateOwnReview({ reviewId, updates, currentProfileId = "", currentPseudonym = "" }) {
  if (!reviewId) {
    throw new Error("Avaliação inválida para edição.");
  }

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const reviewRef = doc(db, "reviews", reviewId);
  const existing = await getDoc(reviewRef);

  if (!existing.exists()) {
    throw new Error("Avaliação não encontrada.");
  }

  const review = { id: existing.id, ...existing.data() };
  if (!isReviewOwnedByCurrentUser(review, { profileId: currentProfileId, pseudonym: currentPseudonym })) {
    throw new Error("Você só pode editar avaliações feitas pelo seu próprio perfil.");
  }

  // Remove campos de identidade para evitar adulteração.
  const { pseudonym: _p, company: _c, companySlug: _cs, authorProfileId: _a, uid: _u, createdAt: _ca, ...safeUpdates } = updates;

  await updateDoc(reviewRef, {
    ...safeUpdates,
    updatedAt: serverTimestamp(),
  });

  return { id: reviewId, ...review, ...safeUpdates };
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
  if (existing.exists()) {
    // Já reagiu — não permite trocar nem somar nova reação.
    return { alreadyReacted: true, reaction: existing.data()?.reaction || null };
  }

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

  // Notifica o autor da avaliação sobre a nova reação (best-effort).
  try {
    const reviewSnap = await getDoc(reviewRef);
    if (reviewSnap.exists()) {
      const review = reviewSnap.data() || {};
      const authorUid = (review.uid || "").toString().trim();
      if (authorUid && authorUid !== uid) {
        const companyName = review.company || review.companyName || "";
        await createNotification({
          toUid: authorUid,
          fromUid: uid,
          type: "reaction",
          reviewId,
          companySlug: review.companySlug || "",
          companyName,
          message: `Alguém reagiu à sua avaliação${companyName ? ` sobre ${companyName}` : ""}.`,
          link: companyName ? `/empresa?name=${encodeURIComponent(companyName)}` : "",
        });
      }
    }
  } catch {
    /* best-effort: falha na notificação não afeta a reação */
  }

  return { alreadyReacted: false, reaction };
}

// Busca quais reações o usuário (uid) já fez nas reviews informadas.
// Retorna um objeto { [reviewId]: reactionKey }.
export async function listUserReactionsForReviews(uid, reviewIds) {
  if (!uid || !Array.isArray(reviewIds) || reviewIds.length === 0) return {};

  const results = await Promise.all(
    reviewIds.map(async (reviewId) => {
      const ref = doc(db, "reviewReactions", `${reviewId}_${uid}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return [reviewId, snap.data()?.reaction || null];
    })
  );

  return results.reduce((acc, entry) => {
    if (entry && entry[1]) acc[entry[0]] = entry[1];
    return acc;
  }, {});
}
