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
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";
// Usa o LoginLinkedInButton "robusto" (suporta callback {code,state} e tem
// onLoginFailure/disabled). O de src/components/ entrega só {profile} e quebra
// com o callback atual de /auth/auth/ que devolve apenas {code,state}.
import LoginLinkedInButton from "../LoginLinkedInButton";
import AppHeader from "../components/AppHeader";

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
const PROFILE_ROUTES = {
  empresario: { label: "Sou Empresário", route: "/empresa-dashboard", color: "bg-amber-500 hover:bg-amber-600 text-amber-950" },
  apoiador: { label: "Sou Especialista", route: "/apoiador/my-contacts", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  trabalhador: { label: "Sou Trabalhador", route: "/minha-conta", color: "bg-lime-500 hover:bg-lime-600 text-emerald-950" },
};

// Detecta todos os perfis associados a um usuário. Olha:
//   - `companies` por email     → empresario
//   - `users`     por email     → apoiador (se userType="apoiador") ou trabalhador
//   - `apoiadores` por uid      → apoiador (especialistas legados que NÃO têm
//                                  doc em /users — sem este lookup, o login
//                                  cai em /minha-conta em vez de
//                                  /apoiador/my-contacts).
// Retorna lista ordenada e sem duplicatas: empresário, apoiador, trabalhador.
async function detectProfilesByEmail(email, uid) {
  const normalized = (email || "").toString().trim().toLowerCase();
  const userUid = (uid || "").toString().trim();
  if (!normalized && !userUid) return [];
  const found = new Set();
  try {
    const tasks = [];
    if (normalized) {
      tasks.push(
        getDocs(query(collection(db, "companies"), where("email", "==", normalized))).catch(() => ({ empty: true, forEach: () => {} })),
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
      const compSnap = results[idx++];
      const usersSnap = results[idx++];
      if (!compSnap.empty) found.add("empresario");
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
  return ["empresario", "apoiador", "trabalhador"].filter((t) => found.has(t));
}

export default function Login({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Equivalente do route guard do Vue: se já está logado (e não é anônimo)
  // E o caller passou um `redirectAfterLogin` explicito (URL ou sessao),
  // pulamos a tela de login e vamos para esse destino.
  // Importante: usamos onAuthStateChanged porque `auth.currentUser` ainda é
  // null no primeiro render enquanto o Firebase Auth restaura a sessão do
  // IndexedDB. Sem isso o redirect nunca dispara quando o usuário chega
  // direto em /login estando logado (ex.: clicando "Voltar" de outra página).
  //
  // NUNCA auto-redirecionamos para um destino "padrao" so porque o usuario
  // esta logado. Fazer isso quebra o botao "Voltar" (que precisava de
  // multiplos cliques porque a cada montagem de /login o useEffect chamava
  // navigate(target, { replace: true }) e jogava o user de volta a frente).
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || user.isAnonymous) return;
      // Exceção específica: caio.cad@gmail.com vai sempre direto para `/`,
      // com prioridade sobre qualquer outro redirecionamento.
      if (String(user.email || "").toLowerCase() === "caio.cad@gmail.com") {
        navigate("/", { replace: true });
        return;
      }
      let target = "";
      try {
        const fromSession = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
        if (fromSession && fromSession.startsWith("/")) target = fromSession;
      } catch {
        /* ignore */
      }
      const fromQuery = searchParams.get("redirectAfterLogin") || "";
      if (fromQuery.startsWith("/")) target = fromQuery;
      // Sem redirecionamento explicito, deixa o usuario na propria /login
      // (ele pode estar abrindo de proposito para trocar de conta, ou
      // chegou aqui via Voltar e nao quer ser empurrado de volta).
      if (!target) return;
      navigate(target, { replace: true });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Quando o mesmo e-mail tem mais de um perfil cadastrado, abrimos um modal
  // para o usuário escolher. profileChoice = { profiles: ["empresario", ...] }
  const [profileChoice, setProfileChoice] = useState(null);
  // Vinculação de contas (account linking). Quando o login com Google falha
  // com `auth/account-exists-with-different-credential`, guardamos a credencial
  // pendente do Google + o e-mail em conflito para pedir a senha original e
  // então vincular (linkWithCredential).
  // linkState = { email, pendingCredential, methods: [...] }
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
  function persistUserProfile(user, providerLabel) {
    try {
      const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const merged = {
        ...existing,
        id: user.uid || existing.id,
        uid: user.uid || existing.uid,
        // Não copia displayName para o campo público `name` — ele
        // pertence ao pseudônimo escolhido pelo usuário. O nome real
        // fica em `nomeReal`/`fullName` (privados).
        name: existing.name || "",
        nomeReal: existing.nomeReal || user.displayName || "",
        fullName: existing.fullName || user.displayName || "",
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

  // Enriquece o userProfile no localStorage com dados específicos do
  // perfil (apoiadorId, tipo, userType, role) buscando em users/{uid}
  // e apoiadores (where uid == user.uid). Falha silenciosa.
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
      if (Object.keys(patch).length === 0) return;
      const existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const merged = { ...existing, ...patch };
      localStorage.setItem("userProfile", JSON.stringify(merged));
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
    } catch { /* ignore */ }
  }

  async function finishLogin(user, providerLabel) {
    persistUserProfile(user, providerLabel);
    await enrichProfileFromFirestore(user);

    // Exceção específica: o usuário caio.cad@gmail.com vai sempre direto para a
    // página principal (`/`), com prioridade sobre qualquer outro redirect
    // (redirectAfterLogin / location.state / perfil).
    const currentEmail = String(
      auth.currentUser?.email || user?.email || ""
    ).toLowerCase();
    if (currentEmail === "caio.cad@gmail.com") {
      clearRedirect();
      navigate("/", { replace: true });
      return;
    }

    const explicitRedirect = getRedirectTarget();
    if (explicitRedirect) {
      clearRedirect();
      navigate(explicitRedirect, { replace: true });
      return;
    }
    // Login com Google: vai sempre para a página principal (`/`), e não para
    // a página da conta. Um redirect explícito (acima) ainda tem prioridade,
    // para o caso de o usuário ter vindo de uma página protegida.
    if (providerLabel === "google") {
      clearRedirect();
      navigate("/", { replace: true });
      return;
    }
    // Sem redirect explícito: descobre quais perfis o e-mail tem.
    const profiles = await detectProfilesByEmail(user?.email, user?.uid);
    if (profiles.length >= 2) {
      // Conflito: pergunta com qual perfil deseja entrar.
      setProfileChoice({ profiles });
      setSubmitting(false);
      return;
    }
    const target = profiles[0]
      ? PROFILE_ROUTES[profiles[0]].route
      : "/minha-conta";
    clearRedirect();
    navigate(target, { replace: true });
  }

  function pickProfile(profileType) {
    const cfg = PROFILE_ROUTES[profileType];
    if (!cfg) return;
    setProfileChoice(null);
    clearRedirect();
    navigate(cfg.route, { replace: true });
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
      if (code.includes("auth/account-exists-with-different-credential")) {
        // Conflito: já existe uma conta com este e-mail criada por outro
        // provedor. Guardamos a credencial do Google e descobrimos quais
        // métodos de login já existem para orientar a vinculação.
        try {
          const pendingCredential = GoogleAuthProvider.credentialFromError(err);
          const conflictEmail =
            err?.customData?.email || err?.email || "";
          let methods = [];
          if (conflictEmail) {
            methods = await fetchSignInMethodsForEmail(auth, conflictEmail);
          }
          // Determina o provedor original: se houver e-mail/senha, pedimos a
          // senha; caso contrário, identificamos o provedor social existente
          // para reautenticar via popup.
          const usesPassword = methods.includes(EmailAuthProvider.PROVIDER_ID);
          const socialProviderId = methods.find(
            (m) => m !== EmailAuthProvider.PROVIDER_ID && SOCIAL_PROVIDERS[m]
          );
          const socialLabel = socialProviderId
            ? SOCIAL_PROVIDERS[socialProviderId].label
            : "";
          setEmail(conflictEmail);
          setLinkState({
            email: conflictEmail,
            pendingCredential,
            methods,
            usesPassword,
            socialProviderId: socialProviderId || "",
            socialLabel,
          });
          setLinkError("");
          if (usesPassword) {
            setLinkMessage(
              "Já existe uma conta com este e-mail. Deseja vincular seu login do Google a ela?"
            );
          } else if (socialProviderId) {
            setLinkMessage(
              `Já existe uma conta com este e-mail criada com ${socialLabel}. Deseja vincular seu login do Google a ela?`
            );
          } else {
            setLinkMessage(
              "Já existe uma conta com este e-mail. Deseja vincular seu login do Google a ela?"
            );
          }
        } catch (linkErr) {
          console.error("Falha ao preparar vinculação de contas:", linkErr);
          setError("Não foi possível vincular as contas. Tente novamente.");
        }
      } else if (code.includes("auth/popup-closed-by-user")) {
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

  // Confirma a identidade com o provedor original (e-mail/senha) e vincula a
  // credencial do Google à conta existente via linkWithCredential.
  async function handleConfirmAccountLink(e) {
    e?.preventDefault?.();
    if (!linkState?.pendingCredential) {
      setLinkError("Não foi possível vincular as contas. Tente novamente.");
      return;
    }
    const usesPassword = (linkState.methods || []).includes(
      EmailAuthProvider.PROVIDER_ID
    );
    if (usesPassword && !linkPassword) {
      setLinkError("Por favor, faça login com sua senha original para confirmar a vinculação.");
      return;
    }
    setLinking(true);
    setLinkError("");
    setLinkMessage("");
    try {
      // 1) Confirma a identidade com o provedor original (senha).
      const cred = await signInWithEmailAndPassword(
        auth,
        linkState.email,
        linkPassword
      );
      // 2) Vincula a credencial do Google à conta existente.
      await linkWithCredential(cred.user, linkState.pendingCredential);
      setLinkMessage("Contas vinculadas com sucesso!");
      setLinkPassword("");
      // 3) Finaliza o login normalmente.
      await finishLogin(cred.user, "google");
      setLinkState(null);
    } catch (err) {
      console.error("Erro ao vincular contas:", err);
      const code = String(err?.code || "");
      if (
        code.includes("auth/wrong-password") ||
        code.includes("auth/invalid-credential")
      ) {
        setLinkError("Senha incorreta. Tente novamente.");
      } else {
        setLinkError("Não foi possível vincular as contas. Tente novamente.");
      }
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

  // Reautentica com o provedor SOCIAL original (Facebook, Twitter, GitHub, …)
  // via popup e, em seguida, vincula a credencial do Google (pendingCredential)
  // à conta existente. Não usa senha — a identidade é confirmada pelo próprio
  // provedor social.
  async function handleConfirmSocialLink() {
    if (!linkState?.pendingCredential || !linkState?.socialProviderId) {
      setLinkError("Não foi possível vincular as contas. Tente novamente.");
      return;
    }
    const cfg = SOCIAL_PROVIDERS[linkState.socialProviderId];
    if (!cfg) {
      setLinkError("Provedor original não suportado para vinculação automática.");
      return;
    }
    setLinking(true);
    setLinkError("");
    setLinkMessage("");
    try {
      // 1) Confirma a identidade fazendo login com o provedor social original.
      const provider = cfg.makeProvider();
      const result = await signInWithPopup(auth, provider);
      if (!result?.user) throw new Error("Falha ao reautenticar com o provedor original.");
      // 2) Vincula a credencial do Google (pendente) à conta existente.
      await linkWithCredential(result.user, linkState.pendingCredential);
      setLinkMessage("Contas vinculadas com sucesso!");
      // 3) Finaliza o login normalmente.
      await finishLogin(result.user, "google");
      setLinkState(null);
    } catch (err) {
      console.error("Erro ao vincular contas (social):", err);
      const code = String(err?.code || "");
      if (code.includes("auth/popup-closed-by-user")) {
        setLinkError(`Login com ${cfg.label} cancelado. Tente novamente.`);
      } else if (code.includes("auth/popup-blocked")) {
        setLinkError("Popup bloqueado. Permita popups e tente novamente.");
      } else if (code.includes("auth/credential-already-in-use")) {
        setLinkError("Esta conta do Google já está vinculada a outro usuário.");
      } else {
        setLinkError("Não foi possível vincular as contas. Tente novamente.");
      }
    } finally {
      setLinking(false);
    }
  }

  // Callback do botão LinkedIn. O componente robusto entrega ou
  // { profile } (raro — só quando o callback do popup já enriqueceu o perfil)
  // ou { code, state } (caso atual: a página /auth/auth/ só repassa o code).
  // Aqui resolvemos o code chamando /api/linkedin-auth e seguimos o mesmo
  // fluxo de finalização dos demais providers.
  async function handleLinkedInSuccess({ profile, code } = {}) {
    setSubmitting(true);
    setError("");
    try {
      let data = profile;
      if (!data && code) {
        const redirectUri =
          process.env.REACT_APP_LINKEDIN_REDIRECT_URI ||
          `${window.location.origin}/auth/auth/`;
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

      // Usa o mesmo fluxo de finishLogin para tratar conflito de perfis.
      // Passa um "fake user" com email para a detecção funcionar.
      const fakeUser = {
        uid: data?.id || data?.sub || existing.uid || "",
        email: data?.email || existing.email || "",
        displayName: data?.name || existing.fullName || "",
        photoURL: data?.picture || data?.avatar || "",
      };
      await finishLogin(fakeUser, "linkedin");
    } catch (err) {
      console.error("Erro no login com LinkedIn:", err);
      setError(`Falha ao conectar com LinkedIn: ${err?.message || ""}`);
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
  );
}
