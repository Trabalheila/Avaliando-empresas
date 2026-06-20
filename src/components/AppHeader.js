import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { isAdmin } from "../utils/rbac";
import { isProfileAuthenticated } from "../utils/profileIdentity";
import NotificationsBell from "./NotificationsBell";

/* ════════════════════════════════════════════════
   AppHeader — Cabeçalho padronizado do projeto
   ════════════════════════════════════════════════

   Props:
     theme        — "light" | "dark"
     toggleTheme  — () => void
     title        — texto opcional exibido no centro (ex: "Painel Empresa")
     hideBack     — se true, oculta o botão Voltar
     hideAvatar   — se true, oculta avatar/dropdown
*/

function getProfile() {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}");
  } catch {
    return {};
  }
}

function getPseudonym() {
  try {
    const p = getProfile();
    return p?.pseudonym || p?.name || localStorage.getItem("userPseudonym") || "";
  } catch {
    return "";
  }
}

function getAvatarSrc() {
  try {
    const p = getProfile();
    const av = p?.avatar || p?.picture || "";
    if (av && typeof av === "string" && (av.startsWith("data:") || av.startsWith("http"))) {
      return av;
    }
    return null;
  } catch {
    return null;
  }
}

function getAvatarEmoji() {
  try {
    const p = getProfile();
    const av = p?.avatar || "";
    if (av && typeof av === "string" && !av.startsWith("data:") && !av.startsWith("http") && av.length <= 4) {
      return av;
    }
    return null;
  } catch {
    return null;
  }
}

export default function AppHeader({ theme, toggleTheme, title, hideBack, hideAvatar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const showBack = !hideBack && !isHome;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Estado de autenticação REAL (Firebase Auth), reconciliado com o cache
  // local. O header precisa saber se há sessão para decidir entre mostrar o
  // menu do usuário (logado) ou um botão "Entrar" (anônimo). Sem isso o menu
  // exibia "Minha conta"/"Sair" mesmo deslogado, levando o usuário anônimo a
  // /minha-conta (rota protegida) e à tela cinza.
  const [isAuthed, setIsAuthed] = useState(() => {
    try {
      return isProfileAuthenticated(getProfile());
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncFromStorage = () => {
      try {
        setIsAuthed(isProfileAuthenticated(getProfile()));
      } catch {
        setIsAuthed(false);
      }
    };
    // onAuthStateChanged é a fonte de verdade: usuário REAL (não anônimo)
    // → logado; null ou anônimo → mostra "Entrar".
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        setIsAuthed(true);
      } else {
        syncFromStorage();
      }
    });
    window.addEventListener("trabalheiLa_user_updated", syncFromStorage);
    window.addEventListener("focus", syncFromStorage);
    return () => {
      try { unsub(); } catch { /* ignore */ }
      window.removeEventListener("trabalheiLa_user_updated", syncFromStorage);
      window.removeEventListener("focus", syncFromStorage);
    };
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleLogout = useCallback(async () => {
    setDropdownOpen(false);
    // Encerra a sessão REAL do Firebase Auth ANTES de limpar o cache. Sem
    // isso a sessão do IndexedDB/localStorage permanecia ativa e a Home
    // re-autenticava o usuário automaticamente (logout "não pegava").
    try {
      await signOut(auth);
    } catch { /* segue limpando mesmo se o signOut falhar */ }
    try {
      localStorage.removeItem("userProfile");
      localStorage.removeItem("userPseudonym");
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
    } catch { /* silencioso */ }
    setIsAuthed(false);
    navigate("/");
  }, [navigate]);

  const handleLogin = useCallback(() => {
    setDropdownOpen(false);
    navigate("/login");
  }, [navigate]);

  const avatarSrc = getAvatarSrc();
  const avatarEmoji = getAvatarEmoji();
  const pseudonym = getPseudonym();
  const admin = isAdmin();

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-blue-100 dark:border-slate-700 shadow-sm" style={{ height: 'auto' }}>
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2 sm:py-0 sm:h-16" style={{ position: "relative" }}>
        {/* ── Zona esquerda: Voltar ── */}
        <div className="flex items-center gap-3 min-w-0" style={{ flex: "1 1 0%", position: "relative", zIndex: 10 }}>
          {showBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:opacity-80 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
          )}
        </div>

        {/* ── Zona central: Logo + título ── */}
        <div className="flex flex-col items-center shrink-0" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", zIndex: 1 }}>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-[1.1rem] sm:text-[1.25rem] md:text-[1.5rem] lg:text-[1.8rem] font-extrabold tracking-wide whitespace-nowrap text-blue-700 dark:text-blue-300 hover:opacity-80 transition"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            TRABALHEI LÁ
          </button>
          {title && (
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{title}</span>
          )}
        </div>

        {/* ── Zona direita: Tema + Avatar ── */}
        <div className="flex items-center justify-end gap-3" style={{ flex: "1 1 0%", position: "relative", zIndex: 10 }}>
          <button
            type="button"
            onClick={toggleTheme}
            className="px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-sm inline-flex items-center gap-1.5"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? "🌙" : "☀️"}
            <span className="appHeaderThemeLabel hidden sm:inline">{theme === "dark" ? "Tema Escuro" : "Tema Claro"}</span>
          </button>
          <style>{`
            @media (max-width: 480px) {
              .appHeaderThemeLabel { display: none !important; }
            }
          `}</style>

          {!hideAvatar && isAuthed && <NotificationsBell />}

          {/* Anônimo: botão claro "Entrar" (evita levar o usuário deslogado
              para /minha-conta — rota protegida que resultava em tela cinza). */}
          {!hideAvatar && !isAuthed && (
            <button
              type="button"
              onClick={handleLogin}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              Entrar
            </button>
          )}

          {!hideAvatar && isAuthed && (
            <>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 hover:opacity-80 transition"
                title={pseudonym || "Menu do usuário"}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar" className="h-8 w-8 rounded-full object-cover border border-blue-200 dark:border-slate-600" referrerPolicy="no-referrer" />
                ) : avatarEmoji ? (
                  <span className="text-xl">{avatarEmoji}</span>
                ) : (
                  <span className="h-8 w-8 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-lg">👤</span>
                )}
                {pseudonym && (
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:inline max-w-[100px] truncate">
                    {pseudonym}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-[60] py-1">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate("/trabalhador/encontrar-especialista"); }}
                    className="w-full text-left px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition"
                  >
                    Buscar especialista
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate("/minha-conta"); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Minha conta
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate("/apoiadores"); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Seja um Especialista
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); navigate("/apoiadores/lista"); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Especialistas
                  </button>
                  {admin && (
                    <button
                      type="button"
                      onClick={() => { setDropdownOpen(false); navigate("/admin"); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      Admin
                    </button>
                  )}
                  <hr className="my-1 border-slate-100 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
            {/* Botão "Sair" sempre visível ao lado do nome (paridade com o
                pedido de UX: logout claro, sem precisar abrir o dropdown). */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 text-sm font-bold transition"
              title="Sair da conta"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
