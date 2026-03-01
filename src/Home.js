import React, { useState, useEffect } from 'react';
import TrabalheiLaMobile from './TrabalheiLaMobile';
import TrabalheiLaDesktop from './TrabalheiLaDesktop';

// Aqui você vai gerenciar todos os estados e funções que são passados para os componentes de layout
function Home() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // 768px é o breakpoint padrão do Tailwind CSS para 'md'

  // Estados para o formulário de avaliação
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
  const [generalComment, setGeneralComment] = useState(""); // Novo estado para o comentário geral

  // Estados para a nova empresa
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const handleAddNewCompany = () => {
    if (newCompany.trim()) {
      // Lógica para adicionar a nova empresa à lista 'empresas'
      // Por enquanto, apenas define como a empresa selecionada
      setCompany(newCompany);
      setNewCompany("");
      setShowNewCompanyInput(false);
    }
  };

  // Estados para login (exemplo, você precisará integrar com seu backend real)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || "";

  const handleLinkedInLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    console.log("Login LinkedIn bem-sucedido:", userData);
  };

  const handleGoogleLogin = () => {
    // Lógica de login com Google
    console.log("Login com Google acionado");
    setIsAuthenticated(true); // Apenas para simular
    setUser({ name: "Usuário Google" }); // Apenas para simular
  };

  // Dados de exemplo para empresas e ranking (você vai buscar isso do seu backend)
  const [empresas, setEmpresas] = useState([
    { company: "Empresa A", area: "TI", periodo: "2020-2022", rating: 4, contatoRH: 3, salarioBeneficios: 5, estruturaEmpresa: 4, acessibilidadeLideranca: 4, planoCarreiras: 3, bemestar: 5, estimulacaoOrganizacao: 4, comment: "Ótima empresa para trabalhar, ambiente colaborativo." },
    { company: "Empresa B", area: "Marketing", periodo: "2019-2021", rating: 3, contatoRH: 4, salarioBeneficios: 3, estruturaEmpresa: 3, acessibilidadeLideranca: 2, planoCarreiras: 3, bemestar: 4, estimulacaoOrganizacao: 3, comment: "Desafios interessantes, mas a comunicação poderia melhorar." },
    { company: "Empresa C", area: "Finanças", periodo: "2021-2023", rating: 5, contatoRH: 5, salarioBeneficios: 5, estruturaEmpresa: 5, acessibilidadeLideranca: 5, planoCarreiras: 5, bemestar: 5, estimulacaoOrganizacao: 5, comment: "Excelente em todos os aspectos, recomendo!" },
    { company: "Empresa D", area: "Vendas", periodo: "2018-2020", rating: 2, contatoRH: 2, salarioBeneficios: 2, estruturaEmpresa: 2, acessibilidadeLideranca: 2, planoCarreiras: 2, bemestar: 2, estimulacaoOrganizacao: 2, comment: "Ambiente tóxico, sem oportunidades de crescimento." },
    { company: "Empresa E", area: "RH", periodo: "2022-2024", rating: 4, contatoRH: 4, salarioBeneficios: 4, estruturaEmpresa: 4, acessibilidadeLideranca: 4, planoCarreiras: 4, bemestar: 4, estimulacaoOrganizacao: 4, comment: "Boa cultura, mas o salário poderia ser melhor." },
  ]);

  // Funções auxiliares para o cálculo da média e cores (movidas para Home)
  const calcularMedia = (emp) => {
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
  };

  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-green-500";
    if (media >= 3.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-400 to-gray-600";
    if (index === 2) return "from-yellow-700 to-yellow-800";
    return "from-gray-300 to-gray-500";
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🏅";
  };

  // Ordena as empresas para o ranking
  const sortedEmpresas = [...empresas].sort((a, b) => calcularMedia(b) - calcularMedia(a));
  const top3 = sortedEmpresas.slice(0, 3);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!company && !newCompany) {
      setError("Por favor, selecione ou adicione uma empresa.");
      setIsLoading(false);
      return;
    }

    const companyToEvaluate = company || newCompany;

    const newEvaluation = {
      company: companyToEvaluate,
      rating,
      contatoRH,
      salarioBeneficios,
      estruturaEmpresa,
      acessibilidadeLideranca,
      planoCarreiras,
      bemestar,
      estimulacaoOrganizacao,
      commentRating,
      commentContatoRH,
      commentSalarioBeneficios,
      commentEstruturaEmpresa,
      commentAcessibilidadeLideranca,
      commentPlanoCarreiras,
      commentBemestar,
      commentEstimulacaoOrganizacao,
      generalComment,
      // Adicione outros campos relevantes aqui
    };

    console.log("Avaliação enviada:", newEvaluation);

    // Simulação de envio para o backend
    try {
      // await new Promise((resolve) => setTimeout(resolve, 2000)); // Simula delay de rede
      setEmpresas((prev) => {
        const existingCompanyIndex = prev.findIndex(
          (emp) => emp.company === companyToEvaluate
        );
        if (existingCompanyIndex > -1) {
          // Atualiza a empresa existente (simplificado, você faria uma lógica de média real)
          const updatedEmpresas = [...prev];
          updatedEmpresas[existingCompanyIndex] = {
            ...updatedEmpresas[existingCompanyIndex],
            ...newEvaluation, // Sobrescreve com a nova avaliação (simplificado)
          };
          return updatedEmpresas;
        } else {
          // Adiciona nova empresa
          return [...prev, { ...newEvaluation, area: "Geral", periodo: "Atual" }];
        }
      });
      alert("Avaliação enviada com sucesso!");
      // Resetar formulário
      setCompany(null);
      setNewCompany("");
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
      setShowNewCompanyInput(false);
    } catch (err) {
      setError("Erro ao enviar avaliação. Tente novamente.");
      console.error("Erro ao enviar avaliação:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Lógica para detectar o tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Propriedades comuns a serem passadas para ambos os layouts
  const commonProps = {
    company, setCompany, newCompany, setNewCompany, rating, setRating,
    contatoRH, setContatoRH, salarioBeneficios, setSalarioBeneficios,
    estruturaEmpresa, setEstruturaEmpresa, acessibilidadeLideranca, setAcessibilidadeLideranca,
    planoCarreiras, setPlanoCarreiras, bemestar, setBemestar,
    estimulacaoOrganizacao, setEstimulacaoOrganizacao, commentRating, setCommentRating,
    commentContatoRH, setCommentContatoRH, commentSalarioBeneficios, setCommentSalarioBeneficios,
    commentEstruturaEmpresa, setCommentEstruturaEmpresa, commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca,
    commentPlanoCarreiras, setCommentPlanoCarreiras, commentBemestar, setCommentBemestar,
    commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao, generalComment, setGeneralComment,
    handleSubmit, isLoading, empresas, top3, setTop3,
    showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
    linkedInClientId, handleLinkedInLogin, handleGoogleLogin,
    calcularMedia, getBadgeColor, getMedalColor, getMedalEmoji,
    error, isAuthenticated, setIsAuthenticated, user, setUser,
    companyOptions: empresas.map((emp) => ({ value: emp.company, label: emp.company })),
  };

  return (
    <>
      {isMobile ? (
        <TrabalheiLaMobile {...commonProps} />
      ) : (
        <TrabalheiLaDesktop {...commonProps} />
      )}
    </>
  );
}

export default Home;