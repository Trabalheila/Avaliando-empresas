// src/utils/videoCall.js
//
// Helpers compartilhados para videoconferência (Jitsi Meet).
// Usado por:
//  - components/Specialist/CaseDetailsPage.js
//  - pages/ApoiadorRequisicoes.js (agenda do especialista)
//  - pages/MinhaConta.js (agenda do trabalhador)

/** Gera (ou recupera) o link único de sala para um caso/consulta. */
export function buildVideoCallLink(id, existing) {
  if (existing) return existing;
  const safe = encodeURIComponent(
    String(id || "sem_id").replace(/[^a-zA-Z0-9_-]/g, "_")
  );
  return `https://meet.jit.si/TrabalheiLa_Caso_${safe}`;
}

/** Limites do plano Essencial para videoconferência (mock client-side). */
export const ESSENCIAL_VIDEO_MAX_MINUTES = 30;
export const ESSENCIAL_VIDEO_LIMIT_PER_MONTH = 5;

function usageKey(apoiadorId, month) {
  return `videoSessionsUsed:${month}:${apoiadorId || "anon"}`;
}

/** Lê o uso de sessões do mês corrente (YYYY-MM). */
export function readEssencialVideoUsage(apoiadorId) {
  const month = new Date().toISOString().slice(0, 7);
  const key = usageKey(apoiadorId, month);
  let used = 0;
  try {
    used = Number(localStorage.getItem(key) || "0") || 0;
  } catch {
    used = 0;
  }
  return { key, used, month };
}

/** Incrementa o contador e devolve o novo estado. */
export function incrementEssencialVideoUsage(apoiadorId) {
  const { key, used, month } = readEssencialVideoUsage(apoiadorId);
  const next = used + 1;
  try {
    localStorage.setItem(key, String(next));
  } catch {
    // ignore
  }
  return { key, used: next, month };
}

/** Formata um Date/Timestamp para "Começa em X min" se estiver próximo
 *  (até 60 min) ou "Agora" / "Em andamento". Retorna string ou null. */
export function formatStartsIn(value) {
  if (!value) return null;
  const ms =
    typeof value?.toDate === "function"
      ? value.toDate().getTime()
      : new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  const diff = ms - Date.now();
  const min = Math.round(diff / 60000);
  if (min > 60) return null;
  if (min > 1) return `Começa em ${min} minutos`;
  if (min === 1) return "Começa em 1 minuto";
  if (min >= -30) return "Em andamento";
  return null;
}
