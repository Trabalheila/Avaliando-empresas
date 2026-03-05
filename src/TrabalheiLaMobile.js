// src/TrabalheiLaMobile.js
import React, { useState, useEffect } from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaMinus, FaCheckCircle
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar"; // Caminho corrigido

function TrabalheiLaMobile({
  empresas,
  setEmpresas,
  top3,
  setTop3,
  isAuthenticated,
  setIsAuthenticated,
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

  // useEffect para lidar com o callback do LinkedIn
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state'); // Se você estiver usando o parâmetro 'state'

    if (code) {
      // Aqui você enviaria o 'code' para o seu backend para trocar por um token de acesso
      // Por enquanto, vamos apenas simular o login
      console.log("Código de autorização do LinkedIn:", code);
      // Limpa a URL para remover o código de autorização
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticated(true); // Simula que o usuário está autenticado
      setError(''); // Limpa qualquer erro anterior
    }
  }, [setIsAuthenticated]);

  const companyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

  const handleAddNewCompany = () => {
    if (newCompanyName && newCompanyArea && newCompanyPeriodo && newCompanyDescription) {
      const newCompany = {
        company: newCompanyName,
        area: newCompanyArea,
        periodo: newCompanyPeriodo,
        description: newCompanyDescription,
        avaliacoes: [],
      };
      setEmpresas([...empresas, newCompany]);
      setSelectedCompany(newCompanyName);
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

  const renderStars = (currentValue, setter, commentValue, commentSetter, label) => (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <OutlinedStar
            key={star}
            active={star <= currentValue}
            onClick={() => {
              setter(star);
              setShowCommentInput((prev) => ({ ...prev, [label]: true }));
            }}
            size={20}
          />
        ))}
        <span className="ml-2 text-sm font-bold text-gray-700">{currentValue}</span>
      </div>
      {showCommentInput[label] && (
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
          rows="2"
          placeholder={`Comentário sobre ${label.toLowerCase()} (opcional)...`}
          value={commentValue}
          onChange={(e) => commentSetter(e.target.value)}
        />
      )}
    </div>
  );

  const campos = [
    { icon: <FaHandshake />, label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH },
    { icon: <FaMoneyBillWave />, label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios },
    { icon: <FaBriefcase />, label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento },
    { icon: <FaHeart />, label: "Cultura e Valores", value: culturaValores, set: setCulturaValores, comment: commentCulturaValores, setComment: setCommentCulturaValores },
    { icon: <FaLightbulb />, label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError("Você precisa estar logado para enviar uma avaliação.");
      return;
    }
    if (!selectedCompany) {
      setError("Por favor, selecione uma empresa para avaliar.");
      return;
    }

    setIsLoading(true);
    setError('');

    const novaAvaliacao = {
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
      timestamp: new Date().toISOString(),
    };

    setEmpresas((prevEmpresas) =>
      prevEmpresas.map((emp) =>
        emp.company === selectedCompany
          ? { ...emp, avaliacoes: [...(emp.avaliacoes || []), novaAvaliacao] }
          : emp
      )
    );

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
    setIsLoading(false);
    setShowCommentInput({}); // Resetar visibilidade dos comentários
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-md mx-auto">

        {/* HEADER */}
        <header className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/trofeu-new.png"
              alt="Logo Trabalhei Lá"
              className="h-10 w-10"
            />
            <h1 className="text-2xl font-extrabold tracking-tight">
              Trabalhei Lá
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">4.8 ⭐</span>
            <FaCheckCircle className="text-green-300 text-2xl" />
          </div>
        </header>

        {/* ERRO */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* FORM */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4">
            Avalie uma Empresa
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <Select
                options={companyOptions}
                value={companyOptions.find(
                  (option) => option.value === selectedCompany
                )}
                onChange={(option) =>
                  setSelectedCompany(option ? option.value : "")
                }
                placeholder="Buscar empresa..."
                isClearable
              />
            </div>

            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1"
              >
                {showAddNewCompany ? <FaMinus /> : <FaPlus />} Adicionar Nova Empresa
              </button>
            </div>

            {showAddNewCompany && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-5">
                <h3 className="text-lg font-bold text-blue-700 mb-3">Nova Empresa</h3>
                <div className="mb-2">
                  <label className="text-slate-700 font-semibold text-sm block mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Nome completo da empresa"
                  />
                </div>
                <div className="mb-2">
                  <label className="text-slate-700 font-semibold text-sm block mb-1">Área de Atuação</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={newCompanyArea}
                    onChange={(e) => setNewCompanyArea(e.target.value)}
                    placeholder="Ex: Tecnologia, Finanças, Saúde"
                  />
                </div>
                <div className="mb-2">
                  <label className="text-slate-700 font-semibold text-sm block mb-1">Período Trabalhado</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={newCompanyPeriodo}
                    onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                    placeholder="Ex: Jan/2020 - Dez/2022"
                  />
                </div>
                <div className="mb-2">
                  <label className="text-slate-700 font-semibold text-sm block mb-1">Descrição da Empresa</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows="3"
                    value={newCompanyDescription}
                    onChange={(e) => setNewCompanyDescription(e.target.value)}
                    placeholder="Breve descrição da empresa e sua experiência nela"
                  />
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleAddNewCompany}
                    className="bg-green-500 text-white font-bold py-2 px-3 rounded-full hover:bg-green-600 transition-colors text-sm"
                  >
                    Adicionar Empresa
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-4">
              {campos.map((campo, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <label className="text-slate-700 font-semibold text-sm flex items-center gap-2 mb-1">
                    {campo.icon} {campo.label}
                  </label>
                  {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-slate-700 font-semibold text-sm block mb-1">Comentário Geral (Opcional):</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows="3"
                placeholder="Compartilhe sua experiência geral na empresa..."
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />
            </div>

            <div className="text-center">
              <button
                type="submit"
                className={`w-full py-2 px-4 rounded-full font-extrabold text-white text-base transition-all transform ${
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

        {/* SEÇÃO DE LOGIN */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4">
            Login para Avaliar
          </h2>
          <div className="flex flex-col space-y-3">
            <LoginLinkedInButton
              clientId={linkedInClientId}
              redirectUri={linkedInRedirectUri}
            />
          </div>
        </section>

        {/* SEÇÃO DE RANKING */}
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