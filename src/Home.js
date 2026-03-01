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
  const [empresas, setEmpresas] = useState([]);
  const [top3, setTop3] = useState([]); // <- CORREÇÃO: estava faltando esta linha
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);

  // LinkedIn
  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || '';
  const linkedInDisabled = !linkedInClientId;

  // Atualiza top3 sempre que empresas mudar
  useEffect(() => {
    const calcularMediaLocal = (emp) => {
      const sum =
        emp.rating + emp.contatoRH + emp.salarioBeneficios +
        emp.estruturaEmpresa + emp.acessibilidadeLideranca +
        emp.planoCarreiras + emp.bemestar + emp.estimulacaoOrganizacao;
      return sum / 8;
    };
    const sorted = [...empresas].sort(
      (a, b) => calcularMediaLocal(b) - calcularMediaLocal(a)
    );
    setTop3(sorted.slice(0, 3));
  }, [empresas]);

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
    top3, setTop3,
    showNewCompanyInput, setShowNewCompanyInput,
    handleAddNewCompany,
    linkedInClientId,
    handleLinkedInLogin,
    handleGoogleLogin,
    error,
    isAuthenticated, setIsAuthenticated,
    user, setUser,
    linkedInDisabled,
    safeCompanyOptions,
  };

  return isMobile ? (
    <TrabalheiLaMobile {...commonProps} />
  ) : (
    <TrabalheiLaDesktop {...commonProps} />
  );
}

export default Home;