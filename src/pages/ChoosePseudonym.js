// src/pages/ChoosePseudonym.js
//
// Tela de criação de perfil — versão CRO (Lazy Registration).
//
// Substituiu o wizard de 4 etapas anterior. Princípios:
//   1. Página única. Sem multistep, sem barra de progresso.
//   2. Social login no topo (Google + LinkedIn).
//   3. LinkedIn é destacado como caminho para o "Selo de Perfil Verificado".
//   4. Cadastro manual com EXATAMENTE 3 campos: pseudônimo, e-mail, senha.
//   5. Zero coleta de CPF nesta tela (CPF é opt-in em /minha-conta).
//   6. Sem player de vídeo nem ilustração lateral.
//
// O fluxo de Lazy Registration continua intacto:
//   - Ao chegar com ?after-review=1 ou flag de sessão, mostramos um banner
//     verde de confirmação.
//   - Após criar o perfil, drenamos a avaliação bufferizada
//     (loadPendingReview → saveReview) e vinculamos quaisquer reviews
//     anônimas existentes ao novo pseudônimo (linkAnonymousReviewsToPseudonym).
//   - Mantemos o doc /cadastros_iniciados/{uid} para acompanhar funil.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import AppHeader from "../components/AppHeader";
import LoginLinkedInButton from "../LoginLinkedInButton";

import { auth, db } from "../firebase";
import {
  signInWithGoogle,
  authenticateLinkedInCode,
  finalizeSocialLogin,
  signUpWithEmailPassword,
} from "../services/socialAuth";

// ─────────────────────────────────────────────────────────────────────
// Helpers locais
// ─────────────────────────────────────────────────────────────────────

function pseudonymFromName(name = "") {
  const first = (name || "")
    .toString()
    .trim()
    .split(/\s+/)[0] || "";
  return first
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 18);
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
}

// ─────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────

