// src/TrabalheiLaDesktop.js
import React, { useState } from 'react';
import { FaGoogle, FaHandshake, FaMoneyBillWave, FaChartLine, FaLightbulb, FaPlus, FaMinus, FaChartBar, FaBuilding, FaCheckCircle } from 'react-icons/fa';
import Select from 'react-select';
import LoginLinkedInButton from './components/LoginLinkedInButton';
import OutlinedStar from './components/OutlinedStar';

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

    const updatedEmpresas = empresas.map(emp =>
      emp.company === selectedCompany
        ? { ...emp, ratings: [...emp.ratings, newRating] }
        : emp
    );
    setEmpresas(updatedEmpresas);
    setTop3(updatedEmpresas.sort((a, b) => calcularMedia(b) - calcularMedia(a)).slice(0, 3));

    // Reset form
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

    setTimeout(() => {
      setIsLoading(false);
      alert('Avaliação enviada com sucesso!');
    }, 1000);
  };

  const companyOptions = empresas.map(emp => ({ value: emp.company, label: emp.company }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4 flex flex-col items-center">
      <div className="w-full max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-3xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full">
              <FaBuilding className="text-3xl" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold">TRABALHEI LÁ</h1>
              <p className="text-sm opacity-90">Sua opinião é anônima e ajuda outros profissionais</p>
            </div>
          </div>
          <div className="text-right md:text-left">
            <div className="flex items-center gap-2 mb-2">
              <FaCheckCircle className="text-green-300 text-xl" />
              <span className="font-semibold">Anônimo</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <FaCheckCircle className="text-green-300 text-xl" />
              <span className="font-semibold">Verificado</span>
            </div>
            <div className="flex items-center gap-2">
              <FaCheckCircle className="text-green-300 text-xl" />
              <span className="font-semibold">Confiável</span>
            </div>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* COLUNA ESQUERDA - FORMULÁRIO */}
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-xl p-8 border border-blue-100 mb-8 lg:mb-0">
            <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>

            {!isAuthenticated ? (
              <div className="mb-6 space-y-4">
                <LoginLinkedInButton
                  onLoginSuccess={() => setIsAuthenticated(true)}
                  onLoginFailure={(err) => setError(`Falha no login com LinkedIn: ${err.message}`)}
                  redirectUri={linkedInRedirectUri}
                  clientId={linkedInClientId}
                />
                <button
                  onClick={() => alert('Login com Google ainda não implementado.')}
                  className="flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3 px-4 rounded-full border border-gray-300 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <FcGoogle className="text-2xl" /> Entrar com Google
                </button>
              </div>
            ) : (
              <p className="text-center text-green-600 font-semibold mb-6">Você está logado! 🎉</p>
            )}

            <section className="mb-8">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="text-slate-700 font-semibold text-base block mb-2">Empresa que você trabalhou:</label>
                  <Select
                    options={companyOptions}
                    value={companyOptions.find(option => option.value === selectedCompany)}
                    onChange={(selectedOption) => setSelectedCompany(selectedOption ? selectedOption.value : '')}
                    placeholder="Selecione ou digite uma empresa"
                    isClearable
                    isSearchable
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '0.75rem', // rounded-xl
                        padding: '0.25rem', // p-1
                        borderColor: '#d1d5db', // border-gray-300
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: '#a78bfa', // focus:ring-purple-500
                        },
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected ? '#8b5cf6' : state.isFocused ? '#ede9fe' : null,
                        color: state.isSelected ? 'white' : '#1f2937',
                      }),
                    }}
                  />
                </div>

                <div className="text-center mb-6">
                  <button
                    type="button"
                    onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                    className="px-5 py-2 rounded-full font-extrabold text-white text-sm transition-all transform bg-gradient-to-r from-pink-500 to-red-500 hover:shadow-2xl hover:scale-[1.02]"
                  >
                    {showAddNewCompany ? "Cancelar" : "+ Adicionar Nova Empresa"}
                  </button>
                </div>

                {showAddNewCompany && (
                  <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 mb-6 space-y-4">
                    <h3 className="text-lg font-bold text-blue-700">Detalhes da Nova Empresa</h3>
                    <div>
                      <label className="text-slate-700 font-semibold text-sm block mb-1">Nome da Empresa</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Ex: Minha Empresa Inc."
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold text-sm block mb-1">Área de Atuação</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyArea}
                        onChange={(e) => setNewCompanyArea(e.target.value)}
                        placeholder="Ex: Tecnologia, Finanças, Varejo"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold text-sm block mb-1">Período Trabalhado</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyPeriodo}
                        onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                        placeholder="Ex: Jan/2020 - Dez/2023"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold text-sm block mb-1">Descrição da Empresa/Função</label>
                      <textarea
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyDescription}
                        onChange={(e) => setNewCompanyDescription(e.target.value)}
                        placeholder="Breve descrição da empresa ou sua função."
                        rows="3"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewCompany}
                      className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Adicionar Empresa
                    </button>
                  </div>
                )}

                <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">Sua Avaliação</h3>
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

          {/* COLUNA DIREITA - RANKING */}
          <div className="lg:col-span-1 bg-white rounded-3xl shadow-xl p-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">🏆 Ranking de Empresas</h2>

            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-6 space-y-4">
                {top3.map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={i} className={`bg-gradient-to-r ${getMedalColor(i)} rounded-2xl p-4 text-white`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getMedalEmoji(i)}</span>
                          <p className="font-bold text-lg">{emp.company}</p>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-full font-bold text-sm">{media} ⭐</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {Array.isArray(empresas) && empresas.length === 0 ? (
                <div className="text-center py-8">
                  <FaChartBar className="text-gray-300 text-5xl mx-auto mb-3" />
                  <p className="text-gray-500 text-lg">Nenhuma avaliação ainda</p>
                </div>
              ) : (
                (empresas || []).slice(3).map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-all">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-800 text-base">{emp.company}</p>
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

        {/* FOOTER */}
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