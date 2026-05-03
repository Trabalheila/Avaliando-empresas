// api/consulta-cpf.js
//
// Validação de CPF + busca opcional do nome via provedor externo.
//
// Suporta dois modos de provedor:
//   1) InfoSimples (detectado pela URL contendo "infosimples.com"):
//      - POST com body { token, cpf, birthdate } para o endpoint v2
//        (ex.: https://api.infosimples.com/api/v2/consultas/receita-federal/cpf).
//      - Usa CPF_API_TOKEN como `token` no body.
//      - Exige `birthdate` (YYYY-MM-DD) recebido do cliente — convertido
//        para DD/MM/YYYY antes de enviar.
//
//   2) Genérico (qualquer outra URL):
//      - GET, com Authorization: Bearer <CPF_API_TOKEN> se definido.
//      - Substitui {cpf} no template ou anexa como query string.
//
// Variáveis de ambiente:
//   CPF_API_URL    - URL do provedor (com {cpf} se aplicável).
//   CPF_API_TOKEN  - Token de autenticação (Bearer ou body, conforme provedor).
//
// Resposta:
//   200 { valid: true,  fullName: "JOSE DA SILVA" }                  → nome encontrado
//   200 { valid: true,  fullName: null, reason: "lookup_unavailable" }
//   200 { valid: true,  fullName: null, reason: "not_found" }
//   200 { valid: true,  fullName: null, reason: "birthdate_required" } → InfoSimples sem data
//   400 { valid: false, error: "CPF inválido" }

function isValidCPF(input) {
  const c = String(input || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

function pickNameFromProvider(json) {
  if (!json || typeof json !== 'object') return null;

  // InfoSimples v2: { code: 200, data: [ { nome: "..." } ] }
  if (Array.isArray(json?.data) && json.data.length > 0) {
    const first = json.data[0];
    const fromArr =
      first?.nome ||
      first?.nome_completo ||
      first?.name ||
      first?.fullName;
    if (typeof fromArr === 'string' && fromArr.trim()) return fromArr.trim();
  }

  const candidates = [
    json?.nome,
    json?.name,
    json?.fullName,
    json?.nome_completo,
    json?.data?.nome,
    json?.data?.nome_completo,
    json?.data?.name,
    json?.data?.fullName,
    json?.result?.nome,
    json?.result?.name,
    json?.response?.nome,
    json?.response?.name,
    json?.pessoa?.nome,
    json?.pessoa?.nome_completo,
  ];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

// Converte birthdate "YYYY-MM-DD" para "DD/MM/YYYY" (formato esperado pela InfoSimples).
function toBrDate(yyyyMmDd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(yyyyMmDd || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

async function fetchInfoSimples({ url, token, cpf, birthdate }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, cpf, birthdate }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

async function fetchGeneric({ url, token, cpf }) {
  const finalUrl = url.includes('{cpf}')
    ? url.replace('{cpf}', encodeURIComponent(cpf))
    : `${url}${url.includes('?') ? '&' : '?'}cpf=${encodeURIComponent(cpf)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return await fetch(finalUrl, { headers, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Método não permitido' });
  }

  const params = req.method === 'GET' ? req.query : req.body;
  const cpfRaw = params?.cpf ?? '';
  const birthdateRaw = params?.birthdate ?? '';

  const cpf = String(cpfRaw).replace(/\D/g, '');

  if (!isValidCPF(cpf)) {
    return res.status(400).json({ valid: false, error: 'CPF inválido' });
  }

  const apiUrl = process.env.CPF_API_URL;
  const apiToken = process.env.CPF_API_TOKEN;

  if (!apiUrl) {
    return res.status(200).json({ valid: true, fullName: null, reason: 'lookup_unavailable' });
  }

  const isInfoSimples = /infosimples\.com/i.test(apiUrl);

  if (isInfoSimples) {
    const birthdate = toBrDate(birthdateRaw);
    if (!birthdate) {
      return res.status(200).json({ valid: true, fullName: null, reason: 'birthdate_required' });
    }
    if (!apiToken) {
      console.warn('[consulta-cpf] CPF_API_TOKEN ausente para InfoSimples');
      return res.status(200).json({ valid: true, fullName: null, reason: 'lookup_unavailable' });
    }

    try {
      const upstream = await fetchInfoSimples({ url: apiUrl, token: apiToken, cpf, birthdate });

      if (!upstream.ok) {
        console.warn('[consulta-cpf] InfoSimples HTTP', upstream.status);
        return res.status(200).json({ valid: true, fullName: null, reason: 'lookup_unavailable' });
      }

      const json = await upstream.json().catch(() => null);
      const ok = json && (json.code === 200 || json.code === '200');
      if (!ok) {
        console.warn('[consulta-cpf] InfoSimples code', json?.code, json?.code_message || '');
        return res.status(200).json({ valid: true, fullName: null, reason: 'not_found' });
      }

      const fullName = pickNameFromProvider(json);
      if (!fullName) {
        return res.status(200).json({ valid: true, fullName: null, reason: 'not_found' });
      }
      return res.status(200).json({ valid: true, fullName });
    } catch (err) {
      console.error('[consulta-cpf] InfoSimples erro:', err?.message || err);
      return res.status(200).json({ valid: true, fullName: null, reason: 'lookup_unavailable' });
    }
  }

  // Provedor genérico (GET + Bearer).
  try {
    const upstream = await fetchGeneric({ url: apiUrl, token: apiToken, cpf });

    if (!upstream.ok) {
      console.warn('[consulta-cpf] upstream status', upstream.status);
      return res.status(200).json({ valid: true, fullName: null, reason: 'lookup_unavailable' });
    }

    const json = await upstream.json().catch(() => null);
    const fullName = pickNameFromProvider(json);

    if (!fullName) {
      return res.status(200).json({ valid: true, fullName: null, reason: 'not_found' });
    }
    return res.status(200).json({ valid: true, fullName });
  } catch (err) {
    console.error('[consulta-cpf] erro:', err?.message || err);
    return res.status(200).json({ valid: true, fullName: null, reason: 'lookup_unavailable' });
  }
}
