// src/pages/ProfissionalApoioPerfil.js
//
// Perfil público básico do "Profissional de Apoio" (userType:
// 'supportProfessional'). Exibe nome, especialidades e mini-bio,
// com link opcional. Esta versão é a base para o futuro matching
// com trabalhadores.

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import AppHeader from "../components/AppHeader";

export default function ProfissionalApoioPerfil({ theme, toggleTheme }) {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "supportProfessionals", id));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setProfile({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error("Erro ao carregar perfil de apoio:", e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <div className="max-w-3xl mx-auto px-4 py-10">
        {loading && (
          <div className="text-center text-slate-600 dark:text-slate-300">Carregando...</div>
        )}

        {!loading && notFound && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Perfil não encontrado
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Este perfil não existe ou foi removido.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block px-5 py-2.5 rounded-lg font-semibold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
            >
              Voltar para a página inicial
            </Link>
          </div>
        )}

        {!loading && profile && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-10">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                Profissional de Apoio
              </span>
              {profile.verified && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  ✓ Verificado
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
              {profile.fullName || "Profissional"}
            </h1>

            {Array.isArray(profile.specialties) && profile.specialties.length > 0 && (
              <div className="mt-4">
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Especialidades
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.specialties.map((s) => (
                    <span
                      key={s.value || s.label}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    >
                      {s.label || s.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.bio && (
              <div className="mt-6">
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Sobre
                </h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                  {profile.bio}
                </p>
              </div>
            )}

            {profile.profileLink && (
              <div className="mt-6">
                <a
                  href={profile.profileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  Perfil profissional externo →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
