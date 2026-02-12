import React, { useState, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';
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

    alert('Avaliação enviada com sucesso!');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-blue-100 p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo Trabalhei Lá" className="w-15 h-10 mb-2" />
          <h1 className="text-center text-3xl font-extrabold text-gray-900 tracking-wide">
            Compartilhe sua experiência nas empresas!
          </h1>
        </div>

        {/* Aviso de privacidade */}
        {!isAuthenticated && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-sm text-blue-800">
              <span role="img" aria-label="cadeado">🔒</span> <strong>Sua privacidade é garantida:</strong> Usamos o LinkedIn apenas para verificar 
              seu vínculo profissional. Suas avaliações são <strong>100% anônimas</strong> — 
              nome e perfil nunca são exibidos publicamente.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Seleção de empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <Select 
              value={company}
              onChange={setCompany}
              options={companyOptions}
              formatOptionLabel={formatOptionLabel}
              placeholder="Selecione uma empresa"
            />
          </div>

          {/* Adicionar nova empresa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adicionar nova empresa</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="border border-gray-300 p-2 rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Digite o nome da nova empresa"
              />
              <button
                type="button"
                onClick={handleAddCompany}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 whitespace-nowrap"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Avaliações com estrelas */}
          {[
            { label: 'Avaliação Geral', value: rating, setter: setRating },
            { label: 'Contato do RH', value: contatoRH, setter: setContatoRH },
            { label: 'Salário e benefícios', value: salarioBeneficios, setter: setSalarioBeneficios },
            { label: 'Estrutura da empresa', value: estruturaEmpresa, setter: setEstruturaEmpresa },
            { label: 'Acessibilidade da liderança', value: acessibilidadeLideranca, setter: setAcessibilidadeLideranca },
            { label: 'Plano de carreiras', value: planoCarreiras, setter: setPlanoCarreiras },
            { label: 'Preocupação com o seu bem estar', value: bemestar, setter: setBemestar },
            { label: 'Estímulo à organização', value: estimulacaoOrganizacao, setter: setEstimulacaoOrganizacao }
          ].map((item, idx) => (
            <div key={idx}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {item.label} <span className="font-bold text-blue-600">{item.value}/5</span>
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar 
                    key={star}
                    size={24}
                    className="cursor-pointer transition-colors"
                    color={star <= item.value ? "#facc15" : "#d1d5db"}
                    onClick={() => item.setter(star)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Área de comentário + botões - container mais estreito */}
          <div className="max-w-xl mx-auto w-full mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comentário</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="5"
                className="border border-gray-300 w-full p-3 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Descreva sua experiência"
              ></textarea>
            </div>

            {/* Botão LinkedIn ou mensagem de autenticado */}
            {!isAuthenticated ? (
              <div className="mt-4">
                <LoginLinkedInButton
                  clientId={process.env.REACT_APP_LINKEDIN_CLIENT_ID || "77dv5urtc8ixj3"}
                  redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                  disabled={isLoading}
                />
                {isLoading && (
                  <p className="text-sm text-gray-600 mt-2 text-center">Autenticando...</p>
                )}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 p-3 rounded mt-4">
                <p className="text-green-800 text-sm text-center">
                  <span role="img" aria-label="check">✅</span> Você está autenticado! Pode enviar sua avaliação de forma anônima.
                </p>
              </div>
            )}

            {/* Botão de enviar */}
            <div className="mt-4 flex justify-center">
              <button 
                type="submit" 
                className={`
                  px-8 py-2 rounded-full text-white font-semibold transition-colors
                  ${isAuthenticated 
                    ? 'bg-blue-700 hover:bg-blue-800' 
                    : 'bg-gray-400 cursor-not-allowed'}
                `}
                disabled={!isAuthenticated}
              >
                {isAuthenticated ? 'Enviar avaliação' : 'Faça login para avaliar'}
              </button>
            </div>
          </div>

        </form>

        {/* Ranking das empresas */}
        <h2 className="text-2xl font-bold mt-10 mb-4 text-center text-blue-700">Ranking das Empresas</h2>
        <div className="grid gap-4">
          {empresas.length === 0 && (
            <p className="text-center text-gray-500 py-8">Nenhuma avaliação ainda.</p>
          )}
          {empresas.map((emp, idx) => (
            <div
              key={idx}
              className="bg-white shadow-md rounded-lg p-4 border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-extrabold text-blue-700 mb-2">{emp.company}</h3>
              <div className="text-sm text-gray-800 space-y-1">
                <p><span role="img" aria-label="estrela">⭐</span> Avaliação Geral: <strong>{emp.rating}/5</strong></p>
                <p><span role="img" aria-label="pessoas">👥</span> Contato com RH: <strong>{emp.contatoRH}/5</strong></p>
                <p><span role="img" aria-label="dinheiro">💰</span> Salário e Benefícios: <strong>{emp.salarioBeneficios}/5</strong></p>
                <p><span role="img" aria-label="prédio">🏢</span> Estrutura da Empresa: <strong>{emp.estruturaEmpresa}/5</strong></p>
                <p><span role="img" aria-label="cérebro">🧠</span> Liderança Acessível: <strong>{emp.acessibilidadeLideranca}/5</strong></p>
                <p><span role="img" aria-label="foguete">🚀</span> Plano de Carreira: <strong>{emp.planoCarreiras}/5</strong></p>
                <p><span role="img" aria-label="planta">🌱</span> Bem-estar: <strong>{emp.bemestar}/5</strong></p>
                <p><span role="img" aria-label="gráfico">📈</span> Estímulo à Organização: <strong>{emp.estimulacaoOrganizacao}/5</strong></p>
                {emp.comment && (
                  <p className="text-gray-600 italic mt-2 pt-2 border-t border-gray-200">
                    "{emp.comment}"
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Avaliado por: Ex-funcionário • {emp.area} • {emp.periodo}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <a href="/politica-de-privacidade.html" className="text-blue-500 hover:underline">
            Política de Privacidade
          </a>
        </footer>

      </div>
    </div>
  );
}

export default TrabalheiLa;
