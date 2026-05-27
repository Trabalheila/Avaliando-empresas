// Três níveis de verificação do usuário, conforme requisito do produto.
//   free     → "Avaliação Livre" (badge cinza "Não verificado")
//   identity → "Identidade Verificada" (badge azul + ícone da rede)
//   proven   → "Vínculo Comprovado" (badge verde + check)
//
// `proven` é dependente da empresa avaliada: depende de match em
// linkedinExperiences ou de upload de documento que comprovou vínculo.
// Por isso aceitamos `companyName` (opcional) para elevar o nível.

function normalize(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function userHasLinkedinMatchFor(userData, companyName) {
  const normalizedTarget = normalize(companyName);
  if (!normalizedTarget) return false;
  const list = Array.isArray(userData?.linkedinExperiences)
    ? userData.linkedinExperiences
    : [];
  return list.some((item) => {
    const name = (item?.company || item?.companyName || item?.organization || "").toString();
    const normalized = normalize(name);
    if (!normalized) return false;
    return normalized === normalizedTarget
      || normalized.includes(normalizedTarget)
      || normalizedTarget.includes(normalized);
  });
}

function userHasProvenDocFor(userData, companyName) {
  const target = normalize(companyName);
  if (!target) return false;
  const proven = Array.isArray(userData?.provenCompanies) ? userData.provenCompanies : [];
  return proven.some((c) => normalize(c) === target);
}

// Identidade: autenticação por rede social (LinkedIn ou Google) ou presença
// de marcadores fortes (perfil/experiências do LinkedIn).
function hasVerifiedIdentity(userData) {
  if (!userData || typeof userData !== "object") return { yes: false, provider: null };
  const provider = (userData.loginProvider || "").toString().toLowerCase();
  if (provider === "linkedin") return { yes: true, provider: "linkedin" };
  if (provider === "google") return { yes: true, provider: "google" };
  if (userData.linkedinProfile || userData.linkedInUrl) return { yes: true, provider: "linkedin" };
  if (Array.isArray(userData.linkedinExperiences) && userData.linkedinExperiences.length > 0) {
    return { yes: true, provider: "linkedin" };
  }
  if (userData.googleId || userData.googleProfile) return { yes: true, provider: "google" };
  return { yes: false, provider: null };
}

// Computa o nível do usuário. Quando `companyName` é informado, eleva para
// "proven" se houver match em linkedinExperiences ou em provenCompanies.
export function resolveUserVerificationLevel(userData, companyName) {
  if (!userData || typeof userData !== "object") return "free";

  // Se o doc já tem um valor salvo, respeitamos como piso (a menos que
  // possamos elevar para proven com base no contexto da empresa).
  const stored = (userData.verification_level || userData.verificationLevel || "").toString().toLowerCase();

  if (companyName && (userHasLinkedinMatchFor(userData, companyName) || userHasProvenDocFor(userData, companyName))) {
    return "proven";
  }
  if (stored === "proven") return "proven";

  const id = hasVerifiedIdentity(userData);
  if (stored === "identity" || id.yes) return "identity";

  return "free";
}

// Idem, mas também retorna o provedor (linkedin|google) para o badge usar
// o ícone correto.
export function resolveUserVerificationDetail(userData, companyName) {
  const level = resolveUserVerificationLevel(userData, companyName);
  const id = hasVerifiedIdentity(userData);
  let provider = id.provider;
  if (!provider) {
    const fromStored = (userData?.verification_provider || "").toString().toLowerCase();
    if (fromStored === "linkedin" || fromStored === "google") provider = fromStored;
  }
  const tier = resolveUserTier(userData);
  return { level, provider: provider || null, tier };
}

// ────────────────────────────────────────────────────────────────────────────
// Sistema de selos em 3 níveis (independente do legado free/identity/proven):
//   Nível 1 ("email")        → e-mail confirmado.
//   Nível 2 ("professional") → ≥1 experiência importada via LinkedIn OAuth.
//   Nível 3 ("complete")     → pseudônimo + e-mail verificado + ≥1 exp.
//                              verificada via LinkedIn + 4 etapas concluídas.
// Retorna null quando o usuário ainda não atingiu o Nível 1.
// ────────────────────────────────────────────────────────────────────────────
export function resolveUserTier(userData) {
  if (!userData || typeof userData !== "object") return null;
  if (userData.profileComplete === true) return "complete";
  if (userData.professionalVerified === true) return "professional";
  if (userData.emailVerified === true) return "email";
  return null;
}

// Retorna true quando o usuário possui o "Selo de Perfil Verificado",
// requisito para publicar avaliações de empresas. Aceita o selo certificado
// explícito ou os tiers superiores (professional/complete) do sistema atual,
// bem como o legado "proven" do esquema free/identity/proven.
export function isUserProfileCertified(userData) {
  if (!userData || typeof userData !== "object") return false;
  if (userData?.verification?.certified === true) return true;
  const stored = (userData.verification_level || userData.verificationLevel || "")
    .toString()
    .toLowerCase();
  if (stored === "proven") return true;
  const tier = resolveUserTier(userData);
  return tier === "professional" || tier === "complete";
}

// Computa se o usuário tem ≥1 experiência vinda do LinkedIn OAuth.
export function userHasLinkedInVerifiedExperience(userData) {
  if (!userData || typeof userData !== "object") return false;
  const structured = Array.isArray(userData?.resumeData?.experiencesStructured)
    ? userData.resumeData.experiencesStructured
    : [];
  if (structured.some((e) => (e?.source || "").toString().toLowerCase() === "linkedin" && e?.verified)) {
    return true;
  }
  const lkn = Array.isArray(userData.linkedinExperiences) ? userData.linkedinExperiences : [];
  return lkn.length > 0;
}

// Resolve o nível a partir de um entry/review já carregado.
// `cache` mapeia profileId -> { level, provider } previamente buscado dos users.
export function resolveEntryVerificationDetail(entry, cache, companyName) {
  if (!entry) return { level: "free", provider: null };
  // 1) Flags persistidas no próprio entry/review têm prioridade.
  const persisted = (entry.authorVerificationLevel || "").toString().toLowerCase();
  const persistedProvider = (entry.authorVerificationProvider || entry.authorLoginProvider || "").toString().toLowerCase();
  if (persisted === "proven") return { level: "proven", provider: persistedProvider || null };

  // 2) Match local no entry (LinkedIn + empresa do entry).
  const entryCompany = entry.company || companyName || "";
  const linkedinMatch = entry.authorLinkedinExperiences
    && userHasLinkedinMatchFor({ linkedinExperiences: entry.authorLinkedinExperiences }, entryCompany);
  const provenMatch = entry.authorProvenCompanies
    && userHasProvenDocFor({ provenCompanies: entry.authorProvenCompanies }, entryCompany);
  if (linkedinMatch || provenMatch) return { level: "proven", provider: "linkedin" };

  // 3) Cache (lookup do doc users).
  const cacheKey = entry.authorProfileId
    ? entry.authorProfileId
    : `pseudonym:${(entry.pseudonym || "").toLowerCase()}`;
  const cached = cache?.[cacheKey];
  if (cached && typeof cached === "object") return cached;

  // 4) Identidade declarada no entry.
  if (persisted === "identity") return { level: "identity", provider: persistedProvider || null };
  if (entry.authorLoginProvider === "linkedin" || entry.authorHasLinkedIn) {
    return { level: "identity", provider: "linkedin" };
  }
  if (entry.authorLoginProvider === "google") {
    return { level: "identity", provider: "google" };
  }
  return { level: "free", provider: null };
}

// Resolve o tier (sistema 3 níveis) a partir de um entry/review.
// Prioriza flags persistidas no próprio entry; se ausentes, recorre ao cache
// de docs de users.
export function resolveEntryTier(entry, cache) {
  if (!entry) return null;
  if (entry.authorProfileComplete === true) return "complete";
  if (entry.authorProfessionalVerified === true) return "professional";
  if (entry.authorEmailVerified === true) return "email";
  const cacheKey = entry.authorProfileId
    ? entry.authorProfileId
    : `pseudonym:${(entry.pseudonym || "").toLowerCase()}`;
  const cached = cache?.[cacheKey];
  if (cached && typeof cached === "object" && cached.tier) return cached.tier;
  return null;
}
