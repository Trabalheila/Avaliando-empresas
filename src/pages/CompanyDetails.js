import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCompanyLogoUrl } from "../utils/getCompanyLogo";

function CompanyDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name");

  const company = useMemo(() => {
    if (!name) return null;
    try {
      const stored = localStorage.getItem("empresasData");
      if (!stored) return null;
      const empresas = JSON.parse(stored);
      return empresas.find((emp) => emp.company === name) || null;
    } catch (err) {
      return null;
    }
  }, [name]);

  const calculateAverage = (emp) => {
    if (!emp) return "0.0";
    const values = [
      emp.rating, emp.salario, emp.beneficios, emp.cultura, emp.oportunidades,
      emp.inovacao, emp.lideranca, emp.diversidade, emp.ambiente, emp.equilibrio,
      emp.reconhecimento, emp.comunicacao, emp.etica, emp.desenvolvimento,
      emp.saudeBemEstar, emp.impactoSocial, emp.reputacao, emp.estimacaoOrganizacao,
    ].filter((v) => typeof v === "number" && !isNaN(v) && v > 0);
    if (values.length === 0) return "0.0";
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / values.length;
    return Number.isFinite(avg) ? avg.toFixed(1) : "0.0";
  };

  const average = calculateAverage(company);

  const getEvaluations = () => {
    if (!company) return {};
    try {
      const stored = localStorage.getItem(`evaluations_${company.company}`);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      return {};
    }
  };

  const evaluations = getEvaluations();
  const evaluationCount = Object.keys(evaluations).length;

  const getScoreColor = (score) => {
    const n = parseFloat(score);
    if (Number.isNaN(n)) return "text-gray-700";
    if (n < 2) return "text-red-600";
    if (n < 3) return "text-purple-600";
    if (n < 4) return "text-yellow-600";
    if (n < 4.5) return "text-lime-600";
    return "text-emerald-700";
  };

  const [comments, setComments] = React.useState([]);
  const [newComment, setNewComment] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");

  const reactions = [
    { key: "anger", label: "😡" },
    { key: "laugh", label: "😂" },
    { key: "thumbsUp", label: "👍" },
    { key: "cry", label: "😢" },
    { key: "clap", label: "👏" },
  ];

  const getTotalReactions = (comment) => {
    return Object.values(comment.reactions || {}).reduce((sum, v) => sum + (v || 0), 0);
  };

  const getCommentsKey = React.useCallback(() => {
    return company ? `comments_${company.company}` : null;
  }, [company]);

  const saveComments = (nextComments) => {
    setComments(nextComments);
    try {
      const key = getCommentsKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(nextComments));
      }
    } catch (err) {
      console.warn("Falha ao salvar comentários:", err);
    }
  };

  React.useEffect(() => {
    const key = getCommentsKey();
    if (!key) {
      setComments([]);
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setComments(JSON.parse(stored));
      } else {
        setComments([]);
      }
    } catch (err) {
      console.warn("Falha ao carregar comentários:", err);
      setComments([]);
    }
  }, [getCommentsKey]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const pseudonym = localStorage.getItem("userPseudonym") || "Anônimo";
    const comment = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: pseudonym,
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
      reactions: { anger: 0, laugh: 0, thumbsUp: 0, cry: 0, clap: 0 },
      replies: [],
    };
    saveComments([comment, ...comments]);
    setNewComment("");
  };

  const handleReact = (commentId, reactionKey) => {
    const next = comments.map((c) => {
      if (c.id !== commentId) return c;
      return {
        ...c,
        reactions: {
          ...c.reactions,
          [reactionKey]: (c.reactions?.[reactionKey] || 0) + 1,
        },
      };
    });
    saveComments(next);
  };

  const handleReply = (commentId) => {
    if (!replyText.trim()) return;
    const pseudonym = localStorage.getItem("userPseudonym") || "Anônimo";
    const next = comments.map((c) => {
      if (c.id !== commentId) return c;
      return {
        ...c,
        replies: [
          ...(c.replies || []),
          {
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            author: pseudonym,
            text: replyText.trim(),
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
    saveComments(next);
    setReplyText("");
    setReplyTo(null);
  };

  const scoreFields = [
    { key: "rating", label: "Avaliação Geral" },
    { key: "salario", label: "Salário" },
    { key: "beneficios", label: "Benefícios" },
    { key: "cultura", label: "Cultura" },
    { key: "oportunidades", label: "Oportunidades" },
    { key: "inovacao", label: "Inovação" },
    { key: "lideranca", label: "Liderança" },
    { key: "diversidade", label: "Diversidade" },
    { key: "ambiente", label: "Ambiente" },
    { key: "equilibrio", label: "Equilíbrio" },
    { key: "reconhecimento", label: "Reconhecimento" },
    { key: "comunicacao", label: "Comunicação" },
    { key: "etica", label: "Ética" },
    { key: "desenvolvimento", label: "Desenvolvimento" },
    { key: "saudeBemEstar", label: "Saúde e Bem-estar" },
    { key: "impactoSocial", label: "Impacto Social" },
    { key: "reputacao", label: "Reputação" },
    { key: "estimacaoOrganizacao", label: "Estímulo e Organização" },
  ];


  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-blue-100 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-blue-800 mb-4">Empresa não encontrada</h1>
          <p className="text-sm text-slate-600 mb-6">
            Não foi possível localizar a empresa informada. Volte à página inicial e selecione outra empresa.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Voltar para início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-blue-100 p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-blue-200">
              <img
                src={getCompanyLogoUrl(company.company, 128)}
                alt={`Logo ${company.company}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-blue-800">{company.company}</h1>
              <p className={`text-lg font-bold ${getScoreColor(average)}`}>{average} / 5</p>
              <p className="text-xs text-gray-500">{evaluationCount} avaliação{evaluationCount === 1 ? "" : "es"}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
          >
            Voltar
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {scoreFields.map((field) => {
            const value = company[field.key];
            if (typeof value !== "number" || value <= 0) return null;
            return (
              <div key={field.key} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">{field.label}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(value)}`}>
                    {value.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`${getScoreColor(value)} h-full rounded-full`}
                    style={{ width: `${Math.min(100, (value / 5) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
          <h2 className="text-lg font-bold text-blue-800 mb-4">Comentários mais votados</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário sobre essa empresa..."
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <button
                type="button"
                onClick={handleAddComment}
                className="self-end px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                Publicar comentário
              </button>
            </div>

            {comments.length === 0 ? (
              <p className="text-center text-gray-500">Seja o primeiro a comentar sobre esta empresa.</p>
            ) : (
              [...comments]
                .sort((a, b) => getTotalReactions(b) - getTotalReactions(a))
                .map((comment) => (
                  <div key={comment.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{comment.author}</p>
                        <p className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {reactions.map((reaction) => (
                          <button
                            key={reaction.key}
                            type="button"
                            onClick={() => handleReact(comment.id, reaction.key)}
                            className="flex items-center gap-1 text-sm px-2 py-1 border border-gray-200 rounded-full hover:bg-gray-100"
                          >
                            <span>{reaction.label}</span>
                            <span className="text-xs font-semibold">{comment.reactions?.[reaction.key] || 0}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setReplyTo(comment.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Responder
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-gray-800 whitespace-pre-line">{comment.text}</p>

                    {replyTo === comment.id && (
                      <div className="mt-3 bg-white p-3 rounded-xl border border-gray-200">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escreva sua resposta..."
                          className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo(null);
                              setReplyText("");
                            }}
                            className="px-3 py-1 text-sm font-semibold text-gray-600 rounded-lg hover:bg-gray-100"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReply(comment.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    )}

                    {comment.replies?.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="bg-white p-3 rounded-xl border border-gray-200">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">{reply.author}</p>
                              <p className="text-xs text-gray-500">{new Date(reply.createdAt).toLocaleString()}</p>
                            </div>
                            <p className="mt-1 text-sm text-gray-700">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompanyDetails;
