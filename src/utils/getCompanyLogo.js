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

export function getCompanyLogoCandidates(companyName, options = {}) {
  const size = options.size || 128;
  const websiteDomain = normalizeUrlToDomain(options.website);
  const mappedDomain = COMPANY_DOMAINS[companyName];
  const domain = websiteDomain || mappedDomain;

  const candidates = [];
  if (domain) {
    // 1) Logo Clearbit (melhor resolução para marcas conhecidas)
    candidates.push(`https://logo.clearbit.com/${encodeURIComponent(domain)}?size=${size}`);

    // 2) Google favicon em alta (boa cobertura geral)
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`);

    // 3) DuckDuckGo icon endpoint (fallback adicional)
    candidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
  }

  // 4) Fallback garantido para qualquer empresa
  candidates.push(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=0D8ABC&color=fff&size=${size}&font-size=0.4`
  );

  return [...new Set(candidates)];
}
