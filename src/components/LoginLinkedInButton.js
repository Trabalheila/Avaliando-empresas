// LoginLinkedInButton.js
import React from 'react';
import { FaLinkedin } from 'react-icons/fa';

const LoginLinkedInButton = ({ clientId, redirectUri, onLoginSuccess, onLoginFailure }) => {
  const handleLogin = () => {
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=r_liteprofile%20r_emailaddress`;
  };

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center space-x-2 w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white font-semibold py-3 px-6 rounded-full shadow-lg transition duration-300"
    >
      <FaLinkedin size={24} />
      <span>Entrar com LinkedIn</span>
    </button>
  );
};

export default LoginLinkedInButton;
