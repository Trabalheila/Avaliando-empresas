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
  const cnpjRaw = (req.query?.cnpj ?? "").toString();
  const digits = cnpjRaw.replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Deve ter 14 dígitos." });
  }

  if (op === "info") return handleInfo(req, res, digits);
  if (op === "status") return handleStatus(req, res, digits);

  return res.status(400).json({ error: "Parâmetro 'op' inválido. Use ?op=info ou ?op=status." });
}
