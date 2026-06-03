// Helper minimalista para executar SQL no BigQuery via REST, sem depender da
// lib oficial @google-cloud/bigquery (mantém o bundle da função serverless
// pequeno o suficiente para Vercel). Reaproveita `jsonwebtoken` que já é
// dependência do projeto.
//
// Credenciais lidas das envs:
//   - GCP_PROJECT_ID
//   - GCP_CLIENT_EMAIL
//   - GCP_PRIVATE_KEY  (cole o conteudo do campo private_key do JSON;
//                       quebras de linha podem ser literais "\n" ou reais)
//
// Documentação:
//   - https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
//   - https://developers.google.com/identity/protocols/oauth2/service-account

import jwt from "jsonwebtoken";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const BQ_SCOPE = "https://www.googleapis.com/auth/bigquery";

// Cache do access token em memória (vale enquanto a função estiver "quente").
let _cachedToken = null;
let _cachedTokenExp = 0;

function getCreds() {
  const projectId = process.env.GCP_PROJECT_ID;
  const clientEmail = process.env.GCP_CLIENT_EMAIL;
  const rawKey = process.env.GCP_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "Credenciais do Google Cloud ausentes. Defina GCP_PROJECT_ID, GCP_CLIENT_EMAIL e GCP_PRIVATE_KEY."
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return { projectId, clientEmail, privateKey };
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && _cachedTokenExp - 60 > now) return _cachedToken;

  const { clientEmail, privateKey } = getCreds();
  const assertion = jwt.sign(
    {
      iss: clientEmail,
      scope: BQ_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    { algorithm: "RS256" }
  );

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao obter access_token do Google (${res.status}): ${text}`);
  }
  const json = await res.json();
  _cachedToken = json.access_token;
  _cachedTokenExp = now + Number(json.expires_in || 3600);
  return _cachedToken;
}

/**
 * Executa um SQL no BigQuery com parâmetros nomeados e retorna as linhas
 * já decodificadas (objetos com chaves = nome do campo no schema).
 *
 * @param {string} sql
 * @param {Object<string, {type: 'STRING'|'INT64'|'BOOL', value: any}>} params
 * @param {{ maximumBytesBilled?: string, timeoutMs?: number }} [options]
 */
export async function bqQuery(sql, params = {}, options = {}) {
  const { projectId } = getCreds();
  const token = await getAccessToken();

  const queryParameters = Object.entries(params).map(([name, def]) => ({
    name,
    parameterType: { type: def.type || "STRING" },
    parameterValue: { value: def.value == null ? null : String(def.value) },
  }));

  const body = {
    query: sql,
    useLegacySql: false,
    parameterMode: "NAMED",
    queryParameters,
    // Guarda-chuva contra runaway cost. 10 GB de scan por query.
    maximumBytesBilled: options.maximumBytesBilled || "10000000000",
    timeoutMs: Math.min(options.timeoutMs || 15000, 30000),
  };

  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = payload?.error?.message || `BigQuery erro ${res.status}`;
    throw new Error(msg);
  }
  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message || "BigQuery retornou erro.");
  }

  const fields = payload?.schema?.fields || [];
  const rows = (payload?.rows || []).map((row) => {
    const out = {};
    fields.forEach((f, idx) => {
      const cell = row.f?.[idx];
      out[f.name] = cell?.v ?? null;
    });
    return out;
  });
  return { rows, totalBytesProcessed: payload?.totalBytesProcessed || "0" };
}
