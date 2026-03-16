export function getLinkedInRedirectUri() {
  const configuredUri = (process.env.REACT_APP_LINKEDIN_REDIRECT_URI || "").toString().trim();
  if (configuredUri) {
    return configuredUri;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/auth/`;
  }

  return "https://www.trabalheila.com.br/auth/auth/";
}