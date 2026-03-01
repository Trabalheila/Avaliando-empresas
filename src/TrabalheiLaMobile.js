import React from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave,
  FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus,
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";

function OutlinedStar({ active, onClick, size = 18, label }) {
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
    <div className="flex flex-col items-end w-full md:w-2/3">
      <div className="flex items-center space-x-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar
            key={i}
            active={i < value}
            onClick={() => setValue(i + 1)}
            label={`${i + 1} estrelas para ${label}`}
          />
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">

        {/* Cabeçalho */}
        <header className="bg-blue-200 rounded-3xl shadow-xl p-6 mb-8 border border-blue-300 flex flex-col md:flex-row items-center justify-between text-center md:text-left">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0 md:w-1/4">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Petrobras_logo.svg/1200px-Petrobras_logo.svg.png"
              alt="Logo da Empresa"
              className="w-24 h-auto mb-2"
            />
            <p className="text-xl font-bold text-slate-700">NOTA 4.5/5</p>
          </div>

          <div className="flex flex-col items-center md:w-1/2 px-4">
            <h1 className="text-4xl font-extrabold text-indigo-800 mb-2 drop-shadow-md">
              TRABALHEI LÁ
            </h1>
            <p className="text-slate-700 text-sm mb-1">
              Sua opinião é anônima e ajuda outros profissionais
            </p>
            <p className="text-slate-600 text-xs mb-4">
              Avaliações anônimas feitas por profissionais verificados.
            </p>
            <button className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 mb-4">
              CLIQUE E SAIBA MAIS
            </button>
            <p className="text-green-700 text-sm font-semibold flex items-center gap-2">
              <span>✓ Anônimo</span>
              <span>✓ Verificado</span>
              <span>✓ Confiável</span>
            </p>
          </div>

          <div className="md:w-1/4 flex flex-col items-center md:items-end mt-4 md:mt-0">
            <h2 className="text-xl font-bold text-slate-700 mb-3">Melhores Empresas</h2>
            <div className="space-y-2 w-full">
              {Array.isArray(top3) && top3.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">Nenhuma empresa no ranking ainda.</p>
              ) : (
                (top3 || []).map((emp, index) => (
                  <div key={index} className="flex items-center justify-between bg-white rounded-lg p-2 shadow-sm border border-gray-200">
                    <span className="text-lg mr-2">{getMedalEmoji(index)}</span>
                    <span className="font-medium text-gray-800 flex-1 text-left">{emp.company}</span>
                    <span className="text-yellow-500 font-bold">{calcularMedia(emp)} ⭐</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </header>

        {/* Login */}
        <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mb-6">
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">Login para Avaliar</h2>
          <div className="flex flex-col space-y-4">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105"
            >
              <FcGoogle className="mr-3 text-2xl" />
              Entrar com Google
            </button>
            <LoginLinkedInButton
  clientId={linkedInClientId}
  redirectUri={process.env.REACT_APP_LINKEDIN_REDIRECT_URI}
  onLoginSuccess={handleLinkedInLogin}
  onLoginFailure={(err) => setError("Falha no login LinkedIn.")}
/>
          </div>
        </section>

        {/* Formulário */}
        <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mb-6">
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">Avalie uma Empresa</h2>

          <div className="mb-6">
            <label htmlFor="company-select" className="block text-slate-700 text-lg font-semibold mb-3">
              Selecione a Empresa
            </label>
            <Select
              id="company-select"
              options={safeCompanyOptions}
              value={company}
              onChange={setCompany}
              placeholder="Buscar ou selecionar empresa..."
              isClearable
              styles={selectStyles}
            />
          </div>

          {showNewCompanyInput ? (
            <div className="mb-6">
              <label htmlFor="new-company-name" className="block text-slate-700 text-lg font-semibold mb-3">
                Nome da Nova Empresa
              </label>
              <input
                type="text"
                id="new-company-name"
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Digite o nome da nova empresa"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
              />
              <button
                onClick={handleAddNewCompany}
                className="mt-3 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-all"
              >
                Adicionar Empresa
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCompanyInput(true)}
              className="w-full flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all mb-6"
            >
              <FaPlus className="mr-2" /> Adicionar Nova Empresa
            </button>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-6 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaStar className="mr-2 text-yellow-500" /> Avaliação Geral
                </label>
                {renderStars(rating, setRating, commentRating, setCommentRating, "Avaliação Geral")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaHandshake className="mr-2 text-blue-500" /> Contato com RH
                </label>
                {renderStars(contatoRH, setContatoRH, commentContatoRH, setCommentContatoRH, "Contato com RH")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaMoneyBillWave className="mr-2 text-green-500" /> Salário e Benefícios
                </label>
                {renderStars(salarioBeneficios, setSalarioBeneficios, commentSalarioBeneficios, setCommentSalarioBeneficios, "Salário e Benefícios")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaBuilding className="mr-2 text-indigo-500" /> Estrutura da Empresa
                </label>
                {renderStars(estruturaEmpresa, setEstruturaEmpresa, commentEstruturaEmpresa, setCommentEstruturaEmpresa, "Estrutura da Empresa")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaUserTie className="mr-2 text-red-500" /> Acessibilidade à Liderança
                </label>
                {renderStars(acessibilidadeLideranca, setAcessibilidadeLideranca, commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca, "Acessibilidade à Liderança")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaBriefcase className="mr-2 text-purple-500" /> Plano de Carreiras
                </label>
                {renderStars(planoCarreiras, setPlanoCarreiras, commentPlanoCarreiras, setCommentPlanoCarreiras, "Plano de Carreiras")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaHeart className="mr-2 text-pink-500" /> Bem-estar e Qualidade de Vida
                </label>
                {renderStars(bemestar, setBemestar, commentBemestar, setCommentBemestar, "Bem-estar e Qualidade de Vida")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center mb-2 md:mb-0">
                  <FaLightbulb className="mr-2 text-orange-500" /> Estímulo e Organização
                </label>
                {renderStars(estimulacaoOrganizacao, setEstimulacaoOrganizacao, commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao, "Estímulo e Organização")}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-slate-700 font-semibold text-lg block mb-2">Comentário Geral</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Deixe um comentário geral sobre a empresa (opcional)"
                rows="4"
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />
            </div>

            {error && <p className="text-red-500 text-center mb-4">{error}</p>}

            <div className="text-center">
              <button
                type="submit"
                className={`px-8 py-4 rounded-full font-extrabold text-white text-lg transition-all transform ${
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

        {/* Ranking */}
        <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mb-6">
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-4">🏆 Ranking de Empresas</h2>

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

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {Array.isArray(empresas) && empresas.length === 0 ? (
              <div className="text-center py-6">
                <FaChartBar className="text-gray-300 text-4xl mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Nenhuma avaliação ainda</p>
              </div>
            ) : (
              (empresas || []).slice(3).map((emp, i) => {
                const media = calcularMedia(emp);
                return (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
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