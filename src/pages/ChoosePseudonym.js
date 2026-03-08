import React, { useCallback, useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUserProfile, getUserProfileByCpf, saveUserProfile } from "../services/users";
import { extractResumeText, parseResumeText } from "../utils/resumeParser";

const predefinedAvatars = [
  "🧑", "🧑‍💼", "🧑‍🔧", "🧑‍💻", "🧑‍🔬", "👩‍🏫", "👨‍🍳", "👩‍⚕️", "👨‍🚀", "👩‍🎨",
];

function mapLinkedInExperience(item) {
  if (!item) return null;

  const role =
    (item?.title || item?.role || item?.position || item?.occupation || "")
      .toString()
      .trim() || "Nao identificado";

  const company =
    (item?.company || item?.companyName || item?.organization || item?.employer || "")
      .toString()
      .trim() || "Nao identificado";

  const start = (item?.startDate || item?.start || item?.from || "").toString().trim();
  const end = (item?.endDate || item?.end || item?.to || item?.present || "").toString().trim();
  const period = item?.period
    ? item.period
    : [start, end || "Atual"].filter(Boolean).join(" - ");

  const details =
    (item?.description || item?.summary || item?.activities || item?.responsibilities || "")
      .toString()
      .trim();

  if (!company && !role && !period) return null;

  return {
    company,
    role,
    period,
    details,
    confidence: 0.9,
    confidenceLevel: "alta",
    source: "linkedin",
  };
}

function extractLinkedInExperiences(profile) {
  const raw =
    profile?.linkedinExperiences ||
    profile?.experiences ||
    profile?.positions ||
    profile?.linkedin?.experiences ||
    profile?.linkedin?.positions ||
    [];

  if (!Array.isArray(raw)) return [];

  const mapped = raw.map(mapLinkedInExperience).filter(Boolean);
  const dedupe = new Map();
  mapped.forEach((item) => {
    const key = [item.company, item.role, item.period].join("__").toLowerCase();
    if (!dedupe.has(key)) dedupe.set(key, item);
  });
  return Array.from(dedupe.values());
}

function normalizeExperiencesForReview(items) {
  return (items || []).map((item) => {
    const confidence = (item?.confidenceLevel || "").toLowerCase();
    const defaultStatus = confidence === "alta" ? "confirmada" : "pendente";
    return {
      ...item,
      reviewStatus: item?.reviewStatus || defaultStatus,
    };
  });
}

function getPeriodSortScore(period) {
  const text = (period || "").toString();
  if (/atual|presente/i.test(text)) return 9999;

  const years = Array.from(text.matchAll(/(19|20)\d{2}/g)).map((m) => Number(m[0]));
  if (years.length) return Math.max(...years);
  return -1;
}

