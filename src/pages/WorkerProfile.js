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
import { slugifyCompany, updateOwnReview } from "../services/reviews";
import AppHeader from "../components/AppHeader";
import AvailabilityToggleButton, {
  AvailabilityIndicator,
} from "../components/AvailabilityToggleButton";
import { isPremiumWorker } from "../utils/rbac";

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

// Rótulos dos critérios usados ao editar uma avaliação no perfil.
// As chaves espelham os campos top-level salvos em /reviews (ver Home.js).
const CRITERIA_LABELS = {
  rating: "Nota geral",
  salario: "Data do Pagamento",
  beneficios: "Benefícios",
  cultura: "Visão e valores da empresa",
  oportunidades: "Oportunidades",
  inovacao: "Inovação",
  lideranca: "Acessibilidade e respeito da liderança",
  diversidade: "Diversidade",
  ambiente: "Estímulo ao respeito",
  equilibrio: "Equilíbrio vida/trabalho",
  reconhecimento: "Reconhecimento",
  comunicacao: "Comunicação",
  etica: "Ética",
  desenvolvimento: "Desenvolvimento",
  saudeBemEstar: "Saúde e bem-estar",
  impactoSocial: "Impacto social",
  reputacao: "Reputação",
  estimacaoOrganizacao: "Estima/Organização",
  discriminacao: "Não discriminação",
  cargaHoraria: "Carga horária",
  crescimento: "Crescimento",
};

// ─── Componente principal ───

