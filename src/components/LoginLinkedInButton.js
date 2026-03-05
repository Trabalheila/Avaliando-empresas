// src/components/LoginLinkedInButton.js
import React, { useCallback } from "react";
import { FaLinkedinIn } from "react-icons/fa";

function LoginLinkedInButton({ clientId, redirectUri }) { // Recebe como props
  const handleLogin = useCallback(() => {
    if (!clientId || !redirectUri) {
      console.error("Client ID ou Redirect URI do LinkedIn não configurados.");
      alert("Erro de configuração do LinkedIn. Por favor, tente novamente mais tarde.");
      return;
    }
const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
sessionStorage.setItem("linkedin_oauth_state", state);

const scope = "openid profile email"; // Escopos mínimos para OpenID Connect

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&amp;client_id=${clientId}&amp;redirect_uri=${encodeURIComponent(redirectUri)}&amp;state=${state}&amp;scope=${encodeURIComponent(scope)}`;

window.location.href = authUrl;

  }, [clientId, redirectUri]); // Adiciona dependências

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center gap-3 bg-blue-700 text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-blue-800 transition-colors text-base w-full"
    >
      <FaLinkedinIn className="text-lg" /> Entrar com LinkedIn
    </button>
  );
}

export default LoginLinkedInButton;