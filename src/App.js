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

  // NOVO: Estado de autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [companies, setCompanies] = useState([
    "Banco do Brasil", "Raízen Combustíveis", "Itaú Unibanco Holding", "Grupo Raízen",
    "Bradesco", "Vale", "Itaú Unibanco", "Caixa Econômica Federal", "Grupo Carrefour Brasil",
    "Magazine Luiza", "Ambev", "Embraer", "WEG", "Suzano Papel e Celulose", "XP Inc.",
    "Rede D'Or São Luiz", "Gerdau", "CVC Brasil", "Braskem", "Infotec", "Engemon"
  ]);

  // NOVO: Verificar se já está autenticado ao carregar
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      setUserToken(token);
      setIsAuthenticated(true);
    }
  }, []);

  // NOVO: Carregar avaliações do backend
  useEffect(() => {
    const carregarAvaliacoes = async () => {
      try {
        const response = await fetch('https://api.trabalheila.com.br/avaliacoes');
        if (response.ok) {
          const data = await response.json();
          setEmpresas(data);
        }
      } catch (error) {
        console.error('Erro ao carregar avaliações:', error);
      }
    };
    carregarAvaliacoes();
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

  // NOVO: Handler de sucesso do LinkedIn
  const handleLinkedInSuccess = async (response) => {
    setIsLoading(true);
    try {
      // Envia o código OAuth para o backend
      const res = await fetch('https://api.trabalheila.com.br/auth/linkedin/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: response.code }),
      });

      if (!res.ok) throw new Error('Falha na autenticação');

      const data = await res.json();

      // Armazena o token
      localStorage.setItem('auth_token', data.token);
      setUserToken(data.token);
      setIsAuthenticated(true);

      alert('✅ Autenticação realizada! Agora você pode avaliar empresas de forma anônima.');
    } catch (error) {
      console.error('Erro no login:', error);
      alert('❌ Não foi possível completar a autenticação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // NOVO: Handler de falha do LinkedIn
  const handleLinkedInFailure = (error) => {
    console.error('Erro no LinkedIn:', error);
    alert('❌ Falha ao conectar com o LinkedIn. Tente novamente.');
  };

  // MODIFICADO: Enviar avaliação para o backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      alert('⚠️ Você precisa fazer login com o LinkedIn antes de avaliar.');
      return;
    }

    if (!company) {
      alert('⚠️ Selecione uma empresa antes de enviar.');
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
      comment
    };

    try {
      const response = await fetch('https://api.trabalheila.com.br/avaliacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify(novaAvaliacao)
      });

      if (!response.ok) throw new Error('Erro ao enviar avaliação');

      const avaliacaoSalva = await response.json();

      // Atualiza a lista local
      setEmpresas([avaliacaoSalva, ...empresas]);

      // Limpa o formulário
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

      alert('✅ Avaliação enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      alert('❌ Erro ao enviar avaliação. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-blue-100 p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <div className="flex flex-col items-center mb-4">
          <img src="/logo.png" alt="Logo Trabalhei Lá" className="w-15 h-10 mb-2 mx-auto" />
          <p className="text-center mb-6 text-3xl font-extrabold text-gray-900 tracking-wide">
            Compartilhe sua experiência nas empresas!
          </p>
        </div>

        {/* NOVO: Aviso de privacidade */}
        {!isAuthenticated && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-sm text-blue-800">
              🔒 <strong>Sua privacidade é garantida:</strong> Usamos o LinkedIn apenas para verificar 
              seu vínculo profissional. Suas avaliações são <strong>100% anônimas</strong> — 
              nome e perfil nunca são exibidos publicamente.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label>Nome da Empresa</label>
            <Select 
              value={company}
              onChange={setCompany}
              options={companyOptions}
              formatOptionLabel={formatOptionLabel}
              className="mb-2"
              placeholder="Selecione uma empresa"
            />
          </div>

          <div>
            <label>Adicionar nova empresa</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="border p-2 rounded w-full"
                placeholder="Digite o nome da nova empresa"
              />
              <button
                type="button"
                onClick={handleAddCompany}
                className="bg-green-600 text-white px-4 rounded hover:bg-green-700"
              >
                Adicionar
              </button>
            </div>
          </div>

          {[{
            label: 'Avaliação Geral', value: rating, setter: setRating
          }, {
            label: 'Contato do RH', value: contatoRH, setter: setContatoRH
          }, {
            label: 'Salário e benefícios', value: salarioBeneficios, setter: setSalarioBeneficios
          }, {
            label: 'Estrutura da empresa', value: estruturaEmpresa, setter: setEstruturaEmpresa
          }, {
            label: 'Acessibilidade da liderança', value: acessibilidadeLideranca, setter: setAcessibilidadeLideranca
          }, {
            label: 'Plano de carreiras', value: planoCarreiras, setter: setPlanoCarreiras
          }, {
            label: 'Preocupação com o seu bem estar', value: bemestar, setter: setBemestar
          }, {
            label: 'Estímulo à organização', value: estimulacaoOrganizacao, setter: setEstimulacaoOrganizacao
          }].map((item, idx) => (
            <div key={idx}>
              <label>{item.label} <span className="font-bold">{item.value}/5</span></label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar key={star}
                    size={24}
                    className="cursor-pointer"
                    color={star <= item.value ? "#facc15" : "#d1d5db"}
                    onClick={() => item.setter(star)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <label>Comentário</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="5"
              className="border w-full p-2 rounded mb-2"
              placeholder="Descreva sua experiência"
            ></textarea>
          </div>

          {/* MODIFICADO: Botão LinkedIn com handlers corretos */}
          {!isAuthenticated ? (
            <div className="mt-2">
              <LoginLinkedInButton
                clientId="77dv5urtc8ixj3"
                redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                onLoginSuccess={handleLinkedInSuccess}
                onLoginFailure={handleLinkedInFailure}
                disabled={isLoading}
              />
              {isLoading && (
                <p className="text-sm text-gray-600 mt-2">Autenticando...</p>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 p-3 rounded">
              <p className="text-green-800 text-sm">
                ✅ Você está autenticado! Pode enviar sua avaliação de forma anônima.
              </p>
            </div>
          )}

          <button 
            type="submit" 
            className={`py-2 rounded text-white ${
              isAuthenticated 
                ? 'bg-blue-700 hover:bg-blue-800' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
            disabled={!isAuthenticated}
          >
            {isAuthenticated ? 'Enviar Avaliação' : 'Faça login para avaliar'}
          </button>
        </form>

        <h2 className="text-2xl font-bold mt-10 text-center text-blue-700">Ranking das Empresas</h2>
        <div className="mt-4 grid gap-4">
          {empresas.length === 0 && (
            <p className="text-center text-gray-500">Nenhuma avaliação ainda.</p>
          )}
          {empresas.map((emp, idx) => (
            <div
              key={idx}
              className="bg-white shadow-md rounded-lg p-4 border border-gray-200"
            >
              <h3 className="text-lg font-extrabold text-blue-700 mb-1">{emp.company}</h3>
              <div className="text-sm text-gray-800 space-y-1">
                <p>⭐ Avaliação Geral: <strong>{emp.rating}/5</strong></p>
                <p>👥 Contato com RH: <strong>{emp.contatoRH}/5</strong></p>
                <p>💰 Salário e Benefícios: <strong>{emp.salarioBeneficios}/5</strong></p>
                <p>🏢 Estrutura da Empresa: <strong>{emp.estruturaEmpresa}/5</strong></p>
                <p>🧠 Liderança Acessível: <strong>{emp.acessibilidadeLideranca}/5</strong></p>
                <p>🚀 Plano de Carreira: <strong>{emp.planoCarreiras}/5</strong></p>
                <p>🌱 Bem-estar: <strong>{emp.bemestar}/5</strong></p>
                <p>📈 Estímulo à Organização: <strong>{emp.estimulacaoOrganizacao}/5</strong></p>
                {emp.comment && (
                  <p className="text-gray-600 italic mt-2 border-t pt-2">
                    "{emp.comment}"
                  </p>
                )}
                {/* NOVO: Mostra info anônima do avaliador */}
                <p className="text-xs text-gray-400 mt-2">
                  Avaliado por: Ex-funcionário • {emp.area || 'Área não informada'} • {emp.periodo || 'Período não informado'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-6 text-center text-sm text-gray-500">
          <a href="/politica-de-privacidade.html" className="text-blue-500 hover:underline">
            Política de Privacidade
          </a>
        </footer>
      </div>
    </div>
  );
}

export default TrabalheiLa;
