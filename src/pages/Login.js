// src/pages/Login.js
//
// Página de login unificada (`/login`).
// - Aceita login por e-mail/senha (Firebase Auth), Google (popup) e LinkedIn
//   (delegado ao componente `LoginLinkedInButton`, que abre popup OAuth).
// - Lê os parâmetros `companyConfirmed` e `redirectAfterLogin` da URL e os
//   persiste em sessionStorage para sobreviver ao redirect do OAuth.
// - Após login bem-sucedido, redireciona para `redirectAfterLogin` (se houver)
//   ou para a rota padrão `/minha-conta`.

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
import LoginLinkedInButton from "../components/LoginLinkedInButton";
import AppHeader from "../components/AppHeader";

const REDIRECT_AFTER_LOGIN_KEY = "trabalheiLa_redirectAfterLogin";
const COMPANY_CONFIRMED_FLAG_KEY = "trabalheiLa_companyConfirmedFlag";

// Tenta resolver a melhor rota padrão pós-login com base no perfil do usuário.
// Se houver uma empresa cadastrada com o e-mail logado, leva para o painel da
// empresa; caso contrário, leva para a área pessoal.
async function resolveDefaultRouteForUser(user) {
  if (!user?.email) return "/minha-conta";
  try {
    const snap = await getDocs(
      query(collection(db, "companies"), where("email", "==", user.email))
    );
    if (!snap.empty) return "/empresa-dashboard";
  } catch {
    /* permissões/índice ausente — fallback abaixo */
  }
  return "/minha-conta";
}

