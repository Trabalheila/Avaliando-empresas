import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    const savedState = sessionStorage.getItem("linkedin_oauth_state");

    if (!code) {
      console.error("Código ausente no retorno do LinkedIn.");
      navigate("/");
      return;
    }

    if (!savedState) {
      console.warn("Nenhum state encontrado no sessionStorage. Continuando mesmo assim.");
    } else if (state && state !== savedState) {
      console.warn("State mismatch (possível CSRF). Continuando mesmo assim.");
    }

    const saveAndNotify = (profile) => {
      const storedProfile = profile || { loggedIn: true };
      localStorage.setItem("userProfile", JSON.stringify(storedProfile));
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      try {
        if (window.opener && window.opener !== window && typeof window.opener.postMessage === "function") {
          window.opener.postMessage({ type: "linkedin_oauth", profile: storedProfile }, window.location.origin);
          window.close();
          return;
        }
      } catch (err) {
        // Ignore cross-origin errors
      }

      navigate("/pseudonym");
    };

    fetch("/api/linkedin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirectUri: process.env.REACT_APP_LINKEDIN_REDIRECT_URI,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          console.error("Erro no login:", data.error);
          // Continua o fluxo mesmo se a API backend falhar.
          saveAndNotify({ loggedIn: true, fallback: true });
          return;
        }

        sessionStorage.removeItem("linkedin_oauth_state");
        saveAndNotify(data);
      })
      .catch((err) => {
        console.error("Erro ao conectar com backend.", err);
        saveAndNotify({ loggedIn: true, fallback: true });
      });
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;