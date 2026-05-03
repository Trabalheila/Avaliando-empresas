import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import { empresasBrasileiras } from "./empresas";
import { saveReview, listRecentReviews } from "./services/reviews";
import { saveCompany, listCompanies, enrichCompanyWithBrasilAPI } from "./services/companies";
import { getUserProfile, saveUserProfile, findUnifiedProfile } from "./services/users";
import { auth, db } from "./firebase";
import { signInAnonymously, signInWithPopup, signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
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
  const didHydrateDraftRef = React.useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showResponsibilityModal, setShowResponsibilityModal] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [pendingEvaluationData, setPendingEvaluationData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  const safeCompanyOptions = empresas
    .filter((emp) => !isBlockedPublicCompany(emp?.company))
    .sort((a, b) => (a?.company || "").localeCompare(b?.company || "", "pt-BR", { sensitivity: "base" }))
    .map((emp) => ({
      value: emp.company,
      label: emp.company,
    }));

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

    return {
      company: company?.value || "",
      pseudonym: pseudonym || "",
      authorProfileId,
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
  }, [company, userProfile, rating, commentRating, salario, commentSalario, beneficios, commentBeneficios, cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao, lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente, equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao, etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar, impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao, generalComment, generalCommentRestrictedSegments, entrySource, contractType, workModel, discriminacao, commentDiscriminacao, cargaHoraria, commentCargaHoraria, crescimento, commentCrescimento, criterionRestrictedSegments, workPeriodStartMonth, workPeriodStartYear, workPeriodEndMonth, workPeriodEndYear, workPeriodStillWorking]);

  const submitEvaluation = useCallback(async (evaluationData) => {
    const pseudonym = evaluationData?.pseudonym;
    if (!pseudonym) {
      setError("Por favor, defina um pseudônimo antes de avaliar.");
      return;
    }

    // Não permite que o mesmo pseudônimo avalie a mesma empresa mais de uma vez (cache local rápido)
    const evaluationsKey = `evaluations_${evaluationData.company}`;
    const storedEvals = localStorage.getItem(evaluationsKey);
    const existingEvals = storedEvals ? JSON.parse(storedEvals) : {};

    if (existingEvals[pseudonym]) {
      setError("Você já avaliou essa empresa com este pseudônimo.");
      return;
    }

    const nextEvals = {
      ...existingEvals,
      [pseudonym]: evaluationData,
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

    alert("Avaliação enviada com sucesso! Obrigado por sua contribuição.");
    localStorage.removeItem(REVIEW_DRAFT_STORAGE_KEY);
    navigate(`/empresa?name=${encodeURIComponent(evaluationData.company)}`);
  }, [navigate]);

  // Roda as validações e abre o modal de Termo de Responsabilidade.
  // Compartilhado entre o clique inicial em "Enviar Avaliação" (quando o
  // captcha já está confirmado) e a confirmação do captcha (que continua o
  // fluxo automaticamente, sem exigir um segundo clique do usuário).
  const runSubmissionValidationsAndOpenResponsibility = useCallback(async () => {
    if (!isAuthenticated) {
      setError("Por favor, faça login para enviar sua avaliação.");
      return;
    }
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

    const pseudonym = localStorage.getItem("userPseudonym");
    if (!pseudonym) {
      setError("Por favor, defina um pseudônimo antes de avaliar.");
      return;
    }

    setError(null);
    setResponsibilityAccepted(false);
    setPendingEvaluationData(buildEvaluationData());
    setShowResponsibilityModal(true);
  }, [isAuthenticated, company, userProfile, entrySource, contractType, workModel, discriminacao, commentDiscriminacao, buildEvaluationData]);

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

    const evaluationData = {
      ...pendingEvaluationData,
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
    };

    setIsLoading(true);
    setShowResponsibilityModal(false);
    setError(null);

    try {
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
          name: existing.name || u.displayName || data.name || "",
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

  const promptProfileCompletion = useCallback(() => {
    if (typeof window === "undefined") return;
    // Evita depender de confirm() em mobile/in-app browsers, onde pode falhar silenciosamente.
    navigate("/pseudonym");
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
        let mergedProfile = {
          ...existingProfile,
          ...data,
          loginProvider: "linkedin",
          fallback: false,
          linkedInUrl: data?.linkedInUrl || existingProfile?.linkedInUrl || null,
          avatar: incomingPicture || existingProfile?.avatar || existingProfile?.picture || "",
          picture: incomingPicture || existingProfile?.picture || existingProfile?.avatar || "",
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
            name: effectiveName || mergedProfile.name,
            pseudonimo: effectiveName || undefined,
            nomeReal: mergedProfile.name || undefined,
            fullName: mergedProfile.name || undefined,
            email: mergedProfile.email,
            picture: mergedProfile.picture || mergedProfile.avatar || "",
            avatar: mergedProfile.avatar || mergedProfile.picture || "",
            loginProvider: "linkedin",
            linkedinProfile: mergedProfile.linkedInUrl || null,
            linkedinExperiences: Array.isArray(mergedProfile.linkedinExperiences) ? mergedProfile.linkedinExperiences : [],
            profileId,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Falha ao salvar perfil no Firebase:", err);
        }

        const pseudonym = localStorage.getItem("userPseudonym");
        if (!pseudonym) {
          promptProfileCompletion();
        } else {
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
      const result = await signInWithPopup(auth, googleProvider);
      const user = result?.user;

      if (!user) {
        throw new Error("Falha ao autenticar com Google.");
      }

      const googleData = {
        id: user.uid,
        name: user.displayName || "Usuário",
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
          name: effectiveName || mergedProfile.name,
          pseudonimo: effectiveName || undefined,
          nomeReal: mergedProfile.name || undefined,
          fullName: mergedProfile.name || undefined,
          email: mergedProfile.email,
          picture: mergedProfile.picture || mergedProfile.avatar || "",
          avatar: mergedProfile.avatar || mergedProfile.picture || "",
          loginProvider: "google",
          profileId,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("Falha ao salvar perfil Google no Firebase:", err);
      }

      const pseudonym = localStorage.getItem("userPseudonym");
      if (!pseudonym) {
        promptProfileCompletion();
      } else {
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
    getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
    handleSaibaMais,
  };

  return (
    <>
      {/* Banner de lançamento removido */}

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