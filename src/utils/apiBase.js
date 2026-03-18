const PROD_APP_ORIGIN = "https://www.trabalheila.com.br";

export function getApiBaseUrl() {
  const envBase = (process.env.REACT_APP_API_BASE_URL || "").trim();
  if (envBase) {
    return envBase.replace(/\/+$/, "");
  }

  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  const hostname = String(window.location.hostname || "").toLowerCase();
  const port = String(window.location.port || "");
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isReactDev = isLocalhost && port === "3000";

  if (isReactDev) {
    return "";
  }

  // Capacitor mobile geralmente roda em http://localhost sem backend /api local.
  if (isLocalhost) {
    return PROD_APP_ORIGIN;
  }

  return "";
}

export function buildApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