export default function ChoosePseudonym({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Detecta se viemos do fluxo de Lazy Registration (avaliação pendente).
  const isAfterReview = useMemo(() => {
    try {
      const params = new URLSearchParams(location?.search || "");
      if (params.get("after-review") === "1") return true;
      return sessionStorage.getItem("trabalheiLa_postReviewPseudonymPrompt") === "1";
    } catch {
      return false;
    }
  }, [location?.search]);

  // Form (3 campos do fluxo manual).
  const [pseudonym, setPseudonym] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UX
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // Quando o login social termina, ainda precisamos garantir que existe um
  // pseudônimo. Mostramos uma view enxuta apenas pedindo o pseudônimo se ele
  // ainda não foi escolhido.
  const [socialAwaitingPseudonym, setSocialAwaitingPseudonym] = useState(false);
  const [socialContext, setSocialContext] = useState(null);
  // { provider: "google"|"linkedin", uid, email, displayName, picture, profile }

  // ─── Boot: garante UID anônimo do Firebase Auth para o funil ───
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.warn("[choosePseudonym] signInAnonymously falhou:", err);
        }
      }
    });
    return () => {
      try { unsub(); } catch { /* ignore */ }
    };
  }, []);

  // ─── Marca cadastros_iniciados no primeiro toque do usuário ───
  const markFunnelStarted = useCallback(async () => {
    try {
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      await setDoc(
        doc(db, "cadastros_iniciados", uid),
        {
          uid,
          source: "choose-pseudonym",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[choosePseudonym] Falha ao marcar funil:", err?.message || err);
    }
  }, []);

  // ─── Finaliza perfil delegando ao serviço de auth social ───
  const finalizeProfile = useCallback(
    async ({ uid, chosenPseudonym, emailValue, providerLabel, extra = {}, linkedinExperiences = null }) => {
      const result = await finalizeSocialLogin({
        uid,
        pseudonym: chosenPseudonym,
        email: emailValue,
        providerLabel: providerLabel || "email",
        extra,
        linkedinExperiences,
      });
      const drained = result?.pending;
      const destination = drained?.drained && drained?.company
        ? `/empresa?name=${encodeURIComponent(drained.company)}`
        : "/";
      navigate(destination);
    },
    [navigate]
  );

  // ─── Login com Google ───
  const handleGoogleClick = useCallback(async () => {
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await markFunnelStarted();
      const session = await signInWithGoogle();

      const existingPseudo = (
        session.existingProfile?.pseudonimo ||
        session.existingProfile?.pseudonym ||
        ""
      ).toString().trim();

      if (existingPseudo) {
        await finalizeProfile({
          uid: session.uid,
          chosenPseudonym: existingPseudo,
          emailValue: session.email,
          providerLabel: "google",
          extra: {
            picture: session.picture,
            avatar: session.picture,
            nomeReal: session.existingProfile?.nomeReal || session.displayName,
            fullName: session.existingProfile?.fullName || session.displayName,
          },
        });
        return;
      }

      const suggested = pseudonymFromName(session.displayName);
      setPseudonym(suggested);
      setEmail(session.email);
      setSocialContext({
        provider: "google",
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
        picture: session.picture,
      });
      setSocialAwaitingPseudonym(true);
    } catch (err) {
      console.error("[choosePseudonym] Google falhou:", err);
      const code = String(err?.code || "");
      if (code.includes("auth/popup-closed-by-user")) {
        setError("Login com Google cancelado.");
      } else if (code.includes("auth/popup-blocked")) {
        setError("Popup bloqueado. Permita popups e tente novamente.");
      } else {
        setError("Não foi possível entrar com o Google. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [finalizeProfile, markFunnelStarted]);

  // ─── Login com LinkedIn ───
  const handleLinkedInSuccess = useCallback(
    async ({ profile, code } = {}) => {
      setError("");
      setInfo("");
      setSubmitting(true);
      try {
        await markFunnelStarted();

        let session;
        if (profile && !code) {
          // O componente já entregou o profile direto (raro).
          const { extractLinkedInExperiences } = await import("../services/socialAuth");
          session = {
            provider: "linkedin",
            uid: auth?.currentUser?.uid || profile?.id || profile?.sub || "",
            email: (profile?.email || "").toLowerCase(),
            displayName:
              profile?.name ||
              [profile?.localizedFirstName, profile?.localizedLastName].filter(Boolean).join(" ") ||
              "",
            picture: profile?.picture || profile?.avatar || "",
            profile,
            linkedinExperiences: extractLinkedInExperiences(profile),
            existingProfile: null,
            sealVerified: true,
          };
        } else {
          session = await authenticateLinkedInCode({
            code,
            redirectUri:
              process.env.REACT_APP_LINKEDIN_REDIRECT_URI ||
              `${window.location.origin}/auth/auth/`,
          });
        }

        if (!session.uid) {
          throw new Error("UID indisponível após login LinkedIn.");
        }

        const linkedInExtras = {
          picture: session.picture,
          avatar: session.picture,
          nomeReal: session.existingProfile?.nomeReal || session.displayName,
          fullName: session.existingProfile?.fullName || session.displayName,
          linkedInUrl:
            session.profile?.linkedInUrl ||
            session.profile?.publicProfileUrl ||
            session.profile?.profileUrl ||
            "",
          linkedInId: session.profile?.id || session.profile?.sub || "",
          linkedinExperiences: session.linkedinExperiences,
          verifiedProfileBadge: true,
          verifiedProfileBadgeSource: "linkedin",
        };

        const existingPseudo = (
          session.existingProfile?.pseudonimo ||
          session.existingProfile?.pseudonym ||
          ""
        ).toString().trim();

        if (existingPseudo) {
          await finalizeProfile({
            uid: session.uid,
            chosenPseudonym: existingPseudo,
            emailValue: session.email,
            providerLabel: "linkedin",
            extra: linkedInExtras,
            linkedinExperiences: session.linkedinExperiences,
          });
          return;
        }

        const suggested = pseudonymFromName(session.displayName);
        setPseudonym(suggested);
        setEmail(session.email);
        setSocialContext({
          provider: "linkedin",
          uid: session.uid,
          email: session.email,
          displayName: session.displayName,
          picture: session.picture,
          extra: linkedInExtras,
          linkedinExperiences: session.linkedinExperiences,
        });
        setSocialAwaitingPseudonym(true);
      } catch (err) {
        console.error("[choosePseudonym] LinkedIn falhou:", err);
        setError(`Não foi possível entrar com LinkedIn: ${err?.message || String(err)}`);
      } finally {
        setSubmitting(false);
      }
    },
    [finalizeProfile, markFunnelStarted]
  );

  const handleLinkedInFailure = useCallback((err) => {
    setError(`Falha ao conectar com LinkedIn: ${err?.message || String(err)}`);
  }, []);

  // ─── Cadastro manual (e-mail + senha) ───
  const handleManualSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      setError("");
      setInfo("");

      const pseudo = pseudonym.trim();
      const emailValue = email.trim().toLowerCase();

      if (!pseudo) {
        setError("Escolha um pseudônimo.");
        return;
      }
      if (pseudo.length < 3) {
        setError("O pseudônimo precisa ter pelo menos 3 caracteres.");
        return;
      }
      if (!isValidEmail(emailValue)) {
        setError("Informe um e-mail válido.");
        return;
      }
      if (!password || password.length < 6) {
        setError("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }

      setSubmitting(true);
      try {
        await markFunnelStarted();

        let signed;
        try {
          signed = await signUpWithEmailPassword({
            email: emailValue,
            password,
          });
        } catch (authErr) {
          const code = String(authErr?.code || "");
          if (
            code === "trabalheila/email-already-in-use" ||
            code.includes("auth/email-already-in-use")
          ) {
            setError("Este e-mail já está cadastrado. Tente entrar pelo /login.");
            return;
          }
          if (code.includes("auth/weak-password")) {
            setError("Senha muito fraca. Use pelo menos 6 caracteres com letras e números.");
            return;
          }
          if (code.includes("auth/invalid-email")) {
            setError("E-mail inválido.");
            return;
          }
          throw authErr;
        }

        await finalizeProfile({
          uid: signed.uid,
          chosenPseudonym: pseudo,
          emailValue: signed.email,
          providerLabel: "email",
          extra: {},
        });
      } catch (err) {
        console.error("[choosePseudonym] Submit manual falhou:", err);
        setError("Não foi possível criar o perfil agora. Tente novamente em instantes.");
      } finally {
        setSubmitting(false);
      }
    },
    [pseudonym, email, password, finalizeProfile, markFunnelStarted]
  );

  // ─── Finaliza pseudônimo após login social ───
  const handleSocialPseudonymConfirm = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault();
      setError("");
      const pseudo = pseudonym.trim();
      if (!pseudo || pseudo.length < 3) {
        setError("O pseudônimo precisa ter pelo menos 3 caracteres.");
        return;
      }
      if (!socialContext?.uid) {
        setError("Sessão social expirou. Tente entrar novamente.");
        setSocialAwaitingPseudonym(false);
        return;
      }
      setSubmitting(true);
      try {
        await finalizeProfile({
          uid: socialContext.uid,
          chosenPseudonym: pseudo,
          emailValue: socialContext.email,
          providerLabel: socialContext.provider,
          extra: socialContext.extra || {
            picture: socialContext.picture,
            avatar: socialContext.picture,
            nomeReal: socialContext.displayName,
            fullName: socialContext.displayName,
          },
          linkedinExperiences: socialContext.linkedinExperiences || null,
        });
      } catch (err) {
        console.error("[choosePseudonym] Pseudônimo social falhou:", err);
        setError("Não foi possível salvar agora. Tente novamente.");
      } finally {
        setSubmitting(false);
      }
    },
    [pseudonym, socialContext, finalizeProfile]
  );

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Criar perfil" />

      <main className="w-full max-w-md px-4 sm:px-6 mt-6 mb-12">
        {isAfterReview && (
          <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-700 p-4 text-sm">
            <strong className="block text-base mb-1">✅ Sua avaliação foi enviada!</strong>
            Crie seu perfil anônimo abaixo para mantê-la vinculada a você.
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 text-center">
            {socialAwaitingPseudonym ? "Escolha seu pseudônimo" : "Crie seu perfil"}
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            {socialAwaitingPseudonym
              ? "Esse é o nome público das suas avaliações. Você nunca aparece pelo seu nome real."
              : "Continuar leva menos de 30 segundos."}
          </p>

          {/* ───────────── View 1: login social + manual ───────────── */}
          {!socialAwaitingPseudonym && (
            <>
              {/* Botões sociais */}
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60"
                  aria-label="Continuar com o Google"
                >
                  <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.2 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.5 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.5 29.1 4.5 24 4.5 16.3 4.5 9.6 8.7 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5.1l-6-4.9C29 35.5 26.6 36 24 36c-5.2 0-9.6-3.4-11.2-8l-6.5 5C9.6 39.3 16.3 43.5 24 43.5z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6 4.9c-.4.4 6.5-4.7 6.5-14.4 0-1.2-.1-2.4-.2-3.5z"/>
                  </svg>
                  Continuar com o Google
                </button>

                <div>
                  <LoginLinkedInButton
                    clientId={process.env.REACT_APP_LINKEDIN_CLIENT_ID}
                    redirectUri={process.env.REACT_APP_LINKEDIN_REDIRECT_URI}
                    onLoginSuccess={handleLinkedInSuccess}
                    onLoginFailure={handleLinkedInFailure}
                    disabled={submitting}
                  />
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-snug">
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Selo de Perfil Verificado
                    </span>{" "}
                    de forma <strong>100% anônima</strong>. Usamos o LinkedIn só para
                    confirmar que você é uma pessoa real — seu nome continua oculto
                    nas avaliações.
                  </p>
                </div>
              </div>

              {/* Divisor */}
              <div className="my-6 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span>ou criar perfil com e-mail e senha</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Form manual: pseudonimo + email + senha */}
              <form onSubmit={handleManualSubmit} className="space-y-4" noValidate>
                <label className="block">
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Pseudônimo</span>
                  <input
                    type="text"
                    autoComplete="off"
                    value={pseudonym}
                    onChange={(e) => setPseudonym(e.target.value)}
                    placeholder="Como você quer ser identificado"
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">E-mail</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                <label className="block">
                  <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Senha</span>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full h-11 pl-3 pr-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 px-3 text-xs font-bold text-blue-700 dark:text-blue-300"
                      tabIndex={-1}
                    >
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </label>

                {error && (
                  <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {error}
                  </p>
                )}
                {info && (
                  <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {info}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-base transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Criando..." : "Criar perfil"}
                </button>
              </form>

              <p className="mt-4 text-xs text-center text-slate-500 dark:text-slate-400">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-bold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  Entrar
                </button>
              </p>
            </>
          )}

          {/* ───────────── View 2: pseudônimo após login social ───────────── */}
          {socialAwaitingPseudonym && (
            <form onSubmit={handleSocialPseudonymConfirm} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Pseudônimo</span>
                <input
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={pseudonym}
                  onChange={(e) => setPseudonym(e.target.value)}
                  placeholder="Como você quer ser identificado"
                  className="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              {socialContext?.provider === "linkedin" && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Selo de Perfil Verificado ativado pelo LinkedIn.
                </p>
              )}

              {error && (
                <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-base transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Salvando..." : "Concluir cadastro"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSocialAwaitingPseudonym(false);
                  setSocialContext(null);
                  setPseudonym("");
                  setError("");
                }}
                className="block w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                Voltar
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
