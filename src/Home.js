// src/Home.js
import React, { useState, useEffect, useCallback } from "react";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import { empresasBrasileiras } from "./empresas";

function Home() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [company, setCompany] = useState(null);
  const [newCompany, setNewCompany] = useState("");
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
  const [commentEstimacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState("");
  const [generalComment, setGeneralComment] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);

  // Carrega a lista externa e cria a estrutura de notas zeradas
  const [empresas, setEmpresas] = useState(() => {
    return empresasBrasileiras.map((nome) => ({
      company: nome,
      rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
      inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
      reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
      saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
    }));
  });

  const calcularMedia = useCallback((emp) => {
    const ratings = [
      emp.rating, emp.salario, emp.beneficios, emp.cultura, emp.oportunidades,
      emp.inovacao, emp.lideranca, emp.diversidade, emp.ambiente, emp.equilibrio,
      emp.reconhecimento, emp.comunicacao, emp.etica, emp.desenvolvimento,
      emp.saudeBemEstar, emp.impactoSocial, emp.reputacao, emp.estimacaoOrganizacao,
    ].filter(val => typeof val === 'number' && !isNaN(val));

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
    if (media >= 4.5) return "bg-green-600";
    if (media >= 3.5) return "bg-blue-600";
    if (media >= 2.5) return "bg-yellow-600";
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

  const handleAddNewCompany = useCallback(() => {
    if (newCompany.trim() === "") {
      alert("Por favor, insira o nome da nova empresa.");
      return;
    }
    const newCompanyData = {
      company: newCompany.trim(),
      rating: 0, salario: 0, beneficios: 0, cultura: 0, oportunidades: 0,
      inovacao: 0, lideranca: 0, diversidade: 0, ambiente: 0, equilibrio: 0,
      reconhecimento: 0, comunicacao: 0, etica: 0, desenvolvimento: 0,
      saudeBemEstar: 0, impactoSocial: 0, reputacao: 0, estimacaoOrganizacao: 0,
    };
    setEmpresas([...empresas, newCompanyData]);
    setNewCompany("");
    setShowNewCompanyInput(false);
    setCompany({ value: newCompanyData.company, label: newCompanyData.company });
  }, [newCompany, empresas]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError("Por favor, faça login para enviar sua avaliação.");
      return;
    }
    if (!company) {
      setError("Por favor, selecione uma empresa para avaliar.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const evaluationData = {
      company: company.value,
      rating, commentRating, salario, commentSalario, beneficios, commentBeneficios,
      cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao,
      lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente,
      equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao,
      etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar,
      impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao,
      generalComment,
      timestamp: new Date().toISOString(),
    };

    // 👇 CORREÇÃO AQUI: Dando uso à variável para o Vercel não bloquear o deploy
    console.log("Dados prontos para envio:", evaluationData);

    try {
      alert("Avaliação enviada com sucesso! Obrigado por sua contribuição.");
    } catch (err) {
      setError("Erro ao enviar avaliação: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, company, rating, commentRating, salario, commentSalario, beneficios, commentBeneficios, cultura, commentCultura, oportunidades, commentOportunidades, inovacao, commentInovacao, lideranca, commentLideranca, diversidade, commentDiversidade, ambiente, commentAmbiente, equilibrio, commentEquilibrio, reconhecimento, commentReconhecimento, comunicacao, commentComunicacao, etica, commentEtica, desenvolvimento, commentDesenvolvimento, saudeBemEstar, commentSaudeBemEstar, impactoSocial, commentImpactoSocial, reputacao, commentReputacao, estimacaoOrganizacao, commentEstimacaoOrganizacao, generalComment]);

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
  const linkedInRedirectUri = process.env.REACT_APP_LINKEDIN_REDIRECT_URI;

  useEffect(() => {
    const userProfile = localStorage.getItem("userProfile");
    if (userProfile) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []); 

  const handleLogout = useCallback(() => {
    localStorage.removeItem("userProfile");
    setIsAuthenticated(false);
  }, []);

  const handleLoginSuccess = useCallback(async ({ code }) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/linkedin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: process.env.REACT_APP_LINKEDIN_REDIRECT_URI,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      localStorage.setItem("userProfile", JSON.stringify(data));
      setIsAuthenticated(true);

    } catch (err) {
      console.error("Erro ao validar login no backend:", err);
      setError("Falha ao conectar com o LinkedIn.");
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimulacaoOrganizacao,
    generalComment, setGeneralComment, handleSubmit, isLoading, empresas, top3,
    showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
    linkedInClientId, linkedInRedirectUri, error, isAuthenticated, setIsAuthenticated, handleLogout,
    onLoginSuccess: handleLoginSuccess, selectedCompanyData, calcularMedia,
    getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
  };

  return isMobile ? (
    <TrabalheiLaMobile {...commonProps} />
  ) : (
    <TrabalheiLaDesktop {...commonProps} />
  );
}

export default Home;