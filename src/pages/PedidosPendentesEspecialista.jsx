import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import AppHeader from "../components/AppHeader";
import {
  listIncomingApoiadorRequests,
  markApoiadorRequestRead,
  respondToApoiadorRequest,
} from "../services/contactRequests";

/**
 * PedidosPendentesEspecialista
 * --------------------------------------------------------------
 * Página dedicada onde o especialista visualiza e responde aos
 * pedidos de contato PENDENTES endereçados a ele. Acessível pelo
 * card "Pedidos pendentes" da dashboard (/apoiador/my-contacts) e
 * pela rota /especialista/pedidos-pendentes.
 *
 * Reutiliza a lógica existente de `services/contactRequests`:
 *   - listIncomingApoiadorRequests → busca os pedidos do especialista.
 *   - respondToApoiadorRequest      → aceita/recusa o pedido.
 *   - markApoiadorRequestRead       → marca como lido ao abrir.
 */
export default function PedidosPendentesEspecialista({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [activeReply, setActiveReply] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [revealEmail, setRevealEmail] = useState(false);

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);
  const apoiadorId = profile?.apoiadorId || profile?.uid || profile?.id || "";

  const load = useCallback(async () => {
    if (!apoiadorId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const authUid = auth.currentUser?.uid || profile?.uid || "";
      const data = await listIncomingApoiadorRequests(apoiadorId, 100, authUid);
      // Somente pedidos pendentes.
      const pending = data.filter((r) => (r.status || "pending") === "pending");
      setItems(pending);
      // Marca os não lidos como lidos (best-effort).
      await Promise.all(
        pending
          .filter((r) => !r.readByApoiador)
          .map((r) => markApoiadorRequestRead(r.id))
      );
    } finally {
      setLoading(false);
    }
  }, [apoiadorId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = useCallback(
    async (id) => {
      setBusyId(id);
      try {
        await respondToApoiadorRequest(id, {
          accept: true,
          reply:
            replyText.trim() ||
            "Olá! Aceito seu pedido de contato e retornarei em breve.",
          revealEmail,
        });
        setActiveReply(null);
        setReplyText("");
        setRevealEmail(false);
        // Remove da lista de pendentes localmente (a contagem na dashboard é
        // recalculada quando ela recarrega — ver load() do dashboard).
        setItems((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        console.error(err);
        alert("Não foi possível aceitar o pedido. Tente novamente.");
      } finally {
        setBusyId("");
      }
    },
    [replyText, revealEmail]
  );

  const handleDecline = useCallback(async (id) => {
    if (!window.confirm("Recusar este pedido de contato?")) return;
    setBusyId(id);
    try {
      await respondToApoiadorRequest(id, { accept: false });
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
      alert("Não foi possível recusar o pedido. Tente novamente.");
    } finally {
      setBusyId("");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Pedidos Pendentes" />

      <div className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/apoiador/my-contacts")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-200 hover:underline"
          >
            <span aria-hidden="true">←</span> Voltar à dashboard
          </button>
          {!loading && (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {items.length} pendente{items.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <header className="bg-white dark:bg-slate-900 rounded-2xl shadow p-4 sm:p-5 border border-blue-100 dark:border-slate-700">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-50 flex items-center gap-2">
            <span aria-hidden="true">📬</span> Pedidos Pendentes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aceite ou recuse os pedidos de contato endereçados a você.
          </p>
        </header>

        {!apoiadorId ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-8 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Você precisa estar logado como Especialista para ver seus pedidos.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-4 px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Entrar
            </button>
          </div>
        ) : loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-12 animate-pulse">
            Carregando pedidos…
          </p>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-10 text-center">
            <p className="text-4xl mb-2" aria-hidden="true">
              🎉
            </p>
            <p className="text-slate-600 dark:text-slate-300 font-semibold">
              Nenhum pedido pendente no momento.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Você está em dia com suas solicitações de contato.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => {
              const isReplying = activeReply === r.id;
              const isBusy = busyId === r.id;
              const isAdExitum = r.kind === "adExitum";
              const requesterName =
                r.fromCompanyName ||
                r.fromName ||
                r.fromPseudonym ||
                "Solicitante";
              return (
                <article
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {isAdExitum ? "Pedido Ad Exitum" : "Pedido de contato"}
                      </p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {requesterName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleString("pt-BR")
                          : ""}
                      </p>
                    </div>
                    <span
                      className={
                        "text-[11px] font-bold px-2 py-0.5 rounded-full " +
                        (isAdExitum
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                      }
                    >
                      {isAdExitum ? "Ad Exitum" : "Pendente"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                    {r.message || "(sem mensagem)"}
                  </p>

                  {!isReplying ? (
                    <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecline(r.id)}
                        disabled={isBusy}
                        className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 min-h-[44px]"
                      >
                        {isBusy ? "…" : "Recusar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReply(r.id);
                          setReplyText("");
                          setRevealEmail(false);
                        }}
                        disabled={isBusy}
                        className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 min-h-[44px]"
                      >
                        Aceitar
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                        Mensagem de resposta (opcional)
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="Escreva uma mensagem para o solicitante…"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={revealEmail}
                          onChange={(e) => setRevealEmail(e.target.checked)}
                        />
                        Autorizar o solicitante a ver meu e-mail/contato direto.
                      </label>
                      <div className="mt-3 flex flex-col sm:flex-row sm:justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveReply(null);
                            setReplyText("");
                          }}
                          disabled={isBusy}
                          className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-50 min-h-[44px]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAccept(r.id)}
                          disabled={isBusy}
                          className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 min-h-[44px]"
                        >
                          {isBusy ? "Enviando…" : "Confirmar aceite"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
