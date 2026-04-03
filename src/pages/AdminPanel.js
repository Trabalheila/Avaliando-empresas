import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { isAdmin } from "../utils/rbac";
import { slugifyCompany, listReviewsByCompanySlug } from "../services/reviews";
import { buildApiUrl } from "../utils/apiBase";
import AppHeader from "../components/AppHeader";

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

function getAdminUid() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return (profile?.uid || profile?.id || profile?.profileId || "").toString().trim();
  } catch {
    return "";
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

  /* ── Abas ── */
  const TABS = ["Comentários", "Avaliações", "Consultores", "Prestadores"];
  const [activeTab, setActiveTab] = useState("Comentários");

  /* ── Estado ── */
  const [comments, setComments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filterCompany, setFilterCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type, id, label, companySlug? }
  const [deleting, setDeleting] = useState(false);

  /* ── Seleção em massa ── */
  const [selectedComments, setSelectedComments] = useState(new Set());
  const [selectedReviews, setSelectedReviews] = useState(new Set());

  // Limpar seleção ao trocar de aba ou filtro
  useEffect(() => {
    setSelectedComments(new Set());
    setSelectedReviews(new Set());
  }, [activeTab, filterCompany]);

  /* ── Estado consultores ── */
  const [consultores, setConsultores] = useState([]);
  const [consultoresLoading, setConsultoresLoading] = useState(true);

  /* ── Estado prestadores ── */
  const [prestadores, setPrestadores] = useState([]);
  const [prestadoresLoading, setPrestadoresLoading] = useState(true);

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
        console.error("Erro ao carregar dados admin:", err);
      }
      setLoading(false);
    })();
  }, [admin]);

  /* ── Carregar consultores ── */
  useEffect(() => {
    if (!admin) return;
    (async () => {
      setConsultoresLoading(true);
      try {
        const snap = await getDocs(collection(db, "consultores"));
        setConsultores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Erro ao carregar consultores:", err);
      }
      setConsultoresLoading(false);
    })();
  }, [admin]);

  /* ── Carregar prestadores ── */
  useEffect(() => {
    if (!admin) return;
    (async () => {
      setPrestadoresLoading(true);
      try {
        const snap = await getDocs(collection(db, "prestadores"));
        setPrestadores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Erro ao carregar prestadores:", err);
      }
      setPrestadoresLoading(false);
    })();
  }, [admin]);

  /* ── Exclusão via API server-side (Firebase Admin SDK) ── */
  const adminDeleteDoc = useCallback(async (collectionName, docId) => {
    const uid = getAdminUid();
    console.log("[AdminPanel] adminDeleteDoc chamado:", { collectionName, docId, uid: uid ? uid.slice(0, 8) + "..." : "VAZIO" });
    try {
      const res = await fetch(buildApiUrl("/api/admin-delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, collectionName, docId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("[AdminPanel] API admin-delete falhou:", res.status, data);
        // Fallback: tentar excluir diretamente pelo client SDK
        console.log("[AdminPanel] Tentando fallback com deleteDoc client-side...");
        await deleteDoc(doc(db, collectionName, docId));
        console.log("[AdminPanel] Fallback deleteDoc client-side OK:", docId);
        return { success: true, deleted: docId, fallback: true };
      }
      return res.json();
    } catch (err) {
      console.error("[AdminPanel] Erro adminDeleteDoc:", err);
      // Último fallback: client-side
      try {
        await deleteDoc(doc(db, collectionName, docId));
        console.log("[AdminPanel] Fallback final deleteDoc OK:", docId);
        return { success: true, deleted: docId, fallback: true };
      } catch (fallbackErr) {
        console.error("[AdminPanel] Fallback deleteDoc também falhou:", fallbackErr);
        throw fallbackErr;
      }
    }
  }, []);

  /* ── Recalcular médias da empresa após exclusão de avaliação ── */
  const recalcCompanyAverages = useCallback(async (companySlug) => {
    try {
      const remaining = await listReviewsByCompanySlug(companySlug, 500);
      const averages = {};
      SCORE_FIELDS.forEach((f) => {
        averages[f.key] = avgField(remaining, f.key);
      });

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
    setDeleting(true);
    console.log("[AdminPanel] Iniciando exclusão do comentário:", commentId);
    try {
      const targetComment = comments.find((c) => c.id === commentId);
      console.log("[AdminPanel] Caminho Firestore: comments/" + commentId);

      await adminDeleteDoc("comments", commentId);
      console.log("[AdminPanel] Comentário excluído com sucesso:", commentId);

      // Limpar localStorage: chave comments_NOME_DA_EMPRESA
      if (targetComment?.companyName) {
        try {
          const lsKey = `comments_${targetComment.companyName}`;
          const stored = JSON.parse(localStorage.getItem(lsKey) || "[]");
          const filtered = stored.filter((c) => c.id !== commentId);
          if (filtered.length > 0) {
            localStorage.setItem(lsKey, JSON.stringify(filtered));
          } else {
            localStorage.removeItem(lsKey);
          }
        } catch { /* silencioso */ }
      }
      clearLocalStorageKeysWith(commentId);

      // Atualizar estado local imediatamente
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("[AdminPanel] Erro ao apagar comentário:", commentId, err);
      alert("Erro ao apagar comentário: " + (err?.message || "Erro desconhecido"));
    }
    setDeleting(false);
    setModal(null);
  }, [adminDeleteDoc, comments]);

  /* ── Apagar avaliação ── */
  const deleteReview = useCallback(async (reviewId, companySlug) => {
    setDeleting(true);
    try {
      await adminDeleteDoc("reviews", reviewId);
      clearLocalStorageKeysWith(reviewId);
      // Limpa localStorage de avaliações da empresa
      if (companySlug) {
        clearLocalStorageKeysWith(`evaluations_`);
      }
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      if (companySlug) await recalcCompanyAverages(companySlug);
    } catch (err) {
      console.error("Erro ao apagar avaliação:", err);
    }
    setDeleting(false);
    setModal(null);
  }, [adminDeleteDoc, recalcCompanyAverages]);

  /* ── Aprovar / Rejeitar consultor ── */
  const updateConsultorStatus = useCallback(async (consultorId, newStatus) => {
    try {
      await updateDoc(doc(db, "consultores", consultorId), { status: newStatus });
      setConsultores((prev) =>
        prev.map((c) => (c.id === consultorId ? { ...c, status: newStatus } : c))
      );
    } catch (err) {
      console.error("Erro ao atualizar consultor:", err);
    }
  }, []);

  /* ── Aprovar / Rejeitar prestador ── */
  const updatePrestadorStatus = useCallback(async (prestadorId, newStatus) => {
    try {
      await updateDoc(doc(db, "prestadores", prestadorId), { status: newStatus });
      setPrestadores((prev) =>
        prev.map((p) => (p.id === prestadorId ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error("Erro ao atualizar prestador:", err);
    }
  }, []);

  /* ── Apagar comentários em massa ── */
  const deleteBulkComments = useCallback(async (ids) => {
    setDeleting(true);
    const failed = [];
    for (const commentId of ids) {
      try {
        const targetComment = comments.find((c) => c.id === commentId);
        await adminDeleteDoc("comments", commentId);
        if (targetComment?.companyName) {
          try {
            const lsKey = `comments_${targetComment.companyName}`;
            const stored = JSON.parse(localStorage.getItem(lsKey) || "[]");
            const filtered = stored.filter((c) => c.id !== commentId);
            if (filtered.length > 0) localStorage.setItem(lsKey, JSON.stringify(filtered));
            else localStorage.removeItem(lsKey);
          } catch { /* silencioso */ }
        }
        clearLocalStorageKeysWith(commentId);
      } catch (err) {
        console.error("[AdminPanel] Erro ao apagar comentário em massa:", commentId, err);
        failed.push(commentId);
      }
    }
    setComments((prev) => prev.filter((c) => !ids.has(c.id) || failed.includes(c.id)));
    setSelectedComments(new Set());
    if (failed.length > 0) alert(`${failed.length} comentário(s) não puderam ser apagados.`);
    setDeleting(false);
    setModal(null);
  }, [adminDeleteDoc, comments]);

  /* ── Apagar avaliações em massa ── */
  const deleteBulkReviews = useCallback(async (ids) => {
    setDeleting(true);
    const failed = [];
    const slugsToRecalc = new Set();
    for (const reviewId of ids) {
      try {
        const targetReview = reviews.find((r) => r.id === reviewId);
        await adminDeleteDoc("reviews", reviewId);
        clearLocalStorageKeysWith(reviewId);
        if (targetReview?.companySlug) {
          clearLocalStorageKeysWith("evaluations_");
          slugsToRecalc.add(targetReview.companySlug);
        }
      } catch (err) {
        console.error("[AdminPanel] Erro ao apagar avaliação em massa:", reviewId, err);
        failed.push(reviewId);
      }
    }
    setReviews((prev) => prev.filter((r) => !ids.has(r.id) || failed.includes(r.id)));
    setSelectedReviews(new Set());
    for (const slug of slugsToRecalc) {
      await recalcCompanyAverages(slug);
    }
    if (failed.length > 0) alert(`${failed.length} avaliação(ões) não puderam ser apagadas.`);
    setDeleting(false);
    setModal(null);
  }, [adminDeleteDoc, reviews, recalcCompanyAverages]);

  /* ── Confirmar ação no modal ── */
  const confirmModal = useCallback(() => {
    if (!modal) return;
    if (modal.type === "comment") deleteComment(modal.id);
    if (modal.type === "review") deleteReview(modal.id, modal.companySlug);
    if (modal.type === "bulk-comments") deleteBulkComments(modal.ids);
    if (modal.type === "bulk-reviews") deleteBulkReviews(modal.ids);
  }, [modal, deleteComment, deleteReview, deleteBulkComments, deleteBulkReviews]);

  /* ── Filtragem ── */
  const filteredReviews = useMemo(() => {
    if (!filterCompany) return reviews;
    return reviews.filter((r) => r.companySlug === filterCompany);
  }, [reviews, filterCompany]);

  const filteredComments = useMemo(() => {
    if (!filterCompany) return comments;
    return comments.filter((c) => c.companySlug === filterCompany);
  }, [comments, filterCompany]);

  const consultoresPendentes = useMemo(
    () => consultores.filter((c) => !c.status || c.status === "pendente"),
    [consultores]
  );

  const prestadoresPendentes = useMemo(
    () => prestadores.filter((p) => !p.status || p.status === "pendente"),
    [prestadores]
  );

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Painel Administrativo" />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* Abas */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-b-0 border-slate-200 dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab}
              {tab === "Consultores" && consultoresPendentes.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                  {consultoresPendentes.length}
                </span>
              )}
              {tab === "Prestadores" && prestadoresPendentes.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                  {prestadoresPendentes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filtro por empresa (apenas para Comentários e Avaliações) */}
        {(activeTab === "Comentários" || activeTab === "Avaliações") && (
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
        )}

        {loading && <p className="text-sm text-slate-500">Carregando dados…</p>}

        {/* ═══ ABA Comentários ═══ */}
        {activeTab === "Comentários" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                Comentários ({filteredComments.length})
              </h2>
              {filteredComments.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedComments.size === filteredComments.length && filteredComments.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedComments(new Set(filteredComments.map((c) => c.id)));
                        else setSelectedComments(new Set());
                      }}
                      className="accent-blue-600 w-4 h-4"
                    />
                    Selecionar todos
                  </label>
                  {selectedComments.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setModal({ type: "bulk-comments", ids: new Set(selectedComments), label: `${selectedComments.size} comentário(s)` })}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                      Apagar selecionados ({selectedComments.size})
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredComments.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum comentário encontrado.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedComments.has(c.id)}
                      onChange={() => setSelectedComments((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        return next;
                      })}
                      className="accent-blue-600 w-4 h-4 mt-1 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {c.companySlug || "—"} · {c.author || "Anônimo"}
                        {c.author && /[A-ZÀ-Ü][a-zà-ü]+\s[A-ZÀ-Ü]/.test(c.author) && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 rounded-full">
                            NOME REAL EXPOSTO
                          </span>
                        )}
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
        )}

        {/* ═══ ABA Avaliações ═══ */}
        {activeTab === "Avaliações" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                Avaliações ({filteredReviews.length})
              </h2>
              {filteredReviews.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedReviews.size === filteredReviews.length && filteredReviews.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedReviews(new Set(filteredReviews.map((r) => r.id)));
                        else setSelectedReviews(new Set());
                      }}
                      className="accent-blue-600 w-4 h-4"
                    />
                    Selecionar todos
                  </label>
                  {selectedReviews.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setModal({ type: "bulk-reviews", ids: new Set(selectedReviews), label: `${selectedReviews.size} avaliação(ões)` })}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                    >
                      Apagar selecionados ({selectedReviews.size})
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredReviews.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma avaliação encontrada.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredReviews.map((r) => {
                  const vals = SCORE_FIELDS.map((f) => parseFloat(r?.[f.key])).filter((v) => Number.isFinite(v) && v > 0);
                  const avg = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "--";
                  return (
                    <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedReviews.has(r.id)}
                        onChange={() => setSelectedReviews((prev) => {
                          const next = new Set(prev);
                          if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                          return next;
                        })}
                        className="accent-blue-600 w-4 h-4 mt-1 shrink-0 cursor-pointer"
                      />
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
        )}

        {/* ═══ ABA Consultores ═══ */}
        {activeTab === "Consultores" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-4">
              Consultores pendentes ({consultoresPendentes.length})
            </h2>

            {consultoresLoading ? (
              <p className="text-sm text-slate-500">Carregando consultores…</p>
            ) : consultoresPendentes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum consultor pendente de aprovação.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {consultoresPendentes.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{c.nome || c.name || "Sem nome"}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{c.especialidade || "—"} · {c.email || "—"}</p>
                        {c.descricao && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.descricao}</p>}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">LinkedIn</a>
                        )}
                        {c.valorMedio && <p className="text-xs text-slate-500 mt-1">Valor médio: R$ {c.valorMedio}</p>}
                        {c.areas && c.areas.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">Áreas: {c.areas.join(", ")}</p>
                        )}
                        {c.documentos && c.documentos.length > 0 && (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {c.documentos.map((d, i) => (
                              <a key={i} href={d.url || d} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">
                                Documento {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateConsultorStatus(c.id, "ativo")}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConsultorStatus(c.id, "rejeitado")}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ ABA Prestadores ═══ */}
        {activeTab === "Prestadores" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mb-4">
              Prestadores pendentes ({prestadoresPendentes.length})
            </h2>

            {prestadoresLoading ? (
              <p className="text-sm text-slate-500">Carregando prestadores…</p>
            ) : prestadoresPendentes.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum prestador pendente de aprovação.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {prestadoresPendentes.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{p.razaoSocial || p.nome || "Sem nome"}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.cnpj || "—"} · {p.email || "—"}</p>
                        {p.segmentos && p.segmentos.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.segmentos.map((s) => (
                              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">{s}</span>
                            ))}
                          </div>
                        )}
                        {p.descricao && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{p.descricao}</p>}
                        {p.site && (
                          <a href={p.site} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mt-1 inline-block">Site</a>
                        )}
                        {p.valorMedio && <p className="text-xs text-slate-500 mt-1">Valor médio: R$ {p.valorMedio}</p>}
                        {p.telefone && <p className="text-xs text-slate-500 mt-1">Tel: {p.telefone}</p>}
                        {p.documentos && p.documentos.length > 0 && (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {p.documentos.map((d, i) => (
                              <a key={i} href={d.url || d} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">
                                Documento {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => updatePrestadorStatus(p.id, "ativo")}
                          className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePrestadorStatus(p.id, "rejeitado")}
                          className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
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
                disabled={deleting}
                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
