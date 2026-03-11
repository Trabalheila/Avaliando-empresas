import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaMoon, FaSun } from "react-icons/fa";
import { listReviewsByCompanySlug, slugifyCompany } from "../services/reviews";
import { db } from "../firebase";
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from "firebase/firestore";

const ITEM_CONFIG = {
  comunicacao: { label: "Contato do RH", commentKeys: ["commentComunicacao"] },
  etica: { label: "Proposta e acerto salarial", commentKeys: ["commentEtica"] },
  salario: { label: "Salário e benefícios", commentKeys: ["commentSalario", "commentBeneficios"] },
  cultura: { label: "Visão e valores da empresa", commentKeys: ["commentCultura"] },
  saudeBemEstar: { label: "Preocupação com o bem-estar", commentKeys: ["commentSaudeBemEstar"] },
  lideranca: { label: "Acessibilidade e respeito da liderança", commentKeys: ["commentLideranca"] },
  ambiente: { label: "Estímulo ao respeito entre colegas", commentKeys: ["commentAmbiente"] },
  estimacaoOrganizacao: { label: "Estímulo à organização", commentKeys: ["commentEstimacaoOrganizacao"] },
  desenvolvimento: { label: "Planos de cargos e salários", commentKeys: ["commentDesenvolvimento"] },
  reconhecimento: { label: "Reconhecimento", commentKeys: ["commentReconhecimento"] },
  equilibrio: { label: "Rotatividade", commentKeys: ["commentEquilibrio"] },
  diversidade: { label: "Atitudes de discriminação", commentKeys: ["commentDiversidade"] },
  rating: { label: "Segurança", commentKeys: ["commentRating"] },
};

function toDateLabel(value) {
  const parsed = new Date(value || "");
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toLocaleString("pt-BR");
}

function toSortableTime(value) {
  const parsed = new Date(value || "");
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
}

function getTotalReactions(item) {
  return Object.values(item?.reactions || {}).reduce((sum, value) => sum + (value || 0), 0);
}

function normalizeCommentDoc(id, data) {
  return {
    id,
    author: data?.author || "Anônimo",
    text: data?.text || "",
    createdAt:
      typeof data?.createdAt?.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : data?.createdAt || new Date().toISOString(),
    reactions: {
      thumbsDown: data?.reactions?.thumbsDown || 0,
      laugh: data?.reactions?.laugh || 0,
      thumbsUp: data?.reactions?.thumbsUp || 0,
      cry: data?.reactions?.cry || 0,
      clap: data?.reactions?.clap || 0,
    },
    replies: Array.isArray(data?.replies)
      ? data.replies.map((reply) => ({
          id: reply?.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          author: reply?.author || "Anônimo",
          text: reply?.text || "",
          createdAt:
            typeof reply?.createdAt?.toDate === "function"
              ? reply.createdAt.toDate().toISOString()
              : reply?.createdAt || new Date().toISOString(),
          reactions: {
            thumbsDown: reply?.reactions?.thumbsDown || 0,
            laugh: reply?.reactions?.laugh || 0,
            thumbsUp: reply?.reactions?.thumbsUp || 0,
            cry: reply?.reactions?.cry || 0,
            clap: reply?.reactions?.clap || 0,
          },
          replies: Array.isArray(reply?.replies) ? reply.replies : [],
        }))
      : [],
  };
}

function updateItemById(items, targetId, updater) {
  return (items || []).map((item) => {
    if (item.id === targetId) return updater(item);
    if (!Array.isArray(item.replies) || item.replies.length === 0) return item;
    return {
      ...item,
      replies: updateItemById(item.replies, targetId, updater),
    };
  });
}

function addReplyToItem(items, targetId, reply) {
  return updateItemById(items, targetId, (current) => ({
    ...current,
    replies: [...(current.replies || []), reply],
  }));
}

function incrementReactionById(items, targetId, reactionKey) {
  return updateItemById(items, targetId, (current) => ({
    ...current,
    reactions: {
      thumbsDown: current?.reactions?.thumbsDown || 0,
      laugh: current?.reactions?.laugh || 0,
      thumbsUp: current?.reactions?.thumbsUp || 0,
      cry: current?.reactions?.cry || 0,
      clap: current?.reactions?.clap || 0,
      [reactionKey]: (current?.reactions?.[reactionKey] || 0) + 1,
    },
  }));
}

