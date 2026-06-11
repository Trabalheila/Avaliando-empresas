import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../utils/apiBase";

const LINKEDIN_OAUTH_RESULT_KEY = "linkedin_oauth_result";
const LINKEDIN_OAUTH_RETURN_TO_KEY = "linkedin_oauth_return_to";
const LINKEDIN_OAUTH_OPEN_MODAL_KEY = "linkedin_oauth_open_modal";
const LINKEDIN_OAUTH_ACTION_KEY = "linkedin_oauth_action";
const LINKEDIN_OAUTH_STATE_KEY = "linkedin_oauth_state";

function AuthLinkedIn() {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description") || "";

    const safeMessage = (value) =>
      String(value || "Falha ao importar experiências do LinkedIn.")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 220);

    const consumeContext = () => {
      let returnTo = "/";
      let openModal = "experience";
      let action = "import_linkedin";
      let storedState = "";
      try {
        const storedReturnTo = sessionStorage.getItem(LINKEDIN_OAUTH_RETURN_TO_KEY) || "";
        if (storedReturnTo && storedReturnTo.startsWith("/")) {
          returnTo = storedReturnTo;
        }
        openModal = sessionStorage.getItem(LINKEDIN_OAUTH_OPEN_MODAL_KEY) || "experience";
        action = sessionStorage.getItem(LINKEDIN_OAUTH_ACTION_KEY) || "import_linkedin";
        storedState = sessionStorage.getItem(LINKEDIN_OAUTH_STATE_KEY) || "";
        sessionStorage.removeItem(LINKEDIN_OAUTH_RETURN_TO_KEY);
        sessionStorage.removeItem(LINKEDIN_OAUTH_OPEN_MODAL_KEY);
        sessionStorage.removeItem(LINKEDIN_OAUTH_ACTION_KEY);
        sessionStorage.removeItem(LINKEDIN_OAUTH_STATE_KEY);
      } catch {
        // ignore storage failures
      }
      return { returnTo, openModal, action, storedState };
    };

    const redirectBack = ({ returnTo, openModal, status, message }) => {
      const url = new URL(returnTo || "/", window.location.origin);
      url.searchParams.set("openModal", openModal || "experience");
      url.searchParams.set("import", "linkedin");
      url.searchParams.set("status", status || "error");
      if (message) {
        url.searchParams.set("message", safeMessage(message));
      }
      navigate(`${url.pathname}${url.search}${url.hash}`, { replace: true });
    };

    const persistResult = (payload) => {
      try {
        localStorage.setItem(
          LINKEDIN_OAUTH_RESULT_KEY,
          JSON.stringify({
            ...payload,
            createdAt: Date.now(),
          })
        );
      } catch {
        // ignore storage failures
      }
    };

    const context = consumeContext();
    console.info("[LinkedIn OAuth route callback] Iniciado", {
      hasCode: Boolean(code),
      hasError: Boolean(error),
      returnTo: context.returnTo,
      action: context.action,
    });

    if (context.action !== "import_linkedin") {
      redirectBack({
        returnTo: context.returnTo,
        openModal: context.openModal,
        status: "error",
        message: "Ação OAuth inválida. Tente novamente.",
      });
      return;
    }

    if (error) {
      persistResult({
        type: "linkedin_oauth_error",
        message: safeMessage(errorDescription || error),
      });
      redirectBack({
        returnTo: context.returnTo,
        openModal: context.openModal,
        status: "error",
        message: errorDescription || error || "Login no LinkedIn cancelado.",
      });
      return;
    }

    if (!code) {
      redirectBack({
        returnTo: context.returnTo,
        openModal: context.openModal,
        status: "error",
        message: "Callback do LinkedIn sem código de autorização.",
      });
      return;
    }

    if (context.storedState && state && context.storedState !== state) {
      persistResult({
        type: "linkedin_oauth_error",
        message: "Falha de segurança no login LinkedIn. Tente novamente.",
      });
      redirectBack({
        returnTo: context.returnTo,
        openModal: context.openModal,
        status: "error",
        message: "Falha de segurança no login LinkedIn. Tente novamente.",
      });
      return;
    }

    const exchange = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/linkedin-auth"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/linkedin`,
          }),
        });
        const raw = await response.text();
        let profile = {};
        try {
          profile = raw ? JSON.parse(raw) : {};
        } catch {
          profile = { error: raw || `Erro HTTP ${response.status}` };
        }

        if (!response.ok || profile?.error) {
          const message =
            profile?.error ||
            profile?.error_description ||
            "Nao foi possivel buscar dados do LinkedIn.";
          persistResult({ type: "linkedin_oauth_error", message: safeMessage(message) });
          redirectBack({
            returnTo: context.returnTo,
            openModal: context.openModal,
            status: "error",
            message,
          });
          return;
        }

        persistResult({
          type: "linkedin_oauth",
          code,
          state,
          profile,
        });

        console.info("[LinkedIn OAuth route callback] Importação preparada", {
          returnTo: context.returnTo,
          experiences: Array.isArray(profile?.linkedinExperiences)
            ? profile.linkedinExperiences.length
            : 0,
        });

        redirectBack({
          returnTo: context.returnTo,
          openModal: context.openModal,
          status: "success",
        });
      } catch (err) {
        const message = err?.message || "Falha ao processar callback do LinkedIn.";
        persistResult({ type: "linkedin_oauth_error", message: safeMessage(message) });
        redirectBack({
          returnTo: context.returnTo,
          openModal: context.openModal,
          status: "error",
          message,
        });
      }
    };

    exchange();
  }, [navigate]);

  return <p>Autenticando com LinkedIn...</p>;
}

export default AuthLinkedIn;