// /api/cnpj-data
// Consulta status cadastral / situação na Receita Federal via BrasilAPI e
// (opcionalmente) atualiza o documento da empresa em /companies/{cnpj}
// com os dados retornados, evitando chamadas repetidas à API externa.
//
// Uso (frontend):
//   GET /api/cnpj-data?cnpj=35804638000160
//
// Resposta de sucesso (200):
//   {
//     cnpj: "35804638000160",
//     situacaoCadastral: "ATIVA",
//     dataSituacaoCadastral: "2020-01-15",
//     motivoSituacaoCadastral: "...",
//     situacaoEspecial: "" | "...",
//     hasFiscalIssues: boolean,
//     issues: ["motivo legível 1", ...],
//     razaoSocial: "...",
//     nomeFantasia: "...",
//     naturezaJuridica: "...",
//     porte: "...",
//     municipio: "...",
//     uf: "...",
//     dataAbertura: "...",
//     fonte: "brasilapi",
//     atualizadoEm: <ISO string>
//   }

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  // Inicialização tolerante: o endpoint funciona mesmo sem credenciais
  // de Admin (apenas não persiste no Firestore).
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
  } catch (e) {
    console.warn('[cnpj-data] Firebase Admin não inicializado:', e?.message || e);
  }
}

// Status que indicam empresa "saudável" na Receita.
const HEALTHY_STATUSES = new Set(['ATIVA']);

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cnpjRaw = (req.query?.cnpj ?? '').toString();
  const cnpj = cnpjRaw.replace(/\D/g, '');

  if (cnpj.length !== 14) {
    return res.status(400).json({ error: 'CNPJ inválido. Deve ter 14 dígitos.' });
  }

  let upstream;
  try {
    upstream = await fetchWithTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      {
        headers: {
          'User-Agent': 'TrabalheiLa/1.0 (+https://trabalheila.com.br)',
          Accept: 'application/json',
        },
      },
      8000,
    );
  } catch (err) {
    console.error('[cnpj-data] Falha na BrasilAPI:', err?.message || err);
    return res.status(502).json({ error: 'Falha ao consultar a Receita Federal.' });
  }

  if (upstream.status === 404) {
    return res.status(404).json({ error: 'CNPJ não encontrado na Receita Federal.' });
  }
  if (!upstream.ok) {
    console.warn('[cnpj-data] BrasilAPI status', upstream.status);
    return res.status(502).json({ error: 'Receita Federal indisponível no momento.' });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return res.status(502).json({ error: 'Resposta inválida da Receita Federal.' });
  }

  // Normaliza campos relevantes.
  const situacaoCadastral = (data?.descricao_situacao_cadastral || data?.situacao_cadastral || '').toString().toUpperCase();
  const dataSituacaoCadastral = data?.data_situacao_cadastral || null;
  const motivoSituacaoCadastral = data?.descricao_motivo_situacao_cadastral || data?.motivo_situacao_cadastral || '';
  const situacaoEspecial = data?.situacao_especial || '';
  const dataSituacaoEspecial = data?.data_situacao_especial || null;

  // Heurística para "pendências" (a BrasilAPI não devolve dívidas ativas).
  const issues = [];
  if (situacaoCadastral && !HEALTHY_STATUSES.has(situacaoCadastral)) {
    issues.push(
      `Situação cadastral: ${situacaoCadastral}` +
      (motivoSituacaoCadastral ? ` (${motivoSituacaoCadastral})` : ''),
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
    razaoSocial: data?.razao_social || '',
    nomeFantasia: data?.nome_fantasia || '',
    naturezaJuridica: data?.natureza_juridica || '',
    porte: data?.porte || '',
    municipio: data?.municipio || '',
    uf: data?.uf || '',
    dataAbertura: data?.data_inicio_atividade || null,
    fonte: 'brasilapi',
    atualizadoEm: new Date().toISOString(),
  };

  // Persistência best-effort em /companies/{cnpj}. Falhas aqui não derrubam
  // a resposta — apenas logam.
  if (admin.apps.length) {
    try {
      const firestore = getFirestore();
      await firestore.collection('companies').doc(cnpj).set(
        {
          situacaoReceitaFederal: payload.situacaoCadastral,
          dataSituacaoReceitaFederal: payload.dataSituacaoCadastral,
          motivoSituacaoReceitaFederal: payload.motivoSituacaoCadastral,
          situacaoEspecialReceita: payload.situacaoEspecial,
          temPendenciasReceita: payload.hasFiscalIssues,
          pendenciasReceita: payload.issues,
          receitaAtualizadaEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.warn('[cnpj-data] Falha ao gravar no Firestore:', err?.message || err);
    }
  }

  // Cache leve no edge (5 min) — dados da Receita mudam pouco.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(payload);
}