function ChoosePseudonym({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [pseudonym, setPseudonym] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [professionalObjective, setProfessionalObjective] = useState("");
  const [educationAndProfession, setEducationAndProfession] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [structuredExperiences, setStructuredExperiences] = useState([]);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeMimeType, setResumeMimeType] = useState("");
  const [resumePreviewUrl, setResumePreviewUrl] = useState("");
  const [isResumePreviewExpanded, setIsResumePreviewExpanded] = useState(false);
  const [resumeReadConfirmed, setResumeReadConfirmed] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [avatar, setAvatar] = useState(predefinedAvatars[0]);
  const [avatarFileLabel, setAvatarFileLabel] = useState("Nenhum escolhido");
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [confirmedHuman, setConfirmedHuman] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState(null);
  const [isLinkedInLogin, setIsLinkedInLogin] = useState(false);

  const applyProfileToState = useCallback((profile) => {
    if (!profile) return;

    const provider = (profile?.loginProvider || "").toString().toLowerCase();
    setIsLinkedInLogin(provider === "linkedin" || Boolean(profile?.linkedInUrl));

    if (profile?.name) setPseudonym(profile.name);
    if (profile?.cpf) setCpf(profile.cpf);
    if (profile?.resumeData?.name) setFullName(profile.resumeData.name);
    if (profile?.resumeData?.objective) setProfessionalObjective(profile.resumeData.objective);
    if (profile?.resumeData?.educationSummary) setEducationAndProfession(profile.resumeData.educationSummary);
    if (profile?.email) setEmail(profile.email);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.educationLevel) setEducationLevel(profile.educationLevel);
    if (Array.isArray(profile?.resumeData?.experiencesStructured)) {
      setStructuredExperiences(normalizeExperiencesForReview(profile.resumeData.experiencesStructured));
    }
    if (profile?.resumeData?.fileName) setResumeFileName(profile.resumeData.fileName);
    if (profile?.resumeData?.mimeType) setResumeMimeType(profile.resumeData.mimeType);
    if (profile?.resumeData?.readConfirmed) setResumeReadConfirmed(!!profile.resumeData.readConfirmed);
    if (profile?.resumeData?.rawText) setResumeText(profile.resumeData.rawText);
    if (profile?.avatar) {
      setAvatar(profile.avatar);
      setAvatarFileLabel(typeof profile.avatar === "string" && profile.avatar.startsWith("data:") ? "Imagem atual" : "Nenhum escolhido");
      setAvatarDirty(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }
    };
  }, [resumePreviewUrl]);

  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (!profile) {
      navigate("/");
      return;
    }

    try {
      const parsed = JSON.parse(profile);
      applyProfileToState(parsed);

      const accountId = parsed?.id || parsed?.email;
      if (accountId) {
        getUserProfile(accountId)
          .then((remoteProfile) => {
            if (!remoteProfile) return;

            const mergedProfile = {
              ...parsed,
              ...remoteProfile,
              resumeData: {
                ...(parsed?.resumeData || {}),
                ...(remoteProfile?.resumeData || {}),
              },
            };

            localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
            if (mergedProfile?.name) {
              localStorage.setItem("userPseudonym", mergedProfile.name);
            }
            applyProfileToState(mergedProfile);
          })
          .catch((err) => {
            console.warn("Falha ao sincronizar perfil remoto:", err);
          });
      }
    } catch {
      // ignore
    }
  }, [navigate, applyProfileToState]);

  const convertFileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAvatarFileLabel("Nenhum escolhido");
      return;
    }
    setAvatarFileLabel(file.name || "Nenhum escolhido");
    try {
      const dataUrl = await convertFileToDataUrl(file);
      setAvatar(dataUrl);
      setAvatarDirty(true);
    } catch {
      // ignore
    }
  };

  const handleSaveAvatar = useCallback(async () => {
    if (!avatar) return;

    setIsSavingAvatar(true);
    setError(null);
    setInfo("");

    try {
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const nextProfile = {
        ...existingProfile,
        avatar,
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      try {
        await saveUserProfile({
          id: nextProfile.id || nextProfile.email || `anon_${Date.now()}`,
          ...nextProfile,
        });
      } catch (err) {
        console.warn("Falha ao sincronizar avatar no Firebase:", err);
      }

      setAvatarDirty(false);
      setInfo("Imagem de perfil salva com sucesso.");
    } catch {
      setError("Não foi possível salvar a imagem de perfil.");
    } finally {
      setIsSavingAvatar(false);
    }
  }, [avatar]);

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setInfo("");
    setIsParsingResume(true);
    setResumeReadConfirmed(false);

    try {
      if (resumePreviewUrl) {
        URL.revokeObjectURL(resumePreviewUrl);
      }

      const previewUrl = URL.createObjectURL(file);
      setResumePreviewUrl(previewUrl);
      setResumeMimeType(file.type || "");

      const text = await extractResumeText(file);
      const storedCompanies = JSON.parse(localStorage.getItem("empresasData") || "[]");
      const knownCompanyNames = (storedCompanies || []).map((emp) => emp?.company).filter(Boolean);
      const parsed = parseResumeText(text, knownCompanyNames);

      setStructuredExperiences(normalizeExperiencesForReview(parsed.experiencesStructured || []));
      setResumeFileName(file.name || "curriculo");
      setResumeText(parsed.experienceText || "");
      if ((parsed.experiencesStructured || []).length === 0) {
        setInfo("Nao encontramos experiencias com confianca. Voce pode adicionar manualmente abaixo.");
      } else {
        setInfo("Importacao concluida em modo experiencia. Revise os cards e confirme.");
      }
    } catch (err) {
      setError(err?.message || "Nao foi possivel ler o curriculo automaticamente.");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleFillFromLinkedIn = useCallback(async () => {
    try {
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      setInfo("");
      setError(null);

      let mergedProfile = { ...existingProfile };
      const accountId = existingProfile?.id || existingProfile?.email;
      if (accountId) {
        try {
          const persisted = await getUserProfile(accountId);
          if (persisted) {
            mergedProfile = {
              ...existingProfile,
              ...persisted,
              resumeData: {
                ...(existingProfile?.resumeData || {}),
                ...(persisted?.resumeData || {}),
              },
            };
            localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
          }
        } catch (err) {
          console.warn("Falha ao buscar dados remotos da conta:", err);
        }
      }

      const fallbackName = [mergedProfile?.localizedFirstName, mergedProfile?.localizedLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const resolvedName =
        (mergedProfile?.name || "").toString().trim() ||
        fallbackName ||
        [mergedProfile?.firstName, mergedProfile?.lastName].filter(Boolean).join(" ").trim();
      const resolvedEmail =
        (mergedProfile?.email || "").toString().trim() ||
        (mergedProfile?.emailAddress || "").toString().trim();
      const resolvedPhone =
        (mergedProfile?.phone || "").toString().trim() ||
        (mergedProfile?.phoneNumber || "").toString().trim() ||
        (mergedProfile?.formattedPhoneNumber || "").toString().trim();
      const linkedInExperiences = extractLinkedInExperiences(mergedProfile);

      const loadedFields = [];

      if (resolvedName) {
        setPseudonym(resolvedName);
        setFullName(resolvedName);
        loadedFields.push("nome");
      }
      if (resolvedEmail) {
        setEmail(resolvedEmail);
        loadedFields.push("e-mail");
      }
      if (resolvedPhone) {
        setPhone(resolvedPhone);
        loadedFields.push("telefone");
      }

      if (linkedInExperiences.length > 0) {
        setStructuredExperiences(normalizeExperiencesForReview(linkedInExperiences));
        setResumeReadConfirmed(true);
        loadedFields.push(`${linkedInExperiences.length} experiencias`);
      }

      if (loadedFields.length > 0) {
        setInfo(`Dados carregados do LinkedIn: ${loadedFields.join(", ")}.`);
      } else {
        setInfo("Nao encontramos novos dados de LinkedIn para preencher automaticamente.");
      }
    } catch {
      setError("Não foi possível carregar dados do LinkedIn no momento.");
    }
  }, []);

  const handleExperienceFieldChange = (idx, key, value) => {
    const next = [...structuredExperiences];
    const current = next[idx] || {};
    const nextStatus = current.reviewStatus === "confirmada" ? "corrigir" : (current.reviewStatus || "pendente");
    next[idx] = { ...current, [key]: value, reviewStatus: nextStatus };
    setStructuredExperiences(next);
  };

  const handleAddExperience = () => {
    const next = [...structuredExperiences, { company: "", role: "", period: "", details: "", reviewStatus: "pendente" }];
    setStructuredExperiences(next);
  };

  const handleRemoveExperience = (idx) => {
    const next = structuredExperiences.filter((_, i) => i !== idx);
    setStructuredExperiences(next);
  };

  const handleSetExperienceReviewStatus = (idx, status) => {
    const next = [...structuredExperiences];
    const current = next[idx] || {};
    next[idx] = { ...current, reviewStatus: status };
    setStructuredExperiences(next);
  };

  const sortedExperiences = useMemo(() => {
    return (structuredExperiences || [])
      .map((exp, originalIndex) => ({ exp, originalIndex, sortScore: getPeriodSortScore(exp?.period) }))
      .sort((a, b) => b.sortScore - a.sortScore || a.originalIndex - b.originalIndex);
  }, [structuredExperiences]);

  const reviewCounters = useMemo(() => {
    return (structuredExperiences || []).reduce(
      (acc, item) => {
        const status = (item?.reviewStatus || "pendente").toLowerCase();
        if (status === "confirmada") acc.confirmadas += 1;
        else if (status === "corrigir") acc.corrigir += 1;
        else acc.pendentes += 1;
        return acc;
      },
      { confirmadas: 0, corrigir: 0, pendentes: 0 }
    );
  }, [structuredExperiences]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = pseudonym.trim();
      if (!trimmed) {
        setError("Por favor, escolha um pseudônimo.");
        return;
      }

      if (!confirmedHuman) {
        setError("Por favor, confirme que você é um humano.");
        return;
      }

      const cpfNumbers = cpf.replace(/\D/g, "");
      if (cpfNumbers && cpfNumbers.length !== 11) {
        setError("CPF deve conter 11 dígitos.");
        return;
      }

      if (resumeFileName && !resumeReadConfirmed) {
        setError("Confirme a leitura do curriculo antes de salvar o perfil.");
        return;
      }

      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const accountId = existingProfile.id || existingProfile.email;

      if (cpfNumbers) {
        try {
          const cpfOwner = await getUserProfileByCpf(cpfNumbers);
          const cpfOwnerId = (cpfOwner?.id || "").toString();
          const currentAccountId = (accountId || "").toString();

          if (cpfOwner && cpfOwnerId !== currentAccountId) {
            setError("Este CPF já está cadastrado em outra conta.");
            return;
          }
        } catch (err) {
          console.warn("Falha ao validar unicidade de CPF:", err);
        }
      }

      localStorage.setItem("userPseudonym", trimmed);

      const nextProfile = {
        ...existingProfile,
        name: trimmed,
        fullName: fullName.trim() || undefined,
        cpf: cpfNumbers || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        educationLevel: educationLevel.trim() || undefined,
        avatar,
        resumeData: {
          name: fullName.trim() || undefined,
          objective: professionalObjective.trim() || undefined,
          educationSummary: educationAndProfession.trim() || undefined,
          fileName: resumeFileName || undefined,
          mimeType: resumeMimeType || undefined,
          readConfirmed: resumeReadConfirmed,
          experiences: structuredExperiences.map((item) => item.company).filter(Boolean),
          experiencesStructured: structuredExperiences,
          rawText: resumeText,
          parsedAt: new Date().toISOString(),
        },
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));

      // Salva no Firebase para persistência centralizada
      try {
        await saveUserProfile({
          id: nextProfile.id || nextProfile.email || `anon_${Date.now()}`,
          ...nextProfile,
        });
      } catch (err) {
        console.warn("Falha ao salvar perfil no Firebase:", err);
      }

      // Dispara evento para que outras partes do app atualizem o estado de login
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      navigate("/");
    },
    [
      navigate,
      pseudonym,
      cpf,
      fullName,
      professionalObjective,
      educationAndProfession,
      email,
      phone,
      educationLevel,
      avatar,
      confirmedHuman,
      resumeFileName,
      resumeMimeType,
      resumeReadConfirmed,
      structuredExperiences,
      resumeText,
    ]
  );

  const renderEditableResumeData = () => (
    <>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-slate-700">Experiências profissionais importadas</label>
          <span className="text-xs text-slate-500">
            {(structuredExperiences || []).length} item(ns)
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Modo inovador ativo: apenas experiências são importadas para evitar ruído no currículo.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3 text-[11px]">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-1 font-semibold text-center">
            Confirmadas: {reviewCounters.confirmadas}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-2 py-1 font-semibold text-center">
            Corrigir: {reviewCounters.corrigir}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 text-slate-700 px-2 py-1 font-semibold text-center">
            Pendentes: {reviewCounters.pendentes}
          </div>
        </div>
        <div className="space-y-3">
          {sortedExperiences.map(({ exp, originalIndex }, timelineIndex) => {
            const confidenceLevel = (exp.confidenceLevel || "media").toLowerCase();
            const confidenceClass = confidenceLevel === "alta"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : confidenceLevel === "baixa"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-blue-50 text-blue-700 border-blue-200";
            const reviewStatus = (exp.reviewStatus || "pendente").toLowerCase();
            const reviewClass = reviewStatus === "confirmada"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : reviewStatus === "corrigir"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-700 border-slate-200";

            return (
            <div key={`${originalIndex}_${exp.company}_${exp.role}`} className="border border-gray-200 rounded-xl p-3 bg-gray-50 relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-1 bg-blue-300" />
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-[11px] px-2 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-semibold">
                  Timeline #{timelineIndex + 1}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-1 rounded-full border font-semibold ${reviewClass}`}>
                    Revisao: {reviewStatus}
                  </span>
                  <span className={`text-[11px] px-2 py-1 rounded-full border font-semibold ${confidenceClass}`}>
                    Confianca {confidenceLevel}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  value={exp.company || ""}
                  onChange={(e) => handleExperienceFieldChange(originalIndex, "company", e.target.value)}
                  placeholder="Empresa"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={exp.role || ""}
                  onChange={(e) => handleExperienceFieldChange(originalIndex, "role", e.target.value)}
                  placeholder="Cargo"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <input
                value={exp.period || ""}
                onChange={(e) => handleExperienceFieldChange(originalIndex, "period", e.target.value)}
                placeholder="Periodo (ex.: 2020 - 2023)"
                className="mt-2 w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={exp.details || ""}
                onChange={(e) => handleExperienceFieldChange(originalIndex, "details", e.target.value)}
                placeholder="Detalhes (periodo, atividades, resultados)"
                rows={2}
                className="mt-2 w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetExperienceReviewStatus(originalIndex, "confirmada")}
                  className="px-3 py-1 text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100"
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => handleSetExperienceReviewStatus(originalIndex, "corrigir")}
                  className="px-3 py-1 text-xs rounded-lg border border-amber-200 bg-amber-50 text-amber-700 font-semibold hover:bg-amber-100"
                >
                  Corrigir
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveExperience(originalIndex)}
                className="mt-2 text-xs text-red-600 font-semibold hover:underline"
              >
                Remover experiência
              </button>
            </div>
            );
          })}
          <button
            type="button"
            onClick={handleAddExperience}
            className="px-3 py-2 border border-blue-200 text-blue-700 font-semibold rounded-lg hover:bg-blue-50"
          >
            + Adicionar experiência
          </button>
        </div>
      </div>
    </>
  );

  const hasResumeFile = Boolean(resumeFileName);
  const hasResumeParsed = Array.isArray(structuredExperiences) && structuredExperiences.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-blue-100 dark:border-slate-700">
          <div className="flex justify-end items-center gap-2 mb-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? "🌙 Tema" : "☀️ Tema"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-4 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
            >
              Voltar para a página principal
            </button>
          </div>
          <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-200 mb-4 text-center">Seu perfil anônimo</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Essas informações ajudam a manter a qualidade das avaliações. Seus dados são armazenados localmente e não serão compartilhados.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Pseudônimo</label>
            <input
              value={pseudonym}
              onChange={(e) => {
                setError(null);
                setPseudonym(e.target.value);
              }}
              placeholder="Ex.: Profissional Anônimo"
              className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">E-mail</label>
            <input
              value={email}
              onChange={(e) => {
                setError(null);
                setEmail(e.target.value);
              }}
              placeholder="seuemail@dominio.com"
              className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">CPF (apenas números)</label>
            <input
              value={cpf}
              onChange={(e) => {
                setError(null);
                setCpf(e.target.value);
              }}
              placeholder="00000000000"
              className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Carregar currículo (PDF, DOCX, TXT, MD, RTF)</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleResumeUpload}
              className="w-full"
            />
            <p className="text-xs text-slate-500 mt-2">
              O sistema importa apenas experiencias profissionais para facilitar a revisao.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className={`px-2 py-1 rounded-lg border ${hasResumeFile ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500"}`}>
                1. Arquivo carregado: {hasResumeFile ? "OK" : "Pendente"}
              </div>
              <div className={`px-2 py-1 rounded-lg border ${hasResumeParsed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500"}`}>
                2. Leitura concluída: {hasResumeParsed ? "OK" : "Pendente"}
              </div>
              <div className={`sm:col-span-2 px-2 py-1 rounded-lg border ${resumeReadConfirmed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                3. Confirmação do usuário: {resumeReadConfirmed ? "Confirmada" : "Pendente"}
              </div>
            </div>
            {isParsingResume && <p className="text-sm text-blue-700 mt-2">Lendo e interpretando currículo...</p>}
            {resumeFileName && !isParsingResume && (
              <p className="text-sm text-emerald-700 mt-2">Arquivo processado: {resumeFileName}</p>
            )}
            {resumeFileName && !isParsingResume && !resumeReadConfirmed && (
              <button
                type="button"
                onClick={() => setResumeReadConfirmed(true)}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                Confirmar carregamento e leitura do currículo
              </button>
            )}
            {resumeReadConfirmed && (
              <p className="text-sm text-emerald-700 mt-2 font-semibold">Leitura do currículo confirmada.</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleFillFromLinkedIn}
            className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
          >
            Carregar informações e experiências do LinkedIn
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            A importação automática de experiências só é possível para contas logadas com LinkedIn.
          </p>
          {isLinkedInLogin && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Login LinkedIn detectado. Se o LinkedIn disponibilizar os dados, cargo, empresa, período e descrição serão carregados.
            </p>
          )}
          {info && info.toLowerCase().includes("linkedin") && (
            <p className="text-sm text-emerald-700 mt-2">{info}</p>
          )}

          <div className="hidden md:block space-y-4">
            {renderEditableResumeData()}
          </div>

          <details className="md:hidden bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4">
            <summary className="cursor-pointer font-semibold text-slate-700">
              Verificar e editar dados extraídos do currículo
            </summary>
            <div className="mt-3 space-y-4">
              {renderEditableResumeData()}
            </div>
          </details>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Avatar</label>
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
              <div className="h-16 w-16 rounded-full overflow-hidden border border-blue-200 bg-white flex items-center justify-center text-2xl">
                {avatar ? (
                  typeof avatar === "string" && avatar.startsWith("data:") ? (
                    <img src={avatar} alt="Preview do avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span>{avatar}</span>
                  )
                ) : (
                  <span className="text-slate-400">👤</span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Pré-visualização da imagem</p>
                <p className="text-xs text-slate-500">Use o botão "Salvar imagem" para aplicar no app.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {predefinedAvatars.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setAvatar(item);
                    setAvatarFileLabel("Nenhum escolhido");
                    setAvatarDirty(true);
                  }}
                  className={`h-12 w-12 rounded-xl border flex items-center justify-center text-2xl ${
                    avatar === item ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <label
                htmlFor="avatar-upload-input"
                className="px-3 py-2 text-sm rounded-lg border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition cursor-pointer"
              >
                Escolher perfil
              </label>
              <input
                id="avatar-upload-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <span className="text-sm text-slate-600">{avatarFileLabel}</span>
              {avatar && typeof avatar === "string" && avatar.startsWith("data:") && (
                <span className="text-sm text-slate-600">Imagem carregada</span>
              )}
            </div>
            {avatarDirty && (
              <button
                type="button"
                onClick={handleSaveAvatar}
                disabled={isSavingAvatar}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingAvatar ? "Salvando imagem..." : "Salvar imagem"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="confirm-human"
              checked={confirmedHuman}
              onChange={(e) => setConfirmedHuman(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="confirm-human" className="text-sm text-slate-700">
              Não sou um robô e concordo em enviar uma avaliação sincera.
            </label>
          </div>

          {info && <p className="text-emerald-700 text-sm">{info}</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
          >
            Salvar perfil
          </button>

          <div className="pt-2 text-center">
            <Link
              to="/excluir-dados"
              className="inline-block text-sm font-semibold text-red-700 hover:text-red-800 hover:underline"
            >
              Excluir meus dados
            </Link>
          </div>
          </form>
        </div>

        <aside className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-4 border border-blue-100 dark:border-slate-700 h-fit sticky top-6">
          <h2 className="text-sm font-bold text-blue-800 mb-3">Curriculo para verificacao</h2>
          {!resumePreviewUrl ? (
            <p className="text-sm text-slate-500">Carregue um curriculo para visualizar aqui.</p>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                {resumeMimeType === "application/pdf" ? (
                  <iframe title="Preview do curriculo" src={resumePreviewUrl} className="w-full h-64" />
                ) : (
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap p-3 max-h-64 overflow-auto">
                    {(resumeText || "").slice(0, 1800) || "Nao foi possivel montar preview visual para este formato."}
                  </pre>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsResumePreviewExpanded(true)}
                className="mt-3 w-full py-2 rounded-lg border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50"
              >
                Ampliar verificacao
              </button>
            </>
          )}
        </aside>
      </div>

      {isResumePreviewExpanded && (
        <div className="fixed inset-0 z-50 bg-black/70 p-6 flex items-center justify-center">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-blue-800">Visualizacao ampliada do curriculo</h3>
              <button
                type="button"
                onClick={() => setIsResumePreviewExpanded(false)}
                className="px-3 py-1 rounded-lg border border-gray-300 text-slate-700 hover:bg-gray-100"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden">
              {resumeMimeType === "application/pdf" ? (
                <iframe title="Preview ampliado do curriculo" src={resumePreviewUrl} className="w-full h-full" />
              ) : (
                <pre className="text-sm text-slate-700 whitespace-pre-wrap p-4 h-full overflow-auto">
                  {resumeText || "Nao foi possivel montar preview visual para este formato."}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChoosePseudonym;
