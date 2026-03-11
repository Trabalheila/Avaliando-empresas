// src/utils/getCompanyLogo.js

// Mapeamento inicial de domínios para empresas conhecidas.
// Você pode expandir esse mapa conforme novos nomes de empresas entrarem.
const COMPANY_DOMAINS = {
  "Itaú Unibanco": "itau.com.br",
  "Banco do Brasil": "bb.com.br",
  "Bradesco": "bradesco.com.br",
  "Caixa Econômica Federal": "caixa.gov.br",
  "Petrobras": "petrobras.com.br",
  "Vale": "vale.com",
  "Nubank": "nubank.com.br",
  "Ambev": "ambev.com.br",
  "WEG": "weg.net",
  "Embraer": "embraer.com.br",
  "Natura": "natura.com.br",
  "Boticário": "boticario.com.br",
  "Gerdau": "gerdau.com.br",
  "Suzano": "suzano.com.br",
  "Localiza": "localiza.com",
  "Mercado Livre": "mercadolivre.com.br",
  "Shopee Brasil": "shopee.com.br",
  "Ifood": "ifood.com.br",
  "Hapvida": "hapvida.com.br",
  "Rede D'Or": "rededor.com.br",
  "Google": "google.com",
  "Apple": "apple.com",
  "Amazon": "amazon.com",
  "Microsoft": "microsoft.com",
  "Meta": "meta.com",
};

export function getCompanyLogoUrl(companyName, size = 128) {
  return getCompanyLogoCandidates(companyName, { size })[0];
}

function normalizeUrlToDomain(website) {
  if (!website) return "";
  const withProtocol = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function buildDomainCandidates(companyName, websiteDomain, mappedDomain) {
  const out = [];

  if (websiteDomain) out.push(websiteDomain);
  if (mappedDomain) out.push(mappedDomain);

  const normalizedName = (companyName || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Heuristica simples para aumentar cobertura quando nao ha website no cadastro.
  if (normalizedName) {
    const compact = normalizedName.replace(/\s+/g, "");
    if (compact.length >= 3) {
      out.push(`${compact}.com.br`);
      out.push(`${compact}.com`);
      out.push(`${compact}.net`);
    }

    const firstToken = normalizedName.split(" ")[0];
    if (firstToken && firstToken.length >= 3 && firstToken !== compact) {
      out.push(`${firstToken}.com.br`);
      out.push(`${firstToken}.com`);
    }
  }

  return [...new Set(out)].slice(0, 4);
}

export function getCompanyLogoCandidates(companyName, options = {}) {
  const size = options.size || 128;
  const websiteDomain = normalizeUrlToDomain(options.website);
  const mappedDomain = COMPANY_DOMAINS[companyName];
  const domains = buildDomainCandidates(companyName, websiteDomain, mappedDomain);

  const candidates = [];
  for (const domain of domains) {
    // 1) Logo Clearbit (bom para marcas conhecidas)
    candidates.push(`https://logo.clearbit.com/${encodeURIComponent(domain)}?size=${size}`);

    // 2) Google favicon em alta (boa cobertura geral)
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`);

    // 3) DuckDuckGo icon endpoint (fallback adicional)
    candidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);

    // 4) Unavatar agrega varias fontes e costuma cobrir bem dominios comuns
    candidates.push(`https://unavatar.io/${encodeURIComponent(domain)}?fallback=false`);

    // 5) Icon Horse costuma funcionar bem para favicon de sites corporativos
    candidates.push(`https://icon.horse/icon/${encodeURIComponent(domain)}`);

    // 6) Fallback backend: tenta og:image/twitter:image/icon do proprio site
    candidates.push(`/api/company-logo?domain=${encodeURIComponent(domain)}&size=${size}`);
  }

  // Fallback garantido para qualquer empresa.
  candidates.push(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=0D8ABC&color=fff&size=${size}&font-size=0.4`
  );

  return [...new Set(candidates)];
}
