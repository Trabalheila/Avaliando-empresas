import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveUserProfile } from "../services/users";
import { resolveProfileId } from "../utils/profileIdentity";
import { getLinkedInRedirectUri } from "../utils/linkedinAuth";
import { buildApiUrl } from "../utils/apiBase";

const LINKEDIN_OAUTH_RESULT_KEY = "linkedin_oauth_result";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description") || "";

    const savedState = sessionStorage.getItem("linkedin_oauth_state");

    if (!code) {
      if (error) {
        const query = new URLSearchParams({
          linkedin_error: error,
          linkedin_error_description: errorDescription,
        });
        navigate(`/?${query.toString()}`);
      } else {
        console.error("Código ausente no retorno do LinkedIn.");
        navigate("/");
      }
      return;
    }

    if (!savedState) {
      console.warn("Nenhum state encontrado no sessionStorage. Continuando mesmo assim.");
    } else if (state && state !== savedState) {
      console.warn("State mismatch (possível CSRF). Continuando mesmo assim.");
    }

    const saveAndNotify = async (profile) => {
      const picture = profile?.picture || profile?.avatar || "";
      const storedProfile = {
        ...(profile || {}),
        picture,
        avatar: profile?.avatar || picture,
        loginProvider: "linkedin",
        fallback: false,
      };

      const profileId = resolveProfileId(storedProfile);
      storedProfile.profileId = profileId;

      localStorage.setItem("userProfile", JSON.stringify(storedProfile));

      try {
        localStorage.setItem(
          LINKEDIN_OAUTH_RESULT_KEY,
          JSON.stringify({
            type: "linkedin_oauth",
            payload: { type: "linkedin_oauth", profile: storedProfile },
            createdAt: Date.now(),
          })
        );
      } catch {
        // ignore storage failures
      }

      // Notifica a janela principal ANTES do await do Firestore para não bloquear o retorno.
      // O perfil já está salvo no localStorage e pode ser lido imediatamente.
      try {
        if (window.opener && window.opener !== window && typeof window.opener.postMessage === "function") {
          window.opener.postMessage({ type: "linkedin_oauth", profile: storedProfile }, window.location.origin);
          window.close();
          // Persiste no Firestore em background após fechar o popup
          saveUserProfile({
            id: profileId,
            ...storedProfile,
            profileId,
            updatedAt: new Date().toISOString(),
          }).catch((err) => console.warn("Falha ao persistir perfil LinkedIn:", err));
          return;
        }
      } catch (err) {
        // Ignore cross-origin errors
      }

      // Fallback: sem opener — persiste e navega nesta aba
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      try {
        await saveUserProfile({
          id: profileId,
          ...storedProfile,
          profileId,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Falha ao persistir perfil LinkedIn:", err);
      }

      navigate("/pseudonym");
    };

    const notifyFailure = (message) => {
      try {
        localStorage.setItem(
          LINKEDIN_OAUTH_RESULT_KEY,
          JSON.stringify({
            type: "linkedin_oauth_error",
            payload: { type: "linkedin_oauth_error", message },
            createdAt: Date.now(),
          })
        );
      } catch {
        // ignore storage failures
      }

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

    fetch(buildApiUrl("/api/linkedin-auth"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        redirectUri: getLinkedInRedirectUri(),
      }),
    })
      .then(async (response) => {
        const rawText = await response.text();
        let data = {};
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = { error: rawText || `Erro HTTP ${response.status}` };
        }

        if (!response.ok && !data?.error) {
          data = { ...data, error: `Erro HTTP ${response.status}` };
        }

        return data;
      })
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
        notifyFailure(err?.message || "Falha ao conectar com LinkedIn");
      });
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;