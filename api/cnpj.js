// /api/cnpj.js
// Endpoint consolidado para consultas de CNPJ.
//
// Sub-rotas (via query param `?op=...`):
//   GET  /api/cnpj?op=info&cnpj=...    → dados cadastrais (BrasilAPI + fallback ReceitaWS).
//                                        Retorna: { razao_social, cnae_fiscal, cnae_fiscal_descricao, ... }
//   GET  /api/cnpj?op=status&cnpj=...  → situação na Receita Federal + persistência best-effort
//                                        em /companies/{cnpj}. Retorna issues, hasFiscalIssues etc.
//
// Compatibilidade legada:
//   POST /api/cnpj   { cnpj }          → proxy ReceitaWS (formato bruto). Mantido para
//                                        builds antigos do app Android empacotados.

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { bqQuery } from "./_bigquery.js";

// ── Inicialização lazy/tolerante do Firebase Admin (apenas para op=status). ──
let _adminInitTried = false;
function ensureAdmin() {
  if (_adminInitTried) return;
  _adminInitTried = true;
  if (admin.apps.length) return;
  try {
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    }
  } catch (e) {
    console.warn("[cnpj] Firebase Admin não inicializado:", e?.message || e);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

const COMMON_HEADERS = {
  "User-Agent": "TrabalheiLa/1.0 (+https://trabalheila.com.br)",
  Accept: "application/json",
};

// ── op=info: dados cadastrais (BrasilAPI + fallback ReceitaWS) ──
async function handleInfo(req, res, digits) {
  // 1) BrasilAPI
  try {
    const r = await fetchWithTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      { headers: COMMON_HEADERS },
      8000
    );
    if (r.ok) {
      const data = await r.json();
      if (data && (data.razao_social || data.nome)) {
        return res.status(200).json({
          ...data,
          razao_social: data.razao_social || data.nome || "",
          cnae_fiscal: data.cnae_fiscal ?? data.cnae_principal?.codigo ?? null,
          cnae_fiscal_descricao:
            data.cnae_fiscal_descricao || data.cnae_principal?.descricao || "",
          source: "brasilapi",
        });
      }
    } else {
      console.warn("[cnpj/info] BrasilAPI status", r.status, "para", digits);
    }
  } catch (err) {
    console.warn("[cnpj/info] BrasilAPI falhou:", err?.message || err);
  }

  // 2) Fallback ReceitaWS
  try {
    const r = await fetchWithTimeout(
      `https://www.receitaws.com.br/v1/cnpj/${digits}`,
      { headers: COMMON_HEADERS },
      8000
    );
    if (!r.ok) {
      return res
        .status(r.status === 404 ? 404 : 502)
        .json({ error: "CNPJ não encontrado nas bases consultadas." });
    }
    const raw = await r.json();
    if (raw?.status && String(raw.status).toLowerCase() === "error") {
      return res.status(404).json({ error: raw.message || "CNPJ não encontrado." });
    }
    const cnaeCodigo = String(raw?.atividade_principal?.[0]?.code || "").replace(/\D/g, "");
    const cnaeDesc = raw?.atividade_principal?.[0]?.text || "";
    return res.status(200).json({
      razao_social: raw?.nome || "",
      nome_fantasia: raw?.fantasia || "",
      cnae_fiscal: cnaeCodigo || null,
      cnae_fiscal_descricao: cnaeDesc,
      uf: raw?.uf || "",
      municipio: raw?.municipio || "",
      source: "receitaws",
      raw,
    });
  } catch (err) {
    console.error("[cnpj/info] Falha total:", err?.message || err);
    return res.status(502).json({ error: "Falha ao consultar CNPJ." });
  }
}

// ── op=status: situação cadastral na Receita Federal ──
const HEALTHY_STATUSES = new Set(["ATIVA"]);

