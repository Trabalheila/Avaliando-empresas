// src/services/profileType.js
//
// Persistência leve do perfil escolhido na Landing Page
// (Trabalhador / Especialista) ANTES de qualquer ação de autenticação.
//
// O valor fica em sessionStorage para sobreviver ao redirect do OAuth
// (Google popup, callback do LinkedIn). Quando o cadastro é finalizado,
// o `finalizeSocialLogin` (ou o submit manual) deve copiar esse valor
// para o documento do usuário no Firestore (`profileTypeChosen`) e
// para o `localStorage.userProfile`, e em seguida limpar o sessionStorage.

export const PROFILE_TYPE_KEY = "trabalheiLa_selectedProfileType";
export const PROFILE_TYPE_DEFAULT = "worker";

const ALLOWED_TYPES = new Set(["worker", "specialist"]);

function normalize(value) {
  const v = (value || "").toString().trim().toLowerCase();
  if (ALLOWED_TYPES.has(v)) return v;
  // Aceita alguns aliases comuns vindos de telas antigas.
  if (v === "trabalhador") return "worker";
  if (v === "apoiador" || v === "especialista" || v === "supporter") return "specialist";
  return "";
}

/**
 * Lê o perfil escolhido. Se não houver nada salvo, retorna o default
 * ("worker"). Não escreve no storage — quem precisa garantir o default
 * persistido deve chamar `ensureSelectedProfileType()`.
 */
export function getSelectedProfileType() {
  try {
    const raw = sessionStorage.getItem(PROFILE_TYPE_KEY);
    return normalize(raw) || PROFILE_TYPE_DEFAULT;
  } catch {
    return PROFILE_TYPE_DEFAULT;
  }
}

/**
 * Persiste a escolha. Aceita "worker" | "specialist" (ou aliases comuns).
 * Retorna o valor efetivamente gravado, ou "" se inválido.
 */
export function setSelectedProfileType(value) {
  const normalized = normalize(value);
  if (!normalized) return "";
  try {
    sessionStorage.setItem(PROFILE_TYPE_KEY, normalized);
  } catch {
    // Storage indisponível (modo privado, etc.) — silencioso.
  }
  return normalized;
}

/**
 * Garante que exista um valor padrão ("worker") em sessionStorage.
 * Usado no boot da Landing para que mesmo sem clique explícito o
 * usuário inicie como Trabalhador.
 */
export function ensureSelectedProfileType() {
  try {
    const current = normalize(sessionStorage.getItem(PROFILE_TYPE_KEY));
    if (!current) {
      sessionStorage.setItem(PROFILE_TYPE_KEY, PROFILE_TYPE_DEFAULT);
      return PROFILE_TYPE_DEFAULT;
    }
    return current;
  } catch {
    return PROFILE_TYPE_DEFAULT;
  }
}

/**
 * Limpa o storage temporário. Deve ser chamado pelo finalizador do
 * cadastro depois de copiar o valor para o perfil persistido.
 */
export function clearSelectedProfileType() {
  try {
    sessionStorage.removeItem(PROFILE_TYPE_KEY);
  } catch {
    // ignore
  }
}
