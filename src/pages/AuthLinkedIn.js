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
      const storedProfile = profile || {};
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

    const notifyFailure = (message) => {
      try {
        if (window.opener && window.opener !== window && typeof window.opener.postMessage === "function") {
          window.opener.postMessage({ type: "linkedin_oauth_error", message }, window.location.origin);
          window.close();
          return;
        }
      } catch {
        // Ignore cross-origin errors
      }

      navigate("/?linkedin_error=1");
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
          notifyFailure(data.error);
          return;
        }

        sessionStorage.removeItem("linkedin_oauth_state");
        saveAndNotify(data);
      })
      .catch((err) => {
        console.error("Erro ao conectar com backend.", err);
        notifyFailure("Falha ao conectar com LinkedIn");
      });
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;