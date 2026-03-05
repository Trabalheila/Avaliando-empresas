// src/components/LoginLinkedInButton.js
import React from 'react';
import { FaLinkedinIn } from 'react-icons/fa';

function LoginLinkedInButton({ clientId, redirectUri }) {
  const handleLinkedInLogin = (e) => {
    e.preventDefault(); // Garante que o botão não dispare um submit de formulário se estiver dentro de um

    const scope = 'r_liteprofile r_emailaddress'; // Escopos necessários
    const linkedInUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

    // Redireciona a janela principal para a URL de autorização do LinkedIn
    window.location.href = linkedInUrl;
  };

  return (
    <button
      onClick={handleLinkedInLogin}
      className="flex items-center justify-center gap-3 bg-[#0077B5] text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-[#005582] transition-colors text-base w-full"
    >
      <FaLinkedinIn className="text-lg" /> Entrar com LinkedIn
    </button>
  );
}

export default LoginLinkedInButton;