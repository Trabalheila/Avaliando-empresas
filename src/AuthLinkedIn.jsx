import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const authenticate = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const savedState = sessionStorage.getItem("linkedin_oauth_state");

      // 🔐 Validação de segurança
      if (!code || state !== savedState) {
        console.error("Erro na autenticação LinkedIn");
        navigate("/");
        return;
      }

      try {
        const response = await fetch("/api/linkedin-auth", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            redirectUri: process.env.REACT_APP_LINKEDIN_REDIRECT_URI,
          }),
        });

        const data = await response.json();

        if (data.error) {
          console.error("Erro backend:", data.error);
          navigate("/");
          return;
        }

        // ✅ Aqui você pode salvar o usuário
        console.log("Usuário autenticado:", data);

        // Exemplo: salvar no localStorage
        localStorage.setItem("user", JSON.stringify(data));

        navigate("/");
      } catch (error) {
        console.error("Erro na requisição:", error);
        navigate("/");
      }
    };

    authenticate();
  }, [navigate]);

  return (
    <div className="p-10 text-center text-lg font-semibold">
      Autenticando com LinkedIn...
    </div>
  );
}

export default AuthLinkedIn;