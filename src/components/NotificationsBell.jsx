import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  listIncomingRequests,
  listIncomingApoiadorRequests,
} from "../services/contactRequests";
import { db } from "../firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

/**
 * NotificationsBell
 * --------------------------------------------------------------
 * Sininho exibido no AppHeader. Mostra:
 *   • pedidos de contato recebidos por TRABALHADORES (de empresas
 *     Apoiadoras Premium)
 *   • pedidos de contato recebidos por APOIADORES Premium (de
 *     empresas Premium)
 * Ao clicar em um item, navega para a página correspondente
 * (/my-contacts ou /apoiador/my-contacts).
 */
export default function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [profileInfo, setProfileInfo] = useState({ uid: "", apoiadorId: "" });

  /* Detecta UID do usuário logado a partir do localStorage */
  useEffect(() => {
    function read() {
      try {
        const p = JSON.parse(localStorage.getItem("userProfile") || "{}");
        return {
          uid: p?.uid || p?.id || p?.profileId || "",
          apoiadorId: p?.apoiadorId || "",
        };
      } catch {
        return { uid: "", apoiadorId: "" };
      }
    }
    setProfileInfo(read());
    const handler = () => setProfileInfo(read());
    window.addEventListener("trabalheiLa_user_updated", handler);
    return () => window.removeEventListener("trabalheiLa_user_updated", handler);
  }, []);

  const { uid, apoiadorId } = profileInfo;

  /* Carrega notificações */
  const load = useCallback(async () => {
    if (!uid && !apoiadorId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const [worker, apoiador, consultas] = await Promise.all([
        uid ? listIncomingRequests(uid, 30) : Promise.resolve([]),
        apoiadorId ? listIncomingApoiadorRequests(apoiadorId, 30) : Promise.resolve([]),
        apoiadorId
          ? (async () => {
              try {
                const q = query(
                  collection(db, "consultas"),
                  where("apoiadorId", "==", apoiadorId),
                  limit(30)
                );
                const snap = await getDocs(q);
                return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              } catch {
                return [];
              }
            })()
          : Promise.resolve([]),
      ]);
      const combined = [
        ...worker.map((r) => ({ ...r, _kind: "worker" })),
        ...apoiador.map((r) => ({ ...r, _kind: "apoiador" })),
        ...consultas.map((r) => ({
          ...r,
          _kind: "consulta",
          createdAt:
            r.createdAt?.toDate?.()?.toISOString?.() ||
            r.createdAt ||
            new Date().toISOString(),
          status: (["approved", "paid"].includes((r.status || "").toLowerCase()))
            ? "pending"
            : r.status,
        })),
      ].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      setItems(combined);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, [uid, apoiadorId]);

  useEffect(() => {
    if (uid || apoiadorId) load();
  }, [uid, apoiadorId, load]);

  /* Polling leve a cada 60s enquanto a aba está visível */
  useEffect(() => {
    if (!uid && !apoiadorId) return undefined;
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        load();
      }
    }, 60000);
    return () => clearInterval(id);
  }, [uid, apoiadorId, load]);

  const unreadCount = items.filter((r) => {
    if (r._kind === "consulta") return r.status === "pending" && r.readByApoiador === false;
    if (r.status !== "pending") return false;
    return r._kind === "apoiador" ? !r.readByApoiador : !r.readByWorker;
  }).length;

  if (!uid && !apoiadorId) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        title="Notificações"
        aria-label="Notificações"
        className="relative px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 text-sm inline-flex items-center"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
            aria-label={`${unreadCount} não lidas`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay para fechar ao clicar fora */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 55 }}
          />
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-[60] py-1">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                Notificações
              </span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(apoiadorId ? "/apoiador/my-contacts" : "/my-contacts");
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Ver todas
              </button>
            </div>

            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500 animate-pulse">
                Carregando…
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Nenhuma notificação no momento.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto">
                {items.slice(0, 8).map((r) => {
                  const unread =
                    r._kind === "consulta"
                      ? r.status === "pending" && r.readByApoiador === false
                      : r.status === "pending" &&
                        (r._kind === "apoiador" ? !r.readByApoiador : !r.readByWorker);
                  const target =
                    r._kind === "consulta"
                      ? "/apoiador/requisicoes"
                      : r._kind === "apoiador"
                      ? "/apoiador/my-contacts"
                      : "/my-contacts";
                  const title =
                    r._kind === "consulta"
                      ? unread
                        ? "📅 Nova requisição de consulta"
                        : "Requisição de consulta"
                      : unread
                      ? "📩 Novo pedido de contato"
                      : "Pedido de contato";
                  const desc =
                    r._kind === "consulta"
                      ? `${r.requesterAudience === "employer" ? "Empresa" : "Trabalhador"} • ${r.especialidade || "consulta intermediada"}`
                      : "Você recebeu um pedido de contato. Clique para ver.";
                  return (
                    <li key={`${r._kind}-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(target);
                        }}
                        className={
                          "w-full text-left px-4 py-2 transition border-l-4 " +
                          (unread
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-700")
                        }
                      >
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {desc}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
