import React from 'react';
import { FaLinkedinIn } from 'react-icons/fa';

function LoginLinkedInButton({ clientId, redirectUri }) {

  const handleLinkedInLogin = (e) => {
    e.preventDefault();

    const scope = 'r_liteprofile r_emailaddress';

    // Gera um state aleatório para segurança
    const state = Math.random().toString(36).substring(2);

    // Salva o state no sessionStorage para validar depois
    sessionStorage.setItem("linkedin_oauth_state", state);

    const linkedInUrl = `https://www.linkedin.com/oauth/v2/authorization
      ?response_type=code
      &client_id=${clientId}
      &redirect_uri=${encodeURIComponent(redirectUri)}
      &scope=${encodeURIComponent(scope)}
      &state=${state}`.replace(/\s+/g, '');

    window.location.href = linkedInUrl;
  };

  return (
    <button
      onClick={handleLinkedInLogin}
      type="button"
      className="flex items-center justify-center gap-3 bg-[#0077B5] text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-[#005582] transition-colors text-base w-full"
    >
      <FaLinkedinIn className="text-lg" /> Entrar com LinkedIn
    </button>
  );
}

export default LoginLinkedInButton;