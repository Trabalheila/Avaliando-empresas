// /api/consulta-cnpj
// Consulta dados de CNPJ usando BrasilAPI; em caso de falha (rate limit / 5xx /
// timeout / CNPJ não encontrado), tenta ReceitaWS como fallback.
// Sempre devolve o payload normalizado nos campos esperados pelo front:
//   razao_social, cnae_fiscal, cnae_fiscal_descricao
export default async function handler(req, res) {
  const { cnpj } = req.query || {};
  const digits = String(cnpj || "").replace(/\D/g, "");

  if (digits.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Deve ter 14 dígitos." });
  }

  // 1) Tenta BrasilAPI
  try {
    const r = await fetchWithTimeout(
      `https://brasilapi.com.br/api/cnpj/v1/${digits}`,
      {
        headers: {
          "User-Agent": "TrabalheiLa/1.0 (+https://trabalheila.com.br)",
          Accept: "application/json",
        },
      },
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
      console.warn("BrasilAPI status", r.status, "para CNPJ", digits);
    }
  } catch (err) {
    console.warn("BrasilAPI falhou:", err?.message || err);
  }

  // 2) Fallback: ReceitaWS
  try {
    const r = await fetchWithTimeout(
      `https://www.receitaws.com.br/v1/cnpj/${digits}`,
      {
        headers: {
          "User-Agent": "TrabalheiLa/1.0 (+https://trabalheila.com.br)",
          Accept: "application/json",
        },
      },
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
    // Normaliza ReceitaWS → mesmo formato da BrasilAPI esperado pelo front.
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
    console.error("Falha total na consulta de CNPJ:", err?.message || err);
    return res.status(502).json({ error: "Falha ao consultar CNPJ." });
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

