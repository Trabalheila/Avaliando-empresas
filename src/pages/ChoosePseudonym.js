// src/pages/ChoosePseudonym.js
//
// Tela única de cadastro/coleta de pseudônimo.
//
// Dois fluxos coexistem aqui — porém SEM redundância de UI:
//
//   1) Fluxo MANUAL (e-mail/senha):
//      Acionado quando o usuário clica em "Sou Trabalhador" ou
//      "Sou Especialista" na Landing. A página exibe APENAS o formulário
//      manual (pseudônimo + e-mail + senha + botão "Criar perfil").
//      Não mostra botões sociais — eles ficaram na Landing.
//
//   2) Fluxo SOCIAL pós-OAuth (Google/LinkedIn):
//      Acionado quando o usuário acaba de logar pelo Google ou LinkedIn
//      na Landing e ainda não tem pseudônimo. A página exibe APENAS o
//      campo de pseudônimo (sem e-mail, sem senha, sem botões sociais).
//      Detectamos esse caso pelos query params (?provider=google|linkedin)
//      ou pelo `userProfile` em localStorage (loginProvider definido,
//      pseudonimo vazio).
//
// O tipo de perfil escolhido na Landing (Trabalhador/Especialista) fica
// em sessionStorage via `src/services/profileType.js`. Quando o cadastro
// é finalizado, esse valor é gravado em `profileTypeChosen` no Firestore
// e o sessionStorage é limpo.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import AppHeader from "../components/AppHeader";

import { auth, db } from "../firebase";
import {
  finalizeSocialLogin,
  signUpWithEmailPassword,
} from "../services/socialAuth";
import {
  getSelectedProfileType,
  clearSelectedProfileType,
} from "../services/profileType";

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

function readStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
  } catch {
    return {};
  }
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

  // View 2: pseudônimo após login social (Google/LinkedIn) feito na Landing.
  const [socialAwaitingPseudonym, setSocialAwaitingPseudonym] = useState(false);
  const [socialContext, setSocialContext] = useState(null);

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

  // ─── Detecta arrivo via login social (Google/LinkedIn) ───
  // Quando o Home.js conclui o OAuth e ainda não há pseudônimo, ele
  // navega para /pseudonym?provider=google|linkedin. Reconstruímos o
  // contexto social a partir do `userProfile` em localStorage.
  //
  // Contrato explícito: SÓ entramos na view social quando o caller
  // passa ?provider=google|linkedin. Para o fluxo manual a Landing
  // navega com ?manual=1 (ou sem query). Não usamos `loginProvider`
  // do localStorage como gatilho para evitar falsos positivos quando
  // existem resíduos de uma sessão social anterior.
  useEffect(() => {
    const params = new URLSearchParams(location?.search || "");
    const providerParam = (params.get("provider") || "").toString().toLowerCase();
    if (params.get("manual") === "1") return;
    if (providerParam !== "google" && providerParam !== "linkedin") return;

    const stored = readStoredProfile();
    const provider = providerParam;

    const storedPseudo = (
      stored.pseudonimo ||
      stored.pseudonym ||
      localStorage.getItem("userPseudonym") ||
      ""
    ).toString().trim();

    if (!storedPseudo) {
      const uid = stored.uid || stored.id || auth?.currentUser?.uid || "";
      if (uid) {
        setSocialContext({
          provider,
          uid,
          email: stored.email || "",
          displayName: stored.nomeReal || stored.fullName || "",
          picture: stored.picture || stored.avatar || "",
          extra: {
            picture: stored.picture || stored.avatar || "",
            avatar: stored.avatar || stored.picture || "",
            nomeReal: stored.nomeReal || "",
            fullName: stored.fullName || "",
            linkedInUrl: stored.linkedInUrl || "",
            linkedInId: stored.linkedInId || "",
            ...(provider === "linkedin"
              ? {
                  verifiedProfileBadge: true,
                  verifiedProfileBadgeSource: "linkedin",
                }
              : {}),
          },
          linkedinExperiences: Array.isArray(stored.linkedinExperiences)
            ? stored.linkedinExperiences
            : null,
        });
        setPseudonym((prev) =>
          prev || pseudonymFromName(stored.nomeReal || stored.fullName || "")
        );
        setEmail((prev) => prev || stored.email || "");
        setSocialAwaitingPseudonym(true);
      }
    }
  }, [location?.search]);

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
  // Inclui o tipo de perfil escolhido na Landing (Trabalhador/
  // Especialista) e limpa o storage temporário ao concluir.
  const finalizeProfile = useCallback(
    async ({ uid, chosenPseudonym, emailValue, providerLabel, extra = {}, linkedinExperiences = null }) => {
      const profileTypeChosen = getSelectedProfileType();
      const result = await finalizeSocialLogin({
        uid,
        pseudonym: chosenPseudonym,
        email: emailValue,
        providerLabel: providerLabel || "email",
        extra: {
          ...extra,
          profileTypeChosen,
        },
        linkedinExperiences,
      });
      clearSelectedProfileType();
      const drained = result?.pending;
      const destination = drained?.drained && drained?.company
        ? `/empresa?name=${encodeURIComponent(drained.company)}`
        : "/";
      navigate(destination);
    },
    [navigate]
  );

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
              : "Preencha os campos abaixo. Leva menos de 30 segundos."}
          </p>

          {/* ───────────── View 1: cadastro manual (3 campos) ─────────────
              IMPORTANTE: sem botões sociais aqui. O login social está
              apenas na Landing — esta página é exclusivamente para o
              cadastro manual por e-mail/senha. */}
          {!socialAwaitingPseudonym && (
            <form
              onSubmit={handleManualSubmit}
              className="mt-6 space-y-4"
              noValidate
            >
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

              <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400">
                Já tem conta?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="font-bold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  Entrar
                </button>
              </p>
            </form>
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
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
