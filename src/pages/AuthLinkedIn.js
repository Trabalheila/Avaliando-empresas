import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    const savedState = sessionStorage.getItem("linkedin_oauth_state");

    if (!code || state !== savedState) {
      console.error("State inválido ou código ausente.");
      navigate("/");
      return;
    }

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
          navigate("/");
          return;
        }

        sessionStorage.removeItem("linkedin_oauth_state");

        // Salva o perfil do usuário e avisa o opener (se houver)
        localStorage.setItem("userProfile", JSON.stringify(data));

        try {
          if (window.opener && window.opener !== window && typeof window.opener.postMessage === "function") {
            window.opener.postMessage({ type: "linkedin_oauth", profile: data }, window.location.origin);
            window.close();
            return;
          }
        } catch (err) {
          // Ignore cross-origin errors
        }

        // Caso esteja no mesmo tab, redireciona para a definição de pseudônimo.
        navigate("/pseudonym");
      })
      .catch(() => {
        console.error("Erro ao conectar com backend.");
        navigate("/");
      });
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;