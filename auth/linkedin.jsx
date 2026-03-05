import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    const savedState = sessionStorage.getItem("linkedin_oauth_state");

    if (!code || state !== savedState) {
      console.error("Erro de autenticação LinkedIn");
      navigate("/");
      return;
    }

    // Envia o código para seu backend
    fetch("/api/linkedin-auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        redirectUri: process.env.REACT_APP_LINKEDIN_REDIRECT_URI,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          console.log("Usuário autenticado:", data);
        } else {
          console.error("Erro backend:", data.error);
        }
        navigate("/");
      })
      .catch((err) => {
        console.error("Erro na autenticação:", err);
        navigate("/");
      });

  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <p className="text-xl font-semibold">
        Autenticando com LinkedIn...
      </p>
    </div>
  );
}

export default AuthLinkedIn;