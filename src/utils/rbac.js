/**
 * rbac.js — Controle de acesso baseado em papel (RBAC).
 *
 * Papéis suportados:
 *   "user"          — visitante comum (padrão)
 *   "admin_empresa" — gestor da empresa, acessa o Dashboard premium
 *
 * O booleano `is_premium` habilita a chamada ao endpoint /api/admin-reviews
 * que retorna os arrays de avaliações completos com timestamps.
 */

/** Retorna o perfil do usuário salvo em localStorage. */
function getStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}");
  } catch {
    return {};
  }
}

/**
 * Retorna o papel ("role") do usuário atual.
 * Aceita "admin_empresa" ou "user" (padrão).
 */
export function getUserRole() {
  const profile = getStoredProfile();
  const raw = (profile?.role || "").toString().toLowerCase().trim();
  return raw === "admin_empresa" ? "admin_empresa" : "user";
}

/** Retorna true se o usuário autenticado é o administrador da página. */
export function isAdmin() {
  const adminUid = (process.env.REACT_APP_ADMIN_UID || "").trim();
  if (!adminUid) return false;
  const profile = getStoredProfile();
  const uid = (profile?.uid || profile?.id || profile?.profileId || "").toString().trim();
  return Boolean(uid) && uid === adminUid;
}

/** Retorna true se o usuário tem acesso premium ao Dashboard detalhado. */
export function isPremium() {
  const profile = getStoredProfile();
  // is_premium pode ser definido manualmente no perfil do Firestore.
  return Boolean(profile?.is_premium) || getUserRole() === "admin_empresa" || isAdmin();
}

/** Retorna true se o usuário é um Apoiador autenticado (acesso completo a conteúdo restrito). */
export function isSupporter() {
  const profile = getStoredProfile();
  const role = (profile?.role || "").toString().toLowerCase().trim();
  return (
    Boolean(profile?.is_supporter) ||
    Boolean(profile?.apoiadorId) ||
    role === "apoiador" ||
    role === "supporter" ||
    isAdmin()
  );
}

/**
 * Retorna true se o usuário é um Apoiador no plano PREMIUM.
 * Habilita recursos exclusivos como o botão "Solicitar contato" com avaliadores.
 */
export function isPremiumSupporter() {
  if (!isSupporter()) return false;
  const profile = getStoredProfile();
  const plano = (profile?.apoiadorPlano || profile?.plano || "").toString().toLowerCase().trim();
  return (
    Boolean(profile?.is_premium_supporter) ||
    plano === "premium" ||
    isAdmin()
  );
}

/** Retorna true se o usuário é Trabalhador Premium (vê resumos de conteúdo restrito). */
export function isPremiumWorker() {
  const profile = getStoredProfile();
  const role = (profile?.role || "").toString().toLowerCase().trim();
  return (
    Boolean(profile?.is_premium_worker) ||
    role === "premium_worker" ||
    role === "trabalhador_premium" ||
    isSupporter()
  );
}

/**
 * Retorna a "camada de visibilidade" do leitor para conteúdo restrito.
 *   "supporter"     — vê o texto completo com destaque visual
 *   "premium_worker"— vê apenas o resumo curto entre colchetes
 *   "free"          — vê apenas o aviso de conteúdo sensível
 */
export function getRestrictedContentTier() {
  if (isSupporter()) return "supporter";
  if (isPremiumWorker()) return "premium_worker";
  return "free";
}

/**
 * Persiste o papel e is_premium no perfil local.
 * Útil para testes ou quando um admin_empresa faz login.
 */
export function applyRoleToLocalProfile(role, is_premium = false) {
  try {
    const profile = getStoredProfile();
    const updated = { ...profile, role, is_premium: is_premium || role === "admin_empresa" };
    localStorage.setItem("userProfile", JSON.stringify(updated));
  } catch {
    // silencioso
  }
}
