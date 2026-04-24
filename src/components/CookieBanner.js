import React from "react";

const COOKIES_ACCEPTED_KEY = "cookiesAccepted";

function hasAcceptedCookies() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(COOKIES_ACCEPTED_KEY) === "true";
}

function CookieBanner() {
  const [isVisible, setIsVisible] = React.useState(() => !hasAcceptedCookies());

  const handleAccept = React.useCallback(() => {
    try {
      window.localStorage.setItem(COOKIES_ACCEPTED_KEY, "true");
    } catch {
      // Ignore storage failures and still hide banner for current session.
    }
    setIsVisible(false);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-[80] border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-6px_30px_rgba(15,23,42,0.12)]"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-sm text-slate-700">
          Usamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa{" "}
          <a href="/politica-de-privacidade" className="font-semibold text-blue-700 underline hover:text-blue-800">
            Política de Privacidade
          </a>
          .
        </p>

        <button
          type="button"
          onClick={handleAccept}
          className="self-end rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:self-auto"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

export default CookieBanner;
