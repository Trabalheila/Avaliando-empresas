import { db } from "../firebase";
import { collection, doc, getDocs, query, orderBy, setDoc, serverTimestamp } from "firebase/firestore";
import { slugifyCompany } from "./reviews";

export async function listCompanies(limit = 200) {
  const ref = collection(db, "companies");
  const q = query(ref, orderBy("createdAt", "desc"), limit ? limit : 200);

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveCompany({ company, cnpj }) {
  if (!company) {
    throw new Error("Nome da empresa é obrigatório");
  }

  const slug = slugifyCompany(company);
  const ref = doc(db, "companies", slug);

  const payload = {
    name: company,
    slug,
    cnpj: cnpj || null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  return { id: slug, ...payload };
}
