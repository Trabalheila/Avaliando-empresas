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
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
// Usa o LoginLinkedInButton "robusto" (suporta callback {code,state} e tem
// onLoginFailure/disabled). O de src/components/ entrega só {profile} e quebra
// com o callback atual de /auth/auth/ que devolve apenas {code,state}.
import LoginLinkedInButton from "../components/LoginLinkedInButton";
import AppHeader from "../components/AppHeader";
import { findUnifiedProfile } from "../services/users"; // Importação necessária

const REDIRECT_AFTER_LOGIN_KEY = "trabalheiLa_redirectAfterLogin";
const COMPANY_CONFIRMED_FLAG_KEY = "trabalheiLa_companyConfirmedFlag";

// Mapa de provedores sociais suportados para account linking. Cada entrada
// expõe um rótulo amigável e uma factory que cria a instância do AuthProvider
// usada na reautenticação via popup. Provedores OAuth genéricos (ex.: Apple,
// Microsoft) usam OAuthProvider com o providerId correspondente.
const SOCIAL_PROVIDERS = {
  "google.com": { label: "Google", makeProvider: () => new GoogleAuthProvider() },
  "facebook.com": { label: "Facebook", makeProvider: () => new FacebookAuthProvider() },
  "twitter.com": { label: "Twitter", makeProvider: () => new TwitterAuthProvider() },
  "github.com": { label: "GitHub", makeProvider: () => new GithubAuthProvider() },
  "apple.com": { label: "Apple", makeProvider: () => new OAuthProvider("apple.com") },
  "microsoft.com": { label: "Microsoft", makeProvider: () => new OAuthProvider("microsoft.com") },
};

