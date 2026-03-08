import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
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

function normalizeCompanyName(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeLinkedInText(rawText) {
  return (rawText || "")
    .toString()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\s+/, "")
    .replace(/\n{3,}/g, "\n\n");
}

function findMatchingCompany(importedExperiences, availableCompanies) {
  const normalizedCompanies = (availableCompanies || []).map((name) => ({
    original: name,
    normalized: normalizeCompanyName(name),
  }));

  for (const exp of importedExperiences || []) {
    const expName = normalizeCompanyName(exp?.company);
    if (!expName) continue;

    const exact = normalizedCompanies.find((item) => item.normalized === expName);
    if (exact) return exact.original;

    const partial = normalizedCompanies.find(
      (item) => item.normalized.includes(expName) || expName.includes(item.normalized)
    );
    if (partial) return partial.original;
  }

  return "";
}

function parseLinkedInExperienceText(rawText) {
  const text = (rawText || "").toString().replace(/\r/g, "").trim();
  if (!text) return [];

  const periodHintPattern =
    /(\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b\s+de\s+\d{4}|\b\d{4}\b)\s*(?:-|ate|até|a)\s*(?:\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b\s+de\s+\d{4}|\b\d{4}\b|atual|momento|presente)/i;
  const locationHintPattern = /(brasil|presencial|hibrid|híbrida|remoto|rio de janeiro|sao paulo|salvador|curitiba|porto alegre)/i;

  const blocks = text
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length >= 2);

  const parsed = blocks.map((lines) => {
    const role = lines[0] || "Nao identificado";
    const company = (lines[1] || "").split("·")[0].trim() || "Nao identificado";
    const periodLine = lines.find((line) => periodHintPattern.test(line)) || "";

    const details = lines
      .filter((line, idx) => idx > 1)
      .filter((line) => line !== periodLine)
      .filter((line) => !locationHintPattern.test(line))
      .join(" | ");

    if (!role && !company && !periodLine) return null;

    return {
      company,
      role,
      period: periodLine,
      details,
      confidence: periodLine ? 0.88 : 0.72,
      confidenceLevel: periodLine ? "alta" : "media",
      source: "linkedin_text",
    };
  }).filter(Boolean);

  const dedupe = new Map();
  parsed.forEach((item) => {
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

function mergeExperienceLists(previousItems, incomingItems) {
  const merged = [...(incomingItems || []), ...(previousItems || [])];
  const dedupe = new Map();

  merged.forEach((item) => {
    const key = [
      normalizeCompanyName(item?.company),
      (item?.role || "").toString().trim().toLowerCase(),
      (item?.period || "").toString().trim().toLowerCase(),
    ].join("__");

    if (!dedupe.has(key)) {
      dedupe.set(key, item);
    }
  });

  return Array.from(dedupe.values());
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
  const [linkedInExperienceText, setLinkedInExperienceText] = useState("");
  const [manualLinkedInExperience, setManualLinkedInExperience] = useState({
    role: "",
    company: "",
    period: "",
    details: "",
  });
  const [matchedCompanyCandidate, setMatchedCompanyCandidate] = useState("");
  const [matchedCompanyEvidenceSource, setMatchedCompanyEvidenceSource] = useState("");
  const [verifiedCompany, setVerifiedCompany] = useState("");
  const [isCertifiedProfile, setIsCertifiedProfile] = useState(false);
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [verificationSource, setVerificationSource] = useState("");
  const avatarUploadInputRef = useRef(null);

  const applyProfileToState = useCallback((profile) => {
    if (!profile) return;

    const provider = (profile?.loginProvider || "").toString().toLowerCase();
    setIsLinkedInLogin(provider === "linkedin" || Boolean(profile?.linkedInUrl));
    setIsCertifiedProfile(Boolean(profile?.verification?.certified));
    setIsVerificationPending(Boolean(profile?.verification?.pending));
    setVerifiedCompany((profile?.verification?.company || "").toString());
    setVerificationSource((profile?.verification?.source || "").toString());

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

  const availableCompanies = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("empresasData") || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.map((item) => item?.company).filter(Boolean);
    } catch {
      return [];
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
    } finally {
      // Permite selecionar o mesmo arquivo novamente em tentativas futuras.
      e.target.value = "";
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

      setStructuredExperiences((prev) =>
        normalizeExperiencesForReview(mergeExperienceLists(prev, parsed.experiencesStructured || []))
      );
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
        setStructuredExperiences((prev) =>
          normalizeExperiencesForReview(mergeExperienceLists(prev, linkedInExperiences))
        );
        setResumeReadConfirmed(true);
        loadedFields.push(`${linkedInExperiences.length} experiencias`);

        const candidate = findMatchingCompany(linkedInExperiences, availableCompanies);
        if (candidate) {
          setMatchedCompanyCandidate(candidate);
          setMatchedCompanyEvidenceSource("linkedin_api");
          loadedFields.push(`empresa candidata: ${candidate}`);
        }
      }

      if (loadedFields.length > 0) {
        setInfo(`Dados carregados do LinkedIn: ${loadedFields.join(", ")}.`);
      } else {
        setInfo("Nao encontramos novos dados de LinkedIn para preencher automaticamente.");
      }
    } catch {
      setError("Não foi possível carregar dados do LinkedIn no momento.");
    }
  }, [availableCompanies]);

  const handleImportLinkedInText = useCallback(() => {
    setError(null);
    setInfo("");
    setMatchedCompanyCandidate("");
    setMatchedCompanyEvidenceSource("");

    const sanitizedText = sanitizeLinkedInText(linkedInExperienceText);
    const imported = parseLinkedInExperienceText(sanitizedText);
    if (!imported.length) {
      setInfo("Nao foi possivel identificar experiencias no texto colado.");
      return;
    }

    setStructuredExperiences((prev) => {
      const preserved = (prev || []).filter((item) => item?.source !== "linkedin_text");
      return normalizeExperiencesForReview(mergeExperienceLists(preserved, imported));
    });

    setLinkedInExperienceText(sanitizedText);

    const candidate = findMatchingCompany(imported, availableCompanies);
    if (candidate) {
      setMatchedCompanyCandidate(candidate);
      setMatchedCompanyEvidenceSource("linkedin_text");
      setInfo(
        `Importamos ${imported.length} experiencia(s). Encontramos a empresa "${candidate}" na lista inicial. Confirme abaixo para solicitar validação.`
      );
    } else {
      setInfo(
        `Importamos ${imported.length} experiencia(s), mas nenhuma empresa bateu com a lista inicial. Cadastre a empresa primeiro na página inicial para validação.`
      );
    }

    setResumeReadConfirmed(true);
  }, [linkedInExperienceText, availableCompanies]);

  const handleManualLinkedInExperienceChange = useCallback((field, value) => {
    setManualLinkedInExperience((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleAddManualLinkedInExperience = useCallback(() => {
    setError(null);
    setInfo("");
    setMatchedCompanyCandidate("");
    setMatchedCompanyEvidenceSource("");

    const nextItem = {
      company: (manualLinkedInExperience.company || "").toString().trim(),
      role: (manualLinkedInExperience.role || "").toString().trim(),
      period: (manualLinkedInExperience.period || "").toString().trim(),
      details: (manualLinkedInExperience.details || "").toString().trim(),
      confidence: 0.86,
      confidenceLevel: "alta",
      source: "linkedin_manual",
      reviewStatus: "pendente",
    };

    if (!nextItem.company || !nextItem.role) {
      setError("Preencha pelo menos empresa e cargo para adicionar a experiência manual.");
      return;
    }

    setStructuredExperiences((prev) => {
      return normalizeExperiencesForReview(mergeExperienceLists(prev, [nextItem]));
    });

    const candidate = findMatchingCompany([nextItem], availableCompanies);
    if (candidate) {
      setMatchedCompanyCandidate(candidate);
      setMatchedCompanyEvidenceSource("linkedin_manual");
      setInfo(
        `Experiência adicionada. Encontramos a empresa "${candidate}" na lista inicial. Confirme abaixo para solicitar validação.`
      );
    } else {
      setInfo(
        "Experiência adicionada. Para validação, a empresa precisa estar previamente cadastrada na página inicial."
      );
    }

    setResumeReadConfirmed(true);
    setManualLinkedInExperience({
      role: "",
      company: "",
      period: "",
      details: "",
    });
  }, [manualLinkedInExperience, availableCompanies]);

  const handleConfirmMatchedCompany = useCallback(async () => {
    if (!matchedCompanyCandidate) return;

    setError(null);
    setInfo("");
    try {
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const isTrustedEvidence = matchedCompanyEvidenceSource === "linkedin_api" && isLinkedInLogin;

      const nextVerification = isTrustedEvidence
        ? {
            certified: true,
            pending: false,
            company: matchedCompanyCandidate,
            source: "linkedin_api",
            certifiedAt: new Date().toISOString(),
          }
        : {
            certified: false,
            pending: true,
            company: matchedCompanyCandidate,
            source: matchedCompanyEvidenceSource || "manual",
            requestedAt: new Date().toISOString(),
          };

      const nextProfile = {
        ...existingProfile,
        verification: nextVerification,
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));
      setIsCertifiedProfile(!!nextVerification.certified);
      setIsVerificationPending(!!nextVerification.pending);
      setVerificationSource(nextVerification.source || "");
      setVerifiedCompany(matchedCompanyCandidate);

      try {
        await saveUserProfile({
          id: nextProfile.id || nextProfile.email || `anon_${Date.now()}`,
          ...nextProfile,
        });
      } catch (err) {
        console.warn("Falha ao salvar selo certificado no Firebase:", err);
      }

      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      if (isTrustedEvidence) {
        setInfo(`Verificação confirmada para ${matchedCompanyCandidate}. Selo certificado ativado.`);
      } else {
        setInfo(
          `Vínculo com ${matchedCompanyCandidate} registrado como pendente. O selo certificado só é liberado com evidência verificável do login LinkedIn.`
        );
      }
      setMatchedCompanyCandidate("");
      setMatchedCompanyEvidenceSource("");
    } catch {
      setError("Nao foi possivel concluir a verificacao agora.");
    }
  }, [matchedCompanyCandidate, matchedCompanyEvidenceSource, isLinkedInLogin]);

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
        verification: {
          ...(existingProfile?.verification || {}),
          certified: isCertifiedProfile,
          pending: isVerificationPending,
          company: verifiedCompany || undefined,
          source: verificationSource || undefined,
          certifiedAt: isCertifiedProfile ? (existingProfile?.verification?.certifiedAt || new Date().toISOString()) : undefined,
        },
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
      isCertifiedProfile,
      verifiedCompany,
      isVerificationPending,
      verificationSource,
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
      {(info || error) && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,56rem)]">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold shadow">
              {error}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm font-semibold shadow">
              {info}
            </div>
          )}
        </div>
      )}
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
          <h1 className="text-2xl font-extrabold font-azonix tracking-wide text-blue-800 dark:text-blue-200 mb-4 text-center">Seu perfil anônimo</h1>
          {isCertifiedProfile && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800 text-sm font-semibold text-center">
              Selo certificado ativo{verifiedCompany ? ` para ${verifiedCompany}` : ""}.
            </div>
          )}
          {!isCertifiedProfile && isVerificationPending && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 text-sm font-semibold text-center">
              Vínculo em validação{verifiedCompany ? ` para ${verifiedCompany}` : ""}. O selo certificado será liberado apenas com evidência verificável do LinkedIn.
            </div>
          )}
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
          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
            Para ser verificado, a empresa da sua experiência precisa estar previamente cadastrada na página inicial.
          </p>
          {isLinkedInLogin && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Login LinkedIn detectado. Se o LinkedIn disponibilizar os dados, cargo, empresa, período e descrição serão carregados.
            </p>
          )}
          {info && info.toLowerCase().includes("linkedin") && (
            <p className="text-sm text-emerald-700 mt-2">{info}</p>
          )}

          {matchedCompanyCandidate && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900 font-semibold">Empresa encontrada para verificação</p>
              <p className="text-lg font-extrabold text-amber-800 mt-1">{matchedCompanyCandidate}</p>
              <p className="text-xs text-amber-800 mt-1">
                Evidência identificada: {matchedCompanyEvidenceSource === "linkedin_api" ? "LinkedIn API (verificável)" : matchedCompanyEvidenceSource === "linkedin_text" ? "Texto colado do LinkedIn" : "Experiência manual"}
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Essa é a empresa que você quer validar?
              </p>
              {matchedCompanyEvidenceSource !== "linkedin_api" && (
                <p className="text-xs text-amber-900 mt-1 font-semibold">
                  Atenção: este tipo de evidência gera vínculo pendente, não selo certificado automático.
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmMatchedCompany}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  Sim, confirmar vínculo
                </button>
                <button
                  type="button"
                  onClick={() => setMatchedCompanyCandidate("")}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100"
                >
                  Não, escolher outra
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-50/80 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl p-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Plano B: colar seção Experiência do LinkedIn</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
              Se o LinkedIn nao liberar as experiencias via API, cole aqui o texto da sua seção "Experiência" para importar cargo, empresa, periodo e descricao.
            </p>
            <textarea
              value={linkedInExperienceText}
              onChange={(e) => setLinkedInExperienceText(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = e.clipboardData?.getData("text") || "";
                setLinkedInExperienceText(sanitizeLinkedInText(pasted));
              }}
              rows={6}
              placeholder="Cole aqui as experiências do LinkedIn..."
              className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleImportLinkedInText}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              Importar experiências do texto colado
            </button>
          </div>

          <div className="bg-blue-50/80 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl p-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Adicionar experiência manual do LinkedIn</p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
              Use este campo quando quiser inserir experiências manualmente. O vínculo com a empresa segue o mesmo procedimento de validação.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={manualLinkedInExperience.role}
                onChange={(e) => handleManualLinkedInExperienceChange("role", e.target.value)}
                placeholder="Cargo"
                className="w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              <input
                value={manualLinkedInExperience.company}
                onChange={(e) => handleManualLinkedInExperienceChange("company", e.target.value)}
                placeholder="Empresa"
                className="w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
            </div>

            <input
              value={manualLinkedInExperience.period}
              onChange={(e) => handleManualLinkedInExperienceChange("period", e.target.value)}
              placeholder="Período (ex.: fev 2024 - mar 2026)"
              className="mt-2 w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />

            <textarea
              value={manualLinkedInExperience.details}
              onChange={(e) => handleManualLinkedInExperienceChange("details", e.target.value)}
              rows={3}
              placeholder="Breve descrição das atividades"
              className="mt-2 w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />

            <button
              type="button"
              onClick={handleAddManualLinkedInExperience}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              Adicionar experiência manual
            </button>
          </div>

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
                    if (avatarUploadInputRef.current) {
                      avatarUploadInputRef.current.value = "";
                    }
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
                onClick={() => {
                  if (avatarUploadInputRef.current) {
                    avatarUploadInputRef.current.value = "";
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition cursor-pointer"
              >
                Escolher perfil
              </label>
              <input
                ref={avatarUploadInputRef}
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
