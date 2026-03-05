// src/components/LoginLinkedInButton.js
import React from "react";
import { FaLinkedin } from "react-icons/fa";

function LoginLinkedInButton({ clientId, redirectUri }) { // Recebe clientId e redirectUri como props
  const handleLogin = () => {
    // Gera um estado aleatório para segurança CSRF
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('linkedin_oauth_state', state); // Salva o estado na sessionStorage

    const scope = "openid profile email"; // Escopos necessários para OpenID Connect
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center gap-3 bg-blue-700 text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-blue-800 transition-colors text-base w-full"
      aria-label="Entrar com LinkedIn"
    >
      <FaLinkedin className="text-lg" /> Entrar com LinkedIn
    </button>
  );
}

export default LoginLinkedInButton;