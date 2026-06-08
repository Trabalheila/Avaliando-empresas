// src/components/RequireAuth.jsx
//
// Guard de rotas que exigem usuario autenticado no Firebase Auth.
//
// IMPORTANTE: este componente verifica APENAS autenticacao. NAO consulta
// `users/{uid}` no Firestore, nem tenta inferir "existencia de perfil".
//
// Por que? As rules de `users/{userId}` exigem `auth.uid == userId`. Perfis
// salvos com id alternativo (`email:foo@bar`) ou consultados por email
// (`where("email","==",...)`) retornam permission-denied silencioso. Quando
// o RequireAuth tentava inferir "no-profile" a partir disso, usuarios
// validamente logados eram redirecionados para `/pseudonym` toda vez que
// clicavam em "Minha conta" — comportamento intermitente porque dependia
// do `localStorage` (que mobile/PWA limpa sob pressao de memoria mantendo
// o IndexedDB do Auth intacto). Ver memoria do repo: profile-sync.md.
//
// A unica fonte de verdade confiavel cross-device e o `onAuthStateChanged`.
// Cada pagina decide como apresentar perfil ausente (ex.: MinhaConta
// sintetiza profile a partir de `auth.currentUser`).
//
// Estados:
//   - "checking": esperando `onAuthStateChanged` resolver pela 1ª vez.
//   - "anonymous": sem usuario OU usuario anonimo → /login (preservando
//     `from` para retorno pos-login).
//   - "ready": autenticado → renderiza children.

import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";

export default function RequireAuth({ children }) {
  const location = useLocation();
  // `status` inicia OBRIGATORIAMENTE como "checking". Enquanto estiver
  // nesse estado nao redirecionamos para /login, pois o Firebase Auth
  // ainda pode estar restaurando a sessao persistida no IndexedDB
  // (especialmente em mobile / WebView, onde a hidratacao demora alguns
  // ciclos a mais que o primeiro render do React).
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;
      const isAnonymous = !!user?.isAnonymous;
      if (!user || isAnonymous) {
        setStatus("anonymous");
      } else {
        setStatus("ready");
      }
    });

    return () => {
      cancelled = true;
      try { unsub(); } catch { /* ignore */ }
    };
  }, []);

  if (status === "checking") {
    // Spinner sutil enquanto onAuthStateChanged nao resolveu (Firebase ainda
    // restaurando a sessao do IndexedDB). Evita renderizar a tela "Crie um
    // perfil" antes da resposta definitiva do Auth.
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-blue-50 dark:bg-slate-900">
        <div
          aria-hidden="true"
          className="h-10 w-10 rounded-full border-2 border-blue-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-400 animate-spin"
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">Verificando sessão…</p>
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
