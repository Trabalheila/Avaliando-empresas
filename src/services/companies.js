
import { auth, db } from "../firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, query, orderBy, limit as limitDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { slugifyCompany } from "./reviews";

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function getSegmentFromCnaeCode(cnaeCode) {
  const digits = digitsOnly(cnaeCode);
  if (digits.length < 2) return null;
  return digits.slice(0, 2);
}

// Enriquecimento automático via Brasil API
export async function enrichCompanyWithBrasilAPI(cnpj) {
  const cleaned = digitsOnly(cnpj);
  if (!cleaned) return null;
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
    if (!response.ok) return null;
    const data = await response.json();

    const cnaeCode = data?.cnae_fiscal || data?.atividade_principal?.[0]?.code || null;
    const cnaeDescription = data?.cnae_fiscal_descricao || data?.atividade_principal?.[0]?.text || null;
    const cnaePrincipal = cnaeCode || cnaeDescription
      ? {
          codigo: cnaeCode || null,
          descricao: cnaeDescription || null,
        }
      : null;

    return {
      cnpj: cleaned,
      razaoSocial: data?.razao_social || null,
      cnae_principal: cnaePrincipal,
      segmento: getSegmentFromCnaeCode(cnaeCode),
      ramo: data.cnae_fiscal_descricao || null,
      cidade: data.municipio || null,
      estado: data.uf || null,
      descricao: data.nome_fantasia || data.razao_social || null,
      logradouro: data.logradouro || null,
      site: data.site || null,
    };
  } catch (err) {
    return null;
  }
}

export async function listCompanies(take = 200) {
  const ref = collection(db, "companies");
  const q = query(ref, orderBy("createdAt", "desc"), limitDocs(take || 200));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveCompany({
  company,
  cnpj,
  website = null,
  cnaeCode = null,
  cnaeDescricao = null,
  cnaePrincipal = null,
  segmento = null,
  razaoSocial = null,
}) {
  if (!company) {
    throw new Error("Nome da empresa é obrigatório");
  }

  // Garante credencial para regras que exigem request.auth.
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  const slug = slugifyCompany(company);
  const ref = doc(db, "companies", slug);
  const resolvedCnaePrincipal = cnaePrincipal || (cnaeCode || cnaeDescricao
    ? {
        codigo: cnaeCode || null,
        descricao: cnaeDescricao || null,
      }
    : null);
  const resolvedSegmento = segmento || getSegmentFromCnaeCode(resolvedCnaePrincipal?.codigo || cnaeCode);

  const payload = {
    name: company,
    slug,
    cnpj: digitsOnly(cnpj) || null,
    website: website || null,
    cnaeCode: cnaeCode || null,
    cnaeDescricao: cnaeDescricao || null,
    cnae_principal: resolvedCnaePrincipal,
    segmento: resolvedSegmento || null,
    razaoSocial: razaoSocial || null,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  return { id: slug, ...payload };
}
