// src/TrabalheiLaDesktop.js
import React, { useState } from 'react';
import { FaGoogle, FaLinkedinIn, FaHandshake, FaMoneyBillWave, FaChartLine, FaLightbulb, FaPlus, FaMinus, FaChartBar, FaBuilding } from 'react-icons/fa';
import LoginLinkedInButton from './components/LoginLinkedInButton'; // Caminho corrigido
import OutlinedStar from './components/OutlinedStar'; // Caminho corrigido

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

  // Array de campos de avaliação definido fora do JSX de retorno
  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento, icon: <FaChartLine className="text-purple-500" /> },
    { label: "Cultura e Valores", value: culturaValores, set: setCulturaValores, comment: commentCulturaValores, setComment: setCommentCulturaValores, icon: <FaBuilding className="text-red-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!isAuthenticated) {
      setError("Você precisa estar logado para enviar uma avaliação.");
      setIsLoading(false);
      return;
    }

    if (!selectedCompany && !newCompanyName) {
      setError("Por favor, selecione uma empresa ou adicione uma nova.");
      setIsLoading(false);
      return;
    }

    const companyToEvaluate = selectedCompany || newCompanyName;

    const newEvaluation = {
      company: companyToEvaluate,
      area: newCompanyArea,
      periodo: newCompanyPeriodo,
      description: newCompanyDescription,
      ratings: {
        contatoRH,
        salarioBeneficios,
        oportunidadeCrescimento,
        culturaValores,
        estimulacaoOrganizacao,
      },
      comments: {
        contatoRH: commentContatoRH,
        salarioBeneficios: commentSalarioBeneficios,
        oportunidadeCrescimento: commentOportunidadeCrescimento,
        culturaValores: commentCulturaValores,
        estimulacaoOrganizacao: commentEstimulacaoOrganizacao,
        general: generalComment,
      },
      user: "linkedin_user_id_placeholder", // Substituir com o ID real do usuário logado
    };

    try {
      // Simulação de envio para um backend
      console.log("Avaliação enviada:", newEvaluation);
      alert("Avaliação enviada com sucesso!");

      // Resetar formulário
      setSelectedCompany('');
      setNewCompanyName('');
      setNewCompanyArea('');
      setNewCompanyPeriodo('');
      setNewCompanyDescription('');
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
      setShowAddNewCompany(false);
      setShowCommentInput({});

      // Atualizar lista de empresas (simulado)
      const updatedEmpresas = [...empresas, { company: companyToEvaluate, media: calcularMedia(newEvaluation.ratings) }];
      setEmpresas(updatedEmpresas);
      setTop3(updatedEmpresas.sort((a, b) => b.media - a.media).slice(0, 3));

    } catch (err) {
      setError("Erro ao enviar avaliação. Tente novamente.");
      console.error("Erro ao enviar avaliação:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewCompany = () => {
    setShowAddNewCompany(true);
    setSelectedCompany(''); // Limpa a seleção se for adicionar nova
  };

  const companyOptions = empresas.map(emp => ({ value: emp.company, label: emp.company }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* HEADER (DESKTOP) */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-b-3xl shadow-2xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            {/* Logo e Nota */}
            <div className="flex items-center">
              <div className="bg-white/20 p-4 rounded-xl mr-4">
                <FaBuilding className="text-white text-4xl" />
                <p className="text-xs mt-1">Logo da Empresa</p>
              </div>
              <div>
                <h1 className="text-5xl font-extrabold font-azonix mb-2">TRABALHEI LÁ</h1>
                <p className="text-lg">Sua opinião é anônima e ajuda outros profissionais.</p>
              </div>
            </div>

            {/* Ícones de Benefícios */}
            <div className="flex flex-col items-end space-y-2">
              <div className="flex items-center text-white text-lg font-semibold">
                <FaCheckCircle className="text-green-300 mr-2" /> Avaliações anônimas
              </div>
              <div className="flex items-center text-white text-lg font-semibold">
                <FaCheckCircle className="text-green-300 mr-2" /> Dados reais
              </div>
              <div className="flex items-center text-white text-lg font-semibold">
                <FaCheckCircle className="text-green-300 mr-2" /> Comunidade engajada
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {/* SEÇÃO DE LOGIN */}
          <section className="bg-white rounded-3xl shadow-xl p-6 mb-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Faça login para avaliar</h2>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <LoginLinkedInButton
                clientId={linkedInClientId}
                redirectUri={linkedInRedirectUri}
                onLoginSuccess={handleLinkedInLogin}
                onLoginFailure={(error) => console.error("LinkedIn Login Failed:", error)}
                className="flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105"
              >
                <FaLinkedinIn className="mr-2 text-xl" /> Login com LinkedIn
              </LoginLinkedInButton>

              <button
                onClick={() => console.log("Login com Google clicado")}
                className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105"
              >
                <FaGoogle className="mr-2 text-xl" /> Login com Google
              </button>
            </div>
          </section>

          {/* SEÇÃO DE AVALIAÇÃO */}
          <section className="bg-white rounded-3xl shadow-xl p-6 mb-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="text-slate-700 font-semibold text-base block mb-2">Selecione a Empresa</label>
                <Select
                  options={companyOptions}
                  value={companyOptions.find(option => option.value === selectedCompany)}
                  onChange={(option) => setSelectedCompany(option ? option.value : '')}
                  placeholder="Buscar ou selecionar empresa..."
                  isClearable
                  className="basic-single"
                  classNamePrefix="select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem', // rounded-xl
                      padding: '0.25rem', // p-1
                      borderColor: '#d1d5db', // border-gray-300
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#a78bfa' }, // hover:border-purple-400
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#8b5cf6' : state.isFocused ? '#ede9fe' : null, // purple-600 / purple-100
                      color: state.isSelected ? 'white' : '#4b5563', // text-gray-700
                    }),
                  }}
                />
              </div>

              <div className="text-center mb-6">
                <button
                  type="button"
                  onClick={handleAddNewCompany}
                  className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 transition-colors text-sm"
                >
                  Adicionar Nova Empresa
                </button>
              </div>

              {showAddNewCompany && (
                <div className="bg-blue-50 p-5 rounded-xl mb-6 border border-blue-200">
                  <h3 className="text-lg font-bold text-blue-800 mb-4">Detalhes da Nova Empresa</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-700 text-sm font-semibold mb-1">Nome da Empresa</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Ex: Minha Empresa Inc."
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-sm font-semibold mb-1">Área de Atuação</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyArea}
                        onChange={(e) => setNewCompanyArea(e.target.value)}
                        placeholder="Ex: Tecnologia, Finanças, Saúde"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-sm font-semibold mb-1">Período Trabalhado</label>
                      <input
                        type="text"
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyPeriodo}
                        onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                        placeholder="Ex: Jan/2020 - Dez/2023"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 text-sm font-semibold mb-1">Descrição (Opcional)</label>
                      <textarea
                        className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCompanyDescription}
                        onChange={(e) => setNewCompanyDescription(e.target.value)}
                        placeholder="Breve descrição da empresa ou sua função."
                        rows="3"
                      />
                    </div>
                  </div>
                </div>
              )}

              <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">Sua Avaliação</h3>
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
                  className={`px-6 py-3 rounded-full font-extrabold text-white text-base transition-all transform ${
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

          {/* SEÇÃO DE RANKING */}
          <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">🏆 Melhores Empresas</h2>

            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={i} className={`bg-gradient-to-r ${getMedalColor(i)} rounded-2xl p-4 text-white flex flex-col items-center justify-center text-center`}>
                      <span className="text-4xl mb-2">{getMedalEmoji(i)}</span>
                      <p className="font-bold text-lg mb-1">{emp.company}</p>
                      <div className="bg-white/20 px-3 py-1 rounded-full font-bold text-sm">{media} ⭐</div>
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
              .custom-scrollbar::-webkit-scrollbar { width: 8px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #1d4ed8, #3b82f6); border-radius: 10px; }
            `}</style>
          </section>
        </div>

        {/* FOOTER */}
        <footer className="w-full px-8 py-10 text-center">
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-blue-100">
            <p className="text-slate-700 text-base">
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