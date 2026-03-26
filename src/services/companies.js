import { auth, db } from "../firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, query, orderBy, limit as limitDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { slugifyCompany } from "./reviews";

export async function listCompanies(take = 200) {
  const ref = collection(db, "companies");
  const q = query(ref, orderBy("createdAt", "desc"), limitDocs(take || 200));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveCompany({ company, cnpj, website = null, cnaeCode = null, cnaeDescricao = null }) {
  if (!company) {
    throw new Error("Nome da empresa é obrigatório");
  }

  // Garante credencial para regras que exigem request.auth.
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const slug = slugifyCompany(company);
  const ref = doc(db, "companies", slug);

  const payload = {
    name: company,
    slug,
    cnpj: cnpj || null,
    website: website || null,
    cnaeCode: cnaeCode || null,
    cnaeDescricao: cnaeDescricao || null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  return { id: slug, ...payload };
}
