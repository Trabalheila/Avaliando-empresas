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

function TrabalheiLaMobile({
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
  selectedCompanyData, calcularMedia,
  getMedalColor, getMedalEmoji, getBadgeColor,
  safeCompanyOptions,
}) {
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem",
      padding: "0.25rem",
      borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #8b5cf6" : "none",
      "&:hover": { borderColor: state.isFocused ? "#8b5cf6" : "#d1d5db" },
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
    <div className="flex flex-col w-full">
      <div className="flex items-center space-x-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar key={i} active={i < value} onClick={() => setValue(i + 1)} label={`${i + 1} estrelas para ${label}`} />
        ))}
        <span className="ml-2 text-slate-700 font-medium">{value}/5</span>
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        placeholder={`Comentário sobre ${label} (opcional)`}
        value={commentValue}
        onChange={(e) => setCommentValue(e.target.value)}
      />
    </div>
  );

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "0.0";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl">

        {/* CABEÇALHO */}
        <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <FaBuilding className="text-white text-3xl" />
              </div>
              <span className="text-xs mt-1 text-white/80">Logo da Empresa</span>
            </div>
            <div className="flex-1 text-center px-4">
              <h1 className="text-3xl font-extrabold drop-shadow-md tracking-wide">TRABALHEI LÁ</h1>
              <p className="text-white/90 text-sm mt-1">Sua opinião é anônima e ajuda outros profissionais</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white/20 rounded-2xl px-4 py-2 text-center">
                <p className="text-2xl font-extrabold">{companyNote}</p>
                <p className="text-xs text-white/80">NOTA /5</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm font-semibold">
            <span>✓ Anônimo</span>
            <span>✓ Verificado</span>
            <span>✓ Confiável</span>
          </div>
        </header>

        {/* RANKING TOP 3 */}
        {Array.isArray(top3) && top3.length > 0 && (
          <section className="bg-white rounded-3xl shadow-xl p-5 mb-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-700 text-center mb-4">🏆 Melhores Empresas</h2>
            <div className="space-y-2">
              {top3.map((emp, index) => (
                <div key={index} className={`bg-gradient-to-r ${getMedalColor(index)} rounded-xl p-3 text-white flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getMedalEmoji(index)}</span>
                    <span className="font-bold text-sm">{emp.company}</span>
                  </div>
                  <span className="font-bold text-sm bg-white/20 px-2 py-1 rounded-full">{calcularMedia(emp)} ⭐</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* LOGIN */}
        <section className="bg-white rounded-3xl shadow-xl p-5 mb-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-700 text-center mb-4">Login para Avaliar</h2>
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all"
            >
              <FcGoogle className="mr-3 text-2xl" />
              Entrar com Google
            </button>
            <LoginLinkedInButton
              clientId={linkedInClientId}
              onSuccess={handleLinkedInLogin}
              onError={(e) => console.error(e)}
            />
          </div>
        </section>

        {/* FORMULÁRIO */}
        <section className="bg-white rounded-3xl shadow-xl p-5 mb-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-700 text-center mb-4">Avalie uma Empresa</h2>
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
                <input
                  type="text"
                  className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nome da nova empresa"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
                <button type="button" onClick={handleAddNewCompany}
                  className="px-4 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all">
                  Adicionar
                </button>
              </div>
            )}

            <button type="button" onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:opacity-90 transition-all">
              <FaPlus />
              {showNewCompanyInput ? "Cancelar" : "Adicionar Nova Empresa"}
            </button>

            {[
              { label: "Cultura e Valores", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="text-yellow-400" /> },
              { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-400" /> },
              { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-400" /> },
              { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-gray-400" /> },
              { label: "Acesso à Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-purple-400" /> },
              { label: "Plano de Carreiras", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-orange-400" /> },
              { label: "Bem-estar e Ambiente", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-red-400" /> },
              { label: "Estímulo à Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-yellow-300" /> },
            ].map(({ label, value, set, comment, setComment, icon }) => (
              <div key={label} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  {icon}
                  <label className="font-semibold text-slate-700 text-sm">{label}</label>
                </div>
                {renderStars(value, set, comment, setComment, label)}
              </div>
            ))}

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="font-semibold text-slate-700 mb-2 block">Comentário Geral</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                placeholder="Escreva seu comentário geral sobre a empresa..."
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-center font-medium">{error}</p>}

            <button type="submit"
              className={`w-full py-4 rounded-full font-extrabold text-white text-lg transition-all ${isAuthenticated ? "bg-gradient-to-r from-purple-600 to-violet-600 hover:opacity-90" : "bg-slate-400 cursor-not-allowed opacity-60"}`}
              disabled={!isAuthenticated || isLoading}>
              {isLoading ? "Enviando..." : isAuthenticated ? "Enviar avaliação" : "Faça login para avaliar"}
            </button>
          </form>
        </section>

        {/* OUTRAS AVALIAÇÕES */}
        <section className="bg-white rounded-3xl shadow-xl p-5 mb-6 border border-slate-200">
          <h2 className="text-xl font-bold text-slate-700 text-center mb-4">Outras Avaliações</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {Array.isArray(empresas) && empresas.length === 0 ? (
              <div className="text-center py-8">
                <FaChartBar className="text-gray-300 text-5xl mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhuma avaliação ainda</p>
              </div>
            ) : (
              (empresas || []).map((emp, t) => {
                const media = calcularMedia(emp);
                return (
                  <div key={t} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 border-2 border-gray-200 hover:border-purple-400 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 text-sm">{emp.company}</h3>
                        <p className="text-xs text-gray-500 mt-1">{emp.area} • {emp.periodo}</p>
                      </div>
                      <div className={`${getBadgeColor(media)} px-2 py-1 rounded-full text-white font-bold text-xs shadow`}>
                        {media} ⭐
                      </div>
                    </div>
                    {emp.comment && (
                      <p className="text-xs text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                        "{emp.comment.substring(0, 100)}{emp.comment.length > 100 ? "..." : ""}"
                      </p>
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
          `}</style>
        </section>

        {/* FOOTER */}
        <footer className="w-full px-4 py-6 text-center">
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
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

export default TrabalheiLaMobile;