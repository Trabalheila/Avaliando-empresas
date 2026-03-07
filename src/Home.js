import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import { empresasBrasileiras } from "./empresas";
import { saveReview, listRecentReviews } from "./services/reviews";
import { saveCompany, listCompanies } from "./services/companies";
import { saveUserProfile } from "./services/users";
import { auth, db } from "./firebase";
import { signInAnonymously } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const CONNECTOR_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
const LEGAL_SUFFIXES = new Set(["S.A", "SA", "S/A", "LTDA", "ME", "MEI", "EPP", "EIRELI", "SPE", "SCP"]);

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

// Pequena alteração para forçar novo deploy (sem impacto funcional)
function Home({ theme, toggleTheme }) {
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
          return parsed.map((emp) => ({
            ...emp,
            company: normalizeCompanyName(emp?.company || ""),
          }));
        }
      }
    } catch (err) {
      console.warn("Falha ao carregar empresas do localStorage:", err);
    }

    return (empresasBrasileiras || []).map((nome) => ({
      company: normalizeCompanyName(nome),
      cnpj: null,
      rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
      inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
      reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
      saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
    }));
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
              return [normalized, { ...emp, company: normalized }];
            })
          );

          for (const rc of remoteCompanies) {
            const companyName = normalizeCompanyName(rc?.name || rc?.company || rc?.slug || "");
            if (!companyName) continue;

            if (!map.has(companyName)) {
              map.set(companyName, {
                company: companyName,
                cnpj: rc?.cnpj || null,
                website: rc?.website || null,
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

          return Array.from(map.values());
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

  const calcularMedia = useCallback((emp) => {
    const ratings = [
      emp.rating, emp.salario, emp.beneficios, emp.cultura, emp.oportunidades,
      emp.inovacao, emp.lideranca, emp.diversidade, emp.ambiente, emp.equilibrio,
      emp.reconhecimento, emp.comunicacao, emp.etica, emp.desenvolvimento,
      emp.saudeBemEstar, emp.impactoSocial, emp.reputacao, emp.estimacaoOrganizacao,
    ].filter(val => typeof val === 'number' && !isNaN(val) && val > 0); 

    if (ratings.length === 0) return "0.0";
    const sum = ratings.reduce((acc, curr) => acc + curr, 0);
    return (sum / ratings.length).toFixed(1);
  }, []);

  const top3 = [...empresas].sort((a, b) => calcularMedia(b) - calcularMedia(a)).slice(0, 3);

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
    if (media >= 4.5) return "bg-emerald-700";
    if (media >= 4) return "bg-lime-600";
    if (media >= 3) return "bg-yellow-600";
    if (media >= 2) return "bg-purple-600";
    return "bg-red-600";
  };

  const safeCompanyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

  const [selectedCompanyData, setSelectedCompanyData] = useState(null);

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
  }, [newCompanyCnpj]);

  const handleConfirmNewCompany = useCallback(async () => {
    if (!pendingCompanyData?.company || !pendingCompanyData?.cnpj) {
      setCnpjError("Consulte um CNPJ válido antes de confirmar.");
      return;
    }

    setIsLoading(true);
    setCnpjError(null);

    const newCompanyData = {
      company: pendingCompanyData.company,
      cnpj: pendingCompanyData.cnpj,
      website: pendingCompanyData.website || null,
      rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
      inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
      reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
      saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
    };

    setEmpresas((prev) => {
      const exists = prev.some((emp) => emp.company === pendingCompanyData.company || emp.cnpj === pendingCompanyData.cnpj);
      if (exists) return prev;
      return [...prev, newCompanyData];
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
  }, [pendingCompanyData]);

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
      timestamp: new Date().toISOString(),
    };

    // Não permite que o mesmo pseudônimo avaliie a mesma empresa mais de uma vez (cache local rápido)
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

      // Atualiza a empresa localmente para refleti1r a nova avaliação
      setEmpresas((prev) =>
        prev.map((emp) => {
          if (emp.company !== company.value) return emp;
          return {
            ...emp,
            ...evaluationData,
          };
        })
      );

      alert("Avaliação enviada com sucesso! Obrigado por sua contribuição.");
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
  }, [isAuthenticated, captchaConfirmed, company, rating, commentRating, salario, commentSalario, beneficios, commentBeneficios, cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao, lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente, equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao, etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar, impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao, generalComment]);

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
      const storedPseudonym = localStorage.getItem("userPseudonym");

      if (storedProfile) {
        try {
          setUserProfile(JSON.parse(storedProfile));
        } catch {
          setUserProfile({});
        }
      } else {
        setUserProfile({});
      }

      // Considera o usuário autenticado se houver dados de perfil do LinkedIn.
      setIsAuthenticated(!!storedProfile);

      if (storedProfile && !storedPseudonym) {
        // Redireciona para definir pseudônimo ao logar pela primeira vez
        navigate("/pseudonym");
      }
    };

    updateFromStorage();

    window.addEventListener("trabalheiLa_user_updated", updateFromStorage);
    window.addEventListener("focus", updateFromStorage);
    return () => {
      window.removeEventListener("trabalheiLa_user_updated", updateFromStorage);
      window.removeEventListener("focus", updateFromStorage);
    };
  }, [navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("userProfile");
    localStorage.removeItem("userPseudonym");
    setUserProfile({});
    setIsAuthenticated(false);
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
        localStorage.setItem("userProfile", JSON.stringify(data));
        setUserProfile(data);
        setIsAuthenticated(true);

        // Salva o usuário no Firestore (para acompanhar perfis)
        try {
          await saveUserProfile({
            id: data.id,
            name: data.name,
            email: data.email,
            picture: data.picture,
            linkedinProfile: data.linkedInUrl || null,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Falha ao salvar perfil no Firebase:", err);
        }

        const pseudonym = localStorage.getItem("userPseudonym");
        if (!pseudonym) {
          navigate("/pseudonym");
        }
      }
    } catch (err) {
      console.error("Erro ao validar login no backend:", err);
      setError("Falha ao conectar com o LinkedIn.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);
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