async function handleStatus(req, res, cnpj) {
  let upstream;
  try {
    upstream = await fetchWithTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      { headers: COMMON_HEADERS },
      8000
    );
  } catch (err) {
    console.error("[cnpj/status] Falha BrasilAPI:", err?.message || err);
    return res.status(502).json({ error: "Falha ao consultar a Receita Federal." });
  }

  if (upstream.status === 404) {
    return res.status(404).json({ error: "CNPJ não encontrado na Receita Federal." });
  }
  if (!upstream.ok) {
    return res.status(502).json({ error: "Receita Federal indisponível no momento." });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return res.status(502).json({ error: "Resposta inválida da Receita Federal." });
  }

  const situacaoCadastral = (data?.descricao_situacao_cadastral || data?.situacao_cadastral || "")
    .toString()
    .toUpperCase();
  const dataSituacaoCadastral = data?.data_situacao_cadastral || null;
  const motivoSituacaoCadastral =
    data?.descricao_motivo_situacao_cadastral || data?.motivo_situacao_cadastral || "";
  const situacaoEspecial = data?.situacao_especial || "";
  const dataSituacaoEspecial = data?.data_situacao_especial || null;

  const issues = [];
  if (situacaoCadastral && !HEALTHY_STATUSES.has(situacaoCadastral)) {
    issues.push(
      `Situação cadastral: ${situacaoCadastral}` +
        (motivoSituacaoCadastral ? ` (${motivoSituacaoCadastral})` : "")
    );
  }
  if (situacaoEspecial) {
    issues.push(`Situação especial: ${situacaoEspecial}`);
  }
  const hasFiscalIssues = issues.length > 0;

  const payload = {
    cnpj,
    situacaoCadastral: situacaoCadastral || null,
    dataSituacaoCadastral,
    motivoSituacaoCadastral: motivoSituacaoCadastral || null,
    situacaoEspecial: situacaoEspecial || null,
    dataSituacaoEspecial,
    hasFiscalIssues,
    issues,
    razaoSocial: data?.razao_social || "",
    nomeFantasia: data?.nome_fantasia || "",
    naturezaJuridica: data?.natureza_juridica || "",
    porte: data?.porte || "",
    municipio: data?.municipio || "",
    uf: data?.uf || "",
    dataAbertura: data?.data_inicio_atividade || null,
    fonte: "brasilapi",
    atualizadoEm: new Date().toISOString(),
  };

  // Persistência best-effort em /companies/{cnpj}.
  ensureAdmin();
  if (admin.apps.length) {
    try {
      const firestore = getFirestore();
      await firestore.collection("companies").doc(cnpj).set(
        {
          situacaoReceitaFederal: payload.situacaoCadastral,
          dataSituacaoReceitaFederal: payload.dataSituacaoCadastral,
          motivoSituacaoReceitaFederal: payload.motivoSituacaoCadastral,
          situacaoEspecialReceita: payload.situacaoEspecial,
          temPendenciasReceita: payload.hasFiscalIssues,
          pendenciasReceita: payload.issues,
          receitaAtualizadaEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[cnpj/status] Falha ao gravar Firestore:", err?.message || err);
    }
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  return res.status(200).json(payload);
}

// ── op=search: busca empresas por nome no BigQuery do OpenCNPJ ──
// Estratégia:
//   1. Normaliza o termo (lowercase, sem acentos, trim).
//   2. Tenta o cache no Firestore `companies_search_cache/{term}` (TTL 30 dias).
//   3. Se cache miss, consulta BigQuery `opencnpj-bigquery.public.empresas`
//      filtrando por STARTS_WITH em razao_social ou nome_fantasia (LIMIT 20).
//   4. Persiste o resultado no cache E faz upsert em `companies/{slug}` para
//      o autocomplete de Firestore (searchCompaniesByName) achar nas próximas
//      buscas mesmo sem chamar a API novamente.
//   5. Devolve a lista normalizada para o frontend.
const SEARCH_CACHE_TTL_DAYS = 30;

function normalizeSearchTerm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyCompanyName(value) {
  return normalizeSearchTerm(value).replace(/\s+/g, "-").slice(0, 80) || null;
}

async function handleSearchByName(req, res) {
  const rawTerm = (req.query?.q ?? "").toString();
  const term = normalizeSearchTerm(rawTerm);
  if (term.length < 3) {
    return res.status(400).json({ error: "Termo de busca deve ter ao menos 3 caracteres." });
  }

  ensureAdmin();
  const firestore = admin.apps.length ? getFirestore() : null;

  // 1) Cache
  if (firestore) {
    try {
      const cacheRef = firestore.collection("companies_search_cache").doc(term);
      const snap = await cacheRef.get();
      if (snap.exists) {
        const data = snap.data() || {};
        const fetchedAt = data.fetchedAt?.toMillis?.() || 0;
        const ageMs = Date.now() - fetchedAt;
        if (ageMs < SEARCH_CACHE_TTL_DAYS * 24 * 3600 * 1000) {
          res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
          return res.status(200).json({
            term,
            cached: true,
            results: Array.isArray(data.results) ? data.results : [],
          });
        }
      }
    } catch (err) {
      console.warn("[cnpj/search] cache lookup falhou:", err?.message || err);
    }
  }

  // 2) BigQuery
  let bqRows = [];
  let bytesScanned = "0";
  try {
    const { rows, totalBytesProcessed } = await bqQuery(
      `SELECT cnpj, razao_social, nome_fantasia, uf, municipio, situacao_cadastral
       FROM \`opencnpj-bigquery.public.empresas\`
       WHERE situacao_cadastral = 'ATIVA'
         AND (STARTS_WITH(LOWER(razao_social), @term)
              OR STARTS_WITH(LOWER(nome_fantasia), @term))
       LIMIT 20`,
      { term: { type: "STRING", value: term } }
    );
    bqRows = rows;
    bytesScanned = totalBytesProcessed;
  } catch (err) {
    console.error("[cnpj/search] BigQuery falhou:", err?.message || err);
    // Detalhe do erro vai apenas em header (para debug) e em modo dev no body.
    const detail = (err?.message || "erro desconhecido").toString().slice(0, 300);
    res.setHeader("X-Search-Error", encodeURIComponent(detail));
    return res.status(502).json({
      error: "Falha ao consultar a base de empresas.",
      detail: process.env.VERCEL_ENV === "production" ? undefined : detail,
    });
  }

  const results = bqRows.map((r) => {
    const cnpj = String(r.cnpj || "").replace(/\D/g, "");
    const name = (r.nome_fantasia || r.razao_social || "").toString().trim();
    return {
      cnpj: cnpj || null,
      name,
      razaoSocial: r.razao_social || null,
      nomeFantasia: r.nome_fantasia || null,
      uf: r.uf || null,
      municipio: r.municipio || null,
    };
  }).filter((r) => r.name);

  // 3) Persistir cache + upsert em /companies (best-effort)
  if (firestore) {
    try {
      await firestore.collection("companies_search_cache").doc(term).set({
        term,
        results,
        bytesScanned,
        fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn("[cnpj/search] gravar cache falhou:", err?.message || err);
    }

    // Upsert em companies/{slug} para o autocomplete de Firestore.
    // Não bloqueia a resposta se algum falhar.
    await Promise.allSettled(
      results.map(async (r) => {
        const slug = slugifyCompanyName(r.name);
        if (!slug) return;
        const docRef = firestore.collection("companies").doc(slug);
        try {
          const existing = await docRef.get();
          const payload = {
            slug,
            name: r.name,
            nameLowercase: normalizeSearchTerm(r.name),
            cnpj: r.cnpj || null,
            razaoSocial: r.razaoSocial,
            municipio: r.municipio,
            uf: r.uf,
            sourceCnpjImport: "opencnpj-bigquery",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          if (!existing.exists) {
            payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
          }
          await docRef.set(payload, { merge: true });
        } catch (err) {
          console.warn("[cnpj/search] upsert company falhou:", slug, err?.message || err);
        }
      })
    );
  }

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ term, cached: false, results });
}

// ── Compat legacy: POST { cnpj } → proxy ReceitaWS bruto. ──
async function handleLegacyPost(req, res) {
  const { cnpj } = req.body || {};
  if (!cnpj) return res.status(400).json({ error: "CNPJ não informado." });

  const cleaned = String(cnpj).replace(/\D/g, "");
  if (cleaned.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Deve ter 14 dígitos." });
  }

  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cleaned}`);
    const data = await response.json();
    if (data.status && String(data.status).toLowerCase() === "error") {
      return res.status(400).json({ error: data.message || "CNPJ não encontrado." });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error("[cnpj/legacy] Erro:", err);
    return res.status(500).json({ error: "Falha ao consultar CNPJ." });
  }
}

export default async function handler(req, res) {
  // Compat: POST sem op → proxy ReceitaWS legado.
  if (req.method === "POST") {
    return handleLegacyPost(req, res);
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const op = String(req.query?.op || "info").toLowerCase();

  // Busca por nome não exige CNPJ na query.
  if (op === "search") return handleSearchByName(req, res);

  const cnpjRaw = (req.query?.cnpj ?? "").toString();
  const digits = cnpjRaw.replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Deve ter 14 dígitos." });
  }

  if (op === "info") return handleInfo(req, res, digits);
  if (op === "status") return handleStatus(req, res, digits);

  return res.status(400).json({ error: "Parâmetro 'op' inválido. Use ?op=info, ?op=status ou ?op=search." });
}
