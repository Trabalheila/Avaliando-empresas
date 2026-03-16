export function getLinkedInRedirectUri() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/auth/`;
  }

  return "https://www.trabalheila.com.br/auth/auth/";
}