// src/components/Chat/PlatformChat.js
//
// Chat interno da plataforma para comunicação trabalhador × especialista.
// Rota: /chat/:conversationId
//
// MVP: mensagens persistidas em localStorage por conversationId
// (chave `chatMessages:<id>`). A interface já está pronta para receber
// um backend Firestore (subcoleção /conversations/{id}/messages) sem
// mudanças visuais.
//
// Regras por plano:
//  - Essencial (padrão): bloqueia mensagens com email/telefone/link
//    externo (regex) e limita ESSENCIAL_MESSAGE_LIMIT mensagens por
//    conversa para o usuário do lado Essencial.
//  - Premium: sem restrições; pode anexar arquivos (upload mockado:
//    converte para dataURL e referencia no chat).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import AppHeader from "../AppHeader";
import {
  detectContactInfo,
  CONTACT_BLOCK_MESSAGE,
  ESSENCIAL_MESSAGE_LIMIT,
} from "../../utils/chatContentGuard";
import { auth, storage } from "../../firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { isAdExitumAccepted } from "../../services/contactRequests";
import {
  ensureConversation,
  sendChatMessage,
  subscribeToMessages,
} from "../../services/chat";

// Limite de tamanho para documentos no chat Ad Exitum (25 MB).
const ADEXITUM_MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Lê o userProfile do localStorage (mesmo padrão usado no app). */
function readProfile() {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
  } catch {
    return {};
  }
}

function getStorageKey(conversationId) {
  return `chatMessages:${conversationId}`;
}

