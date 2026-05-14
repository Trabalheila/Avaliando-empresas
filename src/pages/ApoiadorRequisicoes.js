import React, { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  limit,
} from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import { getRatingLabel } from "../data/consultationPricing";

/**
 * Painel do Apoiador — Minhas Requisições.
 *
 * Lê a coleção `consultas` (criada pelo webhook do Mercado Pago após
 * aprovação do pagamento) filtrando por `apoiadorId == meu apoiador`.
 *
 * Três abas:
 *  - Pendentes: status = "approved" (paga, aguardando contato/atendimento)
 *  - Aceitas:   status = "accepted" (apoiador confirmou que vai atender)
 *  - Histórico: status = "concluded" | "declined"
 *
 * Apoiadores Premium podem definir / atualizar o `precoConsulta` diretamente
 * nessa página caso ainda esteja vazio.
 */

function BRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value) || 0
  );
}

const TABS = [
  { id: "pending", label: "Pendentes" },
  { id: "accepted", label: "Aceitas" },
  { id: "history", label: "Histórico" },
];

function tabForStatus(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
    case "paid":
    case "pending_acceptance":
      return "pending";
    case "accepted":
    case "in_progress":
      return "accepted";
    case "concluded":
    case "declined":
    case "refunded":
    case "expired":
      return "history";
    default:
      return "pending";
  }
}

export default function ApoiadorRequisicoes({ theme, toggleTheme }) {
  const [apoiador, setApoiador] = useState(null);
  const [apoiadorId, setApoiadorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultas, setConsultas] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [precoInput, setPrecoInput] = useState("");
  const [savingPreco, setSavingPreco] = useState(false);
  const [precoMsg, setPrecoMsg] = useState("");

  /* Descobre o apoiadorId do usuário logado (via localStorage). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const id = stored?.apoiadorId || "";
        if (!id) {
          if (!cancelled) {
            setError("Você precisa estar logado como Apoiador para ver suas requisições.");
            setLoading(false);
          }
          return;
        }
        const snap = await getDoc(doc(db, "apoiadores", id));
        if (!snap.exists()) {
          if (!cancelled) {
            setError("Perfil de Apoiador não encontrado.");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setApoiadorId(id);
          setApoiador({ id, ...snap.data() });
          setPrecoInput(String(snap.data().precoConsulta || ""));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erro ao carregar perfil.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Carrega consultas associadas ao apoiador. */
  useEffect(() => {
    if (!apoiadorId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        // Tenta com orderBy; se faltar índice, faz fallback sem ordenação.
        let docs = [];
        try {
          const q1 = query(
            collection(db, "consultas"),
            where("apoiadorId", "==", apoiadorId),
            orderBy("createdAt", "desc"),
            limit(200)
          );
          const snap = await getDocs(q1);
          docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch {
          const q2 = query(
            collection(db, "consultas"),
            where("apoiadorId", "==", apoiadorId),
            limit(200)
          );
          const snap = await getDocs(q2);
          docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        if (!cancelled) {
          setConsultas(docs);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erro ao carregar requisições.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  const isPremium = String(apoiador?.plano || "").toLowerCase() === "premium";
  const precoConsulta = Number(apoiador?.precoConsulta) || 0;
  const precisaDefinirPreco = isPremium && !(precoConsulta > 0);

  const filtered = useMemo(
    () => consultas.filter((c) => tabForStatus(c.status) === activeTab),
    [consultas, activeTab]
  );

  const counts = useMemo(() => {
    const out = { pending: 0, accepted: 0, history: 0 };
    consultas.forEach((c) => {
      const t = tabForStatus(c.status);
      out[t] = (out[t] || 0) + 1;
    });
    return out;
  }, [consultas]);

  /* Marca como lida ao abrir a aba (best-effort). */
  useEffect(() => {
    if (!consultas.length) return;
    const unread = consultas.filter(
      (c) => tabForStatus(c.status) === activeTab && c.readByApoiador === false
    );
    if (unread.length === 0) return;
    Promise.all(
      unread.map((c) =>
        updateDoc(doc(db, "consultas", c.id), { readByApoiador: true }).catch(() => {})
      )
    );
  }, [activeTab, consultas]);

  async function handleSavePreco() {
    const value = Number(String(precoInput).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setPrecoMsg("Informe um valor numérico maior que zero.");
      return;
    }
    setSavingPreco(true);
    setPrecoMsg("");
    try {
      await updateDoc(doc(db, "apoiadores", apoiadorId), { precoConsulta: value });
      setApoiador((prev) => (prev ? { ...prev, precoConsulta: value } : prev));
      setPrecoMsg("Preço atualizado com sucesso.");
    } catch (err) {
      setPrecoMsg(err?.message || "Erro ao salvar preço.");
    } finally {
      setSavingPreco(false);
    }
  }

  async function handleStatusChange(consultaId, nextStatus) {
    try {
      await updateDoc(doc(db, "consultas", consultaId), { status: nextStatus });
      setConsultas((prev) =>
        prev.map((c) => (c.id === consultaId ? { ...c, status: nextStatus } : c))
      );
    } catch (err) {
      setError(err?.message || "Erro ao atualizar requisição.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
          Minhas Requisições
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Requisições de consulta que chegaram pelo Trabalhei Lá.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Aviso de preço (Apoiador Premium sem precoConsulta) */}
        {precisaDefinirPreco && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
              Defina seu preço de consulta para aparecer nas buscas.
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Apoiadores Premium definem o próprio valor. Sem esse campo preenchido,
              seu perfil não exibe botão "Solicitar consulta" para potenciais clientes.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">R$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={precoInput}
                onChange={(e) => setPrecoInput(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleSavePreco}
                disabled={savingPreco}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {savingPreco ? "Salvando…" : "Salvar preço"}
              </button>
              {precoMsg && (
                <span className="text-xs text-slate-600 dark:text-slate-300">{precoMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={
                "px-4 py-2 -mb-px text-sm font-bold border-b-2 transition " +
                (activeTab === t.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")
              }
            >
              {t.label}
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {counts[t.id] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            Carregando…
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma requisição nesta aba.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const valor = isPremium ? precoConsulta || c.amount : c.amount;
              return (
                <li
                  key={c.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                        {c.requesterAudience === "employer" ? "Empresa" : "Trabalhador"}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {c.especialidade || "Consulta intermediada"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {c.createdAt?.toDate
                          ? c.createdAt.toDate().toLocaleString("pt-BR")
                          : ""}
                      </p>
                      {c.tipoAtendimento && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Formato: <strong>{c.tipoAtendimento}</strong>
                        </p>
                      )}
                      {c.mensagem && (
                        <p className="text-sm text-slate-700 dark:text-slate-200 mt-2 italic">
                          “{c.mensagem}”
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                        {BRL(valor)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Plataforma:{" "}
                        {BRL(Number(c.marketplaceFee) || 0)} (
                        {c.tier === "premium" ? "12,5%" : "10%"})
                      </p>
                      <p className="text-[11px] mt-1 font-semibold text-blue-600 dark:text-blue-400">
                        {(c.status || "approved").replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  {activeTab === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(c.id, "accepted")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(c.id, "declined")}
                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                  {activeTab === "accepted" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(c.id, "concluded")}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        Marcar como concluída
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

// Evita warning de variável não utilizada em ambientes que linkam auth.
void auth;
