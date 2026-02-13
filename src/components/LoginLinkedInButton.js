import React, { useState, useEffect } from 'react';
import { FaStar, FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaRocket, FaHeart, FaChartBar } from 'react-icons/fa';
import Select from 'react-select';
import './index.css';
import LoginLinkedInButton from './components/LoginLinkedInButton';

function TrabalheiLa() {
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

  const [comment, setComment] = useState("");
  const [empresas, setEmpresas] = useState([]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [companies, setCompanies] = useState([
    "Banco do Brasil", "Raízen Combustíveis", "Itaú Unibanco Holding", "Grupo Raízen",
    "Bradesco", "Vale", "Itaú Unibanco", "Caixa Econômica Federal", "Grupo Carrefour Brasil",
    "Magazine Luiza", "Ambev", "Embraer", "WEG", "Suzano Papel e Celulose", "XP Inc.",
    "Rede D'Or São Luiz", "Gerdau", "CVC Brasil", "Braskem", "Infotec", "Engemon"
  ]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const companyOptions = companies.map((comp) => ({
    label: comp,
    value: comp
  }));

  const formatOptionLabel = ({ label }) => (
    <div className="flex items-center gap-2">
      <img
        src={`https://logo.clearbit.com/${label.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')}.com`}
        onError={(e) => (e.target.style.display = "none")}
        alt={`logo ${label}`}
        className="w-5 h-5 rounded"
      />
      <span>{label}</span>
    </div>
  );

  const handleAddCompany = () => {
    if (newCompany && !companies.includes(newCompany)) {
      setCompanies([...companies, newCompany]);
      setNewCompany("");
      setCompany({ label: newCompany, value: newCompany });
    }
  };

  const handleLinkedInSuccess = async (response) => {
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

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      alert('Você precisa fazer login com o LinkedIn antes de avaliar.');
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
      periodo: '2021-2024'
    };

    setEmpresas([novaAvaliacao, ...empresas]);

    setCompany(null);
    setRating(0);
    setComment("");
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

    alert('Avaliação enviada com sucesso!');
  };

  const calcularMedia = (emp) => {
    return ((emp.rating + emp.contatoRH + emp.salarioBeneficios + emp.estruturaEmpresa + 
             emp.acessibilidadeLideranca + emp.planoCarreiras + emp.bemestar + emp.estimulacaoOrganizacao) / 8).toFixed(1);
  };

  const getBadgeColor = (nota) => {
    if (nota >= 4.5) return 'bg-gradient-to-r from-green-400 to-emerald-500';
    if (nota >= 3.5) return 'bg-gradient-to-r from-blue-400 to-cyan-500';
    if (nota >= 2.5) return 'bg-gradient-to-r from-yellow-400 to-orange-500';
    return 'bg-gradient-to-r from-red-400 to-pink-500';
  };

  const empresasOrdenadas = [...empresas].sort((a, b) => calcularMedia(b) - calcularMedia(a));
  const top3 = empresasOrdenadas.slice(0, 3);

  const getMedalColor = (position) => {
    if (position === 0) return 'from-yellow-400 to-yellow-600';
    if (position === 1) return 'from-gray-300 to-gray-500';
    if (position === 2) return 'from-orange-400 to-orange-600';
  };

  const getMedalEmoji = (position) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">

      {/* Header melhorado */}
      <div className="max-w-7xl mx-auto mb-8">
        <div
          className="rounded-3xl shadow-2xl border border-white/20 overflow-hidden relative"
          style={{
            backgroundImage: 'url("/header-building.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay em degradê para melhorar contraste */}
          <div className="bg-gradient-to-r from-black/80 via-black/60 to-black/30 p-6 md:p-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]">
                  Trabalhei <span className="text-sky-300">Lá</span>
                </h1>

                <p className="mt-2 text-sm md:text-base font-medium text-slate-100/90">
                  <span className="inline-block px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm">
                    Avaliações reais, anônimas e confiáveis
                  </span>
                </p>
              </div>

              {isAuthenticated && (
                <div className="flex items-center gap-3 bg-white/10 px-4 py-2 md:px-6 md:py-3 rounded-full shadow-lg border border-white/30 backdrop-blur-md">
                  <div className="w-2 h-2 md:w-3 md:h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs md:text-sm text-white font-semibold">
                    Autenticado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">

        <div className="lg:col-span-2">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">

            {!isAuthenticated && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">🔒</div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Sua privacidade é garantida</h3>
                    <p className="text-sm text-blue-50">
                      Usamos o LinkedIn apenas para verificar seu vínculo profissional. 
                      Suas avaliações são <strong>100% anônimas</strong> — nome e perfil nunca são exibidos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <FaBuilding className="text-blue-600" />
                  Selecione a Empresa
                </label>
                <Select 
                  value={company}
                  onChange={setCompany}
                  options={companyOptions}
                  formatOptionLabel={formatOptionLabel}
                  placeholder="Digite ou selecione..."
                  className="mb-4"
                />

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="flex-1 border-2 border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ou adicione uma nova empresa"
                  />
                  <button
                    type="button"


