export const PROFILE_ID_STORAGE_KEY = "trabalheiLa_profile_id";

function safeReadStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write failures.
  }
}

export function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

export function getStoredProfileId() {
  return safeReadStorage(PROFILE_ID_STORAGE_KEY) || "";
}

export function clearStoredProfileId() {
  try {
    localStorage.removeItem(PROFILE_ID_STORAGE_KEY);
  } catch {
    // Ignore localStorage failures.
  }
}

export function ensureStoredProfileId() {
  const existing = getStoredProfileId();
  if (existing) return existing;

  const generated =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `profile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);

  safeWriteStorage(PROFILE_ID_STORAGE_KEY, generated);
  return generated;
}

export function resolveProfileId(profile, options = {}) {
  const { persistGeneratedId = true } = options;
  const normalizedEmail = normalizeEmail(profile?.email);
  if (normalizedEmail) {
    const emailId = `email:${normalizedEmail}`;
    if (persistGeneratedId) safeWriteStorage(PROFILE_ID_STORAGE_KEY, emailId);
    return emailId;
  }

  const provider = (profile?.loginProvider || "").toString().trim().toLowerCase();
  const rawProviderId =
    (profile?.id || profile?.uid || profile?.userId || "")
      .toString()
      .trim();

  if (rawProviderId) {
    const providerId = provider ? `${provider}:${rawProviderId}` : rawProviderId;
    if (persistGeneratedId) safeWriteStorage(PROFILE_ID_STORAGE_KEY, providerId);
    return providerId;
  }

  return persistGeneratedId ? ensureStoredProfileId() : getStoredProfileId();
}

export function isProfileAuthenticated(profile) {
  if (!profile || typeof profile !== "object") return false;
  const hasIdentity = Boolean(resolveProfileId(profile, { persistGeneratedId: false }));
  return hasIdentity && profile?.fallback !== true;
}
