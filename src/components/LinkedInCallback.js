import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function LinkedInCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    const savedState = sessionStorage.getItem("linkedin_oauth_state");

    if (!code || state !== savedState) {
      console.error("State inválido");
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
        if (!data.error) {
          navigate("/");
        }
      })
      .catch(() => navigate("/"));
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg font-semibold">
        Autenticando com LinkedIn...
      </p>
    </div>
  );
}

export default LinkedInCallback;