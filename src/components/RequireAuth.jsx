// src/components/RequireAuth.jsx
//
// Guard de rotas para áreas que exigem usuário autenticado E com perfil
// criado no Firestore (coleção `users`).
//
// Equivalente em React Router à lógica:
//
//   router.beforeEach(async (to, from, next) => {
//     const user = auth.currentUser;
//     if (!to.meta.requiresAuth) return next();
//     if (!user) return next('/login');
//     const snap = await getDoc(doc(db, 'profiles', user.uid));
//     if (!snap.exists()) return next('/criar-perfil');
//     next();
//   });
//
// Estados:
//   - "checking": esperando `onAuthStateChanged` resolver pela 1ª vez.
//   - "anonymous": sem usuário OU usuário anônimo do Firebase Auth.
//                  → redireciona para /login (preservando `from` para
//                  retorno pós-login).
//   - "no-profile": usuário autenticado, mas não há doc em users/{uid}
//                   e tampouco pseudônimo persistido localmente.
//                   → redireciona para /pseudonym (criação de perfil).
//   - "ready": ok, renderiza children.

import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";

import { auth, db } from "../firebase";
import { findUnifiedProfile } from "../services/users";

function readStoredProfile() {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
  } catch {
    return {};
  }
}

function getStoredPseudonym() {
  const stored = readStoredProfile();
  return (
    stored.pseudonimo ||
    stored.pseudonym ||
    localStorage.getItem("userPseudonym") ||
    ""
  ).toString().trim();
}

function getStoredProfileId() {
  const stored = readStoredProfile();
  return (stored.profileId || stored.id || "").toString().trim();
}

export default function RequireAuth({ children }) {
  const location = useLocation();
  // `status` inicia OBRIGATORIAMENTE como "checking". Enquanto estiver
  // nesse estado nao redirecionamos para /login nem /pseudonym, pois o
  // Firebase Auth ainda pode estar restaurando a sessao persistida no
  // IndexedDB (especialmente em mobile / WebView, onde a hidratacao demora
  // alguns ciclos a mais que o primeiro render do React).
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      // Trata usuário anônimo como "sem usuário" para fins de gate.
      const isAnonymous = !!user?.isAnonymous;
      if (!user || isAnonymous) {
        if (!cancelled) setStatus("anonymous");
        return;
      }

      // Resolve profile usando a mesma cadeia de fallbacks de MinhaConta:
      //   1) users/{uid}
      //   2) users/{profileId} salvo no localStorage (ex.: "email:xxx")
      //   3) busca unificada por email (cobre contas cujo doc id e
      //      "email:foo@bar" criadas antes do uid existir)
      //   4) coleção `apoiadores` (especialistas legados onde uid e campo)
      //   5) tolerancia: pseudonimo persistido localmente
      // Enquanto qualquer um desses lookups esta em andamento, NUNCA muda
      // o status. So definimos "ready" ou "no-profile" apos a cadeia toda.
      try {
        // (1) lookup direto por uid
        const snap = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;
        if (snap.exists()) {
          setStatus("ready");
          return;
        }

        // (2) lookup por profileId persistido no localStorage
        const storedProfileId = getStoredProfileId();
        if (storedProfileId && storedProfileId !== user.uid) {
          try {
            const altSnap = await getDoc(doc(db, "users", storedProfileId));
            if (cancelled) return;
            if (altSnap.exists()) {
              setStatus("ready");
              return;
            }
          } catch { /* ignore — tenta proximo */ }
        }

        // (3) busca unificada por email do auth
        if (user.email) {
          try {
            const unified = await findUnifiedProfile({ email: user.email });
            if (cancelled) return;
            if (unified) {
              setStatus("ready");
              return;
            }
          } catch { /* ignore — tenta proximo */ }
        }

        // (4) apoiadores legados (campo uid)
        try {
          const apoSnap = await getDocs(
            query(collection(db, "apoiadores"), where("uid", "==", user.uid), limit(1))
          );
          if (cancelled) return;
          if (!apoSnap.empty) {
            setStatus("ready");
            return;
          }
        } catch { /* ignore — segue para tolerancia local */ }

        // (5) tolerancia: pseudonimo ja existe localmente (cadastro em
        // andamento que ainda nao propagou no Firestore). Deixa passar
        // para evitar loop na leitura eventualmente consistente.
        if (cancelled) return;
        setStatus(getStoredPseudonym() ? "ready" : "no-profile");
      } catch (err) {
        if (cancelled) return;
        console.warn("[RequireAuth] Falha ao consultar perfil:", err?.message || err);
        // Falha de leitura: prefere liberar (a página decide o fallback)
        // a deixar o usuário preso numa tela em branco.
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

  if (status === "no-profile") {
    return (
      <Navigate
        to="/pseudonym"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
