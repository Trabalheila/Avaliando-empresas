import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { listReviewsByCompanySlug, reactToReview } from "../services/reviews";

function avgFromReviews(reviews) {
  const vals = (reviews || [])
    .map((r) => r?.ratings?.geral)
    .filter((n) => typeof n === "number" && isFinite(n));

  if (!vals.length) return null;

  const a = vals.reduce((x, y) => x + y, 0) / vals.length;
  return Math.round(a * 10) / 10;
}

function scoreColor(score) {
  if (score == null) return "text-slate-500";
  if (score >= 4.3) return "text-emerald-600";
  if (score >= 3.6) return "text-lime-600";
  if (score >= 2.8) return "text-yellow-600";
  if (score >= 2.0) return "text-orange-600";
  return "text-rose-600";
}

function companyFromSlugAndReviews(slug, reviews) {
  const r0 = (reviews || [])[0];

  const name =
    r0?.companyName ??
    r0?.company?.name ??
    r0?.empresaNome ??
    slug ??
    "Empresa";

  const logoUrl =
    r0?.companyLogoUrl ??
    r0?.company?.logoUrl ??
    r0?.empresaLogoUrl ??
    null;

  const google = r0?.company?.google ?? null;

  return { name, slug, logoUrl, google };
}

const REACTION_OPTIONS = [
  { key: "like", emoji: "👍" },
  { key: "dislike", emoji: "👎" },
  { key: "heart", emoji: "❤️" },
  { key: "wow", emoji: "😮" },
  { key: "angry", emoji: "😡" },
];

const HOLD_TO_REACT_MS = 450;

function getReviewScore(review) {
  const score = review?.ratings?.geral;
  return Number.isFinite(score) ? score : -1;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CompanyPage() {
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [uid, setUid] = useState(null);
  const [openReactionMenuFor, setOpenReactionMenuFor] = useState(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const holdTimerRef = useRef(null);

  // garante um uid (anônimo) para reagir
  useEffect(() => {
    let alive = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!alive) return;

        if (user) {
          setUid(user.uid);
          return;
        }

        // requer Anonymous Auth habilitado no Firebase Console
        const res = await signInAnonymously(auth);
        if (!alive) return;
        setUid(res.user.uid);
      } catch (err) {
        // não vamos travar a página por causa do auth anônimo
        console.error(err);
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  // carrega reviews + monta company
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErrorMsg("");
        setLoading(true);

        const r = await listReviewsByCompanySlug(slug, 80);
        if (!alive) return;

        setReviews(r || []);
        setCompany(companyFromSlugAndReviews(slug, r || []));
        setLoading(false);
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setErrorMsg("Não foi possível carregar os dados dessa empresa.");
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  const avg = useMemo(() => avgFromReviews(reviews), [reviews]);
  const orderedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      const scoreDiff = getReviewScore(b) - getReviewScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return toMillis(b?.createdAt) - toMillis(a?.createdAt);
    });
  }, [reviews]);

  function clearHoldTimer() {
    if (!holdTimerRef.current) return;
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }

  function startHoldToReact(reviewId) {
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      setOpenReactionMenuFor(reviewId);
      holdTimerRef.current = null;
    }, HOLD_TO_REACT_MS);
  }

  async function handleReact(reviewId, reaction) {
    try {
      if (!uid) return;

      await reactToReview({ reviewId, uid, reaction });

      // recarrega (simples e eficaz no MVP)
      const r = await listReviewsByCompanySlug(slug, 80);
      setReviews(r || []);
      setCompany(companyFromSlugAndReviews(slug, r || []));
      setOpenReactionMenuFor(null);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-700 font-bold">Carregando…</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <Link to="/" className="font-extrabold text-indigo-700 underline">
            ← Voltar
          </Link>

          <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-6 text-slate-700">
            <div className="font-black mb-2">Ops.</div>
            <div className="text-sm">{errorMsg}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="font-extrabold text-indigo-700 underline">
            ← Voltar
          </Link>
        </div>

        <div className="mt-6 bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <span className="font-black text-slate-600">
                  {(company?.name || slug || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900 truncate">
                {company?.name || slug}
              </h1>
              <div className={`text-sm font-extrabold ${scoreColor(avg)}`}>
                {avg == null ? "Sem nota ainda" : `Nota geral: ${avg}/5`}
              </div>
            </div>
          </div>

          {/* Dados do Google (placeholder) */}
          <div className="mt-5 text-sm text-slate-700">
            <div className="font-extrabold mb-1">Informações</div>
            {company?.google?.description ? (
              <p className="text-slate-600">{company.google.description}</p>
            ) : (
              <p className="text-slate-500">
                (Em breve) Dados do Google/negócio: descrição, site, setor, etc.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-black text-slate-900 mb-3">
            Comentários anônimos
          </h2>

          {orderedReviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-slate-600">
              Nenhum comentário ainda.
            </div>
          ) : (
            <div className="space-y-4">
              {orderedReviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {r.tenure
                          ? `Trabalhei: ${r.tenure}`
                          : "Tempo na empresa: não informado"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Nota pessoal: {r?.ratings?.geral ?? "—"}/5
                      </div>
                    </div>

                    <div className="text-xs font-bold text-slate-500">
                      {r.createdAt?.toDate
                        ? r.createdAt.toDate().toLocaleDateString("pt-BR")
                        : ""}
                    </div>
                  </div>

                  {r.commentGeral && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-slate-500">Algo que queira acrescentar?</p>
                      <p className="text-slate-700 text-sm whitespace-pre-wrap">
                        {r.commentGeral}
                      </p>
                    </div>
                  )}

                  <div className="mt-4">
                    <button
                      type="button"
                      onMouseDown={() => startHoldToReact(r.id)}
                      onMouseUp={clearHoldTimer}
                      onMouseLeave={clearHoldTimer}
                      onTouchStart={() => startHoldToReact(r.id)}
                      onTouchEnd={clearHoldTimer}
                      onTouchCancel={clearHoldTimer}
                      onClick={(e) => e.preventDefault()}
                      className="px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-sm"
                    >
                      🙂 Segure para reagir
                    </button>

                    {openReactionMenuFor === r.id && (
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        {REACTION_OPTIONS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleReact(r.id, item.key)}
                            className="px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50"
                          >
                            {item.emoji} {r.reactions?.[item.key] ?? 0}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
