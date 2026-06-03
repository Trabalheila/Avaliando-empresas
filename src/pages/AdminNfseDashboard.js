// src/pages/AdminNfseDashboard.js
//
// Painel administrativo para auditar as NFS-e emitidas automaticamente pelo
// webhook do Mercado Pago. Rota: /admin/nfse
//
// Mostra as ultimas emissoes persistidas em Firestore (colecao
// `nfse_emissoes`) e permite forcar uma atualizacao do status diretamente
// na Focus NFe (botao "Atualizar status").

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { isAdmin } from "../utils/rbac";

function getAdminUid() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return (profile?.uid || profile?.id || profile?.profileId || "").toString().trim();
  } catch {
    return "";
  }
}

function fmtBRL(value) {
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function StatusBadge({ item }) {
  let label = "Pendente";
  let color = "bg-slate-200 text-slate-700";
  if (item.skipped) {
    label = `Ignorada (${item.reason || "—"})`;
    color = "bg-yellow-100 text-yellow-800";
  } else if (item.ok) {
    label = "Enviada";
    color = "bg-emerald-100 text-emerald-800";
  } else if (item.reason || item.message) {
    label = "Erro";
    color = "bg-red-100 text-red-800";
  }
  return (
    <span className={`inline-block text-[11px] font-bold uppercase px-2 py-1 rounded ${color}`}>
      {label}
    </span>
  );
}

export default function AdminNfseDashboard({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshingRef, setRefreshingRef] = useState("");

  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const uid = getAdminUid();
      if (!uid) throw new Error("UID do administrador nao encontrado no perfil.");
      const r = await fetch(`/api/admin-nfse?op=list&uid=${encodeURIComponent(uid)}&limit=100`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err?.message || "Falha ao carregar NFS-e.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  const handleRefresh = async (ref) => {
    setRefreshingRef(ref);
    try {
      const uid = getAdminUid();
      const r = await fetch("/api/admin-nfse?op=refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, ref }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      await load();
    } catch (err) {
      alert(`Falha ao atualizar status: ${err?.message || err}`);
    } finally {
      setRefreshingRef("");
    }
  };

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="NFS-e emitidas" />
      <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
              NFS-e emitidas
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Auditoria das emissoes automaticas disparadas pelo webhook do
              Mercado Pago (provedor Focus NFe).
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Carregando..." : "Recarregar lista"}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Ref (pagamento)</th>
                <th className="text-left px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Publico</th>
                <th className="text-left px-3 py-2">Empresa/Apoiador</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Ambiente</th>
                <th className="text-left px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma NFS-e registrada ainda.
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 dark:border-slate-700 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {fmtDate(it.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300 break-all">
                    {it.ref}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {fmtBRL(it.amount)}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {it.audience || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    <div className="text-xs">
                      {it.companySlug && <div>slug: {it.companySlug}</div>}
                      {it.cnpj && <div>cnpj: {it.cnpj}</div>}
                      {it.apoiadorId && <div>apoiador: {it.apoiadorId}</div>}
                      {!it.companySlug && !it.cnpj && !it.apoiadorId && "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge item={it} />
                    {it.message && (
                      <div className="mt-1 text-[11px] text-slate-500 max-w-xs break-words">
                        {it.message}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-xs uppercase">
                    {it.env || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleRefresh(it.ref)}
                      disabled={refreshingRef === it.ref}
                      className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold disabled:opacity-60"
                    >
                      {refreshingRef === it.ref ? "Atualizando..." : "Atualizar status"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
          Os links de PDF/XML retornados pela Focus NFe ficam disponiveis no
          painel{" "}
          <a
            className="underline"
            href="https://app.focusnfe.com.br"
            target="_blank"
            rel="noopener noreferrer"
          >
            app.focusnfe.com.br
          </a>{" "}
          apos a prefeitura processar a nota. Em "Atualizar status" consultamos
          o ref na Focus NFe e gravamos o resultado mais recente.
        </p>
      </main>
    </div>
  );
}
