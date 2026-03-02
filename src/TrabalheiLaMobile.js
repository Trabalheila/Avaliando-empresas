// src/TrabalheiLaMobile.js
import React, { useState } from 'react';
import { FaHandshake, FaMoneyBillWave, FaChartBar, FaLightbulb, FaPlus, FaMinus, FaBuilding, FaCheckCircle } from 'react-icons/fa';
import Select from 'react-select';
import LoginLinkedInButton from './components/LoginLinkedInButton';
import OutlinedStar from './components/OutlinedStar';

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
    { label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento, icon: <FaChartBar className="text-purple-500" /> },
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

    // Lógica para enviar a avaliação para o backend
    console.log('Avaliação enviada:', newRating);

    // Atualiza o estado local das empresas (simulação)
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
    setIsLoading(false);
    alert('Avaliação enviada com sucesso!');
  };

  const companyOptions = empresas.map(emp => ({ value: emp.company, label: emp.company }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col items-center py-8 px-4">
      <div className="max-w-4xl w-full space-y-8">

        {/* HEADER (ADAPTADO PARA MOBILE - LAYOUT ORIGINAL, SEM GOOGLE) */}
        <header className="bg-white rounded-3xl shadow-xl p-6 mb-6 text-blue-800 flex flex-col items-center text-center">
          {/* Logo e Nota */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="bg-blue-100 p-2 rounded-xl flex flex-col items-center justify-center text-blue-600">
              <FaBuilding size={20} />
              <span className="text-xs mt-1">Logo da Empresa</span>
            </div>
            <div>
              <p className="text-3xl font-extrabold">TRABALHEI LÁ</p>
              <p className="text-sm mt-1">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-xs opacity-80">Avaliações anônimas feitas por profissionais verificados.</p>
            </div>
          </div>

          {/* Botão e Checkmarks */}
          <div className="flex flex-col items-center gap-2">
            <button className="bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:scale-105 transition-transform text-sm">
              CLIQUE E SAIBA MAIS
            </button>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-blue-700">
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Anônimo</span>
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Verificado</span>
              <span className="flex items-center gap-1"><FaCheckCircle className="text-green-500" /> Confiável</span>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="space-y-6">

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
                  {/* Botão do Google removido conforme solicitado */}
                </div>
              ) : (
                <div className="text-center mb-5">
                  <p className="text-lg font-semibold text-green-600">Você está logado!</p>
                  <button
                    onClick={() => setIsAuthenticated(false)}
                    className="text-blue-600 hover:underline text-sm mt-1"
                  >
                    Sair
                  </button>
                </div>
              )}

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
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '0.75rem', // rounded-xl
                        padding: '0.25rem', // p-1
                        borderColor: '#d1d5db', // border-gray-300
                        '&:hover': { borderColor: '#a78bfa' }, // focus:ring-purple-500
                        boxShadow: 'none',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? '#ede9fe' : 'white', // bg-purple-100
                        color: '#4a4a4a',
                      }),
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                  className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-600 transition-colors mb-5 flex items-center justify-center gap-2"
                >
                  {showAddNewCompany ? <FaMinus /> : <FaPlus />} Adicionar Nova Empresa
                </button>

                {showAddNewCompany && (
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 mb-6 space-y-4">
                    <h3 className="text-lg font-bold text-blue-700 mb-3">Detalhes da Nova Empresa</h3>
                    <div>
                      <label className="text-slate-700 font-semibold text-base block mb-1">Nome da Empresa:</label>
                      <input
                        type="text"
                        className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Ex: Minha Empresa Inc."
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold text-base block mb-1">Área de Atuação:</label>
                      <input
                        type="text"
                        className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyArea}
                        onChange={(e) => setNewCompanyArea(e.target.value)}
                        placeholder="Ex: Tecnologia, Finanças"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold text-base block mb-1">Período Trabalhado:</label>
                      <input
                        type="text"
                        className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyPeriodo}
                        onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                        placeholder="Ex: Jan/2020 - Dez/2023"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-semibold text-base block mb-1">Descrição (Opcional):</label>
                      <textarea
                        className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        value={newCompanyDescription}
                        onChange={(e) => setNewCompanyDescription(e.target.value)}
                        placeholder="Breve descrição da empresa ou sua função..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddNewCompany}
                      className="w-full bg-green-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-green-600 transition-colors text-base"
                    >
                      Adicionar Empresa
                    </button>
                  </div>
                )}

                {error && <p className="text-red-500 text-center mb-4 font-semibold">{error}</p>}

                <div className="space-y-5 mb-6">
                  {campos.map((campo, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <label className="text-slate-700 font-semibold text-base flex items-center gap-2 mb-2">
                        {campo.icon} {campo.label}:
                      </label>
                      {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="text-slate-700 font-semibold text-base block mb-2">Comentário Geral (Opcional):</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows="4"
                    placeholder="Compartilhe sua experiência geral na empresa..."
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  />
                </div>

                <div className="text-center">
                  <button
                    type="submit"
                    className={`w-full py-3 px-6 rounded-full font-extrabold text-white text-lg transition-all transform ${
                      isAuthenticated
                        ? "bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-2xl hover:scale-[1.02]"
                        : "bg-slate-400 cursor-not-allowed opacity-60"
                    }`}
                    disabled={!isAuthenticated || isLoading}
                  >
                    {isLoading ? "Enviando..." : isAuthenticated ? "Faça login para avaliar" : "Faça login para avaliar"}
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