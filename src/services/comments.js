import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { slugifyCompany } from "./reviews";

export async function listCommentsByCompanySlug(slug, take = 100) {
  const ref = collection(db, "comments");
  const q = query(
    ref,
    where("companySlug", "==", slug),
    orderBy("createdAt", "desc"),
    limit(take)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveComment({ company, author, text, parentId = null }) {
  if (!company) {
    throw new Error("Empresa é obrigatória para salvar comentários.");
  }
  if (!text || !text.trim()) {
    throw new Error("Comentário não pode ficar vazio.");
  }

  const companySlug = slugifyCompany(company);
  const id = `${companySlug}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const ref = doc(db, "comments", id);

  const payload = {
    companySlug,
    companyName: company,
    author: author || "Anônimo",
    text: text.trim(),
    parentId: parentId || null,
    reactions: { anger: 0, laugh: 0, thumbsUp: 0, cry: 0, clap: 0 },
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
  return { id, ...payload };
}

export async function reactToComment({ commentId, reaction }) {
  if (!commentId) {
    throw new Error("commentId é obrigatório para reagir.");
  }
  if (!reaction) return;

  const ref = doc(db, "comments", commentId);
  await updateDoc(ref, {
    [`reactions.${reaction}`]: increment(1),
  });
}