export default function Login({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Lê parâmetros e persiste em sessionStorage (sobrevive ao OAuth).
  const companyConfirmed = useMemo(() => {
    const fromQuery = searchParams.get("companyConfirmed") === "true";
    let fromSession = false;
    try {
      fromSession = sessionStorage.getItem(COMPANY_CONFIRMED_FLAG_KEY) === "1";
    } catch {
      /* ignore */
    }
    return fromQuery || fromSession;
  }, [searchParams]);

  useEffect(() => {
    try {
      if (searchParams.get("companyConfirmed") === "true") {
        sessionStorage.setItem(COMPANY_CONFIRMED_FLAG_KEY, "1");
      }
      const redir = searchParams.get("redirectAfterLogin");
      if (redir && redir.startsWith("/")) {
        sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, redir);
      }
    } catch {
      /* sessionStorage indisponível */
    }
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  function getRedirectTarget() {
    try {
      const fromSession = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
      if (fromSession && fromSession.startsWith("/")) return fromSession;
    } catch {
      /* ignore */
    }
    const fromQuery = searchParams.get("redirectAfterLogin") || "";
    if (fromQuery.startsWith("/")) return fromQuery;
    return "";
  }

  function clearRedirect() {
    try {
      sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
      sessionStorage.removeItem(COMPANY_CONFIRMED_FLAG_KEY);
    } catch {
      /* ignore */
    }
  }

  // Persiste o perfil mínimo em localStorage para que o restante do app
  // reconheça o usuário como autenticado (mesmo padrão usado em Home.js).
  function persistUserProfile(user, providerLabel) {
    try {
      const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const merged = {
        ...existing,
        id: user.uid || existing.id,
        uid: user.uid || existing.uid,
        name: user.displayName || existing.name || "",
        email: user.email || existing.email || "",
        picture: user.photoURL || existing.picture || existing.avatar || "",
        avatar: user.photoURL || existing.avatar || existing.picture || "",
        loginProvider: providerLabel,
        fallback: false,
      };
      localStorage.setItem("userProfile", JSON.stringify(merged));
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
    } catch {
      /* ignore */
    }
  }

  async function finishLogin(user, providerLabel) {
    persistUserProfile(user, providerLabel);
    const target = getRedirectTarget() || (await resolveDefaultRouteForUser(user));
    clearRedirect();
    navigate(target, { replace: true });
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResetMessage("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishLogin(cred.user, "email");
    } catch (err) {
      console.error("Erro no login por e-mail:", err);
      const code = String(err?.code || "");
      if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
        setError("E-mail ou senha incorretos.");
      } else if (code.includes("auth/too-many-requests")) {
        setError("Muitas tentativas. Tente novamente em alguns minutos.");
      } else if (code.includes("auth/invalid-email")) {
        setError("E-mail inválido.");
      } else {
        setError("Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setError("");
    setResetMessage("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result?.user) throw new Error("Falha ao autenticar com Google.");
      await finishLogin(result.user, "google");
    } catch (err) {
      console.error("Erro no login com Google:", err);
      const code = String(err?.code || "");
      if (code.includes("auth/popup-closed-by-user")) {
        setError("Login com Google cancelado.");
      } else if (code.includes("auth/popup-blocked")) {
        setError("Popup bloqueado. Permita popups e tente novamente.");
      } else if (code.includes("auth/unauthorized-domain")) {
        setError("Domínio não autorizado no Firebase Auth.");
      } else {
        setError("Não foi possível entrar com Google.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Callback do botão LinkedIn: o componente LoginLinkedInButton já abre popup
  // e devolve o profile via postMessage. Aqui chamamos a API /api/linkedin-auth
  // (mesmo backend usado em Home.js) e finalizamos o login.
  async function handleLinkedInSuccess({ profile, code }) {
    setSubmitting(true);
    setError("");
    try {
      let data = profile;
      if (!data && code) {
        const redirectUri = process.env.REACT_APP_LINKEDIN_REDIRECT_URI;
        const response = await fetch("/api/linkedin-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri }),
        });
        data = await response.json().catch(() => ({}));
        if (!response.ok || data?.error) {
          throw new Error(data?.error || `Erro HTTP ${response.status}`);
        }
      }
      if (!data) throw new Error("Sem dados de perfil.");

      // Persiste perfil LinkedIn no localStorage no mesmo formato do Home.js.
      const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const merged = {
        ...existing,
        ...data,
        loginProvider: "linkedin",
        fallback: false,
        avatar: data?.picture || data?.avatar || existing.avatar || existing.picture || "",
        picture: data?.picture || data?.avatar || existing.picture || existing.avatar || "",
      };
      localStorage.setItem("userProfile", JSON.stringify(merged));
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      const target = getRedirectTarget() || "/minha-conta";
      clearRedirect();
      navigate(target, { replace: true });
    } catch (err) {
      console.error("Erro no login com LinkedIn:", err);
      setError(`Falha ao conectar com LinkedIn: ${err?.message || ""}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setResetMessage("");
    if (!email) {
      setError("Informe o e-mail para receber o link de redefinição.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage("Enviamos um link de redefinição para o seu e-mail.");
    } catch (err) {
      console.error("Erro ao enviar reset:", err);
      const code = String(err?.code || "");
      if (code.includes("auth/user-not-found")) {
        setError("Não encontramos uma conta com este e-mail.");
      } else if (code.includes("auth/invalid-email")) {
        setError("E-mail inválido.");
      } else {
        setError("Não foi possível enviar o link. Tente novamente.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Entrar" />

      <div className="flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="text-center">
            <span className="inline-block px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-widest uppercase">
              Acesso
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              Entrar na Trabalhei Lá
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use seu e-mail, Google ou LinkedIn.
            </p>
          </div>

          {companyConfirmed && (
            <div
              role="status"
              aria-live="polite"
              className="mt-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200 text-center"
            >
              ✅ Sua empresa foi confirmada! Faça login para acessar seu painel.
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-800 dark:text-rose-200 text-center">
              {error}
            </div>
          )}
          {resetMessage && (
            <div className="mt-5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200 text-center">
              {resetMessage}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Senha</span>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-3 pr-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-bold text-blue-700 dark:text-blue-300"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
              >
                Esqueceu sua senha?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: submitting ? undefined : "#1a237e" }}
              className={`w-full h-11 rounded-lg font-bold text-white transition ${
                submitting ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
              }`}
            >
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span>ou continue com</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full h-11 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.5 29.1 4.5 24 4.5 16.3 4.5 9.6 8.7 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5.1l-6-4.9C29 35.5 26.6 36 24 36c-5.2 0-9.6-3.4-11.2-8l-6.5 5C9.6 39.3 16.3 43.5 24 43.5z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6 4.9c-.4.4 6.5-4.7 6.5-14.4 0-1.2-.1-2.4-.2-3.5z"/>
              </svg>
              Entrar com Google
            </button>

            <LoginLinkedInButton
              clientId={process.env.REACT_APP_LINKEDIN_CLIENT_ID}
              redirectUri={process.env.REACT_APP_LINKEDIN_REDIRECT_URI}
              onLoginSuccess={handleLinkedInSuccess}
            />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
            Não tem conta?{" "}
            <Link to="/empresa/cadastro" className="font-bold text-blue-700 dark:text-blue-300 hover:underline">
              Cadastre-se aqui
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
