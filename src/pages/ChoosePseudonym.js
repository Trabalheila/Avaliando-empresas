import React, { useCallback, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getUserProfile, getUserProfileByCpf, saveUserProfile } from "../services/users";
import { normalizeEmail, resolveProfileId } from "../utils/profileIdentity";

const predefinedAvatars = [
  "🧑", "🧑‍💼", "🧑‍🔧", "🧑‍💻", "🧑‍🔬", "👩‍🏫", "👨‍🍳", "👩‍⚕️", "👨‍🚀", "👩‍🎨",
];

function mapLinkedInExperience(item) {
  if (!item) return null;
  const role = (item?.title || item?.role || item?.position || item?.occupation || "").toString().trim();
  const company = (item?.company || item?.companyName || item?.organization || item?.employer || "").toString().trim();
  if (!company && !role) return null;
  return { company, role, source: "linkedin", verified: true };
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
    const key = [item.company, item.role].join("__").toLowerCase();
    if (!dedupe.has(key)) dedupe.set(key, item);
  });
  return Array.from(dedupe.values());
}

function parsePastedText(rawText, source) {
  const text = (rawText || "").toString().replace(/\r/g, "").trim();
  if (!text) return [];
  const results = [];
  const blocks = text.split(/\n\s*\n+/).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const role = lines[0].replace(/[·•\-–—]/g, "").trim();
    const company = (lines[1] || "")
      .replace(/^(at|em|na|no|@)\s+/i, "")
      .split(/[·•\-–—]/)[0]
      .trim();

    if (
      role &&
      company &&
      !/^\d{4}/.test(role) &&
      !/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i.test(role)
    ) {
      results.push({ company, role, source, verified: false });
    }
  }

  const dedupe = new Map();
  results.forEach((item) => {
    const key = [item.company, item.role].join("__").toLowerCase();
    if (!dedupe.has(key)) dedupe.set(key, item);
  });
  return Array.from(dedupe.values());
}

function dedupeExperiences(list) {
  const dedupe = new Map();
  (list || []).forEach((item) => {
    const key = [(item?.company || "").toLowerCase(), (item?.role || "").toLowerCase()].join("__");
    if (!dedupe.has(key)) dedupe.set(key, item);
  });
  return Array.from(dedupe.values());
}

