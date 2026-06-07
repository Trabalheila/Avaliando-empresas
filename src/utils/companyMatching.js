// src/utils/companyMatching.js
//
// Normalização canônica de nomes de empresa para matching entre
// histórico LinkedIn e empresas avaliadas. Não é hash criptográfico —
// é só uma forma estável de comparar "Magalu", "magazine luiza s/a"
// etc. quando faz sentido.

const SUFFIXES = [
  "s a", "s/a", "sa", "ltda", "ltd", "me", "epp", "eireli",
  "inc", "llc", "corp", "co", "company",
];

export function normalizeCompanyName(value) {
  if (!value && value !== 0) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok, _idx, arr) => !(arr.length > 1 && SUFFIXES.includes(tok)))
    .join(" ")
    .trim();
}

export function buildCompanyKeys(value) {
  const norm = normalizeCompanyName(value);
  if (!norm) return [];
  // slug "magazine-luiza" + chave normalizada "magazine luiza"
  const slug = norm.replace(/\s+/g, "-");
  return Array.from(new Set([norm, slug]));
}

// true se algum dos `candidates` (lista de nomes/slugs do LinkedIn)
// bate com o `target` (nome/slug da empresa avaliada).
export function matchesAnyCompany(target, candidates) {
  if (!target) return false;
  const targetKeys = new Set(buildCompanyKeys(target));
  if (!targetKeys.size) return false;
  for (const c of candidates || []) {
    for (const k of buildCompanyKeys(c)) {
      if (targetKeys.has(k)) return true;
    }
  }
  return false;
}
