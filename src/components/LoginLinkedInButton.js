// src/components/LoginLinkedInButton.js
import React from 'react';
import { FaLinkedin } from 'react-icons/fa';

const LoginLinkedInButton = ({ clientId, redirectUri, disabled }) => {
  const handleLogin = () => {
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile%20email`;
  };

  return (
    <button
      onClick={handleLogin}
      disabled={disabled}
      className="flex items-center justify-center gap-2
                 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                 text-white font-semibold py-2 px-5 rounded-full shadow-md
                 disabled:opacity-50 disabled:cursor-not-allowed
                 w-auto mx-auto"
    >
      <FaLinkedin size={20} />
      <span>Entrar com LinkedIn</span>
    </button>
  );
};

export default LoginLinkedInButton;
