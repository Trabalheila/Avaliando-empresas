export function getLinkedInRedirectUri() {
  const prodRedirectUri = "https://www.trabalheila.com.br/auth/auth/";
  const envRedirectUri = (process.env.REACT_APP_LINKEDIN_REDIRECT_URI || "").trim();
  if (envRedirectUri) {
    return envRedirectUri;
  }

  if (typeof window !== "undefined" && window.location) {
    const origin = String(window.location.origin || "").replace(/\/+$/, "");
    const hostname = String(window.location.hostname || "").toLowerCase();
    const port = String(window.location.port || "");
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isLocalDev = isLocalhost && port === "3000";

    if (isLocalDev) {
      return "http://localhost:3000/auth/auth/";
    }

    // Em app mobile (localhost sem :3000), use callback de produção
    // para evitar rejeição de redirect_uri não cadastrada no LinkedIn.
    if (isLocalhost) {
      return prodRedirectUri;
    }
  }

  return prodRedirectUri;
}