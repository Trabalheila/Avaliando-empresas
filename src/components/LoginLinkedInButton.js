// src/components/LoginLinkedInButton.js
import React, { useCallback, useState } from "react";
import { FaLinkedinIn } from "react-icons/fa";

function LoginLinkedInButton({ clientId, redirectUri }) {
  const handleLogin = useCallback(() => {
    // Garante que vai pegar a chave, seja por prop ou direto do .env
    const finalClientId = clientId || process.env.REACT_APP_LINKEDIN_CLIENT_ID;
    const finalRedirectUri = redirectUri || process.env.REACT_APP_LINKEDIN_REDIRECT_URI;

    if (!finalClientId || !finalRedirectUri) {
      console.error("Client ID ou Redirect URI do LinkedIn não configurados.");
      alert("Erro de configuração do LinkedIn. Verifique as variáveis de ambiente.");
      return;
    }

    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("linkedin_oauth_state", state);

    const scope = "openid profile email";

    // CORREÇÃO CRÍTICA: Usando apenas '&' para separar os parâmetros
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${finalClientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

    // Abre o fluxo em uma janela popup (sem sair da página)
    const width = 500;
    const height = 650;
    const left = Math.max(0, window.screen.width / 2 - width / 2);
    const top = Math.max(0, window.screen.height / 2 - height / 2);

    const popup = window.open(
      authUrl,
      "LinkedIn Login",
      `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars`
    );

    if (!popup) {
      alert("Popup bloqueado. Permita popups para continuar o login.");
    }

  }, [clientId, redirectUri]);

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