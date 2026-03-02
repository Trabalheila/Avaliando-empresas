import React, { useState } from 'react';
import { FaGoogle, FaLinkedinIn, FaHandshake, FaMoneyBillWave, FaChartLine, FaLightbulb, FaPlus, FaMinus, FaChartBar, FaBuilding } from 'react-icons/fa';
import LoginLinkedInButton from './LoginLinkedInButton'; // Certifique-se de que o caminho está correto
import OutlinedStar from './OutlinedStar'; // Certifique-se de que o caminho está correto

function TrabalheiLaDesktop({
  empresas,
  setEmpresas,
  top3,
  setTop3,
  isAuthenticated,
  setIsAuthenticated,
  handleLinkedInLogin,
  linkedInClientId,
  linkedInRedirectUri,
  calcularMedia,
  getBadgeColor,
  getMedalColor,
  getMedalEmoji,
}) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyArea, setNewCompanyArea] = useState('');
  const [newCompanyPeriodo, setNewCompanyPeriodo] = useState('');
  const [newCompanyDescription, setNewCompanyDescription] = useState('');
  const [contatoRH, setContatoRH] = useState(0);
  const [salarioBeneficios, setSalarioBeneficios] = useState(0);
  const [oportunidadeCrescimento, setOportunidadeCrescimento] = useState(0);
  const [culturaValores, setCulturaValores] = useState(0);
  const [estimulacaoOrganizacao, setEstimulacaoOrganizacao] = useState(0);
  const [commentContatoRH, setCommentContatoRH] = useState('');
  const [commentSalarioBeneficios, setCommentSalarioBeneficios] = useState('');
  const [commentOportunidadeCrescimento, setCommentOportunidadeCrescimento] = useState('');
  const [commentCulturaValores, setCommentCulturaValores] = useState('');
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState('');
  const [generalComment, setGeneralComment] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState({});
  const [showAddNewCompany, setShowAddNewCompany] = useState(false);

  const renderStars = (currentRating, setRating, currentComment, setComment, label) => (
    <div className="flex items-center gap-2">
      {[...Array(5)].map((_, i) => {
        const ratingValue = i + 1;
        return (
          <OutlinedStar
            key={i}
            active={ratingValue <= currentRating}
            onClick={() => setRating(ratingValue)}
            label={`${ratingValue} estrelas para ${label}`}
          />
        );
      })}
      {currentRating > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCommentInput(prev => ({ ...prev, [label]: !prev[label] }))}
            className="text-gray-500 hover:text-gray-700 transition-colors text-sm ml-2"
            aria-label={`Adicionar comentário para ${label}`}
          >
            {showCommentInput[label] ? <FaMinus /> : <FaPlus />}
          </button>
          {showCommentInput[label] && (
            <div className="absolute z-10 bg-white p-3 rounded-lg shadow-lg border border-gray-200 mt-2 w-64 right-0">
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={`Comentário para ${label}`}
                rows="2"
                value={currentComment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const handleAddNewCompany = async () => {
    if (!newCompanyName || !newCompanyArea || !newCompanyPeriodo) {
      setError('Por favor, preencha todos os campos obrigatórios para adicionar uma nova empresa.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/addCompany', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: newCompanyName,
          area: newCompanyArea,
          periodo: newCompanyPeriodo,
          description: newCompanyDescription,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao adicionar empresa.');
      }

      const newCompany = await response.json();
      setEmpresas(prev => [...prev, newCompany]);
      setSelectedCompany(newCompany.company);
      setShowAddNewCompany(false);
      setNewCompanyName('');
      setNewCompanyArea('');
      setNewCompanyPeriodo('');
      setNewCompanyDescription('');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) {
      setError('Por favor, selecione ou adicione uma empresa.');
      return;
    }
    if (!isAuthenticated) {
      setError('Você precisa estar logado para enviar uma avaliação.');
      return;
    }

    setIsLoading(true);
    setError('');

    const evaluationData = {
      company: selectedCompany,
      contatoRH,
      salarioBeneficios,
      oportunidadeCrescimento,
      culturaValores,
      estimulacaoOrganizacao,
      commentContatoRH,
      commentSalarioBeneficios,
      commentOportunidadeCrescimento,
      commentCulturaValores,
      commentEstimulacaoOrganizacao,
      generalComment,
    };

    try {
      const response = await fetch('/api/submitEvaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('linkedin_access_token')}`, // Exemplo de como enviar o token
        },
        body: JSON.stringify(evaluationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao enviar avaliação.');
      }

      alert('Avaliação enviada com sucesso!');
      // Resetar formulário
      setContatoRH(0);
      setSalarioBeneficios(0);
      setOportunidadeCrescimento(0);
      setCulturaValores(0);
      setEstimulacaoOrganizacao(0);
      setCommentContatoRH('');
      setCommentSalarioBeneficios('');
      setCommentOportunidadeCrescimento('');
      setCommentCulturaValores('');
      setCommentEstimulacaoOrganizacao('');
      setGeneralComment('');
      setSelectedCompany('');
      setShowCommentInput({});
      // Atualizar lista de empresas ou ranking se necessário
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Definição do array campos *fora* do JSX de retorno
  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento, icon: <FaChartLine className="text-teal-500" /> },
    { label: "Cultura e Valores", value: culturaValores, set: setCulturaValores, comment: commentCulturaValores, setComment: setCommentCulturaValores, icon: <FaBuilding className="text-indigo-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* HEADER (DESKTOP) */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-8 mb-10 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-xl">
              <FaBuilding className="text-white text-4xl" />
              <p className="text-xs mt-1">Logo da Empresa</p>
            </div>
            <p className="text-4xl font-extrabold">0.0/5 NOTA</p>
          </div>

          <div className="text-center flex-grow">
            <h1 className="text-6xl font-extrabold mb-2" style={{ fontFamily: 'Azonix, sans-serif' }}>TRABALHEI LÁ</h1>
            <p className="text-xl mb-2">Sua opinião é anônima e ajuda outros profissionais</p>
            <p className="text-base mb-6">Avaliações anônimas feitas por profissionais verificados.</p>
            <button className="bg-white text-purple-700 font-bold py-4 px-8 rounded-full shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105">
              CLIQUE E SAIBA MAIS
            </button>
          </div>

          <div className="flex flex-col space-y-3 text-white font-semibold text-lg items-end">
            <div className="flex items-center gap-2">
              <span className="text-green-300 text-2xl">✓</span>
              <span>Avaliações Anônimas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-300 text-2xl">✓</span>
              <span>Dados Verificados</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-300 text-2xl">✓</span>
              <span>Comunidade Ativa</span>
            </div>
          </div>
        </header>

        <div className="flex gap-8">
          {/* COLUNA ESQUERDA - FORMULÁRIO */}
          <div className="flex-grow">
            <section className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-blue-100">
              <h2 className="text-3xl font-bold text-blue-800 text-center mb-8">Avalie uma Empresa</h2>

              {/* Botões de Login */}
              <div className="flex flex-col md:flex-row gap-4 mb-8 justify-center">
                <button className="flex items-center justify-center bg-red-600 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-red-700 transition-all transform hover:scale-105">
                  <FaGoogle className="mr-2" /> Entrar com Google
                </button>
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  redirectUri={linkedInRedirectUri}
                  onLoginSuccess={handleLinkedInLogin}
                  onLoginFailure={(error) => {
                    console.error('LinkedIn login failed:', error);
                    setError('Falha no login com LinkedIn. Tente novamente.');
                  }}
                  className="flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105"
                />
              </div>

              {/* Seleção de Empresa */}
              <div className="mb-6">
                <label htmlFor="company-select" className="text-slate-700 font-semibold text-lg block mb-2">
                  Selecione a Empresa
                </label>
                <select
                  id="company-select"
                  className="w-full p-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                >
                  <option value="">-- Selecione uma empresa --</option>
                  {empresas.map((emp, index) => (
                    <option key={index} value={emp.company}>
                      {emp.company}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                  className="mt-3 w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-600 transition-colors"
                >
                  {showAddNewCompany ? 'Cancelar' : 'Adicionar Nova Empresa'}
                </button>

                {showAddNewCompany && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-lg mb-3 text-blue-700">Detalhes da Nova Empresa</h3>
                    <input
                      type="text"
                      placeholder="Nome da Empresa"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Área de Atuação (Ex: Tecnologia)"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={newCompanyArea}
                      onChange={(e) => setNewCompanyArea(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Período de Trabalho (Ex: 2020-2023)"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={newCompanyPeriodo}
                      onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                    />
                    <textarea
                      placeholder="Descrição da Empresa (opcional)"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows="2"
                      value={newCompanyDescription}
                      onChange={(e) => setNewCompanyDescription(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCompany}
                      className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Adicionar Empresa
                    </button>
                  </div>
                )}
              </div>

              {/* Formulário de Avaliação */}
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 mb-6">
                  {campos.map((campo, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <label className="w-1/3 text-slate-700 font-semibold flex items-center gap-1 text-sm">
                        {campo.icon} {campo.label}
                      </label>
                      {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                    </div>
                  ))}
                </div>

                <div className="mb-5">
                  <label className="text-slate-700 font-semibold text-base block mb-2">Comentário Geral</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Deixe um comentário geral sobre a empresa (opcional)"
                    rows="3"
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  />
                </div>

                {error && <p className="text-red-500 text-center mb-3 text-sm">{error}</p>}

                <div className="text-center">
                  <button
                    type="submit"
                    className={`px-8 py-4 rounded-full font-extrabold text-white text-lg transition-all transform ${
                      isAuthenticated
                        ? "bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-2xl hover:scale-[1.02]"
                        : "bg-slate-400 cursor-not-allowed opacity-60"
                    }`}
                    disabled={!isAuthenticated || isLoading}
                  >
                    {isLoading ? "Enviando..." : isAuthenticated ? "Enviar avaliação" : "Faça login para avaliar"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* COLUNA DIREITA - RANKING */}
          <div className="w-80">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100 sticky top-6">
              <h2 className="text-xl font-bold text-blue-800 text-center mb-4">🏆 Ranking de Empresas</h2>

              {Array.isArray(top3) && top3.length > 0 && (
                <div className="mb-4 space-y-2">
                  {top3.map((emp, i) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={i} className={`bg-gradient-to-r ${getMedalColor(i)} rounded-2xl p-3 text-white`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getMedalEmoji(i)}</span>
                            <p className="font-bold text-sm">{emp.company}</p>
                          </div>
                          <div className="bg-white/20 px-2 py-1 rounded-full font-bold text-xs">{media} ⭐</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {Array.isArray(empresas) && empresas.length === 0 ? (
                  <div className="text-center py-6">
                    <FaChartBar className="text-gray-300 text-4xl mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Nenhuma avaliação ainda</p>
                  </div>
                ) : (
                  (empresas || []).slice(3).map((emp, i) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-all">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-gray-800 text-sm">{emp.company}</p>
                          <div className={`${getBadgeColor(media)} px-2 py-1 rounded-full text-white font-bold text-xs`}>{media} ⭐</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #1d4ed8, #3b82f6); border-radius: 10px; }
              `}</style>
            </div>
          </div>

        </div>

        <footer className="w-full px-6 py-8 text-center">
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-blue-100">
            <p className="text-slate-700 text-sm">
              <a href="/politica-de-privacidade.html" className="text-blue-700 hover:text-blue-900 font-extrabold underline">
                Política de Privacidade
              </a>
              {" • "}
              <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default TrabalheiLaDesktop;