function ChoosePseudonym({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [pseudonym, setPseudonym] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [structuredExperiences, setStructuredExperiences] = useState([]);
  const [avatar, setAvatar] = useState(predefinedAvatars[0]);
  const [avatarFileLabel, setAvatarFileLabel] = useState("Nenhum escolhido");
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [confirmedHuman, setConfirmedHuman] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState(null);
  const [isLinkedInLogin, setIsLinkedInLogin] = useState(false);
  const [solidesText, setSolidesText] = useState("");
  const [glassdoorText, setGlassdoorText] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualRole, setManualRole] = useState("");
  const [isCertifiedProfile, setIsCertifiedProfile] = useState(false);
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [verifiedCompany, setVerifiedCompany] = useState("");
  const [verificationSource, setVerificationSource] = useState("");
  const avatarUploadInputRef = useRef(null);

  const loadPersistedProfile = useCallback(async (profile) => {
    const candidates = [];
    const resolvedId = resolveProfileId(profile, { persistGeneratedId: false });
    const rawId = (profile?.id || "").toString().trim();
    const profileEmail = normalizeEmail(profile?.email);

    if (resolvedId) candidates.push(resolvedId);
    if (rawId && !candidates.includes(rawId)) candidates.push(rawId);
    if (profileEmail && !candidates.includes(profileEmail)) candidates.push(profileEmail);

    for (const candidate of candidates) {
      try {
        const persisted = await getUserProfile(candidate);
        if (persisted) return persisted;
      } catch {
        // Try next candidate.
      }
    }

    return null;
  }, []);

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
    if (profile?.resumeData?.name || profile?.fullName) setFullName(profile.resumeData?.name || profile.fullName);
    if (profile?.email) setEmail(profile.email);
    if (profile?.phone) setPhone(profile.phone);
    if (profile?.educationLevel) setEducationLevel(profile.educationLevel);
    if (Array.isArray(profile?.resumeData?.experiencesStructured)) {
      setStructuredExperiences(profile.resumeData.experiencesStructured);
    }
    const resolvedAvatar = profile?.avatar || profile?.picture || "";
    if (resolvedAvatar) {
      setAvatar(resolvedAvatar);
      setAvatarFileLabel(
        typeof resolvedAvatar === "string" && resolvedAvatar.startsWith("data:") ? "Imagem atual" : "Nenhum escolhido"
      );
      setAvatarDirty(false);
    }
  }, []);

  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (!profile) {
      localStorage.setItem("userProfile", JSON.stringify({ loginProvider: "anonymous", fallback: true }));
      return;
    }

    try {
      const parsed = JSON.parse(profile);
      applyProfileToState(parsed);

      loadPersistedProfile(parsed)
        .then((remoteProfile) => {
          if (!remoteProfile) return;
          const mergedProfile = {
            ...remoteProfile,
            ...parsed,
            profileId: resolveProfileId(parsed),
            resumeData: {
              ...(remoteProfile?.resumeData || {}),
              ...(parsed?.resumeData || {}),
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
    } catch {
      // ignore
    }
  }, [navigate, applyProfileToState, loadPersistedProfile]);

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
      const profileId = resolveProfileId(existingProfile);
      const nextProfile = {
        ...existingProfile,
        profileId,
        avatar,
        picture: avatar || existingProfile?.picture || "",
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      try {
        await saveUserProfile({ id: profileId, ...nextProfile });
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

  const handleFillFromLinkedIn = useCallback(async () => {
    try {
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      setInfo("");
      setError(null);

      let mergedProfile = { ...existingProfile };
      const accountId = resolveProfileId(existingProfile, { persistGeneratedId: false });
      if (accountId || existingProfile?.id || existingProfile?.email) {
        try {
          const persisted = await loadPersistedProfile(existingProfile);
          if (persisted) {
            mergedProfile = {
              ...persisted,
              ...existingProfile,
              profileId: resolveProfileId(existingProfile),
              resumeData: {
                ...(persisted?.resumeData || {}),
                ...(existingProfile?.resumeData || {}),
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
        setStructuredExperiences((prev) => dedupeExperiences([...linkedInExperiences, ...prev]));
        loadedFields.push(`${linkedInExperiences.length} experiência(s)`);
      }

      if (loadedFields.length > 0) {
        setInfo(`Dados carregados do LinkedIn: ${loadedFields.join(", ")}.`);
      } else {
        setInfo("Não encontramos novos dados de LinkedIn para preencher automaticamente.");
      }
    } catch {
      setError("Não foi possível carregar dados do LinkedIn no momento.");
    }
  }, [loadPersistedProfile]);

  const handleImportSolidesText = useCallback(() => {
    setError(null);
    setInfo("");
    const imported = parsePastedText(solidesText, "solides");
    if (!imported.length) {
      setInfo("Não foi possível identificar experiências no texto colado do Solides.");
      return;
    }
    setStructuredExperiences((prev) => dedupeExperiences([...prev, ...imported]));
    setInfo(`Importamos ${imported.length} experiência(s) do Solides.`);
  }, [solidesText]);

  const handleImportGlassdoorText = useCallback(() => {
    setError(null);
    setInfo("");
    const imported = parsePastedText(glassdoorText, "glassdoor");
    if (!imported.length) {
      setInfo("Não foi possível identificar experiências no texto colado do Glassdoor.");
      return;
    }
    setStructuredExperiences((prev) => dedupeExperiences([...prev, ...imported]));
    setInfo(`Importamos ${imported.length} experiência(s) do Glassdoor.`);
  }, [glassdoorText]);

  const handleAddManualExperience = useCallback(() => {
    setError(null);
    setInfo("");
    const company = manualCompany.trim();
    const role = manualRole.trim();
    if (!company || !role) {
      setError("Preencha empresa e cargo para adicionar.");
      return;
    }
    setStructuredExperiences((prev) =>
      dedupeExperiences([...prev, { company, role, source: "manual", verified: false }])
    );
    setManualCompany("");
    setManualRole("");
    setInfo("Experiência adicionada manualmente.");
  }, [manualCompany, manualRole]);

  const handleRemoveExperience = (idx) => {
    setStructuredExperiences((prev) => prev.filter((_, i) => i !== idx));
  };

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

      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const accountId = resolveProfileId(existingProfile, { persistGeneratedId: false });

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
        profileId: resolveProfileId(existingProfile),
        name: trimmed,
        fullName: fullName.trim() || undefined,
        cpf: cpfNumbers || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        educationLevel: educationLevel.trim() || undefined,
        avatar,
        picture: avatar || existingProfile?.picture || undefined,
        verification: {
          ...(existingProfile?.verification || {}),
          certified: isCertifiedProfile,
          pending: isVerificationPending,
          company: verifiedCompany || undefined,
          source: verificationSource || undefined,
          certifiedAt: isCertifiedProfile
            ? existingProfile?.verification?.certifiedAt || new Date().toISOString()
            : undefined,
        },
        resumeData: {
          ...(existingProfile?.resumeData || {}),
          name: fullName.trim() || undefined,
          experiences: structuredExperiences.map((item) => item.company).filter(Boolean),
          experiencesStructured: structuredExperiences,
          parsedAt: new Date().toISOString(),
        },
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));

      try {
        await saveUserProfile({ id: nextProfile.profileId, ...nextProfile });
      } catch (err) {
        console.warn("Falha ao salvar perfil no Firebase:", err);
      }

      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      navigate("/");
    },
    [
      navigate,
      pseudonym,
      cpf,
      fullName,
      email,
      phone,
      educationLevel,
      avatar,
      confirmedHuman,
      structuredExperiences,
      isCertifiedProfile,
      verifiedCompany,
      isVerificationPending,
      verificationSource,
    ]
  );

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
      <div className="w-full max-w-2xl">
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

          <h1 className="text-2xl font-extrabold font-azonix tracking-wide text-blue-800 dark:text-blue-200 mb-4 text-center">
            Seu perfil anônimo
          </h1>

          {isCertifiedProfile && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800 text-sm font-semibold text-center">
              Selo certificado ativo{verifiedCompany ? ` para ${verifiedCompany}` : ""}.
            </div>
          )}
          {!isCertifiedProfile && isVerificationPending && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 text-sm font-semibold text-center">
              Vínculo em validação{verifiedCompany ? ` para ${verifiedCompany}` : ""}. O selo certificado será liberado
              apenas com evidência verificável do LinkedIn.
            </div>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Essas informações ajudam a manter a qualidade das avaliações. Seus dados são armazenados localmente e não
            serão compartilhados.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Pseudônimo */}
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

            {/* E-mail */}
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

            {/* CPF */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                CPF (apenas números)
              </label>
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

            {/* ===== IMPORTAÇÃO DE EXPERIÊNCIAS ===== */}
            <div className="bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-1">
                  Experiências profissionais
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Importe de uma plataforma ou adicione manualmente. Apenas empresa e cargo são necessários.
                </p>
              </div>

              {/* 1. LinkedIn OAuth */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  LinkedIn (verificado automaticamente)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                  Experiências importadas via login LinkedIn recebem selo de autenticidade.
                </p>
                <button
                  type="button"
                  onClick={handleFillFromLinkedIn}
                  className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
                >
                  Importar do LinkedIn
                </button>
                {isLinkedInLogin && (
                  <p className="text-xs text-emerald-700 mt-2">Login LinkedIn detectado.</p>
                )}
              </div>

              {/* 2. Solides — colagem de texto */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  Solides (colagem de texto)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                  Cole o texto da seção de experiências do seu perfil Solides.
                </p>
                <textarea
                  value={solidesText}
                  onChange={(e) => setSolidesText(e.target.value)}
                  rows={4}
                  placeholder="Cole aqui o texto do seu perfil Solides..."
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleImportSolidesText}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  Importar do Solides
                </button>
              </div>

              {/* 3. Glassdoor — colagem de texto */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  Glassdoor (colagem de texto)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                  Cole o texto da seção de experiências do seu perfil Glassdoor.
                </p>
                <textarea
                  value={glassdoorText}
                  onChange={(e) => setGlassdoorText(e.target.value)}
                  rows={4}
                  placeholder="Cole aqui o texto do seu perfil Glassdoor..."
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleImportGlassdoorText}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  Importar do Glassdoor
                </button>
              </div>

              {/* Não tem conta? Criar conta */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  Não tem conta em nenhuma plataforma?
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <a
                    href="https://www.linkedin.com/signup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Criar conta no LinkedIn
                  </a>
                  <a
                    href="https://www.solides.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Criar conta no Solides
                  </a>
                  <a
                    href="https://www.glassdoor.com.br/member/join.htm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    Criar conta no Glassdoor
                  </a>
                </div>

                {/* Adicionar manualmente */}
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Ou adicione manualmente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    placeholder="Empresa"
                    className="w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <input
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                    placeholder="Cargo / Função"
                    className="w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddManualExperience}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  Adicionar experiência
                </button>
              </div>

              {/* Lista de experiências adicionadas */}
              {structuredExperiences.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Experiências adicionadas ({structuredExperiences.length})
                  </p>
                  <div className="space-y-2">
                    {structuredExperiences.map((exp, idx) => (
                      <div
                        key={`${idx}_${exp.company}_${exp.role}`}
                        className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-600 p-3"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {exp.role || "Cargo não informado"}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {exp.company || "Empresa não informada"}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                exp.verified
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              }`}
                            >
                              {exp.verified ? "✓ Verificado" : "Não verificado"}
                            </span>
                            <span className="text-[11px] text-slate-400">via {exp.source || "manual"}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExperience(idx)}
                          className="text-xs text-red-600 font-semibold hover:underline flex-shrink-0"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
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
                      if (avatarUploadInputRef.current) avatarUploadInputRef.current.value = "";
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
                    if (avatarUploadInputRef.current) avatarUploadInputRef.current.value = "";
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

            {/* Confirmação humano */}
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
      </div>
    </div>
  );
}

export default ChoosePseudonym;
