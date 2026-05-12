import React from "react";

// Ícones SVG inline para LinkedIn e Google (cores controladas via currentColor).
function LinkedinIcon({ className = "w-3 h-3" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.44-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.62 0 4.29 2.38 4.29 5.48v6.26zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.99 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.22 0z" />
    </svg>
  );
}

function GoogleIcon({ className = "w-3 h-3" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={className}
    >
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 18.9 13.5 24 13.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.6 8.9 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.5 2.5-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.1 16.2 43.5 24 43.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.5 5.5C39 36.7 43.5 31 43.5 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function CheckIcon({ className = "w-3 h-3" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// `size` em "sm" (padrão, para comentários) ou "md" (para painel admin).
export default function VerificationLevelBadge({ level, provider, size = "sm" }) {
  const sizing =
    size === "md"
      ? "px-2 py-1 text-xs"
      : "px-2 py-0.5 text-[10px]";
  const iconSize = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  if (level === "proven") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full ${sizing} font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700`}
        title="Vínculo comprovado com a empresa avaliada"
      >
        <CheckIcon className={iconSize} />
        Vínculo Comprovado
      </span>
    );
  }

  if (level === "identity") {
    const isGoogle = provider === "google";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full ${sizing} font-semibold bg-[#0A66C2]/10 text-[#0A66C2] border border-[#0A66C2]/30 dark:bg-[#0A66C2]/20 dark:text-[#7CB9F1] dark:border-[#0A66C2]/40`}
        title={`Identidade verificada via ${isGoogle ? "Google" : "LinkedIn"}`}
      >
        {isGoogle ? <GoogleIcon className={iconSize} /> : <LinkedinIcon className={iconSize} />}
        Identidade Verificada
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full ${sizing} font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`}
      title="Avaliação Livre — usuário não verificado"
    >
      Não verificado
    </span>
  );
}
