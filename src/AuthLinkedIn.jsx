import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function AuthLinkedIn() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");

    if (code) {
      // Preserva dados locais (avatar e perfil) ao voltar do fluxo OAuth.
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      localStorage.setItem("userProfile", JSON.stringify({ ...existingProfile, loggedIn: true, code }));
      // Redireciona de volta para a página inicial
      navigate("/");
    } else {
      // Se der erro ou o usuário cancelar, volta para a home também
      navigate("/");
    }
  }, [navigate, location]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#eff6ff' }}>
      <h2 style={{ color: '#1e40af', fontFamily: 'sans-serif' }}>Autenticando com LinkedIn, aguarde...</h2>
    </div>
  );
}

export default AuthLinkedIn;