// src/TrabalheiLaMobile.js
import React, { useState } from 'react';
import { FaGoogle, FaLinkedinIn, FaHandshake, FaMoneyBillWave, FaChartLine, FaLightbulb, FaPlus, FaMinus, FaChartBar, FaBuilding, FaCheckCircle } from 'react-icons/fa';
import LoginLinkedInButton from './components/LoginLinkedInButton'; // Caminho corrigido
import OutlinedStar from './components/OutlinedStar'; // Caminho corrigido

function TrabalheiLaMobile({
  empresas,
  setEmpresas,
  top3,
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

  // Array de campos de avaliação definido fora do JSX de retorno
  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento, icon: <FaChartLine className="text-purple-500" /> },
    { label: "Cultura e Valores", value: culturaValores, set: setCulturaValores, comment: commentCulturaValores, setComment: setCommentCulturaValores, icon: <FaBuilding className="text-red-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

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

      const data = await response.json();
      if (response.ok) {
        setEmpresas(prev => [...prev, data.newCompany]);
        setSelectedCompany({ value: data.newCompany.company, label: data.newCompany.company });
        setNewCompanyName('');
        setNewCompanyArea('');
        setNewCompanyPeriodo('');
        setNewCompanyDescription('');
        setShowAddNewCompany(false);
      } else {
        setError(data.message || 'Erro ao adicionar nova empresa.');
      }
    } catch (err) {
      setError('Erro de rede ao adicionar nova empresa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCompany) {
      setError('Por favor, selecione uma empresa para avaliar.');
      return;
    }
    setIsLoading(true);
    setError('');

    const evaluationData = {
      company: selectedCompany.value,
      ratings: {
        contatoRH,
        salarioBeneficios,
        oportunidadeCrescimento,
        culturaValores,
        estimulacaoOrganizacao,
      },
      comments: {
        commentContatoRH,
        commentSalarioBeneficios,
        commentOportunidadeCrescimento,
        commentCulturaValores,
        commentEstimulacaoOrganizacao,
        generalComment,
      },
    };

    try {
      const response = await fetch('/api/submitEvaluation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evaluationData),
      });

      const data = await response.json();
      if (response.ok) {
        alert('Avaliação enviada com sucesso!');
        // Resetar formulário
        setSelectedCompany(null);
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
        setShowCommentInput({});
        // Atualizar lista de empresas ou ranking se necessário
      } else {
        setError(data.message || 'Erro ao enviar avaliação.');
      }
    } catch (err) {
      setError('Erro de rede ao enviar avaliação.');
    } finally {
      setIsLoading(false);
    }
  };

  const companyOptions = empresas.map(emp => ({ value: emp.company, label: emp.company }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-md mx-auto"> {/* Max-width ajustado para mobile */}

        {/* HEADER (ADAPTADO DO DESKTOP PARA MOBILE) */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 mb-6 text-white">
          <div className="flex flex-col items-center text-center"> {/* flex-col para mobile */}
            <div className="flex items-center justify-center mb-4"> {/* Centered logo/score */}
              <div className="bg-white/20 p-3 rounded-xl mr-3">
                <FaBuilding className="text-white text-3xl" />
                <p className="text-xs mt-1">Logo da Empresa</p>
              </div>
              <p className="text-3xl font-extrabold">0.0/5 NOTA</p>
            </div>

            <h1 className="text-4xl font-extrabold mb-2 font-azonix">TRABALHEI LÁ</h1>
            <p className="text-lg mb-2">Sua opinião é anônima e ajuda outros profissionais</p>
            <p className="text-sm mb-4">Avaliações anônimas feitas por profissionais verificados.</p>

            <div className="flex flex-col gap-2 mb-4"> {/* flex-col para os checks no mobile */}
              <span className="flex items-center justify-center text-sm font-semibold"><FaCheckCircle className="text-green-300 mr-1" /> Anônimo</span>
              <span className="flex items-center justify-center text-sm font-semibold"><FaCheckCircle className="text-green-300 mr-1" /> Verificado</span>
              <span className="flex items-center justify-center text-sm font-semibold"><FaCheckCircle className="text-green-300 mr-1" /> Confiável</span>
            </div>

            <button className="bg-white text-purple-700 font-bold py-3 px-6 rounded-full shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105">
              CLIQUE E SAIBA MAIS
            </button>
          </div>
        </header>

        <div className="space-y-6">
          {/* SEÇÃO PRINCIPAL DE AVALIAÇÃO (MOBILE) */}
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
            <section className="mb-6">
              <h2 className="text-2xl font-bold text-blue-800 mb-5 text-center">Avalie uma Empresa</h2>

              {/* Login para Avaliar */}
              <div className="mb-6 p-5 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                <h3 className="text-lg font-semibold text-blue-700 mb-3">Login para Avaliar</h3>
                <div className="flex flex-col gap-3">
                  <LoginLinkedInButton
                    clientId={linkedInClientId}
                    redirectUri={linkedInRedirectUri}
                    onLoginSuccess={handleLinkedInLogin}
                    onLoginFailure={(err) => setError(`Erro no login com LinkedIn: ${err.message}`)}
                    className="flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-5 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105 text-sm"
                  />
                  <button
                    // onClick={handleGoogleLogin} // Descomente se tiver a função handleGoogleLogin
                    className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-5 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105 text-sm"
                  >
                    <FaGoogle className="mr-2 text-lg" /> Entrar com Google
                  </button>
                </div>
              </div>

              {/* Seleção de Empresa */}
              <div className="mb-6">
                <label className="text-slate-700 font-semibold text-base block mb-2">Empresa que você trabalhou:</label>
                <Select
                  options={companyOptions}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  placeholder="Selecione ou digite uma empresa..."
                  isClearable
                  className="mb-3"
                />
                {!selectedCompany && (
                  <button
                    type="button"
                    onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                    className="w-full bg-purple-600 text-white font-bold py-2 px-5 rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <FaPlus /> Adicionar Nova Empresa
                  </button>
                )}
              </div>

              {/* Formulário para Adicionar Nova Empresa */}
              {showAddNewCompany && (
                <div className="mb-6 p-5 bg-purple-50 rounded-2xl border border-purple-100">
                  <h3 className="text-lg font-semibold text-purple-700 mb-3">Adicionar Nova Empresa</h3>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Nome da Empresa"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Área de Atuação (Ex: Tecnologia, Finanças)"
                    value={newCompanyArea}
                    onChange={(e) => setNewCompanyArea(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-xl mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Período de Trabalho (Ex: 2020-2023)"
                    value={newCompanyPeriodo}
                    onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                    required
                  />
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Descrição da Empresa (opcional)"
                    rows="3"
                    value={newCompanyDescription}
                    onChange={(e) => setNewCompanyDescription(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleAddNewCompany}
                    className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 transition-colors text-sm"
                  >
                    Adicionar Empresa
                  </button>
                </div>
              )}

              {/* Formulário de Avaliação */}
              <form onSubmit={handleSubmit}>
                <div className="space-y-3 mb-5">
                  {campos.map((campo, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <label className="w-1/3 text-slate-700 font-semibold flex items-center gap-1 text-xs">
                        {campo.icon} {campo.label}
                      </label>
                      {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                    </div>
                  ))}
                </div>

                <div className="mb-4">
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
                    className={`px-5 py-2 rounded-full font-extrabold text-white text-sm transition-all transform ${
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

          {/* SEÇÃO DE RANKING (MOBILE) */}
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
            <h2 className="text-xl font-bold text-blue-800 text-center mb-4">🏆 Melhores Empresas</h2>

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
              .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #8b5cf6, #ec4899); border-radius: 10px; }
            `}</style>
          </div>

        </div>

        {/* FOOTER */}
        <footer className="mb-6 text-center">
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

export default TrabalheiLaMobile;