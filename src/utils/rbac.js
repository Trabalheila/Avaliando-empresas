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

/** Retorna true se o usuário tem acesso premium ao Dashboard detalhado. */
export function isPremium() {
  const profile = getStoredProfile();
  // is_premium pode ser definido manualmente no perfil do Firestore.
  return Boolean(profile?.is_premium) || getUserRole() === "admin_empresa";
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
