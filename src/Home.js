import React, { useState, useEffect, useCallback } from "react";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";

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
  const [contatoRH, setContatoRH] = useState(0);
  const [salarioBeneficios, setSalarioBeneficios] = useState(0);
  const [estruturaEmpresa, setEstruturaEmpresa] = useState(0);
  const [acessibilidadeLideranca, setAcessibilidadeLideranca] = useState(0);
  const [planoCarreiras, setPlanoCarreiras] = useState(0);
  const [bemestar, setBemestar] = useState(0);
  const [estimulacaoOrganizacao, setEstimulacaoOrganizacao] = useState(0);
  const [commentRating, setCommentRating] = useState("");
  const [commentContatoRH, setCommentContatoRH] = useState("");
  const [commentSalarioBeneficios, setCommentSalarioBeneficios] = useState("");
  const [commentEstruturaEmpresa, setCommentEstruturaEmpresa] = useState("");
  const [commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca] = useState("");
  const [commentPlanoCarreiras, setCommentPlanoCarreiras] = useState("");
  const [commentBemestar, setCommentBemestar] = useState("");
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const [top3, setTop3] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  const calcularMedia = useCallback((emp) => {
    if (!emp) return 0;
    const sum =
      emp.rating + emp.contatoRH + emp.salarioBeneficios +
      emp.estruturaEmpresa + emp.acessibilidadeLideranca +
      emp.planoCarreiras + emp.bemestar + emp.estimulacaoOrganizacao;
    return (sum / 8).toFixed(1);
  }, []);

  useEffect(() => {
    const sorted = [...empresas].sort((a, b) => calcularMedia(b) - calcularMedia(a));
    setTop3(sorted.slice(0, 3));
  }, [empresas, calcularMedia]);

  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-300 to-gray-500";
    if (index === 2) return "from-orange-300 to-orange-500";
    return "from-blue-300 to-blue-500";
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🏅";
  };

  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-green-500";
    if (media >= 3.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleAddNewCompany = () => {
    if (newCompany && !empresas.some((emp) => emp.company === newCompany)) {
      setEmpresas((prev) => [
        ...prev,
        {
          company: newCompany,
          rating: 0, contatoRH: 0, salarioBeneficios: 0,
          estruturaEmpresa: 0, acessibilidadeLideranca: 0,
          planoCarreiras: 0, bemestar: 0, estimulacaoOrganizacao: 0,
          comment: "", area: "Nova", periodo: "Atual",
        },
      ]);
      setCompany({ value: newCompany, label: newCompany });
      setNewCompany("");
      setShowNewCompanyInput(false);
    }
  };

  const linkedInClientId = "86l0151f148013";
  const linkedInDisabled = !linkedInClientId;

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError("");
    setTimeout(() => {
      setIsAuthenticated(true);
      setIsLoading(false);
    }, 1500);
  };

  const handleLinkedInLogin = (response) => {
    console.log("LinkedIn login success:", response);
    setIsAuthenticated(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company) {
      setError("Por favor, selecione ou adicione uma empresa.");
      return;
    }
    if (!isAuthenticated) {
      setError("Você precisa fazer login para enviar uma avaliação.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const newEvaluation = {
        company: typeof company === "object" ? company.value : company,
        rating, contatoRH, salarioBeneficios, estruturaEmpresa,
        acessibilidadeLideranca, planoCarreiras, bemestar,
        estimulacaoOrganizacao,
        comment: generalComment,
        area: "Geral",
        periodo: "Atual",
      };
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEmpresas((prev) => {
        const existing = prev.findIndex(
          (emp) => emp.company === newEvaluation.company
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], ...newEvaluation };
          return updated;
        }
        return [...prev, newEvaluation];
      });
      setCompany(null);
      setRating(0); setContatoRH(0); setSalarioBeneficios(0);
      setEstruturaEmpresa(0); setAcessibilidadeLideranca(0);
      setPlanoCarreiras(0); setBemestar(0); setEstimulacaoOrganizacao(0);
      setCommentRating(""); setCommentContatoRH("");
      setCommentSalarioBeneficios(""); setCommentEstruturaEmpresa("");
      setCommentAcessibilidadeLideranca(""); setCommentPlanoCarreiras("");
      setCommentBemestar(""); setCommentEstimulacaoOrganizacao("");
      setGeneralComment("");
      alert("Avaliação enviada com sucesso!");
    } catch (err) {
      setError("Erro ao enviar avaliação. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const safeCompanyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

  const selectedCompanyData = company &&
    empresas.find(
      (emp) => emp.company === (typeof company === "object" ? company.value : company)
    );

  const commonProps = {
    company, setCompany, newCompany, setNewCompany,
    rating, setRating, contatoRH, setContatoRH,
    salarioBeneficios, setSalarioBeneficios,
    estruturaEmpresa, setEstruturaEmpresa,
    acessibilidadeLideranca, setAcessibilidadeLideranca,
    planoCarreiras, setPlanoCarreiras,
    bemestar, setBemestar,
    estimulacaoOrganizacao, setEstimulacaoOrganizacao,
    commentRating, setCommentRating,
    commentContatoRH, setCommentContatoRH,
    commentSalarioBeneficios, setCommentSalarioBeneficios,
    commentEstruturaEmpresa, setCommentEstruturaEmpresa,
    commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca,
    commentPlanoCarreiras, setCommentPlanoCarreiras,
    commentBemestar, setCommentBemestar,
    commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao,
    generalComment, setGeneralComment,
    handleSubmit, isLoading, empresas, top3,
    showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
    linkedInClientId, linkedInDisabled, handleLinkedInLogin,
    handleGoogleLogin, error, isAuthenticated,
    selectedCompanyData, calcularMedia,
    getMedalColor, getMedalEmoji, getBadgeColor,
    safeCompanyOptions,
  };

  return isMobile ? (
    <TrabalheiLaMobile {...commonProps} />
  ) : (
    <TrabalheiLaDesktop {...commonProps} />
  );
}

export default Home;