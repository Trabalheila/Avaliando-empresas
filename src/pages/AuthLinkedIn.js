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
        } else {
          sessionStorage.removeItem("linkedin_oauth_state");
          localStorage.setItem("userProfile", JSON.stringify(data));
          // Redireciona para a página de pseudônimo para garantir anonimato.
          navigate("/pseudonym");
        }
      })
      .catch(() => {
        console.error("Erro ao conectar com backend.");
        navigate("/");
      });
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;