function loadMessages(conversationId) {
  try {
    const raw = localStorage.getItem(getStorageKey(conversationId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveMessages(conversationId, messages) {
  try {
    localStorage.setItem(getStorageKey(conversationId), JSON.stringify(messages));
  } catch {
    /* quota / privado: silencioso */
  }
}

/** Garante pelo menos uma mensagem de boas-vindas (mock) para conversas novas. */
function seedIfEmpty(conversationId, peerName) {
  const existing = loadMessages(conversationId);
  if (existing.length > 0) return existing;
  const seeded = [
    {
      id: `sys_${Date.now()}`,
      from: "system",
      text:
        `Você iniciou uma conversa com ${peerName || "este especialista"}. ` +
        `Mensagens com email, telefone ou links externos podem ser bloqueadas no Plano Essencial.`,
      createdAt: new Date().toISOString(),
    },
  ];
  saveMessages(conversationId, seeded);
  return seeded;
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function Bubble({ msg, isMine }) {
  if (msg.from === "system") {
    return (
      <div className="mx-auto max-w-md text-center text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-3 py-1">
        {msg.text}
      </div>
    );
  }
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow",
          isMine
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm",
        ].join(" ")}
      >
        {msg.attachment ? (
          <a
            href={msg.attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            download={msg.attachment.name}
            className={isMine ? "underline" : "text-blue-700 dark:text-blue-300 underline"}
          >
            📎 {msg.attachment.name}
          </a>
        ) : (
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        )}
        <p className={`mt-1 text-[10px] ${isMine ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
          {formatTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function PlatformChat({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();

  const peerName = searchParams.get("peer") || "Contato";
  const peerRole = (searchParams.get("peerRole") || "especialista").toLowerCase();
  const caseId = searchParams.get("caseId") || "";
  // Conversa Ad Exitum: troca de documentos liberada (mesmo fora do Premium)
  // SOMENTE após o especialista aceitar o pedido de contato.
  const isAdExitum = searchParams.get("adExitum") === "1";

  const profile = useMemo(readProfile, []);
  // UID do Firebase Auth — é ele que identifica o remetente nas regras do
  // Firestore e no array `participants`. Quando há usuário autenticado, o
  // chat passa a ser persistido no Firestore (visível para os dois lados);
  // sem autenticação, mantém o fallback legado em localStorage.
  const authUid = auth.currentUser?.uid || "";
  const useFirestore = Boolean(authUid && conversationId);
  const myId = authUid || profile?.apoiadorId || profile?.uid || profile?.id || "anon";
  const myName = profile?.nome || profile?.displayName || profile?.name || "Você";
  const isPremium =
    profile?.isPremium === true ||
    String(profile?.plano || "").toLowerCase() === "premium";

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [warning, setWarning] = useState("");
  const [adExitumAccepted, setAdExitumAccepted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  // Descobre se o pedido Ad Exitum desta conversa já foi aceito.
  useEffect(() => {
    if (!isAdExitum || !conversationId) return;
    let cancelled = false;
    const uid = auth.currentUser?.uid || myId;
    isAdExitumAccepted({ conversationId, uid })
      .then((ok) => {
        if (!cancelled) setAdExitumAccepted(ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdExitum, conversationId, myId]);

  // Pode anexar documentos? Premium sempre pode; no Ad Exitum, qualquer plano
  // pode — desde que o especialista tenha aceitado o contato.
  const canAttach = isPremium || (isAdExitum && adExitumAccepted);

  // Carrega as mensagens. Com usuário autenticado, usa o Firestore em tempo
  // real (mesma conversa visível para trabalhador e especialista). Sem
  // autenticação, cai no fallback legado em localStorage.
  useEffect(() => {
    if (!conversationId) return undefined;

    if (useFirestore) {
      let unsub = () => {};
      ensureConversation({
        conversationId,
        currentUid: authUid,
        currentName: myName,
        peerName,
        peerRole,
        kind: isAdExitum ? "adExitum" : "consulta",
      })
        .catch(() => {})
        .finally(() => {
          unsub = subscribeToMessages(conversationId, (msgs) => {
            // Normaliza para o formato usado pelos balões.
            setMessages(
              msgs.map((m) => ({
                id: m.id,
                from: m.senderUid,
                fromName: m.senderName,
                text: m.text,
                attachment: m.attachment,
                createdAt: m.createdAt,
              }))
            );
          });
        });
      return () => unsub();
    }

    // Fallback legado (sem autenticação): localStorage por conversa.
    setMessages(seedIfEmpty(conversationId, peerName));
    return undefined;
  }, [conversationId, peerName, peerRole, useFirestore, authUid, myName, isAdExitum]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Quantas mensagens MINHAS já existem (para aplicar limite do Essencial).
  const myMessageCount = useMemo(
    () => messages.filter((m) => m.from === myId).length,
    [messages, myId]
  );

  const hitLimit = !isPremium && myMessageCount >= ESSENCIAL_MESSAGE_LIMIT;

  const persist = (next) => {
    setMessages(next);
    saveMessages(conversationId, next);
  };

  const handleSend = (e) => {
    e?.preventDefault?.();
    setWarning("");
    const text = draft.trim();
    if (!text) return;

    if (hitLimit) {
      setWarning(
        `Você atingiu o limite de ${ESSENCIAL_MESSAGE_LIMIT} mensagens por conversa no Plano Essencial. ` +
          `Faça upgrade para o Premium para continuar.`
      );
      return;
    }

    if (!isPremium) {
      const { hasContact, reasons } = detectContactInfo(text);
      if (hasContact) {
        setWarning(
          `${CONTACT_BLOCK_MESSAGE} (Detectado: ${reasons.join(", ")})`
        );
        return;
      }
    }

    if (useFirestore) {
      // Garante que a conversa exista (e que o usuário esteja em
      // `participants`) ANTES de gravar a mensagem — assim a regra de
      // create da subcoleção `messages` não rejeita o envio. Em seguida
      // persiste no Firestore; o listener em tempo real atualiza a lista.
      (async () => {
        try {
          await ensureConversation({
            conversationId,
            currentUid: authUid,
            currentName: myName,
            peerName,
            peerRole,
            kind: isAdExitum ? "adExitum" : "consulta",
          });
          await sendChatMessage({
            conversationId,
            senderUid: authUid,
            senderName: myName,
            text,
          });
        } catch (err) {
          console.warn("Falha ao enviar mensagem:", err);
          setWarning("Não foi possível enviar a mensagem. Tente novamente.");
        }
      })();
      setDraft("");
      return;
    }

    const next = [
      ...messages,
      {
        id: `m_${Date.now()}`,
        from: myId,
        fromName: myName,
        text,
        createdAt: new Date().toISOString(),
      },
    ];
    persist(next);
    setDraft("");
  };

  const handleAttach = (e) => {
    setWarning("");
    const file = e.target.files?.[0];
    if (!file) return;

    // Regras de anexo:
    //  • Premium: liberado (fluxo legado — arquivo vira dataURL no chat).
    //  • Ad Exitum (qualquer plano): liberado SOMENTE após o aceite do
    //    especialista, com limite de 25 MB e upload seguro no Firebase Storage.
    if (!canAttach) {
      if (isAdExitum && !adExitumAccepted) {
        setWarning(
          "A troca de documentos será liberada assim que o especialista aceitar o seu pedido Ad Exitum."
        );
      } else {
        setWarning(
          "Compartilhamento de arquivos é exclusivo do Plano Premium. Faça upgrade para liberar."
        );
      }
      e.target.value = "";
      return;
    }

    // Fluxo Ad Exitum: upload seguro no Firebase Storage (suporta arquivos
    // grandes, até 25 MB) — a troca de documentação acontece exclusivamente
    // pela plataforma.
    if (isAdExitum) {
      if (file.size > ADEXITUM_MAX_FILE_BYTES) {
        setWarning("O arquivo excede o limite de 25 MB.");
        e.target.value = "";
        return;
      }
      const input = e.target;
      setUploading(true);
      (async () => {
        try {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-160);
          const path = `adExitumDocs/${encodeURIComponent(
            conversationId
          )}/${Date.now()}_${safeName}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, file, { contentType: file.type || undefined });
          const url = await getDownloadURL(fileRef);
          const attachment = { name: file.name, size: file.size, url, storagePath: path };
          if (useFirestore) {
            await sendChatMessage({
              conversationId,
              senderUid: authUid,
              senderName: myName,
              text: "",
              attachment,
            });
          } else {
            const next = [
              ...messages,
              {
                id: `m_${Date.now()}`,
                from: myId,
                fromName: myName,
                attachment,
                createdAt: new Date().toISOString(),
              },
            ];
            persist(next);
          }
        } catch (err) {
          console.warn("Falha no upload do documento:", err);
          setWarning(
            "Não foi possível enviar o arquivo. Verifique sua conexão e tente novamente."
          );
        } finally {
          setUploading(false);
          if (input) input.value = "";
        }
      })();
      return;
    }

    // Fluxo Premium legado (dataURL local).
    const reader = new FileReader();
    reader.onload = () => {
      const attachment = {
        name: file.name,
        size: file.size,
        url: String(reader.result || ""),
      };
      if (useFirestore) {
        sendChatMessage({
          conversationId,
          senderUid: authUid,
          senderName: myName,
          text: "",
          attachment,
        }).catch((err) => {
          console.warn("Falha ao enviar anexo:", err);
          setWarning("Não foi possível enviar o arquivo. Tente novamente.");
        });
      } else {
        const next = [
          ...messages,
          {
            id: `m_${Date.now()}`,
            from: myId,
            fromName: myName,
            attachment,
            createdAt: new Date().toISOString(),
          },
        ];
        persist(next);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title={`Chat · ${peerName}`} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-bold text-blue-700 dark:text-blue-300">
              {peerRole === "trabalhador" ? "Conversa com trabalhador" : "Conversa com especialista"}
            </p>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 truncate">
              {peerName}
            </h1>
            {caseId && (
              <Link
                to={`/especialista/${encodeURIComponent(
                  searchParams.get("specialistType") || "outro"
                )}/caso/${encodeURIComponent(caseId)}`}
                className="text-xs text-blue-700 dark:text-blue-300 hover:underline"
              >
                Ver caso {caseId}
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>

        {!isPremium && (
          <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3 flex-wrap">
            <span>
              Plano Essencial · até {ESSENCIAL_MESSAGE_LIMIT} mensagens por conversa, sem links/contatos diretos.
            </span>
            <Link
              to={peerRole === "especialista" ? "/trabalhador/beneficios" : "/especialista/beneficios"}
              className="font-bold text-blue-700 dark:text-blue-300 hover:underline"
            >
              Conheça o Premium
            </Link>
          </div>
        )}

        {isAdExitum && (
          <div
            className={[
              "mb-3 rounded-xl border px-3 py-2 text-xs flex items-center gap-2 flex-wrap",
              adExitumAccepted
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100"
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-900 dark:text-blue-100",
            ].join(" ")}
          >
            <span aria-hidden="true">⚖️</span>
            {adExitumAccepted ? (
              <span>
                Atendimento <strong>Ad Exitum</strong> ativo. Você já pode enviar
                documentos (até 25 MB) com segurança — a troca acontece
                exclusivamente pela plataforma.
              </span>
            ) : (
              <span>
                Pedido <strong>Ad Exitum</strong> enviado. A troca de documentos
                será liberada assim que o especialista aceitar o contato.
              </span>
            )}
          </div>
        )}

        <div
          ref={listRef}
          className="flex-1 min-h-[300px] bg-white/60 dark:bg-slate-900/60 rounded-2xl border border-blue-100 dark:border-slate-700 p-3 overflow-y-auto space-y-2"
        >
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} isMine={m.from === myId} />
          ))}
        </div>

        {warning && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2"
          >
            {warning}
          </p>
        )}

        <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAttach || uploading}
            title={
              canAttach
                ? "Anexar documento (até 25 MB)"
                : isAdExitum
                ? "Liberado após o especialista aceitar o pedido"
                : "Anexos disponíveis no Premium"
            }
            className="shrink-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? "⏳" : "📎"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleAttach}
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                handleSend(e);
              }
            }}
            rows={1}
            disabled={hitLimit}
            placeholder={
              hitLimit
                ? "Limite do Plano Essencial atingido."
                : "Escreva sua mensagem (Enter envia, Shift+Enter quebra linha)"
            }
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 resize-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={hitLimit || !draft.trim()}
            className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </form>

        {!isPremium && (
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            {myMessageCount}/{ESSENCIAL_MESSAGE_LIMIT} mensagens usadas nesta conversa.
          </p>
        )}
      </main>
    </div>
  );
}
