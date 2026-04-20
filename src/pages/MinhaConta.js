import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { getUserRole, isPremium, isAdmin } from "../utils/rbac";
import { resolveProfileId } from "../utils/profileIdentity";
import AppHeader from "../components/AppHeader";

/* ════════════════════════════════════════════════
   MinhaConta — Página privada "Minha conta"
   ════════════════════════════════════════════════ */

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const ms = toMillis(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPlanLabel(profile) {
  const role = getUserRole();
  const premium = isPremium();
  if (isAdmin()) return "Administrador";
  if (role === "admin_empresa") return "Premium Empresa (Fundador)";
  if (premium) return "Premium Trabalhador";
  return "Gratuito";
}

function getPlanColor(profile) {
  const role = getUserRole();
  const premium = isPremium();
  if (isAdmin()) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700";
  if (role === "admin_empresa") return "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700";
  if (premium) return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700";
  return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
}

export default function MinhaConta({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Carregar dados
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const profileId = stored?.profileId || resolveProfileId(stored, { persistGeneratedId: false });

        if (!profileId) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        // Buscar perfil do Firestore
        const userRef = doc(db, "users", profileId);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists()
          ? { id: userSnap.id, ...userSnap.data() }
          : { id: profileId, ...stored };

        if (!cancelled) setProfile(userData);

        // Buscar avaliações
        const reviewsRef = collection(db, "reviews");
        const q = query(reviewsRef, where("authorProfileId", "==", profileId), limit(200));
        const reviewSnap = await getDocs(q);
        const userReviews = reviewSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
        if (!cancelled) setReviews(userReviews);
      } catch (err) {
        console.warn("Erro ao carregar conta:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Resumo
  const summary = useMemo(() => {
    const totalCompanies = new Set(reviews.map((r) => r.companySlug).filter(Boolean)).size;
    const ratings = reviews.map((r) => Number(r.rating)).filter((v) => v >= 1 && v <= 5);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
    return { totalCompanies, avgRating, totalReviews: reviews.length };
  }, [reviews]);

  // Avatar
  const avatarDisplay = useMemo(() => {
    const av = profile?.avatar || profile?.picture || "";
    if (av && (av.startsWith("data:") || av.startsWith("http"))) {
      return <img src={av} alt="avatar" className="h-20 w-20 rounded-full object-cover border-2 border-blue-200 dark:border-slate-600" referrerPolicy="no-referrer" />;
    }
    if (av && av.length <= 4) {
      return <span className="text-5xl">{av}</span>;
    }
    return <span className="h-20 w-20 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-4xl">👤</span>;
  }, [profile]);

  const handleViewPublicProfile = useCallback(() => {
    const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const pid = stored?.profileId || resolveProfileId(stored, { persistGeneratedId: false });
    if (pid) navigate(`/perfil/${encodeURIComponent(pid)}`);
  }, [navigate]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500 dark:text-slate-400 text-lg animate-pulse">Carregando…</div>
        </div>
      </div>
    );
  }

  // Não logado
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="text-6xl">🔒</span>
          <p className="text-slate-600 dark:text-slate-300 text-lg font-semibold">Você precisa criar um perfil primeiro.</p>
          <button
            type="button"
            onClick={() => navigate("/pseudonym")}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Criar perfil
          </button>
        </div>
      </div>
    );
  }

  const pseudonym = profile.pseudonimo || profile.name || "Anônimo";
  const memberSince = formatDate(profile.createdAt || profile.updatedAt);
  const planLabel = getPlanLabel(profile);
  const planColor = getPlanColor(profile);
  const experiences = profile?.resumeData?.experiencesStructured || [];
  const credibility = profile?.credibilityIndex || "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Minha Conta" />

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ══════ Dados do Perfil ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {avatarDisplay}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-200 tracking-wide">
                {pseudonym}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Membro desde {memberSince}
              </p>
              {profile?.email && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {profile.email}
                </p>
              )}
              {credibility && credibility !== "—" && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Índice de credibilidade: <span className="font-semibold capitalize">{credibility === "confiavel" ? "Confiável" : credibility === "neutro" ? "Neutro" : credibility === "atencao" ? "Atenção" : credibility}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate("/pseudonym")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar perfil
              </button>
              <button
                type="button"
                onClick={handleViewPublicProfile}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Ver perfil público
              </button>
            </div>
          </div>
        </section>

        {/* ══════ Plano Atual ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Plano Atual
          </h2>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${planColor}`}>
            {planLabel}
          </div>
          {!isPremium() && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate("/escolha-perfil")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Fazer upgrade
              </button>
            </div>
          )}
        </section>

        {/* ══════ Experiências ══════ */}
        {experiences.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
            <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Experiências
            </h2>
            <div className="space-y-2">
              {experiences.map((exp, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{exp.company}</p>
                    {exp.role && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{exp.role}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    exp.verified || exp.source === "linkedin"
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600"
                  }`}>
                    {exp.verified || exp.source === "linkedin" ? "LinkedIn" : "Manual"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══════ Histórico de Avaliações ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Histórico de Avaliações
          </h2>

          {reviews.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">
              Você ainda não avaliou nenhuma empresa.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => navigate(`/empresa?slug=${review.companySlug}`)}
                  className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {review.company || review.companySlug}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${star <= Number(review.rating) ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ══════ Resumo ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Resumo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{summary.totalCompanies}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Empresas avaliadas</p>
            </div>
            <div className="rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{summary.avgRating}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Média das notas</p>
            </div>
            <div className="rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{summary.totalReviews}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Avaliações realizadas</p>
            </div>
          </div>
        </section>

        {/* ══════ Ações ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4">Ações</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/escolha-perfil")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
            >
              Ver planos e benefícios
            </button>
            <button
              type="button"
              onClick={() => navigate("/excluir-dados")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition border border-red-200 dark:border-red-800"
            >
              Excluir meus dados
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
