import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
} from "firebase/firestore";
import { isAdmin } from "../utils/rbac";
import { slugifyCompany, listReviewsByCompanySlug } from "../services/reviews";
import { buildApiUrl } from "../utils/apiBase";
import AppHeader from "../components/AppHeader";
import AdminQuickAccess from "../components/AdminQuickAccess";

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
  const location = useLocation();
  const admin = useMemo(() => isAdmin(), []);

  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  /* ── Abas ── */
  const TABS = ["Comentários", "Avaliações", "Apoiadores", "Restritos", "Verificações", "Planos", "Crescimento"];
  const [activeTab, setActiveTab] = useState("Comentários");

  /* Permite linkar diretamente para uma aba via ?tab=apoiadores|verif|restritos|comentarios|avaliacoes */
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const t = String(params.get("tab") || "").toLowerCase();
    const map = {
      apoiadores: "Apoiadores",
      verif: "Verificações",
      verificacoes: "Verificações",
      restritos: "Restritos",
      comentarios: "Comentários",
      avaliacoes: "Avaliações",
    };
    if (map[t]) setActiveTab(map[t]);
  }, [location.search]);

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

  /* ── Estado apoiadores (unificado) ── */
  const [apoiadores, setApoiadores] = useState([]);
  const [apoiadoresLoading, setApoiadoresLoading] = useState(true);
  const [apoiadoresSearch, setApoiadoresSearch] = useState("");
  const [apoiadoresStatusFilter, setApoiadoresStatusFilter] = useState("pendente");
  const [apoiadorBusyId, setApoiadorBusyId] = useState(null);
  const [apoiadorToast, setApoiadorToast] = useState(null);

  /* ── Estado da aba Restritos ── */
  const [restrictedItems, setRestrictedItems] = useState([]);
  const [restrictedLoading, setRestrictedLoading] = useState(false);
  const [restrictedSearch, setRestrictedSearch] = useState("");
  const [restrictedCursor, setRestrictedCursor] = useState(null);
  const [restrictedHasMore, setRestrictedHasMore] = useState(false);
  const [restrictedToast, setRestrictedToast] = useState(null);
  const [restrictedEditing, setRestrictedEditing] = useState(null); // { item, summary, replacement }
  const [restrictedBusyKey, setRestrictedBusyKey] = useState(null);

  /* ── Estado da aba Verificações ── */
  const [verifItems, setVerifItems] = useState([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifStatusFilter, setVerifStatusFilter] = useState("pending_manual");
  const [verifBusyId, setVerifBusyId] = useState(null);
  const [verifToast, setVerifToast] = useState(null);
  const [verifNotes, setVerifNotes] = useState({});

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

  /* ── Carregar apoiadores (coleção unificada) ── */
  useEffect(() => {
    if (!admin) return;
    (async () => {
      setApoiadoresLoading(true);
      try {
        const snap = await getDocs(collection(db, "apoiadores"));
        setApoiadores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Erro ao carregar apoiadores:", err);
      }
      setApoiadoresLoading(false);
    })();
  }, [admin]);

  /* ── Carregar trechos restritos ── */
  const loadRestricted = useCallback(
    async ({ reset = false } = {}) => {
      const uid = getAdminUid();
      if (!uid) return;
      setRestrictedLoading(true);
      try {
        const res = await fetch(buildApiUrl("/api/admin?op=restricted"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            search: restrictedSearch,
            cursor: reset ? null : restrictedCursor,
            pageSize: 50,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Erro ao listar trechos restritos.");
        setRestrictedItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setRestrictedCursor(data.nextCursor || null);
        setRestrictedHasMore(Boolean(data.hasMore));
      } catch (err) {
        console.error("[AdminPanel/restricted] erro:", err);
        setRestrictedToast({ type: "error", message: err.message || "Erro ao carregar." });
      }
      setRestrictedLoading(false);
    },
    [restrictedSearch, restrictedCursor]
  );

  useEffect(() => {
    if (activeTab === "Restritos") {
      loadRestricted({ reset: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const moderateSegment = useCallback(
    async ({ item, action, summary, replacementText }) => {
      const uid = getAdminUid();
      if (!uid) return;
      const key = `${item.reviewId}:${item.source}:${item.segmentIndex}`;
      setRestrictedBusyKey(key);
      try {
        const res = await fetch(buildApiUrl("/api/admin?op=moderate-segment"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid,
            reviewId: item.reviewId,
            source: item.source,
            segmentIndex: item.segmentIndex,
            action,
            summary,
            replacementText,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao moderar trecho.");
        setRestrictedToast({
          type: "success",
          message:
            action === "approve"
              ? "Trecho aprovado e tornado público."
              : action === "reject"
                ? "Trecho removido do conteúdo original."
                : "Trecho atualizado.",
        });
        setRestrictedEditing(null);
        await loadRestricted({ reset: true });
      } catch (err) {
        console.error("[AdminPanel/moderate] erro:", err);
        setRestrictedToast({ type: "error", message: err.message || "Erro ao moderar." });
      }
      setRestrictedBusyKey(null);
    },
    [loadRestricted]
  );

  useEffect(() => {
    if (!restrictedToast) return undefined;
    const t = window.setTimeout(() => setRestrictedToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [restrictedToast]);

  /* ── Carregar/decidir solicitações de verificação ── */
  const loadVerifications = useCallback(async () => {
    const uid = getAdminUid();
    if (!uid) return;
    setVerifLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=verify-list"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, status: verifStatusFilter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao listar verificações.");
      setVerifItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("[AdminPanel/verifications] erro:", err);
      setVerifToast({ type: "error", message: err.message || "Erro ao carregar." });
    }
    setVerifLoading(false);
  }, [verifStatusFilter]);

  useEffect(() => {
    if (activeTab === "Verificações") loadVerifications();
  }, [activeTab, loadVerifications]);

  const decideVerification = useCallback(
    async ({ item, action }) => {
      const uid = getAdminUid();
      if (!uid) return;
      setVerifBusyId(item.id);
      try {
        const res = await fetch(
          buildApiUrl("/api/admin?op=verify-decision"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              requestId: item.id,
              action,
              notes: verifNotes[item.id] || "",
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao decidir.");
        setVerifToast({
          type: "success",
          message: action === "approve" ? "Empresa aprovada." : "Solicitação rejeitada.",
        });
        await loadVerifications();
      } catch (err) {
        console.error("[AdminPanel/verifications] decide erro:", err);
        setVerifToast({ type: "error", message: err.message || "Erro." });
      }
      setVerifBusyId(null);
    },
    [loadVerifications, verifNotes]
  );

  useEffect(() => {
    if (!verifToast) return undefined;
    const t = window.setTimeout(() => setVerifToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [verifToast]);

  /* ── Exclusão via API server-side (Firebase Admin SDK) ── */
  const adminDeleteDoc = useCallback(async (collectionName, docId) => {
    const uid = getAdminUid();
    console.log("[AdminPanel] adminDeleteDoc chamado:", { collectionName, docId, uid: uid ? uid.slice(0, 8) + "..." : "VAZIO" });
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, collectionName, docId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.warn("[AdminPanel] API admin?op=delete falhou:", res.status, data);
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

  /* ── Aprovar / Rejeitar apoiador ── */
  const updateApoiadorStatus = useCallback(async (apoiadorId, newStatus) => {
    setApoiadorBusyId(apoiadorId);
    try {
      await updateDoc(doc(db, "apoiadores", apoiadorId), { status: newStatus });
      setApoiadores((prev) =>
        prev.map((a) => (a.id === apoiadorId ? { ...a, status: newStatus } : a))
      );
      const msg =
        newStatus === "ativo"
          ? "Apoiador aprovado."
          : newStatus === "rejeitado"
          ? "Apoiador rejeitado."
          : newStatus === "pendente"
          ? "Decisão revertida. Apoiador voltou para análise."
          : "Status atualizado.";
      setApoiadorToast({ type: "success", message: msg });
    } catch (err) {
      console.error("Erro ao atualizar apoiador:", err);
      setApoiadorToast({
        type: "error",
        message: "Não foi possível atualizar o apoiador.",
      });
    }
    setApoiadorBusyId(null);
  }, []);

  /* ── Promover / remover Premium de apoiador ── */
  const updateApoiadorPlano = useCallback(async (apoiadorId, newPlano) => {
    setApoiadorBusyId(apoiadorId);
    try {
      await updateDoc(doc(db, "apoiadores", apoiadorId), { plano: newPlano });
      setApoiadores((prev) =>
        prev.map((a) => (a.id === apoiadorId ? { ...a, plano: newPlano } : a))
      );
      setApoiadorToast({
        type: "success",
        message:
          newPlano === "premium"
            ? "Apoiador promovido ao plano Premium."
            : "Plano Premium removido.",
      });
    } catch (err) {
      console.error("Erro ao atualizar plano do apoiador:", err);
      setApoiadorToast({
        type: "error",
        message: "Não foi possível atualizar o plano.",
      });
    }
    setApoiadorBusyId(null);
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

  const apoiadoresPendentes = useMemo(
    () => apoiadores.filter((a) => !a.status || a.status === "pendente"),
    [apoiadores]
  );

  const filteredApoiadores = useMemo(() => {
    const term = apoiadoresSearch.trim().toLowerCase();
    return apoiadores.filter((a) => {
      const st = a.status || "pendente";
      if (apoiadoresStatusFilter === "rejeitado") {
        if (st !== "rejeitado" && st !== "rejected") return false;
      } else if (apoiadoresStatusFilter === "ativo") {
        if (st !== "ativo" && st !== "approved") return false;
      } else if (apoiadoresStatusFilter === "pendente") {
        if (st !== "pendente" && st !== "pending") return false;
      } /* "todos" → não filtra por status */

      if (term) {
        const haystack = [
          a.nome,
          a.email,
          a.razaoSocial,
          a.uid,
          a.pseudonym,
          a.pseudonimo,
          a.especialidade,
          a.cnpj,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [apoiadores, apoiadoresSearch, apoiadoresStatusFilter]);

  // Auto-dismiss do toast da aba apoiadores
  useEffect(() => {
    if (!apoiadorToast) return undefined;
    const t = window.setTimeout(() => setApoiadorToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [apoiadorToast]);

  const TIPO_BADGE = {
    consultor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    advogado: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
    prestador: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  };
  const TIPO_LABEL = { consultor: "Consultor", advogado: "Advogado", prestador: "Prestador" };

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Painel Administrativo" />
      <AdminQuickAccess />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-10">

        {/* Abas */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (tab === "Planos") {
                  navigate("/admin/plans");
                  return;
                }
                if (tab === "Crescimento") {
                  navigate("/admin/crescimento");
                  return;
                }
                setActiveTab(tab);
              }}
              className={`shrink-0 px-3 sm:px-4 py-2 text-sm font-semibold rounded-t-lg transition whitespace-nowrap ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-b-0 border-slate-200 dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab}
              {tab === "Apoiadores" && apoiadoresPendentes.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                  {apoiadoresPendentes.length}
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

        {/* ═══ ABA Restritos ═══ */}
        {activeTab === "Restritos" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                Comentários restritos ({restrictedItems.length})
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Buscar por trecho, resumo, empresa…"
                  value={restrictedSearch}
                  onChange={(e) => setRestrictedSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setRestrictedCursor(null);
                      loadRestricted({ reset: true });
                    }
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setRestrictedCursor(null);
                    loadRestricted({ reset: true });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={restrictedLoading}
                >
                  {restrictedLoading ? "Carregando…" : "Atualizar"}
                </button>
              </div>
            </div>

            {restrictedToast && (
              <div
                className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  restrictedToast.type === "success"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}
              >
                {restrictedToast.message}
              </div>
            )}

            {restrictedLoading && restrictedItems.length === 0 ? (
              <p className="text-sm text-slate-500">Carregando trechos restritos…</p>
            ) : restrictedItems.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum trecho restrito encontrado.</p>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {restrictedItems.map((it) => {
                  const key = `${it.reviewId}:${it.source}:${it.segmentIndex}`;
                  const busy = restrictedBusyKey === key;
                  const date = it.createdAt
                    ? new Date(it.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—";
                  return (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold">
                              {it.sourceLabel}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {it.companySlug || "—"}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              · {it.pseudonym || "Anônimo"}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">· {date}</span>
                            {(() => {
                              const companyParam = encodeURIComponent(it.company || it.companySlug || "");
                              const reviewHash = it.reviewId ? `#review-${encodeURIComponent(it.reviewId)}` : "";
                              const href =
                                it.source && it.source !== "general"
                                  ? `/empresa/comentarios-item?name=${companyParam}&item=${encodeURIComponent(it.source)}${reviewHash}`
                                  : `/empresa?name=${companyParam}${reviewHash}`;
                              return (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 underline"
                                >
                                  ver avaliação ↗
                                </a>
                              );
                            })()}
                          </div>

                          <div className="mt-2 text-sm">
                            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                              Trecho restrito:
                            </p>
                            <blockquote className="border-l-4 border-purple-400 pl-3 text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                              {it.excerpt || <em className="text-slate-400">(vazio)</em>}
                            </blockquote>
                          </div>

                          <div className="mt-2 text-sm">
                            <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                              Resumo curto:
                            </p>
                            <p className="text-slate-600 dark:text-slate-300">
                              {it.summary || <em className="text-slate-400">(sem resumo)</em>}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => moderateSegment({ item: it, action: "approve" })}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                            title="Remove a restrição — texto fica público"
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setRestrictedEditing({
                                item: it,
                                summary: it.summary || "",
                                replacement: it.excerpt || "",
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Remover este trecho do texto original? Ele será substituído por '[removido pela moderação]'."
                                )
                              ) {
                                moderateSegment({ item: it, action: "reject" });
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            Rejeitar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {restrictedHasMore && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => loadRestricted({ reset: false })}
                      disabled={restrictedLoading}
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 disabled:opacity-50"
                    >
                      {restrictedLoading ? "Carregando…" : "Carregar mais"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ═══ ABA Verificações (empresas) ═══ */}
        {activeTab === "Verificações" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                Verificações de empresa ({verifItems.length})
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={verifStatusFilter}
                  onChange={(e) => setVerifStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="pending_manual">Aguardando revisão manual</option>
                  <option value="pending_email">Aguardando código por e-mail</option>
                  <option value="verified">Verificadas</option>
                  <option value="rejected">Rejeitadas</option>
                  <option value="todos">Todas</option>
                </select>
                <button
                  type="button"
                  onClick={loadVerifications}
                  disabled={verifLoading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifLoading ? "Carregando…" : "Atualizar"}
                </button>
              </div>
            </div>

            {verifToast && (
              <div
                className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  verifToast.type === "success"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}
              >
                {verifToast.message}
              </div>
            )}

            {verifLoading && verifItems.length === 0 ? (
              <p className="text-sm text-slate-500">Carregando solicitações…</p>
            ) : verifItems.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma solicitação para este filtro.</p>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {verifItems.map((it) => {
                  const busy = verifBusyId === it.id;
                  const date = it.updatedAt
                    ? new Date(it.updatedAt).toLocaleString("pt-BR")
                    : "—";
                  const affinityPct = Math.round((it.domainAffinity || 0) * 100);
                  const statusBadge =
                    {
                      pending_email: "bg-slate-200 text-slate-700",
                      pending_manual: "bg-amber-100 text-amber-700",
                      verified: "bg-emerald-100 text-emerald-700",
                      rejected: "bg-red-100 text-red-700",
                    }[it.status] || "bg-slate-200 text-slate-700";
                  return (
                    <div
                      key={it.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${statusBadge}`}>
                              {it.status}
                            </span>
                            {it.tier === "premium" && (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                                Premium
                              </span>
                            )}
                            <span className="text-slate-500">{date}</span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                            {it.razaoSocial || "—"}{" "}
                            <span className="font-mono text-xs text-slate-500">
                              CNPJ {it.cnpj}
                            </span>
                          </p>
                          {it.nomeFantasia && (
                            <p className="text-xs text-slate-500">{it.nomeFantasia}</p>
                          )}
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                            <span className="font-semibold">E-mail:</span>{" "}
                            <span className="font-mono">{it.corporateEmail}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Afinidade do domínio com a razão social: {affinityPct}%{" "}
                            {affinityPct < 80 && (
                              <span className="text-amber-600 dark:text-amber-400">
                                (heurística sugere revisão manual)
                              </span>
                            )}
                          </p>
                          {it.notes && (
                            <p className="mt-1 text-xs italic text-slate-500">
                              Notas: {it.notes}
                            </p>
                          )}

                          {it.status === "pending_manual" && (
                            <textarea
                              rows={2}
                              placeholder="Notas internas (opcional)"
                              value={verifNotes[it.id] || ""}
                              onChange={(e) =>
                                setVerifNotes((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.value,
                                }))
                              }
                              className="mt-2 w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                            />
                          )}
                        </div>
                        {it.status === "pending_manual" && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => decideVerification({ item: it, action: "approve" })}
                              className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Aprovar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (window.confirm("Rejeitar esta solicitação?")) {
                                  decideVerification({ item: it, action: "reject" });
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ═══ ABA Apoiadores (unificada) ═══ */}
        {activeTab === "Apoiadores" && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                Apoiadores
                <span className="ml-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  ({filteredApoiadores.length})
                </span>
                {apoiadoresPendentes.length > 0 && apoiadoresStatusFilter !== "pendente" && (
                  <button
                    type="button"
                    onClick={() => setApoiadoresStatusFilter("pendente")}
                    className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 rounded-full hover:brightness-105"
                  >
                    {apoiadoresPendentes.length} pendente(s)
                  </button>
                )}
              </h2>
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <input
                  type="search"
                  placeholder="Buscar por nome, e-mail, pseudônimo…"
                  value={apoiadoresSearch}
                  onChange={(e) => setApoiadoresSearch(e.target.value)}
                  className="flex-1 sm:flex-none sm:w-72 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                />
                <select
                  value={apoiadoresStatusFilter}
                  onChange={(e) => setApoiadoresStatusFilter(e.target.value)}
                  className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="pendente">Pendentes</option>
                  <option value="ativo">Aprovados</option>
                  <option value="rejeitado">Rejeitados</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
            </div>

            {apoiadorToast && (
              <div
                className={`mb-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  apoiadorToast.type === "success"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}
              >
                {apoiadorToast.message}
              </div>
            )}

            {apoiadoresLoading ? (
              <p className="text-sm text-slate-500">Carregando apoiadores…</p>
            ) : filteredApoiadores.length === 0 ? (
              <p className="text-sm text-slate-500">
                {apoiadoresSearch
                  ? "Nenhum apoiador corresponde à busca."
                  : apoiadoresStatusFilter === "rejeitado"
                  ? "Nenhum apoiador rejeitado."
                  : apoiadoresStatusFilter === "ativo"
                  ? "Nenhum apoiador aprovado."
                  : "Nenhum apoiador pendente de aprovação."}
              </p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {filteredApoiadores.map((a) => {
                  const st = a.status || "pendente";
                  const isActive = st === "ativo" || st === "approved";
                  const isRejected = st === "rejeitado" || st === "rejected";
                  const isPending = !isActive && !isRejected;
                  const isPremium =
                    String(a.plano || "").toLowerCase() === "premium";
                  const busy = apoiadorBusyId === a.id;
                  return (
                    <div
                      key={a.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {a.nome || a.razaoSocial || "Sem nome"}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                TIPO_BADGE[a.tipo] || "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {TIPO_LABEL[a.tipo] || a.tipo || "?"}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                isActive
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : isRejected
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                              }`}
                            >
                              {isActive ? "Aprovado" : isRejected ? "Rejeitado" : "Pendente"}
                            </span>
                            {isPremium && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-900 dark:bg-amber-700/40 dark:text-amber-100">
                                Premium
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-all">
                            {a.email || "—"}
                            {a.especialidade && ` · ${a.especialidade}`}
                            {a.oab && ` · OAB ${a.oab}/${a.seccional || "?"}`}
                            {a.cnpj && ` · CNPJ ${a.cnpj}`}
                          </p>
                          {isActive && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">
                              {a.visualizacoes || 0} visualizações — {a.cliquesContato || 0} cliques
                            </p>
                          )}
                          {a.descricao && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">
                              {a.descricao}
                            </p>
                          )}
                          {(a.areas || a.segmentos || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(a.areas || a.segmentos || []).map((s) => (
                                <span
                                  key={s}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-3 flex-wrap mt-1">
                            {a.linkedin && (
                              <a
                                href={a.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline"
                              >
                                LinkedIn
                              </a>
                            )}
                            {a.site && (
                              <a
                                href={a.site}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline"
                              >
                                Site
                              </a>
                            )}
                            {a.documentos && a.documentos.length > 0 && (
                              <>
                                {a.documentos.map((d, i) => (
                                  <a
                                    key={i}
                                    href={d.url || d}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 underline"
                                  >
                                    Documento {i + 1}
                                  </a>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateApoiadorStatus(a.id, "ativo")}
                                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition disabled:opacity-50"
                              >
                                Aprovar
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateApoiadorStatus(a.id, "rejeitado")}
                                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition disabled:opacity-50"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                          {isActive && (
                            <>
                              {isPremium ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => updateApoiadorPlano(a.id, "gratuito")}
                                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                                  title="Voltar para plano gratuito"
                                >
                                  Remover Premium
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => updateApoiadorPlano(a.id, "premium")}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50"
                                  title="Promover ao plano Premium"
                                >
                                  Promover Premium
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm("Desativar este apoiador (voltar para análise)?")) {
                                    updateApoiadorStatus(a.id, "pendente");
                                  }
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                              >
                                Voltar p/ análise
                              </button>
                            </>
                          )}
                          {isRejected && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateApoiadorStatus(a.id, "ativo")}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50"
                                title="Aprovar agora — reverter rejeição"
                              >
                                Aprovar agora
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateApoiadorStatus(a.id, "pendente")}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                                title="Voltar para a fila de análise"
                              >
                                Reabrir análise
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

      {/* ═══ Modal de edição de trecho restrito ═══ */}
      {restrictedEditing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setRestrictedEditing(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-700 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Editar trecho restrito
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Resumo curto
              </label>
              <input
                type="text"
                value={restrictedEditing.summary}
                onChange={(e) =>
                  setRestrictedEditing((prev) => ({ ...prev, summary: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Trecho original (substituirá o conteúdo)
              </label>
              <textarea
                rows={4}
                value={restrictedEditing.replacement}
                onChange={(e) =>
                  setRestrictedEditing((prev) => ({ ...prev, replacement: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Deixar igual ao original mantém apenas a alteração do resumo.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRestrictedEditing(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const { item, summary, replacement } = restrictedEditing;
                  const replacementText =
                    replacement !== item.excerpt ? replacement : null;
                  moderateSegment({
                    item,
                    action: "edit",
                    summary,
                    replacementText,
                  });
                }}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
