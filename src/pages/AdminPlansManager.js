import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAdmin } from "../utils/rbac";
import { buildApiUrl } from "../utils/apiBase";
import AppHeader from "../components/AppHeader";
import AdminQuickAccess from "../components/AdminQuickAccess";

const USER_TYPE_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "trabalhador", label: "Trabalhador" },
  { value: "empresa", label: "Empresa" },
  { value: "apoiador", label: "Especialista" },
];

const PLAN_STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "gratuito", label: "Gratuito" },
  { value: "premium", label: "Premium" },
  { value: "premium_gratuito", label: "Premium Gratuito" },
];

const PLAN_LABEL = {
  gratuito: "Gratuito",
  premium: "Premium",
  premium_gratuito: "Premium Gratuito",
};

const PLAN_BADGE = {
  gratuito: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  premium: "bg-amber-200 text-amber-900 dark:bg-amber-700/40 dark:text-amber-100",
  premium_gratuito:
    "bg-emerald-200 text-emerald-900 dark:bg-emerald-700/40 dark:text-emerald-100",
};

const USER_TYPE_LABEL = {
  trabalhador: "Trabalhador",
  empresa: "Empresa",
  apoiador: "Especialista",
};

function getAdminUid() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return (profile?.uid || profile?.id || profile?.profileId || "").toString().trim();
  } catch {
    return "";
  }
}

function ConfirmModal({ open, title, message, confirmLabel, onConfirm, onCancel, busy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-5 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Processando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPlansManager({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);
  const adminUid = useMemo(() => getAdminUid(), []);

  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros
  const [userType, setUserType] = useState("todos");
  const [planStatus, setPlanStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [confirm, setConfirm] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchPage = useCallback(
    async ({ reset = false } = {}) => {
      if (!admin) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildApiUrl("/api/admin?op=users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: adminUid,
            userType,
            planStatus,
            search,
            pageSize: 50,
            cursor: reset ? null : cursor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Falha ao carregar usuários.");
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        setError(err.message || "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    },
    [admin, adminUid, userType, planStatus, search, cursor]
  );

  // Recarrega a lista quando filtros mudam.
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, planStatus, search]);

  const handleSearchSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setSearch(searchInput.trim());
    },
    [searchInput]
  );

  const requestPlanChange = useCallback((user, action) => {
    const isGrant = action === "grant_free_premium";
    setConfirm({
      user,
      action,
      title: isGrant ? "Conceder Premium Gratuito" : "Remover Premium Gratuito",
      message: isGrant
        ? `Confirmar concessão de Premium Gratuito para "${user.name || user.id}"?\n\nO usuário passará a ter acesso aos recursos Premium sem custo.`
        : `Confirmar remoção do Premium Gratuito de "${user.name || user.id}"?\n\nO usuário voltará para o plano Gratuito.`,
      confirmLabel: isGrant ? "Conceder" : "Remover",
    });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirm) return;
    setActionBusy(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=update-plan"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: adminUid,
          targetUserId: confirm.user.id,
          action: confirm.action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao atualizar o plano.");
      setItems((prev) =>
        prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
      );
      setToast({
        type: "success",
        message:
          confirm.action === "grant_free_premium"
            ? "Premium Gratuito concedido com sucesso."
            : "Premium Gratuito removido com sucesso.",
      });
      setConfirm(null);
    } catch (err) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setActionBusy(false);
    }
  }, [confirm, adminUid]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <AdminQuickAccess />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">Gerenciar Planos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Conceda ou remova acesso Premium Gratuito para trabalhadores, empresas e especialistas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            ← Painel Admin
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Tipo de Usuário
            </label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              {USER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Status do Plano
            </label>
            <select
              value={planStatus}
              onChange={(e) => setPlanStatus(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              {PLAN_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <form onSubmit={handleSearchSubmit} className="md:col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Buscar (pseudônimo, nome, e-mail)
              </label>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Digite e pressione Enter..."
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              Buscar
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Tabela */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left p-3 font-semibold">Usuário</th>
                  <th className="text-left p-3 font-semibold">Tipo</th>
                  <th className="text-left p-3 font-semibold">Plano</th>
                  <th className="text-right p-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 dark:text-slate-400">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
                {items.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="p-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {u.name || <span className="italic text-slate-400">Sem nome</span>}
                      </div>
                      {u.email && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                      )}
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{u.id}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800">
                        {USER_TYPE_LABEL[u.userType] || u.userType}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${PLAN_BADGE[u.planStatus] || PLAN_BADGE.gratuito}`}>
                        {PLAN_LABEL[u.planStatus] || u.planStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {u.planStatus === "premium_gratuito" ? (
                        <button
                          type="button"
                          onClick={() => requestPlanChange(u, "revoke_free_premium")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900/40 dark:hover:bg-red-900/60 dark:text-red-200"
                        >
                          Remover Premium Gratuito
                        </button>
                      ) : u.planStatus === "premium" ? (
                        <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Plano pago — não alterável aqui
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestPlanChange(u, "grant_free_premium")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:hover:bg-emerald-900/60 dark:text-emerald-200"
                        >
                          Conceder Premium Gratuito
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {loading
                ? "Carregando..."
                : `${items.length} usuário(s) carregado(s)${hasMore ? " (mais disponíveis)" : ""}`}
            </span>
            <button
              type="button"
              onClick={() => fetchPage({ reset: false })}
              disabled={!hasMore || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Carregar mais
            </button>
          </div>
        </div>
      </main>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Confirmar"}
        onConfirm={handleConfirmAction}
        onCancel={() => (actionBusy ? null : setConfirm(null))}
        busy={actionBusy}
      />

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

export default AdminPlansManager;
