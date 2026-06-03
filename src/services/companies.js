
import { auth, db } from "../firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, query, where, orderBy, limit as limitDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { slugifyCompany } from "./reviews";
import { buildApiUrl } from "../utils/apiBase";

// Normaliza o nome para comparação case/acento-insensível (usado no prefix search).
function normalizeNameForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

    const enderecoParts = [
      data?.descricao_tipo_de_logradouro || "",
      data?.logradouro || "",
      data?.numero ? `, ${data.numero}` : "",
      data?.complemento ? ` - ${data.complemento}` : "",
      data?.bairro ? ` - ${data.bairro}` : "",
      data?.municipio ? ` - ${data.municipio}` : "",
      data?.uf ? `/${data.uf}` : "",
      data?.cep ? ` - CEP ${data.cep}` : "",
    ];
    const enderecoFormatado = enderecoParts
      .join("")
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .trim();

    return {
      cnpj: cleaned,
      razaoSocial: data?.razao_social || null,
      nomeFantasia: data?.nome_fantasia || null,
      endereco: enderecoFormatado || null,
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
    nameLowercase: normalizeNameForSearch(company),
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

/**
 * Busca empresas pelo prefixo do nome (case/acento-insensível).
 * Roda direto contra Firestore (collection `companies` tem leitura pública)
 * para evitar custo de função serverless e dar resposta rápida no autocomplete.
 *
 * @param {string} term termo digitado pelo usuário
 * @param {number} take quantos resultados retornar (default 15)
 * @returns {Promise<Array<{id:string,name:string,cnpj:string|null,razaoSocial:string|null}>>}
 */
export async function searchCompaniesByName(term, take = 15) {
  const normalized = normalizeNameForSearch(term);
  if (normalized.length < 2) return [];

  const ref = collection(db, "companies");
  // Prefix search no Firestore: intervalo [normalized, normalized + \uf8ff].
  const q = query(
    ref,
    where("nameLowercase", ">=", normalized),
    where("nameLowercase", "<=", normalized + "\uf8ff"),
    orderBy("nameLowercase"),
    limitDocs(take)
  );

  let localResults = [];
  try {
    const snap = await getDocs(q);
    localResults = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        name: data.name || data.slug || d.id,
        cnpj: digitsOnly(data.cnpj) || null,
        razaoSocial: data.razaoSocial || null,
        segmento: data.segmento || null,
      };
    });
  } catch (err) {
    console.warn("[searchCompaniesByName] firestore falhou:", err?.message || err);
  }

  // Se o termo tem ao menos 3 caracteres e a base local trouxe poucos
  // resultados, consultar o BigQuery do OpenCNPJ via nossa API. O endpoint
  // cacheia o resultado em /companies_search_cache e popula /companies para
  // que buscas futuras pelo mesmo termo nem precisem chamar a API novamente.
  if (normalized.length >= 3 && localResults.length < take) {
    try {
      const url = buildApiUrl(`/api/cnpj?op=search&q=${encodeURIComponent(normalized)}`);
      const resp = await fetch(url);
      if (resp.ok) {
        const payload = await resp.json();
        const remote = Array.isArray(payload?.results) ? payload.results : [];
        const seen = new Set(localResults.map((r) => (r.name || "").toLowerCase()));
        for (const r of remote) {
          const key = (r.name || "").toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          localResults.push({
            id: key,
            name: r.name,
            cnpj: digitsOnly(r.cnpj) || null,
            razaoSocial: r.razaoSocial || null,
            segmento: null,
          });
          if (localResults.length >= take) break;
        }
      }
    } catch (err) {
      // Falha de rede / endpoint: degrada para apenas resultados locais.
      console.warn("[searchCompaniesByName] /api/cnpj?op=search falhou:", err?.message || err);
    }
  }

  return localResults;
}
