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

  // Comentários individuais para cada critério
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

    // Limpar formulário
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

  // Ordenar empresas por média para o pódio
  const empresasOrdenadas = [...empresas].sort((a, b) => calcularMedia(b) - calcularMedia(a));
  const top3 = empresasOrdenadas.slice(0, 3);

  const getMedalColor = (position) => {
    if (position === 0) return 'from-yellow-400 to-yellow-600'; // Ouro
    if (position === 1) return 'from-gray-300 to-gray-500'; // Prata
    if (position === 2) return 'from-orange-400 to-orange-600'; // Bronze
  };

  const getMedalEmoji = (position) => {
    if (position === 0) return '🥇';
    if (position === 1) return '🥈';
    if (position === 2) return '🥉';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">

      {/* Hero Section com fundo de prédio */}
      <div className="max-w-7xl mx-auto mb-8">
        <div
          className="rounded-3xl shadow-2xl border border-white/20 overflow-hidden relative"
          style={{
            backgroundImage: 'url("/header-building.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Overlay escuro para contraste */}
          <div className="bg-black/60 backdrop-blur-sm p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h1 className="text-5xl md:text-6xl font-black text-white drop-shadow-2xl" style={{ fontWeight: 900 }}>
                  Trabalhei Lá
                </h1>
                <p className="text-yellow-300 font-bold mt-2 max-w-xl text-lg drop-shadow-lg">
                  Avaliações reais, anônimas e confiáveis.
                </p>
              </div>

              {isAuthenticated && (
                <div className="flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full shadow-lg border border-white/30 backdrop-blur-md">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-white font-semibold">Autenticado</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">

        {/* Formulário - 2 colunas */}
        <div className="lg:col-span-2">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">

            {/* Aviso de privacidade */}
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

              {/* Seleção de empresa */}
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
                    onClick={handleAddCompany}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-semibold"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Grid de avaliações com ícones profissionais */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: 'Avaliação Geral', value: rating, setter: setRating, icon: FaStar, color: 'text-yellow-500', comment: commentRating, setComment: setCommentRating },
                  { label: 'Contato do RH', value: contatoRH, setter: setContatoRH, icon: FaHandshake, color: 'text-blue-500', comment: commentContatoRH, setComment: setCommentContatoRH },
                  { label: 'Salário e Benefícios', value: salarioBeneficios, setter: setSalarioBeneficios, icon: FaMoneyBillWave, color: 'text-green-500', comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios },
                  { label: 'Estrutura', value: estruturaEmpresa, setter: setEstruturaEmpresa, icon: FaBuilding, color: 'text-gray-600', comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa },
                  { label: 'Liderança', value: acessibilidadeLideranca, setter: setAcessibilidadeLideranca, icon: FaUserTie, color: 'text-purple-500', comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca },
                  { label: 'Plano de Carreira', value: planoCarreiras, setter: setPlanoCarreiras, icon: FaRocket, color: 'text-red-500', comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras },
                  { label: 'Bem-estar', value: bemestar, setter: setBemestar, icon: FaHeart, color: 'text-pink-500', comment: commentBemestar, setComment: setCommentBemestar },
                  { label: 'Organização', value: estimulacaoOrganizacao, setter: setEstimulacaoOrganizacao, icon: FaChartBar, color: 'text-indigo-500', comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao }
                ].map((item, idx) => {
                  const IconComponent = item.icon;
                  return (
                    <div key={idx} className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-purple-400 transition-all">
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <IconComponent className={item.color} />
                        {item.label}
                        <span className="ml-auto text-purple-600">{item.value}/5</span>
                      </label>
                      <div className="flex gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <FaStar 
                            key={star}
                            size={28}
                            className="cursor-pointer transition-all hover:scale-110"
                            color={star <= item.value ? "#facc15" : "#e5e7eb"}
                            onClick={() => item.setter(star)}
                          />
                        ))}
                      </div>
                      <textarea
                        value={item.comment}
                        onChange={(e) => item.setComment(e.target.value)}
                        rows="2"
                        className="w-full border border-gray-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder={`Comente sobre ${item.label.toLowerCase()} (opcional)...`}
                      ></textarea>
                    </div>
                  );
                })}
              </div>

              {/* Comentário geral */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  💬 Comentário Geral (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows="4"
                  className="w-full border-2 border-purple-300 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Compartilhe uma visão geral sobre sua experiência na empresa (opcional)..."
                ></textarea>
              </div>

              {/* Botões de ação */}
              <div className="space-y-4">
                {!isAuthenticated ? (
                  <div>
                    <LoginLinkedInButton
                      clientId={process.env.REACT_APP_LINKEDIN_CLIENT_ID || "77dv5urtc8ixj3"}
                      redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                      onLoginSuccess={handleLinkedInSuccess}
                      onLoginFailure={handleLinkedInFailure}
                      disabled={isLoading}
                    />
                    {isLoading && (
                      <p className="text-sm text-gray-600 mt-3 text-center animate-pulse">
                        Autenticando com o LinkedIn...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-4 text-white text-center font-semibold shadow-lg">
                    ✅ Pronto! Agora você pode enviar sua avaliação anônima
                  </div>
                )}

                <button 
                  type="submit" 
                  className={`
                    w-full py-4 rounded-2xl text-white font-bold text-lg transition-all transform
                    ${isAuthenticated 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-105 hover:shadow-2xl' 
                      : 'bg-gray-400 cursor-not-allowed opacity-60'}
                  `}
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? '🚀 Enviar Avaliação' : '🔒 Faça login para avaliar'}
                </button>
              </div>

            </form>
          </div>
        </div>

        {/* Ranking com Pódio - 1 coluna */}
        <div className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-white/20 sticky top-8">

            {/* Troféu personalizado */}
        <div className="flex flex-col items-center mb-6">
  <img
    src="/troféu.png"
    alt="Troféu Trabalhei Lá"
    className="w-20 h-20 md:w-24 md:h-24 object-contain mb-3 drop-shadow-[0_0_14px_rgba(56,189,248,0.9)]"
  />
  <h2 className="text-2xl font-black bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent text-center">
    Top Empresas
  </h2>
</div>

            {/* Pódio Top 3 */}
            {top3.length > 0 && (
              <div className="mb-6 space-y-3">
                {top3.map((emp, idx) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-r ${getMedalColor(idx)} rounded-2xl p-4 text-white shadow-lg transform hover:scale-105 transition-all`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{getMedalEmoji(idx)}</span>
                          <div>
                            <h3 className="font-bold text-lg">{emp.company}</h3>
                            <p className="text-xs opacity-90">{emp.area} • {emp.periodo}</p>
                          </div>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-full font-bold">
                          {media} ⭐
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lista de todas as avaliações */}
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {empresas.length === 0 ? (
                <div className="text-center py-12">
                  <FaChartBar className="text-gray-300 text-6xl mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhuma avaliação ainda</p>
                  <p className="text-sm text-gray-400 mt-2">Seja o primeiro a avaliar!</p>
                </div>
              ) : (
                empresas.slice(3).map((emp, idx) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                            {emp.company}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {emp.area} • {emp.periodo}
                          </p>
                        </div>
                        <div className={`${getBadgeColor(media)} px-3 py-1 rounded-full text-white font-bold text-sm shadow-md`}>
                          {media} ⭐
                        </div>
                      </div>

                      {emp.comment && (
                        <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-3 mt-3">
                          "{emp.comment.substring(0, 80)}{emp.comment.length > 80 ? '...' : ''}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 text-center">
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <p className="text-gray-600 text-sm">
            <a href="/politica-de-privacidade.html" className="text-purple-600 hover:text-purple-800 font-semibold underline">
              Política de Privacidade
            </a>
            {' • '}
            <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
          </p>
        </div>
      </footer>

      {/* CSS customizado para scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #8b5cf6, #ec4899);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #7c3aed, #db2777);
        }
      `}</style>

    </div>
  );
}

export default TrabalheiLa;
