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
  "Magazine Luiza": "magazineluiza.com.br",
  "Magalu": "magazineluiza.com.br",
  "Casas Bahia": "casasbahia.com.br",
  "Americanas": "americanas.com.br",
  "Renner": "lojasrenner.com.br",
  "Riachuelo": "riachuelo.com.br",
  "JBS": "jbs.com.br",
  "BRF": "brf-global.com",
  "Stone": "stone.com.br",
  "PagBank": "pagbank.com.br",
  "PagSeguro": "pagseguro.uol.com.br",
  "XP Inc": "xpi.com.br",
  "Santander": "santander.com.br",
  "Itaú": "itau.com.br",
  "TOTVS": "totvs.com",
  "Vivo": "vivo.com.br",
  "Claro": "claro.com.br",
  "TIM": "tim.com.br",
  "Oi": "oi.com.br",
  "Raia Drogasil": "raiadrogasil.com.br",
  "Drogasil": "drogasil.com.br",
  "Assaí": "assai.com.br",
  "Carrefour": "carrefour.com.br",
  "GPA": "gpabr.com",
  "Cielo": "cielo.com.br",
  "99": "99app.com",
  "Uber": "uber.com",
  "Rappi": "rappi.com.br",
  "Loggi": "loggi.com",
  "Movida": "movida.com.br",
  "Azul": "voeazul.com.br",
  "Gol": "voegol.com.br",
  "Latam": "latamairlines.com",
};

function getMappedDomain(companyName) {
  if (!companyName) return "";
  // Correspondência exata primeiro (mantém retrocompatibilidade).
  if (COMPANY_DOMAINS[companyName]) return COMPANY_DOMAINS[companyName];
  // Correspondência normalizada (case/acentos-insensível).
  const target = normalizeCompanyKey(companyName);
  for (const [name, domain] of Object.entries(COMPANY_DOMAINS)) {
    if (normalizeCompanyKey(name) === target) return domain;
  }
  return "";
}

const COMPANY_LOGO_OVERRIDES = [
  {
    aliases: [
      "aplus engenharia",
      "aplus ensenharia",
      "a plus engenharia",
      "aplus engenharia ltda",
      "aplus engenharia eireli",
    ],
    logoUrl: "/company-logos/aplus-engenharia.svg",
  },
];

function normalizeCompanyKey(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCompanyLogoOverride(companyName) {
  const normalized = normalizeCompanyKey(companyName);
  if (!normalized) return "";

  for (const rule of COMPANY_LOGO_OVERRIDES) {
    const aliases = (rule.aliases || []).map(normalizeCompanyKey).filter(Boolean);
    const matched = aliases.some(
      (alias) => normalized === alias || normalized.startsWith(`${alias} `) || normalized.includes(alias)
    );
    if (matched) {
      return rule.logoUrl || "";
    }
  }

  return "";
}

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

  let normalizedName = (companyName || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove sufixos/termos societários comuns que raramente fazem parte do
  // domínio (ex.: "Padaria Central Ltda" -> "padariacentral").
  const STOPWORDS = new Set([
    "ltda", "sa", "s a", "me", "epp", "mei", "eireli", "cia", "cia.",
    "grupo", "group", "holding", "holdings", "participacoes", "participacao",
    "comercio", "industria", "industrias", "servicos", "servico", "solucoes",
    "solucao", "tecnologia", "tech", "do", "da", "de", "e", "brasil",
    "brazil", "nacional", "empresa", "companhia",
  ]);
  const tokens = normalizedName.split(" ").filter((t) => t && !STOPWORDS.has(t));
  const cleanedName = tokens.join(" ").trim() || normalizedName;

  const tlds = ["com.br", "com", "net", "app", "co"];

  const pushDomainsFor = (base) => {
    if (!base || base.length < 3) return;
    for (const tld of tlds) {
      out.push(`${base}.${tld}`);
    }
  };

  // Heuristica: nome inteiro compactado + primeiro token relevante.
  if (cleanedName) {
    pushDomainsFor(cleanedName.replace(/\s+/g, ""));

    const firstToken = tokens[0] || cleanedName.split(" ")[0];
    if (firstToken && firstToken !== cleanedName.replace(/\s+/g, "")) {
      pushDomainsFor(firstToken);
    }

    // Duas primeiras palavras juntas (ex.: "aplus engenharia" -> "aplusengenharia").
    if (tokens.length >= 2) {
      pushDomainsFor(`${tokens[0]}${tokens[1]}`);
    }
  }

  return [...new Set(out)].slice(0, 6);
}

export function getCompanyLogoCandidates(companyName, options = {}) {
  const size = options.size || 128;
  const localLogoOverride = getCompanyLogoOverride(companyName);
  const websiteDomain = normalizeUrlToDomain(options.website);
  const mappedDomain = getMappedDomain(companyName);
  const domains = buildDomainCandidates(companyName, websiteDomain, mappedDomain);

  const candidates = [];

  // Maior prioridade: logo cadastrada pela própria empresa (Firestore/Storage).
  if (options.logoUrl && typeof options.logoUrl === "string") {
    candidates.push(options.logoUrl);
  }

  if (localLogoOverride) {
    candidates.push(localLogoOverride);
  }

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
  const initials = (companyName || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  candidates.push(
    `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1a237e&color=fff&size=${size}&font-size=0.4&bold=true`
  );

  return [...new Set(candidates)];
}
