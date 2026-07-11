import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import { empresasBrasileiras } from "./empresas";
import { saveReview, listRecentReviews, saveSelectionProcessReview, slugifyCompany } from "./services/reviews";
import { saveCompany, listCompanies, enrichCompanyWithBrasilAPI, searchCompaniesByName } from "./services/companies";
import { getUserProfile, saveUserProfile, findUnifiedProfile } from "./services/users";
import { savePendingReview, clearPendingReview } from "./utils/pendingReview";
import { auth, db, ensureAuthReady } from "./firebase";
import { signInAnonymously, signInWithPopup, signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import { googleProvider } from "./firebase";
import { isAdmin, getUserRole } from "./utils/rbac";
import {
  clearStoredProfileId,
  isProfileAuthenticated,
  normalizeEmail,
  resolveProfileId,
} from "./utils/profileIdentity";
import { getLinkedInRedirectUri } from "./utils/linkedinAuth";
import { buildApiUrl } from "./utils/apiBase";
import { resolveUserVerificationDetail } from "./utils/verificationLevel";
import { evaluationHasPotentialPersonalName } from "./utils/personNameDetection";
import ReferralBanner from "./components/ReferralBanner";
import LawyerOfferModal from "./components/LawyerOfferModal";
import {
  getSelectedProfileType,
  ensureSelectedProfileType,
  clearSelectedProfileType,
} from "./services/profileType";

const CONNECTOR_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
const LEGAL_SUFFIXES = new Set(["S.A", "SA", "S/A", "LTDA", "ME", "MEI", "EPP", "EIRELI", "SPE", "SCP"]);
const PUBLIC_COMPANIES_BLOCKLIST = new Set([
  "banco do brasil",
  "caixa economica federal",
  "petrobras",
]);

const METRIC_KEYS = [
  "rating", "salario", "beneficios", "cultura", "oportunidades",
  "inovacao", "lideranca", "diversidade", "ambiente", "equilibrio",
  "reconhecimento", "comunicacao", "etica", "desenvolvimento",
  "saudeBemEstar", "impactoSocial", "reputacao", "estimacaoOrganizacao",
];

const LINKEDIN_OAUTH_RESULT_KEY = "linkedin_oauth_result";

const CNAE_SEGMENT_OPTIONS = [
  { code: "01", label: "01 - Agropecuária" },
  { code: "05", label: "05 - Indústria extrativa" },
  { code: "10", label: "10 - Indústria de transformação" },
  { code: "35", label: "35 - Energia e utilidades" },
  { code: "41", label: "41 - Construção civil" },
  { code: "45", label: "45 - Comércio e reparação de veículos" },
  { code: "47", label: "47 - Comércio varejista" },
  { code: "49", label: "49 - Transporte terrestre" },
  { code: "55", label: "55 - Hospedagem e alimentação" },
  { code: "58", label: "58 - Informação e comunicação" },
  { code: "62", label: "62 - Tecnologia da informação" },
  { code: "64", label: "64 - Atividades financeiras" },
  { code: "68", label: "68 - Atividades imobiliárias" },
  { code: "69", label: "69 - Jurídico, contábil e auditoria" },
  { code: "70", label: "70 - Administração e consultoria" },
  { code: "71", label: "71 - Arquitetura e engenharia" },
  { code: "72", label: "72 - Pesquisa e desenvolvimento" },
  { code: "78", label: "78 - Seleção e gestão de RH" },
  { code: "85", label: "85 - Educação" },
  { code: "86", label: "86 - Saúde" },
  { code: "93", label: "93 - Esporte, cultura e lazer" },
];

function normalizeCompanyKey(name) {
  return (name || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isBlockedPublicCompany(name) {
  return PUBLIC_COMPANIES_BLOCKLIST.has(normalizeCompanyKey(name));
}

function normalizeCompanyName(name) {
  if (!name) return "";

  return name
    .toString()
    .trim()
    .split(/\s+/)
    .map((word, idx) => {
      const cleanWord = word.replace(/[.,]/g, "");
      const upperClean = cleanWord.toUpperCase();
      const lowerWord = word.toLowerCase();

      if (idx > 0 && CONNECTOR_WORDS.has(lowerWord)) {
        return lowerWord;
      }

      if (LEGAL_SUFFIXES.has(upperClean)) {
        return upperClean;
      }

      if (/^[IVXLCDM]+$/i.test(cleanWord)) {
        return cleanWord.toUpperCase();
      }

      if (/^[A-Z]{2,}$/.test(cleanWord) && cleanWord.length <= 4) {
        return cleanWord;
      }

      return lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1);
    })
    .join(" ");
}

function sortCompaniesAlphabetically(items) {
  return [...(items || [])].sort((a, b) =>
    (a?.company || "").localeCompare(b?.company || "", "pt-BR", { sensitivity: "base" })
  );
}

function getSegmentFromCnae(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 2 ? digits.slice(0, 2) : "";
}

// Pequena alteração para forçar novo deploy (sem impacto funcional)
function Home({ theme, toggleTheme }) {
  const REVIEW_DRAFT_STORAGE_KEY = "trabalheiLa_review_draft_v1";
  const LAUNCH_POPUP_DISMISSED_KEY = "trabalheiLa_launch_popup_dismissed";
  const navigate = useNavigate();
  const location = useLocation();
  // Parâmetros vindos do fluxo de confirmação de empresa (CompanyConfirm).
  // Persistimos em sessionStorage porque o login via LinkedIn faz uma navegação
  // externa (sai do app e volta com ?code=...) que descarta a query string
  // original — sem persistir, o redirecionamento pós-login se perde.
  const COMPANY_CONFIRMED_FLAG_KEY = "trabalheiLa_companyConfirmedFlag";
  const REDIRECT_AFTER_LOGIN_KEY = "trabalheiLa_redirectAfterLogin";
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      if (params.get("companyConfirmed") === "true") {
        sessionStorage.setItem(COMPANY_CONFIRMED_FLAG_KEY, "1");
      }
      const redir = params.get("redirectAfterLogin");
      if (redir && redir.startsWith("/")) {
        sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, redir);
      }
    } catch {
      /* sessionStorage indisponível */
    }
  }, [location.search]);

  // Toast de feedback do fluxo de verificação de e-mail (?verified=1|0).
  // Após processar, limpa os parâmetros da URL para não repetir no refresh.
  const [emailVerificationToast, setEmailVerificationToast] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(location.search || "");
    const verified = params.get("verified");
    if (verified === null) return;

    if (verified === "1") {
      setEmailVerificationToast({
        type: "success",
        message: "E-mail verificado com sucesso!",
      });
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        localStorage.setItem(
          "userProfile",
          JSON.stringify({ ...stored, emailVerified: true })
        );
      } catch {
        /* ignore */
      }
    } else {
      const reason = params.get("reason") || "";
      const detailMessages = {
        expired: "Link de verificação expirado. Solicite um novo e-mail.",
        invalid_token: "Link de verificação inválido ou expirado.",
        invalid_payload: "Link de verificação inválido ou expirado.",
        missing_token: "Link de verificação inválido ou expirado.",
        server_misconfigured: "Falha de configuração no servidor de verificação.",
        persist_failed: "Não foi possível registrar a verificação. Tente novamente.",
      };
      setEmailVerificationToast({
        type: "error",
        message: detailMessages[reason] || "Link de verificação inválido ou expirado.",
      });
    }

    try {
      params.delete("verified");
      params.delete("reason");
      const next =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", next);
    } catch {
      /* ignore */
    }

    const timer = setTimeout(() => setEmailVerificationToast(null), 6000);
    return () => clearTimeout(timer);
  }, [location.search]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // firebaseStatus é renderizado apenas como aviso de erro (texto em vermelho).
  // Inicia vazio para não exibir um placeholder ("verificando...") enquanto o
  // ping de conexão está em andamento. Só será preenchido se o ping falhar.
  const [firebaseStatus, setFirebaseStatus] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [isLaunchPopupVisible, setIsLaunchPopupVisible] = useState(() => {
    try {
      return localStorage.getItem(LAUNCH_POPUP_DISMISSED_KEY) !== "1";
    } catch {
      return true;
    }
  });

  // eslint-disable-next-line no-unused-vars
  const handleCloseLaunchPopup = useCallback(() => {
    setIsLaunchPopupVisible(false);
    try {
      localStorage.setItem(LAUNCH_POPUP_DISMISSED_KEY, "1");
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let alive = true;

    const testFirebase = async () => {
      try {
        // Caso as regras do Firestore exijam autenticação, faz login anônimo primeiro.
        // IMPORTANTE: aguarda a restauração da sessão persistida antes de
        // checar `auth.currentUser`. Sem isso, logo após um reload/volta para
        // "/" o `currentUser` ainda é null e o login anônimo SUBSTITUIRIA a
        // sessão real do usuário (gerando o "Escolha seu perfil" indevido).
        await ensureAuthReady();
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        const ref = doc(db, "app_test", "ping");
        await setDoc(ref, { ts: serverTimestamp() }, { merge: true });
        if (!alive) return;
        setFirebaseStatus("");
      } catch (err) {
        if (!alive) return;
        console.error("Erro de conexão com Firebase:", err);
        const rawMessage = String(err?.message || err || "");
        if (rawMessage.includes("auth/configuration-not-found")) {
          setFirebaseStatus(
            "Firebase Auth não configurado: ative 'Anonymous' em Authentication > Sign-in method."
          );
        } else if (rawMessage.toLowerCase().includes("missing or insufficient permissions")) {
          setFirebaseStatus(
            "Sem permissão no Firestore: publique regras permitindo escrita para usuário autenticado (request.auth != null)."
          );
        } else {
          setFirebaseStatus(`Erro no Firebase: ${rawMessage}`);
        }
      }
    };

    testFirebase();
    return () => {
      alive = false;
    };
  }, []);

  const [company, setCompany] = useState(null);
  const [newCompanyCnpj, setNewCompanyCnpj] = useState("");
  const [cnpjError, setCnpjError] = useState(null);
  const [pendingCompanyData, setPendingCompanyData] = useState(null);
  const [sectorFilter, setSectorFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [manualCompanyName, setManualCompanyName] = useState("");
  const [manualSegment, setManualSegment] = useState("");
  const [manualRazaoSocial, setManualRazaoSocial] = useState("");
  // Resultados remotos do autocomplete de empresa por nome (Firestore prefix search).
  // Permite encontrar empresas que ainda não estão na lista carregada em memória.
  const [remoteCompanyOptions, setRemoteCompanyOptions] = useState([]);
  const [rating, setRating] = useState(0);
  const [commentRating, setCommentRating] = useState("");
  const [salario, setSalario] = useState(0);
  const [commentSalario, setCommentSalario] = useState("");
  const [beneficios, setBeneficios] = useState(0);
  const [commentBeneficios, setCommentBeneficios] = useState("");
  const [cultura, setCultura] = useState(0);
  const [commentCultura, setCommentCultura] = useState("");
  const [oportunidades, setOportunidades] = useState(0);
  const [commentOportunidades, setCommentOportunidades] = useState("");
  const [inovacao, setInovacao] = useState(0);
  const [commentInovacao, setCommentInovacao] = useState("");
  const [lideranca, setLideranca] = useState(0);
  const [commentLideranca, setCommentLideranca] = useState("");
  const [diversidade, setDiversidade] = useState(0);
  const [commentDiversidade, setCommentDiversidade] = useState("");
  const [discriminacao, setDiscriminacao] = useState("");
  const [commentDiscriminacao, setCommentDiscriminacao] = useState("");
  const [cargaHoraria, setCargaHoraria] = useState(0);
  const [commentCargaHoraria, setCommentCargaHoraria] = useState("");
  const [crescimento, setCrescimento] = useState(0);
  const [commentCrescimento, setCommentCrescimento] = useState("");
  const [ambiente, setAmbiente] = useState(0);
  const [commentAmbiente, setCommentAmbiente] = useState("");
  const [equilibrio, setEquilibrio] = useState(0);
  const [commentEquilibrio, setCommentEquilibrio] = useState("");
  const [reconhecimento, setReconhecimento] = useState(0);
  const [commentReconhecimento, setCommentReconhecimento] = useState("");
  const [comunicacao, setComunicacao] = useState(0);
  const [commentComunicacao, setCommentComunicacao] = useState("");
  const [etica, setEtica] = useState(0);
  const [commentEtica, setCommentEtica] = useState("");
  const [desenvolvimento, setDesenvolvimento] = useState(0);
  const [commentDesenvolvimento, setCommentDesenvolvimento] = useState("");
  const [saudeBemEstar, setSaudeBemEstar] = useState(0);
  const [commentSaudeBemEstar, setCommentSaudeBemEstar] = useState("");
  const [impactoSocial, setImpactoSocial] = useState(0);
  const [commentImpactoSocial, setCommentImpactoSocial] = useState("");
  const [reputacao, setReputacao] = useState(0);
  const [commentReputacao, setCommentReputacao] = useState("");
  const [estimacaoOrganizacao, setEstimacaoOrganizacao] = useState(0);
  const [commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [generalCommentRestrictedSegments, setGeneralCommentRestrictedSegments] = useState([]);
  // Trechos restritos por critério: { [criterionKey]: [{start,end,summary}] }
  const [criterionRestrictedSegments, setCriterionRestrictedSegments] = useState({});
  const setSegmentsForCriterion = useCallback((key, segs) => {
    setCriterionRestrictedSegments((prev) => {
      const next = { ...prev };
      if (!segs || segs.length === 0) {
        delete next[key];
      } else {
        next[key] = segs;
      }
      return next;
    });
  }, []);
  const [entrySource, setEntrySource] = useState("");
  const [contractType, setContractType] = useState("");
  const [workModel, setWorkModel] = useState("");
  // Período em que o trabalhador esteve na empresa.
  // Visível apenas para Apoiadores da plataforma — gravado no Firestore com a
  // flag `workPeriodVisibility: "supporter"` para reforçar a regra no back-end.
  const [workPeriodStartMonth, setWorkPeriodStartMonth] = useState("");
  const [workPeriodStartYear, setWorkPeriodStartYear] = useState("");
  const [workPeriodEndMonth, setWorkPeriodEndMonth] = useState("");
  const [workPeriodEndYear, setWorkPeriodEndYear] = useState("");
  const [workPeriodStillWorking, setWorkPeriodStillWorking] = useState(false);

  // Marca que o usuário NÃO foi contratado pela empresa. Ao ativar, oculta o
  // formulário dos 18 critérios e mostra o formulário de Processo Seletivo;
  // os campos de Data de Contratação (workPeriod) são resetados.
  const [selectionProcessOnly, setSelectionProcessOnlyState] = useState(false);
  const [spClarity, setSpClarity] = useState(0);
  const [spCommunication, setSpCommunication] = useState(0);
  const [spResponseTime, setSpResponseTime] = useState(0);
  const [spDiscriminationFelt, setSpDiscriminationFelt] = useState(false);
  const [spDiscriminationComment, setSpDiscriminationComment] = useState("");
  const [spEvidenceFiles, setSpEvidenceFiles] = useState([]);

  const setSelectionProcessOnly = useCallback((next) => {
    const value = Boolean(typeof next === "function" ? next(selectionProcessOnly) : next);
    setSelectionProcessOnlyState(value);
    if (value) {
      // Reseta os campos de Data de Contratação ao marcar "Não se aplica".
      setWorkPeriodStartMonth("");
      setWorkPeriodStartYear("");
      setWorkPeriodEndMonth("");
      setWorkPeriodEndYear("");
      setWorkPeriodStillWorking(false);
    }
  }, [selectionProcessOnly]);
  const didHydrateDraftRef = React.useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResponsibilityModal, setShowResponsibilityModal] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  // Popup de oferta de advogado após avaliação com nota geral abaixo de 2.0.
  const [showLawyerOfferModal, setShowLawyerOfferModal] = useState(false);
  const [lawyerOfferCompany, setLawyerOfferCompany] = useState("");
  const [pendingEvaluationData, setPendingEvaluationData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Lazy registration: modal de convite exibido após o usuário enviar
  // uma avaliação SEM ter pseudônimo. A avaliação fica bufferizada em
  // localStorage (savePendingReview) e só vai ao Firestore depois que o
  // perfil for criado em /pseudonym (drenado em ChoosePseudonym).
  const [showSignupInviteModal, setShowSignupInviteModal] = useState(false);
  const [signupInviteCompanyName, setSignupInviteCompanyName] = useState("");

  // Após login bem-sucedido, se houver um destino solicitado (via query string
  // ou sessionStorage — que sobrevive ao redirect do OAuth), navega para lá.
  useEffect(() => {
    if (!isAuthenticated) return;
    let target = "";
    try {
      target = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY) || "";
    } catch {
      target = "";
    }
    if (!target) {
      const params = new URLSearchParams(location.search || "");
      const fromQuery = params.get("redirectAfterLogin") || "";
      if (fromQuery.startsWith("/")) target = fromQuery;
    }
    if (target && target.startsWith("/")) {
      try { sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY); } catch { /* ignore */ }
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, navigate, location.search, REDIRECT_AFTER_LOGIN_KEY]);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaConfirmed, setCaptchaConfirmed] = useState(false);
  // Sinaliza que o usuário clicou em "Enviar Avaliação" e está aguardando
  // o captcha — após confirmá-lo, o fluxo deve continuar automaticamente.
  const pendingSubmitAfterCaptchaRef = React.useRef(false);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  });
  const userPseudonym = localStorage.getItem("userPseudonym") || "";
  const attemptedSegmentEnrichmentRef = React.useRef(new Set());
  const isUserAdmin = useMemo(() => {
    try {
      return isAdmin();
    } catch {
      return false;
    }
  }, []);

  // Inicializa as empresa3s dinamicamente sem erro de map
  
  const [empresas, setEmpresas] = useState(() => {
    try {
      const stored = localStorage.getItem("empresasData");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return sortCompaniesAlphabetically(
            parsed
              .map((emp) => ({
                ...emp,
                company: normalizeCompanyName(emp?.company || ""),
              }))
              .filter((emp) => !isBlockedPublicCompany(emp?.company))
          );
        }
      }
    } catch (err) {
      console.warn("Falha ao carregar empresas do localStorage:", err);
    }

    return sortCompaniesAlphabetically(
      (empresasBrasileiras || [])
        .map((nome) => normalizeCompanyName(nome))
        .filter((nome) => !isBlockedPublicCompany(nome))
        .map((nome) => ({
          company: nome,
          cnpj: null,
          razaoSocial: null,
          segmento: null,
          cnae_principal: null,
          sourceStats: { indicacao: 0, siteVagas: 0, gruposWhatsapp: 0, redesSociais: 0 },
          contractStats: { pj: 0, clt: 0 },
          workModelStats: { presencial: 0, hibrida: 0, remota: 0 },
          reviewCount: 0,
          rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
          inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
          reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
          saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
        }))
    );
  });

  useEffect(() => {
    try {
      localStorage.setItem("empresasData", JSON.stringify(empresas));
    } catch (err) {
      console.warn("Falha ao salvar empresas no localStorage:", err);
    }
  }, [empresas]);

  useEffect(() => {
    let alive = true;

    const toNumberOrZero = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const syncFromFirestore = async () => {
      try {
        // Aguarda a restauração da sessão antes de eventual login anônimo,
        // para não substituir a sessão real do usuário já logado.
        await ensureAuthReady();
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

        const [remoteCompanies, remoteReviews] = await Promise.all([
          listCompanies(500),
          listRecentReviews(1500),
        ]);

        if (!alive) return;

        setEmpresas((prev) => {
          const map = new Map(
            (prev || []).map((emp) => {
              const normalized = normalizeCompanyName(emp?.company || "");
              if (isBlockedPublicCompany(normalized)) {
                return null;
              }
              return [normalized, { ...emp, company: normalized }];
            }).filter(Boolean)
          );

          for (const rc of remoteCompanies) {
            const companyName = normalizeCompanyName(rc?.name || rc?.company || rc?.slug || "");
            if (!companyName) continue;
            if (isBlockedPublicCompany(companyName)) continue;

            if (!map.has(companyName)) {
              map.set(companyName, {
                company: companyName,
                cnpj: rc?.cnpj || null,
                razaoSocial: rc?.razaoSocial || null,
                segmento: rc?.segmento || null,
                cnae_principal: rc?.cnae_principal || null,
                website: rc?.website || null,
                logoUrl: rc?.logoUrl || null,
                sourceStats: rc?.sourceStats || null,
                contractStats: rc?.contractStats || null,
                workModelStats: rc?.workModelStats || null,
                reviewCount: Number(rc?.reviewCount) || 0,
                rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
                inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
                reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
                saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
              });
            } else {
              const current = map.get(companyName);
              map.set(companyName, {
                ...current,
                cnpj: rc?.cnpj || current?.cnpj || null,
                razaoSocial: rc?.razaoSocial || current?.razaoSocial || null,
                segmento: rc?.segmento || current?.segmento || null,
                cnae_principal: rc?.cnae_principal || current?.cnae_principal || null,
                website: rc?.website || current?.website || null,
                logoUrl: rc?.logoUrl || current?.logoUrl || null,
                cnaeCode: rc?.cnaeCode || current?.cnaeCode || null,
                cnaeDescricao: rc?.cnaeDescricao || current?.cnaeDescricao || null,
              });
            }
          }

          const agg = new Map();
          for (const review of remoteReviews) {
            const companyName = normalizeCompanyName(review?.company || "");
            if (!companyName) continue;
            if (isBlockedPublicCompany(companyName)) continue;

            if (!agg.has(companyName)) {
              const entry = { count: 0 };
              for (const key of METRIC_KEYS) {
                entry[key] = 0;
              }
              entry.sourceStats = { indicacao: 0, siteVagas: 0, gruposWhatsapp: 0, redesSociais: 0 };
              entry.contractStats = { pj: 0, clt: 0 };
              entry.workModelStats = { presencial: 0, hibrida: 0, remota: 0 };
              agg.set(companyName, entry);
            }

            const bucket = agg.get(companyName);
            bucket.count += 1;
            for (const key of METRIC_KEYS) {
              bucket[key] += toNumberOrZero(review[key]);
            }
            if (review?.entrySource && bucket.sourceStats[review.entrySource] != null) {
              bucket.sourceStats[review.entrySource] += 1;
            }
            if (review?.contractType && bucket.contractStats[review.contractType] != null) {
              bucket.contractStats[review.contractType] += 1;
            }
            if (review?.workModel && bucket.workModelStats[review.workModel] != null) {
              bucket.workModelStats[review.workModel] += 1;
            }
          }

          for (const [companyName, bucket] of agg.entries()) {
            const current = map.get(companyName) || { company: companyName };
            const next = { ...current };

            for (const key of METRIC_KEYS) {
              next[key] = bucket.count > 0 ? Number((bucket[key] / bucket.count).toFixed(2)) : 0;
            }
            next.reviewCount = bucket.count;
            next.sourceStats = bucket.sourceStats;
            next.contractStats = bucket.contractStats;
            next.workModelStats = bucket.workModelStats;

            map.set(companyName, next);
          }

          // Pós-processo: propaga logoUrl/razaoSocial entre empresas que
          // compartilham o mesmo CNPJ. Casos comuns: o doc da empresa criado
          // pelo empresário (com `razaoSocial` e `logoUrl`) tem nome diferente
          // do registro pré-existente em `empresas` (nome fantasia/cadastro
          // antigo). Sem esta etapa, o logo nunca aparece para esse cliente.
          const cnpjLogoMap = new Map();
          for (const rc of remoteCompanies) {
            const cnpjDigits = String(rc?.cnpj || "").replace(/\D/g, "");
            if (!cnpjDigits || cnpjDigits.length < 8) continue;
            if (rc?.logoUrl && !cnpjLogoMap.has(cnpjDigits)) {
              cnpjLogoMap.set(cnpjDigits, rc.logoUrl);
            }
          }
          if (cnpjLogoMap.size > 0) {
            for (const [k, emp] of map.entries()) {
              const cnpjDigits = String(emp?.cnpj || "").replace(/\D/g, "");
              if (!cnpjDigits) continue;
              const logoUrl = cnpjLogoMap.get(cnpjDigits);
              if (logoUrl && !emp.logoUrl) {
                map.set(k, { ...emp, logoUrl });
              }
            }
          }

          return sortCompaniesAlphabetically(
            Array.from(map.values()).filter((emp) => !isBlockedPublicCompany(emp?.company))
          );
        });
      } catch (err) {
        console.warn("Falha ao sincronizar empresas/reviews do Firebase:", err);
      }
    };

    syncFromFirestore();

    return () => {
      alive = false;
    };
  }, []);

  const getCompanyAverageValue = useCallback((emp) => {
    const ratings = [
      emp.rating, emp.salario, emp.beneficios, emp.cultura, emp.oportunidades,
      emp.inovacao, emp.lideranca, emp.diversidade, emp.ambiente, emp.equilibrio,
      emp.reconhecimento, emp.comunicacao, emp.etica, emp.desenvolvimento,
      emp.saudeBemEstar, emp.impactoSocial, emp.reputacao, emp.estimacaoOrganizacao,
    ].filter(val => typeof val === 'number' && !isNaN(val) && val > 0); 

    if (ratings.length === 0) return null;
    const sum = ratings.reduce((acc, curr) => acc + curr, 0);
    return sum / ratings.length;
  }, []);

  const calcularMedia = useCallback((emp) => {
    const average = getCompanyAverageValue(emp);
    if (average == null) return "--";
    return average.toFixed(1);
  }, [getCompanyAverageValue]);

  const setoresList = useMemo(() => {
    const seen = new Set();
    return empresas
      .map((emp) => emp.cnaeDescricao)
      .filter((s) => s && !seen.has(s) && seen.add(s));
  }, [empresas]);

  const segmentosList = useMemo(() => {
    const seen = new Set();
    return empresas
      .map((emp) => (emp?.segmento || "").toString().trim())
      .filter((seg) => seg && !seen.has(seg) && seen.add(seg))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [empresas]);

  const top3 = useMemo(() => {
    const filtered = empresas.filter((emp) => {
      if (sectorFilter && emp.cnaeDescricao !== sectorFilter) return false;
      if (segmentFilter && (emp?.segmento || "") !== segmentFilter) return false;
      return true;
    });
    return [...filtered]
      .sort((a, b) => {
        const avgA = getCompanyAverageValue(a);
        const avgB = getCompanyAverageValue(b);
        return (avgB ?? -1) - (avgA ?? -1);
      })
      .slice(0, 3);
  }, [empresas, getCompanyAverageValue, sectorFilter, segmentFilter]);

  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-400 to-gray-600";
    if (index === 2) return "from-orange-400 to-orange-600";
    return "from-blue-400 to-blue-600";
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🏅";
  };

  const getBadgeColor = (media) => {
    if (media == null || media === "--") return "bg-slate-500";

    const numeric = typeof media === "number" ? media : Number(media);
    if (!Number.isFinite(numeric)) return "bg-slate-500";

    if (numeric >= 4.5) return "bg-emerald-700";
    if (numeric >= 4) return "bg-lime-600";
    if (numeric >= 3) return "bg-yellow-600";
    if (numeric >= 2) return "bg-purple-600";
    return "bg-red-600";
  };

  const safeCompanyOptions = (() => {
    const localOptions = empresas
      .filter((emp) => !isBlockedPublicCompany(emp?.company))
      .map((emp) => {
        const cnpjDigits = String(emp?.cnpj || "").replace(/\D/g, "");
        const cnpjFormatted = cnpjDigits.length === 14
          ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3.$4-$5")
          : "";
        return {
          value: emp.company,
          label: emp.company,
          cnpj: cnpjDigits,
          cnpjFormatted,
          razaoSocial: emp?.razaoSocial || "",
          source: "local",
        };
      });

    // Mescla resultados remotos do autocomplete (Firestore prefix search) sem
    // duplicar empresas já presentes na lista local.
    const seen = new Set(
      localOptions.map((opt) => (opt.value || "").toString().trim().toLowerCase())
    );
    const remoteMerged = (remoteCompanyOptions || [])
      .filter((opt) => {
        const key = (opt?.value || "").toString().trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        if (isBlockedPublicCompany(opt?.value)) return false;
        seen.add(key);
        return true;
      });

    return [...localOptions, ...remoteMerged].sort((a, b) =>
      (a?.label || "").localeCompare(b?.label || "", "pt-BR", { sensitivity: "base" })
    );
  })();

  // Debounce simples para a busca remota de empresas por nome.
  const companySearchTimerRef = useRef(null);
  const companySearchTokenRef = useRef(0);
  const handleCompanyInputChange = useCallback((rawInput, meta) => {
    // O react-select dispara onInputChange tambem quando o menu fecha; nesses
    // casos `meta.action` nao e "input-change" e o `rawInput` vem vazio.
    // Ignoramos para preservar os resultados ja carregados.
    if (meta && meta.action && meta.action !== "input-change") return;

    const input = String(rawInput || "").trim();
    if (companySearchTimerRef.current) {
      clearTimeout(companySearchTimerRef.current);
      companySearchTimerRef.current = null;
    }
    if (input.length < 2) {
      setRemoteCompanyOptions([]);
      return;
    }

    const token = ++companySearchTokenRef.current;
    companySearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchCompaniesByName(input, 15);
        // Descartar resultado se uma busca mais nova ja foi disparada.
        if (token !== companySearchTokenRef.current) return;
        const mapped = (results || []).map((r) => {
          const cnpjDigits = String(r?.cnpj || "").replace(/\D/g, "");
          const cnpjFormatted = cnpjDigits.length === 14
            ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3.$4-$5")
            : "";
          return {
            value: r.name,
            label: r.name,
            cnpj: cnpjDigits,
            cnpjFormatted,
            razaoSocial: r.razaoSocial || "",
            source: "remote",
          };
        });
        setRemoteCompanyOptions(mapped);
      } catch (err) {
        console.warn("[handleCompanyInputChange] falha:", err?.message || err);
      }
    }, 300);
  }, []);

  // Limpa timer ao desmontar.
  useEffect(() => () => {
    if (companySearchTimerRef.current) clearTimeout(companySearchTimerRef.current);
  }, []);

  const [selectedCompanyData, setSelectedCompanyData] = useState(null);

  useEffect(() => {
    try {
      const storedDraft = localStorage.getItem(REVIEW_DRAFT_STORAGE_KEY);
      if (!storedDraft) {
        didHydrateDraftRef.current = true;
        return;
      }

      const draft = JSON.parse(storedDraft);
      const draftCompany = (draft?.company || "").toString().trim();

      if (draftCompany) {
        setCompany({ value: draftCompany, label: draftCompany });
      }

      if (typeof draft?.rating === "number") setRating(draft.rating);
      if (typeof draft?.commentRating === "string") setCommentRating(draft.commentRating);
      if (typeof draft?.salario === "number") setSalario(draft.salario);
      if (typeof draft?.commentSalario === "string") setCommentSalario(draft.commentSalario);
      if (typeof draft?.beneficios === "number") setBeneficios(draft.beneficios);
      if (typeof draft?.commentBeneficios === "string") setCommentBeneficios(draft.commentBeneficios);
      if (typeof draft?.cultura === "number") setCultura(draft.cultura);
      if (typeof draft?.commentCultura === "string") setCommentCultura(draft.commentCultura);
      if (typeof draft?.oportunidades === "number") setOportunidades(draft.oportunidades);
      if (typeof draft?.commentOportunidades === "string") setCommentOportunidades(draft.commentOportunidades);
      if (typeof draft?.inovacao === "number") setInovacao(draft.inovacao);
      if (typeof draft?.commentInovacao === "string") setCommentInovacao(draft.commentInovacao);
      if (typeof draft?.lideranca === "number") setLideranca(draft.lideranca);
      if (typeof draft?.commentLideranca === "string") setCommentLideranca(draft.commentLideranca);
      if (typeof draft?.diversidade === "number") setDiversidade(draft.diversidade);
      if (typeof draft?.commentDiversidade === "string") setCommentDiversidade(draft.commentDiversidade);
      if (typeof draft?.discriminacao === "string") setDiscriminacao(draft.discriminacao);
      if (typeof draft?.commentDiscriminacao === "string") setCommentDiscriminacao(draft.commentDiscriminacao);
      if (typeof draft?.cargaHoraria === "number") setCargaHoraria(draft.cargaHoraria);
      if (typeof draft?.commentCargaHoraria === "string") setCommentCargaHoraria(draft.commentCargaHoraria);
      if (typeof draft?.crescimento === "number") setCrescimento(draft.crescimento);
      if (typeof draft?.commentCrescimento === "string") setCommentCrescimento(draft.commentCrescimento);
      if (typeof draft?.ambiente === "number") setAmbiente(draft.ambiente);
      if (typeof draft?.commentAmbiente === "string") setCommentAmbiente(draft.commentAmbiente);
      if (typeof draft?.equilibrio === "number") setEquilibrio(draft.equilibrio);
      if (typeof draft?.commentEquilibrio === "string") setCommentEquilibrio(draft.commentEquilibrio);
      if (typeof draft?.reconhecimento === "number") setReconhecimento(draft.reconhecimento);
      if (typeof draft?.commentReconhecimento === "string") setCommentReconhecimento(draft.commentReconhecimento);
      if (typeof draft?.comunicacao === "number") setComunicacao(draft.comunicacao);
      if (typeof draft?.commentComunicacao === "string") setCommentComunicacao(draft.commentComunicacao);
      if (typeof draft?.etica === "number") setEtica(draft.etica);
      if (typeof draft?.commentEtica === "string") setCommentEtica(draft.commentEtica);
      if (typeof draft?.desenvolvimento === "number") setDesenvolvimento(draft.desenvolvimento);
      if (typeof draft?.commentDesenvolvimento === "string") setCommentDesenvolvimento(draft.commentDesenvolvimento);
      if (typeof draft?.saudeBemEstar === "number") setSaudeBemEstar(draft.saudeBemEstar);
      if (typeof draft?.commentSaudeBemEstar === "string") setCommentSaudeBemEstar(draft.commentSaudeBemEstar);
      if (typeof draft?.impactoSocial === "number") setImpactoSocial(draft.impactoSocial);
      if (typeof draft?.commentImpactoSocial === "string") setCommentImpactoSocial(draft.commentImpactoSocial);
      if (typeof draft?.reputacao === "number") setReputacao(draft.reputacao);
      if (typeof draft?.commentReputacao === "string") setCommentReputacao(draft.commentReputacao);
      if (typeof draft?.estimacaoOrganizacao === "number") setEstimacaoOrganizacao(draft.estimacaoOrganizacao);
      if (typeof draft?.commentEstimacaoOrganizacao === "string") setCommentEstimacaoOrganizacao(draft.commentEstimacaoOrganizacao);
      if (typeof draft?.generalComment === "string") setGeneralComment(draft.generalComment);
      if (Array.isArray(draft?.generalCommentRestrictedSegments)) {
        setGeneralCommentRestrictedSegments(draft.generalCommentRestrictedSegments);
      }
      if (draft?.criterionRestrictedSegments && typeof draft.criterionRestrictedSegments === "object") {
        setCriterionRestrictedSegments(draft.criterionRestrictedSegments);
      }
      if (typeof draft?.entrySource === "string") setEntrySource(draft.entrySource);
      if (typeof draft?.contractType === "string") setContractType(draft.contractType);
      if (typeof draft?.workModel === "string") setWorkModel(draft.workModel);
    } catch (err) {
      console.warn("Falha ao carregar rascunho da avaliacao:", err);
    } finally {
      didHydrateDraftRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!didHydrateDraftRef.current) return;

    const draft = {
      company: company?.value || "",
      rating,
      commentRating,
      salario,
      commentSalario,
      beneficios,
      commentBeneficios,
      cultura,
      commentCultura,
      oportunidades,
      commentOportunidades,
      inovacao,
      commentInovacao,
      lideranca,
      commentLideranca,
      diversidade,
      commentDiversidade,
      discriminacao,
      commentDiscriminacao,
      cargaHoraria,
      commentCargaHoraria,
      crescimento,
      commentCrescimento,
      ambiente,
      commentAmbiente,
      equilibrio,
      commentEquilibrio,
      reconhecimento,
      commentReconhecimento,
      comunicacao,
      commentComunicacao,
      etica,
      commentEtica,
      desenvolvimento,
      commentDesenvolvimento,
      saudeBemEstar,
      commentSaudeBemEstar,
      impactoSocial,
      commentImpactoSocial,
      reputacao,
      commentReputacao,
      estimacaoOrganizacao,
      commentEstimacaoOrganizacao,
      generalComment,
      generalCommentRestrictedSegments,
      criterionRestrictedSegments,
      entrySource,
      contractType,
      workModel,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(REVIEW_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (err) {
      console.warn("Falha ao salvar rascunho da avaliacao:", err);
    }
  }, [
    company,
    rating,
    commentRating,
    salario,
    commentSalario,
    beneficios,
    commentBeneficios,
    cultura,
    commentCultura,
    oportunidades,
    commentOportunidades,
    inovacao,
    commentInovacao,
    lideranca,
    commentLideranca,
    diversidade,
    commentDiversidade,
    discriminacao,
    commentDiscriminacao,
    cargaHoraria,
    commentCargaHoraria,
    crescimento,
    commentCrescimento,
    ambiente,
    commentAmbiente,
    equilibrio,
    commentEquilibrio,
    reconhecimento,
    commentReconhecimento,
    comunicacao,
    commentComunicacao,
    etica,
    commentEtica,
    desenvolvimento,
    commentDesenvolvimento,
    saudeBemEstar,
    commentSaudeBemEstar,
    impactoSocial,
    commentImpactoSocial,
    reputacao,
    commentReputacao,
    estimacaoOrganizacao,
    commentEstimacaoOrganizacao,
    generalComment,
    generalCommentRestrictedSegments,
    criterionRestrictedSegments,
    entrySource,
    contractType,
    workModel,
  ]);

  // Limpa o formulário de avaliação quando a página é desmontada (navegação
  // para outra rota) ou quando o navegador é fechado/recarregado.
  // Garante que campos de texto não persistam entre sessões/navegações.
  useEffect(() => {
    const resetForm = () => {
      setCompany(null);
      setRating(0);
      setCommentRating("");
      setSalario(0);
      setCommentSalario("");
      setBeneficios(0);
      setCommentBeneficios("");
      setCultura(0);
      setCommentCultura("");
      setOportunidades(0);
      setCommentOportunidades("");
      setInovacao(0);
      setCommentInovacao("");
      setLideranca(0);
      setCommentLideranca("");
      setDiversidade(0);
      setCommentDiversidade("");
      setDiscriminacao("");
      setCommentDiscriminacao("");
      setCargaHoraria(0);
      setCommentCargaHoraria("");
      setCrescimento(0);
      setCommentCrescimento("");
      setAmbiente(0);
      setCommentAmbiente("");
      setEquilibrio(0);
      setCommentEquilibrio("");
      setReconhecimento(0);
      setCommentReconhecimento("");
      setComunicacao(0);
      setCommentComunicacao("");
      setEtica(0);
      setCommentEtica("");
      setDesenvolvimento(0);
      setCommentDesenvolvimento("");
      setSaudeBemEstar(0);
      setCommentSaudeBemEstar("");
      setImpactoSocial(0);
      setCommentImpactoSocial("");
      setReputacao(0);
      setCommentReputacao("");
      setEstimacaoOrganizacao(0);
      setCommentEstimacaoOrganizacao("");
      setGeneralComment("");
      setGeneralCommentRestrictedSegments([]);
      setCriterionRestrictedSegments({});
      setEntrySource("");
      setContractType("");
      setWorkModel("");
      setWorkPeriodStartMonth("");
      setWorkPeriodStartYear("");
      setWorkPeriodEndMonth("");
      setWorkPeriodEndYear("");
      setWorkPeriodStillWorking(false);
      setSelectionProcessOnlyState(false);
      setSpClarity(0);
      setSpCommunication(0);
      setSpResponseTime(0);
      setSpDiscriminationFelt(false);
      setSpDiscriminationComment("");
      setSpEvidenceFiles([]);
      setManualCompanyName("");
      setManualSegment("");
      setManualRazaoSocial("");
      setNewCompanyCnpj("");
    };

    const clearDraftStorage = () => {
      try {
        localStorage.removeItem(REVIEW_DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    };

    // Limpa o rascunho ao fechar/recarregar o navegador.
    const handleBeforeUnload = () => {
      clearDraftStorage();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Ao desmontar (ex.: navegação para outra rota), zera o estado do
      // formulário e remove o rascunho persistido para que o próximo acesso
      // à Home comece com os campos limpos.
      clearDraftStorage();
      resetForm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (company) {
      const data = empresas.find((emp) => emp.company === company.value);
      setSelectedCompanyData(data);
    } else {
      setSelectedCompanyData(null);
    }
  }, [company, empresas]);

  useEffect(() => {
    const selected = selectedCompanyData;
    const cnpjDigits = String(selected?.cnpj || "").replace(/\D/g, "");
    if (!selected || !cnpjDigits) return;

    if (attemptedSegmentEnrichmentRef.current.has(cnpjDigits)) return;
    attemptedSegmentEnrichmentRef.current.add(cnpjDigits);

    (async () => {
      try {
        const enriched = await enrichCompanyWithBrasilAPI(cnpjDigits);
        if (!enriched) return;

        const nextSegmento = enriched.segmento || getSegmentFromCnae(enriched?.cnae_principal?.codigo);
        const nextCnaePrincipal = enriched.cnae_principal || null;
        const nextRazaoSocial = enriched.razaoSocial || selected?.razaoSocial || null;

        setEmpresas((prev) => prev.map((emp) => {
          if (emp.company !== selected.company) return emp;
          return {
            ...emp,
            segmento: nextSegmento || emp.segmento || null,
            cnae_principal: nextCnaePrincipal || emp.cnae_principal || null,
            razaoSocial: nextRazaoSocial || emp.razaoSocial || null,
            cnaeCode: nextCnaePrincipal?.codigo || emp.cnaeCode || null,
            cnaeDescricao: nextCnaePrincipal?.descricao || emp.cnaeDescricao || null,
            website: enriched.site || emp.website || null,
          };
        }));

        await saveCompany({
          company: selected.company,
          cnpj: cnpjDigits,
          website: enriched.site || selected.website || null,
          cnaeCode: nextCnaePrincipal?.codigo || selected.cnaeCode || null,
          cnaeDescricao: nextCnaePrincipal?.descricao || selected.cnaeDescricao || null,
          cnaePrincipal: nextCnaePrincipal,
          segmento: nextSegmento || null,
          razaoSocial: nextRazaoSocial,
        });
      } catch (err) {
        console.warn("Falha ao enriquecer segmento por CNPJ:", err);
      }
    })();
  }, [selectedCompanyData]);

  const handleAddNewCompany = useCallback(async () => {
    const cleanedCnpj = newCompanyCnpj.replace(/\D/g, "");

    if (cleanedCnpj.length !== 14) {
      setCnpjError("Por favor, informe um CNPJ válido com 14 dígitos.");
      return;
    }

    const alreadyByCnpj = empresas.some((emp) => (emp?.cnpj || "").toString().replace(/\D/g, "") === cleanedCnpj);
    if (alreadyByCnpj) {
      setCnpjError("Esta empresa já está na lista.");
      return;
    }

    setCnpjError(null);
    setIsLoading(true);

    try {
      const data = await enrichCompanyWithBrasilAPI(cleanedCnpj);
      if (!data) {
        throw new Error("CNPJ inválido ou não encontrado.");
      }

      const rawName = data.descricao || data.razaoSocial;
      const companyName = normalizeCompanyName(rawName || "");

      if (!companyName) {
        throw new Error("Não foi possível identificar o nome fantasia pelo CNPJ informado.");
      }

      if (isBlockedPublicCompany(companyName)) {
        throw new Error("Empresas públicas não são exibidas na lista desta plataforma.");
      }

      const alreadyExists = empresas.some((emp) => {
        const sameCnpj = (emp?.cnpj || "").toString().replace(/\D/g, "") === cleanedCnpj;
        const sameName = normalizeCompanyName(emp?.company || "") === companyName;
        return sameCnpj || sameName;
      });
      if (alreadyExists) {
        throw new Error("Esta empresa já está na lista.");
      }

      const website = data.site || null;
      const cnaeCode = data?.cnae_principal?.codigo || null;
      const cnaeDescricao = data?.cnae_principal?.descricao || null;
      const segmento = data?.segmento || getSegmentFromCnae(cnaeCode) || null;
      const razaoSocial = data?.razaoSocial || null;

      setPendingCompanyData({
        company: companyName,
        cnpj: cleanedCnpj,
        razaoSocial,
        segmento,
        cnae_principal: data?.cnae_principal || null,
        website,
        cnaeCode,
        cnaeDescricao,
      });
    } catch (err) {
      setCnpjError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [newCompanyCnpj, empresas]);

  const handleAddCompanyWithoutCnpj = useCallback(() => {
    if (!isUserAdmin) {
      setCnpjError("Apenas administradores podem cadastrar empresa sem CNPJ.");
      return;
    }

    const normalizedName = normalizeCompanyName(manualCompanyName || "");
    if (!normalizedName) {
      setCnpjError("Informe o nome da empresa para cadastro manual.");
      return;
    }

    if (!manualSegment) {
      setCnpjError("Selecione o segmento principal (divisão CNAE).");
      return;
    }

    const alreadyExists = empresas.some((emp) => normalizeCompanyName(emp?.company || "") === normalizedName);
    if (alreadyExists) {
      setCnpjError("Esta empresa já está na lista.");
      return;
    }

    setCnpjError(null);
    setPendingCompanyData({
      company: normalizedName,
      cnpj: null,
      website: null,
      cnaeCode: null,
      cnaeDescricao: null,
      cnae_principal: null,
      segmento: manualSegment,
      razaoSocial: (manualRazaoSocial || normalizedName || "").trim(),
    });
  }, [isUserAdmin, manualCompanyName, manualSegment, manualRazaoSocial, empresas]);

  const handleConfirmNewCompany = useCallback(async () => {
    if (!pendingCompanyData?.company) {
      setCnpjError("Informe os dados da empresa antes de confirmar.");
      return;
    }

    if (!pendingCompanyData?.cnpj && !isUserAdmin) {
      setCnpjError("Consulte um CNPJ válido antes de confirmar.");
      return;
    }

    if (!pendingCompanyData?.cnpj && !pendingCompanyData?.segmento) {
      setCnpjError("Selecione o segmento (divisão CNAE) para cadastro sem CNPJ.");
      return;
    }

    setIsLoading(true);
    setCnpjError(null);

    const pendingCnpjDigits = (pendingCompanyData.cnpj || "").toString().replace(/\D/g, "");

    const alreadyExists = empresas.some((emp) => {
      const empCnpjDigits = (emp?.cnpj || "").toString().replace(/\D/g, "");
      const sameCnpj = Boolean(pendingCnpjDigits && empCnpjDigits && empCnpjDigits === pendingCnpjDigits);
      const sameName = normalizeCompanyName(emp?.company || "") === normalizeCompanyName(pendingCompanyData.company || "");
      return sameCnpj || sameName;
    });

    if (alreadyExists) {
      setCnpjError("Esta empresa já está na lista.");
      setPendingCompanyData(null);
      setIsLoading(false);
      return;
    }

    const newCompanyData = {
      company: pendingCompanyData.company,
      cnpj: pendingCompanyData.cnpj,
      razaoSocial: pendingCompanyData.razaoSocial || null,
      segmento: pendingCompanyData.segmento || null,
      cnae_principal: pendingCompanyData.cnae_principal || null,
      website: pendingCompanyData.website || null,
      cnaeCode: pendingCompanyData.cnaeCode || null,
      cnaeDescricao: pendingCompanyData.cnaeDescricao || null,
      sourceStats: { indicacao: 0, siteVagas: 0, gruposWhatsapp: 0, redesSociais: 0 },
      contractStats: { pj: 0, clt: 0 },
      workModelStats: { presencial: 0, hibrida: 0, remota: 0 },
      rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
      inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
      reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
      saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
    };

    setEmpresas((prev) => {
      const exists = prev.some((emp) => {
        const sameName = emp.company === pendingCompanyData.company;
        const empCnpjDigits = (emp?.cnpj || "").toString().replace(/\D/g, "");
        const sameCnpj = Boolean(pendingCnpjDigits && empCnpjDigits && empCnpjDigits === pendingCnpjDigits);
        return sameName || sameCnpj;
      });
      if (exists) return prev;
      return sortCompaniesAlphabetically([...prev, newCompanyData]);
    });

    setCompany({ value: newCompanyData.company, label: newCompanyData.company });
    setNewCompanyCnpj("");
    setManualCompanyName("");
    setManualSegment("");
    setManualRazaoSocial("");
    setPendingCompanyData(null);
    setShowNewCompanyInput(false);

    try {
      await saveCompany({
        company: newCompanyData.company,
        cnpj: newCompanyData.cnpj,
        website: newCompanyData.website,
        cnaeCode: newCompanyData.cnaeCode,
        cnaeDescricao: newCompanyData.cnaeDescricao,
        cnaePrincipal: newCompanyData.cnae_principal,
        segmento: newCompanyData.segmento,
        razaoSocial: newCompanyData.razaoSocial,
      });
    } catch (saveErr) {
      console.warn("Falha ao salvar empresa no Firebase:", saveErr);
      setError(
        "Empresa adicionada localmente, mas falhou ao sincronizar com o Firebase. Tente novamente em alguns segundos."
      );
    } finally {
      setIsLoading(false);
    }
  }, [pendingCompanyData, empresas, isUserAdmin]);

  const buildEvaluationData = useCallback((termsData = {}) => {
    const pseudonym = localStorage.getItem("userPseudonym");
    const authorProfileId = resolveProfileId(userProfile, { persistGeneratedId: false }) || "";
    const authorLoginProvider = (userProfile?.loginProvider || "").toString().toLowerCase();
    const authorHasLinkedIn = Boolean(
      authorLoginProvider === "linkedin" ||
        userProfile?.linkedInUrl ||
        userProfile?.linkedinProfile ||
        (Array.isArray(userProfile?.linkedinExperiences) && userProfile.linkedinExperiences.length > 0)
    );
    const resumeData = userProfile?.resumeData;
    const authorHasResume = Boolean(
      resumeData && typeof resumeData === "object" && (
        (Array.isArray(resumeData.experiences) && resumeData.experiences.length > 0) ||
        (Array.isArray(resumeData.experiencesStructured) && resumeData.experiencesStructured.length > 0) ||
        (typeof resumeData.rawText === "string" && resumeData.rawText.trim().length > 0)
      )
    );

    // Calcula o nível de verificação 3-tier para esta avaliação.
    // Pode ser "proven" se o LinkedIn do autor contiver a empresa avaliada
    // ou se houver documento comprobatório carregado (provenCompanies).
    const targetCompany = company?.value || "";
    const detail = resolveUserVerificationDetail(userProfile || {}, targetCompany);
    const authorVerificationLevel = detail.level;
    const authorVerificationProvider = detail.provider;

    // Sistema 3 níveis: persistido no entry para o display de avaliações
    // mostrar o selo correspondente (Nível 1 e-mail, 2 LinkedIn, 3 completo).
    const authorEmailVerified = Boolean(userProfile?.emailVerified);
    const authorProfessionalVerified = Boolean(userProfile?.professionalVerified);
    const authorProfileComplete = Boolean(userProfile?.profileComplete);

    const draft = {
      company: company?.value || "",
      pseudonym: pseudonym || "",
      authorProfileId,
      authorLoginProvider,
      authorHasLinkedIn,
      authorHasResume,
      authorVerificationLevel,
      authorVerificationProvider,
      authorEmailVerified,
      authorProfessionalVerified,
      authorProfileComplete,
      rating, commentRating, salario, commentSalario, beneficios, commentBeneficios,
      cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao,
      lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente,
      discriminacao, commentDiscriminacao,
      cargaHoraria, commentCargaHoraria,
      crescimento, commentCrescimento,
      equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao,
      etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar,
      impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao,
      generalComment,
      restrictedSegments: Array.isArray(generalCommentRestrictedSegments)
        ? generalCommentRestrictedSegments
            .filter((s) => s && typeof s.summary === "string" && s.summary.trim())
            .map((s) => ({
              start: Number(s.start) || 0,
              end: Number(s.end) || 0,
              summary: s.summary.trim().slice(0, 80),
            }))
        : [],
      criterionRestrictedSegments: Object.fromEntries(
        Object.entries(criterionRestrictedSegments || {})
          .map(([key, segs]) => [
            key,
            (Array.isArray(segs) ? segs : [])
              .filter((s) => s && typeof s.summary === "string" && s.summary.trim())
              .map((s) => ({
                start: Number(s.start) || 0,
                end: Number(s.end) || 0,
                summary: s.summary.trim().slice(0, 80),
              })),
          ])
          .filter(([, segs]) => segs.length > 0)
      ),
      entrySource,
      contractType,
      workModel,
      workPeriod: {
        startMonth: workPeriodStartMonth || "",
        startYear: workPeriodStartYear || "",
        endMonth: workPeriodStillWorking ? "" : workPeriodEndMonth || "",
        endYear: workPeriodStillWorking ? "" : workPeriodEndYear || "",
        stillWorking: Boolean(workPeriodStillWorking),
      },
      workPeriodVisibility: "supporter",
      timestamp: new Date().toISOString(),
      ...termsData,
    };

    // Sinalização (não bloqueante) de potencial citação de nome de pessoa.
    // A detecção é heurística e pode gerar falsos positivos (ex.: nomes de
    // empresa/local). Persistimos o flag para revisão posterior.
    draft.hasPotentialPersonalName = evaluationHasPotentialPersonalName(draft);

    return draft;
  }, [company, userProfile, rating, commentRating, salario, commentSalario, beneficios, commentBeneficios, cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao, lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente, equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao, etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar, impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao, generalComment, generalCommentRestrictedSegments, entrySource, contractType, workModel, discriminacao, commentDiscriminacao, cargaHoraria, commentCargaHoraria, crescimento, commentCrescimento, criterionRestrictedSegments, workPeriodStartMonth, workPeriodStartYear, workPeriodEndMonth, workPeriodEndYear, workPeriodStillWorking]);

  const submitEvaluation = useCallback(async (evaluationData) => {
    // Lazy registration: o pseudônimo é OPCIONAL. Quando vazio, identificamos
    // a avaliação apenas pelo UID anônimo do Firebase Auth e a exibimos como
    // "Anônimo" até que o usuário crie um pseudônimo (ver linkAnonymousReviewsToPseudonym).
    const pseudonym = (evaluationData?.pseudonym || "").toString().trim();
    const isAnonymousAuthor = !pseudonym;

    // ──────────────────────────────────────────────────────────────────
    // LAZY REGISTRATION (etapa 1): se o usuário NÃO tem pseudônimo, NÃO
    // envia a avaliação ao Firestore agora. Bufferiza em localStorage e
    // abre o modal de convite. O envio real acontecerá em ChoosePseudonym
    // após o perfil ser criado (drainPendingReview).
    // ──────────────────────────────────────────────────────────────────
    if (isAnonymousAuthor) {
      const buffered = savePendingReview(evaluationData);
      // Dedup local rápido — evita reenvio acidental ao mesmo formulário
      // antes de criar o perfil.
      const evaluationsKey = `evaluations_${evaluationData.company}`;
      try {
        const storedEvals = localStorage.getItem(evaluationsKey);
        const existingEvals = storedEvals ? JSON.parse(storedEvals) : {};
        localStorage.setItem(
          evaluationsKey,
          JSON.stringify({ ...existingEvals, __anon_pending__: evaluationData })
        );
      } catch {
        /* ignore */
      }

      try {
        sessionStorage.setItem("trabalheiLa_postReviewPseudonymPrompt", "1");
      } catch {
        /* ignore */
      }

      localStorage.removeItem(REVIEW_DRAFT_STORAGE_KEY);
      setSignupInviteCompanyName(evaluationData?.company || "");
      setShowSignupInviteModal(true);

      if (!buffered) {
        // Fallback: se o localStorage falhar (modo privado), avisa o usuário.
        setEmailVerificationToast({
          type: "error",
          message:
            "Não conseguimos guardar sua avaliação localmente. Crie seu perfil para tentar enviar novamente.",
        });
      }
      return;
    }

    // Avaliação de Processo Seletivo (usuário NÃO contratado).
    // Persiste em coleção separada, NÃO atualiza médias da empresa.
    if (evaluationData?.type === "selectionProcess") {
      console.log("Dados prontos para envio (Processo Seletivo):", evaluationData);
      await saveSelectionProcessReview(evaluationData);
      setEmailVerificationToast({
        type: "success",
        message:
          "Avaliação do processo seletivo enviada! Obrigado por sua contribuição.",
      });
      localStorage.removeItem(REVIEW_DRAFT_STORAGE_KEY);
      setTimeout(() => {
        navigate(`/empresa?name=${encodeURIComponent(evaluationData.company)}`);
      }, 1500);
      return;
    }

    // Não permite que o mesmo pseudônimo avalie a mesma empresa mais de uma vez (cache local rápido).
    const evaluationsKey = `evaluations_${evaluationData.company}`;
    const storedEvals = localStorage.getItem(evaluationsKey);
    const existingEvals = storedEvals ? JSON.parse(storedEvals) : {};
    const dedupeKey = pseudonym;

    if (existingEvals[dedupeKey]) {
      setError("Você já avaliou essa empresa com este pseudônimo.");
      return;
    }

    const nextEvals = {
      ...existingEvals,
      [dedupeKey]: evaluationData,
    };

    try {
      localStorage.setItem(evaluationsKey, JSON.stringify(nextEvals));
    } catch {
      // Ignore falha em salvar localmente
    }

    console.log("Dados prontos para envio (Firestore):", evaluationData);

    await saveReview(evaluationData);

    // Atualiza a empresa localmente para refletir a nova avaliação
    setEmpresas((prev) =>
      prev.map((emp) => {
        if (emp.company !== evaluationData.company) return emp;

        const previousCount = Number(emp?.reviewCount) || 0;
        const nextCount = previousCount + 1;

        const averagedMetrics = {};
        for (const key of METRIC_KEYS) {
          const prevAvg = Number(emp?.[key]) || 0;
          const incoming = Number(evaluationData?.[key]) || 0;
          averagedMetrics[key] = Number((((prevAvg * previousCount) + incoming) / nextCount).toFixed(2));
        }

        const sourceStats = {
          indicacao: emp?.sourceStats?.indicacao || 0,
          siteVagas: emp?.sourceStats?.siteVagas || 0,
          gruposWhatsapp: emp?.sourceStats?.gruposWhatsapp || 0,
          redesSociais: emp?.sourceStats?.redesSociais || 0,
          [evaluationData.entrySource]: (emp?.sourceStats?.[evaluationData.entrySource] || 0) + 1,
        };

        const contractStats = {
          pj: emp?.contractStats?.pj || 0,
          clt: emp?.contractStats?.clt || 0,
          [evaluationData.contractType]: (emp?.contractStats?.[evaluationData.contractType] || 0) + 1,
        };

        const workModelStats = {
          presencial: emp?.workModelStats?.presencial || 0,
          hibrida: emp?.workModelStats?.hibrida || 0,
          remota: emp?.workModelStats?.remota || 0,
          [evaluationData.workModel]: (emp?.workModelStats?.[evaluationData.workModel] || 0) + 1,
        };

        return {
          ...emp,
          ...averagedMetrics,
          reviewCount: nextCount,
          sourceStats,
          contractStats,
          workModelStats,
        };
      })
    );

    const successMessage = evaluationData?.hasPotentialPersonalName
      ? "Avaliação enviada com sucesso! Identificamos uma possível citação de nome no seu comentário; sua avaliação foi registrada e poderá ser revisada por nossa equipe."
      : "Avaliação enviada com sucesso! Obrigado por sua contribuição.";
    setEmailVerificationToast({ type: "success", message: successMessage });
    localStorage.removeItem(REVIEW_DRAFT_STORAGE_KEY);

    // Avaliação muito negativa (nota geral < 2.0): oferece ajuda jurídica.
    // O popup assume o controle da navegação (aparece uma única vez por
    // submissão). Caso contrário, redireciona normalmente para a empresa.
    const overallAverage = getCompanyAverageValue(evaluationData);
    if (typeof overallAverage === "number" && overallAverage < 2.0) {
      setLawyerOfferCompany(evaluationData.company || "");
      setShowLawyerOfferModal(true);
      return;
    }

    setTimeout(() => {
      navigate(`/empresa?name=${encodeURIComponent(evaluationData.company)}`);
    }, 1500);
  }, [navigate, REVIEW_DRAFT_STORAGE_KEY, getCompanyAverageValue]);

  // Roda as validações e abre o modal de Termo de Responsabilidade.
  // Compartilhado entre o clique inicial em "Enviar Avaliação" (quando o
  // captcha já está confirmado) e a confirmação do captcha (que continua o
  // fluxo automaticamente, sem exigir um segundo clique do usuário).
  const runSubmissionValidationsAndOpenResponsibility = useCallback(async () => {
    // Lazy registration: NÃO exigimos mais que o usuário esteja autenticado
    // via Google/LinkedIn nem que possua verification_level "identity". O
    // signInAnonymously() roda no mount do Home (testFirebase) e garante um
    // UID Firebase válido para gravar no Firestore. A avaliação é vinculada
    // a esse UID e exibida como "Anônimo" até que o usuário crie um
    // pseudônimo (fluxo /pseudonym?after-review=1).
    if (!company) {
      setError("Por favor, selecione uma empresa para avaliar.");
      return;
    }

    // Bloqueia empresários (role admin_empresa) de avaliar a própria empresa
    // que gerenciam, garantindo a imparcialidade das avaliações.
    try {
      if (getUserRole() === "admin_empresa") {
        const selected = (company?.value || "").toString().trim().toLowerCase();
        const norm = (v) => (v || "").toString().trim().toLowerCase();
        const selectedCnpj = norm(company?.cnpj).replace(/\D/g, "");

        // 1) Compara contra campos já presentes no perfil local.
        const profileNames = [
          userProfile?.managedCompanyName,
          userProfile?.companyName,
          userProfile?.empresaNome,
          userProfile?.razaoSocial,
        ].map(norm).filter(Boolean);
        const profileCnpjs = [
          userProfile?.managedCompanyCnpj,
          userProfile?.companyCnpj,
          userProfile?.cnpj,
        ]
          .map((v) => (v || "").toString().replace(/\D/g, ""))
          .filter(Boolean);

        let isOwnCompany =
          (selected && profileNames.includes(selected)) ||
          (selectedCnpj && profileCnpjs.includes(selectedCnpj));

        // 2) Fallback: consulta Firestore por ownerUid/email do usuário.
        if (!isOwnCompany) {
          const uid = (userProfile?.uid || userProfile?.id || auth?.currentUser?.uid || "").toString();
          const email = (userProfile?.email || auth?.currentUser?.email || "").toString();
          const matches = [];
          try {
            if (uid) {
              const snap = await getDocs(
                query(collection(db, "companies"), where("ownerUid", "==", uid))
              );
              snap.forEach((d) => matches.push(d.data() || {}));
            }
          } catch { /* segue */ }
          try {
            if (email && matches.length === 0) {
              const snap = await getDocs(
                query(collection(db, "companies"), where("email", "==", email))
              );
              snap.forEach((d) => matches.push(d.data() || {}));
            }
          } catch { /* segue */ }

          isOwnCompany = matches.some((c) => {
            const name = norm(c?.razaoSocial) || norm(c?.nomeFantasia) || norm(c?.name);
            const cnpj = (c?.cnpj || "").toString().replace(/\D/g, "");
            return (
              (selected && name && name === selected) ||
              (selectedCnpj && cnpj && cnpj === selectedCnpj)
            );
          });
        }

        if (isOwnCompany) {
          setError(
            "Você não pode avaliar a própria empresa que gerencia. Por favor, avalie outras empresas."
          );
          return;
        }
      }
    } catch (err) {
      console.warn("Falha na verificação de auto-avaliação:", err);
    }

    // Branch "Não se aplica": usuário não foi contratado pela empresa. Em vez
    // dos 18 critérios, validamos as 3 estrelas do processo seletivo e
    // gravamos numa coleção separada (selectionProcessReviews).
    if (selectionProcessOnly) {
      const stars = [spClarity, spCommunication, spResponseTime];
      if (stars.some((v) => !Number(v))) {
        setError(
          "Avalie de 1 a 5 estrelas: clareza das etapas, comunicação e tempo de resposta."
        );
        return;
      }
      // Lazy registration: pseudônimo é opcional. Quando vazio, a avaliação
      // é gravada como anônima e o usuário é convidado a criar o pseudônimo
      // depois do envio (ver submitEvaluation).
      const pseudonym = (localStorage.getItem("userPseudonym") || "").toString().trim();
      const authorProfileId = resolveProfileId(userProfile, { persistGeneratedId: false }) || "";
      const companyId =
        selectedCompanyData?.id ||
        selectedCompanyData?.cnpj ||
        company?.cnpj ||
        slugifyCompany(company?.value || "");

      const data = {
        type: "selectionProcess",
        company: company?.value || "",
        companyId,
        pseudonym,
        authorProfileId,
        profileId: authorProfileId,
        clarity: Number(spClarity) || 0,
        communication: Number(spCommunication) || 0,
        responseTime: Number(spResponseTime) || 0,
        discriminationFelt: Boolean(spDiscriminationFelt),
        discriminationComment: spDiscriminationFelt
          ? (spDiscriminationComment || "").trim()
          : "",
        // Os arquivos (File[]) seguem no payload em memória apenas para serem
        // enviados ao Storage no momento da confirmação. URLs resultantes são
        // gravadas em `evidenceFiles` antes do setDoc.
        _pendingEvidenceFiles: spDiscriminationFelt ? (spEvidenceFiles || []) : [],
        timestamp: new Date().toISOString(),
      };

      setError(null);
      setResponsibilityAccepted(false);
      setPendingEvaluationData(data);
      setShowResponsibilityModal(true);
      return;
    }

    if (!entrySource) {
      setError("Selecione como você entrou na empresa.");
      return;
    }

    if (!contractType) {
      setError("Selecione a forma de contratação.");
      return;
    }

    if (!workModel) {
      setError("Selecione o modelo de trabalho.");
      return;
    }

    if (discriminacao === "sim" && !commentDiscriminacao.trim()) {
      setError("Você indicou que sofreu discriminação. Por favor, descreva a situação no comentário.");
      return;
    }

    // Lazy registration: pseudônimo é opcional. Se ausente, a avaliação fica
    // como "Anônimo" e o usuário é convidado a criar o pseudônimo depois.
    setError(null);
    setResponsibilityAccepted(false);
    setPendingEvaluationData(buildEvaluationData());
    setShowResponsibilityModal(true);
  }, [company, userProfile, entrySource, contractType, workModel, discriminacao, commentDiscriminacao, buildEvaluationData, selectionProcessOnly, spClarity, spCommunication, spResponseTime, spDiscriminationFelt, spDiscriminationComment, spEvidenceFiles, selectedCompanyData]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!captchaConfirmed) {
      // Marca que a confirmação do captcha deve disparar a continuação
      // imediata do envio, sem que o usuário precise clicar novamente.
      pendingSubmitAfterCaptchaRef.current = true;
      setShowCaptcha(true);
      return;
    }

    runSubmissionValidationsAndOpenResponsibility();
  }, [captchaConfirmed, runSubmissionValidationsAndOpenResponsibility]);

  // Chamado pelo CaptchaModal ao confirmar. Fecha o captcha e — se houver
  // um envio pendente — encadeia automaticamente o próximo modal de
  // confirmação (Termo de Responsabilidade).
  const handleCaptchaConfirmed = useCallback(() => {
    setCaptchaConfirmed(true);
    setShowCaptcha(false);
    if (pendingSubmitAfterCaptchaRef.current) {
      pendingSubmitAfterCaptchaRef.current = false;
      // Aguarda o próximo tick para garantir que o estado foi propagado
      // antes de validar o restante do formulário.
      setTimeout(() => {
        runSubmissionValidationsAndOpenResponsibility();
      }, 0);
    }
  }, [runSubmissionValidationsAndOpenResponsibility]);

  const handleCancelResponsibility = useCallback(() => {
    setShowResponsibilityModal(false);
    setResponsibilityAccepted(false);
    setPendingEvaluationData(null);
  }, []);

  const handleConfirmResponsibility = useCallback(async () => {
    if (!responsibilityAccepted || !pendingEvaluationData) return;

    setIsLoading(true);
    setShowResponsibilityModal(false);
    setError(null);

    try {
      // Garante usuário autenticado (anônimo se necessário) ANTES de tentar
      // upload no Storage — as regras costumam exigir request.auth != null.
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch { /* segue mesmo assim */ }
      }

      // Upload das evidências (fotos/vídeos) para o Firebase Storage. Em caso
      // de falha individual, registra o erro e continua com os demais.
      const pendingFiles = Array.isArray(pendingEvaluationData?._pendingEvidenceFiles)
        ? pendingEvaluationData._pendingEvidenceFiles
        : [];
      const uploadedEvidence = [];
      if (pendingFiles.length > 0) {
        const ownerSlug = slugifyCompany(pendingEvaluationData?.pseudonym || "anon");
        const companySlugForPath = slugifyCompany(pendingEvaluationData?.company || "empresa");
        for (const file of pendingFiles) {
          try {
            const safeName = (file?.name || "arquivo").replace(/[^\w.-]+/g, "_");
            const path = `evaluationEvidence/${companySlugForPath}/${ownerSlug}/${Date.now()}-${safeName}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file, { contentType: file.type || "application/octet-stream" });
            const url = await getDownloadURL(sRef);
            uploadedEvidence.push({
              url,
              name: file.name || safeName,
              type: file.type || "",
              size: file.size || 0,
              path,
            });
          } catch (uploadErr) {
            console.warn("[Home] falha ao enviar evidência", uploadErr);
          }
        }
      }

      const { _pendingEvidenceFiles, ...cleanPending } = pendingEvaluationData;
      const evaluationData = {
        ...cleanPending,
        evidenceFiles: uploadedEvidence,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
      };

      await submitEvaluation(evaluationData);
    } catch (err) {
      const rawMessage = String(err?.message || "Erro desconhecido");
      if (rawMessage.toLowerCase().includes("missing or insufficient permissions")) {
        setError(
          "Sem permissão no Firestore. Ajuste as Rules para permitir escrita com usuário autenticado (request.auth != null)."
        );
      } else {
        setError("Erro ao enviar avaliação: " + rawMessage);
      }
    } finally {
      setPendingEvaluationData(null);
      setResponsibilityAccepted(false);
      setIsLoading(false);
      setCaptchaConfirmed(false);
      setSpEvidenceFiles([]);
    }
  }, [responsibilityAccepted, pendingEvaluationData, submitEvaluation]);

  const handleSaibaMais = useCallback(() => {
    if (!company) {
      setError("Selecione uma empresa para ver mais detalhes.");
      return;
    }
    navigate(`/empresa?name=${encodeURIComponent(company.value)}`);
  }, [company, navigate]);

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
  const linkedInRedirectUri = getLinkedInRedirectUri();

  useEffect(() => {
    const updateFromStorage = () => {
      const storedProfile = localStorage.getItem("userProfile");

      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile);
          const normalizedProfile = {
            ...parsed,
            avatar: parsed?.avatar || parsed?.picture || "",
            picture: parsed?.picture || parsed?.avatar || "",
          };
          setUserProfile(normalizedProfile);
          setIsAuthenticated(isProfileAuthenticated(normalizedProfile));
        } catch {
          setUserProfile({});
          setIsAuthenticated(false);
        }
      } else {
        setUserProfile({});
        setIsAuthenticated(false);
      }

    };

    updateFromStorage();

    window.addEventListener("trabalheiLa_user_updated", updateFromStorage);
    window.addEventListener("focus", updateFromStorage);
    return () => {
      window.removeEventListener("trabalheiLa_user_updated", updateFromStorage);
      window.removeEventListener("focus", updateFromStorage);
    };
  }, []);

  // Reconciliação com a sessão REAL do Firebase Auth.
  //
  // A Home deriva `isAuthenticated` do `localStorage.userProfile` (durável),
  // mas a sessão do Auth pode expirar / ser despejada do storage. Sem esta
  // reconciliação a Home segue mostrando "Bem-vindo(a)" enquanto RequireAuth/
  // MinhaConta (que olham `onAuthStateChanged`) redirecionam para /login —
  // exatamente a divergência relatada ("desloga após horas").
  //
  // A PRIMEIRA emissão do `onAuthStateChanged` é autoritativa: o SDK só a
  // dispara depois de tentar restaurar a sessão persistida. Se nessa primeira
  // emissão não houver usuário REAL (null ou anônimo), a sessão realmente não
  // existe → rebaixamos a Home para o estado deslogado e limpamos o cache
  // local (senão o handler de `focus` re-autenticaria a partir do
  // localStorage, gerando flip-flop). Emissões posteriores só fazem UPGRADE
  // (login real); nunca rebaixam por causa do nosso próprio
  // `signInAnonymously` (usado para ler dados públicos).
  const authReconciledRef = React.useRef(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const isRealUser = !!u && !u.isAnonymous;

      if (!authReconciledRef.current) {
        authReconciledRef.current = true;
        if (isRealUser) {
          setIsAuthenticated(true);
          return;
        }
        // Sessão ausente na restauração: alinha a Home ao que os guards veem.
        let hadLocalProfile = false;
        try {
          hadLocalProfile = isProfileAuthenticated(
            JSON.parse(localStorage.getItem("userProfile") || "{}")
          );
        } catch {
          hadLocalProfile = false;
        }
        if (hadLocalProfile) {
          try {
            localStorage.removeItem("userProfile");
            localStorage.removeItem("userPseudonym");
          } catch {
            /* ignore */
          }
          try { clearStoredProfileId(); } catch { /* ignore */ }
          setUserProfile({});
          window.dispatchEvent(new Event("trabalheiLa_user_updated"));
        }
        setIsAuthenticated(false);
        return;
      }

      // Emissões subsequentes: apenas promover ao detectar login real.
      if (isRealUser) setIsAuthenticated(true);
    });
    return () => unsub();
  }, []);

  // Enriquecimento do userProfile via /users/{uid} no Firestore.
  // Sem isso, role/userType/managedCompanyId/isEmployer ficam ausentes em
  // localStorage para empresários que cadastraram via fluxos que não
  // gravam essas chaves localmente — o que faz o botão "Painel Empresa"
  // sumir e "Crie seu perfil" aparecer indevidamente.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (!snap.exists()) return;
        const data = snap.data() || {};
        let existing = {};
        try {
          existing = JSON.parse(localStorage.getItem("userProfile") || "{}");
        } catch {
          existing = {};
        }
        const merged = {
          ...existing,
          uid: existing.uid || u.uid,
          id: existing.id || u.uid,
          email: existing.email || u.email || "",
          // O campo público `name` nunca deve receber o nome real vindo
          // do provider (Google/LinkedIn). Mantemos apenas o que o próprio
          // usuário já escolheu como pseudônimo (existing.name) ou o
          // valor já salvo no doc Firestore (data.name = pseudônimo).
          name: existing.name || data.name || "",
          // Nome real do provider fica restrito a campos privados.
          nomeReal: existing.nomeReal || u.displayName || data.nomeReal || data.fullName || "",
          fullName: existing.fullName || u.displayName || data.fullName || data.nomeReal || "",
          // Campos do perfil usados para detectar empresário:
          role: data.role || existing.role || "",
          userType: data.userType || existing.userType || "",
          isEmployer:
            data.isEmployer === true ||
            existing.isEmployer === true ||
            data.role === "admin_empresa" ||
            existing.role === "admin_empresa",
          managedCompanyId:
            data.managedCompanyId || existing.managedCompanyId || null,
          managedCompanyName:
            data.managedCompanyName || existing.managedCompanyName || null,
        };
        localStorage.setItem("userProfile", JSON.stringify(merged));
        window.dispatchEvent(new Event("trabalheiLa_user_updated"));

        // Propaga o logoUrl da empresa do usuário para o estado `empresas`,
        // garantindo que o card da home exiba a logo cadastrada mesmo quando
        // o doc não foi retornado por listCompanies (sem createdAt, paginação,
        // diferença de nome entre o cadastro antigo e o atual etc.).
        try {
          const candidates = [];
          if (merged.managedCompanyId) {
            const cSnap = await getDoc(doc(db, "companies", merged.managedCompanyId));
            if (cSnap.exists()) candidates.push({ id: cSnap.id, ...cSnap.data() });
          }
          if (!candidates.length) {
            const qs = await getDocs(
              query(collection(db, "companies"), where("ownerUid", "==", u.uid))
            );
            qs.docs.forEach((d) => candidates.push({ id: d.id, ...d.data() }));
          }
          const ownCompany = candidates.find((c) => c?.logoUrl) || candidates[0];
          if (ownCompany?.logoUrl) {
            const ownCnpj = String(ownCompany.cnpj || "").replace(/\D/g, "");
            const ownRazao = (ownCompany.razaoSocial || ownCompany.name || "")
              .toString()
              .toLowerCase();
            setEmpresas((prev) =>
              prev.map((emp) => {
                const empCnpj = String(emp.cnpj || "").replace(/\D/g, "");
                const empName = (emp.company || "").toString().toLowerCase();
                const matchByCnpj =
                  ownCnpj && empCnpj && empCnpj === ownCnpj;
                const matchByName =
                  ownRazao && empName && (empName.includes(ownRazao) || ownRazao.includes(empName));
                if ((matchByCnpj || matchByName) && !emp.logoUrl) {
                  return { ...emp, logoUrl: ownCompany.logoUrl };
                }
                return emp;
              })
            );
          }
        } catch (err) {
          console.warn("[Home] falha ao propagar logo da empresa do usuário", err);
        }
      } catch (err) {
        console.warn("[Home] falha ao enriquecer userProfile com /users/{uid}", err);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Falha ao encerrar sessão do Firebase Auth:", err);
    }
    localStorage.removeItem("userProfile");
    localStorage.removeItem("userPseudonym");
    clearStoredProfileId();
    setUserProfile({});
    setIsAuthenticated(false);
    window.dispatchEvent(new Event("trabalheiLa_user_updated"));
  }, []);

  const promptProfileCompletion = useCallback((provider) => {
    if (typeof window === "undefined") return;
    // Evita depender de confirm() em mobile/in-app browsers, onde pode falhar silenciosamente.
    const providerParam = (provider || "").toString().trim().toLowerCase();
    const search = providerParam ? `?provider=${encodeURIComponent(providerParam)}` : "";
    navigate(`/pseudonym${search}`);
  }, [navigate]);

  const loadPersistedProfile = useCallback(async (profile) => {
    const resolvedId = resolveProfileId(profile, { persistGeneratedId: false });
    const rawId = (profile?.id || "").toString().trim();
    const email = normalizeEmail(profile?.email);
    const cpf = (profile?.cpf || "").toString().replace(/\D/g, "");

    // Busca unificada: tenta ID direto, depois email, depois CPF
    try {
      const unified = await findUnifiedProfile({
        id: resolvedId || rawId || undefined,
        email: email || undefined,
        cpf: cpf || undefined,
      });
      if (unified) return unified;
    } catch {
      // fallback para busca por candidatos
    }

    // Fallback: tenta IDs alternativos
    const candidates = [];
    if (resolvedId) candidates.push(resolvedId);
    if (rawId && !candidates.includes(rawId)) candidates.push(rawId);
    if (email && !candidates.includes(`email:${email}`)) candidates.push(`email:${email}`);

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

  const handleLoginSuccess = useCallback(async ({ code, profile }) => {
    setIsLoading(true);
    try {
      // Captura o perfil escolhido na Landing (Trabalhador/Especialista)
      // ANTES de qualquer processamento. Default "worker".
      const selectedProfileType = ensureSelectedProfileType();
      let data = profile;

      if (!data && code) {
        const response = await fetch(buildApiUrl("/api/linkedin-auth"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: linkedInRedirectUri,
          }),
        });

        const rawText = await response.text();
        try {
          data = rawText ? JSON.parse(rawText) : {};
        } catch {
          data = { error: rawText || `Erro HTTP ${response.status}` };
        }

        if (!response.ok && !data?.error) {
          data = { ...data, error: `Erro HTTP ${response.status}` };
        }

        if (data.error) {
          throw new Error(data.error);
        }
      }

      if (data) {
        const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const incomingPicture = data?.picture || data?.avatar || "";
        // Nome real vindo do LinkedIn fica em campos privados (nomeReal/
        // fullName). Não copiamos `data.name` para o campo público `name`
        // do mergedProfile — esse permanece como pseudônimo já escolhido.
        const { name: linkedinRealName, ...linkedinDataWithoutName } = data || {};
        let mergedProfile = {
          ...existingProfile,
          ...linkedinDataWithoutName,
          // Preserva qualquer pseudônimo já existente; nunca herda nome real.
          name: existingProfile?.name || "",
          nomeReal: existingProfile?.nomeReal || linkedinRealName || "",
          fullName: existingProfile?.fullName || linkedinRealName || "",
          loginProvider: "linkedin",
          fallback: false,
          linkedInUrl: data?.linkedInUrl || existingProfile?.linkedInUrl || null,
          avatar: incomingPicture || existingProfile?.avatar || existingProfile?.picture || "",
          picture: incomingPicture || existingProfile?.picture || existingProfile?.avatar || "",
          // Mantém o tipo de perfil já escolhido; se vazio, aplica o
          // selecionado na Landing (default "worker").
          profileTypeChosen:
            existingProfile?.profileTypeChosen || selectedProfileType,
        };

        let profileId = resolveProfileId(mergedProfile);
        try {
          const persisted = await loadPersistedProfile({ ...mergedProfile, profileId });
          if (persisted) {
            // Usa o ID do perfil existente para unificar contas
            profileId = persisted.id || persisted.profileId || profileId;
            const existingLinked = Array.isArray(persisted.linkedAccounts) ? persisted.linkedAccounts : [];
            const alreadyHasLinkedin = existingLinked.some((a) => a.provider === "linkedin");
            const linkedAccounts = alreadyHasLinkedin
              ? existingLinked
              : [...existingLinked, { provider: "linkedin", linkedAt: new Date().toISOString() }];

            mergedProfile = {
              ...persisted,
              ...mergedProfile,
              linkedAccounts,
              resumeData: {
                ...(persisted.resumeData || {}),
                ...(mergedProfile.resumeData || {}),
              },
              avatar:
                mergedProfile.avatar ||
                persisted.avatar ||
                persisted.picture ||
                mergedProfile.picture ||
                "",
              picture:
                mergedProfile.picture ||
                persisted.picture ||
                persisted.avatar ||
                mergedProfile.avatar ||
                "",
            };
          }
        } catch (loadErr) {
          console.warn("Falha ao carregar perfil persistido do usuário:", loadErr);
        }

        const localPseudonym = (localStorage.getItem("userPseudonym") || "").toString().trim();
        const persistedPseudo = (mergedProfile?.pseudonimo || "").toString().trim();
        const effectiveName = (localPseudonym || persistedPseudo || "").toString().trim();
        if (effectiveName) {
          localStorage.setItem("userPseudonym", effectiveName);
          mergedProfile = { ...mergedProfile, pseudonimo: effectiveName };
        }

        mergedProfile = { ...mergedProfile, profileId };

        localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
        setUserProfile(mergedProfile);
        setIsAuthenticated(true);

        // Salva o usuário no Fire1store (para acompanhar perfis)
        try {
          await saveUserProfile({
            id: profileId,
            // `name` público deve conter SOMENTE o pseudônimo escolhido.
            // O nome real do LinkedIn fica restrito a `nomeReal`/`fullName`,
            // que são campos privados e nunca exibidos publicamente.
            name: effectiveName || undefined,
            pseudonimo: effectiveName || undefined,
            nomeReal: mergedProfile.nomeReal || undefined,
            fullName: mergedProfile.fullName || mergedProfile.nomeReal || undefined,
            email: mergedProfile.email,
            picture: mergedProfile.picture || mergedProfile.avatar || "",
            avatar: mergedProfile.avatar || mergedProfile.picture || "",
            loginProvider: "linkedin",
            // Login social = Identidade Verificada (selo azul) imediatamente.
            verification_level: "identity",
            verification_provider: "linkedin",
            linkedinProfile: mergedProfile.linkedInUrl || null,
            linkedinExperiences: Array.isArray(mergedProfile.linkedinExperiences) ? mergedProfile.linkedinExperiences : [],
            profileTypeChosen: mergedProfile.profileTypeChosen || selectedProfileType,
            profileId,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Falha ao salvar perfil no Firebase:", err);
        }

        const pseudonym = localStorage.getItem("userPseudonym");
        if (!pseudonym) {
          // Usuário NOVO via LinkedIn: vai EXCLUSIVAMENTE para a tela de
          // pseudônimo (sem e-mail/senha).
          promptProfileCompletion("linkedin");
        } else {
          // Usuário recorrente: já logado. Limpa o storage temporário
          // de perfil (já foi gravado em `profileTypeChosen`).
          clearSelectedProfileType();
          window.dispatchEvent(new Event("trabalheiLa_user_updated"));
        }
      }
    } catch (err) {
      console.error("Erro ao validar login no backend:", err);
      const rawMessage = String(err?.message || "").trim();
      setError(rawMessage ? `Falha ao conectar com o LinkedIn: ${rawMessage}` : "Falha ao conectar com o LinkedIn.");
    } finally {
      setIsLoading(false);
    }
  }, [linkedInRedirectUri, loadPersistedProfile, promptProfileCompletion]);

  const handleGoogleLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Captura o perfil escolhido na Landing (Trabalhador/Especialista)
      // ANTES do popup. Default "worker".
      const selectedProfileType = ensureSelectedProfileType();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result?.user;

      if (!user) {
        throw new Error("Falha ao autenticar com Google.");
      }

      const googleData = {
        id: user.uid,
        // `name` público nunca recebe o displayName vindo do Google.
        // O nome real fica preservado em `nomeReal`/`fullName` (privados).
        name: "",
        nomeReal: user.displayName || "",
        fullName: user.displayName || "",
        email: user.email || "",
        picture: user.photoURL || "",
        avatar: user.photoURL || "",
        loginProvider: "google",
      };

      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      let mergedProfile = {
        ...existingProfile,
        ...googleData,
        fallback: false,
        avatar: googleData.avatar || existingProfile.avatar || existingProfile.picture || "",
        picture: googleData.picture || existingProfile.picture || existingProfile.avatar || "",
        // Mantém o tipo de perfil já escolhido; se vazio, aplica o
        // selecionado na Landing (default "worker").
        profileTypeChosen:
          existingProfile?.profileTypeChosen || selectedProfileType,
      };

      let profileId = resolveProfileId(mergedProfile);
      try {
        const persisted = await loadPersistedProfile({ ...mergedProfile, profileId });
        if (persisted) {
          // Usa o ID do perfil existente para unificar contas
          profileId = persisted.id || persisted.profileId || profileId;
          const existingLinked = Array.isArray(persisted.linkedAccounts) ? persisted.linkedAccounts : [];
          const alreadyHasGoogle = existingLinked.some((a) => a.provider === "google");
          const linkedAccounts = alreadyHasGoogle
            ? existingLinked
            : [...existingLinked, { provider: "google", linkedAt: new Date().toISOString() }];

          mergedProfile = {
            ...persisted,
            ...mergedProfile,
            linkedAccounts,
            resumeData: {
              ...(persisted.resumeData || {}),
              ...(mergedProfile.resumeData || {}),
            },
            avatar:
              mergedProfile.avatar ||
              persisted.avatar ||
              persisted.picture ||
              mergedProfile.picture ||
              "",
            picture:
              mergedProfile.picture ||
              persisted.picture ||
              persisted.avatar ||
              mergedProfile.avatar ||
              "",
          };
        }
      } catch (loadErr) {
        console.warn("Falha ao carregar perfil persistido do usuário:", loadErr);
      }

      const localPseudonym = (localStorage.getItem("userPseudonym") || "").toString().trim();
      const persistedPseudo = (mergedProfile?.pseudonimo || "").toString().trim();
      const effectiveName = (localPseudonym || persistedPseudo || "").toString().trim();
      if (effectiveName) {
        localStorage.setItem("userPseudonym", effectiveName);
        mergedProfile = { ...mergedProfile, pseudonimo: effectiveName };
      }

      mergedProfile = { ...mergedProfile, profileId };

      localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
      setUserProfile(mergedProfile);
      setIsAuthenticated(true);

      try {
        await saveUserProfile({
          id: profileId,
          // `name` público deve conter SOMENTE o pseudônimo escolhido.
          // O nome real do Google fica restrito a `nomeReal`/`fullName`,
          // que são campos privados e nunca exibidos publicamente.
          name: effectiveName || undefined,
          pseudonimo: effectiveName || undefined,
          nomeReal: mergedProfile.nomeReal || undefined,
          fullName: mergedProfile.fullName || mergedProfile.nomeReal || undefined,
          email: mergedProfile.email,
          picture: mergedProfile.picture || mergedProfile.avatar || "",
          avatar: mergedProfile.avatar || mergedProfile.picture || "",
          loginProvider: "google",
          // Login social = Identidade Verificada (selo azul) imediatamente.
          // Sem isso, o doc fica com verification_level ausente e cai em
          // "free" na próxima leitura.
          verification_level: "identity",
          verification_provider: "google",
          profileTypeChosen: mergedProfile.profileTypeChosen || selectedProfileType,
          profileId,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Falha ao salvar perfil Google no Firebase:", err);
      }

      const pseudonym = localStorage.getItem("userPseudonym");
      if (!pseudonym) {
        // Usuário NOVO via Google: vai EXCLUSIVAMENTE para a tela de
        // pseudônimo (sem e-mail/senha).
        promptProfileCompletion("google");
      } else {
        // Usuário recorrente: já logado. Limpa o storage temporário.
        clearSelectedProfileType();
        window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      }
    } catch (err) {
      console.error("Erro ao autenticar com Google:", err);
      const authCode = String(err?.code || "");
      if (authCode.includes("auth/unauthorized-domain")) {
        setError("Domínio não autorizado no Firebase Auth. Adicione este domínio em Authentication > Settings > Authorized domains.");
      } else if (authCode.includes("auth/popup-blocked")) {
        setError("Popup do Google bloqueado. Permita popups e tente novamente.");
      } else if (authCode.includes("auth/popup-closed-by-user")) {
        setError("Login com Google cancelado antes da conclusão.");
      } else {
        setError("Falha ao conectar com Google.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadPersistedProfile, promptProfileCompletion]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    let linkedInCode = params.get("linkedin_code") || params.get("code");
    let linkedInError = params.get("linkedin_error") || params.get("error");
    let linkedInErrorDescription =
      params.get("linkedin_error_description") || params.get("error_description") || "";

    if (!linkedInCode && !linkedInError) {
      try {
        const rawStored = localStorage.getItem(LINKEDIN_OAUTH_RESULT_KEY);
        if (rawStored) {
          const stored = JSON.parse(rawStored);
          const payload = stored?.payload || stored;

          if (payload?.type === "linkedin_oauth_error") {
            linkedInError = payload?.message || "Erro desconhecido no login LinkedIn";
          } else if (payload?.type === "linkedin_oauth") {
            linkedInCode = payload?.code || "";
          }
        }
      } catch {
        // ignore malformed storage values
      }
    }

    if (linkedInError) {
      setError(`Falha ao conectar com LinkedIn: ${linkedInErrorDescription || linkedInError}`);
      try {
        localStorage.removeItem(LINKEDIN_OAUTH_RESULT_KEY);
      } catch {
        // ignore storage failures
      }
      const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
      window.history.replaceState({}, "", cleanUrl || "/");
      return;
    }

    if (!linkedInCode) return;

    try {
      localStorage.removeItem(LINKEDIN_OAUTH_RESULT_KEY);
    } catch {
      // ignore storage failures
    }

    handleLoginSuccess({ code: linkedInCode });

    const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", cleanUrl || "/");
  }, [location.search, handleLoginSuccess]);

  // Nível de verificação do usuário corrente (free | identity | proven),
  // usado pelos formulários para bloquear o envio de avaliações de usuários
  // ainda não autenticados via LinkedIn/Google.
  const userVerificationLevel = useMemo(
    () => resolveUserVerificationDetail(userProfile || {}, company?.value || "")?.level || "free",
    [userProfile, company]
  );

  const commonProps = {
    company, setCompany, rating, setRating, commentRating, setCommentRating,
    salario, setSalario, commentSalario, setCommentSalario, beneficios, setBeneficios, commentBeneficios, setCommentBeneficios,
    cultura, setCultura, commentCultura, setCommentCultura, oportunidades, setOportunidades, commentOportunidades, setCommentOportunidades,
    inovacao, setInovacao, commentInovacao, setCommentInovacao, lideranca, setLideranca, commentLideranca, setCommentLideranca,
    diversidade, setDiversidade, commentDiversidade, setCommentDiversidade, ambiente, setAmbiente, commentAmbiente, setCommentAmbiente,
    discriminacao, setDiscriminacao, commentDiscriminacao, setCommentDiscriminacao,
    cargaHoraria, setCargaHoraria, commentCargaHoraria, setCommentCargaHoraria,
    crescimento, setCrescimento, commentCrescimento, setCommentCrescimento,
    equilibrio, setEquilibrio, commentEquilibrio, setCommentEquilibrio, reconhecimento, setReconhecimento, commentReconhecimento, setCommentReconhecimento,
    comunicacao, setComunicacao, commentComunicacao, setCommentComunicacao, etica, setEtica, commentEtica, setCommentEtica,
    desenvolvimento, setDesenvolvimento, commentDesenvolvimento, setCommentDesenvolvimento, saudeBemEstar, setSaudeBemEstar, commentSaudeBemEstar, setCommentSaudeBemEstar,
    impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial, reputacao, setReputacao, commentReputacao, setCommentReputacao,
    estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
    entrySource, setEntrySource, contractType, setContractType, workModel, setWorkModel,
    workPeriodStartMonth, setWorkPeriodStartMonth, workPeriodStartYear, setWorkPeriodStartYear,
    workPeriodEndMonth, setWorkPeriodEndMonth, workPeriodEndYear, setWorkPeriodEndYear,
    workPeriodStillWorking, setWorkPeriodStillWorking,
    selectionProcessOnly, setSelectionProcessOnly,
    spClarity, setSpClarity,
    spCommunication, setSpCommunication,
    spResponseTime, setSpResponseTime,
    spDiscriminationFelt, setSpDiscriminationFelt,
    spDiscriminationComment, setSpDiscriminationComment,
    spEvidenceFiles, setSpEvidenceFiles,
    generalComment, setGeneralComment,
    generalCommentRestrictedSegments, setGeneralCommentRestrictedSegments,
    criterionRestrictedSegments, setSegmentsForCriterion,
    handleSubmit, isLoading, empresas, top3,
    sectorFilter, setSectorFilter, setoresList,
    segmentFilter, setSegmentFilter, segmentosList,
    newCompanyCnpj, setNewCompanyCnpj, cnpjError,
    manualCompanyName, setManualCompanyName,
    manualSegment, setManualSegment,
    manualRazaoSocial, setManualRazaoSocial,
    cnaeSegmentOptions: CNAE_SEGMENT_OPTIONS,
    isUserAdmin,
    showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
    handleAddCompanyWithoutCnpj,
    handleConfirmNewCompany, pendingCompanyData,
    linkedInClientId, linkedInRedirectUri, error, setError, isAuthenticated, setIsAuthenticated, handleLogout,
    showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed, handleCaptchaConfirmed,
    theme, toggleTheme,
    firebaseStatus,
    userProfile, userPseudonym,
    onLoginSuccess: handleLoginSuccess, selectedCompanyData, calcularMedia,
    onGoogleLogin: handleGoogleLogin,
    userVerificationLevel,
    getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
    handleCompanyInputChange,
    handleSaibaMais,
  };

  return (
    <>
      {/* Banner de lançamento removido */}
      <ReferralBanner hasReferred={Boolean(userProfile?.referralRewardClaimed)} />

      <LawyerOfferModal
        open={showLawyerOfferModal}
        companyName={lawyerOfferCompany}
        onAccept={() => {
          setShowLawyerOfferModal(false);
          navigate("/trabalhador/encontrar-especialista?especialidade=advogado");
        }}
        onDecline={() => {
          setShowLawyerOfferModal(false);
          if (lawyerOfferCompany) {
            navigate(`/empresa?name=${encodeURIComponent(lawyerOfferCompany)}`);
          }
        }}
      />

      {showResponsibilityModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmação de Responsabilidade"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              borderRadius: 14,
              backgroundColor: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 24px 48px rgba(2, 6, 23, 0.28)",
              padding: "18px 18px 16px 18px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1e3a8a" }}>
              Confirmação de Responsabilidade
            </h2>

            <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.5, fontSize: 14 }}>
              Ao publicar esta avaliação você confirma que: seu conteúdo não cita nomes de pessoas físicas, as informações são verídicas e baseadas em experiência real, e você é o único responsável pelo conteúdo publicado. A plataforma Trabalhei Lá não se responsabiliza por avaliações que violem estas condições.
            </p>

            <label
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={responsibilityAccepted}
                onChange={(e) => setResponsibilityAccepted(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>Li e concordo com as condições acima</span>
            </label>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={handleCancelResponsibility}
                disabled={isLoading}
                style={{
                  border: "1px solid #94a3b8",
                  borderRadius: 10,
                  padding: "8px 14px",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResponsibility}
                disabled={!responsibilityAccepted || isLoading}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 14px",
                  backgroundColor: responsibilityAccepted ? "#1d4ed8" : "#93c5fd",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: responsibilityAccepted ? "pointer" : "not-allowed",
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                Publicar Avaliação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────
          Lazy Registration — modal de convite após o usuário enviar
          uma avaliação sem ter um perfil/pseudônimo. A avaliação fica
          guardada em localStorage (pendingReview) e é enviada ao
          Firestore quando o perfil for criado em /pseudonym.
          ────────────────────────────────────────────────────────────── */}
      {showSignupInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crie seu perfil para concluir"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 16,
              backgroundColor: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 24px 48px rgba(2, 6, 23, 0.28)",
              padding: "24px 24px 20px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: "0 auto 12px auto",
                borderRadius: "50%",
                backgroundColor: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}
              aria-hidden="true"
            >
              ✅
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#15803d" }}>
              Sua avaliação foi enviada!
            </h2>
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 15, lineHeight: 1.5 }}>
              {signupInviteCompanyName
                ? `Sua avaliação de "${signupInviteCompanyName}" está pronta. `
                : "Sua avaliação está pronta. "}
              Agora, crie seu <strong>perfil anônimo</strong> para concluir o
              envio e mantê-la vinculada a você.
            </p>
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#64748b" }}>
              Você escolhe um pseudônimo — não pedimos seu nome real nem CPF.
            </p>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowSignupInviteModal(false);
                  navigate("/pseudonym?after-review=1");
                }}
                style={{
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Criar meu perfil agora
              </button>
              <button
                type="button"
                onClick={() => setShowSignupInviteModal(false)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "8px 14px",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}

      {emailVerificationToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            maxWidth: "min(92vw, 460px)",
            padding: "12px 18px",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
            backgroundColor:
              emailVerificationToast.type === "success" ? "#16a34a" : "#dc2626",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ flex: 1 }}>{emailVerificationToast.message}</span>
          <button
            type="button"
            onClick={() => setEmailVerificationToast(null)}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: 0,
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {isMobile ? (
        <TrabalheiLaMobile {...commonProps} />
      ) : (
        <TrabalheiLaDesktop {...commonProps} />
      )}
    </>
  );
}

export default Home;