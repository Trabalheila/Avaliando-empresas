import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { isAdmin } from "../utils/rbac";
import { buildApiUrl } from "../utils/apiBase";
import AppHeader from "../components/AppHeader";
import AdminQuickAccess from "../components/AdminQuickAccess";
import VerificationLevelBadge from "../components/VerificationLevelBadge";

/* ──────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────── */
const APPROVAL_LABEL = {
  approved: "Ativo",
  rejected: "Removido",
  incomplete: "Incompleto",
  pending: "Incompleto",
};

const APPROVAL_BADGE = {
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  incomplete: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  pending: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

const PLAN_LABEL = {
  gratuito: "Gratuito",
  premium: "Premium",
  premium_gratuito: "Premium Gratuito",
};

const PLAN_BADGE = {
  gratuito:
    "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  premium: "bg-amber-200 text-amber-900 dark:bg-amber-700/40 dark:text-amber-100",
  premium_gratuito:
    "bg-emerald-200 text-emerald-900 dark:bg-emerald-700/40 dark:text-emerald-100",
};

const USER_TYPE_LABEL = {
  trabalhador: "Trabalhador",
  empresa: "Empresa",
  apoiador: "Especialista",
};

/* O filtro de "plano" exposto na UI mistura tipo de usuário com plano,
   conforme requisitos. Resolvemos isso no cliente. */
const PLAN_FILTER_OPTIONS = [
  { value: "todos", label: "Todos os planos" },
  { value: "free", label: "Free (Gratuito)" },
  { value: "premium_trabalhador", label: "Premium — Trabalhador" },
  { value: "premium_empresa", label: "Premium — Empresa" },
];

const APPROVAL_FILTER_OPTIONS = [
  { value: "todos", label: "Todos os status" },
  { value: "approved", label: "Ativos" },
  { value: "incomplete", label: "Incompletos" },
  { value: "rejected", label: "Removidos" },
];

const TYPE_FILTER_OPTIONS = [
  { value: "todos", label: "Todos os tipos" },
  { value: "trabalhador", label: "Usuários" },
  { value: "apoiador", label: "Especialistas" },
  { value: "empresa", label: "Empresas" },
];

const PAGE_SIZE = 25;

function getAdminUid() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return (
      profile?.uid || profile?.id || profile?.profileId || ""
    )
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatMonthLabel(yyyymm) {
  const [y, m] = String(yyyymm || "").split("-");
  if (!y || !m) return yyyymm || "";
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return yyyymm;
  return `${months[idx]}/${y.slice(2)}`;
}

/* ──────────────────────────────────────────────
   MetricCard
   ────────────────────────────────────────────── */
function MetricCard({ label, value, hint, accent }) {
  const accentCls =
    {
      blue: "from-blue-500 to-blue-600",
      emerald: "from-emerald-500 to-emerald-600",
      red: "from-red-500 to-red-600",
      amber: "from-amber-500 to-amber-600",
      slate: "from-slate-500 to-slate-600",
      indigo: "from-indigo-500 to-indigo-600",
    }[accent || "slate"] || "from-slate-500 to-slate-600";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${accentCls}`} />
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
          {value}
        </p>
        {hint && (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   AdminGrowthDashboard
   ════════════════════════════════════════════════ */
function AdminGrowthDashboard({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);
  const adminUid = useMemo(() => getAdminUid(), []);

  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  /* ── Métricas e gráfico ── */
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=growth-stats"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: adminUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao carregar métricas.");
      setStats(data);
    } catch (err) {
      setStatsError(err.message || "Erro inesperado.");
    } finally {
      setStatsLoading(false);
    }
  }, [adminUid]);

  useEffect(() => {
    if (admin) loadStats();
  }, [admin, loadStats]);

  /* ── Tabela de usuários ── */
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [cursorStack, setCursorStack] = useState([]); // Histórico para "voltar"
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);

  // Filtros
  const [approvalFilter, setApprovalFilter] = useState("todos");
  const [planFilter, setPlanFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const apiFilters = useMemo(() => {
    // Traduz o filtro da UI para os parâmetros que a API entende.
    let userType = "todos";
    let planStatus = "todos";
    if (planFilter === "free") planStatus = "gratuito";
    else if (planFilter === "premium_trabalhador") {
      planStatus = "premium";
      userType = "trabalhador";
    } else if (planFilter === "premium_empresa") {
      planStatus = "premium";
      userType = "empresa";
    }
    // O filtro de Tipo tem prioridade quando definido. Se conflitar com o
    // tipo implícito do filtro de Plano (premium_trabalhador/empresa),
    // prevalece a seleção explícita do admin no filtro de Tipo.
    if (typeFilter !== "todos") {
      userType = typeFilter;
    }
    return { userType, planStatus, approvalStatus: approvalFilter };
  }, [approvalFilter, planFilter, typeFilter]);

  const fetchPage = useCallback(
    async ({ nextCursor = null, reset = false } = {}) => {
      if (!admin) return;
      setListLoading(true);
      setListError(null);
      try {
        const res = await fetch(buildApiUrl("/api/admin?op=users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: adminUid,
            userType: apiFilters.userType,
            planStatus: apiFilters.planStatus,
            approvalStatus: apiFilters.approvalStatus,
            search,
            pageSize: PAGE_SIZE,
            cursor: reset ? null : nextCursor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao listar usuários.");
        setItems(data.items || []);
        setCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        setListError(err.message || "Erro inesperado.");
      } finally {
        setListLoading(false);
      }
    },
    [admin, adminUid, apiFilters, search]
  );

  // Recarrega ao mudar filtros / busca.
  useEffect(() => {
    setCursorStack([]);
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFilters.userType, apiFilters.planStatus, apiFilters.approvalStatus, search]);

  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setSearch(searchInput.trim());
    },
    [searchInput]
  );

  const goNextPage = useCallback(() => {
    if (!cursor) return;
    setCursorStack((prev) => [...prev, cursor]);
    fetchPage({ nextCursor: cursor });
  }, [cursor, fetchPage]);

  const goPrevPage = useCallback(() => {
    setCursorStack((prev) => {
      if (prev.length === 0) {
        fetchPage({ reset: true });
        return prev;
      }
      const next = prev.slice(0, -1);
      const prevCursor = next.length > 0 ? next[next.length - 1] : null;
      fetchPage({ nextCursor: prevCursor, reset: prevCursor === null });
      return next;
    });
  }, [fetchPage]);

  /* ── Ações ── */
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const updateUserStatus = useCallback(
    async (user, status) => {
      setBusyId(user.id);
      try {
        const res = await fetch(buildApiUrl("/api/admin?op=update-user-status"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: adminUid,
            targetUserId: user.id,
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao atualizar.");
        // Se o admin removeu a conta, tira da lista visualmente.
        if (status === "rejected" || status === "removido") {
          setItems((prev) => prev.filter((u) => u.id !== user.id));
        } else {
          setItems((prev) =>
            prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
          );
        }
        setToast({
          type: "success",
          message:
            status === "approved"
              ? "Cadastro marcado como ativo."
              : status === "rejected"
              ? "Conta removida."
              : "Status atualizado.",
        });
        // Atualiza contadores em segundo plano.
        loadStats();
      } catch (err) {
        setToast({ type: "error", message: err.message || "Erro inesperado." });
      } finally {
        setBusyId(null);
      }
    },
    [adminUid, loadStats]
  );

  const togglePremium = useCallback(
    async (user) => {
      const isPremium =
        user.planStatus === "premium" || user.planStatus === "premium_gratuito";
      const action = isPremium ? "revoke_free_premium" : "grant_free_premium";
      setBusyId(user.id);
      try {
        const res = await fetch(buildApiUrl("/api/admin?op=update-plan"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: adminUid,
            targetUserId: user.id,
            action,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao atualizar plano.");
        setItems((prev) =>
          prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
        );
        setToast({
          type: "success",
          message: isPremium
            ? "Premium Gratuito removido."
            : "Premium Gratuito concedido.",
        });
        loadStats();
      } catch (err) {
        setToast({ type: "error", message: err.message || "Erro inesperado." });
      } finally {
        setBusyId(null);
      }
    },
    [adminUid, loadStats]
  );

  const totals = stats?.totals;
  const monthly = useMemo(
    () =>
      (stats?.monthly || []).map((m) => ({
        ...m,
        label: formatMonthLabel(m.month),
      })),
    [stats]
  );

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Crescimento da Plataforma" />
      <AdminQuickAccess />

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
        <header className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              Acompanhamento de Crescimento
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Métricas gerais de cadastros, evolução mensal e lista completa de usuários.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadStats}
              disabled={statsLoading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {statsLoading ? "Atualizando…" : "Atualizar métricas"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Painel Admin
            </button>
          </div>
        </header>

        {/* ═══ Visitas + Abandono (funil — separado dos cards de cadastros) ═══ */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-blue-300 dark:border-blue-700 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-sky-400 to-blue-600" />
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Visitas (sessões anônimas)
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                  {statsLoading
                    ? "…"
                    : stats?.anonymousVisits === null || stats?.anonymousVisits === undefined
                    ? "—"
                    : stats.anonymousVisits.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Total de sessões via <code>signInAnonymously()</code>. Não representam usuários cadastrados.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-amber-300 dark:border-amber-700 shadow-sm overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Abandonaram o Cadastro
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                  {statsLoading
                    ? "…"
                    : stats?.registrationAbandoned === null || stats?.registrationAbandoned === undefined
                    ? "—"
                    : stats.registrationAbandoned.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Entraram em <code>/pseudonym</code> e não concluíram o cadastro após 24h.
                  {stats?.registrationStarted != null && (
                    <>
                      {" "}Iniciados: <strong>{stats.registrationStarted.toLocaleString("pt-BR")}</strong>
                      {stats?.registrationCompleted != null && (
                        <> · Concluídos: <strong>{stats.registrationCompleted.toLocaleString("pt-BR")}</strong></>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Cards de métricas de cadastros ═══ */}
        <section>
          {statsError && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-sm">
              {statsError}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Total"
              value={statsLoading ? "…" : totals?.total ?? 0}
              hint="Usuários cadastrados"
              accent="blue"
            />
            <MetricCard
              label="Ativos"
              value={statsLoading ? "…" : totals?.approved ?? 0}
              accent="emerald"
            />
            <MetricCard
              label="Removidos"
              value={statsLoading ? "…" : totals?.rejected ?? 0}
              accent="red"
            />
            <MetricCard
              label="Incompletos"
              value={statsLoading ? "…" : (totals?.incomplete ?? totals?.pending) ?? 0}
              accent="amber"
            />
            <MetricCard
              label="Premium Trabalhador"
              value={statsLoading ? "…" : totals?.premiumByType?.trabalhador ?? 0}
              hint="Trabalhadores com plano Premium"
              accent="indigo"
            />
            <MetricCard
              label="Premium Empresa"
              value={statsLoading ? "…" : totals?.premiumByType?.empresa ?? 0}
              hint="Empresas com plano Premium"
              accent="indigo"
            />
          </div>
        </section>

        {/* ═══ Gráfico de crescimento ═══ */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <h2 className="text-lg font-bold mb-3">Novos cadastros por mês</h2>
          <div className="w-full h-64 sm:h-72">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Carregando gráfico…
              </div>
            ) : monthly.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Sem dados de cadastro disponíveis.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "#cbd5e1",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#1e293b", fontWeight: 600 }}
                    formatter={(value) => [`${value} cadastro(s)`, "Novos"]}
                  />
                  <Bar
                    dataKey="count"
                    name="Novos cadastros"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ═══ Filtros + Tabela ═══ */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                {APPROVAL_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Plano
              </label>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                {PLAN_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Tipo
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              >
                {TYPE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <form
              onSubmit={handleSearchSubmit}
              className="sm:col-span-2 lg:col-span-2 flex items-end gap-2"
            >
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Buscar (pseudônimo, nome, e-mail)
                </label>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Digite e pressione Enter…"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                Buscar
              </button>
            </form>
          </div>

          {listError && (
            <div className="m-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-sm">
              {listError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left p-3 font-semibold">Pseudônimo</th>
                  <th className="text-left p-3 font-semibold">Tipo</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Verificação</th>
                  <th className="text-left p-3 font-semibold">Plano</th>
                  <th className="text-left p-3 font-semibold">Cadastro</th>
                  <th className="text-right p-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {!listLoading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-slate-500 dark:text-slate-400"
                    >
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
                {items
                  // Por padrão, usuários "Removidos" (status=rejected) ficam
                  // ocultos da listagem. Só aparecem quando o admin escolhe
                  // explicitamente o filtro "Removidos" na barra superior.
                  .filter((u) => {
                    if (approvalFilter === "rejected") return true;
                    const s = (u?.approvalStatus || u?.status || "").toString().toLowerCase();
                    return s !== "rejected" && s !== "removido";
                  })
                  .map((u) => {
                  const isPremium =
                    u.planStatus === "premium" || u.planStatus === "premium_gratuito";
                  const busy = busyId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {u.pseudonym || u.name || (
                            <span className="italic text-slate-400">Sem pseudônimo</span>
                          )}
                        </div>
                        {u.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 break-all">
                            {u.email}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono break-all">
                          {u.id}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800">
                          {USER_TYPE_LABEL[u.userType] || u.userType}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            APPROVAL_BADGE[u.approvalStatus] || APPROVAL_BADGE.pending
                          }`}
                        >
                          {APPROVAL_LABEL[u.approvalStatus] || u.approvalStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <VerificationLevelBadge
                          level={u.verificationLevel || (u.verifiedByLinkedIn ? "identity" : "free")}
                          provider={u.verificationProvider || (u.verifiedByLinkedIn ? "linkedin" : null)}
                          size="md"
                        />
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            PLAN_BADGE[u.planStatus] || PLAN_BADGE.gratuito
                          }`}
                        >
                          {PLAN_LABEL[u.planStatus] || u.planStatus}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {u.approvalStatus !== "rejected" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Remover a conta de ${u.pseudonym || u.name || u.id}? O usuário não aparecerá mais como ativo.`
                                  )
                                ) {
                                  updateUserStatus(u, "rejected");
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                            >
                              Remover Conta
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => togglePremium(u)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded text-white disabled:opacity-50 ${
                              isPremium
                                ? "bg-amber-700 hover:bg-amber-800"
                                : "bg-amber-500 hover:bg-amber-600"
                            }`}
                            title={
                              isPremium
                                ? "Remover Premium Gratuito"
                                : "Promover para Premium"
                            }
                          >
                            {isPremium ? "Remover Premium" : "Promover Premium"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex-wrap gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {listLoading
                ? "Carregando…"
                : `Página ${cursorStack.length + 1} — ${items.length} usuário(s) exibido(s)`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goPrevPage}
                disabled={cursorStack.length === 0 || listLoading}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                type="button"
                onClick={goNextPage}
                disabled={!hasMore || listLoading}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          </div>
        </section>
      </main>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default AdminGrowthDashboard;
