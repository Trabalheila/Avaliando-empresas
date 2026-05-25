import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import {
  listIncomingRequests,
  markRequestRead,
  respondToRequest,
} from "../services/contactRequests";

/**
 * MyContacts — página /my-contacts
 * --------------------------------------------------------------
 * O trabalhador vê todos os pedidos de contato recebidos. Pode
 * "Responder" (envia mensagem de resposta + opcionalmente revela
 * seu e-mail) ou "Recusar".
 */
export default function MyContacts({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [activeReply, setActiveReply] = useState(null); // request id em modo resposta
  const [replyText, setReplyText] = useState("");
  const [revealEmail, setRevealEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);
  const uid = profile?.uid || profile?.id || profile?.profileId || "";

  const load = useCallback(async () => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listIncomingRequests(uid, 100);
      setItems(data);
      // Marca todos os pendentes como lidos
      await Promise.all(
        data
          .filter((r) => !r.readByWorker && r.status === "pending")
          .map((r) => markRequestRead(r.id))
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = useCallback(
    async (id) => {
      if (!replyText.trim()) {
        alert("Escreva uma resposta.");
        return;
      }
      setBusy(true);
      try {
        await respondToRequest(id, {
          accept: true,
          reply: replyText.trim(),
          revealEmail,
        });
        setActiveReply(null);
        setReplyText("");
        setRevealEmail(false);
        await load();
      } catch (err) {
        console.error(err);
        alert("Não foi possível enviar a resposta. Tente novamente.");
      } finally {
        setBusy(false);
      }
    },
    [replyText, revealEmail, load]
  );

  const handleDecline = useCallback(
    async (id) => {
      if (!window.confirm("Recusar este pedido de contato?")) return;
      setBusy(true);
      try {
        await respondToRequest(id, { accept: false });
        await load();
      } catch (err) {
        console.error(err);
        alert("Não foi possível recusar. Tente novamente.");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  if (!uid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Contatos" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-slate-600 dark:text-slate-300 text-center">
            Você precisa estar logado para ver seus pedidos de contato.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Contatos" />

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <header className="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 border border-blue-100 dark:border-slate-700">
          <h1 className="text-xl font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <span aria-hidden="true">📬</span>
            Meus Contatos
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Pedidos de contato recebidos de Especialistas Premium. Sua
            identidade real (incluindo e-mail) só é compartilhada quando você
            decide responder e marcar a opção de revelar.
          </p>
        </header>

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8 animate-pulse">
            Carregando…
          </p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">
            Você ainda não recebeu pedidos de contato.
          </p>
        ) : (
          items.map((r) => {
            const isReplying = activeReply === r.id;
            const status = r.status || "pending";
            return (
              <article
                key={r.id}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Pedido de contato
                    </p>
                    <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                      {r.fromCompanyName || "Empresa Especialista"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("pt-BR") : ""}
                    </p>
                  </div>
                  <span
                    className={
                      "text-[11px] font-bold px-2 py-0.5 rounded-full " +
                      (status === "accepted"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : status === "declined"
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                    }
                  >
                    {status === "accepted"
                      ? "Respondido"
                      : status === "declined"
                      ? "Recusado"
                      : "Pendente"}
                  </span>
                </div>

                <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                  {r.message || "(sem mensagem)"}
                </p>

                {status === "pending" && !isReplying && (
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecline(r.id)}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReply(r.id);
                        setReplyText("");
                        setRevealEmail(false);
                      }}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
                    >
                      Responder
                    </button>
                  </div>
                )}

                {isReplying && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Sua resposta
                    </label>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Escreva sua resposta para a empresa…"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={revealEmail}
                        onChange={(e) => setRevealEmail(e.target.checked)}
                      />
                      Autorizar a empresa a ver meu e-mail real para continuar a
                      conversa diretamente.
                    </label>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReply(null);
                          setReplyText("");
                        }}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(r.id)}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                      >
                        {busy ? "Enviando…" : "Enviar resposta"}
                      </button>
                    </div>
                  </div>
                )}

                {status === "accepted" && r.reply && (
                  <div className="mt-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">
                      Sua resposta
                    </p>
                    <p className="whitespace-pre-wrap">{r.reply}</p>
                    {r.revealEmail && (
                      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                        ✅ E-mail compartilhado com a empresa.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
