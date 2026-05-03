// api/consulta-cpf.js
//
// Validação de CPF + busca opcional do nome via provedor externo.
// O nome só é retornado se as variáveis de ambiente CPF_API_URL e
// (opcionalmente) CPF_API_TOKEN estiverem configuradas. Caso contrário,
// o endpoint apenas valida os dígitos verificadores.
//
// Resposta:
//   200 { valid: true,  fullName: "JOSE DA SILVA"  }  → nome encontrado
//   200 { valid: true,  fullName: null, reason: "lookup_unavailable" | "not_found" }
//   400 { valid: false, error: "CPF inválido" }
//   500 { valid: false, error: "..." }

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

// Tenta extrair o nome de uma resposta JSON em formatos comuns
// (InfoSimples, ApiBrasil, DirectData, etc.).
function pickNameFromProvider(json) {
  if (!json || typeof json !== 'object') return null;
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

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Método não permitido' });
  }

  const cpfRaw =
    (req.method === 'GET' ? req.query?.cpf : req.body?.cpf) ?? '';
  const cpf = String(cpfRaw).replace(/\D/g, '');

  if (!isValidCPF(cpf)) {
    return res.status(400).json({ valid: false, error: 'CPF inválido' });
  }

  const apiUrl = process.env.CPF_API_URL;
  const apiToken = process.env.CPF_API_TOKEN;

  if (!apiUrl) {
    // Provedor não configurado — devolve apenas a validação dos dígitos.
    return res.status(200).json({
      valid: true,
      fullName: null,
      reason: 'lookup_unavailable',
    });
  }

  // Substitui {cpf} no template, ou anexa como query string padrão.
  const finalUrl = apiUrl.includes('{cpf}')
    ? apiUrl.replace('{cpf}', encodeURIComponent(cpf))
    : `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}cpf=${encodeURIComponent(cpf)}`;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 10000);

    const headers = { Accept: 'application/json' };
    if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

    const upstream = await fetch(finalUrl, { headers, signal: controller.signal });
    clearTimeout(t);

    if (!upstream.ok) {
      console.warn('[consulta-cpf] upstream status', upstream.status);
      return res.status(200).json({
        valid: true,
        fullName: null,
        reason: 'lookup_unavailable',
      });
    }

    const json = await upstream.json().catch(() => null);
    const fullName = pickNameFromProvider(json);

    if (!fullName) {
      return res.status(200).json({
        valid: true,
        fullName: null,
        reason: 'not_found',
      });
    }

    return res.status(200).json({ valid: true, fullName });
  } catch (err) {
    console.error('[consulta-cpf] erro:', err?.message || err);
    return res.status(200).json({
      valid: true,
      fullName: null,
      reason: 'lookup_unavailable',
    });
  }
}
