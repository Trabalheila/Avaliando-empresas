export function getLinkedInRedirectUri() {
  if (typeof window !== "undefined" && window.location?.hostname === "localhost") {
    return "http://localhost:3000/auth/auth/";
  }

  return "https://www.trabalheila.com.br/auth/auth/";
}