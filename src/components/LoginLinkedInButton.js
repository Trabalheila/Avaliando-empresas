import React from "react";

const DEFAULT_SCOPE = "openid profile email";

const LoginLinkedInButton = ({
  clientId: clientIdProp,
  redirectUri: redirectUriProp,
  scope = DEFAULT_SCOPE,
  onLoginSuccess,
  onLoginFailure,
  disabled,
}) => {
  const handleLogin = () => {
    if (disabled) return;

    const clientId =
      clientIdProp || process.env.REACT_APP_LINKEDIN_CLIENT_ID || "";
    const redirectUri =
      redirectUriProp || process.env.REACT_APP_LINKEDIN_REDIRECT_URI || "";

    if (!clientId || String(clientId).trim().length < 5) {
      onLoginFailure?.(new Error("clientId do LinkedIn ausente/inválido"));
      return;
    }
    if (!redirectUri) {
      onLoginFailure?.(new Error("redirectUri ausente"));
      return;
    }

    const state = Math.random().toString(36).slice(2);
    try {
      sessionStorage.setItem("linkedin_oauth_state", state);
    } catch {
      // sem drama: se storage falhar, seguimos
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId, // obrigatório no LinkedIn <sources>[1]</sources>
      redirect_uri: redirectUri,
      scope,
      state,
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

    const width = 500;
    const height = 650;
    const left = Math.max(0, window.screen.width / 2 - width / 2);
    const top = Math.max(0, window.screen.height / 2 - height / 2);

    // 1) tenta popup
    const popup = window.open(
      authUrl,
      "LinkedIn Login",
      `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
    );

    // 2) se popup foi bloqueado (muito comum), faz redirect na mesma aba
    if (!popup) {
      window.location.assign(authUrl);
      return;
    }

    let finished = false;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(interval);
      finished = true;
    };

    // Você PRECISA que sua página de callback faça postMessage para o opener.
    // Exemplo de payload esperado: { type: "linkedin_oauth", code, state }
    const onMessage = (event) => {
      // ⚠️ SEGURANÇA CRÍTICA: Restrinja o origin ao seu domínio do app.
      // Em produção, substitua window.location.origin pelo seu domínio exato:
      // Ex: if (event.origin !== "https://www.trabalheila.com.br") return;
      // Para desenvolvimento, pode ser window.location.origin ou http://localhost:3000
      if (event.origin !== window.location.origin) {
        console.warn("Mensagem de origem desconhecida bloqueada:", event.origin);
        return;
      }

      const data = event.data;
      if (!data || data.type !== "linkedin_oauth") return;

      const returnedState = data.state;
      const code = data.code;

      const storedState = (() => {
        try {
          return sessionStorage.getItem("linkedin_oauth_state");
        } catch {
          return null;
        }
      })();

      if (!code) {
        cleanup();
        onLoginFailure?.(new Error("Callback do LinkedIn sem 'code'"));
        return;
      }

      if (storedState && returnedState && storedState !== returnedState) {
        cleanup();
        onLoginFailure?.(new Error("State inválido (possível CSRF)"));
        return;
      }

      cleanup();
      try {
        popup.close();
      } catch {}

      onLoginSuccess?.({ code, state: returnedState || storedState || state });
    };

    window.addEventListener("message", onMessage);

    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (finished) return;

      if (popup.closed) {
        cleanup();
        onLoginFailure?.(new Error("Login cancelado (popup fechado)"));
        return;
      }

      if (Date.now() - startedAt > 2 * 60 * 1000) {
        cleanup();
        try {
          popup.close();
        } catch {}
        onLoginFailure?.(new Error("Timeout no login do LinkedIn"));
      }
    }, 400);
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
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
      {disabled ? "Conectando..." : "Entrar com LinkedIn"}
    </button>
  );
};

export default LoginLinkedInButton;
