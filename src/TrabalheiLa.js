import React, { useState, useEffect } from 'react';
import { FaStar, FaBuilding, FaTrophy, FaChartLine } from 'react-icons/fa';
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

    alert('Avaliação enviada com sucesso!');
  };

  // Calcular média das avaliações
  const calcularMedia = (emp) => {
    return ((emp.rating + emp.contatoRH + emp.salarioBeneficios + emp.estruturaEmpresa + 
             emp.acessibilidadeLideranca + emp.planoCarreiras + emp.bemestar + emp.estimulacaoOrganizacao) / 8).toFixed(1);
  };

  // Definir cor do badge baseado na nota
  const getBadgeColor = (nota) => {
    if (nota >= 4.5) return 'bg-gradient-to-r from-green-400 to-emerald-500';
    if (nota >= 3.5) return 'bg-gradient-to-r from-blue-400 to-cyan-500';
    if (nota >= 2.5) return 'bg-gradient-to-r from-yellow-400 to-orange-500';
    return 'bg-gradient-to-r from-red-400 to-pink-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-8">

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl shadow-lg">
                <FaBuilding className="text-white text-4xl" />
              </div>
              <div>
                <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Trabalhei Lá
                </h1>
                <p className="text-gray-600 font-medium">Avalie empresas de forma anônima</p>
              </div>
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-3 bg-gradient-to-r from-green-400 to-emerald-500 px-6 py-3 rounded-full shadow-lg">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span className="text-white font-semibold">Autenticado</span>
              </div>
            )}
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

              {/* Grid de avaliações */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: 'Avaliação Geral', value: rating, setter: setRating, icon: '⭐' },
                  { label: 'Contato do RH', value: contatoRH, setter: setContatoRH, icon: '👥' },
                  { label: 'Salário e Benefícios', value: salarioBeneficios, setter: setSalarioBeneficios, icon: '💰' },
                  { label: 'Estrutura', value: estruturaEmpresa, setter: setEstruturaEmpresa, icon: '🏢' },
                  { label: 'Liderança', value: acessibilidadeLideranca, setter: setAcessibilidadeLideranca, icon: '🧠' },
                  { label: 'Plano de Carreira', value: planoCarreiras, setter: setPlanoCarreiras, icon: '🚀' },
                  { label: 'Bem-estar', value: bemestar, setter: setBemestar, icon: '🌱' },
                  { label: 'Organização', value: estimulacaoOrganizacao, setter: setEstimulacaoOrganizacao, icon: '📈' }
                ].map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-purple-400 transition-all">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      <span role="img" aria-label={item.label}>{item.icon}</span> {item.label}
                      <span className="ml-2 text-purple-600">{item.value}/5</span>
                    </label>
                    <div className="flex gap-1">
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
                  </div>
                ))}
              </div>

              {/* Comentário */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-200">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  💬 Conte sua experiência
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows="4"
                  className="w-full border-2 border-purple-300 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Compartilhe detalhes sobre sua experiência..."
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

        {/* Ranking - 1 coluna */}
        <div className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-white/20 sticky top-8">

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-3 rounded-xl">
                <FaTrophy className="text-white text-2xl" />
              </div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                Ranking
              </h2>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {empresas.length === 0 ? (
                <div className="text-center py-12">
                  <FaChartLine className="text-gray-300 text-6xl mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhuma avaliação ainda</p>
                  <p className="text-sm text-gray-400 mt-2">Seja o primeiro a avaliar!</p>
                </div>
              ) : (
                empresas.map((emp, idx) => {
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
