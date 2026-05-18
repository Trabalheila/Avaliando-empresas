// src/components/LoginProfileModal.jsx
//
// Modal exibido ao clicar em "Entrar" no topo da Home. Oferece 3 opções de
// perfil (Trabalhador / Empresário / Apoiador). Cada opção navega para a
// rota de login unificada (`/login`) propagando `?perfil=...` para que a
// página de login direcione o pós-login e o link de cadastro ao fluxo
// correto de cada perfil.
//
// O fluxo de autenticação (LinkedIn / Google / e-mail+senha) permanece o
// mesmo já implementado em `pages/Login.js`.

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginProfileModal({ open, onClose }) {
  const navigate = useNavigate();

  // Fecha com ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (perfil) => {
    onClose?.();
    navigate(`/login?perfil=${perfil}`);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar perfil para entrar"
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition flex items-center justify-center text-lg font-bold"
        >
          ×
        </button>

        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold tracking-widest uppercase">
            Entrar
          </span>
          <h2 className="mt-3 text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            Como você quer entrar?
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Escolha seu perfil para continuar.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => go("trabalhador")}
            className="w-full py-3 px-4 rounded-xl bg-lime-400 hover:bg-lime-500 text-emerald-950 font-bold shadow transition"
          >
            Sou Trabalhador
          </button>
          <button
            type="button"
            onClick={() => go("empresario")}
            className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold shadow transition"
          >
            Sou Empresário
          </button>
          <button
            type="button"
            onClick={() => go("apoiador")}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow transition"
          >
            Sou Apoiador
          </button>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">
          O fluxo de autenticação (LinkedIn, Google ou e-mail) é o mesmo para
          todos os perfis.
        </p>
      </div>
    </div>
  );
}
