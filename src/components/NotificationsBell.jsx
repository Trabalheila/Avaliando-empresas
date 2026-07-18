import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  listIncomingRequests,
  listIncomingApoiadorRequests,
  listAcceptedAdExitumForWorker,
  markRequestRead,
  markApoiadorRequestRead,
} from "../services/contactRequests";
import { listConversationsForParticipant } from "../services/chat";
import { listNotificationsForUser, markNotificationRead } from "../services/notifications";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";

/* Estado "lido" mantido no localStorage (sem escrita no Firestore). */
const SEEN_MSG_KEY = "tl_notif_seen_messages"; // { [conversationId]: ISO }
const SEEN_AE_KEY = "tl_notif_seen_adexitum"; // [requestId]

function readSeenMap(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function readSeenList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeSeen(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/privado: silencioso */
  }
}

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
  const [authUid, setAuthUid] = useState(auth.currentUser?.uid || "");

  /* UID do Firebase Auth — usado para ler conversas (participants são UIDs). */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAuthUid(u?.uid || ""));
    return () => unsub();
  }, []);

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
    if (!uid && !apoiadorId && !authUid) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const [worker, apoiador, consultas, adExitumAccepted, conversations, activity] =
        await Promise.all([
          uid ? listIncomingRequests(uid, 30) : Promise.resolve([]),
          apoiadorId
            ? listIncomingApoiadorRequests(apoiadorId, 30)
            : Promise.resolve([]),
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
          // Pedidos Ad Exitum que o especialista ACEITOU (trabalhador é o
          // solicitante = fromUid). Relevante apenas para trabalhadores.
          authUid || uid
            ? listAcceptedAdExitumForWorker(authUid || uid, 30)
            : Promise.resolve([]),
          // Novas mensagens recebidas no chat (qualquer conversa em que o
          // usuário é participante e a última mensagem veio do OUTRO lado).
          authUid
            ? listConversationsForParticipant(authUid, 30)
            : Promise.resolve([]),
          // Atividades nos comentários do usuário (reações/respostas).
          authUid || uid
            ? listNotificationsForUser(authUid || uid, 30)
            : Promise.resolve([]),
        ]);

      const seenMsg = readSeenMap(SEEN_MSG_KEY);
      const seenAe = readSeenList(SEEN_AE_KEY);

      const messageItems = conversations
        .filter((c) => {
          const last = c.lastMessage;
          if (!last || !last.senderUid) return false;
          return last.senderUid !== authUid; // só mensagens do interlocutor
        })
        .map((c) => ({
          ...c,
          _kind: "message",
          createdAt: c.lastMessage?.createdAt || c.updatedAt || "",
        }));

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
        ...adExitumAccepted.map((r) => ({
          ...r,
          _kind: "adExitumAccepted",
          createdAt: r.respondedAt || r.createdAt || "",
          _unread: !seenAe.includes(r.id),
        })),
        ...messageItems.map((r) => ({
          ...r,
          _unread:
            String(r.lastMessage?.createdAt || "") >
            String(seenMsg[r.id] || ""),
        })),
        ...activity.map((r) => ({
          ...r,
          _kind: "activity",
          createdAt:
            r.createdAt?.toDate?.()?.toISOString?.() ||
            r.createdAt ||
            "",
          _unread: r.read === false,
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
  }, [uid, apoiadorId, authUid]);

  useEffect(() => {
    if (uid || apoiadorId || authUid) load();
  }, [uid, apoiadorId, authUid, load]);

  /* Polling leve a cada 60s enquanto a aba está visível */
  useEffect(() => {
    if (!uid && !apoiadorId && !authUid) return undefined;
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) {
        load();
      }
    }, 60000);
    return () => clearInterval(id);
  }, [uid, apoiadorId, authUid, load]);

  /* Marca as notificações já exibidas como vistas, para não voltarem a
     aparecer como "novas" a cada login. O estado de leitura é persistido
     no Firestore (pedidos/atividades) ou no localStorage (mensagens e
     Ad Exitum), conforme cada tipo. */
  const markVisibleSeen = useCallback((list) => {
    if (!Array.isArray(list) || list.length === 0) return;

    const seenMsg = readSeenMap(SEEN_MSG_KEY);
    const seenAe = readSeenList(SEEN_AE_KEY);
    let seenMsgChanged = false;
    let seenAeChanged = false;
    const activityIds = [];
    const workerIds = [];
    const apoiadorIds = [];

    list.forEach((it) => {
      if (it._kind === "activity" && it.read === false) {
        activityIds.push(it.id);
      } else if (it._kind === "message" && it._unread) {
        seenMsg[it.id] = it.lastMessage?.createdAt || new Date().toISOString();
        seenMsgChanged = true;
      } else if (it._kind === "adExitumAccepted" && it._unread) {
        if (!seenAe.includes(it.id)) {
          seenAe.push(it.id);
          seenAeChanged = true;
        }
      } else if (it._kind === "worker" && it.status === "pending" && !it.readByWorker) {
        workerIds.push(it.id);
      } else if (it._kind === "apoiador" && it.status === "pending" && !it.readByApoiador) {
        apoiadorIds.push(it.id);
      }
    });

    if (seenMsgChanged) writeSeen(SEEN_MSG_KEY, seenMsg);
    if (seenAeChanged) writeSeen(SEEN_AE_KEY, seenAe);
    activityIds.forEach((id) => markNotificationRead(id).catch(() => {}));
    workerIds.forEach((id) => markRequestRead(id).catch(() => {}));
    apoiadorIds.forEach((id) => markApoiadorRequestRead(id).catch(() => {}));

    if (
      activityIds.length ||
      workerIds.length ||
      apoiadorIds.length ||
      seenMsgChanged ||
      seenAeChanged
    ) {
      setItems((prev) =>
        prev.map((it) => {
          if (it._kind === "activity" && activityIds.includes(it.id)) {
            return { ...it, read: true, _unread: false };
          }
          if (it._kind === "message" && it._unread) return { ...it, _unread: false };
          if (it._kind === "adExitumAccepted" && it._unread) return { ...it, _unread: false };
          if (it._kind === "worker" && workerIds.includes(it.id)) {
            return { ...it, readByWorker: true };
          }
          if (it._kind === "apoiador" && apoiadorIds.includes(it.id)) {
            return { ...it, readByApoiador: true };
          }
          return it;
        })
      );
    }
  }, []);

  /* Ao abrir o sininho (após carregar), marca as notificações visíveis como
     vistas — uma única vez por abertura. */
  const markedForOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      markedForOpenRef.current = false;
      return;
    }
    if (!loading && !markedForOpenRef.current && items.length > 0) {
      markedForOpenRef.current = true;
      markVisibleSeen(items);
    }
  }, [open, loading, items, markVisibleSeen]);

  const unreadCount = items.filter((r) => {
    if (r._kind === "consulta") return r.status === "pending" && r.readByApoiador === false;
    if (r._kind === "adExitumAccepted" || r._kind === "message" || r._kind === "activity") return Boolean(r._unread);
    if (r.status !== "pending") return false;
    return r._kind === "apoiador" ? !r.readByApoiador : !r.readByWorker;
  }).length;

  if (!uid && !apoiadorId && !authUid) return null;

  /* Monta a rota do chat para uma conversa em que o usuário participa. */
  const buildChatHref = (conv) => {
    const convId = conv.id || conv.conversationId;
    if (!convId) return "";
    const iAmWorker = authUid && conv.workerId === authUid;
    const otherUid = iAmWorker ? conv.specialistId : conv.workerId;
    const peerName =
      (conv.peerNames && otherUid && conv.peerNames[otherUid]) ||
      (iAmWorker ? "Especialista" : "Trabalhador");
    const params = new URLSearchParams({
      peer: peerName,
      peerRole: iAmWorker ? "especialista" : "trabalhador",
    });
    if (conv.kind === "adExitum") params.set("adExitum", "1");
    return `/chat/${encodeURIComponent(convId)}?${params.toString()}`;
  };

  /* Navega para o destino do item e marca como lido (estado local). */
  const handleItemClick = (r) => {
    setOpen(false);
    if (r._kind === "activity") {
      // Marca como lida no Firestore e localmente, depois navega ao destino.
      markNotificationRead(r.id).catch(() => {});
      setItems((prev) =>
        prev.map((it) =>
          it._kind === "activity" && it.id === r.id
            ? { ...it, _unread: false, read: true }
            : it
        )
      );
      if (r.link) navigate(r.link);
      return;
    }
    if (r._kind === "message") {
      const seen = readSeenMap(SEEN_MSG_KEY);
      seen[r.id] = r.lastMessage?.createdAt || new Date().toISOString();
      writeSeen(SEEN_MSG_KEY, seen);
      setItems((prev) =>
        prev.map((it) =>
          it._kind === "message" && it.id === r.id
            ? { ...it, _unread: false }
            : it
        )
      );
      const href = buildChatHref(r);
      if (href) navigate(href);
      return;
    }
    if (r._kind === "adExitumAccepted") {
      const seen = readSeenList(SEEN_AE_KEY);
      if (!seen.includes(r.id)) writeSeen(SEEN_AE_KEY, [...seen, r.id]);
      setItems((prev) =>
        prev.map((it) =>
          it._kind === "adExitumAccepted" && it.id === r.id
            ? { ...it, _unread: false }
            : it
        )
      );
      const convId =
        r.conversationId ||
        (authUid ? `spec_${r.toApoiadorId}__u_${authUid}` : "");
      if (convId) {
        const params = new URLSearchParams({
          peer: r.toApoiadorName || "Especialista",
          peerRole: "especialista",
          adExitum: "1",
        });
        navigate(`/chat/${encodeURIComponent(convId)}?${params.toString()}`);
      } else {
        navigate("/minha-conta");
      }
      return;
    }
    const target =
      r._kind === "consulta"
        ? "/apoiador/requisicoes"
        : r._kind === "apoiador"
        ? "/apoiador/my-contacts"
        : "/my-contacts";
    navigate(target);
  };

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
          <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-[60] py-1">
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
                  let unread;
                  let title;
                  let desc;
                  if (r._kind === "message") {
                    unread = Boolean(r._unread);
                    const fromName =
                      (r.peerNames && r.lastMessage?.senderUid
                        ? r.peerNames[r.lastMessage.senderUid]
                        : "") || "seu contato";
                    title = unread ? "💬 Nova mensagem" : "Mensagem";
                    desc = `${fromName}${
                      r.lastMessage?.attachmentName
                        ? `: 📎 ${r.lastMessage.attachmentName}`
                        : r.lastMessage?.text
                        ? `: ${r.lastMessage.text}`
                        : ""
                    }`;
                  } else if (r._kind === "activity") {
                    unread = Boolean(r._unread);
                    const isReply = r.type === "reply";
                    title = unread
                      ? isReply
                        ? "💬 Responderam seu comentário"
                        : "👍 Reação no seu comentário"
                      : isReply
                      ? "Resposta ao seu comentário"
                      : "Reação no seu comentário";
                    desc =
                      r.message ||
                      "Toque para ver a atividade no seu comentário.";
                  } else if (r._kind === "adExitumAccepted") {
                    unread = Boolean(r._unread);
                    title = unread
                      ? "✅ Pedido Ad Exitum aceito"
                      : "Pedido Ad Exitum aceito";
                    desc = `${
                      r.toApoiadorName || "O especialista"
                    } aceitou seu pedido. Toque para abrir o chat.`;
                  } else if (r._kind === "consulta") {
                    unread = r.status === "pending" && r.readByApoiador === false;
                    title = unread
                      ? "📅 Nova requisição de consulta"
                      : "Requisição de consulta";
                    desc = `${
                      r.requesterAudience === "employer"
                        ? "Empresa"
                        : "Trabalhador"
                    } • ${r.especialidade || "consulta intermediada"}`;
                  } else {
                    unread =
                      r.status === "pending" &&
                      (r._kind === "apoiador" ? !r.readByApoiador : !r.readByWorker);
                    title = unread
                      ? "📩 Novo pedido de contato"
                      : "Pedido de contato";
                    desc = "Você recebeu um pedido de contato. Clique para ver.";
                  }
                  return (
                    <li key={`${r._kind}-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(r)}
                        className={
                          "w-full text-left px-4 py-2 transition border-l-4 " +
                          (unread
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-700")
                        }
                      >
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
                          {title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 break-words line-clamp-2">
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
