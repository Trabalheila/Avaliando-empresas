import React from "react";
import { FaStar, FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaChartBar } from "react-icons/fa";
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
  error, isAuthenticated, calcularMedia, getMedalEmoji, getBadgeColor,
}) {
  const selectStyles = {
    control: (base, state) => ({
      ...base, borderRadius: "0.75rem", padding: "0.25rem",
      borderColor: state.isFocused ? "#1d4ed8" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #1d4ed8" : "none",
      "&:hover": { borderColor: "#93c5fd" },
    }),
    option: (base, state) => ({
      ...base, backgroundColor: state.isFocused ? "#dbeafe" : "white", color: "#1e3a8a",
    }),
    singleValue: (base) => ({ ...base, color: "#1e3a8a" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
  };

  const renderStars = (value, setValue, commentValue, setCommentValue, label) => (
    <div className="flex flex-col items-end w-full">
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
    { label: "Cultura e Valores", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FaStar className="mr-2 text-yellow-500" /> },
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="mr-2 text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="mr-2 text-green-500" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="mr-2 text-indigo-500" /> },
    { label: "Acessibilidade à Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="mr-2 text-red-500" /> },
    { label: "Plano de Carreira", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="mr-2 text-indigo-500" /> },
    { label: "Bem-estar", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="mr-2 text-pink-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="mr-2 text-orange-400" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center p-4">
      <style>{`@import url('https://fonts.cdnfonts.com/css/azonix'); .font-azonix { font-family: 'Azonix', sans-serif; }`}</style>
      <div className="w-full max-w-2xl">

        {/* HEADER */}
        <header className="bg-white rounded-3xl shadow-xl p-6 mb-6 border-2 border-blue-200">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl font-extrabold text-blue-800 mb-1 font-azonix drop-shadow">TRABALHEI LÁ</h1>
            <p className="text-blue-600 text-sm mb-1">Sua opinião é anônima e ajuda outros profissionais</p>
            <p className="text-blue-400 text-xs mb-4">Avaliações anônimas feitas por profissionais verificados.</p>
            <button className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded-xl shadow transition-all mb-3 font-azonix text-sm">
              CLIQUE E SAIBA MAIS
            </button>
            <p className="text-blue-700 text-xs font-semibold flex gap-3">
              <span>✓ Anônimo</span><span>✓ Verificado</span><span>✓ Confiável</span>
            </p>
          </div>
        </header>

        {/* RANKING */}
        <section className="bg-white rounded-3xl shadow-xl p-5 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 mb-3 text-center font-azonix">🏆 Melhores Empresas</h2>
          <div className="space-y-2">
            {Array.isArray(top3) && top3.length === 0 ? (
              <div className="text-center py-4">
                <FaChartBar className="text-gray-300 text-3xl mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma avaliação ainda</p>
              </div>
            ) : (
              (top3 || []).map((emp, i) => (
                <div key={i} className="flex items-center justify-between bg-blue-50 rounded-xl p-3 border border-blue-200">
                  <span className="text-xl mr-2">{getMedalEmoji(i)}</span>
                  <span className="font-semibold text-blue-800 flex-1">{emp.company}</span>
                  <span className={`${getBadgeColor(calcularMedia(emp))} text-white text-xs font-bold px-2 py-1 rounded-full`}>{calcularMedia(emp)} ⭐</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* LOGIN */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-5 font-azonix">Login para Avaliar</h2>
          <div className="flex flex-col space-y-3">
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
          {isAuthenticated && (
            <p className="text-green-600 font-semibold text-center mt-3 text-sm">✓ Você está autenticado!</p>
          )}
        </section>

        {/* FORMULÁRIO */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-5 font-azonix">Avalie uma Empresa</h2>

          <div className="mb-4">
            <label className="block text-slate-700 font-semibold mb-2">Selecione a Empresa</label>
            <Select
              options={(empresas || []).map((e) => ({ value: e.company, label: e.company }))}
              value={company ? { value: company, label: company } : null}
              onChange={(opt) => opt && setCompany(opt.value)}
              placeholder="Buscar empresa..."
              isClearable
              styles={selectStyles}
            />
          </div>

          {showNewCompanyInput ? (
            <div className="mb-4">
              <input type="text"
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                placeholder="Nome da nova empresa"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
              />
              <button onClick={handleAddNewCompany}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-all">
                Adicionar Empresa
              </button>
            </div>
          ) : (
            <button onClick={() => setShowNewCompanyInput(true)}
              className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow mb-4 transition-all">
              <FaPlus className="mr-2" /> Adicionar Nova Empresa
            </button>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 mb-6">
              {campos.map((campo, idx) => (
                <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="text-slate-700 font-semibold flex items-center mb-2">
                    {campo.icon}{campo.label}
                  </label>
                  {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
              <label className="text-slate-700 font-semibold block mb-2">Comentário Geral</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Descreva sua experiência na empresa..."
                rows={3}
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-center text-sm mb-3">{error}</p>}

            <button type="submit"
              className={`w-full py-3 rounded-full font-extrabold text-white transition-all ${isAuthenticated ? "bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-xl hover:scale-105" : "bg-slate-400 cursor-not-allowed opacity-60"}`}
              disabled={!isAuthenticated || isLoading}>
              {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
            </button>
          </form>
        </section>

        <footer className="text-center py-6">
          <div className="bg-white/70 rounded-2xl p-4 border border-blue-100">
            <p className="text-slate-600 text-sm">
              <a href="/politica-de-privacidade.html" className="text-blue-700 hover:text-blue-900 font-bold underline">Política de Privacidade</a>
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