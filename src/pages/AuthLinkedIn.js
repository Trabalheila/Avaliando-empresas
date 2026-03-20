import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description") || "";
    if (error) {
      const query = new URLSearchParams({
        linkedin_error: error,
        linkedin_error_description: errorDescription,
      });
      navigate(`/?${query.toString()}`, { replace: true });
      return;
    }

    if (code) {
      const query = new URLSearchParams({ linkedin_code: code });
      navigate(`/?${query.toString()}`, { replace: true });
      return;
    }

    navigate("/", { replace: true });
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;