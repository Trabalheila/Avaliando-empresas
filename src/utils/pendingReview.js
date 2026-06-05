/*
 * pendingReview — buffer local para o fluxo de Lazy Registration.
 *
 * Quando o usuário envia uma avaliação SEM ter pseudônimo criado, a
 * avaliação é guardada em localStorage em vez de ir direto ao Firestore.
 * Após criar o pseudônimo em /pseudonym, o buffer é drenado e a
 * avaliação é persistida com o autor correto.
 *
 * Mantemos uma estrutura simples (single-slot) porque o usuário avalia
 * uma empresa por vez no formulário. Se enviar uma segunda avaliação
 * antes de criar o perfil, sobrescrevemos a anterior (a mais recente
 * sempre é prioritária).
 */
const KEY = "trabalheiLa_pendingReview_v1";

export function savePendingReview(payload) {
  if (!payload || typeof payload !== "object") return false;
  try {
    const wrapped = {
      payload,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(wrapped));
    return true;
  } catch (err) {
    console.warn("[pendingReview] Falha ao salvar buffer:", err);
    return false;
  }
}

export function loadPendingReview() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingReview() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function hasPendingReview() {
  return Boolean(loadPendingReview());
}
