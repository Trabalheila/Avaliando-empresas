import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { isAdmin } from "../utils/rbac";
import { getUserProfile } from "../services/users";
import AppHeader from "../components/AppHeader";
import { VerificationTierBadge } from "../components/VerificationLevelBadge";

/* ────────────────────────────────────────────────
   AdminUserDetail
   Tela acessada via /admin/avaliador/:profileId
   Exibe perfil do avaliador + histórico de avaliações.
   ──────────────────────────────────────────────── */
function AdminUserDetail({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const { profileId } = useParams();
  const admin = useMemo(() => isAdmin(), []);

  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!admin || !profileId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        // 1) Perfil do avaliador (tenta pelo id direto na coleção users).
        const userProfile = await getUserProfile(profileId).catch(() => null);

        // 2) Avaliações de funcionário deste profileId.
        const empRefs = [
          query(collection(db, "reviews"), where("authorProfileId", "==", profileId), limit(500)),
          query(collection(db, "reviews"), where("profileId", "==", profileId), limit(500)),
        ];
        const selRefs = [
          query(collection(db, "selectionProcessReviews"), where("authorProfileId", "==", profileId), limit(500)),
          query(collection(db, "selectionProcessReviews"), where("profileId", "==", profileId), limit(500)),
        ];

        const snaps = await Promise.allSettled([
          ...empRefs.map((q) => getDocs(q)),
          ...selRefs.map((q) => getDocs(q)),
        ]);

        const dedupe = new Map();
        snaps.forEach((res, idx) => {
          if (res.status !== "fulfilled") return;
          const isSelection = idx >= empRefs.length;
          res.value.docs.forEach((d) => {
            if (dedupe.has(d.id)) return;
            dedupe.set(d.id, {
              id: d.id,
              ...d.data(),
              _collection: isSelection ? "selectionProcessReviews" : "reviews",
              _reviewType: isSelection ? "selectionProcess" : "employeeReview",
            });
          });
        });

        const list = [...dedupe.values()].sort((a, b) => {
          const at = a?.createdAt?.toMillis?.() ?? new Date(a?.timestamp || 0).getTime();
          const bt = b?.createdAt?.toMillis?.() ?? new Date(b?.timestamp || 0).getTime();
          return bt - at;
        });

        if (cancelled) return;
        setProfile(userProfile);
        setReviews(list);
      } catch (err) {
        console.error("[AdminUserDetail] Falha ao carregar perfil/avaliações:", err);
        if (!cancelled) setError("Não foi possível carregar este perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [admin, profileId]);

  const pseudonym = profile?.pseudonimo || profile?.pseudonym || reviews[0]?.pseudonym || "—";
  const emailVerified = Boolean(profile?.emailVerified);
  const linkedinVerified = Boolean(profile?.professionalVerified) || (profile?.loginProvider || "").toLowerCase() === "linkedin" || Boolean(profile?.linkedinProfile);
  const profileComplete = Boolean(profile?.profileComplete);
  const cpfVerified = Boolean(profile?.cpf && String(profile.cpf).replace(/\D/g, "").length >= 11);

  // Apenas mostra contato se o usuário marcou permissão para contato.
  const allowContact = Boolean(
    profile?.allowContact ?? profile?.contactAllowed ?? profile?.contactConsent
  );
  const contactEmail = allowContact ? (profile?.contactEmail || profile?.email || "") : "";
  const contactPhone = allowContact ? (profile?.contactPhone || profile?.phone || "") : "";

  return (
    <>
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/admin" className="text-sm text-blue-600 hover:underline">← Voltar ao painel</Link>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-2">Perfil do avaliador</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Visão administrativa do histórico e dos selos deste avaliador.</p>
          </div>
        </div>

        {loading && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-sm text-slate-500">Carregando dados…</p>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* Cabeçalho do avaliador */}
            <section className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{pseudonym}</h2>
                {profile?.status && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {profile.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong>ID interno (profileId):</strong> <code className="break-all">{profileId}</code>
              </p>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Status de verificação</p>
                <div className="flex flex-wrap gap-2">
                  {emailVerified ? <VerificationTierBadge tier="email" size="md" /> : <span className="text-xs text-slate-500 italic">E-mail não verificado</span>}
                  {linkedinVerified && <VerificationTierBadge tier="professional" size="md" />}
                  {profileComplete && <VerificationTierBadge tier="complete" size="md" />}
                </div>
              </div>
            </section>

            {/* Bloco confidencial — só admin */}
            <section className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 space-y-3">
              <div className="flex items-start gap-3">
                <div className="text-xl" aria-hidden="true">🔒</div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Informações confidenciais</h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Estas informações são confidenciais e visíveis apenas para administradores.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/40">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-mail de contato</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">
                    {allowContact && contactEmail ? contactEmail : <span className="italic text-slate-500">não autorizado</span>}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/40">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Telefone de contato</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-all">
                    {allowContact && contactPhone ? contactPhone : <span className="italic text-slate-500">não autorizado</span>}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/40">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">CPF verificado</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {cpfVerified ? <span className="text-emerald-700 dark:text-emerald-300">Sim</span> : <span className="text-slate-500 italic">Não</span>}
                  </p>
                </div>
              </div>
            </section>

            {/* Histórico de avaliações */}
            <section className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">Histórico de avaliações ({reviews.length})</h3>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma avaliação encontrada para este profileId.</p>
              ) : (
                <ul className="space-y-2">
                  {reviews.map((r) => {
                    const isSelection = r._reviewType === "selectionProcess";
                    const when = r?.createdAt?.toDate?.()?.toLocaleString?.("pt-BR") || r?.timestamp || "—";
                    return (
                      <li key={r.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isSelection ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200"}`}>
                              {isSelection ? "Processo Seletivo" : "Funcionário"}
                            </span>
                            <span>{r.companySlug || r.company || "—"}</span>
                            {r.flaggedForReview && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">EM REVISÃO</span>}
                          </p>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">{when}</span>
                        </div>
                        {(r.comment || r.generalComment) && (
                          <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 break-words line-clamp-3">{r.comment || r.generalComment}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

export default AdminUserDetail;