function CompanyItemComments({ theme, toggleTheme }) {
  const [searchParams] = useSearchParams();
  const companyName = (searchParams.get("name") || "").trim();
  const itemKey = (searchParams.get("item") || "").trim();
  const itemConfig = ITEM_CONFIG[itemKey] || null;

  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [entries, setEntries] = React.useState([]);
  const [comments, setComments] = React.useState([]);
  const [commentText, setCommentText] = React.useState("");
  const [commentError, setCommentError] = React.useState("");
  const [replyToId, setReplyToId] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");

  const reactions = [
    { key: "thumbsDown", label: "👎" },
    { key: "laugh", label: "😂" },
    { key: "thumbsUp", label: "👍" },
    { key: "cry", label: "😢" },
    { key: "clap", label: "👏" },
  ];

  const getCommentsStorageKey = React.useCallback(() => {
    if (!companyName || !itemKey) return null;
    return `item_comments_${companyName}_${itemKey}`;
  }, [companyName, itemKey]);

  const saveComments = React.useCallback(
    (nextComments) => {
      setComments(nextComments);
      try {
        const key = getCommentsStorageKey();
        if (key) localStorage.setItem(key, JSON.stringify(nextComments));
      } catch {
        // ignore
      }
    },
    [getCommentsStorageKey]
  );

  const syncCommentsToFirestore = React.useCallback(
    async (nextComments) => {
      const companySlug = slugifyCompany(companyName || "");
      if (!companySlug || !itemKey) return;

      try {
        await Promise.all(
          (nextComments || []).map((comment) =>
            setDoc(
              doc(db, "item_comments", comment.id),
              {
                ...comment,
                companySlug,
                companyName,
                itemKey,
                itemLabel: itemConfig?.label || itemKey,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            )
          )
        );
      } catch {
        // ignore remote sync failures
      }
    },
    [companyName, itemConfig?.label, itemKey]
  );

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!companyName || !itemConfig) {
        setEntries([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMsg("");

      try {
        const companySlug = slugifyCompany(companyName);
        const reviews = await listReviewsByCompanySlug(companySlug, 300);
        if (!alive) return;

        const commentKeys = Array.isArray(itemConfig.commentKeys) ? itemConfig.commentKeys : [];
        const filtered = (reviews || [])
          .map((review) => {
            const selectedComment = commentKeys
              .map((key) => review?.[key])
              .find((value) => typeof value === "string" && value.trim());

            if (!selectedComment) return null;

            return {
              id: review.id,
              pseudonym: review.pseudonym || "Anônimo",
              comment: selectedComment.trim(),
              score: review?.[itemKey],
            createdAt:
              typeof review?.createdAt?.toDate === "function"
                ? review.createdAt.toDate().toISOString()
                : review?.createdAt || "",
          })
          .filter(Boolean)
          .sort((a, b) => toSortableTime(b.createdAt) - toSortableTime(a.createdAt));

        setEntries(filtered);
      } catch (err) {
        if (!alive) return;
        setErrorMsg("Não foi possível carregar os comentários deste item.");
      } finally {
        if (!alive) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [companyName, itemConfig, itemKey]);

  React.useEffect(() => {
    const key = getCommentsStorageKey();
    if (!key) {
      setComments([]);
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setComments(stored ? JSON.parse(stored) : []);
    } catch {
      setComments([]);
    }
  }, [getCommentsStorageKey]);

  React.useEffect(() => {
    let alive = true;

    const loadRemoteComments = async () => {
      const companySlug = slugifyCompany(companyName || "");
      if (!companySlug || !itemKey) return;

      try {
        const ref = collection(db, "item_comments");
        const q = query(
          ref,
          where("companySlug", "==", companySlug),
          where("itemKey", "==", itemKey),
          orderBy("createdAt", "desc"),
          limit(120)
        );
        const snap = await getDocs(q);
        if (!alive || snap.empty) return;

        const remoteComments = snap.docs.map((d) => normalizeCommentDoc(d.id, d.data()));
        saveComments(remoteComments);
      } catch {
        // ignore
      }
    };

    loadRemoteComments();

    return () => {
      alive = false;
    };
  }, [companyName, itemKey, saveComments]);

  const handleAddComment = () => {
    const text = (commentText || "").trim();
    if (!text) {
      setCommentError("Digite um comentário para publicar.");
      return;
    }

    const comment = {
      id: `item_comment_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: (localStorage.getItem("userPseudonym") || "Anônimo").toString().trim() || "Anônimo",
      text,
      createdAt: new Date().toISOString(),
      reactions: { thumbsDown: 0, laugh: 0, thumbsUp: 0, cry: 0, clap: 0 },
      replies: [],
    };

    const next = [comment, ...comments];
    saveComments(next);
    syncCommentsToFirestore(next);
    setCommentText("");
    setCommentError("");
  };

  const handleReply = (targetId) => {
    const text = (replyText || "").trim();
    if (!text) return;

    const reply = {
      id: `item_reply_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: (localStorage.getItem("userPseudonym") || "Anônimo").toString().trim() || "Anônimo",
      text,
      createdAt: new Date().toISOString(),
      reactions: { thumbsDown: 0, laugh: 0, thumbsUp: 0, cry: 0, clap: 0 },
      replies: [],
    };

    const next = addReplyToItem(comments, targetId, reply);
    saveComments(next);
    syncCommentsToFirestore(next);
    setReplyToId(null);
    setReplyText("");
  };

  const handleReact = (targetId, reactionKey) => {
    const next = incrementReactionById(comments, targetId, reactionKey);
    saveComments(next);
    syncCommentsToFirestore(next);
  };

  const renderReplies = (items) => {
    return (items || []).map((reply) => (
      <div
        key={reply.id}
        className="mt-3 ml-4 pl-3 border-l-2 border-blue-100 dark:border-slate-700"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{reply.author}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{toDateLabel(reply.createdAt)}</p>
        </div>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-100 whitespace-pre-line">{reply.text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {reactions.map((reaction) => (
            <button
              key={`${reply.id}_${reaction.key}`}
              type="button"
              onClick={() => handleReact(reply.id, reaction.key)}
              className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              {reaction.label} {reply?.reactions?.[reaction.key] || 0}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReplyToId(reply.id)}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Responder
          </button>
          <span className="text-xs text-slate-500">Total: {getTotalReactions(reply)}</span>
        </div>

        {replyToId === reply.id && (
          <div className="mt-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={2}
              placeholder="Escreva sua resposta..."
              className="w-full p-2 text-sm border border-gray-200 rounded-lg"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReplyToId(null);
                  setReplyText("");
                }}
                className="px-3 py-1 text-xs rounded-lg border border-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleReply(reply.id)}
                className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white"
              >
                Enviar resposta
              </button>
            </div>
          </div>
        )}

        {Array.isArray(reply.replies) && reply.replies.length > 0 && renderReplies(reply.replies)}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 py-10 px-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-3 gap-2">
        <Link
          to="/"
          className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Voltar para a pagina principal
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Alternar tema"
        >
          <span className="inline-flex items-center gap-2">
            {theme === "dark" ? <FaMoon /> : <FaSun />}
            {theme === "dark" ? "Lua" : "Sol"}
          </span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-8">
        <Link
          to={`/empresa?name=${encodeURIComponent(companyName)}`}
          className="text-sm font-bold text-blue-700 hover:underline"
        >
          {"← Voltar para a página da empresa"}
        </Link>

        <h1 className="mt-4 text-2xl font-extrabold text-blue-800 dark:text-slate-100">
          Comentários por item
        </h1>

        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Empresa: <span className="font-semibold">{companyName || "Não informada"}</span>
        </p>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Item: <span className="font-semibold">{itemConfig?.label || "Item inválido"}</span>
        </p>

        {isLoading ? (
          <div className="mt-6 text-sm text-slate-600">Carregando comentários...</div>
        ) : errorMsg ? (
          <div className="mt-6 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {errorMsg}
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-6 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            Ainda não há comentários para este item.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.pseudonym}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{toDateLabel(entry.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-100 whitespace-pre-line">{entry.comment}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Nota neste item: {typeof entry.score === "number" ? entry.score.toFixed(1) : "--"}
                </p>
              </article>
            ))}
          </div>
        )}

        <section className="mt-8 border-t border-blue-100 dark:border-slate-700 pt-6">
          <h2 className="text-lg font-bold text-blue-800 dark:text-slate-100">
            Discussão deste item (comentários, reações e respostas)
          </h2>

          <p className="mt-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            Você está comentando sobre: <span className="font-semibold">{itemConfig?.label || "Item"}</span>
          </p>

          <div className="mt-3 space-y-2">
            <textarea
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                if (commentError) setCommentError("");
              }}
              rows={3}
              placeholder={`Compartilhe sua experiência sobre "${itemConfig?.label || "este item"}"...`}
              className="w-full p-3 text-sm border border-gray-200 rounded-xl"
            />
            {commentError && <p className="text-sm text-rose-700">{commentError}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddComment}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
              >
                Publicar comentário
              </button>
            </div>
          </div>

          {comments.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Ainda não há comentários nesta discussão.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {[...comments]
                .sort((a, b) => getTotalReactions(b) - getTotalReactions(a))
                .map((comment) => (
                  <article
                    key={comment.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{comment.author}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{toDateLabel(comment.createdAt)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-100 whitespace-pre-line">{comment.text}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {reactions.map((reaction) => (
                        <button
                          key={`${comment.id}_${reaction.key}`}
                          type="button"
                          onClick={() => handleReact(comment.id, reaction.key)}
                          className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                          {reaction.label} {comment?.reactions?.[reaction.key] || 0}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setReplyToId(comment.id)}
                        className="text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Responder
                      </button>
                      <span className="text-xs text-slate-500">Total: {getTotalReactions(comment)}</span>
                    </div>

                    {replyToId === comment.id && (
                      <div className="mt-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={2}
                          placeholder="Escreva sua resposta..."
                          className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyToId(null);
                              setReplyText("");
                            }}
                            className="px-3 py-1 text-xs rounded-lg border border-gray-200"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReply(comment.id)}
                            className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white"
                          >
                            Enviar resposta
                          </button>
                        </div>
                      </div>
                    )}

                    {Array.isArray(comment.replies) && comment.replies.length > 0 && renderReplies(comment.replies)}
                  </article>
                ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default CompanyItemComments;