// Rotas padrão por tipo de perfil.
// REMOVIDO: "empresario"
const PROFILE_ROUTES = {
  apoiador: { label: "Sou Especialista", route: "/apoiador/my-contacts", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  trabalhador: { label: "Sou Trabalhador", route: "/minha-conta", color: "bg-lime-500 hover:bg-lime-600 text-emerald-950" },
};

// Detecta todos os perfis associados a um usuário.
// REMOVIDO: Detecção de "companies" (empresario)
async function detectProfilesByEmail(email, uid) {
  const normalized = (email || "").toString().trim().toLowerCase();
  const userUid = (uid || "").toString().trim();
  if (!normalized && !userUid) return [];
  const found = new Set();
  try {
    const tasks = [];
    if (normalized) {
      tasks.push(
        // REMOVIDO: getDocs para "companies"
        getDocs(query(collection(db, "users"), where("email", "==", normalized))).catch(() => ({ empty: true, forEach: () => {} })),
      );
    }
    if (userUid) {
      tasks.push(
        getDocs(query(collection(db, "apoiadores"), where("uid", "==", userUid), limit(1))).catch(() => ({ empty: true, forEach: () => {} })),
      );
    }
    const results = await Promise.all(tasks);
    let idx = 0;
    if (normalized) {
      // REMOVIDO: const compSnap = results[idx++];
      const usersSnap = results[idx++];
      // REMOVIDO: if (!compSnap.empty) found.add("empresario");
      usersSnap.forEach((d) => {
        const t = (d.data()?.userType || "").toString().toLowerCase();
        if (t === "apoiador") found.add("apoiador");
        else found.add("trabalhador");
      });
    }
    if (userUid) {
      const apoSnap = results[idx++];
      if (apoSnap && !apoSnap.empty) found.add("apoiador");
    }
  } catch (err) {
    console.warn("detectProfilesByEmail falhou:", err);
  }
  // Retorna apenas "apoiador" e "trabalhador"
  return ["apoiador", "trabalhador"].filter((t) => found.has(t));
}

export default function Login({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!auth) {
      setError("Firebase não está disponível. Verifique a configuração do Firebase.");
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || user.isAnonymous) return;

      let target = "";
      try {
        const fromSession = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
        if (fromSession && fromSession.startsWith("/")) target = fromSession;
      } catch {
        /* ignore */
      }
      const fromQuery = searchParams.get("redirectAfterLogin") || "";
      if (fromQuery.startsWith("/")) target = fromQuery;

      if (!target) return;
      navigate(target, { replace: true });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [profileChoice, setProfileChoice] = useState(null);
  const [linkState, setLinkState] = useState(null);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkMessage, setLinkMessage] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linking, setLinking] = useState(false);

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
  // CORRIGIDO: Não copia displayName para `name` ou `pseudonimo`
  // CORRIGIDO: Herda avatar apenas se for personalizado ou do perfil unificado
  function persistUserProfile(user, providerLabel) {
    try {
      const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const merged = {
        ...existing,
        id: user.uid || existing.id,
        uid: user.uid || existing.uid,
        // Não copia displayName para o campo público `name` ou `pseudonimo` — ele
        // pertence ao pseudônimo escolhido pelo usuário. O nome real
        // fica em `nomeReal`/`fullName` (privados).
        name: existing.name || "", // Mantém o pseudônimo existente ou vazio
        pseudonimo: existing.pseudonimo || "", // Mantém o pseudônimo existente ou vazio
        nomeReal: existing.nomeReal || user.displayName || "",
        fullName: existing.fullName || user.displayName || "",
        email: user.email || existing.email || "",
        // foto do provedor social nunca é copiada para `avatar` ou `picture` — preserva anonimato
        // Apenas herda avatar se for personalizado (Firebase Storage ou data URL)
        avatar: existing.avatar || "",
        picture: existing.picture || "",
        loginProvider: providerLabel,
        fallback: false,
      };
      localStorage.setItem("userProfile", JSON.stringify(merged));
      // Restaura userPseudonym se foi perdido mas existe no perfil
      try {
        const storedPseudo = (localStorage.getItem("userPseudonym") || "").trim();
        if (!storedPseudo) {
          const profilePseudo = (merged.pseudonimo || merged.name || "").trim();
          if (profilePseudo) localStorage.setItem("userPseudonym", profilePseudo);
        }
      } catch { /* ignore */ }
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
    } catch {
      /* ignore */
    }
  }

  // Enriquece o userProfile no localStorage com dados específicos do
  // perfil (apoiadorId, tipo, userType, role) buscando em users/{uid}
  // e apoiadores (where uid == user.uid). Falha silenciosa.
  // CORRIGIDO: Lógica de herança de avatar do perfil unificado
  async function enrichProfileFromFirestore(user) {
    if (!user?.uid) return;
    try {
      const patch = {};
      try {
        const usersSnap = await getDocs(
          query(collection(db, "users"), where("__name__", "==", user.uid))
        );
        usersSnap.forEach((d) => {
          const data = d.data() || {};
          if (data.userType) patch.userType = data.userType;
          if (data.role) patch.role = data.role;
          if (data.apoiadorId) patch.apoiadorId = data.apoiadorId;
          // Se o perfil no Firestore tem pseudônimo, use-o
          if (data.pseudonimo) patch.pseudonimo = data.pseudonimo;
          else if (data.name) patch.pseudonimo = data.name; // Fallback para 'name' se 'pseudonimo' não existir
          // Se o perfil no Firestore tem avatar personalizado, use-o
          const firestoreAvatar = data.avatar || data.picture || "";
          const isCustomPhoto = firestoreAvatar.startsWith("data:") || firestoreAvatar.includes("firebasestorage.googleapis.com");
          if (isCustomPhoto) {
            patch.avatar = firestoreAvatar;
            patch.picture = firestoreAvatar;
          }
        });
      } catch { /* ignore */ }
      try {
        const apSnap = await getDocs(
          query(collection(db, "apoiadores"), where("uid", "==", user.uid))
        );
        if (!apSnap.empty) {
          const d = apSnap.docs[0];
          const data = d.data() || {};
          patch.apoiadorId = d.id;
          if (data.tipo) patch.tipo = data.tipo;
          if (!patch.userType) patch.userType = "apoiador";
          if (!patch.role) patch.role = "supporter";
        }
      } catch { /* ignore */ }
      // Busca perfil existente por email para unificar contas (LinkedIn + Google)
      const userEmail = String(user?.email || "").trim().toLowerCase();
      if (userEmail) {
        try {
          const unifiedProfile = await findUnifiedProfile({ email: userEmail });
          if (unifiedProfile) {
            if (!patch.pseudonimo && unifiedProfile.pseudonimo) patch.pseudonimo = unifiedProfile.pseudonimo;
            if (!patch.pseudonimo && unifiedProfile.name) patch.pseudonimo = unifiedProfile.name;
            if (!patch.userType && unifiedProfile.userType) patch.userType = unifiedProfile.userType;
            if (!patch.role && unifiedProfile.role) patch.role = unifiedProfile.role;
            if (!patch.profileId && unifiedProfile.id) patch.profileId = unifiedProfile.id;
            // Herda avatar apenas se for upload personalizado (Firebase Storage ou data URL)
            const avatarSrc = unifiedProfile.avatar || unifiedProfile.picture || "";
            const isCustomPhoto = avatarSrc.startsWith("data:") || avatarSrc.includes("firebasestorage.googleapis.com");
            if (!patch.avatar && isCustomPhoto) { // Só aplica se patch.avatar ainda não foi definido
              patch.avatar = avatarSrc;
              patch.picture = unifiedProfile.picture || unifiedProfile.avatar || "";
            }
          }
        } catch { /* ignore */ }
      }
      if (Object.keys(patch).length === 0) return;
      const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const merged = { ...existing, ...patch };
      localStorage.setItem("userProfile", JSON.stringify(merged));
      if (patch.pseudonimo) {
        try {
          if (!(localStorage.getItem("userPseudonym") || "").trim()) {
            localStorage.setItem("userPseudonym", patch.pseudonimo);
          }
        } catch { /* ignore */ }
      }
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
    } catch { /* ignore */ }
  }

  // Salva o e-mail retornado pelo provedor social (Google/LinkedIn) no
  // documento do usuário no Firestore APENAS quando o campo ainda não existe.
  // Nunca sobrescreve um e-mail já preenchido. Necessário para o backend
  // (resolveEmail em api/send-contact-request.js) conseguir notificar por
  // e-mail — especialmente o documento do especialista/apoiador.
  async function backfillProviderEmail(user, providerLabel) {
    if (providerLabel !== "google" && providerLabel !== "linkedin") return;
    const uid = user?.uid;
    const providerEmail = String(user?.email || "").trim().toLowerCase();
    if (!uid || !providerEmail) return;
    try {
      // users/{uid}: grava o e-mail só se ainda não houver um salvo.
      const userRef = doc(db, "users", String(uid));
      const userSnap = await getDoc(userRef);
      const existingUserEmail = userSnap.exists()
        ? String(userSnap.data()?.email || "").trim()
        : "";
      if (!existingUserEmail) {
        await setDoc(
          userRef,
          { uid, email: providerEmail, loginProvider: providerLabel, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn("[login] backfill de e-mail em users falhou:", err?.message || err);
    }
    try {
      // apoiadores (se o usuário for especialista): garante o e-mail no doc
      // do especialista, que é o lido pelo resolveEmail do backend. Só grava
      // quando o campo estiver vazio.
      const apSnap = await getDocs(
        query(collection(db, "apoiadores"), where("uid", "==", uid), limit(1))
      );
      if (!apSnap.empty) {
        const apDoc = apSnap.docs[0];
        const data = apDoc.data() || {};
        const existingApEmail = String(data?.email || "").trim();
        if (!existingApEmail) {
          await setDoc(
            doc(db, "apoiadores", apDoc.id),
            { email: providerEmail, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      }
    } catch (err) {
      console.warn("[login] backfill de e-mail em apoiadores falhou:", err?.message || err);
    }
  }

  // Lógica de redirecionamento após login bem-sucedido.
  // CORRIGIDO: Prioriza "trabalhador" e "apoiador".
  // REMOVIDO: Redirecionamento para "empresario".
  async function finishLogin(user, providerLabel) {
    setError("");
    setSubmitting(true);
    try {
      persistUserProfile(user, providerLabel);
      await enrichProfileFromFirestore(user);
      await backfillProviderEmail(user, providerLabel);

      const profiles = await detectProfilesByEmail(user?.email, user?.uid);

      // Lógica de priorização de redirecionamento
      if (profiles.includes("trabalhador")) {
        navigate(PROFILE_ROUTES["trabalhador"].route, { replace: true });
        return;
      }
      if (profiles.includes("apoiador")) {
        navigate(PROFILE_ROUTES["apoiador"].route, { replace: true });
        return;
      }

      // Se não encontrou nenhum perfil, vai para a criação de pseudônimo
      if (profiles.length === 0) {
        navigate("/pseudonym", { replace: true });
        return;
      }

      // Se encontrou perfis, mas nenhum dos prioritários, e o usuário tem mais de um perfil
      // (trabalhador E apoiador), mostra o modal.
      // Se tiver apenas um perfil (trabalhador OU apoiador), já teria redirecionado acima.
      if (profiles.length > 1) {
        setProfileChoice({ profiles: profiles.filter(p => p !== "empresario") }); // Filtra empresario
        return;
      }

      // Fallback: se chegou aqui, algo deu errado ou o perfil não se encaixa
      // em nenhuma das prioridades, mas não há modal para mostrar.
      // Redireciona para a rota padrão de trabalhador como fallback.
      navigate(PROFILE_ROUTES["trabalhador"].route, { replace: true });

    } catch (err) {
      console.error("[login] finishLogin falhou:", err);
      setError(err?.message || "Erro desconhecido ao finalizar login.");
    } finally {
      setSubmitting(false);
    }
  }

  // Função para lidar com a escolha de perfil no modal
  function pickProfile(type) {
    const cfg = PROFILE_ROUTES[type];
    if (cfg) {
      setProfileChoice(null);
      clearRedirect();
      navigate(cfg.route, { replace: true });
    }
  }

  // Lógica de login por e-mail/senha
  async function handleEmailLogin(e) {
    e.preventDefault();
    setError("");
    setResetMessage("");
    setSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await finishLogin(userCredential.user, "email");
    } catch (err) {
      console.error("[login] Email login falhou:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("E-mail ou senha inválidos.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Muitas tentativas de login. Tente novamente mais tarde.");
      } else {
        setError(err?.message || "Erro desconhecido ao fazer login.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Lógica de login com Google
  async function handleGoogleLogin() {
    setError("");
    setResetMessage("");
    setSubmitting(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      await finishLogin(userCredential.user, "google");
    } catch (err) {
      console.error("[login] Google login falhou:", err);
      if (err.code === "auth/account-exists-with-different-credential") {
        const email = err.customData.email;
        const pendingCredential = err.credential;
        const methods = await fetchSignInMethodsForEmail(auth, email);
        const socialProviderId = methods.find((m) => m !== "password");
        const socialLabel = socialProviderId ? SOCIAL_PROVIDERS[socialProviderId]?.label : null;
        setLinkState({ email, pendingCredential, methods, usesPassword: methods.includes("password"), socialProviderId, socialLabel });
      } else {
        setError(err?.message || "Erro desconhecido ao fazer login com Google.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Lógica de login com LinkedIn
  async function handleLinkedInSuccess(profile) {
    setError("");
    setResetMessage("");
    setSubmitting(true);
    try {
      // O LoginLinkedInButton já faz o login via API do backend,
      // então o `profile` já vem com o user do Firebase.
      await finishLogin(profile.user, "linkedin");
    } catch (err) {
      console.error("[login] LinkedIn login falhou:", err);
      setError(err?.message || "Erro desconhecido ao fazer login com LinkedIn.");
    } finally {
      setSubmitting(false);
    }
  }

  // Lógica de recuperação de senha
  async function handleResetPassword() {
    setError("");
    setResetMessage("");
    if (!email) {
      setError("Por favor, digite seu e-mail para recuperar a senha.");
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage("Um e-mail para redefinir sua senha foi enviado.");
    } catch (err) {
      console.error("[login] Reset password falhou:", err);
      setError(err?.message || "Erro ao enviar e-mail de recuperação de senha.");
    } finally {
      setSubmitting(false);
    }
  }

  // Lógica de vinculação de contas (account linking)
  async function handleConfirmAccountLink(e) {
    e.preventDefault();
    setLinkError("");
    setLinkMessage("");
    setLinking(true);
    try {
      const credential = EmailAuthProvider.credential(linkState.email, linkPassword);
      const userCredential = await linkWithCredential(auth.currentUser, credential);
      setLinkMessage("Contas vinculadas com sucesso!");
      setLinkState(null);
      await finishLogin(userCredential.user, "email"); // Refaz o login para atualizar o estado
    } catch (err) {
      console.error("[login] Account linking (password) falhou:", err);
      setLinkError(err?.message || "Erro ao vincular contas.");
    } finally {
      setLinking(false);
    }
  }

  async function handleConfirmSocialLink() {
    setLinkError("");
    setLinkMessage("");
    setLinking(true);
    try {
      const provider = SOCIAL_PROVIDERS[linkState.socialProviderId].makeProvider();
      const userCredential = await signInWithPopup(auth.currentUser, provider);
      await linkWithCredential(auth.currentUser, userCredential.credential);
      setLinkMessage("Contas vinculadas com sucesso!");
      setLinkState(null);
      await finishLogin(userCredential.user, linkState.socialProviderId.split(".")[0]); // Refaz o login
    } catch (err) {
      console.error("[login] Account linking (social) falhou:", err);
      setLinkError(err?.message || "Erro ao vincular contas.");
    } finally {
      setLinking(false);
    }
  }

  function cancelAccountLink() {
    setLinkState(null);
    setLinkPassword("");
    setLinkError("");
    setLinkMessage("");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900"> {/* Removido flex items-center justify-center e text-center */}
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <div className="flex items-center justify-center px-6 py-10"> {/* Novo container para centralizar o formulário */}
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
                onLoginFailure={(err) =>
                  setError(`Falha ao conectar com LinkedIn: ${err?.message || String(err)}`)
                }
                disabled={submitting}
              />
            </div>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Não tem conta?{" "}
              <Link to="/cadastro" className="font-bold text-blue-700 dark:text-blue-300 hover:underline">
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </div>

        {profileChoice && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-choice-title"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:px-4"
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
              <h2
                id="profile-choice-title"
                className="text-xl font-extrabold text-slate-800 dark:text-slate-100 text-center"
              >
                Com qual perfil deseja entrar?
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 text-center">
                Encontramos mais de um perfil vinculado a este e-mail. Escolha por
                qual deles você quer acessar agora.
              </p>

              <div className="mt-5 flex flex-col gap-2">
                {profileChoice.profiles.map((type) => {
                  const cfg = PROFILE_ROUTES[type];
                  if (!cfg) return null;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => pickProfile(type)}
                      className={`w-full py-2.5 px-4 rounded-lg font-bold shadow transition ${cfg.color}`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Acesso a perfis ainda não cadastrados para este e-mail */}
              {profileChoice.profiles.length < 3 && (
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">
                    Quer criar outro perfil com este e-mail?
                  </p>
                  <div className="flex flex-col gap-2">
                    {["empresario", "apoiador", "trabalhador"]
                      .filter((t) => !profileChoice.profiles.includes(t))
                      .map((type) => {
                        const cfg = PROFILE_ROUTES[type];
                        const cadastroRoute = {
                          empresario: "/empresa/cadastro",
                          apoiador: "/apoiadores/cadastro",
                          trabalhador: "/pseudonym",
                        }[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setProfileChoice(null);
                              clearRedirect();
                              navigate(cadastroRoute);
                            }}
                            className="w-full py-2 px-4 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                          >
                            Cadastrar como {cfg.label.replace(/^Sou /, "")}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setProfileChoice(null)}
                className="mt-5 w-full text-xs text-slate-500 dark:text-slate-400 hover:underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {linkState && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-link-title"
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:px-4"
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
              <h2
                id="account-link-title"
                className="text-xl font-extrabold text-slate-800 dark:text-slate-100 text-center"
              >
                Vincular contas
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 text-center">
                Já existe uma conta com o e-mail{" "}
                <strong className="break-all">{linkState.email}</strong>
                {linkState.usesPassword
                  ? ". Deseja vincular seu login do Google a ela?"
                  : linkState.socialLabel
                  ? `, criada com ${linkState.socialLabel}. Deseja vincular seu login do Google a ela?`
                  : ". Deseja vincular seu login do Google a ela?"}
              </p>

              {linkState.usesPassword ? (
                <>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                    Por favor, faça login com sua senha original para confirmar a vinculação.
                  </p>
                  <form onSubmit={handleConfirmAccountLink} className="mt-5 flex flex-col gap-3">
                    <input
                      type="email"
                      value={linkState.email}
                      readOnly
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 p-3 text-sm text-slate-600 dark:text-slate-300"
                    />
                    <input
                      type="password"
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {linkMessage && (
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {linkMessage}
                      </p>
                    )}
                    {linkError && (
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {linkError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={linking}
                      className="w-full py-2.5 px-4 rounded-lg font-bold shadow bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition"
                    >
                      {linking ? "Vinculando…" : "Vincular contas"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelAccountLink}
                      disabled={linking}
                      className="w-full text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </form>
                </>
              ) : linkState.socialProviderId ? (
                <div className="mt-5 flex flex-col gap-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Por favor, faça login com sua conta {linkState.socialLabel} para
                    confirmar a vinculação.
                  </p>

                  {linkMessage && (
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {linkMessage}
                    </p>
                  )}
                  {linkError && (
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {linkError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleConfirmSocialLink}
                    disabled={linking}
                    className="w-full py-2.5 px-4 rounded-lg font-bold shadow bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition"
                  >
                    {linking
                      ? "Vinculando…"
                      : `Entrar com ${linkState.socialLabel} e vincular`}
                  </button>
                  <button
                    type="button"
                    onClick={cancelAccountLink}
                    disabled={linking}
                    className="w-full text-xs text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="mt-5 flex flex-col gap-3">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400 text-center">
                    Não foi possível identificar o provedor original desta conta.
                    Tente fazer login pelo método usado no cadastro.
                  </p>
                  <button
                    type="button"
                    onClick={cancelAccountLink}
                    className="w-full text-xs text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}