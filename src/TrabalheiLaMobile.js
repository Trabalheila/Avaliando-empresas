// src/TrabalheiLaMobile.js
import React, { useState } from 'react';
import { FaHandshake, FaMoneyBillWave, FaChartLine, FaLightbulb, FaPlus, FaMinus, FaChartBar, FaBuilding, FaCheckCircle } from 'react-icons/fa';
import Select from 'react-select';
import LoginLinkedInButton from './components/LoginLinkedInButton';
import OutlinedStar from './components/OutlinedStar'; // Importa o componente OutlinedStar

function TrabalheiLaMobile({
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
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={`Comentário para ${label}`}
                value={currentComment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento, icon: <FaChartLine className="text-purple-500" /> },
    { label: "Cultura e Valores", value: culturaValores, set: setCulturaValores, comment: commentCulturaValores, setComment: setCommentCulturaValores, icon: <FaBuilding className="text-yellow-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

  const handleAddNewCompany = () => {
    if (newCompanyName && newCompanyArea && newCompanyPeriodo && newCompanyDescription) {
      const newCompany = {
        id: empresas.length + 1,
        company: newCompanyName,
        area: newCompanyArea,
        periodo: newCompanyPeriodo,
        description: newCompanyDescription,
        ratings: [],
      };
      setEmpresas([...empresas, newCompany]);
      setSelectedCompany(newCompany.company);
      setNewCompanyName('');
      setNewCompanyArea('');
      setNewCompanyPeriodo('');
      setNewCompanyDescription('');
      setShowAddNewCompany(false);
      setError('');
    } else {
      setError('Por favor, preencha todos os campos da nova empresa.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError('Você precisa fazer login para enviar uma avaliação.');
      return;
    }
    if (!selectedCompany) {
      setError('Por favor, selecione ou adicione uma empresa.');
      return;
    }

    setIsLoading(true);
    setError('');

    const newRating = {
      company: selectedCompany,
      contatoRH,
      commentContatoRH,
      salarioBeneficios,
      commentSalarioBeneficios,
      oportunidadeCrescimento,
      commentOportunidadeCrescimento,
      culturaValores,
      commentCulturaValores,
      estimulacaoOrganizacao,
      commentEstimulacaoOrganizacao,
      generalComment,
      timestamp: new Date().toISOString(),
    };

    console.log('Avaliação enviada:', newRating);

    setEmpresas(prevEmpresas => {
      const updatedEmpresas = prevEmpresas.map(emp => {
        if (emp.company === selectedCompany) {
          return {
            ...emp,
            ratings: [...(emp.ratings || []), newRating]
          };
        }
        return emp;
      });
      return updatedEmpresas;
    });

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
    setIsLoading(false);
    alert('Avaliação enviada com sucesso!');
  };

  const companyOptions = empresas.map(emp => ({ value: emp.company, label: emp.company }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col items-center py-8 px-4">
      <div className="max-w-4xl w-full space-y-8">

        {/* HEADER (ADAPTADO PARA MOBILE) */}
        <header className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 mb-6 text-white flex flex-col items-center text-center">
          {/* Logo e Nota */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="bg-white/20 p-2 rounded-xl flex flex-col items-center justify-center text-purple-100">
              <FaBuilding size={20} />
              <span className="text-xs mt-1">Logo da Empresa</span>
            </div>
            <div>
              <p className="text-3xl font-extrabold font-azonix">TRABALHEI LÁ</p>
              <p className="text-sm mt-1">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-xs opacity-80">Avaliações anônimas feitas por profissionais verificados.</p>
            </div>
          </div>

          {/* Botão e Checkmarks */}
          <div className="flex flex-col items-center gap-2">
            <button className="bg-white text-purple-700 font-bold py-2 px-4 rounded-full shadow-lg hover:scale-105 transition-transform text-sm">
              CLIQUE E SAIBA MAIS
            </button>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-300" /> Anônimo</span>
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-300" /> Verificado</span>
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-300" /> Confiável</span>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="space-y-6"> {/* Ajustado para mobile */}

          {/* SEÇÃO DE AVALIAÇÃO */}
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
            <section className="mb-6">
              <h2 className="text-xl font-bold text-blue-800 text-center mb-4">Avalie uma Empresa</h2>

              {!isAuthenticated ? (
                <div className="space-y-3 mb-5">
                  <LoginLinkedInButton
                    onLoginSuccess={(userData) => {
                      console.log('Login LinkedIn bem-sucedido:', userData);
                      setIsAuthenticated(true);
                      setError('');
                    }}
                    onLoginFailure={(err) => {
                      console.error('Login LinkedIn falhou:', err);
                      setError('Falha no login com LinkedIn. Tente novamente.');
                      setIsAuthenticated(false);
                    }}
                    redirectUri={linkedInRedirectUri}
                    clientId={linkedInClientId}
                  />
                </div>
              ) : (
                <p className="text-green-600 font-semibold text-center mb-5">✓ Você está autenticado!</p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="font-semibold text-slate-700 mb-2 block">Selecione a Empresa</label>
                  <Select
                    options={companyOptions}
                    value={companyOptions.find(option => option.value === selectedCompany)}
                    onChange={(option) => setSelectedCompany(option ? option.value : '')}
                    placeholder="Buscar ou selecionar empresa..."
                    isClearable
                  />
                </div>

                <button type="button" onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow transition-all">
                  <FaPlus />
                  {showAddNewCompany ? "Cancelar" : "Adicionar Nova Empresa"}
                </button>

                {showAddNewCompany && (
                  <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <input type="text"
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Nome da nova empresa"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                    />
                    <input type="text"
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Área de atuação"
                      value={newCompanyArea}
                      onChange={(e) => setNewCompanyArea(e.target.value)}
                    />
                    <input type="text"
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Período de trabalho"
                      value={newCompanyPeriodo}
                      onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                    />
                    <textarea
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Descrição da empresa"
                      rows="2"
                      value={newCompanyDescription}
                      onChange={(e) => setNewCompanyDescription(e.target.value)}
                    />
                    <button type="button" onClick={handleAddNewCompany}
                      className="w-full px-4 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all">
                      Adicionar Empresa
                    </button>
                  </div>
                )}

                {campos.map((campo, idx) => (
                  <div key={idx} className="flex flex-col items-start justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="w-full text-slate-700 font-semibold flex items-center gap-2 mb-2">
                      {campo.icon} {campo.label}
                    </label>
                    {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                  </div>
                ))}

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="text-slate-700 font-semibold text-lg block mb-2">Comentário Geral</label>
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