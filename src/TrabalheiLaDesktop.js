import React from "react";
import { FaStar, FaChartBar, FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";

function OutlinedStar({ active, onClick, size = 18, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ padding: 0, margin: 0, border: 0, background: "transparent", cursor: "pointer", lineHeight: 0 }}>
      <span style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle" }}>
        <span style={{ position: "absolute", left: 0, top: 0, transform: "scale(1.24)", transformOrigin: "center" }} aria-hidden="true">
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
  company, setCompany, newCompany, setNewCompany,
  rating, setRating, contatoRH, setContatoRH,
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
  handleSubmit, isLoading, empresas, top3,
  showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
  linkedInClientId, handleLinkedInLogin, handleGoogleLogin,
  error, isAuthenticated,
  calcularMedia, getMedalColor, getMedalEmoji, getBadgeColor,
  safeCompanyOptions,
}) {
  const selectStyles = {
    control: (base, state) => ({
      ...base, borderRadius: "0.75rem", padding: "0.25rem",
      borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #8b5cf6" : "none",
      "&:hover": { borderColor: "#d1d5db" },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#ede9fe" : "white",
      color: "#4a4a4a",
    }),
    singleValue: (base) => ({ ...base, color: "#4a4a4a" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
  };

  const renderStars = (value, setValue, commentValue, setCommentValue, label) => (
    <div className="flex flex-col items-end w-2/3">
      <div className="flex items-center space-x-1 mb-1">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar key={i} active={i < value} onClick={() => setValue(i + 1)} label={`${i + 1} estrelas para ${label}`} />
        ))}
        <span className="ml-2 text-slate-700 font-medium text-sm">{value}/5</span>
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
        placeholder={`Comentário sobre ${label} (opcional)`}
        rows={2}
        value={commentValue}
        onChange={(e) => setCommentValue(e.target.value)}
      />
    </div>
  );

  const campos = [
    { label: "Avaliação Geral", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="text-yellow-500" /> },
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-indigo-500" /> },
    { label: "Acessibilidade à Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-red-500" /> },
    { label: "Plano de Carreira", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-purple-500" /> },
    { label: "Bem-estar", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-pink-500" /> },
    { label: "Estímulo à Inovação", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-teal-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center">

      {/* HEADER MARQUEE */}
      <header className="w-full bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 py-4 shadow-lg overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="text-white font-extrabold text-2xl tracking-widest mx-16 drop-shadow-lg">
              ★ TRABALHEI LÁ &nbsp;&nbsp; AVALIE SUA EMPRESA &nbsp;&nbsp; ANÔNIMO &nbsp;&nbsp; VERIFICADO &nbsp;&nbsp; CONFIÁVEL
            </span>
          ))}
        </div>
        <style>{`
          .animate-marquee { animation: marquee 25s linear infinite; }
          @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        `}</style>
      </header>

      <div className="w-full max-w-6xl px-6 py-8">

        {/* TÍTULO */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold text-indigo-800 drop-shadow-md mb-2">TRABALHEI LÁ</h1>
          <p className="text-slate-600 text-lg">Avaliações anônimas feitas por profissionais verificados</p>
        </div>

        {/* DUAS COLUNAS */}
        <div className="flex gap-6">

          {/* COLUNA ESQUERDA */}
          <div className="flex-1 space-y-6">

            {/* LOGIN */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-700 text-center mb-4">Login para Avaliar</h2>
              <div className="space-y-3">
                <button onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all">
                  <FcGoogle className="mr-3 text-2xl" />
                  Entrar com Google
                </button>
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  onLoginSuccess={handleLinkedInLogin}
                  className="w-full flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-blue-800 transition-all"
                />
              </div>
            </section>

            {/* FORMULÁRIO */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200">
              <h2 className="text-xl font-bold text-slate-700 text-center mb-4">Avalie uma Empresa</h2>

              <div className="mb-4">
                <Select
                  options={safeCompanyOptions}
                  value={safeCompanyOptions.find((o) => o.value === company) || null}
                  onChange={(opt) => opt && setCompany(opt.value)}
                  placeholder="Buscar ou selecionar empresa..."
                  isClearable
                  styles={selectStyles}
                />
              </div>

              {showNewCompanyInput ? (
                <div className="flex gap-2 mb-4">
                  <input type="text"
                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder="Nome da nova empresa"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                  />
                  <button onClick={handleAddNewCompany}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all text-sm">
                    Adicionar
                  </button>
                </div>
              ) : null}

              <button onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-xl mb-4 text-sm transition-all">
                <FaPlus />
                {showNewCompanyInput ? "Cancelar" : "Adicionar Nova Empresa"}
              </button>

              <form onSubmit={handleSubmit} className="space-y-3">
                {campos.map((campo, i) => (
                  <div key={i} className="flex items-start justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <label className="w-1/3 text-slate-700 font-semibold text-sm flex items-center gap-1 pt-1">
                      {campo.icon} {campo.label}
                    </label>
                    {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                  </div>
                ))}

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <label className="text-slate-700 font-semibold text-sm block mb-2">Comentário Geral</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Descreva sua experiência na empresa..."
                    rows={3}
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  />
                </div>

                {error && <p className="text-red-600 text-center text-sm font-medium">{error}</p>}

                <div className="text-center pt-2">
                  <button type="submit"
                    className={`px-8 py-3 rounded-full font-extrabold text-white transition-all ${isAuthenticated ? "bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-xl hover:scale-105" : "bg-slate-400 cursor-not-allowed opacity-60"}`}
                    disabled={!isAuthenticated || isLoading}>
                    {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
                  </button>
                </div>
              </form>
            </section>

          </div>

          {/* COLUNA DIREITA — RANKING */}
          <div className="w-80">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200 sticky top-6">
              <h2 className="text-xl font-bold text-slate-700 text-center mb-4">🏆 Ranking de Empresas</h2>

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
                      <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-purple-300 transition-all">
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

        </div>

        {/* FOOTER */}
        <footer className="mt-8 text-center">
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
            <p className="text-slate-700 text-sm">
              <a href="/politica-de-privacidade.html" className="text-indigo-700 hover:text-indigo-900 font-extrabold underline">
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