export default function WorkerProfile({ theme, toggleTheme }) {
  const { profileId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [editing, setEditing] = useState(null); // review sendo editada
  const [editDraft, setEditDraft] = useState({ comment: "", criteria: {} });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
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

  // ─── Edição de avaliação (próprio autor) ───
  const openEditReview = useCallback((review) => {
    // Snapshot dos critérios numéricos top-level (notas 1–5), exceto `rating`
    // que tratamos à parte como "Nota geral".
    const criteria = {};
    Object.entries(review || {}).forEach(([key, value]) => {
      if (key === "rating") return;
      if (typeof value !== "number") return;
      if (value < 0 || value > 5) return;
      if (!CRITERIA_LABELS[key]) return;
      criteria[key] = value;
    });
    setEditing(review);
    setEditDraft({
      rating: Number(review?.rating) || 0,
      comment: review?.comment || review?.generalComment || "",
      criteria,
    });
    setEditError("");
  }, []);

  const closeEditReview = useCallback(() => {
    setEditing(null);
    setEditDraft({ comment: "", criteria: {} });
    setEditError("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing?.id) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const updates = {
        ...editDraft.criteria,
        rating: Number(editDraft.rating) || 0,
        comment: (editDraft.comment || "").trim(),
      };
      await updateOwnReview({
        reviewId: editing.id,
        updates,
        currentProfileId: profileId,
        currentPseudonym: profile?.pseudonimo || profile?.name || "",
      });
      // Atualiza estado local sem recarregar a página
      setReviews((prev) =>
        prev.map((r) =>
          r.id === editing.id
            ? { ...r, ...updates, updatedAt: new Date() }
            : r
        )
      );
      closeEditReview();
    } catch (err) {
      console.error("[WorkerProfile] erro ao salvar edição:", err);
      setEditError(err?.message || "Não foi possível salvar a edição.");
    } finally {
      setSavingEdit(false);
    }
  }, [editing, editDraft, profileId, profile, closeEditReview]);
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

  // Nunca cair em `profile.name` aqui: esse campo pode ter sido um dia
  // populado com o nome real vindo do Google/LinkedIn. Em primeiro acesso
  // o pseudônimo é obrigatório e fica em `profile.pseudonimo`.
  const pseudonym = profile.pseudonimo || "Anônimo";
  const memberSince = formatDate(profile.createdAt || profile.updatedAt);
  const experiences = profile?.resumeData?.experiencesStructured || [];

  // ─── Identidade do visitante (para saber se é o dono do perfil) ───
  let viewerProfile = {};
  try {
    viewerProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
  } catch {
    viewerProfile = {};
  }
  const viewerUid =
    viewerProfile?.uid || viewerProfile?.id || viewerProfile?.profileId || "";
  const isOwner = Boolean(viewerUid) && String(viewerUid) === String(profileId);
  const isPremiumViewer = isPremiumWorker();
  const profileIsPremium =
    profile?.is_premium_worker === true ||
    String(profile?.role || "").toLowerCase() === "premium_worker" ||
    String(profile?.role || "").toLowerCase() === "trabalhador_premium" ||
    profile?.is_premium === true;
  const showAvailabilityIndicator =
    profileIsPremium && profile?.isAvailableForContact === true;

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

              {/* Badge de credibilidade + indicador de disponibilidade */}
              <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${cred.bg} ${cred.color}`}>
                  {cred.icon}
                  <span>Índice de Credibilidade: {cred.label}</span>
                </div>
                <AvailabilityIndicator visible={showAvailabilityIndicator} />
              </div>
            </div>

            {/* Compartilhar + Disponível para Contato (somente dono Premium) */}
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <AvailabilityToggleButton
                profileId={profileId}
                isOwner={isOwner}
                isPremium={isOwner && isPremiumViewer}
              />
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
                  <div
                    key={review.id}
                    className="relative w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const companyName = review.company || review.companyName || "";
                        console.log("[WorkerProfile] clicou card empresa:", {
                          reviewId: review.id,
                          companyName,
                          companySlug: review.companySlug,
                        });
                        if (!companyName) return;
                        navigate(`/empresa?name=${encodeURIComponent(companyName)}`);
                      }}
                      className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-3"
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
                    {isOwner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditReview(review);
                        }}
                        title="Editar avaliação"
                        aria-label="Editar avaliação"
                        className="absolute top-2 right-2 p-1.5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-900 transition"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110.414 16.5H8v-2.414a2 2 0 01.586-1.414z" />
                        </svg>
                      </button>
                    )}
                  </div>
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

      {/* Modal de edição da própria avaliação */}
      {editing && isOwner && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
          onClick={closeEditReview}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Editar avaliação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editing.company || editing.companySlug}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditReview}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Nota geral */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Nota geral
              </label>
              <div className="inline-flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, rating: star }))}
                    className={`text-2xl leading-none transition ${
                      star <= Number(editDraft.rating)
                        ? "text-amber-400"
                        : "text-slate-300 dark:text-slate-600 hover:text-amber-300"
                    }`}
                    aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Critérios */}
            {Object.keys(editDraft.criteria || {}).length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Notas por critério
                </p>
                {Object.entries(editDraft.criteria).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
                  >
                    <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">
                      {CRITERIA_LABELS[key] || key}
                    </span>
                    <div className="inline-flex items-center gap-0.5 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setEditDraft((d) => ({
                              ...d,
                              criteria: { ...d.criteria, [key]: star },
                            }))
                          }
                          className={`text-lg leading-none transition ${
                            star <= Number(value)
                              ? "text-amber-400"
                              : "text-slate-300 dark:text-slate-600 hover:text-amber-300"
                          }`}
                          aria-label={`${CRITERIA_LABELS[key] || key}: ${star} estrela${star > 1 ? "s" : ""}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comentário */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                Comentário
              </label>
              <textarea
                value={editDraft.comment}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, comment: e.target.value }))
                }
                rows={4}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Atualize seu comentário sobre a empresa..."
              />
            </div>

            {editError && (
              <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{editError}</p>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button
                type="button"
                onClick={closeEditReview}
                disabled={savingEdit}
                className="h-10 px-4 rounded-lg font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ backgroundColor: "#1a237e" }}
                className="h-10 px-5 rounded-lg font-bold text-white hover:brightness-110 transition disabled:opacity-60"
              >
                {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
