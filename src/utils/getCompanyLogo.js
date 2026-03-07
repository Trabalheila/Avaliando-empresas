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
  const domain = COMPANY_DOMAINS[companyName];

  // Prefer Google favicons API (biblioteca do Google) quando houver domínio conhecido.
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
  }

  // Fallback para avatar gerado (caso não exista domínio conhecido)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}&background=0D8ABC&color=fff&size=${size}&font-size=0.4`;
}
