import React from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave,
  FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus,
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";

function OutlinedStar({ active, onClick, size = 20, label }) {
  const outlineScale = 1.24;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ padding: 0, margin: 0, border: 0, background: "transparent", cursor: "pointer", lineHeight: 0 }}>
      <span style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle" }}>
        <span style={{ position: "absolute", left: 0, top: 0, transform: `scale(${outlineScale})`, transformOrigin: "center" }} aria-hidden="true">
          <FaStar size={size} color="#000" />
        </span>
        <span style={{ position: "relative" }} aria-hidden="true">
          <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
        </span>
      </span>
    </button>
  );
}

function TrabalheiLaDesktop({
  company, setCompany,
  newCompany, setNewCompany,
  rating, setRating,
  contatoRH, setContatoRH,
  salarioBeneficios, setSalarioBeneficios,
  estruturaEmpresa, setEstruturaEmpresa,
  acessibilidadeLideranca, setAcessibilidadeLideranca,
  planoCarreiras, setPlanoCarreiras,
  bemestar, setBemestar,
  estimulacaoOrganizacao, setEstimulacaoOrganizacao,
  commentRating, setCommentRating,
  commentContatoRH, setCommentContatoRH,
  commentSalarioBeneficios, setCommentSalarioBeneficios,
  commentEstruturaEmpresa, setCommentEstruturaEmpresa,
  commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca,
  commentPlanoCarreiras, setCommentPlanoCarreiras,
  commentBemestar, setCommentBemestar,
  commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao,
  generalComment, setGeneralComment,
  handleSubmit, isLoading,
  empresas, top3,
  showNewCompanyInput, setShowNewCompanyInput,
  handleAddNewCompany,
  linkedInClientId,
  handleLinkedInLogin, handleGoogleLogin,
  error, isAuthenticated,
  selectedCompanyData,
  safeCompanyOptions,
}) {
  const calcularMedia = (emp) => {
    if (!emp) return 0;
    const sum = emp.rating + emp.contatoRH + emp.salarioBeneficios +
      emp.estruturaEmpresa + emp.acessibilidadeLideranca +
      emp.planoCarreiras + emp.bemestar + emp.estimulacaoOrganizacao;
    return (sum / 8).toFixed(1);
  };

  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-green-500";
    if (media >= 3.5) return "bg-yellow-500";
    return "bg-red-500";
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

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "—";

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem",
      padding: "0.25rem",
      borderColor: state.isFocused ? "#1d4ed8" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #1d4ed8" : "none",
      "&:hover": { borderColor: state.isFocused ? "#1d4ed8" : "#d1d5db" },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#dbeafe" : "white",
      color: "#1e3a8a",
    }),
    singleValue: (base) => ({ ...base, color: "#1e3a8a" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
  };

  const renderStars = (value, setValue, commentValue, setCommentValue, label) => (
    <div className="flex flex-col items-end w-full md:w-2/3">
      <div className="flex items-center space-x-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar key={i} active={i < value} onClick={() => setValue(i + 1)} label={`${i + 1} estrelas para ${label}`} />
        ))}
        <span className="ml-2 text-slate-700 font-medium">{value}/5</span>
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
        placeholder={`Comentário sobre ${label} (opcional)`}
        value={commentValue}
        onChange={(e) => setCommentValue(e.target.value)}
      />
    </div>
  );

  const campos = [
    { label: "Cultura e Valores", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="text-yellow-400" /> },
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-400" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-400" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-indigo-400" /> },
    { label: "Acessibilidade à Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-red-400" /> },
    { label: "Plano de Carreira", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-indigo-400" /> },
    { label: "Bem-estar", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-pink-400" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-400" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center p-6">
      <style>{`@import url('https://fonts.cdnfonts.com/css/azonix'); .font-azonix { font-family: 'Azonix', sans-serif; }`}</style>
      <div className="w-full max-w-6xl">

        {/* HEADER */}
        <header className="bg-white rounded-3xl shadow-2xl p-8 mb-8 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center border-2 border-blue-200">
                <FaBuilding className="text-blue-700 text-4xl" />
              </div>
              <span className="text-xs mt-2 text-blue-400">Logo da Empresa</span>
              <div className="mt-2 bg-blue-700 rounded-xl px-3 py-1 text-center">
                <p className="text-xl font-extrabold text-white">{companyNote}/5</p>
                <p className="text-xs text-blue-200">NOTA</p>
              </div>
            </div>

            <div className="flex-1 text-center px-8">
              <h1 className="text-5xl font-extrabold text-blue-800 drop-shadow tracking-wide mb-3 font-azonix">
                TRABALHEI LÁ
              </h1>
              <p className="text-blue-600 text-lg mb-2">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-blue-400 text-sm mb-6">Avaliações anônimas feitas por profissionais verificados.</p>
              <button className="bg-blue-700 text-white font-extrabold py-3 px-8 rounded-2xl shadow-lg hover:bg-blue-800 transition-all transform hover:scale-105 text-lg font-azonix">
                CLIQUE E SAIBA MAIS
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

            {/* LOGIN */}
            <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6 font-azonix">Login para Avaliar</h2>
              <div className="flex flex-col space-y-4">
                <button onClick={handleGoogleLogin}
                  className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105">
                  <FcGoogle className="mr-3 text-2xl" />
                  Entrar com Google
                </button>
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  onSuccess={handleLinkedInLogin}
                  onError={(e) => console.error(e)}
                />
              </div>
              {isAuthenticated && (
                <p className="text-green-600 font-semibold text-center mt-4">✓ Você está autenticado!</p>
              )}
            </section>

            {/* FORMULÁRIO */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6 font-azonix">Avalie uma Empresa</h2>
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
                  <div className="flex gap-2">
                    <input type="text"
                      className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nome da nova empresa"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                    />
                    <button type="button" onClick={handleAddNewCompany}
                      className="px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
                      Adicionar
                    </button>
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
              <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default TrabalheiLaDesktop;