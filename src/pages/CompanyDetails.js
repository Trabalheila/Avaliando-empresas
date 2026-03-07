import React, { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCompanyLogoCandidates } from "../utils/getCompanyLogo";
import { db } from "../firebase";
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from "firebase/firestore";

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
  const [mandatoryComment, setMandatoryComment] = React.useState("");
  const [experienceComment, setExperienceComment] = React.useState("");
  const [commentError, setCommentError] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");
  const [reactionRegistry, setReactionRegistry] = React.useState({});
  const logoCandidates = company
    ? getCompanyLogoCandidates(company.company, { size: 128, website: company.website })
    : [];
  const [logoIndex, setLogoIndex] = React.useState(0);
  const companyLogo = logoCandidates[logoIndex] || null;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [company?.company, company?.website]);

  const reactions = [
    { key: "thumbsDown", label: "👎" },
    { key: "laugh", label: "😂" },
    { key: "thumbsUp", label: "👍" },
    { key: "cry", label: "😢" },
    { key: "clap", label: "👏" },
  ];

  const getTotalReactions = (comment) => {
    return Object.values(comment.reactions || {}).reduce((sum, v) => sum + (v || 0), 0);
  };

  const companyInfo = useMemo(() => {
    if (!company) return null;

    const sector =
      company.ramo ||
      company.setor ||
      company.segmento ||
      company.industry ||
      "Não informado";

    const locationParts = [company.cidade, company.estado, company.pais].filter(Boolean);
    const location = locationParts.length ? locationParts.join(" - ") : "Não informado";

    const websiteRaw = company.website || company.site || company.url || "";
    const website = websiteRaw
      ? /^https?:\/\//i.test(websiteRaw)
        ? websiteRaw
        : `https://${websiteRaw}`
      : "";

    const socialFields = [
      { key: "linkedin", label: "LinkedIn" },
      { key: "instagram", label: "Instagram" },
      { key: "facebook", label: "Facebook" },
      { key: "twitter", label: "X / Twitter" },
      { key: "tiktok", label: "TikTok" },
      { key: "youtube", label: "YouTube" },
    ];

    const socials = socialFields
      .map((item) => {
        const raw = company[item.key];
        if (!raw) return null;
        const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return { label: item.label, href };
      })
      .filter(Boolean);

    const googleQuery = [company.company, location !== "Não informado" ? location : ""].filter(Boolean).join(" ");
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`;

    return {
      sector,
      location,
      website,
      socials,
      googleSearchUrl,
    };
  }, [company]);

  const getCommentsKey = React.useCallback(() => {
    return company ? `comments_${company.company}` : null;
  }, [company]);

  const getCompanySlug = React.useCallback(() => {
    if (!company?.company) return "";
    return company.company
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/g, "")
      .replace(/-+$/g, "");
  }, [company]);

  const getReactionsKey = React.useCallback(() => {
    return company ? `comment_reactions_${company.company}` : null;
  }, [company]);

  const saveComments = React.useCallback((nextComments) => {
    setComments(nextComments);
    try {
      const key = getCommentsKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(nextComments));
      }
    } catch (err) {
      console.warn("Falha ao salvar comentários:", err);
    }
  }, [getCommentsKey]);

  const syncCommentsToFirestore = async (nextComments) => {
    try {
      const companySlug = getCompanySlug();
      if (!companySlug) return;

      await Promise.all(
        (nextComments || []).map((comment) =>
          setDoc(
            doc(db, "comments", comment.id),
            {
              ...comment,
              companySlug,
              companyName: company.company,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
        )
      );
    } catch (err) {
      console.warn("Falha ao sincronizar comentários no Firebase:", err);
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

  React.useEffect(() => {
    const fetchRemoteComments = async () => {
      try {
        const companySlug = getCompanySlug();
        if (!companySlug) return;

        const ref = collection(db, "comments");
        const q = query(
          ref,
          where("companySlug", "==", companySlug),
          orderBy("createdAt", "desc"),
          limit(120)
        );

        const snap = await getDocs(q);
        if (snap.empty) return;

        const normalized = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            author: data.author || "Anônimo",
            text: data.text || "",
            createdAt:
              typeof data.createdAt?.toDate === "function"
                ? data.createdAt.toDate().toISOString()
                : data.createdAt || new Date().toISOString(),
            reactions: {
              thumbsDown: data.reactions?.thumbsDown || 0,
              laugh: data.reactions?.laugh || 0,
              thumbsUp: data.reactions?.thumbsUp || 0,
              cry: data.reactions?.cry || 0,
              clap: data.reactions?.clap || 0,
            },
            replies: Array.isArray(data.replies) ? data.replies : [],
          };
        });

        saveComments(normalized);
      } catch (err) {
        console.warn("Falha ao carregar comentários do Firebase:", err);
      }
    };

    fetchRemoteComments();
  }, [getCompanySlug, saveComments]);

  React.useEffect(() => {
    const key = getReactionsKey();
    if (!key) {
      setReactionRegistry({});
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setReactionRegistry(stored ? JSON.parse(stored) : {});
    } catch (err) {
      console.warn("Falha ao carregar reações:", err);
      setReactionRegistry({});
    }
  }, [getReactionsKey]);

  const saveReactionRegistry = (next) => {
    setReactionRegistry(next);
    try {
      const key = getReactionsKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch (err) {
      console.warn("Falha ao salvar reações:", err);
    }
  };

  const handleAddComment = () => {
    const mandatoryText = mandatoryComment.trim();
    const experienceText = experienceComment.trim();

    if (!mandatoryText) {
      setCommentError("O campo de comentário obrigatório precisa ser preenchido.");
      return;
    }

    setCommentError("");

    const pseudonym = localStorage.getItem("userPseudonym") || "Anônimo";

    const finalText = experienceText
      ? `${mandatoryText}\n\nVocê trabalhou lá? Quer compartilhar sua experiência?\n${experienceText}`
      : mandatoryText;

    const comment = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: pseudonym,
      text: finalText,
      createdAt: new Date().toISOString(),
      reactions: { thumbsDown: 0, laugh: 0, thumbsUp: 0, cry: 0, clap: 0 },
      replies: [],
    };
    saveComments([comment, ...comments]);
    syncCommentsToFirestore([comment, ...comments]);
    setMandatoryComment("");
    setExperienceComment("");
  };

  const incrementReactionById = (items, targetId, reactionKey) => {
    return items.map((item) => {
      if (item.id === targetId) {
        return {
          ...item,
          reactions: {
            thumbsDown: item.reactions?.thumbsDown || 0,
            laugh: item.reactions?.laugh || 0,
            thumbsUp: item.reactions?.thumbsUp || 0,
            cry: item.reactions?.cry || 0,
            clap: item.reactions?.clap || 0,
            [reactionKey]: (item.reactions?.[reactionKey] || 0) + 1,
          },
        };
      }

      if (item.replies && item.replies.length) {
        return {
          ...item,
          replies: incrementReactionById(item.replies, targetId, reactionKey),
        };
      }

      return item;
    });
  };

  const handleReact = (targetId, reactionKey) => {
    const pseudonym = localStorage.getItem("userPseudonym") || "anon";
    const registryKey = `${targetId}__${pseudonym}`;

    // Uma reação por usuário por post/resposta.
    if (reactionRegistry[registryKey]) return;

    const nextComments = incrementReactionById(comments, targetId, reactionKey);
    saveComments(nextComments);
    syncCommentsToFirestore(nextComments);
    saveReactionRegistry({
      ...reactionRegistry,
      [registryKey]: reactionKey,
    });
  };

  const addReplyToItem = (items, targetId, replyObj) => {
    return items.map((item) => {
      if (item.id === targetId) {
        return {
          ...item,
          replies: [...(item.replies || []), replyObj],
        };
      }
      if (item.replies && item.replies.length) {
        return {
          ...item,
          replies: addReplyToItem(item.replies, targetId, replyObj),
        };
      }
      return item;
    });
  };

  const handleReply = (targetId) => {
    if (!replyText.trim()) return;
    const pseudonym = localStorage.getItem("userPseudonym") || "Anônimo";
    const reply = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: pseudonym,
      text: replyText.trim(),
      createdAt: new Date().toISOString(),
      replies: [],
    };
    const next = addReplyToItem(comments, targetId, reply);
    saveComments(next);
    syncCommentsToFirestore(next);
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
          <h1 className="text-2xl font-bold text-blue-800 dark:text-slate-100 mb-4">Empresa não encontrada</h1>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border border-blue-200">
              <img
                src={companyLogo}
                alt={`Logo ${company.company}`}
                className="w-full h-full object-cover"
                onError={() => {
                  if (logoIndex < logoCandidates.length - 1) {
                    setLogoIndex((prev) => prev + 1);
                  }
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-blue-800 dark:text-slate-100">{company.company}</h1>
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
              <div key={field.key} className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-100">{field.label}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(value)}`}>
                    {value.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
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
          <h2 className="text-lg font-bold text-blue-800 mb-4">Sobre a empresa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Ramo</p>
              <p className="mt-1 text-slate-800 font-medium">{companyInfo?.sector || "Não informado"}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Localização</p>
              <p className="mt-1 text-slate-800 font-medium">{companyInfo?.location || "Não informado"}</p>
            </div>
          </div>

          <div className="mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Site e redes sociais</p>

            {companyInfo?.website ? (
              <a
                href={companyInfo.website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-blue-700 hover:text-blue-900 underline font-medium"
              >
                Site oficial
              </a>
            ) : (
              <p className="mt-2 text-slate-600">Site oficial não informado.</p>
            )}

            {companyInfo?.socials?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {companyInfo.socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-slate-600">Redes sociais não informadas.</p>
            )}

            <a
              href={companyInfo?.googleSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900 underline"
            >
              Ver resultados da empresa no Google
            </a>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
          <h2 className="text-lg font-bold text-blue-800 dark:text-slate-100 mb-4">Comentários mais votados</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Você trabalhou lá? Quer compartilhar sua experiência? Digite aqui.
              </label>
              <textarea
                value={experienceComment}
                onChange={(e) => setExperienceComment(e.target.value)}
                placeholder="Conte como foi sua experiência na empresa (opcional)."
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />

              <label className="text-sm font-semibold text-slate-700">
                Comentário obrigatório
              </label>
              <textarea
                value={mandatoryComment}
                onChange={(e) => {
                  setMandatoryComment(e.target.value);
                  if (commentError) setCommentError("");
                }}
                placeholder="Escreva um comentário sobre essa empresa..."
                className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${commentError ? "border-red-400" : "border-gray-200"}`}
                rows={3}
                required
              />
              {commentError && <p className="text-sm text-red-600">{commentError}</p>}

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
                  <div key={comment.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{comment.author}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{new Date(comment.createdAt).toLocaleString()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(comment.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Responder
                      </button>
                    </div>

                    <p className="mt-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line">{comment.text}</p>

                    <div className="flex flex-wrap gap-3 mt-3">
                      {reactions.map((reaction) => (
                        <button
                          key={reaction.key}
                          type="button"
                          onClick={() => handleReact(comment.id, reaction.key)}
                          className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                        >
                          <span className="text-2xl">{reaction.label}</span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {comment.reactions?.[reaction.key] || 0}
                          </span>
                        </button>
                      ))}
                    </div>

                    {replyTo === comment.id && (
                      <div className="mt-3 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escreva sua resposta..."
                          className="w-full p-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo(null);
                              setReplyText("");
                            }}
                            className="px-3 py-1 text-sm font-semibold text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
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
                          <div key={reply.id} className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reply.author}</p>
                              <div className="flex items-center gap-3">
                                <p className="text-xs text-gray-500 dark:text-slate-400">{new Date(reply.createdAt).toLocaleString()}</p>
                                <button
                                  type="button"
                                  onClick={() => setReplyTo(reply.id)}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Responder
                                </button>
                              </div>
                            </div>
                            <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{reply.text}</p>
                            <div className="flex flex-wrap gap-3 mt-3">
                              {reactions.map((reaction) => (
                                <button
                                  key={reaction.key}
                                  type="button"
                                  onClick={() => handleReact(reply.id, reaction.key)}
                                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                                >
                                  <span className="text-2xl">{reaction.label}</span>
                                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {reply.reactions?.[reaction.key] || 0}
                                  </span>
                                </button>
                              ))}
                            </div>
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
