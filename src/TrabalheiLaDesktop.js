import React from "react";
import { Link } from "react-router-dom";
import Select from "react-select";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";
import { FaBuilding, FaPlus, FaStar, FaRegStar, FaMoneyBillWave, FaGift, FaUsers, FaChartLine, FaUserTie, FaGlobe, FaTrophy, FaComments, FaGraduationCap, FaHeart, FaUserEdit, FaGoogle } from "react-icons/fa";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import CaptchaModal from "./components/CaptchaModal";

function TrabalheiLaDesktop({
  theme, toggleTheme, firebaseStatus,
  company, setCompany, rating, setRating, commentRating, setCommentRating,
  salario, setSalario, commentSalario, setCommentSalario, beneficios, setBeneficios, commentBeneficios, setCommentBeneficios,
  cultura, setCultura, commentCultura, setCommentCultura, oportunidades, setOportunidades, commentOportunidades, setCommentOportunidades,
  inovacao, setInovacao, commentInovacao, setCommentInovacao, lideranca, setLideranca, commentLideranca, setCommentLideranca,
  diversidade, setDiversidade, commentDiversidade, setCommentDiversidade, ambiente, setAmbiente, commentAmbiente, setCommentAmbiente,
  equilibrio, setEquilibrio, commentEquilibrio, setCommentEquilibrio, reconhecimento, setReconhecimento, commentReconhecimento, setCommentReconhecimento,
  comunicacao, setComunicacao, commentComunicacao, setCommentComunicacao, etica, setEtica, commentEtica, setCommentEtica,
  desenvolvimento, setDesenvolvimento, commentDesenvolvimento, setCommentDesenvolvimento, saudeBemEstar, setSaudeBemEstar, commentSaudeBemEstar, setCommentSaudeBemEstar,
  impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial, reputacao, setReputacao, commentReputacao, setCommentReputacao,
  estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimulacaoOrganizacao,
  entrySource, setEntrySource, contractType, setContractType,
  generalComment, setGeneralComment, handleSubmit, isLoading, empresas, top3,
  handleSaibaMais,
  showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany, handleConfirmNewCompany, pendingCompanyData, newCompanyCnpj, setNewCompanyCnpj, cnpjError,
  linkedInClientId, error, setError, isAuthenticated, userProfile, userPseudonym, onLoginSuccess, selectedCompanyData, calcularMedia,
  onGoogleLogin,
  getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed
}) {

  const selectStyles = {
    control: (base) => ({ ...base, borderRadius: "0.75rem", padding: "0.25rem", borderColor: "#d1d5db", boxShadow: "none", "&:hover": { borderColor: "#3b82f6" } }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? "#eff6ff" : "white", color: "#1e293b", cursor: "pointer" }),
  };
    const legacyMetricsBridge = {
      beneficios, setBeneficios, commentBeneficios, setCommentBeneficios,
      oportunidades, setOportunidades, commentOportunidades, setCommentOportunidades,
      inovacao, setInovacao, commentInovacao, setCommentInovacao,
      impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial,
      reputacao, setReputacao, commentReputacao, setCommentReputacao,
      estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimulacaoOrganizacao,
    };
    void legacyMetricsBridge;

  const renderStars = (value, setValue, comment, setComment, label) => (
    <div className="flex flex-col w-full md:w-2/3 gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setValue(star)} className="focus:outline-none transition-transform hover:scale-110">
            {star <= value ? <FaStar className="text-yellow-400 text-2xl drop-shadow-sm" /> : <FaRegStar className="text-gray-300 text-2xl hover:text-yellow-200" />}
          </button>
        ))}
      </div>
      <textarea
        rows={3}
        placeholder={`Comentário sobre ${label.toLowerCase()} (opcional)`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
      />
    </div>
  );

  const campos = [
    { label: "Contato do RH", value: comunicacao, set: setComunicacao, comment: commentComunicacao, setComment: setCommentComunicacao, icon: <FaComments className="text-cyan-700" />, iconBg: "from-cyan-50 to-sky-100 border-cyan-200" },
    { label: "Proposta e acerto salarial", value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica, icon: <FaMoneyBillWave className="text-emerald-600" />, iconBg: "from-emerald-50 to-lime-100 border-emerald-200" },
    { label: "Salário e benefícios", value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario, icon: <FaGift className="text-rose-600" />, iconBg: "from-rose-50 to-red-100 border-rose-200" },
    { label: "Visão e valores da empresa", value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura, icon: <FaBuilding className="text-blue-700" />, iconBg: "from-blue-50 to-sky-100 border-blue-200" },
    { label: "Preocupação com o bem-estar", value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar, icon: <FaHeart className="text-pink-600" />, iconBg: "from-pink-50 to-rose-100 border-pink-200" },
    { label: "Acessibilidade e respeito da liderança", value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca, icon: <FaUserTie className="text-indigo-600" />, iconBg: "from-indigo-50 to-blue-100 border-indigo-200" },
    { label: "Estímulo ao respeito entre colegas", value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente, icon: <FaUsers className="text-violet-600" />, iconBg: "from-violet-50 to-fuchsia-100 border-violet-200" },
    { label: "Estímulo à organização", value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaBuilding className="text-blue-600" />, iconBg: "from-blue-50 to-indigo-100 border-blue-200" },
    { label: "Planos de cargos e salários", value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento, icon: <FaGraduationCap className="text-red-600" />, iconBg: "from-red-50 to-rose-100 border-red-200" },
    { label: "Reconhecimento", value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento, icon: <FaTrophy className="text-amber-700" />, iconBg: "from-amber-50 to-orange-100 border-amber-200" },
    { label: "Rotatividade (demissões)", value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio, icon: <FaChartLine className="text-slate-700" />, iconBg: "from-slate-50 to-gray-100 border-slate-300" },
    { label: "Atitudes de discriminação", value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade, icon: <FaGlobe className="text-teal-600" />, iconBg: "from-teal-50 to-cyan-100 border-teal-200" },
    { label: "Avaliação geral", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="text-amber-600" />, iconBg: "from-amber-50 to-yellow-100 border-amber-200" },
  ];

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "--";
  const isCompanyUnrated = companyNote === "--";

  const sourceConfig = [
    { key: "indicacao", label: "Indicação", color: "#2563eb" },
    { key: "siteVagas", label: "Site de vagas", color: "#16a34a" },
    { key: "gruposWhatsapp", label: "Grupos de WhatsApp", color: "#d97706" },
    { key: "redesSociais", label: "Redes sociais", color: "#9333ea" },
  ];

  const contractConfig = [
    { key: "pj", label: "PJ", color: "#0284c7" },
    { key: "contrato", label: "Contrato", color: "#ea580c" },
    { key: "clt", label: "CLT", color: "#16a34a" },
  ];

  const buildPieData = (stats, config) => {
    const total = config.reduce((sum, item) => sum + (stats?.[item.key] || 0), 0);
    if (!total) {
      return {
        chart: "#e5e7eb 0deg 360deg",
        items: config.map((item) => ({ ...item, percent: 0 })),
      };
    }

    let cursor = 0;
    const items = config.map((item) => {
      const value = stats?.[item.key] || 0;
      const percent = (value / total) * 100;
      const deg = (percent / 100) * 360;
      const start = cursor;
      cursor += deg;
      return {
        ...item,
        percent,
        slice: `${item.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`,
      };
    });

    return {
      chart: items.filter((item) => item.percent > 0).map((item) => item.slice).join(", "),
      items,
    };
  };

  const sourcePieData = buildPieData(selectedCompanyData?.sourceStats, sourceConfig);
  const contractPieData = buildPieData(selectedCompanyData?.contractStats, contractConfig);

  const getTopSliceLabel = (pieData) => {
    const topItem = pieData.items.reduce((best, current) => (current.percent > best.percent ? current : best), pieData.items[0]);
    if (!topItem || topItem.percent <= 0) {
      return "Ainda sem dados suficientes";
    }
    return `${topItem.label} lidera com ${topItem.percent.toFixed(0)}%`;
  };

  // Lógica para gerar a Logo baseada no nome da empresa
  const companyNameForLogo = selectedCompanyData ? selectedCompanyData.company : "Logo da Empresa";
  const logoCandidates = getCompanyLogoCandidates(companyNameForLogo, {
    size: 128,
    website: selectedCompanyData?.website,
  });
  const [logoIndex, setLogoIndex] = React.useState(0);
  const logoUrl = logoCandidates[logoIndex] || null;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [companyNameForLogo, selectedCompanyData?.website]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-6">
      <div className="w-full max-w-6xl">

        {/* HEADER */}
        <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-6xl bg-gradient-to-br from-blue-50/95 via-blue-100/95 to-blue-50/95 dark:from-slate-900/95 dark:via-slate-950/95 dark:to-slate-900/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border-2 border-blue-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center">

              {/* ÁREA DA LOGO ATUALIZADA */}
              <div className="w-20 h-20 bg-blue-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-blue-200 dark:border-slate-600 overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${companyNameForLogo}`}
                    className="w-full h-full object-cover"
                    onError={() => {
                      if (logoIndex < logoCandidates.length - 1) {
                        setLogoIndex((prev) => prev + 1);
                      }
                    }}
                  />
                ) : (
                  <FaBuilding className="text-blue-700 text-4xl" />
                )}
              </div>
              <span className="text-xs mt-2 text-blue-500 dark:text-slate-300 text-center max-w-[100px] truncate" title={companyNameForLogo}>
                {companyNameForLogo}
              </span>

              <div className={`mt-2 rounded-xl px-3 py-1 text-center shadow-lg ${isCompanyUnrated ? "bg-slate-500 dark:bg-slate-600" : "bg-blue-700 dark:bg-blue-800"}`}>
                <p className="text-xl font-extrabold text-white">{isCompanyUnrated ? "--" : `${companyNote}/5`}</p>
                <p className={`text-xs ${isCompanyUnrated ? "text-slate-200" : "text-blue-200"}`}>NOTA</p>
              </div>
            </div>

            <div className="flex-1 text-center px-8">
              <h1 className="text-6xl xl:text-7xl font-extrabold text-blue-800 dark:text-blue-100 drop-shadow-[0_3px_0_rgba(30,64,175,0.25)] dark:drop-shadow-[0_3px_0_rgba(15,23,42,0.6)] tracking-[0.12em] mb-1 font-azonix">
                TRABALHEI LÁ
              </h1>
              <div className="w-44 h-1.5 mx-auto rounded-full bg-gradient-to-r from-blue-300 via-blue-700 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500 mb-3" />
              <p className="text-blue-700 dark:text-blue-200 text-xl font-extrabold leading-tight mb-1">
                Sua opinião é anônima e ajuda outros profissionais
              </p>
              <div className="mb-3" />

              {isAuthenticated && (
                <div className="flex items-center justify-between gap-3 mb-2 bg-blue-50/70 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-600 rounded-2xl px-3 py-2">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center text-xl">
                      {userProfile?.avatar ? (
                        typeof userProfile.avatar === "string" && userProfile.avatar.startsWith("data:") ? (
                          <img src={userProfile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span>{userProfile.avatar}</span>
                        )
                      ) : (
                        <span className="text-blue-600">👤</span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{userPseudonym || userProfile?.name || "Usuário"}</p>
                      <a
                        href="/pseudonym"
                        className="inline-flex items-center mt-1 px-3 py-1.5 rounded-full bg-emerald-300 text-emerald-900 text-xs font-medium tracking-normal hover:bg-emerald-400 shadow-md transition"
                      >
                        <FaUserEdit className="mr-1 text-[11px]" />
                        Editar perfil
                      </a>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    aria-label="Alternar tema"
                  >
                    {theme === 'dark' ? '🌙 Tema' : '☀️ Tema'}
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{firebaseStatus}</p>
              <button
                type="button"
                onClick={handleSaibaMais}
                disabled={!company}
                className={`bg-blue-700 text-white font-extrabold py-3 px-8 rounded-2xl shadow-lg transition-all transform hover:scale-105 text-lg font-azonix ${
                  company ? "hover:bg-blue-800" : "opacity-60 cursor-not-allowed"
                }`}
              >
                CLIQUE E SAIBA MAIS
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <span className="flex items-center gap-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold">✓ Anônimo</span>
              <span className="flex items-center gap-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold">✓ Verificado</span>
              <span className="flex items-center gap-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold">✓ Confiável</span>
            </div>
          </div>
        </header>

        <div className="h-[22rem]" />

        {/* CONTEÚDO - 2 COLUNAS */}
        <div className="flex gap-6 mb-8">

          {/* COLUNA ESQUERDA */}
          <div className="flex-1">

            {/* LOGIN ATUALIZADO (Sem Google, LinkedIn Corrigido) */}
            <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
              <h2 className="text-3xl font-extrabold text-blue-900 dark:text-blue-900 text-center mb-2 tracking-wide font-azonix">Login para Avaliar</h2>
              <div className="w-28 h-1 mx-auto mb-5 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />
              <div className="flex flex-col items-center space-y-4">
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  onLoginSuccess={onLoginSuccess}
                  onLoginFailure={(e) => console.error("Erro no LinkedIn:", e)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-3 bg-white border border-blue-200 text-blue-800 font-semibold py-2 px-4 rounded-full shadow hover:bg-blue-50 transition-colors text-base w-full disabled:opacity-60"
                >
                  <FaGoogle className="text-lg" /> Cadastrar com Google
                </button>
                <p className="text-xs text-slate-500 text-center">
                  Sem LinkedIn: entre com Google e complete seu perfil manualmente na próxima etapa.
                </p>
              </div>
              {isAuthenticated && (
                <p className="text-green-600 font-semibold text-center mt-4">✓ Você está autenticado!</p>
              )}
            </section>

            {/* FORMULÁRIO */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-3xl font-extrabold text-blue-900 dark:text-blue-900 text-center mb-2 tracking-wide font-azonix">Avalie uma Empresa</h2>
              <div className="w-32 h-1 mx-auto mb-5 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />
              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="font-semibold text-slate-700 mb-2 block">Selecione a Empresa</label>
                  <Select
                    options={safeCompanyOptions}
                    value={company}
                    onChange={setCompany}
                    placeholder="Buscar ou selecionar empresa..."
                    styles={selectStyles}
                    isClearable
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-800 mb-2">Como entrou na empresa?</p>
                    <div className="space-y-2 text-sm text-slate-700">
                      {sourceConfig.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="entrySource"
                            checked={entrySource === item.key}
                            onChange={() => setEntrySource(item.key)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-800 mb-2">Forma de contratação</p>
                    <div className="space-y-2 text-sm text-slate-700">
                      {contractConfig.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="contractType"
                            checked={contractType === item.key}
                            onChange={() => setContractType(item.key)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedCompanyData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-blue-100 rounded-xl p-4">
                      <p className="text-sm font-bold text-blue-800 mb-1">Formas de entrada mais contratadas</p>
                      <p className="text-xs text-blue-600 mb-3">{getTopSliceLabel(sourcePieData)}</p>
                      <div className="flex items-center gap-4">
                        <div
                          className="w-28 h-28 rounded-full border border-gray-200"
                          style={{ background: `conic-gradient(${sourcePieData.chart})` }}
                        />
                        <div className="space-y-1 text-xs">
                          {sourcePieData.items.map((item) => (
                            <p key={item.key} className="flex items-center gap-2 text-slate-700">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              {item.label}: {item.percent.toFixed(0)}%
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-blue-100 rounded-xl p-4">
                      <p className="text-sm font-bold text-blue-800 mb-1">Tipos de contratação</p>
                      <p className="text-xs text-blue-600 mb-3">{getTopSliceLabel(contractPieData)}</p>
                      <div className="flex items-center gap-4">
                        <div
                          className="w-28 h-28 rounded-full border border-gray-200"
                          style={{ background: `conic-gradient(${contractPieData.chart})` }}
                        />
                        <div className="space-y-1 text-xs">
                          {contractPieData.items.map((item) => (
                            <p key={item.key} className="flex items-center gap-2 text-slate-700">
                              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              {item.label}: {item.percent.toFixed(0)}%
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showNewCompanyInput && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text"
                        className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CNPJ (apenas números)"
                        value={newCompanyCnpj}
                        onChange={(e) => setNewCompanyCnpj(e.target.value)}
                      />
                      <button type="button" onClick={handleAddNewCompany}
                        disabled={isLoading}
                        className="px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
                        {isLoading ? "Consultando..." : "Consultar CNPJ"}
                      </button>
                    </div>
                    {cnpjError && <p className="text-sm text-red-600">{cnpjError}</p>}

                    {pendingCompanyData && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
                        <p className="font-semibold">Empresa encontrada: {pendingCompanyData.company}</p>
                        <p className="text-xs text-blue-700 mt-1">CNPJ: {pendingCompanyData.cnpj}</p>
                        <p className="mt-2 font-medium">👍 Está correto?</p>
                        <button
                          type="button"
                          onClick={handleConfirmNewCompany}
                          disabled={isLoading}
                          className="mt-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition"
                        >
                          {isLoading ? "Confirmando..." : "Confirmar empresa"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow transition-all">
                  <FaPlus />
                  {showNewCompanyInput ? "Cancelar" : "Adicionar Nova Empresa"}
                </button>

                {campos.map((campo, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center gap-2 mb-2 md:mb-0">
                      <span className={`w-9 h-9 rounded-xl border bg-gradient-to-br ${campo.iconBg} flex items-center justify-center shadow-sm`}>
                        {campo.icon}
                      </span>
                      {campo.label}
                    </label>
                    {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                  </div>
                ))}

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="text-slate-700 font-semibold text-lg block mb-2">Comentário Geral</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Descreva sua experiência na empresa..."
                    rows={3}
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  />
                </div>

                {error && <p className="text-red-600 text-center text-sm font-medium">{error}</p>}

                <div className="text-center pt-2">
                  <button type="submit"
                    className={`px-8 py-3 rounded-full font-extrabold text-white transition-all ${isAuthenticated ? "bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-xl hover:scale-105" : "bg-slate-400 cursor-not-allowed opacity-60"}`}
                    disabled={!isAuthenticated || isLoading}>
                    {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
                  </button>
                </div>

              </form>
            </section>
          </div>

          {/* COLUNA DIREITA - RANKING */}
          <div className="w-80">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100 sticky top-6">
              <h2 className="text-2xl font-extrabold text-blue-900 dark:text-blue-900 text-center mb-2 font-azonix tracking-wide">🏆 Ranking de Empresas</h2>
              <div className="w-24 h-1 mx-auto mb-4 rounded-full bg-gradient-to-r from-yellow-300 via-amber-500 to-yellow-300" />

              {Array.isArray(top3) && top3.length > 0 && (
                <div className="mb-4 space-y-2">
                  {top3.map((emp, i) => {
                    const media = calcularMedia(emp);
                    const isUnrated = media === "--";
                    return (
                      <div key={i} className={`${isUnrated ? "bg-slate-200 text-slate-600" : `bg-gradient-to-r ${getMedalColor(i)} text-white`} rounded-2xl p-3`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getMedalEmoji(i)}</span>
                            <p className="font-bold text-sm">{emp.company}</p>
                          </div>
                          <div className={`${isUnrated ? "bg-slate-300 text-slate-700" : "bg-white/20 text-white"} px-2 py-1 rounded-full font-bold text-xs`}>
                            {isUnrated ? "--" : `${media} ⭐`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                <h3 className="text-base font-extrabold text-blue-900 dark:text-blue-900 mb-2 tracking-wide">Empresas por Autocompletação</h3>
                <p className="text-sm text-blue-900 leading-relaxed">
                  Para manter performance com muitas empresas, a seleção agora é feita pelo campo
                  <span className="font-semibold"> "Selecione a Empresa"</span> no formulário.
                  Digite parte do nome para buscar rapidamente.
                </p>
              </div>

              <div className="mt-4 bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                <h3 className="text-base font-bold text-emerald-900 mb-2">Como funciona a plataforma</h3>
                <p className="text-sm text-emerald-900 leading-relaxed mb-3">
                  O objetivo do Trabalhei La e ajudar profissionais a decidir melhor onde trabalhar por meio de avaliacoes anonimas e verificadas.
                </p>
                <ul className="space-y-2 text-sm text-emerald-900">
                  <li><span className="font-semibold">1.</span> Entre com LinkedIn e ajuste seu perfil anonimo.</li>
                  <li><span className="font-semibold">2.</span> Escolha uma empresa e avalie os criterios da sua experiencia.</li>
                  <li><span className="font-semibold">3.</span> Veja notas, comentarios e ranking para comparar empresas.</li>
                </ul>
              </div>
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
              <Link to="/purpose" className="text-blue-700 hover:text-blue-900 font-extrabold underline">
                Qual o nosso propósito?
              </Link>
              {" • "}
              <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
            </p>
          </div>
        </footer>

        <CaptchaModal
          open={showCaptcha}
          onClose={() => setShowCaptcha(false)}
          checked={captchaConfirmed}
          onChange={setCaptchaConfirmed}
          onConfirm={() => {
            setCaptchaConfirmed(true);
            setShowCaptcha(false);
          }}
        />

      </div>
    </div>
  );
}

export default TrabalheiLaDesktop;