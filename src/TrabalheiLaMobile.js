import React from "react";
import {
  FaStar, FaHandshake, FaMoneyBillWave,
  FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb,
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import CaptchaModal from "./components/CaptchaModal";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";

function OutlinedStar({ active, onClick, size = 18, label }) {
  const outlineScale = 1.24;
  const touchSize = size * 1.8;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        padding: 4,
        margin: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        lineHeight: 0,
        touchAction: "manipulation",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: touchSize,
        height: touchSize,
      }}
    >
      <span
        style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle" }}
      >
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `scale(${outlineScale})`,
            transformOrigin: "center",
          }}
          aria-hidden="true"
        >
          <FaStar size={size} color="#000" />
        </span>
        <span style={{ position: "relative" }} aria-hidden="true">
          <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
        </span>
      </span>
    </button>
  );
}


function TrabalheiLaMobile({
  theme, toggleTheme, firebaseStatus,
  company, setCompany,
  rating, setRating,
  salario, setSalario,
  beneficios, setBeneficios,
  cultura, setCultura,
  oportunidades, setOportunidades,
  inovacao, setInovacao,
  lideranca, setLideranca,
  diversidade, setDiversidade,
  ambiente, setAmbiente,
  equilibrio, setEquilibrio,
  reconhecimento, setReconhecimento,
  comunicacao, setComunicacao,
  etica, setEtica,
  desenvolvimento, setDesenvolvimento,
  saudeBemEstar, setSaudeBemEstar,
  impactoSocial, setImpactoSocial,
  reputacao, setReputacao,
  estimacaoOrganizacao, setEstimacaoOrganizacao,
  commentRating, setCommentRating,
  commentSalario, setCommentSalario,
  commentBeneficios, setCommentBeneficios,
  commentCultura, setCommentCultura,
  commentOportunidades, setCommentOportunidades,
  commentInovacao, setCommentInovacao,
  commentLideranca, setCommentLideranca,
  commentDiversidade, setCommentDiversidade,
  commentAmbiente, setCommentAmbiente,
  commentEquilibrio, setCommentEquilibrio,
  commentReconhecimento, setCommentReconhecimento,
  commentComunicacao, setCommentComunicacao,
  commentEtica, setCommentEtica,
  commentDesenvolvimento, setCommentDesenvolvimento,
  commentSaudeBemEstar, setCommentSaudeBemEstar,
  commentImpactoSocial, setCommentImpactoSocial,
  commentReputacao, setCommentReputacao,
  commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
  generalComment, setGeneralComment,
  handleSubmit, isLoading,
  empresas, top3,
  filterText, setFilterText, showNewCompanyInput, setShowNewCompanyInput,
  handleAddNewCompany, handleConfirmNewCompany, pendingCompanyData, newCompanyCnpj, setNewCompanyCnpj, cnpjError,
  handleSaibaMais,
  linkedInClientId, linkedInRedirectUri,
  error, setError, isAuthenticated, userProfile, userPseudonym, onLoginSuccess, safeCompanyOptions,
  selectedCompanyData,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed,
}) {
  const calcularMedia = (emp) => {
    if (!emp) return "0.0";

    const ratings = [
      emp.rating, emp.salario, emp.beneficios, emp.cultura, emp.oportunidades,
      emp.inovacao, emp.lideranca, emp.diversidade, emp.ambiente, emp.equilibrio,
      emp.reconhecimento, emp.comunicacao, emp.etica, emp.desenvolvimento,
      emp.saudeBemEstar, emp.impactoSocial, emp.reputacao, emp.estimacaoOrganizacao,
    ].filter((val) => typeof val === "number" && !isNaN(val) && val > 0);

    if (ratings.length === 0) return "0.0";
    const sum = ratings.reduce((acc, curr) => acc + curr, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const logoCandidates = selectedCompanyData
    ? getCompanyLogoCandidates(selectedCompanyData.company, {
      size: 128,
      website: selectedCompanyData.website,
    })
    : [];
  const [logoIndex, setLogoIndex] = React.useState(0);
  const companyLogoUrl = logoCandidates[logoIndex] || null;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [selectedCompanyData?.company, selectedCompanyData?.website]);
  const companyAverage = selectedCompanyData ? calcularMedia(selectedCompanyData) : "0.0";


  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-emerald-700";
    if (media >= 4) return "bg-lime-600";
    if (media >= 3) return "bg-yellow-600";
    if (media >= 2) return "bg-purple-600";
    return "bg-red-600";
  };

  const openLinkedInJobs = () => {
    if (!company?.value) return;
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      company.value
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-300 to-gray-500";
    if (index === 2) return "from-orange-300 to-orange-500";
    return "from-blue-300 to-blue-500";
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🏅";
  };

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem",
      padding: "0.25rem",
      borderColor: state.isFocused ? "#1d4ed8" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #1d4ed8" : "none",
    }),
  };

  const renderStars = (value, setValue, commentValue, setCommentValue, label) => (
    <div className="flex flex-col items-end w-full mt-2">
      <div className="flex items-center space-x-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar key={i} active={i < value} onClick={() => setValue(i + 1)} label={`${i + 1} estrelas`} />
        ))}
        <span className="ml-2 text-slate-700 font-medium">{value}/5</span>
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-2"
        placeholder={`Comentário sobre ${label.toLowerCase()} (opcional)`}
        rows={3}
        value={commentValue}
        onChange={(e) => setCommentValue(e.target.value)}
      />
    </div>
  );

  const campos = [
    { label: "Avaliação Geral", icon: <FaStar className="text-yellow-500" />, value: rating, set: setRating, comment: commentRating, setComment: setCommentRating },
    { label: "Salário e Benefícios", icon: <FaMoneyBillWave className="text-green-500" />, value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario },
    { label: "Benefícios", icon: <FaHandshake className="text-blue-500" />, value: beneficios, set: setBeneficios, comment: commentBeneficios, setComment: setCommentBeneficios },
    { label: "Cultura", icon: <FaBuilding className="text-gray-500" />, value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura },
    { label: "Oportunidades", icon: <FaBriefcase className="text-orange-500" />, value: oportunidades, set: setOportunidades, comment: commentOportunidades, setComment: setCommentOportunidades },
    { label: "Inovação", icon: <FaLightbulb className="text-yellow-400" />, value: inovacao, set: setInovacao, comment: commentInovacao, setComment: setCommentInovacao },
    { label: "Liderança", icon: <FaUserTie className="text-purple-500" />, value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca },
    { label: "Diversidade", icon: <FaHeart className="text-red-500" />, value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade },
    { label: "Ambiente", icon: <FaBuilding className="text-slate-500" />, value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente },
    { label: "Equilíbrio", icon: <FaHandshake className="text-indigo-500" />, value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio },
    { label: "Reconhecimento", icon: <FaStar className="text-amber-500" />, value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento },
    { label: "Comunicação", icon: <FaLightbulb className="text-cyan-500" />, value: comunicacao, set: setComunicacao, comment: commentComunicacao, setComment: setCommentComunicacao },
    { label: "Ética", icon: <FaBuilding className="text-emerald-500" />, value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica },
    { label: "Desenvolvimento", icon: <FaBriefcase className="text-fuchsia-500" />, value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento },
    { label: "Saúde e Bem-estar", icon: <FaHeart className="text-red-500" />, value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar },
    { label: "Impacto Social", icon: <FaHeart className="text-rose-500" />, value: impactoSocial, set: setImpactoSocial, comment: commentImpactoSocial, setComment: setCommentImpactoSocial },
    { label: "Reputação", icon: <FaBuilding className="text-slate-500" />, value: reputacao, set: setReputacao, comment: commentReputacao, setComment: setCommentReputacao },
    { label: "Estimativa na Organização", icon: <FaStar className="text-lime-500" />, value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimacaoOrganizacao },
  ];

  return (
    <div className="min-h-screen bg-blue-50 dark:bg-slate-950 font-sans pb-10">
      <header className="bg-blue-50 dark:bg-slate-900 shadow-sm px-4 py-4 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between sticky top-0 z-50">
        <div className="w-full flex items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 overflow-hidden">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt="Logo da empresa"
                className="w-full h-full object-cover"
                onError={() => {
                  if (logoIndex < logoCandidates.length - 1) {
                    setLogoIndex((prev) => prev + 1);
                  }
                }}
              />
            ) : (
              <FaBuilding className="text-blue-700 text-2xl" />
            )}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-blue-900 font-azonix tracking-[0.12em] drop-shadow-[0_2px_0_rgba(37,99,235,0.25)]">
              TRABALHEI LÁ
            </h1>
            <p className="text-[10px] text-blue-500 font-medium">Avaliações anônimas</p>
          </div>
        </div>

        {isAuthenticated && (
          <div className="flex items-center justify-between mt-4 px-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-lg">
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
              <div>
                <p className="text-sm font-semibold text-slate-700">{userPseudonym || userProfile?.name || "Usuário"}</p>
                <a href="/pseudonym" className="text-xs text-blue-600 hover:underline">
                  Editar perfil
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="px-3 py-2 bg-slate-200 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              aria-label="Alternar tema claro/escuro"
            >
              {theme === 'dark' ? '☀️ Tema' : '🌙 Tema'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between w-full">
          {company && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{company.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Média: <span className={`font-bold ${getBadgeColor(companyAverage)}`}>{companyAverage}</span></p>
              </div>
              <button
                type="button"
                onClick={handleSaibaMais}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition"
              >
                Saiba mais
              </button>
              <button
                type="button"
                onClick={openLinkedInJobs}
                className="px-4 py-2 bg-slate-200 text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200"
              >
                Ver vagas no LinkedIn
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">{firebaseStatus}</p>
      </header>

      <main className="px-4 space-y-6">
        {/* LOGIN */}
        <section className="bg-white rounded-2xl shadow-md p-5 border border-blue-50">
          <h2 className="text-lg font-bold text-blue-800 text-center mb-4 font-azonix">Login para Avaliar</h2>
          <div className="flex flex-col items-center space-y-3">
            <LoginLinkedInButton 
              clientId={linkedInClientId} 
              redirectUri={linkedInRedirectUri}
              onLoginSuccess={onLoginSuccess}
              onLoginFailure={(err) => setError(err?.message || String(err))}
              disabled={isLoading}
            />
          </div>
          {isAuthenticated && <p className="text-green-600 font-semibold text-center mt-3 text-sm">✓ Autenticado!</p>}
        </section>

        {/* FORMULÁRIO */}
        <section className="bg-white rounded-2xl shadow-md p-5 border border-blue-50">
          <h2 className="text-lg font-bold text-blue-800 text-center mb-4 font-azonix">Avalie uma Empresa</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-semibold text-slate-700 mb-2 block text-sm">Selecione a Empresa</label>
              <Select
                options={safeCompanyOptions}
                value={company}
                onChange={setCompany}
                placeholder="Buscar empresa..."
                styles={selectStyles}
                isClearable
                noOptionsMessage={() => "Empresa não encontrada"}
              />

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                  className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
                >
                  {showNewCompanyInput ? "Cancelar" : "+ Adicionar nova empresa"}
                </button>
              </div>

              {showNewCompanyInput && (
                <div className="mt-3 space-y-2">
                  <input
                    value={newCompanyCnpj}
                    onChange={(e) => setNewCompanyCnpj(e.target.value)}
                    placeholder="CNPJ (apenas números)"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {cnpjError && <p className="text-sm text-red-600">{cnpjError}</p>}
                  <button
                    type="button"
                    onClick={handleAddNewCompany}
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
                  >
                    {isLoading ? "Consultando CNPJ..." : "Consultar CNPJ"}
                  </button>

                  {pendingCompanyData && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
                      <p className="font-semibold">Empresa encontrada: {pendingCompanyData.company}</p>
                      <p className="text-xs text-blue-700 mt-1">CNPJ: {pendingCompanyData.cnpj}</p>
                      <p className="mt-2 font-medium">👍 Está correto?</p>
                      <button
                        type="button"
                        onClick={handleConfirmNewCompany}
                        disabled={isLoading}
                        className="mt-2 w-full py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
                      >
                        {isLoading ? "Confirmando..." : "Confirmar empresa"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {campos.map((campo, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <label className="text-slate-700 font-semibold flex items-center gap-2 text-sm">
                    {campo.icon} {campo.label}
                  </label>
                  {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <label className="text-slate-700 font-semibold text-sm block mb-2">Comentário Geral</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Descreva sua experiência na empresa..."
                rows={3}
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-center text-xs font-medium">{error}</p>}

            <button type="submit"
              className={`w-full py-3 rounded-xl font-bold text-white transition-all ${isAuthenticated ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-400"}`}
              disabled={!isAuthenticated || isLoading}>
              {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
            </button>
          </form>
        </section>

        {/* RANKING */}
        <section className="bg-white rounded-2xl shadow-md p-5 border border-blue-50">
          <h2 className="text-lg font-bold text-blue-800 text-center mb-4 font-azonix">🏆 Ranking</h2>
          {Array.isArray(top3) && top3.length > 0 && (
            <div className="mb-4 space-y-2">
              {top3.map((emp, i) => {
                const media = calcularMedia(emp);
                return (
                  <div key={i} className={`bg-gradient-to-r ${getMedalColor(i)} rounded-xl p-3 text-white flex justify-between items-center`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getMedalEmoji(i)}</span>
                      <p className="font-bold text-sm truncate max-w-[120px]">{emp.company}</p>
                    </div>
                    <div className="bg-white/20 px-2 py-1 rounded-lg font-bold text-xs">{media} ⭐</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* LISTA DE EMPRESAS */}
        <section className="bg-white rounded-2xl shadow-md p-5 border border-blue-50">
          <h2 className="text-lg font-bold text-blue-800 text-center mb-4 font-azonix">🏢 Lista de Empresas</h2>

          <div className="mb-4">
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar empresas..."
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {Array.isArray(empresas) && empresas.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {empresas
                .filter((emp) => !filterText || emp.company.toLowerCase().includes(filterText.toLowerCase()))
                .map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-all flex items-center justify-between"
                      onClick={() => setCompany({ value: emp.company, label: emp.company })}
                    >
                      <p className="font-semibold text-sm truncate max-w-[180px]">{emp.company}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${getBadgeColor(media)}`}>{media} ⭐</span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-500">Nenhuma empresa disponível</p>
          )}
        </section>
      </main>

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

      <footer className="text-center text-xs text-slate-500 mt-6">
        <a href="/purpose" className="text-blue-600 hover:underline">
          Qual o nosso propósito?
        </a>
      </footer>
    </div>
  );
}

export default TrabalheiLaMobile;