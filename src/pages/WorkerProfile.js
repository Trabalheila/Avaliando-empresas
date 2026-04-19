import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { slugifyCompany } from "../services/reviews";
import AppHeader from "../components/AppHeader";

/* ════════════════════════════════════════════════
   WorkerProfile — Página pública de perfil do trabalhador
   ════════════════════════════════════════════════ */

// ─── Helpers ───

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
    month: "short",
    year: "numeric",
  });
}

// ─── Cálculo do Índice de Credibilidade ───

function computeCredibilityIndex(reviews, experiences) {
  // (1) Diversidade de notas
  const ratings = (reviews || []).map((r) => Number(r.rating)).filter((v) => v >= 1 && v <= 5);
  const uniqueRatings = new Set(ratings);
  const allSameRating = ratings.length > 1 && uniqueRatings.size === 1;
  const allRatingOne = allSameRating && uniqueRatings.has(1);
  let diversityScore = 0;
  if (ratings.length === 0) {
    diversityScore = 0;
  } else if (allRatingOne) {
    diversityScore = -2; // Penalização forte
  } else if (allSameRating) {
    diversityScore = -1; // Penalização leve
  } else if (uniqueRatings.size >= 3) {
    diversityScore = 2;
  } else {
    diversityScore = 1;
  }

  // (2) Experiências verificadas via LinkedIn
  const verifiedCount = (experiences || []).filter(
    (e) => e?.verified === true || e?.source === "linkedin"
  ).length;
  const verificationScore = verifiedCount >= 2 ? 2 : verifiedCount === 1 ? 1 : 0;

  // (3) Comentários com mais de 100 caracteres
  const longComments = (reviews || []).filter((r) => {
    const comment = r.generalComment || r.commentRating || "";
    return typeof comment === "string" && comment.trim().length > 100;
  }).length;
  const commentScore = longComments >= 2 ? 2 : longComments === 1 ? 1 : 0;

  // (4) Número de empresas avaliadas (mínimo 2 para Confiável)
  const companiesEvaluated = new Set((reviews || []).map((r) => r.companySlug).filter(Boolean)).size;
  const companiesScore = companiesEvaluated >= 3 ? 2 : companiesEvaluated >= 2 ? 1 : 0;

  const total = diversityScore + verificationScore + commentScore + companiesScore;

  // Resultado final
  if (total >= 4 && companiesEvaluated >= 2) return "confiavel";
  if (total >= 2) return "neutro";
  return "atencao";
}

const CREDIBILITY_CONFIG = {
  confiavel: {
    label: "Confiável",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  neutro: {
    label: "Neutro",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
      </svg>
    ),
  },
  atencao: {
    label: "Atenção",
    color: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

// ─── Componente principal ───

export default function WorkerProfile({ theme, toggleTheme }) {
  const { profileId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [citations, setCitations] = useState([]);
  const [credibility, setCredibility] = useState("atencao");
  const [copied, setCopied] = useState(false);

  // ─── Buscar perfil e avaliações ───
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // 1. Buscar perfil do usuário
        const userRef = doc(db, "users", profileId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }
        const userData = { id: userSnap.id, ...userSnap.data() };
        if (!cancelled) setProfile(userData);

        // 2. Buscar avaliações pelo authorProfileId
        const reviewsRef = collection(db, "reviews");
        const q = query(reviewsRef, where("authorProfileId", "==", profileId), limit(200));
        const reviewSnap = await getDocs(q);
        const userReviews = reviewSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
        if (!cancelled) setReviews(userReviews);

        // 3. Buscar citações — avaliações de outros que mencionam o pseudônimo deste usuário
        const pseudonym = userData.pseudonimo || userData.name || "";
        if (pseudonym) {
          const citRef = collection(db, "comments");
          const cq = query(citRef, where("mentionedPseudonym", "==", pseudonym), limit(50));
          const citSnap = await getDocs(cq);
          const citData = citSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((c) => (c.authorProfileId || c.author) !== profileId);
          if (!cancelled) setCitations(citData);
        }

        // 4. Calcular credibilidade
        const experiences = userData?.resumeData?.experiencesStructured || [];
        const index = computeCredibilityIndex(userReviews, experiences);
        if (!cancelled) setCredibility(index);

        // 5. Salvar credibilityIndex no Firestore
        try {
          await setDoc(userRef, { credibilityIndex: index }, { merge: true });
        } catch {
          // silencioso
        }
      } catch (err) {
        console.warn("Erro ao carregar perfil:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [profileId]);

  // ─── Resumo calculado ───
  const summary = useMemo(() => {
    const totalCompanies = new Set(reviews.map((r) => r.companySlug).filter(Boolean)).size;
    const ratings = reviews.map((r) => Number(r.rating)).filter((v) => v >= 1 && v <= 5);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
    // Tempo médio baseado no intervalo entre a primeira e última avaliação do usuário por empresa
    // Como não temos dados de permanência, usamos a contagem de avaliações como proxy
    return { totalCompanies, avgRating, totalReviews: reviews.length };
  }, [reviews]);

  // ─── Copiar link ───
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/perfil/${profileId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [profileId]);

  // ─── Avatar ───
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

  // ─── Credibilidade badge ───
  const cred = CREDIBILITY_CONFIG[credibility] || CREDIBILITY_CONFIG.atencao;

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500 dark:text-slate-400 text-lg animate-pulse">Carregando perfil…</div>
        </div>
      </div>
    );
  }

  // ─── Não encontrado ───
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="text-6xl">🔍</span>
          <p className="text-slate-600 dark:text-slate-300 text-lg font-semibold">Perfil não encontrado.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  const pseudonym = profile.pseudonimo || profile.name || "Anônimo";
  const memberSince = formatDate(profile.createdAt || profile.updatedAt);
  const experiences = profile?.resumeData?.experiencesStructured || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Perfil do Trabalhador" />

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ══════ Cabeçalho do Perfil ══════ */}
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

              {/* Badge de credibilidade */}
              <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full border text-sm font-semibold ${cred.bg} ${cred.color}`}>
                {cred.icon}
                <span>Índice de Credibilidade: {cred.label}</span>
              </div>
            </div>

            {/* Compartilhar */}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {copied ? "Link copiado!" : "Compartilhar perfil"}
            </button>
          </div>
        </section>

        {/* ══════ Empresas Avaliadas ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Empresas Avaliadas
          </h2>

          {reviews.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">
              Nenhuma empresa avaliada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const exp = experiences.find(
                  (e) => slugifyCompany(e?.company || "") === review.companySlug
                );
                const isVerified = exp?.verified === true || exp?.source === "linkedin";

                return (
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
                      {exp?.role && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{exp.role}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Estrelas */}
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
                      {/* Data */}
                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDate(review.createdAt)}
                      </span>
                      {/* Badge verificado */}
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isVerified
                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600"
                        }`}
                      >
                        {isVerified ? "Certificado" : "Não certificado"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ══════ Citações ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Citações
          </h2>

          {citations.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">
              Suas avaliações ainda não foram citadas — continue avaliando para construir sua reputação.
            </p>
          ) : (
            <div className="space-y-3">
              {citations.map((cit) => (
                <div
                  key={cit.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                >
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    "{cit.text || cit.content || cit.comment || "—"}"
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    — {cit.author || cit.pseudonym || "Anônimo"} · {formatDate(cit.createdAt)}
                    {cit.companySlug && (
                      <span> · sobre <strong>{cit.companySlug}</strong></span>
                    )}
                  </p>
                </div>
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

      </div>
    </div>
  );
}
