import React, { useState, useEffect, useCallback } from "react";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";

function Home() {
  // Detecta tamanho da tela
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Estados do formulário
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

  // Dados mockados (substitua por chamada real à API)
  // Para começar sem dados, mude para useState([]);
  const [empresas, setEmpresas] = useState([
    {
      company: "Petrobras",
      rating: 4.5,
      contatoRH: 4.0,
      salarioBeneficios: 4.8,
      estruturaEmpresa: 4.2,
      acessibilidadeLideranca: 3.9,
      planoCarreiras: 4.1,
      bemestar: 4.3,
      estimulacaoOrganizacao: 4.6,
      comment: "Ótima empresa para trabalhar, com muitos benefícios e oportunidades de crescimento.",
      area: "Engenharia",
      periodo: "2015‑Atual"
    },
    {
      company: "Vale",
      rating: 3.8,
      contatoRH: 3.5,
      salarioBeneficios: 4.0,
      estruturaEmpresa: 3.7,
      acessibilidadeLideranca: 3.2,
      planoCarreiras: 3.5,
      bemestar: 3.8,
      estimulacaoOrganizacao: 3.9,
      comment: "Ambiente desafiador, mas com boa remuneração. Precisa melhorar a comunicação interna.",
      area: "Mineração",
      periodo: "2010‑2020"
    },
    {
      company: "Ambev",
      rating: 4.0,
      contatoRH: 4.2,
      salarioBeneficios: 4.1,
      estruturaEmpresa: 4.0,
      acessibilidadeLideranca: 3.8,
      planoCarreiras: 4.2,
      bemestar: 4.0,
      estimulacaoOrganizacao: 4.1,
      comment: "Boa cultura, mas o ritmo de trabalho é intenso. Oportunidades de aprendizado.",
      area: "Bebidas",
      periodo: "2018‑Atual"
    },
    {
      company: "Empresa A",
      rating: 5.0,
      contatoRH: 5.0,
      salarioBeneficios: 5.0,
      estruturaEmpresa: 5.0,
      acessibilidadeLideranca: 5.0,
      planoCarreiras: 5.0,
      bemestar: 5.0,
      estimulacaoOrganizacao: 5.0,
      comment: "Melhor empresa do mundo! Recomendo a todos.",
      area: "Tecnologia",
      periodo: "2020‑Atual"
    },
    {
      company: "Empresa B",
      rating: 2.5,
      contatoRH: 2.0,
      salarioBeneficios: 2.5,
      estruturaEmpresa: 2.8,
      acessibilidadeLideranca: 2.2,
      planoCarreiras: 2.0,
      bemestar: 2.5,
      estimulacaoOrganizacao: 2.3,
      comment: "Não gostei muito. Poucas oportunidades e ambiente de trabalho ruim.",
      area: "Varejo",
      periodo: "2021‑2022"
    },
  ]);

  // Função para calcular a média de avaliação de uma empresa
  const calcularMedia = useCallback((emp) => {
    if (!emp) return 0;
    const sum =
      emp.rating +
      emp.contatoRH +
      emp.salarioBeneficios +
      emp.estruturaEmpresa +
      emp.acessibilidadeLideranca +
      emp.planoCarreiras +
      emp.bemestar +
      emp.estimulacaoOrganizacao;
    return (sum / 8).toFixed(1);
  }, []);

  // Efeitos para o ranking das 3 melhores empresas
  useEffect(() => {
    const sorted = [...empresas].sort(
      (a, b) => calcularMedia(b) - calcularMedia(a)
    );
    setTop3(sorted.slice(0, 3));
  }, [empresas, calcularMedia]); // Adicionado calcularMedia às dependências

  // Função para determinar a cor da medalha no ranking
  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-400 to-gray-600";
    if (index === 2) return "from-orange-400 to-orange-600";
    return "from-gray-300 to-gray-500";
  };

  // Função para determinar o emoji da medalha no ranking
  const getMedalEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🏅";
  };

  // Função para determinar a cor do badge de nota
  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-green-600";
    if (media >= 3.5) return "bg-blue-500";
    if (media >= 2.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Lógica de login (mockada)
  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError("");
    setTimeout(() => {
      setIsAuthenticated(true);
   
      setIsLoading(false);
    }, 1500);
  };

  const linkedInClientId = "SEU_CLIENT_ID_LINKEDIN"; // Substitua pelo seu Client ID real do LinkedIn

  const handleLinkedInLogin = (response) => {
    console.log("LinkedIn login success:", response);
    setIsAuthenticated(true);
   

  const linkedInDisabled = !linkedInClientId || linkedInClientId === "SEU_CLIENT_ID_LINKEDIN";

  // Lógica para adicionar nova empresa
  const handleAddNewCompany = () => {
    if (newCompany && !empresas.some((emp) => emp.company === newCompany)) {
      setEmpresas((prev) => [
        ...prev,
        {
          company: newCompany,
          rating: 0,
          contatoRH: 0,
          salarioBeneficios: 0,
          estruturaEmpresa: 0,
          acessibilidadeLideranca: 0,
          planoCarreiras: 0,
          bemestar: 0,
          estimulacaoOrganizacao: 0,
          comment: "",
          area: "Nova",
          periodo: "Atual",
        },
      ]);
      setCompany({ value: newCompany, label: newCompany });
      setNewCompany("");
      setShowNewCompanyInput(false);
    } else if (newCompany) {
      setError("Empresa já existe!");
    }
  };

  // Lógica de submissão do formulário
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError("Você precisa estar logado para enviar uma avaliação.");
      return;
    }
    if (!company) {
      setError("Por favor, selecione ou adicione uma empresa.");
      return;
    }

    setIsLoading(true);
    setError("");

    const newEvaluation = {
      company: typeof company === "object" ? company.value : company,
      rating,
      contatoRH,
      salarioBeneficios,
      estruturaEmpresa,
      acessibilidadeLideranca,
      planoCarreiras,
      bemestar,
      estimulacaoOrganizacao,
      comment: generalComment,
      commentRating,
      commentContatoRH,
      commentSalarioBeneficios,
      commentEstruturaEmpresa,
      commentAcessibilidadeLideranca,
      commentPlanoCarreiras,
      commentBemestar,
      commentEstimulacaoOrganizacao,
      area: "Geral", // Pode ser dinâmico no futuro
      periodo: "Atual", // Pode ser dinâmico no futuro
    };

    // Lógica para salvar a avaliação (mockada)
    setTimeout(() => {
      setEmpresas((prev) => {
        const existingIndex = prev.findIndex(
          (emp) => emp.company === newEvaluation.company
        );
        if (existingIndex > -1) {
          const updatedEmpresas = [...prev];
          updatedEmpresas[existingIndex] = {
            ...updatedEmpresas[existingIndex],
            ...newEvaluation,
          };
          return updatedEmpresas;
        }
        return [...prev, newEvaluation];
      });

      // Resetar formulário
      setRating(0);
      setContatoRH(0);
      setSalarioBeneficios(0);
      setEstruturaEmpresa(0);
      setAcessibilidadeLideranca(0);
      setPlanoCarreiras(0);
      setBemestar(0);
      setEstimulacaoOrganizacao(0);
      setCommentRating("");
      setCommentContatoRH("");
      setCommentSalarioBeneficios("");
      setCommentEstruturaEmpresa("");
      setCommentAcessibilidadeLideranca("");
      setCommentPlanoCarreiras("");
      setCommentBemestar("");
      setCommentEstimulacaoOrganizacao("");
      setGeneralComment("");
      setCompany(null);
      setIsLoading(false);
      alert("Avaliação enviada com sucesso!");
    }, 1500);
  };

  // Opções de empresa para o Select
  const safeCompanyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

  // Dados da empresa selecionada
  const selectedCompanyData =
    company && empresas.find((emp) => emp.company === (typeof company === "object" ? company.value : company));

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
    selectedCompanyData,
    calcularMedia,
    getMedalColor,
    getMedalEmoji,
    getBadgeColor,
    safeCompanyOptions,
  };

  return isMobile ? (
    <TrabalheiLaMobile {...commonProps} />
  ) : (
    <TrabalheiLaDesktop {...commonProps} />
  );
}

export default Home;