import React, { useState, useEffect } from 'react';
import TrabalheiLaMobile from './TrabalheiLaMobile';
import TrabalheiLaDesktop from './TrabalheiLaDesktop';

function TrabalheiLa() {
  // Estados compartilhados
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

  const [commentRating, setCommentRating] = useState('');
  const [commentContatoRH, setCommentContatoRH] = useState('');
  const [commentSalarioBeneficios, setCommentSalarioBeneficios] = useState('');
  const [commentEstruturaEmpresa, setCommentEstruturaEmpresa] = useState('');
  const [commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca] = useState('');
  const [commentPlanoCarreiras, setCommentPlanoCarreiras] = useState('');
  const [commentBemestar, setCommentBemestar] = useState('');
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState('');

  const [comment, setComment] = useState('');
  const [empresas, setEmpresas] = useState([]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [companies, setCompanies] = useState([
    'Banco do Brasil',
    'Raízen Combustíveis',
    'Itaú Unibanco Holding',
    'Grupo Raízen',
    'Bradesco',
    'Vale',
    'Itaú Unibanco',
    'Caixa Econômica Federal',
    'Grupo Carrefour Brasil',
    'Magazine Luiza',
    'Ambev',
    'Embraer',
    'WEG',
    'Suzano Papel e Celulose',
    'XP Inc.',
    "Rede D'Or São Luiz",
    'Gerdau',
    'CVC Brasil',
    'Braskem',
    'Infotec',
    'Engemon',
  ]);

  // Detector de tela
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreen = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const companyOptions = companies.map((comp) => ({ label: comp, value: comp }));

  const formatOptionLabel = ({ label }) => (
    <div className="flex items-center gap-2">
      <img
        src={`https://logo.clearbit.com/${label
          .toLowerCase()
          .replace(/\s/g, '')
          .replace(/[^a-z0-9]/g, '')}.com`}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
        alt={`logo ${label}`}
        className="w-5 h-5 rounded"
      />
      <span>{label}</span>
    </div>
  );

  const handleAddCompany = () => {
    if (newCompany && !companies.includes(newCompany)) {
      setCompanies([...companies, newCompany]);
      setNewCompany('');
      setCompany({ label: newCompany, value: newCompany });
    }
  };

  const handleLinkedInSuccess = async () => {
    setIsLoading(true);
    setTimeout(() => {
      const fakeToken = 'token_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('auth_token', fakeToken);
      setIsAuthenticated(true);
      setIsLoading(false);
      alert('Autenticação realizada! Suas avaliações serão anônimas.');
    }, 1500);
  };

  const handleLinkedInFailure = (error) => {
    console.error('Erro no LinkedIn:', error);
    alert('Falha ao conectar com o LinkedIn. Tente novamente.');
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const fakeToken = 'google_token_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('auth_token', fakeToken);
      setIsAuthenticated(true);
      setIsLoading(false);
      alert('Login com Google realizado! Suas avaliações serão anônimas.');
    }, 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Você precisa fazer login antes de avaliar.');
      return;
    }
    if (!company) {
      alert('Selecione uma empresa antes de enviar.');
      return;
    }

    const novaAvaliacao = {
      company: company.value,
      rating,
      contatoRH,
      salarioBeneficios,
      estruturaEmpresa,
      acessibilidadeLideranca,
      planoCarreiras,
      bemestar,
      estimulacaoOrganizacao,
      comments: {
        rating: commentRating,
        contatoRH: commentContatoRH,
        salarioBeneficios: commentSalarioBeneficios,
        estruturaEmpresa: commentEstruturaEmpresa,
        acessibilidadeLideranca: commentAcessibilidadeLideranca,
        planoCarreiras: commentPlanoCarreiras,
        bemestar: commentBemestar,
        estimulacaoOrganizacao: commentEstimulacaoOrganizacao,
      },
      comment,
      area: 'Tecnologia',
      periodo: '2021-2024',
    };

    setEmpresas([novaAvaliacao, ...empresas]);
    setCompany(null);
    setRating(0);
    setComment('');
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
    alert('Avaliação enviada com sucesso!');
  };

  const calcularMedia = (emp) =>
    (
      (emp.rating +
        emp.contatoRH +
        emp.salarioBeneficios +
        emp.estruturaEmpresa +
        emp.acessibilidadeLideranca +
        emp.planoCarreiras +
        emp.bemestar +
        emp.estimulacaoOrganizacao) /
      8
    ).toFixed(1);

  const getBadgeColor = (nota) => {
    if (nota >= 4.5) return 'bg-gradient-to-r from-green-400 to-emerald-500';
    if (nota >= 3.5) return 'bg-gradient-to-r from-blue-400 to-cyan-500';
    if (nota >= 2.5) return 'bg-gradient-to-r from-yellow-400 to-orange-500';
    return 'bg-gradient-to-r from-red-400 to-pink-500';
  };

  const empresasOrdenadas = [...empresas].sort(
    (a, b) => calcularMedia(b) - calcularMedia(a)
  );
  const top3 = empresasOrdenadas.slice(0, 3);

  const getMedalColor = (position) => {
    if (position === 0) return 'from-yellow-400 to-yellow-600';
    if (position === 1) return 'from-gray-300 to-gray-500';
    if (position === 2) return 'from-orange-400 to-orange-600';
    return 'from-gray-300 to-gray-500';
  };

  const getMedalEmoji = (position) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
    return '🏅';
  };

  // Props compartilhadas
  const sharedProps = {
    company,
    setCompany,
    newCompany,
    setNewCompany,
    rating,
    setRating,
    contatoRH,
    setContatoRH,
    salarioBeneficios,
    setSalarioBeneficios,
    estruturaEmpresa,
    setEstruturaEmpresa,
    acessibilidadeLideranca,
    setAcessibilidadeLideranca,
    planoCarreiras,
    setPlanoCarreiras,
    bemestar,
    setBemestar,
    estimulacaoOrganizacao,
    setEstimulacaoOrganizacao,
    commentRating,
    setCommentRating,
    commentContatoRH,
    setCommentContatoRH,
    commentSalarioBeneficios,
    setCommentSalarioBeneficios,
    commentEstruturaEmpresa,
    setCommentEstruturaEmpresa,
    commentAcessibilidadeLideranca,
    setCommentAcessibilidadeLideranca,
    commentPlanoCarreiras,
    setCommentPlanoCarreiras,
    commentBemestar,
    setCommentBemestar,
    commentEstimulacaoOrganizacao,
    setCommentEstimulacaoOrganizacao,
    comment,
    setComment,
    empresas,
    isAuthenticated,
    isLoading,
    companies,
    companyOptions,
    formatOptionLabel,
    handleAddCompany,
    handleLinkedInSuccess,
    handleLinkedInFailure,
    handleGoogleLogin,
    handleSubmit,
    calcularMedia,
    getBadgeColor,
    top3,
    getMedalColor,
    getMedalEmoji,
  };

  // Renderiza Mobile ou Desktop
  if (isDesktop) {
    return <TrabalheiLaDesktop {...sharedProps} />;
  }

  return <TrabalheiLaMobile {...sharedProps} />;
}

export default TrabalheiLa;
