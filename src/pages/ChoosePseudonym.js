import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, getUserProfileByCpf, saveUserProfile, findUnifiedProfile } from "../services/users";
import { normalizeEmail, resolveProfileId } from "../utils/profileIdentity";
import { extractResumeText, parseResumeText } from "../utils/resumeParser";
import { listCompanies } from "../services/companies";
import AppHeader from "../components/AppHeader";
import { getLinkedInRedirectUri } from "../utils/linkedinAuth";
import { buildApiUrl } from "../utils/apiBase";
import { auth, db } from "../firebase";
import {
  signInAnonymously,
  onAuthStateChanged,
  EmailAuthProvider,
  linkWithCredential,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { resolveUserVerificationDetail } from "../utils/verificationLevel";

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

function dedupeExperiences(list) {
  const dedupe = new Map();
  (list || []).forEach((item) => {
    const key = [(item?.company || "").toLowerCase(), (item?.role || "").toLowerCase()].join("__");
    if (!dedupe.has(key)) dedupe.set(key, item);
  });
  return Array.from(dedupe.values());
}

// Aplica a máscara visual ###.###.###-## à medida que o usuário digita.
function maskCpf(value) {
  const d = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Validação local dos dígitos verificadores do CPF.
function isValidCpfDigits(input) {
  const c = String(input || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

// Normalização para comparação case + accent insensitive (ex.: "Camargo Corrêa" → "camargo correa").
// Compactamos espaços e descartamos pontuação para reduzir falsos negativos.
function normalizeForCompanyMatch(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Procura, no texto fornecido, a primeira empresa cadastrada cujo nome
// (case + accent insensitive) aparece como substring. Retorna o nome
// canônico (como está cadastrado) ou null. Empresas com nome muito curto
// (< 3 caracteres normalizados) são ignoradas para evitar falsos positivos.
function findCompanyInText(text, registeredCompanies) {
  const normalizedText = normalizeForCompanyMatch(text);
  if (!normalizedText) return null;
  const list = Array.isArray(registeredCompanies) ? registeredCompanies : [];
  // Ordena por tamanho desc para preferir matches mais específicos
  // (ex.: "Banco do Brasil S.A." antes de "Banco do Brasil").
  const sorted = [...list].sort(
    (a, b) => normalizeForCompanyMatch(b).length - normalizeForCompanyMatch(a).length
  );
  for (const companyName of sorted) {
    const normalized = normalizeForCompanyMatch(companyName);
    if (!normalized || normalized.length < 3) continue;
    if (normalizedText.includes(normalized)) return companyName;
  }
  return null;
}

function ChoosePseudonym({ theme, toggleTheme }) {
  const navigate = useNavigate();
  // UID anônimo (ou autenticado) usado para registrar o funil de cadastro
  // na coleção cadastros_iniciados. Persistido em ref para o handleSubmit.
  const funnelUidRef = useRef(null);
  // Cadastro em duas etapas:
  //   1 → obrigatório: pseudônimo + e-mail (com aviso de privacidade)
  //   2 → opcional: CPF, escolaridade, avatar, experiências…
  // Quem já tem pseudônimo+email salvos no profile entra direto na etapa 2.
  const [step, setStep] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("userProfile") || "{}");
      // IMPORTANTE: nunca usar `saved.name` como fallback de pseudônimo —
      // esse campo pode conter o nome real vindo do LinkedIn/Google e não
      // deve ser tratado como identidade anônima do usuário.
      const hasPseudo = Boolean((saved?.pseudonimo || "").toString().trim());
      const hasEmail = Boolean((saved?.email || "").toString().trim());
      return hasPseudo && hasEmail ? 2 : 1;
    } catch {
      return 1;
    }
  });
  const [pseudonym, setPseudonym] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [birthdateError, setBirthdateError] = useState("");
  const [cpf, setCpf] = useState("");
  const [fullName, setFullName] = useState("");
  // Estado da consulta automática de CPF (Receita / provedor externo).
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [cpfNotice, setCpfNotice] = useState("");
  const [cpfVerified, setCpfVerified] = useState(false);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedEmailValue, setVerifiedEmailValue] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("");
  // Campos opcionais de senha — quando preenchidos, vinculamos a conta
  // (anônima ou recém-criada) a credenciais de e-mail/senha do Firebase.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
  const [manualCompany, setManualCompany] = useState("");
  const [manualRole, setManualRole] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumePreviewUrl, setResumePreviewUrl] = useState(null);
  // Experiências extraídas do currículo aguardando revisão do usuário (apenas empresa + cargo).
  const [pendingResumeExperiences, setPendingResumeExperiences] = useState([]);
  // Texto bruto do currículo carregado, usado para verificação cruzada de empresa.
  const [resumeFullText, setResumeFullText] = useState("");
  // Lista de empresas conhecidas para autocompletar (carregada do Firestore).
  const [knownCompanies, setKnownCompanies] = useState([]);
  const [isCertifiedProfile, setIsCertifiedProfile] = useState(false);
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [verifiedCompany, setVerifiedCompany] = useState("");
  const [verificationSource, setVerificationSource] = useState("");
  const avatarUploadInputRef = useRef(null);

  // ─── Barra de progresso flutuante ───
  const formRef = useRef(null);
  const sectionRefs = useRef([]);
  const [formVisible, setFormVisible] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const SECTION_LABELS = [
    "Pseudônimo",
    "E-mail",
    "Nome completo",
    "CPF",
    "Experiências",
    "Avatar",
    "Confirmação",
  ];
  const totalSections = SECTION_LABELS.length;

  const assignSectionRef = useCallback((el, idx) => {
    if (el) sectionRefs.current[idx] = el;
  }, []);

  useEffect(() => {
    const formEl = formRef.current;
    if (!formEl) return;

    // Observer para visibilidade do formulário inteiro
    const formObs = new IntersectionObserver(
      ([entry]) => setFormVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    formObs.observe(formEl);

    // Observer para cada seção
    const sectionObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(entry.target);
            if (idx !== -1) setCurrentSection(idx);
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );

    sectionRefs.current.forEach((el) => {
      if (el) sectionObs.observe(el);
    });

    return () => {
      formObs.disconnect();
      sectionObs.disconnect();
    };
  }, []);

  const loadPersistedProfile = useCallback(async (profile) => {
    const resolvedId = resolveProfileId(profile, { persistGeneratedId: false });
    const rawId = (profile?.id || "").toString().trim();
    const profileEmail = normalizeEmail(profile?.email);
    const profileCpf = (profile?.cpf || "").toString().replace(/\D/g, "");

    // Busca unificada: tenta ID, email, CPF
    try {
      const unified = await findUnifiedProfile({
        id: resolvedId || rawId || undefined,
        email: profileEmail || undefined,
        cpf: profileCpf || undefined,
      });
      if (unified) return unified;
    } catch {
      // fallback
    }

    // Fallback: tenta IDs alternativos
    const candidates = [];
    if (resolvedId) candidates.push(resolvedId);
    if (rawId && !candidates.includes(rawId)) candidates.push(rawId);
    if (profileEmail && !candidates.includes(`email:${profileEmail}`)) candidates.push(`email:${profileEmail}`);

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

  const initialLoadDone = useRef(false);

  const applyProfileToState = useCallback((profile, isInitialLoad = false) => {
    if (!profile) return;

    const provider = (profile?.loginProvider || "").toString().toLowerCase();
    setIsLinkedInLogin(provider === "linkedin" || Boolean(profile?.linkedInUrl));
    setIsCertifiedProfile(Boolean(profile?.verification?.certified));
    setIsVerificationPending(Boolean(profile?.verification?.pending));
    setVerifiedCompany((profile?.verification?.company || "").toString());
    setVerificationSource((profile?.verification?.source || "").toString());

    if (isInitialLoad) {
      // Só preenche o campo de pseudônimo a partir de `pseudonimo` salvo
      // pelo próprio usuário. Nunca cair em `profile.name`, pois esse
      // campo pode conter o nome real importado do LinkedIn/Google.
      if (profile?.pseudonimo) setPseudonym(profile.pseudonimo);
      if (profile?.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthdate)) setBirthdate(profile.birthdate);
      if (profile?.cpf) setCpf(maskCpf(profile.cpf));
      if (profile?.nomeReal || profile?.fullName) setFullName(profile.nomeReal || profile.fullName);
      if (profile?.email) setEmail(profile.email);
      if (profile?.emailVerified) {
        setEmailVerified(true);
        setVerifiedEmailValue((profile.email || "").toString().trim().toLowerCase());
      }
      if (profile?.phone) setPhone(profile.phone);
      if (profile?.educationLevel) setEducationLevel(profile.educationLevel);
    }

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

  // ─── Funil de cadastro: registra entrada na página /pseudonym ───
  // Cria/atualiza um doc em cadastros_iniciados com o uid do Firebase Auth
  // (anônimo, quando o usuário ainda não fez login). A conclusão é marcada
  // posteriormente em handleSubmit. Documentos sem concluido=true após 24h
  // representam abandono e alimentam a métrica no painel admin.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    async function registerFunnelStart(uid) {
      if (!uid || cancelled) return;
      try {
        await setDoc(
          doc(db, "cadastros_iniciados", uid),
          {
            uid,
            startedAt: serverTimestamp(),
            // Marcador de conclusão é setado em handleSubmit; aqui só garantimos
            // que o doc existe sem sobrescrever caso já tenha concluido=true.
            concluido: false,
            updatedAt: serverTimestamp(),
            source: "pseudonym-page",
          },
          { merge: true }
        );
      } catch (err) {
        // Falhas aqui são silenciosas — não devem bloquear o cadastro.
        console.warn("[funil] Falha ao registrar início de cadastro:", err?.message || err);
      }
    }

    // Diagnóstico solicitado: relata no console possíveis impedimentos no
    // fluxo de /pseudonym (sem alterar comportamento).
    try {
      const blockers = [];
      blockers.push("CPF obrigatório com validação de dígitos (pode bloquear quem não quer informar).");
      blockers.push("Confirmação humano (checkbox confirmedHuman) obrigatório.");
      blockers.push("Validação de idade mínima 18 anos quando data de nascimento é preenchida.");
      blockers.push("Unicidade de CPF consulta Firestore — falha silenciosa, mas pode demorar em rede ruim.");
      blockers.push("getUserProfileByCpf/findUnifiedProfile fazem queries síncronas durante o submit.");
      blockers.push("listCompanies(300) executa no mount; se Firestore travar, autocomplete fica vazio (não bloqueia).");
      blockers.push("Parser de currículo (extractResumeText/parseResumeText) faz import dinâmico de pdf.js/mammoth — pode travar/lançar erros silenciosos em arquivos grandes.");
      blockers.push("sendVerificationEmail roda após save: falha não bloqueia, mas pode confundir o usuário.");
      console.info("[funil/diagnóstico] Possíveis pontos de abandono em /pseudonym:", blockers);
    } catch {
      /* noop */
    }

    if (auth?.currentUser?.uid) {
      funnelUidRef.current = auth.currentUser.uid;
      registerFunnelStart(auth.currentUser.uid);
    } else {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (cancelled) return;
        if (user?.uid) {
          funnelUidRef.current = user.uid;
          registerFunnelStart(user.uid);
        } else {
          try {
            const cred = await signInAnonymously(auth);
            if (cancelled) return;
            funnelUidRef.current = cred.user.uid;
            registerFunnelStart(cred.user.uid);
          } catch (err) {
            console.warn("[funil] signInAnonymously falhou:", err?.message || err);
          }
        }
      });
    }

    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Carrega lista de empresas conhecidas para autocompletar nos cards de revisão.
  useEffect(() => {
    let cancelled = false;
    listCompanies(300)      .then((rows) => {
        if (cancelled) return;
        const names = Array.from(
          new Set(
            (rows || [])
              .map((r) => (r?.company || r?.name || "").toString().trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, "pt-BR"));
        setKnownCompanies(names);
      })
      .catch(() => {
        if (!cancelled) setKnownCompanies([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (!profile) {
      localStorage.setItem("userProfile", JSON.stringify({ loginProvider: "anonymous", fallback: true }));
      return;
    }

    try {
      const parsed = JSON.parse(profile);
      if (!initialLoadDone.current) {
        applyProfileToState(parsed, true);
        initialLoadDone.current = true;
      } else {
        applyProfileToState(parsed, false);
      }

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
          const pseudoFromRemote = (mergedProfile?.pseudonimo || "").toString().trim();
          const existingPseudo = (localStorage.getItem("userPseudonym") || "").toString().trim();
          if (pseudoFromRemote && !existingPseudo) {
            localStorage.setItem("userPseudonym", pseudoFromRemote);
          }
          applyProfileToState(mergedProfile, false);
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

  // Dispara o envio do e-mail de verificação para o endereço informado.
  // Usa o profileId atual como userId. Atualiza estado de loading/feedback.
  const sendVerificationEmail = useCallback(
    async (targetEmail) => {
      const normalized = (targetEmail || "").toString().trim().toLowerCase();
      if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        setVerificationStatus("E-mail inválido para verificação.");
        return false;
      }
      let profileId = "";
      let storedPseudonym = "";
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        profileId = resolveProfileId(stored) || stored?.profileId || stored?.id || "";
        storedPseudonym =
          (stored?.pseudonym || stored?.nickname || "").toString().trim();
      } catch {
        // ignore
      }
      if (!storedPseudonym) {
        try {
          storedPseudonym = (localStorage.getItem("userPseudonym") || "").trim();
        } catch {
          // ignore
        }
      }
      if (!profileId) {
        setVerificationStatus("Salve o perfil antes de enviar o e-mail de verificação.");
        return false;
      }
      setSendingVerification(true);
      setVerificationStatus("");
      try {
        const resp = await fetch("/api/send-verification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: profileId,
            email: normalized,
            pseudonym: storedPseudonym,
          }),
          cache: "no-store",
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.ok) {
          setVerificationStatus(data?.error || "Não foi possível enviar o e-mail de verificação.");
          return false;
        }
        setVerificationStatus(`E-mail de verificação enviado para ${normalized}. Verifique sua caixa de entrada.`);
        return true;
      } catch (err) {
        console.warn("Falha ao solicitar envio de verificação:", err);
        setVerificationStatus("Falha de rede ao enviar e-mail de verificação.");
        return false;
      } finally {
        setSendingVerification(false);
      }
    },
    []
  );

  // Detecta retorno de /api/verify-email (?verified=1 ou ?verified=0&reason=...).
  // Atualiza o profile local e exibe mensagem ao usuário.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    if (verified === null) return;

    if (verified === "1") {
      setEmailVerified(true);
      setVerifiedEmailValue((email || "").toString().trim().toLowerCase());
      setInfo("E-mail verificado com sucesso!");
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        localStorage.setItem(
          "userProfile",
          JSON.stringify({ ...stored, emailVerified: true })
        );
      } catch {
        // ignore
      }
    } else {
      const reason = params.get("reason") || "";
      const messages = {
        expired: "O link de verificação expirou. Solicite um novo e-mail.",
        invalid_token: "Link de verificação inválido.",
        invalid_payload: "Link de verificação inválido.",
        missing_token: "Link de verificação inválido.",
        server_misconfigured: "Falha de configuração do servidor de verificação.",
        persist_failed: "Não foi possível registrar a verificação. Tente novamente.",
      };
      setError(messages[reason] || "Não foi possível verificar o e-mail.");
    }

    // Limpa os parâmetros da URL para não repetir o feedback ao recarregar.
    try {
      params.delete("verified");
      params.delete("reason");
      const next = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
      window.history.replaceState({}, "", next);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Busca a lista de empresas cadastradas no Firestore. Se já estiver em cache
  // (knownCompanies), reusa para evitar uma chamada extra. Caso contrário,
  // consulta listCompanies sob demanda — útil quando o usuário sobe o
  // currículo antes do useEffect inicial concluir.
  const fetchRegisteredCompanies = useCallback(async () => {
    if (Array.isArray(knownCompanies) && knownCompanies.length > 0) {
      return knownCompanies;
    }
    try {
      const rows = await listCompanies(300);
      const names = Array.from(
        new Set(
          (rows || [])
            .map((r) => (r?.company || r?.name || "").toString().trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setKnownCompanies(names);
      return names;
    } catch {
      return [];
    }
  }, [knownCompanies]);

  const handleResumeUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setInfo("");
    setIsParsingResume(true);

    // Guardar referência do arquivo para preview
    setResumeFile({ name: file.name, size: file.size, type: file.type });
    if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
    const objUrl = URL.createObjectURL(file);
    setResumePreviewUrl(objUrl);

    try {
      const text = await extractResumeText(file);
      setResumeFullText(text || "");
      const parsed = parseResumeText(text, []);

      // Carrega (ou reusa cache) a lista de empresas cadastradas para
      // associar cada experiência extraída ao nome canônico.
      const registered = await fetchRegisteredCompanies();

      // 1) Para cada experiência identificada pelo parser, tenta encontrar
      //    uma empresa cadastrada correspondente. Se achar, normaliza o
      //    campo `company` para o nome canônico (ex.: "CAMARGO CORREA" →
      //    "Camargo Corrêa") e marca `matchedCompany`.
      const imported = (parsed.experiencesStructured || [])
        .map((item) => {
          const rawCompany = (item?.company || "").toString().trim();
          const role = (item?.role || "").toString().trim();
          const matched = findCompanyInText(rawCompany, registered);
          return {
            company: matched || rawCompany,
            role,
            matchedCompany: matched || null,
            touched: false,
          };
        })
        .filter((item) => item.company || item.role);

      // 2) Varre o texto completo: empresas cadastradas que aparecem no
      //    currículo mas que o parser não capturou viram experiências
      //    extras (com cargo vazio para o usuário preencher).
      const alreadyMatchedNorm = new Set(
        imported
          .map((it) => normalizeForCompanyMatch(it.matchedCompany || it.company))
          .filter(Boolean)
      );
      const normalizedFullText = normalizeForCompanyMatch(text || "");
      const extras = [];
      for (const companyName of registered) {
        const norm = normalizeForCompanyMatch(companyName);
        if (!norm || norm.length < 3) continue;
        if (alreadyMatchedNorm.has(norm)) continue;
        if (normalizedFullText.includes(norm)) {
          extras.push({
            company: companyName,
            role: "",
            matchedCompany: companyName,
            touched: false,
          });
          alreadyMatchedNorm.add(norm);
        }
      }

      const allImported = [...imported, ...extras];

      if (allImported.length > 0) {
        setPendingResumeExperiences((prev) => [...prev, ...allImported]);
        const matchedCount = allImported.filter((x) => x.matchedCompany).length;
        const matchedSuffix =
          matchedCount > 0
            ? ` ${matchedCount} associada(s) a empresas cadastradas.`
            : "";
        setInfo(
          `Encontramos ${allImported.length} experiência(s) no currículo.${matchedSuffix} Revise empresa e cargo de cada uma e confirme abaixo.`
        );
      } else {
        setInfo("Não encontramos experiências no currículo. Tente adicionar manualmente.");
      }
    } catch (err) {
      setError(err?.message || "Não foi possível ler o currículo automaticamente.");
    } finally {
      setIsParsingResume(false);
      e.target.value = "";
    }
  }, [resumePreviewUrl, fetchRegisteredCompanies]);

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

      const provider = (mergedProfile?.loginProvider || "").toString().toLowerCase();
      const hasLinkedInData = provider === "linkedin" || Boolean(mergedProfile?.linkedInUrl);

      // Se não tem login LinkedIn, inicia o fluxo OAuth
      if (!hasLinkedInData) {
        const clientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || "";
        const redirectUri = getLinkedInRedirectUri();

        if (!clientId || clientId.trim().length < 5) {
          setError("Client ID do LinkedIn não configurado. Defina REACT_APP_LINKEDIN_CLIENT_ID no arquivo .env");
          return;
        }

        const state = Math.random().toString(36).slice(2);
        try { sessionStorage.setItem("linkedin_oauth_state", state); } catch { /* ignore */ }

        const params = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: "openid profile email",
          state,
        });

        window.location.assign(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
        return;
      }

      const resolvedEmail =
        (mergedProfile?.email || "").toString().trim() ||
        (mergedProfile?.emailAddress || "").toString().trim();
      const resolvedPhone =
        (mergedProfile?.phone || "").toString().trim() ||
        (mergedProfile?.phoneNumber || "").toString().trim() ||
        (mergedProfile?.formattedPhoneNumber || "").toString().trim();
      let linkedInExperiences = extractLinkedInExperiences(mergedProfile);

      // Se não encontrou experiências no perfil local, tenta buscar via API usando o código OAuth
      if (linkedInExperiences.length === 0) {
        const storedCode = mergedProfile?.code || "";

        if (storedCode) {
          try {
            const redirectUri = getLinkedInRedirectUri();
            const response = await fetch(buildApiUrl("/api/linkedin-auth"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: storedCode, redirectUri }),
            });

            if (response.ok) {
              const apiData = await response.json();
              if (apiData && !apiData.error) {
                const updatedProfile = { ...mergedProfile, ...apiData, loginProvider: "linkedin" };
                localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
                mergedProfile = updatedProfile;
                linkedInExperiences = extractLinkedInExperiences(updatedProfile);

                if (apiData?.fullName || apiData?.nomeReal) {
                  /* nome vindo da API tem prioridade */
                } else {
                  const apiName = [apiData?.localizedFirstName || apiData?.firstName, apiData?.localizedLastName || apiData?.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  if (apiName) {
                    mergedProfile = { ...mergedProfile, fullName: apiName, nomeReal: apiName };
                    localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
                  }
                }
              }
            }
          } catch (apiErr) {
            console.warn("Falha ao buscar dados LinkedIn via API:", apiErr);
          }
        }
        // Se não tem código nem token, não redireciona automaticamente.
        // O redirecionamento OAuth só ocorre quando o usuário clica "Entrar com LinkedIn"
        // na seção onde hasLinkedInData === false (tratado acima).
      }

      // Recalcular nome resolvido com perfil possivelmente atualizado
      const updatedFallback = [mergedProfile?.localizedFirstName, mergedProfile?.localizedLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const finalResolvedName =
        (mergedProfile?.fullName || "").toString().trim() ||
        (mergedProfile?.nomeReal || "").toString().trim() ||
        updatedFallback ||
        [mergedProfile?.firstName, mergedProfile?.lastName].filter(Boolean).join(" ").trim();

      const loadedFields = [];

      if (finalResolvedName) {
        setFullName(finalResolvedName);
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
      } else {
        // Fallback: o `code` OAuth já foi consumido em uma sessão anterior, então não
        // temos como refazer fetch. Nesse caso, recuperamos experiências do LinkedIn
        // já persistidas (Firestore via mergedProfile / localStorage) preservando
        // o flag `verified` original.
        const persistedStructured = Array.isArray(mergedProfile?.resumeData?.experiencesStructured)
          ? mergedProfile.resumeData.experiencesStructured
          : [];
        const persistedLinkedIn = persistedStructured.filter(
          (exp) => (exp?.source || "").toString().toLowerCase() === "linkedin"
        );
        if (persistedLinkedIn.length > 0) {
          setStructuredExperiences((prev) => dedupeExperiences([...persistedLinkedIn, ...prev]));
          loadedFields.push(`${persistedLinkedIn.length} experiência(s) já salva(s)`);
        }
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

  // Auto-trigger LinkedIn import ONLY after a fresh OAuth redirect (code present in profile)
  const linkedInAutoImportDone = useRef(false);
  useEffect(() => {
    if (!isLinkedInLogin || linkedInAutoImportDone.current || !initialLoadDone.current) return;
    try {
      const p = JSON.parse(localStorage.getItem("userProfile") || "{}");
      // Só dispara auto-import se tiver um code OAuth fresco (acabou de voltar do LinkedIn)
      if (!p?.code) return;
    } catch { return; }
    linkedInAutoImportDone.current = true;
    handleFillFromLinkedIn();
  }, [isLinkedInLogin, handleFillFromLinkedIn]);

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

  // Atualiza o campo de uma experiência pendente (revisão do currículo) e marca como tocada.
  // Quando o campo "company" muda, recalcula o match com a lista de empresas cadastradas.
  const handleUpdatePendingResumeExperience = (idx, field, value) => {
    setPendingResumeExperiences((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, [field]: value, touched: true };
        if (field === "company") {
          next.matchedCompany = findCompanyInText(value, knownCompanies);
        }
        return next;
      })
    );
  };

  // Normaliza string para comparação difusa (lowercase, sem acento, sem pontuação).
  const normalizeForMatch = useCallback((value) => {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // Verifica se o nome da empresa aparece no texto bruto do PDF do currículo.
  // Exige token significativo (>= 3 caracteres) e considera variantes simples.
  const resumeTextNormalized = useMemo(
    () => normalizeForMatch(resumeFullText),
    [resumeFullText, normalizeForMatch]
  );

  const isCompanyInResumeText = useCallback(
    (companyName) => {
      const norm = normalizeForMatch(companyName);
      if (!norm || !resumeTextNormalized) return false;
      if (norm.length < 3) return false;
      // Match direto
      if (resumeTextNormalized.includes(norm)) return true;
      // Match por token: pelo menos um token >= 4 chars (ignora suffixos comuns)
      const stop = new Set(["ltda", "sa", "eireli", "mei", "me", "grupo", "group", "the", "do", "da", "de"]);
      const tokens = norm
        .split(" ")
        .filter((t) => t.length >= 4 && !stop.has(t));
      if (!tokens.length) return false;
      return tokens.every((t) => resumeTextNormalized.includes(t));
    },
    [resumeTextNormalized, normalizeForMatch]
  );

  // Confirma uma experiência pendente, movendo-a para a lista oficial.
  const handleConfirmPendingResumeExperience = (idx) => {
    setError(null);
    setPendingResumeExperiences((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const company = (item.company || "").trim();
      const role = (item.role || "").trim();
      if (!company || !role) {
        setError("Preencha empresa e cargo antes de confirmar a experiência.");
        return prev;
      }
      setStructuredExperiences((curr) =>
        dedupeExperiences([
          ...curr,
          {
            company,
            role,
            source: "curriculo",
            verified: false,
            crossReferencedInResume: isCompanyInResumeText(company),
          },
        ])
      );
      setInfo("Experiência confirmada e adicionada ao perfil.");
      return prev.filter((_, i) => i !== idx);
    });
  };

  // Descarta uma experiência pendente sem adicioná-la.
  const handleDiscardPendingResumeExperience = (idx) => {
    setPendingResumeExperiences((prev) => prev.filter((_, i) => i !== idx));
  };

  // Consulta o CPF na API ao sair do campo. Se o provedor retornar o nome,
  // preenche o campo "Nome completo" e o trava como readOnly. Caso contrário,
  // mantém o campo editável e exibe mensagem de erro discreta.
  const handleCpfBlur = useCallback(async () => {
    const digits = cpf.replace(/\D/g, "");
    setCpfError("");
    setCpfNotice("");    if (digits.length === 0) {
      setCpfVerified(false);
      return;
    }
    if (digits.length !== 11) {
      setCpfError("CPF deve conter 11 dígitos.");
      setCpfVerified(false);
      return;
    }
    if (!isValidCpfDigits(digits)) {
      setCpfError("CPF inválido.");
      setCpfVerified(false);
      return;
    }
    setCpfLoading(true);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 12000);
      const qs = new URLSearchParams({ cpf: digits });
      if (birthdate) qs.set("birthdate", birthdate);
      qs.set("_t", Date.now().toString());
      const resp = await fetch(`/api/consulta-cpf?${qs.toString()}`, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(timeout);
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.valid) {
        setCpfError(data?.error || "CPF inválido.");
        setCpfVerified(false);
        return;
      }
      if (data?.fullName) {
        setFullName(data.fullName);
        setCpfVerified(true);
        setCpfError("");
      } else if (data?.reason === "birthdate_required") {
        setCpfNotice("Informe a data de nascimento acima para verificar o CPF automaticamente.");
        setCpfVerified(false);
      } else if (data?.reason === "lookup_unavailable") {
        setCpfNotice(
          "CPF válido. Serviço de autocompletar indisponível no momento — preencha o nome manualmente."
        );
        setCpfVerified(false);
      } else if (data?.reason === "not_found") {
        const errs = Array.isArray(data?.providerErrors) ? data.providerErrors.join("; ") : "";
        const extra = errs
          ? ` (${errs})`
          : data?.providerMessage
          ? ` (${data.providerMessage})`
          : "";
        setCpfNotice(
          `CPF válido, mas não foi possível localizar o nome na Receita${extra}. Confira a data de nascimento e preencha o nome manualmente se necessário.`
        );
        setCpfVerified(false);
      } else {
        setCpfNotice("CPF válido. Preencha o nome manualmente.");
        setCpfVerified(false);
      }
    } catch (err) {
      console.warn("Falha na consulta de CPF:", err);
      setCpfNotice("CPF válido. Não foi possível consultar agora — preencha o nome manualmente.");
      setCpfVerified(false);
    } finally {
      setCpfLoading(false);
    }
  }, [cpf, birthdate]);

  // ─── Etapa 1: pseudônimo + e-mail ───
  // Salva o mínimo no Firestore, marca o funil como concluído (a etapa 1 já
  // conta como cadastro ativo) e avança para a etapa 2 (opcional).
  const handleContinueStep1 = useCallback(
    async (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      const trimmedPseudo = pseudonym.trim();
      const trimmedEmail = (email || "").trim().toLowerCase();
      if (!trimmedPseudo) {
        setError("Por favor, escolha um pseudônimo.");
        return;
      }
      if (!trimmedEmail) {
        setError("Por favor, informe seu e-mail.");
        return;
      }
      // Validação leve de formato. Mantemos liberal para reduzir abandono.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError("E-mail inválido.");
        return;
      }
      // Senha é opcional, mas se preenchida precisa ser válida e coincidir.
      if (password || confirmPassword) {
        if (password.length < 6) {
          setError("A senha deve ter pelo menos 6 caracteres.");
          return;
        }
        if (password !== confirmPassword) {
          setError("As senhas não coincidem.");
          return;
        }
      }
      setError(null);

      // Se o usuário forneceu uma senha, tentamos vincular/criar credencial
      // de e-mail/senha no Firebase Auth. Falhas aqui são tratadas como
      // bloqueantes para evitar inconsistência entre o perfil e o Auth.
      if (password) {
        try {
          const currentUser = auth?.currentUser;
          if (currentUser && currentUser.isAnonymous) {
            const credential = EmailAuthProvider.credential(trimmedEmail, password);
            await linkWithCredential(currentUser, credential);
          } else if (!currentUser) {
            await createUserWithEmailAndPassword(auth, trimmedEmail, password);
          }
          // Se já existe um usuário não-anônimo (Google/LinkedIn/e-mail já
          // logado), não recriamos a credencial — apenas seguimos.
        } catch (authErr) {
          console.warn("[etapa1] Falha ao vincular senha:", authErr);
          if (authErr?.code === "auth/email-already-in-use") {
            setError("Este e-mail já está em uso. Tente fazer login ou use outro e-mail.");
          } else if (authErr?.code === "auth/weak-password") {
            setError("Senha muito fraca. Use ao menos 6 caracteres.");
          } else if (authErr?.code === "auth/credential-already-in-use") {
            setError("Estas credenciais já estão associadas a outra conta.");
          } else {
            setError("Não foi possível salvar a senha. " + (authErr?.message || ""));
          }
          return;
        }
      }

      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      let unifiedId = resolveProfileId(existingProfile);
      try {
        const unified = await findUnifiedProfile({
          id: unifiedId || undefined,
          email: trimmedEmail,
        });
        if (unified?.id) unifiedId = unified.id;
      } catch {
        /* segue com id existente */
      }

      const nextProfile = {
        ...existingProfile,
        profileId: unifiedId,
        name: trimmedPseudo,
        pseudonimo: trimmedPseudo,
        email: trimmedEmail,
        // Status explícito: cadastro mínimo já é ATIVO.
        status: "ativo",
        approvalStatus: "approved",
      };
      // Computa nível de verificação (free/identity) com base nos campos já
      // presentes (login provider, perfil LinkedIn etc.). "proven" só é
      // atribuído por contexto da empresa avaliada — não aqui.
      const vDetail = resolveUserVerificationDetail(nextProfile, "");
      nextProfile.verification_level = vDetail.level;
      nextProfile.verification_provider = vDetail.provider || null;
      // Sistema 3 níveis: na Etapa 1 ainda não há e-mail confirmado nem
      // experiências importadas — preserva flags se já existiam (re-edição).
      nextProfile.emailVerified = Boolean(existingProfile?.emailVerified);
      nextProfile.professionalVerified = Boolean(existingProfile?.professionalVerified);
      nextProfile.profileComplete = false;
      localStorage.setItem("userPseudonym", trimmedPseudo);
      localStorage.setItem("userProfile", JSON.stringify(nextProfile));

      try {
        await saveUserProfile({ id: unifiedId, ...nextProfile });
      } catch (err) {
        console.warn("[etapa1] Falha ao salvar perfil mínimo:", err);
      }

      // Funil: marca conclusão (usuário já está cadastrado a partir daqui).
      try {
        const funnelUid = funnelUidRef.current || auth?.currentUser?.uid;
        if (funnelUid) {
          await setDoc(
            doc(db, "cadastros_iniciados", funnelUid),
            {
              uid: funnelUid,
              concluido: true,
              concluidoAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              completedStep: 1,
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn("[etapa1] Falha ao marcar funil:", err?.message || err);
      }

      // Dispara verificação de e-mail em segundo plano (não bloqueante).
      try {
        await sendVerificationEmail(trimmedEmail);
      } catch (err) {
        console.warn("[etapa1] Falha ao enviar e-mail de verificação:", err);
      }

      window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      setInfo("Cadastro confirmado! Você pode enriquecer seu perfil ou pular essa etapa.");
      setStep(2);
    },
    [pseudonym, email, password, confirmPassword, sendVerificationEmail]
  );

  // Permite avançar sem preencher nada da etapa 2 — perfil já está ativo.
  const handleSkipStep2 = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = pseudonym.trim();
      if (!trimmed) {
        setError("Por favor, escolha um pseudônimo.");
        return;
      }

      if (!confirmedHuman) {
        // Etapa 2 é opcional: se o usuário não marcou o "não sou robô" mas
        // chegou aqui pela etapa 1, deixamos passar — ele já se cadastrou.
        // Mantemos o aviso apenas via UI desabilitando o botão quando desejado.
      }

      // Validação de data de nascimento (opcional, mas se preenchida deve ser válida e >= 18 anos).
      const birthdateTrimmed = (birthdate || "").trim();
      if (birthdateTrimmed) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdateTrimmed)) {
          setError("Data de nascimento inválida.");
          return;
        }
        const bd = new Date(birthdateTrimmed + "T00:00:00");
        if (isNaN(bd.getTime())) {
          setError("Data de nascimento inválida.");
          return;
        }
        const today = new Date();
        let age = today.getFullYear() - bd.getFullYear();
        const m = today.getMonth() - bd.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
        if (age < 18) {
          setError("Você precisa ter pelo menos 18 anos para se cadastrar.");
          return;
        }
      }

      const cpfNumbers = cpf.replace(/\D/g, "");
      // CPF é opcional na etapa 2. Validamos apenas o formato quando preenchido.
      if (cpfNumbers && cpfNumbers.length !== 11) {
        setError("CPF deve conter 11 dígitos.");
        return;
      }
      if (cpfNumbers && !isValidCpfDigits(cpfNumbers)) {
        setError("CPF inválido.");
        return;
      }

      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const accountId = resolveProfileId(existingProfile, { persistGeneratedId: false });

      // Coleta todos os IDs possíveis deste perfil para comparação robusta com o dono do CPF
      const myIds = new Set(
        [
          accountId,
          resolveProfileId(existingProfile),
          existingProfile?.id,
          existingProfile?.uid,
          existingProfile?.userId,
          existingProfile?.profileId,
          existingProfile?.email ? `email:${existingProfile.email.toString().trim().toLowerCase()}` : null,
        ]
          .filter(Boolean)
          .map((v) => v.toString().trim())
      );

      if (cpfNumbers) {
        try {
          const cpfOwner = await getUserProfileByCpf(cpfNumbers);
          const cpfOwnerId = (cpfOwner?.id || "").toString().trim();

          if (cpfOwner && cpfOwnerId && !myIds.has(cpfOwnerId)) {
            setError("Este CPF já está cadastrado em outra conta. Limpe o campo CPF se quiser salvar mesmo assim.");
            return;
          }
        } catch (err) {
          console.warn("Falha ao validar unicidade de CPF:", err);
        }
      }

      localStorage.setItem("userPseudonym", trimmed);

      // Tenta encontrar perfil unificado para manter o mesmo ID
      let unifiedId = resolveProfileId(existingProfile);
      try {
        const unified = await findUnifiedProfile({
          id: unifiedId || undefined,
          email: email.trim().toLowerCase() || undefined,
          cpf: cpfNumbers || undefined,
        });
        if (unified?.id) {
          unifiedId = unified.id;
        }
      } catch {
        // usa o ID gerado normalmente
      }

      const trimmedEmail = (email || "").trim().toLowerCase();
      const previouslyVerifiedFor = (existingProfile?.email || "").toString().trim().toLowerCase();
      // E-mail é considerado verificado apenas se já era verificado E não mudou.
      const keepVerified = Boolean(existingProfile?.emailVerified) && trimmedEmail && trimmedEmail === previouslyVerifiedFor;

      const nextProfile = {
        ...existingProfile,
        profileId: unifiedId,
        name: trimmed,
        pseudonimo: trimmed,
        birthdate: birthdateTrimmed || existingProfile?.birthdate || undefined,
        fullName: fullName.trim() || undefined,
        nomeReal: fullName.trim() || undefined,
        cpf: cpfNumbers || undefined,
        email: email.trim() || undefined,
        emailVerified: keepVerified,
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

      // Recalcula nível de verificação (free/identity) após enriquecer com
      // experiências, perfil LinkedIn etc. "proven" depende da empresa
      // avaliada e é computado no momento da avaliação.
      const vDetailFull = resolveUserVerificationDetail(nextProfile, "");
      nextProfile.verification_level = vDetailFull.level;
      nextProfile.verification_provider = vDetailFull.provider || null;

      // Sistema 3 níveis (independente do legado):
      //   Nível 1 → e-mail confirmado.
      //   Nível 2 → ≥1 experiência importada via LinkedIn OAuth.
      //   Nível 3 → pseudônimo + e-mail verificado + ≥1 exp. LinkedIn.
      const linkedInVerifiedCount = (structuredExperiences || []).filter(
        (exp) => (exp?.source || "").toString().toLowerCase() === "linkedin" && exp?.verified
      ).length;
      const professionalVerified = linkedInVerifiedCount > 0;
      nextProfile.professionalVerified = professionalVerified;
      nextProfile.emailVerified = keepVerified;
      nextProfile.profileComplete = Boolean(
        trimmed && keepVerified && professionalVerified
      );

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));

      try {
        await saveUserProfile({ id: nextProfile.profileId, ...nextProfile });
      } catch (err) {
        console.warn("Falha ao salvar perfil no Firebase:", err);
      }

      // Se o e-mail mudou (ou ainda não foi verificado), envia automaticamente
      // o e-mail de confirmação. Falhas aqui não bloqueiam o cadastro — o usuário
      // pode usar o botão "Reenviar" depois.
      if (trimmedEmail && !keepVerified) {
        try {
          await sendVerificationEmail(trimmedEmail);
        } catch (err) {
          console.warn("Falha ao enviar e-mail de verificação:", err);
        }
      }

      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      // Funil: marca o doc de cadastros_iniciados como concluído.
      // Falhas aqui não interrompem o redirect.
      try {
        const funnelUid = funnelUidRef.current || auth?.currentUser?.uid;
        if (funnelUid) {
          await setDoc(
            doc(db, "cadastros_iniciados", funnelUid),
            {
              uid: funnelUid,
              concluido: true,
              concluidoAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.warn("[funil] Falha ao marcar conclusão:", err?.message || err);
      }

      navigate("/");
    },
    [
      navigate,
      pseudonym,
      birthdate,
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
      sendVerificationEmail,
    ]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center pt-0">
      <div className="w-full">
        <AppHeader theme={theme} toggleTheme={toggleTheme} hideAvatar />
      </div>
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
      <div className="w-full max-w-2xl md:max-w-6xl px-6 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-blue-100 dark:border-slate-700 md:grid md:grid-cols-[35%_65%] md:gap-8">
          {/* ===== Coluna esquerda (>= md): título, privacidade, banner do cadeado, stepper vertical ===== */}
          <aside className="md:sticky md:top-4 md:self-start">
            <h1 className="text-2xl font-extrabold font-azonix tracking-wide text-blue-800 dark:text-blue-200 mb-4 text-center md:text-left">
              Seu perfil anônimo
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Essas informações ajudam a manter a qualidade das avaliações. Seus dados são armazenados localmente e não
              serão compartilhados.
            </p>

            <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 text-emerald-800 dark:text-emerald-200 text-sm">
              🔒 Seu nome real e CPF são criptografados e nunca serão exibidos. Escolha um <strong>Pseudônimo</strong> para suas avaliações.
            </div>

            {/* Stepper vertical (somente >= md) */}
            {(() => {
              const stepperLabels = ["Identificação", "Experiências", "Avatar", "Confirmar"];
              const activeIdx =
                currentSection <= 3 ? 0 : currentSection === 4 ? 1 : currentSection === 5 ? 2 : 3;
              return (
                <ol className="hidden md:block mt-2 space-y-3" aria-label="Progresso do cadastro">
                  {stepperLabels.map((label, idx) => {
                    const isActive = idx === activeIdx;
                    const isDone = idx < activeIdx;
                    return (
                      <li key={label} className="flex items-start gap-3">
                        <span
                          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-600"
                              : isDone
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-600"
                          }`}
                          aria-current={isActive ? "step" : undefined}
                        >
                          {isDone ? (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <span
                          className={`pt-1 text-sm ${
                            isActive
                              ? "font-bold text-blue-700 dark:text-blue-300"
                              : isDone
                              ? "font-semibold text-emerald-700 dark:text-emerald-400"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              );
            })()}
          </aside>

          {/* ===== Coluna direita: conteúdo dinâmico + formulário ===== */}
          <div className="min-w-0">

          {/* Botão Ver meu perfil — exibido quando já tem um profileId salvo */}
          {(() => {
            try {
              const p = JSON.parse(localStorage.getItem("userProfile") || "{}");
              const pid = p?.profileId || resolveProfileId(p, { persistGeneratedId: false });
              if (pid) {
                return (
                  <div className="mb-4 text-center">
                    <button
                      type="button"
                      onClick={() => navigate(`/perfil/${encodeURIComponent(pid)}`)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Ver meu perfil
                    </button>
                  </div>
                );
              }
            } catch { /* silencioso */ }
            return null;
          })()}

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

          <form ref={formRef} onSubmit={step === 1 ? handleContinueStep1 : handleSubmit} className="space-y-4">
            {/* Indicador visual de etapas */}
            <div className="flex items-center gap-2 text-xs font-semibold mb-2">
              <span className={`px-2 py-1 rounded-full ${step === 1 ? "bg-blue-600 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
                {step === 1 ? "Etapa 1 de 2" : "✓ Etapa 1"}
              </span>
              <span className={`px-2 py-1 rounded-full ${step === 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                {step === 2 ? "Etapa 2 — opcional" : "Etapa 2"}
              </span>
            </div>

            {step === 1 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-700 px-4 py-3 text-sm text-blue-800 dark:text-blue-100 flex items-start gap-2">
                <span aria-hidden="true">🔒</span>
                <span>
                  <strong>Seu nome real nunca será exibido.</strong> Todas as avaliações são publicadas sob seu pseudônimo.
                </span>
              </div>
            )}

            {step === 1 && (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600/60 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 flex items-start gap-2">
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5 flex-shrink-0 text-amber-500 dark:text-amber-300 mt-0.5"
                >
                  <path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.77l-5.84 3.07 1.11-6.5L2.55 9.74l6.53-.95L12 2.5z" />
                </svg>
                <span>
                  Complete seu cadastro e vincule suas experiências para ganhar o <strong>Selo de Perfil Verificado ✓</strong> — suas avaliações terão mais credibilidade e destaque na plataforma.
                </span>
              </div>
            )}

            {/* Pseudônimo (etapa 1) */}
            {step === 1 && (
            <div ref={(el) => assignSectionRef(el, 0)}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Escolha seu pseudônimo <span className="text-xs font-normal text-slate-500">— será sua identidade anônima nas avaliações</span></label>
              <input
                value={pseudonym}
                onChange={(e) => {
                  setError(null);
                  setPseudonym(e.target.value);
                }}
                placeholder="Ex.: Profissional Anônimo, Engenheiro Discreto"
                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>
            )}

            {/* Data de nascimento (opcional, mas se preenchida exige >= 18 anos). */}
            {step === 2 && (
            <div>
              <label htmlFor="cp-birthdate" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Data de Nascimento <span className="text-xs font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="cp-birthdate"
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setError(null);
                  setBirthdateError("");
                  setBirthdate(e.target.value);
                }}
                onBlur={() => {
                  const v = (birthdate || "").trim();
                  if (!v) {
                    setBirthdateError("");
                    return;
                  }
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                    setBirthdateError("Data inválida.");
                    return;
                  }
                  const bd = new Date(v + "T00:00:00");
                  if (isNaN(bd.getTime())) {
                    setBirthdateError("Data inválida.");
                    return;
                  }
                  const today = new Date();
                  let age = today.getFullYear() - bd.getFullYear();
                  const m = today.getMonth() - bd.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
                  if (age < 18) {
                    setBirthdateError("É necessário ter pelo menos 18 anos.");
                  } else {
                    setBirthdateError("");
                    // Reconsulta CPF se já estiver preenchido — InfoSimples exige a data.
                    const digits = cpf.replace(/\D/g, "");
                    if (digits.length === 11 && isValidCpfDigits(digits)) {
                      handleCpfBlur();
                    }
                  }
                }}
                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
              {birthdateError ? (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{birthdateError}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Necessário para validação de CPF e para garantir a autenticidade das avaliações.
                </p>
              )}
            </div>
            )}

            {/* E-mail e Nome completo lado a lado em md+ */}
            <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">

            {/* E-mail (etapa 1) */}
            {step === 1 && (
            <div ref={(el) => assignSectionRef(el, 1)}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <span>E-mail</span>
                {email && emailVerified && verifiedEmailValue === email.trim().toLowerCase() ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    E-mail verificado
                  </span>
                ) : email ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 text-[10px] font-semibold">
                    E-mail não verificado
                  </span>
                ) : null}
              </label>
              <input
                value={email}
                onChange={(e) => {
                  setError(null);
                  setEmail(e.target.value);
                  setVerificationStatus("");
                  // Se o usuário trocou o e-mail, o status verificado deixa de valer
                  // visualmente até salvar e reenviar a confirmação.
                  if (emailVerified && e.target.value.trim().toLowerCase() !== verifiedEmailValue) {
                    setEmailVerified(false);
                  }
                }}
                placeholder="seuemail@dominio.com"
                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
              {email && !(emailVerified && verifiedEmailValue === email.trim().toLowerCase()) && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendVerificationEmail(email)}
                    disabled={sendingVerification}
                    className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingVerification ? "Enviando..." : "Reenviar e-mail de verificação"}
                  </button>
                  {verificationStatus && (
                    <span className="text-xs text-slate-600 dark:text-slate-300">{verificationStatus}</span>
                  )}
                </div>
              )}
              {/* Faixa discreta lembrando que o e-mail precisa ser confirmado para ativar o perfil (Nível 1). */}
              {email && !(emailVerified && verifiedEmailValue === email.trim().toLowerCase()) && (
                <p className="mt-2 text-[11px] italic text-slate-500 dark:text-slate-400">
                  Confirme seu e-mail para ativar seu perfil.
                </p>
              )}
            </div>
            )}

            {/* Senha (etapa 1) — opcional, mas recomendada para login futuro. */}
            {step === 1 && (
            <div className="md:col-span-2 space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Senha{" "}
                  <span className="text-xs font-normal text-slate-500">
                    (opcional, recomendada)
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setError(null);
                      setPassword(e.target.value);
                    }}
                    autoComplete="new-password"
                    placeholder="Crie uma senha (mín. 6 caracteres)"
                    className="w-full p-3 pr-16 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Criar uma senha aumenta a segurança e permite acessar sua conta de outros dispositivos.
                </p>
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                >
                  Confirme a senha
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setError(null);
                    setConfirmPassword(e.target.value);
                  }}
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                    As senhas não coincidem.
                  </p>
                )}
              </div>
            </div>
            )}

            {/* CPF — opcional (etapa 2). Ao sair do campo, consulta a API e,
                se possível, preenche o nome automaticamente. */}
            {step === 2 && (
            <div ref={(el) => assignSectionRef(el, 3)}>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                CPF <span className="text-xs font-normal text-slate-500">(opcional — apenas validação interna)</span>
              </label>
              <div className="relative">
                <input
                  value={cpf}
                  onChange={(e) => {
                    setError(null);
                    setCpfError("");
                    setCpfNotice("");
                    setCpfVerified(false);
                    setCpf(maskCpf(e.target.value));
                  }}
                  onBlur={handleCpfBlur}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000.000.000-00"
                  className="w-full p-3 pr-10 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
                {cpfLoading && (
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                  />
                )}
                {!cpfLoading && cpfVerified && (
                  <span
                    aria-label="CPF verificado"
                    title="CPF verificado"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-lg"
                  >
                    ✓
                  </span>
                )}
              </div>
              {cpfError && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{cpfError}</p>
              )}
              {!cpfError && cpfNotice && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{cpfNotice}</p>
              )}
            </div>
            )}

            {/* Nome real (privado) — readOnly quando preenchido pela API. */}
            {step === 2 && (
            <div ref={(el) => assignSectionRef(el, 2)} className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nome completo <span className="text-xs font-normal text-slate-500">(opcional — privado, nunca será exibido)</span>
                {cpfVerified && (
                  <span className="ml-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5">
                    Verificado pelo CPF
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  value={fullName}
                  onChange={(e) => {
                    setError(null);
                    setFullName(e.target.value);
                  }}
                  readOnly={cpfVerified}
                  placeholder="Será preenchido após a verificação do CPF"
                  className={`flex-1 p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 ${
                    cpfVerified
                      ? "bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                      : "bg-white dark:bg-slate-800"
                  }`}
                />
                {cpfVerified && (
                  <button
                    type="button"
                    onClick={() => setCpfVerified(false)}
                    className="px-3 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
            )}

            </div>

            {/* Botão Continuar — etapa 1 */}
            {step === 1 && (
              <>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition disabled:opacity-60"
                  disabled={!pseudonym.trim() || !email.trim()}
                >
                  Continuar
                </button>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Você pode enriquecer seu perfil depois (opcional).
                </p>
              </>
            )}

            {/* ===== IMPORTAÇÃO DE EXPERIÊNCIAS (etapa 2 — opcional) ===== */}
            {step === 2 && (
            <div ref={(el) => assignSectionRef(el, 4)} className="bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-2xl p-5 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-1">
                  Experiências profissionais <span className="text-xs font-normal text-slate-600 dark:text-slate-300">(opcional)</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Importe de uma plataforma ou adicione manualmente. Apenas empresa e cargo são necessários.
                </p>
              </div>

              {/* Currículo + LinkedIn lado a lado em md+ */}
              <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:gap-5">

              {/* 0. Importar via currículo do LinkedIn (PDF) */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  Importar via currículo do LinkedIn
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                  Acesse <strong>linkedin.com/in/seu-perfil → Mais → Salvar como PDF</strong> e faça upload do arquivo aqui.
                  O parsing desse PDF é mais estruturado e confiável.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                  Formatos suportados: <strong>PDF, DOCX, TXT, MD, RTF</strong>. Arquivos <strong>.doc</strong> (Word 97–2003) não são lidos automaticamente — abra no Word ou Google Docs e salve como <strong>.docx</strong> ou <strong>.pdf</strong>.
                </p>
                <div className="mb-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200 leading-snug">
                    <strong>Como confirmamos seu vínculo sem o LinkedIn:</strong> ao digitar o nome de uma empresa,
                    cruzamos esse nome com o texto do currículo carregado. Se encontrarmos uma correspondência,
                    a experiência recebe o selo <span className="font-semibold">✓ Vínculo Confirmado (currículo)</span> —
                    uma evidência documental do vínculo profissional. O <span className="font-semibold">Selo Autenticado</span> (mais forte)
                    continua exclusivo para quem usa o login via LinkedIn.
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={handleResumeUpload}
                  className="w-full text-sm"
                />
                {isParsingResume && (
                  <p className="text-xs text-blue-700 mt-2">Lendo e interpretando currículo...</p>
                )}

                {/* Revisão das experiências extraídas do currículo — apenas empresa e cargo */}
                {pendingResumeExperiences.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Revise as experiências extraídas ({pendingResumeExperiences.length}). Corrija empresa e cargo se necessário e confirme cada uma.
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold mr-1">Selo Autenticado</span>
                      é concedido apenas para experiências verificadas via login OAuth do LinkedIn.
                      Quando o nome da empresa que você digita aqui também aparece no PDF do currículo,
                      adicionamos um nível extra de <span className="text-emerald-700 dark:text-emerald-400 font-semibold">confiança</span> à experiência —
                      isso não substitui o selo completo, mas reforça a procedência da informação.
                    </p>
                    <datalist id="known-companies-datalist">
                      {knownCompanies.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                    {pendingResumeExperiences.map((exp, idx) => {
                      const inResume = isCompanyInResumeText(exp.company);
                      const hasCompanyValue = !!(exp.company || "").trim();
                      return (
                      <div
                        key={`pending_${idx}`}
                        className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 p-4 space-y-3"
                      >
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                              Empresa
                            </label>
                            <div className="relative">
                              <input
                                value={exp.company}
                                onChange={(e) => handleUpdatePendingResumeExperience(idx, "company", e.target.value)}
                                placeholder="Digite ou selecione a empresa"
                                list="known-companies-datalist"
                                autoComplete="off"
                                className="w-full px-3 py-2.5 pr-10 text-sm border border-amber-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                              />
                              {hasCompanyValue && resumeFullText && (
                                <span
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none"
                                  title={
                                    inResume
                                      ? "Verificado no PDF: o nome desta empresa foi encontrado no currículo carregado."
                                      : "Não verificado no PDF: o nome desta empresa não foi localizado no texto do currículo."
                                  }
                                  aria-label={inResume ? "Verificado no PDF" : "Não verificado no PDF"}
                                >
                                  {inResume ? (
                                    <span className="text-emerald-600">✓</span>
                                  ) : (
                                    <span className="text-red-500">⚠</span>
                                  )}
                                </span>
                              )}
                            </div>
                            {hasCompanyValue && resumeFullText && (
                              <p className={`text-xs mt-1.5 leading-snug ${inResume ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                {inResume
                                  ? "Confiança extra: nome encontrado no currículo carregado."
                                  : "Nome não localizado no currículo — confirme se está correto."}
                              </p>
                            )}
                            {hasCompanyValue && (
                              <p className="text-xs mt-1 leading-snug">
                                {exp.matchedCompany ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-0.5 font-semibold">
                                    Empresa identificada: {exp.matchedCompany}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 font-semibold">
                                    Empresa não identificada
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                              Cargo
                            </label>
                            <input
                              value={exp.role}
                              onChange={(e) => handleUpdatePendingResumeExperience(idx, "role", e.target.value)}
                              placeholder="Ex.: Projetista, Analista, Gerente"
                              className="w-full px-3 py-2.5 text-sm border border-amber-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-700/60">
                          <button
                            type="button"
                            onClick={() => handleDiscardPendingResumeExperience(idx)}
                            className="text-xs text-slate-500 hover:text-red-600 hover:underline self-start"
                          >
                            Descartar
                          </button>
                          {exp.touched ? (
                            <button
                              type="button"
                              onClick={() => handleConfirmPendingResumeExperience(idx)}
                              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition w-full sm:w-auto"
                            >
                              Confirmar experiência
                            </button>
                          ) : (
                            <span className="text-xs text-amber-700 dark:text-amber-300 italic">
                              Revise os campos para liberar a confirmação
                            </span>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Preview em miniatura do currículo carregado */}
                {resumeFile && !isParsingResume && (
                  <div className="mt-3 rounded-xl border border-blue-100 dark:border-slate-700 bg-blue-50/50 dark:bg-slate-800 overflow-hidden">
                    <div className="flex items-start gap-3 p-3">
                      {/* Miniatura */}
                      <div className="shrink-0 w-20 h-24 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900 flex items-center justify-center">
                        {resumeFile.type === "application/pdf" && resumePreviewUrl ? (
                          <iframe
                            src={`${resumePreviewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                            title="Preview do currículo"
                            className="w-full h-full pointer-events-none"
                            style={{ border: "none", transform: "scale(1)", transformOrigin: "top left" }}
                            tabIndex={-1}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-1">
                            <span className="text-2xl">📄</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 uppercase font-bold">
                              {resumeFile.name.split(".").pop()}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Info do arquivo */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={resumeFile.name}>
                          {resumeFile.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {(resumeFile.size / 1024).toFixed(0)} KB
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                          ✓ Currículo carregado com sucesso
                        </p>
                      </div>
                      {/* Botão remover */}
                      <button
                        type="button"
                        onClick={() => {
                          if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
                          setResumeFile(null);
                          setResumePreviewUrl(null);
                        }}
                        className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Remover currículo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 1. LinkedIn OAuth */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                  LinkedIn (verificado automaticamente)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                  Experiências importadas diretamente via login LinkedIn recebem o selo de autenticidade, confirmando seu vínculo profissional.
                  {isLinkedInLogin ? " Sua sessão do LinkedIn foi detectada — clique para verificar e importar." : ""}
                </p>
                <button
                  type="button"
                  onClick={handleFillFromLinkedIn}
                  className="w-full py-2.5 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 transition"
                >
                  Verificar Autenticidade via LinkedIn
                </button>
                {isLinkedInLogin && (
                  <p className="text-xs text-emerald-700 mt-2">Login LinkedIn detectado.</p>
                )}
              </div>

              </div>

              {/* Adicionar manualmente */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-slate-600 p-4">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  Adicionar manualmente
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={manualCompany}
                    onChange={(e) => setManualCompany(e.target.value)}
                    placeholder="Nome da empresa"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  <input
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value)}
                    placeholder="Cargo / Função exercida"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
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
                    {structuredExperiences.map((exp, idx) => {
                      const isLinkedInVerified = !!exp.verified;
                      const isCrossReferenced = !!exp.crossReferencedInResume;
                      let badgeLabel = "Não verificado";
                      let badgeClass = "bg-slate-100 text-slate-500 border border-slate-200";
                      let badgeTitle = "Experiência adicionada manualmente, sem confirmação externa.";
                      if (isLinkedInVerified) {
                        badgeLabel = "✓ Verificado via LinkedIn";
                        badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-300";
                        badgeTitle = "Vínculo profissional confirmado via login OAuth do LinkedIn.";
                      } else if (isCrossReferenced) {
                        badgeLabel = "✓ Vínculo Confirmado (currículo)";
                        badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                        badgeTitle = "O nome desta empresa foi localizado no currículo carregado, reforçando a procedência da experiência.";
                      }
                      return (
                      <div
                        key={`${idx}_${exp.company}_${exp.role}`}
                        className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-600 p-3"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                            {exp.company
                              ? exp.company
                              : <span className="text-red-600">Empresa não identificada</span>}
                            {exp.role ? ` — ${exp.role}` : ""}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badgeClass}`}
                              title={badgeTitle}
                            >
                              {badgeLabel}
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
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Avatar (etapa 2 — opcional) */}
            {step === 2 && (
            <div ref={(el) => assignSectionRef(el, 5)}>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Avatar <span className="text-xs font-normal text-slate-500">(opcional)</span>
              </label>
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
              <div className="grid grid-cols-5 md:grid-cols-6 gap-2 mb-3">
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
            )}

            {/* Confirmação humano (etapa 2 — opcional) */}
            {step === 2 && (
            <div ref={(el) => assignSectionRef(el, 6)} className="space-y-3">
              {/* Selo dourado "Perfil Verificado ✓" exibido quando o usuário
                  cumpre todos os requisitos do Nível 3 (Perfil Completo). */}
              {(() => {
                const linkedInCount = (structuredExperiences || []).filter(
                  (e) => (e?.source || "").toString().toLowerCase() === "linkedin" && e?.verified
                ).length;
                const isProfileComplete = Boolean(
                  pseudonym.trim()
                    && emailVerified
                    && verifiedEmailValue === (email || "").trim().toLowerCase()
                    && linkedInCount > 0
                );
                if (!isProfileComplete) return null;
                return (
                  <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20 px-4 py-3 flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-7 w-7 text-amber-500 shrink-0"
                      fill="currentColor"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                        Perfil Verificado ✓
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Pseudônimo, e-mail confirmado e experiência LinkedIn — Nível 3 atingido.
                      </p>
                    </div>
                  </div>
                );
              })()}

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
            </div>
            )}

            {info && <p className="text-emerald-700 text-sm">{info}</p>}
            {step === 2 && error && <p className="text-red-600 text-sm">{error}</p>}

            {step === 2 && (
              <>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
                >
                  Concluir perfil
                </button>
                <button
                  type="button"
                  onClick={handleSkipStep2}
                  className="w-full py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                >
                  Pular por agora
                </button>
              </>
            )}
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChoosePseudonym;
