import React from "react";

const LoginLinkedInButton = ({
  clientId,
  redirectUri,
  onLoginSuccess,
  onLoginFailure,
  disabled,
}) => {
  const handleLogin = () => {
    if (disabled) return;

    if (!clientId || String(clientId).trim().length < 5) {
      onLoginFailure?.(new Error("clientId do LinkedIn ausente/ inválido"));
      return;
    }
    if (!redirectUri) {
      onLoginFailure?.(new Error("redirectUri ausente"));
      return;
    }

    const state = Math.random().toString(36).slice(2);

    const authUrl =
      "https://www.linkedin.com/oauth/v2/authorization" +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("openid profile email")}` +
      `&state=${encodeURIComponent(state)}`;

    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      authUrl,
      "LinkedIn Login",
      `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
    );

    if (!popup) {
      onLoginFailure?.(new Error("Popup bloqueado pelo navegador"));
      return;
    }

    // Neste momento você ainda não trata o "code" do OAuth.
    // Então fechar popup = cancelado (não sucesso).
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        onLoginFailure?.(new Error("Login cancelado (popup fechado)"));
      }

      if (Date.now() - startedAt > 2 * 60 * 1000) {
        clearInterval(interval);
        try {
          popup.close();
        } catch {}
        onLoginFailure?.(new Error("Timeout no login do LinkedIn"));
      }
    }, 500);
  };

  return (
    <button
      onClick={handleLogin}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-lg font-semibold text-sm md:text-base transition-all
        flex items-center justify-center gap-2 max-w-xs w-full
        ${
          disabled
            ? "bg-gray-400 cursor-not-allowed opacity-60 text-white"
            : "bg-[#0077B5] hover:bg-[#005582] text-white hover:shadow-lg"
        }
      `}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
      {disabled ? "Conectando..." : "Entrar com LinkedIn"}
    </button>
  );
};

export default LoginLinkedInButton;
