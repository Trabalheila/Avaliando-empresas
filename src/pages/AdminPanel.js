import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { isAdmin } from "../utils/rbac";
import { slugifyCompany, listReviewsByCompanySlug } from "../services/reviews";

/* ────────────────────────────────────────────────
   Critérios — mesmos do BusinessDashboard
   ──────────────────────────────────────────────── */
const SCORE_FIELDS = [
  { key: "comunicacao", label: "Recrutamento" },
  { key: "etica", label: "Proposta salarial" },
  { key: "cultura", label: "Cultura" },
  { key: "salario", label: "Pagamento" },
  { key: "lideranca", label: "Liderança" },
  { key: "estimacaoOrganizacao", label: "Condições de trabalho" },
  { key: "ambiente", label: "Respeito" },
  { key: "diversidade", label: "Diversidade" },
  { key: "rating", label: "Segurança" },
  { key: "saudeBemEstar", label: "Bem-estar" },
  { key: "equilibrio", label: "Equilíbrio" },
  { key: "reconhecimento", label: "Reconhecimento" },
  { key: "desenvolvimento", label: "Plano de carreira" },
];

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */
function avgField(reviews, key) {
  const values = reviews
    .map((r) => parseFloat(r?.[key]))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clearLocalStorageKeysWith(fragment) {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((k) => {
      if (k.includes(fragment)) localStorage.removeItem(k);
    });
  } catch {
    /* silencioso */
  }
}

/* ════════════════════════════════════════════════
   AdminPanel
   ════════════════════════════════════════════════ */
function AdminPanel({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);

  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  /* ── Estado ── */
  const [comments, setComments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filterCompany, setFilterCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type, id, label }

  /* ── Carregar dados ── */
  useEffect(() => {
    if (!admin) return;

    (async () => {
      setLoading(true);
      try {
        const [commSnap, revSnap] = await Promise.all([
          getDocs(query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(2000))),
          getDocs(query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(2000))),
        ]);
        const commList = commSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const revList = revSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setComments(commList);
        setReviews(revList);

        const slugSet = new Set();
        revList.forEach((r) => { if (r.companySlug) slugSet.add(r.companySlug); });
        commList.forEach((c) => { if (c.companySlug) slugSet.add(c.companySlug); });
        setCompanies([...slugSet].sort((a, b) => a.localeCompare(b, "pt-BR")));
      } catch (err) {
        console.warn("Erro ao carregar dados admin:", err);
      }
      setLoading(false);
    })();
  }, [admin]);

  /* ── Recalcular médias da empresa após exclusão de avaliação ── */
  const recalcCompanyAverages = useCallback(async (companySlug) => {
    try {
      const remaining = await listReviewsByCompanySlug(companySlug, 500);
      const averages = {};
      SCORE_FIELDS.forEach((f) => {
        averages[f.key] = avgField(remaining, f.key);
      });

      // Atualiza localStorage "empresasData"
      try {
        const stored = JSON.parse(localStorage.getItem("empresasData") || "[]");
        const idx = stored.findIndex(
          (e) => slugifyCompany(e?.company || e?.name || "") === companySlug
        );
        if (idx >= 0) {
          SCORE_FIELDS.forEach((f) => {
            stored[idx][f.key] = averages[f.key];
          });
          localStorage.setItem("empresasData", JSON.stringify(stored));
        }
      } catch {
        /* silencioso */
      }
    } catch {
      /* silencioso */
    }
  }, []);

  /* ── Apagar comentário ── */
  const deleteComment = useCallback(async (commentId) => {
    try {
      await deleteDoc(doc(db, "comments", commentId));
      clearLocalStorageKeysWith(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.warn("Erro ao apagar comentário:", err);
    }
    setModal(null);
  }, []);

  /* ── Apagar avaliação ── */
  const deleteReview = useCallback(async (reviewId, companySlug) => {
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      clearLocalStorageKeysWith(reviewId);
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (companySlug) await recalcCompanyAverages(companySlug);
    } catch (err) {
      console.warn("Erro ao apagar avaliação:", err);
    }
    setModal(null);
  }, [recalcCompanyAverages]);

  /* ── Confirmar ação no modal ── */
  const confirmModal = useCallback(() => {
    if (!modal) return;
    if (modal.type === "comment") deleteComment(modal.id);
    if (modal.type === "review") deleteReview(modal.id, modal.companySlug);
  }, [modal, deleteComment, deleteReview]);

  /* ── Filtragem ── */
  const filteredReviews = useMemo(() => {
    if (!filterCompany) return reviews;
    return reviews.filter((r) => r.companySlug === filterCompany);
  }, [reviews, filterCompany]);

  const filteredComments = useMemo(() => {
    if (!filterCompany) return comments;
    return comments.filter((c) => c.companySlug === filterCompany);
  }, [comments, filterCompany]);

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <button type="button" onClick={() => navigate("/")} className="text-xl font-extrabold tracking-wide text-blue-700 dark:text-blue-300 hover:opacity-80 transition" style={{ fontFamily: "'Azonix', sans-serif" }}>
            TRABALHEI LÁ
          </button>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden sm:block">Painel Administrativo</h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggleTheme} className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-sm" aria-label="Alternar tema">
              {theme === "dark" ? "🌙" : "☀️"}
            </button>
            <button type="button" onClick={() => navigate("/")} className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 dark:border-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
              Voltar
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* Filtro por empresa */}
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filtrar por empresa:</label>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="">Todas</option>
            {companies.map((slug) => (
              <option key={slug} value={slug}>{slug}</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm text-slate-500">Carregando dados…</p>}

        {/* ═══ SEÇÃO 1 — Comentários ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-4">
            Comentários ({filteredComments.length})
          </h2>

          {filteredComments.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum comentário encontrado.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredComments.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {c.companySlug || "—"} · {c.author || "Anônimo"}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 break-words">{c.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal({ type: "comment", id: c.id, label: `Comentário de "${c.author || "Anônimo"}" em ${c.companySlug || "?"}` })}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                  >
                    Apagar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══ SEÇÃO 2 — Avaliações ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-4">
            Avaliações ({filteredReviews.length})
          </h2>

          {filteredReviews.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma avaliação encontrada.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredReviews.map((r) => {
                const vals = SCORE_FIELDS.map((f) => parseFloat(r?.[f.key])).filter((v) => Number.isFinite(v) && v > 0);
                const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "--";
                return (
                  <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {r.companySlug || "—"} · {r.pseudonym || r.company || "?"} · Média: {avg}
                      </p>
                      {r.comment && <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 break-words">{r.comment}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModal({ type: "review", id: r.id, companySlug: r.companySlug, label: `Avaliação de "${r.pseudonym || "?"}" em ${r.companySlug || "?"}` })}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                    >
                      Apagar avaliação
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* ═══ Modal de confirmação ═══ */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Confirmar exclusão</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{modal.label}</p>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-5">Tem certeza? Essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
