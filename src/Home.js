import React, { useState, useEffect } from 'react';
import TrabalheiLaMobile from './TrabalheiLaMobile';
import TrabalheiLaDesktop from './TrabalheiLaDesktop';

function Home() {
  // Detecção de tamanho de tela
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Estados do formulário
  const [company, setCompany] = useState(null);
  const [newCompany, setNewCompany] = useState('');
  const [rating, setRating] = useState(0);
  const [contatoRH, setContatoRH] = useState(0);
  const [salarioBeneficios, setSalarioBeneficios] = useState(0);
  const [estruturaEmpresa, setEstruturaEmpresa] = useState(0);
  const [acessibilidadeLideranca, setAcessibilidadeLideranca] = useState(0);
  const [planoCarreiras, setPlanoCarreiras] = useState(0);
  const [bemestar, setBemestar] = useState(0);
  const [estimulacaoOrganizacao, setEstimulacaoOrganizacao] = useState(0);

  // Comentários
  const [commentRating, setCommentRating] = useState('');
  const [commentContatoRH, setCommentContatoRH] = useState('');
  const [commentSalarioBeneficios, setCommentSalarioBeneficios] = useState('');
  const [commentEstruturaEmpresa, setCommentEstruturaEmpresa] = useState('');
  const [commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca] = useState('');
  const [commentPlanoCarreiras, setCommentPlanoCarreiras] = useState('');
  const [commentBemestar, setCommentBemestar] = useState('');
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState('');
  const [generalComment, setGeneralComment] = useState('');

  // Estados gerais
  const [empresas, setEmpresas] = useState([
    {
      company: "Empresa A",
      rating: 4, contatoRH: 3, salarioBeneficios: 4, estruturaEmpresa: 5,
      acessibilidadeLideranca: 4, planoCarreiras: 3, bemestar: 4, estimulacaoOrganizacao: 5,
      comment: "Ótimo ambiente de trabalho e liderança acessível.",
      area: "TI", periodo: "2020-Atual"
    },
    {
      company: "Empresa B",
      rating: 3, contatoRH: 2, salarioBeneficios: 3, estruturaEmpresa: 4,
      acessibilidadeLideranca: 3, planoCarreiras: 4, bemestar: 3, estimulacaoOrganizacao: 4,
      comment: "Benefícios bons, mas a estrutura deixa a desejar.",
      area: "Marketing", periodo: "2021-2024"
    },
    {
      company: "Empresa C",
      rating: 5, contatoRH: 5, salarioBeneficios: 5, estruturaEmpresa: 5,
      acessibilidadeLideranca: 5, planoCarreiras: 5, bemestar: 5, estimulacaoOrganizacao: 5,
      comment: "Melhor lugar que já trabalhei! Recomendo muito.",
      area: "Finanças", periodo: "2019-Atual"
    },
    {
      company: "Petrobras", // Adicione a Petrobras aqui para testar a logo
      rating: 4.5, contatoRH: 4, salarioBeneficios: 4.8, estruturaEmpresa: 4.5,
      acessibilidadeLideranca: 4.2, planoCarreiras: 4.7, bemestar: 4.3, estimulacaoOrganizacao: 4.6,
      comment: "Excelente empresa, com muitos desafios e oportunidades.",
      area: "Engenharia", periodo: "2018-Atual"
    },
  ]);
  const [top3, setTop3] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);

  // LinkedIn
  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || '';
  const linkedInDisabled = !linkedInClientId;

  // Funções auxiliares para o cálculo da média e cores (definidas aqui para uso em Home e passadas como prop)
  const calcularMedia = (emp) => {
    if (!emp) return 0; // Garante que não haverá erro se emp for nulo
    const sum =
      emp.rating + emp.contatoRH + emp.salarioBeneficios +
      emp.estruturaEmpresa + emp.acessibilidadeLideranca +
      emp.planoCarreiras + emp.bemestar + emp.estimulacaoOrganizacao;
    return (sum / 8).toFixed(1);
  };

  // Funções para cores e emojis das medalhas (passadas como prop)
  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-300 to-gray-500";
    if (index === 2) return "from-amber-600 to-amber-800";
    return "from-purple-400 to-purple-600";
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

  // Atualiza top3 sempre que empresas mudar
  useEffect(() => {
    const sorted = [...empresas].sort(
      (a, b) => calcularMedia(b) - calcularMedia(a)
    );
    setTop3(sorted.slice(0, 3));
  }, [empresas, calcularMedia]); // Adicionado calcularMedia como dependência

  // Handlers
  const handleAddNewCompany = () => {
    if (newCompany.trim()) {
      setCompany(newCompany.trim());
      setNewCompany('');
      setShowNewCompanyInput(false);
    }
  };

  const handleLinkedInLogin = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleGoogleLogin = () => {
    console.log('Google Login clicado');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company) {
      setError('Por favor, selecione ou digite o nome de uma empresa.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const newEvaluation = {
        company: typeof company === 'object' ? company.value : company,
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
        comment: generalComment,
        area: 'Geral',
        periodo: 'Atual',
      };
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setEmpresas((prev) => [...prev, newEvaluation]);
      alert('Avaliação enviada com sucesso!');
      // Reset do formulário
      setCompany(null);
      setRating(0);
      setContatoRH(0);
      setSalarioBeneficios(0);
      setEstruturaEmpresa(0);
      setAcessibilidadeLideranca(0);
      setPlanoCarreiras(0);
      setBemestar(0);
      setEstimulacaoOrganizacao(0);
      setCommentRating('');
      setCommentContatoRH('');
      setCommentSalarioBeneficios('');
      setCommentEstruturaEmpresa('');
      setCommentAcessibilidadeLideranca('');
      setCommentPlanoCarreiras('');
      setCommentBemestar('');
      setCommentEstimulacaoOrganizacao('');
      setGeneralComment('');
      setShowNewCompanyInput(false);
    } catch (err) {
      setError('Erro ao enviar avaliação. Tente novamente.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const safeCompanyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

  // Dados da empresa selecionada para passar ao cabeçalho
  // ✅ CORRIGIDO: Adicionado 'company &&' para evitar TypeError
  const selectedCompanyData = empresas.find(emp => emp.company === (company && typeof company === 'object' ? company.value : company));

  const commonProps = {
    company, setCompany,
    newCompany, setNewCompany,
    rating, setRating,
    contatoRH, setContatoRH,
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
    handleSubmit,
    isLoading,
    empresas,
    top3,
    showNewCompanyInput, setShowNewCompanyInput,
    handleAddNewCompany,
    linkedInClientId,
    handleLinkedInLogin,
    handleGoogleLogin,
    error,
    isAuthenticated,
    selectedCompanyData, // <-- Passando os dados da empresa selecionada
    calcularMedia, // <-- Passando a função calcularMedia
    getMedalColor, // <-- Passando a função getMedalColor
    getMedalEmoji, // <-- Passando a função getMedalEmoji
    getBadgeColor, // <-- Passando a função getBadgeColor
    safeCompanyOptions, // Passando as opções de empresa para o Select
  };

  return isMobile ? (
    <TrabalheiLaMobile {...commonProps} />
  ) : (
    <TrabalheiLaDesktop {...commonProps} />
  );
}

export default Home;