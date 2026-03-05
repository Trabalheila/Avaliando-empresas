// src/TrabalheiLaMobile.js
import React, { useState, useEffect } from "react";
import {
  FaChartBar, FaHandshake, FaMoneyBillWave, FaLightbulb, FaPlus, FaMinus, FaCheckCircle, FaStar, FaHeart, FaBriefcase
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar";

function TrabalheiLaMobile({
  empresas = [],
  setEmpresas,
  top3 = [],
  setTop3, // setTop3 é um prop, usado para atualizar o estado top3 no componente pai
  isAuthenticated,
  setIsAuthenticated,
  linkedInClientId,
  linkedInRedirectUri,
  calcularMedia,
  getBadgeColor,
  getMedalColor,
  getMedalEmoji,
}) {
  const [selectedCompany, setSelectedCompany] = useState(null);
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
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState(''); // Corrigido o nome do setter
  const [generalComment, setGeneralComment] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState({});
  const [showAddNewCompany, setShowAddNewCompany] = useState(false);

  // useEffect para lidar com o redirecionamento do LinkedIn
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      console.log("LinkedIn code received:", code);
      setIsAuthenticated(true); // Simula autenticação bem-sucedida
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setIsAuthenticated]);

  const companyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
    data: emp,
  }));

  const handleCompanyChange = (option) => {
    setSelectedCompany(option);
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
  };

  const handleAddNewCompany = () => {
    if (newCompanyName && newCompanyArea && newCompanyPeriodo && newCompanyDescription) {
      const newCompany = {
        company: newCompanyName,
        area: newCompanyArea,
        periodo: newCompanyPeriodo,
        description: newCompanyDescription,
        ratings: [],
      };
      setEmpresas((prev) => [...prev, newCompany]);
      setNewCompanyName('');
      setNewCompanyArea('');
      setNewCompanyPeriodo('');
      setNewCompanyDescription('');
      setShowAddNewCompany(false);
    } else {
      setError("Por favor, preencha todos os campos da nova empresa.");
    }
  };

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

    const newRating = {
      company: selectedCompany.value,
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

    setTimeout(() => {
      setEmpresas((prevEmpresas) =>
        prevEmpresas.map((emp) =>
          emp.company === selectedCompany.value
            ? { ...emp, ratings: [...emp.ratings, newRating] }
            : emp
        )
      );
      // Atualiza o top3 (simplificado)
      const updatedEmpresas = empresas.map((emp) =>
        emp.company === selectedCompany.value
          ? { ...emp, ratings: [...emp.ratings, newRating] }
          : emp
      );
      const sorted = [...updatedEmpresas].sort((a, b) => calcularMedia(b) - calcularMedia(a));
      setTop3(sorted.slice(0, 3)); // Usa setTop3 que é um prop

      setIsLoading(false);
      alert("Avaliação enviada com sucesso!");
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
    }, 1500);
  };

  const renderStars = (value, setter, commentValue, commentSetter, label) => (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 mb-1">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className="cursor-pointer text-xl"
            onClick={() => setter(i + 1)}
          >
            {i < value ? <FaStar className="text-yellow-400" /> : <OutlinedStar className="text-gray-300" />}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setShowCommentInput(prev => ({ ...prev, [label]: !prev[label] }))}
          className="ml-2 text-blue-500 hover:text-blue-700 text-xs font-semibold"
        >
          {showCommentInput[label] ? <FaMinus /> : <FaPlus />} Comentário
        </button>
      </div>
      {showCommentInput[label] && (
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
          rows="2"
          placeholder={`Seu comentário sobre ${label.toLowerCase()}...`}
          value={commentValue}
          onChange={(e) => commentSetter(e.target.value)}
        />
      )}
    </div>
  );

  const campos = [
    { label: "Contato com RH", icon: <FaHandshake />, value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH },
    { label: "Salário e Benefícios", icon: <FaMoneyBillWave />, value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios },
    { label: "Oportunidade de Crescimento", icon: <FaBriefcase />, value: oportunidadeCrescimento, set: setOportunidadeCrescimento, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento },
    { label: "Cultura e Valores", icon: <FaHeart />, value: culturaValores, set: setCulturaValores, comment: commentCulturaValores, setComment: setCommentCulturaValores },
    { label: "Estimulação e Organização", icon: <FaLightbulb />, value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-md mx-auto">

        {/* HEADER SECTION (MOBILE) */}
        <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-2xl shadow-xl mb-6 text-center">
          <h1 className="text-3xl font-extrabold font-azonix tracking-wide">TRABALHEI LÁ</h1>
          <p className="text-sm mt-1">Avalie empresas de forma anônima e ajude outros profissionais.</p>
        </header>

        {/* AVALIATION FORM SECTION (MOBILE) */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4 font-azonix">
            Avalie uma Empresa
          </h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="text-slate-700 font-semibold text-sm block mb-1">Selecione a empresa:</label>
              <Select
                options={companyOptions}
                value={selectedCompany}
                onChange={handleCompanyChange}
                placeholder="Buscar ou selecionar empresa..."
                isClearable
                className="text-sm"
                styles={{
                  control: (base) => ({
                    ...base,
                    borderColor: '#e2e8f0',
                    '&:hover': { borderColor: '#93c5fd' },
                    boxShadow: 'none',
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? '#e0e7ff' : 'white',
                    color: '#334155',
                  }),
                  singleValue: (base) => ({ ...base, color: '#334155' }),
                }}
              />
            </div>

            <div className="mb-4 text-center">
              <button
                type="button"
                onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center justify-center mx-auto"
              >
                {showAddNewCompany ? <FaMinus className="mr-1" /> : <FaPlus className="mr-1" />} Adicionar nova empresa
              </button>
            </div>

            {showAddNewCompany && (
              <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-200">
                <h3 className="font-bold text-blue-700 mb-3 text-sm">Detalhes da Nova Empresa:</h3>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nome da Empresa"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Área de Atuação"
                  value={newCompanyArea}
                  onChange={(e) => setNewCompanyArea(e.target.value)}
                />
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Período de Trabalho (Ex: 2020-2022)"
                  value={newCompanyPeriodo}
                  onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                />
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="Breve descrição da empresa..."
                  value={newCompanyDescription}
                  onChange={(e) => setNewCompanyDescription(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddNewCompany}
                  className="bg-green-500 text-white font-bold py-2 px-3 rounded-full hover:bg-green-600 transition-colors text-xs"
                >
                  Adicionar Empresa
                </button>
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

        {/* LOGIN SECTION (MOBILE) */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4 font-azonix">
            Login para Avaliar
          </h2>
          <div className="flex flex-col space-y-4">
            <LoginLinkedInButton
              clientId={linkedInClientId}
              redirectUri={linkedInRedirectUri}
            />
          </div>
        </section>

        {/* RANKING SECTION (MOBILE) */}
        <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4">
            🏆 Melhores Empresas
          </h2>

          {Array.isArray(top3) && top3.length > 0 && (
            <div className="mb-4 space-y-2">
              {top3.map((emp, i) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={i}
                    className={`bg-gradient-to-r ${getMedalColor(i)} rounded-2xl p-3 text-white`}
                  >
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
        </section>

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