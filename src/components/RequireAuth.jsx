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

function getStoredPseudonym() {
  try {
    const stored = JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
    return (
      stored.pseudonimo ||
      stored.pseudonym ||
      localStorage.getItem("userPseudonym") ||
      ""
    ).toString().trim();
  } catch {
    return (localStorage.getItem("userPseudonym") || "").toString().trim();
  }
}

export default function RequireAuth({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    let firstResolved = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      // Trata usuário anônimo como "sem usuário" para fins de gate.
      const isAnonymous = !!user?.isAnonymous;
      if (!user || isAnonymous) {
        if (!cancelled) setStatus("anonymous");
        firstResolved = true;
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;

        if (snap.exists()) {
          setStatus("ready");
        } else if (getStoredPseudonym()) {
          // Tolerância: pseudônimo já existe localmente (cadastro em
          // andamento que ainda não propagou no Firestore). Deixa passar
          // para evitar loop no caso de leitura eventualmente consistente.
          setStatus("ready");
        } else {
          // Fallback: especialistas (advogados, psicólogos etc.) tem o
          // perfil persistido em `apoiadores` (campo `uid` = auth.uid).
          // Sem este lookup, o login de especialista cai em /pseudonym.
          try {
            const apoSnap = await getDocs(
              query(collection(db, "apoiadores"), where("uid", "==", user.uid), limit(1))
            );
            if (!cancelled) {
              setStatus(apoSnap.empty ? "no-profile" : "ready");
            }
          } catch {
            if (!cancelled) setStatus("no-profile");
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[RequireAuth] Falha ao consultar perfil:", err?.message || err);
        // Falha de leitura: prefere liberar (a página decide o fallback)
        // a deixar o usuário preso numa tela em branco.
        setStatus("ready");
      } finally {
        firstResolved = true;
      }
    });

    return () => {
      cancelled = true;
      try { unsub(); } catch { /* ignore */ }
      // Evita warning de "useless return" do linter caso firstResolved
      // não seja consumido no fluxo síncrono.
      void firstResolved;
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
