// src/TrabalheiLaDesktop.js
import React, { useState, useEffect } from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaMinus, FaCheckCircle
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar"; // Importa o componente OutlinedStar
import { useNavigate } from 'react-router-dom'; // Para navegação programática

function TrabalheiLaDesktop({
  empresas, // Lista completa de empresas
  setEmpresas,
  top3, // Top 3 empresas
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
  const navigate = useNavigate(); // Hook para navegação

  const [selectedCompany, setSelectedCompany] = useState(null); // Objeto da empresa selecionada
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

  // Estado para a logo e nota da empresa selecionada no cabeçalho
  const [headerCompanyLogo, setHeaderCompanyLogo] = useState('https://via.placeholder.com/100x100?text=Logo'); // Placeholder
  const [headerCompanyRating, setHeaderCompanyRating] = useState('N/A');

  // useEffect para lidar com o redirecionamento do LinkedIn
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      // Aqui você enviaria o 'code' para o seu backend para trocar por um token de acesso
      // Por enquanto, apenas simulamos o login
      setIsAuthenticated(true);
      // Limpa o código da URL para evitar reprocessamento e URLs feias
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('code');
      window.history.replaceState({}, document.title, newUrl.pathname);
    }
  }, [setIsAuthenticated]);

  // Atualiza a logo e a nota no cabeçalho quando uma empresa é selecionada
  useEffect(() => {
    if (selectedCompany) {
      // Aqui você pode ter uma lógica para buscar a logo real da empresa
      // Por enquanto, usamos um placeholder e a média calculada
      setHeaderCompanyLogo(`https://logo.clearbit.com/${selectedCompany.value.toLowerCase().replace(/\s/g, '')}.com`); // Exemplo com Clearbit
      const media = calcularMedia(selectedCompany.original);
      setHeaderCompanyRating(`${media}/5`);
    } else {
      setHeaderCompanyLogo('https://via.placeholder.com/100x100?text=Logo');
      setHeaderCompanyRating('N/A');
    }
  }, [selectedCompany, calcularMedia]);

  const companyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
    original: emp, // Mantém o objeto original da empresa
  }));

  const handleCompanySelect = (option) => {
    setSelectedCompany(option);
    // Resetar avaliações ao mudar de empresa, se desejar
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
  };

  const handleAddNewCompany = async () => {
    if (!newCompanyName || !newCompanyArea || !newCompanyPeriodo || !newCompanyDescription) {
      setError("Por favor, preencha todos os campos para adicionar uma nova empresa.");
      return;
    }
    setIsLoading(true);
    setError('');

    const newCompanyData = {
      company: newCompanyName,
      area: newCompanyArea,
      periodo: newCompanyPeriodo,
      description: newCompanyDescription,
      ratings: [], // Começa sem avaliações
    };

    try {
      // Simulação de API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setEmpresas((prev) => [...prev, newCompanyData]);
      setSelectedCompany({ value: newCompanyName, label: newCompanyName, original: newCompanyData });
      setNewCompanyName('');
      setNewCompanyArea('');
      setNewCompanyPeriodo('');
      setNewCompanyDescription('');
      setShowAddNewCompany(false);
    } catch (err) {
      setError("Erro ao adicionar empresa.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
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
      user: "anonymous_user", // Substituir por ID do usuário logado
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
      date: new Date().toISOString(),
    };

    try {
      // Simulação de API call para enviar avaliação
      await new Promise(resolve => setTimeout(resolve, 1500));

      setEmpresas((prev) =>
        prev.map((emp) =>
          emp.company === selectedCompany.value
            ? { ...emp, ratings: [...emp.ratings, newRating] }
            : emp
        )
      );
      // Atualizar top3 se necessário
      const updatedEmpresas = empresas.map((emp) =>
        emp.company === selectedCompany.value
          ? { ...emp, ratings: [...emp.ratings, newRating] }
          : emp
      );
      const sortedEmpresas = [...updatedEmpresas].sort((a, b) => calcularMedia(b) - calcularMedia(a));
      setTop3(sortedEmpresas.slice(0, 3));

      alert("Avaliação enviada com sucesso!");
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
      setSelectedCompany(null);

    } catch (err) {
      setError("Erro ao enviar avaliação.");
    } finally {
      setIsLoading(false);
    }
  };

  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, icon: <FaHandshake />, comment: commentContatoRH, setComment: setCommentContatoRH },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, icon: <FaMoneyBillWave />, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios },
    { label: "Oportunidade de Crescimento", value: oportunidadeCrescimento, set: setOportunidadeCrescimento, icon: <FaBriefcase />, comment: commentOportunidadeCrescimento, setComment: setCommentOportunidadeCrescimento },
    { label: "Cultura e Valores", value: culturaValores, set: setCulturaValores, icon: <FaHeart />, comment: commentCulturaValores, setComment: setCommentCulturaValores },
    { label: "Estímulo à Inovação e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, icon: <FaLightbulb />, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao },
  ];

  const renderStars = (currentValue, setter, commentValue, commentSetter, label) => (
    <div className="flex items-center gap-1 mt-1">
      {[...Array(5)].map((_, i) => (
        <OutlinedStar
          key={i}
          active={i < currentValue}
          onClick={() => {
            setter(i + 1);
            setShowCommentInput(prev => ({ ...prev, [label]: true }));
          }}
          label={`${i + 1} estrelas para ${label}`}
        />
      ))}
      {showCommentInput[label] && (
        <textarea
          className="ml-2 p-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 flex-grow"
          rows="1"
          placeholder={`Comentário para ${label}...`}
          value={commentValue}
          onChange={(e) => commentSetter(e.target.value)}
        />
      )}
    </div>
  );

  const handleSaibaMaisClick = () => {
    if (selectedCompany) {
      navigate(`/company/${selectedCompany.value.toLowerCase().replace(/\s/g, '-')}`);
    } else {
      alert("Por favor, selecione uma empresa para saber mais.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4 font-sans">
      <div className="max-w-6xl mx-auto">

        {/* HEADER SECTION (DESKTOP - conforme EXEMPLE.png) */}
        <header className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100 flex items-center justify-between lg:flex-row flex-col gap-4">
          <div className="flex items-center gap-4">
            <img src={headerCompanyLogo} alt="Company Logo" className="w-24 h-24 object-contain rounded-full border-2 border-gray-200 p-1" />
            <div>
              <h1 className="text-4xl font-extrabold text-blue-800 font-azonix mb-1">TRABALHEI LÁ</h1>
              <p className="text-slate-600 text-sm">Sua opinião é anônima e ajuda outros profissionais.</p>
              <p className="text-slate-600 text-xs">Avaliações anônimas feitas por profissionais verificados.</p>
              <div className="flex items-center gap-2 mt-2 text-green-600 text-xs font-semibold">
                <FaCheckCircle /> Anônimo
                <FaCheckCircle /> Verificado
                <FaCheckCircle /> Confiável
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-end gap-3">
            <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-md">
              <span className="text-2xl font-bold">{headerCompanyRating}</span>
              <span className="text-sm">Nota da Empresa</span>
            </div>
            <button
              onClick={handleSaibaMaisClick}
              className="bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-blue-800 transition-colors text-lg"
            >
              CLIQUE E SAIBA MAIS
            </button>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-3 gap-6">
          {/* MAIN CONTENT - FORM AND LOGIN */}
          <div className="lg:col-span-2">
            {/* FORM SECTION */}
            <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6 font-azonix">
                Avalie uma Empresa
              </h2>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                  <strong className="font-bold">Erro!</strong>
                  <span className="block sm:inline"> {error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="company-select" className="text-slate-700 font-semibold text-sm block mb-1">
                    Selecione a empresa:
                  </label>
                  <Select
                    id="company-select"
                    options={companyOptions}
                    value={selectedCompany}
                    onChange={handleCompanySelect}
                    placeholder="Buscar ou selecionar empresa..."
                    isClearable
                    className="text-sm"
                    styles={{
                      control: (base) => ({ ...base, borderColor: '#d1d5db', '&:hover': { borderColor: '#a78bfa' } }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isFocused ? '#ede9fe' : 'white',
                        color: '#4a5568',
                      }),
                    }}
                  />
                </div>

                <div className="text-center mb-4">
                  <button
                    type="button"
                    onClick={() => setShowAddNewCompany(!showAddNewCompany)}
                    className="text-blue-600 hover:text-blue-800 font-semibold text-sm flex items-center mx-auto"
                  >
                    {showAddNewCompany ? <FaMinus className="mr-1" /> : <FaPlus className="mr-1" />} Adicionar nova empresa
                  </button>
                </div>

                {showAddNewCompany && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                    <h3 className="font-bold text-gray-800 mb-3 text-base">Detalhes da Nova Empresa</h3>
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
                    className="w-full p-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
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

            {/* LOGIN SECTION */}
            <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-4 font-azonix">
                Login para Avaliar
              </h2>
              <div className="flex flex-col space-y-4">
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  redirectUri={linkedInRedirectUri}
                />
              </div>
            </section>
          </div>

          {/* RANKING SECTION (RIGHT COLUMN) */}
          <div className="lg:col-span-1">
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-4">
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
                .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #1d4ed8, #3b82f6); border-radius: 10px; }
              `}</style>
            </section>
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