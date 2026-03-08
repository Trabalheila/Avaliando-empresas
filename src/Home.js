import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import { empresasBrasileiras } from "./empresas";
import { saveReview, listRecentReviews } from "./services/reviews";
import { saveCompany, listCompanies } from "./services/companies";
import { getUserProfile, saveUserProfile } from "./services/users";
import { auth, db } from "./firebase";
import { signInAnonymously, signInWithPopup, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { googleProvider } from "./firebase";
import {
  clearStoredProfileId,
  isProfileAuthenticated,
  normalizeEmail,
  resolveProfileId,
} from "./utils/profileIdentity";

const CONNECTOR_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
const LEGAL_SUFFIXES = new Set(["S.A", "SA", "S/A", "LTDA", "ME", "MEI", "EPP", "EIRELI", "SPE", "SCP"]);
const PUBLIC_COMPANIES_BLOCKLIST = new Set([
  "banco do brasil",
  "caixa economica federal",
  "petrobras",
]);

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

// Pequena alteração para forçar novo deploy (sem impacto funcional)
function Home({ theme, toggleTheme }) {
  const REVIEW_DRAFT_STORAGE_KEY = "trabalheiLa_review_draft_v1";
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [firebaseStatus, setFirebaseStatus] = useState("verificando...");

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
        setFirebaseStatus("Firebase conectado com sucesso 🤖");
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
  const [entrySource, setEntrySource] = useState("");
  const [contractType, setContractType] = useState("");
  const didHydrateDraftRef = React.useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaConfirmed, setCaptchaConfirmed] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  });
  const userPseudonym = localStorage.getItem("userPseudonym") || "";

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
          sourceStats: { indicacao: 0, siteVagas: 0, gruposWhatsapp: 0, redesSociais: 0 },
          contractStats: { pj: 0, clt: 0 },
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

    const metricKeys = [
      "rating", "salario", "beneficios", "cultura", "oportunidades",
      "inovacao", "lideranca", "diversidade", "ambiente", "equilibrio",
      "reconhecimento", "comunicacao", "etica", "desenvolvimento",
      "saudeBemEstar", "impactoSocial", "reputacao", "estimacaoOrganizacao",
    ];

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
                website: rc?.website || null,
                sourceStats: rc?.sourceStats || null,
                contractStats: rc?.contractStats || null,
                rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
                inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
                reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
                saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
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
              for (const key of metricKeys) {
                entry[key] = 0;
              }
              agg.set(companyName, entry);
            }

            const bucket = agg.get(companyName);
            bucket.count += 1;
            for (const key of metricKeys) {
              bucket[key] += toNumberOrZero(review[key]);
            }
          }

          for (const [companyName, bucket] of agg.entries()) {
            const current = map.get(companyName) || { company: companyName };
            const next = { ...current };

            for (const key of metricKeys) {
              next[key] = bucket.count > 0 ? Number((bucket[key] / bucket.count).toFixed(2)) : 0;
            }

            map.set(companyName, next);
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

  const top3 = useMemo(() => {
    return [...empresas]
      .sort((a, b) => {
        const avgA = getCompanyAverageValue(a);
        const avgB = getCompanyAverageValue(b);
        return (avgB ?? -1) - (avgA ?? -1);
      })
      .slice(0, 3);
  }, [empresas, getCompanyAverageValue]);

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
      if (typeof draft?.entrySource === "string") setEntrySource(draft.entrySource);
      if (typeof draft?.contractType === "string") setContractType(draft.contractType);
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
      entrySource,
      contractType,
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
    entrySource,
    contractType,
  ]);

  useEffect(() => {
    if (company) {
      const data = empresas.find((emp) => emp.company === company.value);
      setSelectedCompanyData(data);
    } else {
      setSelectedCompanyData(null);
    }
  }, [company, empresas]);

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
      const response = await fetch("/api/cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cleanedCnpj }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "CNPJ inválido ou não encontrado.");
      }

      const rawName = data.fantasia || data.nome_fantasia || data.nome || data.razao_social;
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

      const website = data.site || data.website || null;

      setPendingCompanyData({
        company: companyName,
        cnpj: cleanedCnpj,
        website,
      });
    } catch (err) {
      setCnpjError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [newCompanyCnpj, empresas]);

  const handleConfirmNewCompany = useCallback(async () => {
    if (!pendingCompanyData?.company || !pendingCompanyData?.cnpj) {
      setCnpjError("Consulte um CNPJ válido antes de confirmar.");
      return;
    }

    setIsLoading(true);
    setCnpjError(null);

    const alreadyExists = empresas.some((emp) => {
      const sameCnpj = (emp?.cnpj || "").toString().replace(/\D/g, "") === (pendingCompanyData.cnpj || "").toString().replace(/\D/g, "");
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
      website: pendingCompanyData.website || null,
      sourceStats: { indicacao: 0, siteVagas: 0, gruposWhatsapp: 0, redesSociais: 0 },
      contractStats: { pj: 0, clt: 0 },
      rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
      inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
      reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
      saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
    };

    setEmpresas((prev) => {
      const exists = prev.some((emp) => emp.company === pendingCompanyData.company || emp.cnpj === pendingCompanyData.cnpj);
      if (exists) return prev;
      return sortCompaniesAlphabetically([...prev, newCompanyData]);
    });

    setCompany({ value: newCompanyData.company, label: newCompanyData.company });
    setNewCompanyCnpj("");
    setPendingCompanyData(null);
    setShowNewCompanyInput(false);

    try {
      await saveCompany({
        company: newCompanyData.company,
        cnpj: newCompanyData.cnpj,
        website: newCompanyData.website,
      });
    } catch (saveErr) {
      console.warn("Falha ao salvar empresa no Firebase:", saveErr);
      setError(
        "Empresa adicionada localmente, mas falhou ao sincronizar com o Firebase. Tente novamente em alguns segundos."
      );
    } finally {
      setIsLoading(false);
    }
  }, [pendingCompanyData, empresas]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!captchaConfirmed) {
      setShowCaptcha(true);
      return;
    }

    if (!isAuthenticated) {
      setError("Por favor, faça login para enviar sua avaliação.");
      return;
    }
    if (!company) {
      setError("Por favor, selecione uma empresa para avaliar.");
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

    const pseudonym = localStorage.getItem("userPseudonym");
    if (!pseudonym) {
      setError("Por favor, defina um pseudônimo antes de avaliar.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const evaluationData = {
      company: company.value,
      pseudonym,
      rating, commentRating, salario, commentSalario, beneficios, commentBeneficios,
      cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao,
      lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente,
      equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao,
      etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar,
      impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao,
      generalComment,
      entrySource,
      contractType,
      timestamp: new Date().toISOString(),
    };

    // Não permite que o mesmo pseudô1nimo avale a mesma empr2esa ma1is de uma vez (cache local rápido)
    const evaluationsKey = `evaluations_${company.value}`;
    const storedEvals = localStorage.getItem(evaluationsKey);
    const existingEvals = storedEvals ? JSON.parse(storedEvals) : {};

    if (existingEvals[pseudonym]) {
      setError("Você já avaliou essa empresa com este pseudônimo.");
      setIsLoading(false);
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

    try {
      await saveReview(evaluationData);

      // Atualiza a empresa localmente para refletir a nova avaliação
      setEmpresas((prev) =>
        prev.map((emp) => {
          if (emp.company !== company.value) return emp;

          const sourceStats = {
            indicacao: emp?.sourceStats?.indicacao || 0,
            siteVagas: emp?.sourceStats?.siteVagas || 0,
            gruposWhatsapp: emp?.sourceStats?.gruposWhatsapp || 0,
            redesSociais: emp?.sourceStats?.redesSociais || 0,
            [entrySource]: (emp?.sourceStats?.[entrySource] || 0) + 1,
          };

          const contractStats = {
            pj: emp?.contractStats?.pj || 0,
            clt: emp?.contractStats?.clt || 0,
            [contractType]: (emp?.contractStats?.[contractType] || 0) + 1,
          };

          return {
            ...emp,
            ...evaluationData,
            sourceStats,
            contractStats,
          };
        })
      );

      alert("Avaliação enviada com sucesso! Obrigado por sua contribuição.");
      localStorage.removeItem(REVIEW_DRAFT_STORAGE_KEY);
      navigate(`/empresa?name=${encodeURIComponent(company.value)}`);
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
      setIsLoading(false);
      setCaptchaConfirmed(false);
    }
  }, [isAuthenticated, captchaConfirmed, company, rating, commentRating, salario, commentSalario, beneficios, commentBeneficios, cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao, lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente, equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao, etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar, impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao, generalComment, entrySource, contractType, navigate]);

  const handleSaibaMais = useCallback(() => {
    if (!company) {
      setError("Selecione uma empresa para ver mais detalhes.");
      return;
    }
    navigate(`/empresa?name=${encodeURIComponent(company.value)}`);
  }, [company, navigate]);

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
  const linkedInRedirectUri = process.env.REACT_APP_LINKEDIN_REDIRECT_URI;

  useEffect(() => {
    const updateFromStorage = () => {
      const storedProfile = localStorage.getItem("userProfile");

      if (storedProfile) {
        try {
          const parsed = JSON.parse(storedProfile);
          setUserProfile(parsed);
          setIsAuthenticated(isProfileAuthenticated(parsed));
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
    const shouldCompleteNow = window.confirm(
      "Seus dados de perfil sao importantes e fundamentais para participar do Trabalhei La. Deseja completar o cadastro agora?"
    );

    if (shouldCompleteNow) {
      navigate("/pseudonym");
    }
  }, [navigate]);

  const loadPersistedProfile = useCallback(async (profile) => {
    const candidates = [];
    const resolvedId = resolveProfileId(profile, { persistGeneratedId: false });
    const rawId = (profile?.id || "").toString().trim();
    const email = normalizeEmail(profile?.email);

    if (resolvedId) candidates.push(resolvedId);
    if (rawId && !candidates.includes(rawId)) candidates.push(rawId);
    if (email && !candidates.includes(email)) candidates.push(email);

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
        const response = await fetch("/api/linkedin-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: process.env.REACT_APP_LINKEDIN_REDIRECT_URI,
          }),
        });

        data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }
      }

      if (data) {
        const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
        let mergedProfile = {
          ...existingProfile,
          ...data,
          loginProvider: "linkedin",
          linkedInUrl: data?.linkedInUrl || existingProfile?.linkedInUrl || null,
          avatar: data.avatar || data.picture || existingProfile.avatar,
        };

        const profileId = resolveProfileId(mergedProfile);
        try {
          const persisted = await loadPersistedProfile({ ...mergedProfile, profileId });
          if (persisted) {
            mergedProfile = {
              ...mergedProfile,
              ...persisted,
              resumeData: {
                ...(mergedProfile.resumeData || {}),
                ...(persisted.resumeData || {}),
              },
              avatar: mergedProfile.avatar || persisted.avatar,
            };

            const persistedName = (persisted?.name || "").toString().trim();
            if (persistedName) {
              localStorage.setItem("userPseudonym", persistedName);
            }
          }
        } catch (loadErr) {
          console.warn("Falha ao carregar perfil persistido do usuário:", loadErr);
        }

        mergedProfile = { ...mergedProfile, profileId };

        localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
        setUserProfile(mergedProfile);
        setIsAuthenticated(true);

        // Salva o usuário no Fire1store (para acompanhar perfis)
        try {
          await saveUserProfile({
            id: profileId,
            name: mergedProfile.name,
            email: mergedProfile.email,
            picture: mergedProfile.picture,
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
      setError("Falha ao conectar com o LinkedIn.");
    } finally {
      setIsLoading(false);
    }
  }, [loadPersistedProfile, promptProfileCompletion]);

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
        loginProvider: "google",
      };

      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      let mergedProfile = {
        ...existingProfile,
        ...googleData,
        avatar: existingProfile.avatar || googleData.picture,
      };

      const profileId = resolveProfileId(mergedProfile);
      try {
        const persisted = await loadPersistedProfile({ ...mergedProfile, profileId });
        if (persisted) {
          mergedProfile = {
            ...mergedProfile,
            ...persisted,
            resumeData: {
              ...(mergedProfile.resumeData || {}),
              ...(persisted.resumeData || {}),
            },
            avatar: mergedProfile.avatar || persisted.avatar,
          };

          const persistedName = (persisted?.name || "").toString().trim();
          if (persistedName) {
            localStorage.setItem("userPseudonym", persistedName);
          }
        }
      } catch (loadErr) {
        console.warn("Falha ao carregar perfil persistido do usuário:", loadErr);
      }

      mergedProfile = { ...mergedProfile, profileId };

      localStorage.setItem("userProfile", JSON.stringify(mergedProfile));
      setUserProfile(mergedProfile);
      setIsAuthenticated(true);

      try {
        await saveUserProfile({
          id: profileId,
          name: mergedProfile.name,
          email: mergedProfile.email,
          picture: mergedProfile.picture,
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

  const commonProps = {
    company, setCompany, rating, setRating, commentRating, setCommentRating,
    salario, setSalario, commentSalario, setCommentSalario, beneficios, setBeneficios, commentBeneficios, setCommentBeneficios,
    cultura, setCultura, commentCultura, setCommentCultura, oportunidades, setOportunidades, commentOportunidades, setCommentOportunidades,
    inovacao, setInovacao, commentInovacao, setCommentInovacao, lideranca, setLideranca, commentLideranca, setCommentLideranca,
    diversidade, setDiversidade, commentDiversidade, setCommentDiversidade, ambiente, setAmbiente, commentAmbiente, setCommentAmbiente,
    equilibrio, setEquilibrio, commentEquilibrio, setCommentEquilibrio, reconhecimento, setReconhecimento, commentReconhecimento, setCommentReconhecimento,
    comunicacao, setComunicacao, commentComunicacao, setCommentComunicacao, etica, setEtica, commentEtica, setCommentEtica,
    desenvolvimento, setDesenvolvimento, commentDesenvolvimento, setCommentDesenvolvimento, saudeBemEstar, setSaudeBemEstar, commentSaudeBemEstar, setCommentSaudeBemEstar,
    impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial, reputacao, setReputacao, commentReputacao, setCommentReputacao,
    estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
    entrySource, setEntrySource, contractType, setContractType,
    generalComment, setGeneralComment, handleSubmit, isLoading, empresas, top3,
    newCompanyCnpj, setNewCompanyCnpj, cnpjError,
    showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
    handleConfirmNewCompany, pendingCompanyData,
    linkedInClientId, linkedInRedirectUri, error, setError, isAuthenticated, setIsAuthenticated, handleLogout,
    showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed,
    theme, toggleTheme,
    firebaseStatus,
    userProfile, userPseudonym,
    onLoginSuccess: handleLoginSuccess, selectedCompanyData, calcularMedia,
    onGoogleLogin: handleGoogleLogin,
    getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
    handleSaibaMais,
  };

  return isMobile ? (
    <TrabalheiLaMobile {...commonProps} />
  ) : (
    <TrabalheiLaDesktop {...commonProps} />
  );
}

export default Home;