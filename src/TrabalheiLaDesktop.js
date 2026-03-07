import React from "react";
import Select from "react-select";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";
import { FaBuilding, FaPlus, FaChartBar, FaStar, FaRegStar, FaMoneyBillWave, FaGift, FaUsers, FaChartLine, FaLightbulb, FaUserTie, FaGlobe, FaLeaf, FaBalanceScale, FaTrophy, FaComments, FaHandshake, FaGraduationCap, FaHeart } from "react-icons/fa";
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
  generalComment, setGeneralComment, handleSubmit, isLoading, empresas, top3,
  handleSaibaMais,
  showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany, handleConfirmNewCompany, pendingCompanyData, newCompanyCnpj, setNewCompanyCnpj, cnpjError,
  linkedInClientId, error, setError, isAuthenticated, userProfile, userPseudonym, onLoginSuccess, selectedCompanyData, calcularMedia,
  getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed
}) {

  const selectStyles = {
    control: (base) => ({ ...base, borderRadius: "0.75rem", padding: "0.25rem", borderColor: "#d1d5db", boxShadow: "none", "&:hover": { borderColor: "#3b82f6" } }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? "#eff6ff" : "white", color: "#1e293b", cursor: "pointer" }),
  };

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
    { label: "Avaliação Geral", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="text-yellow-500" /> },
    { label: "Salário", value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Benefícios", value: beneficios, set: setBeneficios, comment: commentBeneficios, setComment: setCommentBeneficios, icon: <FaGift className="text-red-400" /> },
    { label: "Cultura", value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura, icon: <FaUsers className="text-purple-500" /> },
    { label: "Oportunidades", value: oportunidades, set: setOportunidades, comment: commentOportunidades, setComment: setCommentOportunidades, icon: <FaChartLine className="text-blue-500" /> },
    { label: "Inovação", value: inovacao, set: setInovacao, comment: commentInovacao, setComment: setCommentInovacao, icon: <FaLightbulb className="text-yellow-400" /> },
    { label: "Liderança", value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca, icon: <FaUserTie className="text-indigo-500" /> },
    { label: "Diversidade", value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade, icon: <FaGlobe className="text-teal-500" /> },
    { label: "Ambiente", value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente, icon: <FaLeaf className="text-green-400" /> },
    { label: "Equilíbrio", value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio, icon: <FaBalanceScale className="text-gray-500" /> },
    { label: "Reconhecimento", value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento, icon: <FaTrophy className="text-yellow-600" /> },
    { label: "Comunicação", value: comunicacao, set: setComunicacao, comment: commentComunicacao, setComment: setCommentComunicacao, icon: <FaComments className="text-blue-400" /> },
    { label: "Ética", value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica, icon: <FaHandshake className="text-orange-500" /> },
    { label: "Desenvolvimento", value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento, icon: <FaGraduationCap className="text-red-500" /> },
    { label: "Saúde e Bem-estar", value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar, icon: <FaHeart className="text-pink-500" /> },
    { label: "Impacto Social", value: impactoSocial, set: setImpactoSocial, comment: commentImpactoSocial, setComment: setCommentImpactoSocial, icon: <FaGlobe className="text-green-600" /> },
    { label: "Reputação", value: reputacao, set: setReputacao, comment: commentReputacao, setComment: setCommentReputacao, icon: <FaStar className="text-yellow-500" /> },
    { label: "Estímulo e Organização", value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-400" /> },
  ];

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "0.0";

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

  const openLinkedInJobs = () => {
    if (!company?.value) return;
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company.value)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-6">
      <div className="w-full max-w-6xl">

        {/* HEADER */}
        <header className="bg-blue-50 dark:bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 border-2 border-blue-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center">

              {/* ÁREA DA LOGO ATUALIZADA */}
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-blue-200 overflow-hidden">
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
              <span className="text-xs mt-2 text-blue-400 text-center max-w-[100px] truncate" title={companyNameForLogo}>
                {companyNameForLogo}
              </span>

              <div className="mt-2 bg-blue-700 rounded-xl px-3 py-1 text-center">
                <p className="text-xl font-extrabold text-white">{companyNote}/5</p>
                <p className="text-xs text-blue-200">NOTA</p>
              </div>
            </div>

            <div className="flex-1 text-center px-8">
              <h1 className="text-5xl font-extrabold text-blue-800 drop-shadow tracking-wide mb-3 font-azonix">
                TRABALHEI LÁ
              </h1>
              {isAuthenticated && (
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl">
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
                      <p className="text-sm font-semibold text-blue-800">{userPseudonym || userProfile?.name || "Usuário"}</p>
                      <a href="/pseudonym" className="text-xs text-blue-600 hover:underline">
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
                    {theme === 'dark' ? '☀️ Tema' : '🌙 Tema'}
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{firebaseStatus}</p>
              <p className="text-blue-600 text-lg mb-2">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-blue-400 text-sm mb-6">Avaliações anônimas feitas por profissionais verificados.</p>
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
              <button
                type="button"
                onClick={openLinkedInJobs}
                disabled={!company}
                className={`bg-slate-200 text-slate-800 font-semibold py-3 px-8 rounded-2xl shadow-sm transition-all transform hover:scale-105 text-lg ${
                  company ? "hover:bg-slate-300" : "opacity-60 cursor-not-allowed"
                }`}
              >
                Ver vagas no LinkedIn
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <span className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full font-semibold">✓ Anônimo</span>
              <span className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full font-semibold">✓ Verificado</span>
              <span className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-full font-semibold">✓ Confiável</span>
            </div>
          </div>
        </header>

        {/* CONTEÚDO - 2 COLUNAS */}
        <div className="flex gap-6 mb-8">

          {/* COLUNA ESQUERDA */}
          <div className="flex-1">

            {/* LOGIN ATUALIZADO (Sem Google, LinkedIn Corrigido) */}
            <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Login para Avaliar</h2>
              <div className="flex flex-col items-center space-y-4">
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  onLoginSuccess={onLoginSuccess}
                  onLoginFailure={(e) => console.error("Erro no LinkedIn:", e)}
                  disabled={isLoading}
                />
              </div>
              {isAuthenticated && (
                <p className="text-green-600 font-semibold text-center mt-4">✓ Você está autenticado!</p>
              )}
            </section>

            {/* FORMULÁRIO */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>
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
                      {campo.icon} {campo.label}
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
              <h2 className="text-xl font-bold text-blue-800 text-center mb-4 font-azonix">🏆 Ranking de Empresas</h2>

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

              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                <h3 className="text-sm font-bold text-blue-800 mb-2">Empresas por Autocompletação</h3>
                <p className="text-sm text-blue-900 leading-relaxed">
                  Para manter performance com muitas empresas, a seleção agora é feita pelo campo
                  <span className="font-semibold"> "Selecione a Empresa"</span> no formulário.
                  Digite parte do nome para buscar rapidamente.
                </p>
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
              <a href="/purpose" className="text-blue-700 hover:text-blue-900 font-extrabold underline">
                Qual o nosso propósito?
              </a>
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