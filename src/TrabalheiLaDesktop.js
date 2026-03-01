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
  error, isAuthenticated, selectedCompanyData,
  calcularMedia, getMedalColor, getMedalEmoji, getBadgeColor,
  safeCompanyOptions,
}) {
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem",
      padding: "0.25rem",
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
    <div className="flex flex-col items-end w-full md:w-2/3">
      <div className="flex items-center space-x-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar key={i} active={i < value} onClick={() => setValue(i + 1)} label={`${i + 1} estrelas para ${label}`} />
        ))}
        <span className="ml-2 text-slate-700 font-medium">{value}/5</span>
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 mt-1"
        placeholder={`Comentário sobre ${label} (opcional)`}
        value={commentValue}
        onChange={(e) => setCommentValue(e.target.value)}
      />
    </div>
  );

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "0.0";
  const companyLogo = selectedCompanyData?.logo || null;
  const companyName = selectedCompanyData?.company || "Selecione uma Empresa";

  const formFields = [
    { label: "Cultura e Valores", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="text-yellow-400" /> },
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-400" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-400" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-gray-400" /> },
    { label: "Acesso à Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-purple-400" /> },
    { label: "Plano de Carreiras", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-orange-400" /> },
    { label: "Bem-estar", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-red-400" /> },
    { label: "Cultura de Inovação", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-yellow-300" /> },
  ];

  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center p-4">
      <div className="w-full max-w-6xl">

        {/* CABEÇALHO */}
        <header className="w-full mb-8 rounded-3xl shadow-xl overflow-hidden border border-blue-200">
          <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 py-3 px-6 overflow-hidden">
            <div className="flex whitespace-nowrap animate-marquee">
              {[...Array(6)].map((_, i) => (
                <span key={i} className="text-white font-bold text-sm tracking-widest mx-12 drop-shadow-md">
                  ⭐ TRABALHEI LÁ &nbsp;&nbsp; • &nbsp;&nbsp; Avaliações Anônimas e Verificadas &nbsp;&nbsp; • &nbsp;&nbsp; Sua opinião importa
                </span>
              ))}
            </div>
          </div>
          <div className="bg-blue-50 p-5 flex items-center justify-between">
            <div className="flex flex-col items-center w-1/4">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo da Empresa" className="w-24 h-auto mb-2 object-contain" />
              ) : (
                <div className="w-24 h-16 flex items-center justify-center bg-gray-200 rounded-xl mb-2 text-gray-500 text-xs text-center px-2">
                  Logo da Empresa
                </div>
              )}
              <p className="text-xl font-extrabold text-indigo-800">NOTA {companyNote}/5</p>
              <p className="text-sm text-gray-600 font-medium">{companyName}</p>
            </div>
            <div className="flex flex-col items-center w-2/4 px-4">
              <h1 className="text-5xl font-extrabold text-indigo-800 mb-1 drop-shadow-md tracking-tight">
                TRABALHEI LÁ
              </h1>
              <p className="text-slate-600 text-sm mb-1">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-green-700 text-sm font-semibold flex items-center gap-3 mt-2">
                <span>✓ Anônimo</span>
                <span>✓ Verificado</span>
                <span>✓ Confiável</span>
              </p>
            </div>
            <div className="w-1/4 flex flex-col items-end">
              <h2 className="text-lg font-bold text-slate-700 mb-3">🏆 Melhores Empresas</h2>
              <div className="space-y-2 w-full">
                {(top3 || []).length === 0 ? (
                  <p className="text-gray-400 text-xs text-center">Nenhuma empresa ainda.</p>
                ) : (
                  (top3 || []).map((emp, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 shadow border border-gray-100">
                      <span className="text-lg">{getMedalEmoji(index)}</span>
                      <span className="flex-1 font-semibold text-gray-800 text-sm mx-2">{emp.company}</span>
                      <span className="text-yellow-500 font-bold text-sm">{calcularMedia(emp)} ⭐</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </header>
                {/* CONTEÚDO PRINCIPAL */}
        <div className="flex gap-6 mb-8">

          {/* COLUNA ESQUERDA */}
          <div className="flex-1 flex flex-col gap-6">

            {/* LOGIN */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">Login para Avaliar</h2>
              <div className="flex flex-col space-y-4">
                <button onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all">
                  <FcGoogle className="mr-3 text-2xl" /> Entrar com Google
                </button>
                <LoginLinkedInButton clientId={linkedInClientId} onLoginSuccess={handleLinkedInLogin}
                  className="w-full flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-blue-800 transition-all" />
              </div>
            </section>

            {/* FORMULÁRIO */}
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">Avalie uma Empresa</h2>
              <div className="mb-4">
                <label className="block text-slate-700 font-semibold mb-2">Selecione a Empresa</label>
                <Select options={safeCompanyOptions} value={company} onChange={setCompany}
                  placeholder="Buscar ou selecionar empresa..." isClearable styles={selectStyles} />
              </div>
              {showNewCompanyInput ? (
                <div className="mb-4 flex gap-2">
                  <input type="text"
                    className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Nome da nova empresa" value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)} />
                  <button onClick={handleAddNewCompany}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-all">
                    Adicionar
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowNewCompanyInput(true)}
                  className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all mb-4">
                  <FaPlus /> Adicionar Nova Empresa
                </button>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                {formFields.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0 flex items-center gap-2">
                      {item.icon} {item.label}
                    </label>
                    {renderStars(item.value, item.set, item.comment, item.setComment, item.label)}
                  </div>
                ))}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 mb-2 block">Comentário Geral</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3} placeholder="Conte sua experiência geral..."
                    value={generalComment} onChange={(e) => setGeneralComment(e.target.value)} />
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <div className="text-center pt-2">
                  <button type="submit"
                    className={`py-3 px-10 rounded-2xl font-bold text-white text-lg shadow-lg transition-all transform hover:scale-105 ${
                      isAuthenticated ? "bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90" : "bg-gray-400 cursor-not-allowed"
                    }`}
                    disabled={!isAuthenticated || isLoading}>
                    {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* COLUNA DIREITA - RANKING */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200 sticky top-4">
              <h2 className="text-xl font-bold text-slate-700 text-center mb-4">Ranking de Empresas</h2>
              <div className="flex justify-center mb-4">
                <img src="/trofeu.png" alt="Troféu" className="w-16 h-16 object-contain" />
              </div>
              {(top3 || []).length > 0 && (
                <div className="space-y-3 mb-4">
                  {(top3 || []).map((emp, index) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={index} className={`bg-gradient-to-r ${getMedalColor(index)} rounded-2xl p-3 text-white shadow-md`}>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">{getMedalEmoji(index)}</span>
                          <div className="flex-1 mx-2">
                            <p className="font-bold text-sm">{emp.company}</p>
                          </div>
                          <div className="bg-white/20 px-2 py-1 rounded-full font-bold text-sm">{media} ⭐</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {(empresas || []).length === 0 ? (
                  <div className="text-center py-8">
                    <FaChartBar className="text-gray-300 text-4xl mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Nenhuma avaliação ainda.</p>
                  </div>
                ) : (
                  (empresas || []).slice(3).map((emp, index) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={index} className="bg-gray-50 rounded-2xl p-3 border border-gray-200 hover:border-purple-300 transition-all">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-gray-800 text-sm">{emp.company}</p>
                          <div className={`${getBadgeColor(media)} px-2 py-1 rounded-full text-white font-bold text-xs`}>{media} ⭐</div>
                        </div>
                        {emp.comment && (
                          <p className="text-xs text-gray-500 italic mt-1">"{emp.comment.substring(0, 60)}..."</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #8b5cf6, #ec4899); border-radius: 10px; }
                .animate-marquee { animation: marquee 20s linear infinite; }
                @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
              `}</style>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <footer className="w-full px-6 py-8 text-center">
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

                  { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-gray-400" /> },
                  { label: "Acessibilidade da Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-purple-400" /> },
                  { label: "Plano de Carreiras", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-orange-400" /> },
                  { label: "Bem-estar", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-red-400" /> },
                  { label: "Estimulação e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-yellow-400" /> },
                ].map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0 flex items-center gap-2">
                      {item.icon} {item.label}
                    </label>
                    {renderStars(item.value, item.set, item.comment, item.setComment, item.label)}
                  </div>
                ))}

                <div>
                  <label className="font-semibold text-slate-700 mb-2 block">Comentário Geral</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Descreva sua experiência geral na empresa..."
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                    rows={4}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isAuthenticated || isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg hover:opacity-90 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
                </button>

              </form>
            </section>

          </div>

          {/* COLUNA DIREITA - RANKING */}
          <div className="w-80">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-slate-200 sticky top-6">
              <h2 className="text-xl font-bold text-slate-700 text-center mb-4">🏆 Ranking de Empresas</h2>

              {Array.isArray(top3) && top3.length > 0 && (
                <div className="mb-4 space-y-3">
                  {top3.map((emp, index) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={index} className={`bg-gradient-to-r ${getMedalColor(index)} rounded-2xl p-3 text-white`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getMedalEmoji(index)}</span>
                            <div>
                              <p className="font-bold text-sm">{emp.company}</p>
                            </div>
                          </div>
                          <div className="bg-white/20 px-2 py-1 rounded-full font-bold text-sm">{media} ⭐</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                {Array.isArray(empresas) && empresas.length === 0 ? (
                  <div className="text-center py-8">
                    <FaChartBar className="text-gray-300 text-4xl mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Nenhuma avaliação ainda</p>
                  </div>
                ) : (
                  (empresas || []).slice(3).map((emp, index) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={index} className="bg-gray-50 rounded-2xl p-3 border border-gray-200 hover:border-purple-300 transition-all">
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

        <footer className="w-full px-6 py-8 text-center">
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