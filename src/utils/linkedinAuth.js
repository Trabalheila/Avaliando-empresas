export function getLinkedInRedirectUri() {
  const envRedirectUri = (process.env.REACT_APP_LINKEDIN_REDIRECT_URI || "").trim();
  if (envRedirectUri) {
    return envRedirectUri;
  }

  if (typeof window !== "undefined" && window.location) {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const port = String(window.location.port || "");
    const isLocalDev = (hostname === "localhost" || hostname === "127.0.0.1") && port === "3000";

    if (isLocalDev) {
      return "http://localhost:3000/auth/auth/";
    }
  }

  return "https://www.trabalheila.com.br/auth/auth/";
}