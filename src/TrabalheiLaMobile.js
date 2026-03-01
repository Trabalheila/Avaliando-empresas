import React from "react";
import {
  FaStar,
  FaChartBar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaHeart,
  FaBriefcase,
  FaLightbulb,
  FaPlus,
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";

/** ⭐ Estrela com contorno preto */
function OutlinedStar({ active, onClick, size = 18, label }) {
  const outlineScale = 1.24;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        padding: 0, margin: 0, border: 0,
        background: "transparent", cursor: "pointer", lineHeight: 0,
      }}
    >
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
  company,
  setCompany,
  newCompany,
  setNewCompany,
  rating,
  setRating,
  contatoRH,
  setContatoRH,
  salarioBeneficios,
  setSalarioBeneficios,
  estruturaEmpresa,
  setEstruturaEmpresa,
  acessibilidadeLideranca,
  setAcessibilidadeLideranca,
  planoCarreiras,
  setPlanoCarreiras,
  bemestar,
  setBemestar,
  estimulacaoOrganizacao,
  setEstimulacaoOrganizacao,
  commentRating,
  setCommentRating,
  commentContatoRH,
  setCommentContatoRH,
  commentSalarioBeneficios,
  setCommentSalarioBeneficios,
  commentEstruturaEmpresa,
  setCommentEstruturaEmpresa,
  commentAcessibilidadeLideranca,
  setCommentAcessibilidadeLideranca,
  commentPlanoCarreiras,
  setCommentPlanoCarreiras,
  commentBemestar,
  setCommentBemestar,
  commentEstimulacaoOrganizacao,
  setCommentEstimulacaoOrganizacao,
  generalComment,
  setGeneralComment,
  handleSubmit,
  isLoading,
  empresas,
  top3,
  showNewCompanyInput,
  setShowNewCompanyInput,
  handleAddNewCompany,
  linkedInClientId,
  handleLinkedInLogin,
  handleGoogleLogin,
  error,
  isAuthenticated,
  selectedCompanyData, // ✅ NOVO: Recebendo os dados da empresa selecionada
  calcularMedia, // ✅ NOVO: Recebendo a função calcularMedia
  getMedalColor, // ✅ NOVO: Recebendo a função getMedalColor
  getMedalEmoji, // ✅ NOVO: Recebendo a função getMedalEmoji
  getBadgeColor, // ✅ NOVO: Recebendo a função getBadgeColor
  safeCompanyOptions, // ✅ NOVO: Recebendo as opções de empresa para o Select
}) {
  // ✅ REMOVIDO: Funções auxiliares não são mais definidas localmente, pois são passadas via props

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

  // ✅ NOVO: Dados para o cabeçalho dinâmico
  const headerCompany = selectedCompanyData || {
    company: "Selecione uma Empresa",
    logo: "https://via.placeholder.com/50/CCCCCC/FFFFFF?text=Logo",
    rating: 0, contatoRH: 0, salarioBeneficios: 0, estruturaEmpresa: 0,
    acessibilidadeLideranca: 0, planoCarreiras: 0, bemestar: 0, estimulacaoOrganizacao: 0,
  };
  const headerMedia = calcularMedia(headerCompany);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">

        {/* Cabeçalho */}
        <header className="bg-blue-200 rounded-3xl shadow-xl p-6 mb-8 border border-blue-300 flex flex-col md:flex-row items-center justify-between text-center md:text-left">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0 md:w-1/4">
            <img
              src={headerCompany.logo} // ✅ DINÂMICO
              alt={`Logo da ${headerCompany.company}`}
              className="w-24 h-auto mb-2"
            />
            <p className="text-xl font-bold text-slate-700">NOTA {headerMedia}/5</p> {/* ✅ DINÂMICO */}
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
              onLoginSuccess={handleLinkedInLogin}
              className="w-full flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105"
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
              options={safeCompanyOptions} // ✅ USANDO safeCompanyOptions
              value={company ? { value: company, label: company } : null}
              onChange={(selectedOption) => selectedOption && setCompany(selectedOption.value)}
              placeholder="Buscar ou selecionar empresa..."
              isClearable
              styles={selectStyles}
            />
            <button
              onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
              className="mt-3 w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all transform hover:scale-105"
            >
              <FaPlus className="mr-2" /> Adicionar Nova Empresa
            </button>
            {showNewCompanyInput && (
              <div className="mt-4 flex">
                <input
                  type="text"
                  className="flex-1 p-3 border border-gray-300 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nome da nova empresa"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
                <button
                  onClick={handleAddNewCompany}
                  className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-r-xl shadow-md transition-all"
                >
                  Adicionar
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Seções de Avaliação */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Avaliação Geral:
                </label>
                {renderStars(rating, setRating, commentRating, setCommentRating, "Avaliação Geral")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Contato com RH:
                </label>
                {renderStars(contatoRH, setContatoRH, commentContatoRH, setCommentContatoRH, "Contato com RH")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Salário e Benefícios:
                </label>
                {renderStars(salarioBeneficios, setSalarioBeneficios, commentSalarioBeneficios, setCommentSalarioBeneficios, "Salário e Benefícios")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Estrutura da Empresa:
                </label>
                {renderStars(estruturaEmpresa, setEstruturaEmpresa, commentEstruturaEmpresa, setCommentEstruturaEmpresa, "Estrutura da Empresa")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Acessibilidade à Liderança:
                </label>
                {renderStars(acessibilidadeLideranca, setAcessibilidadeLideranca, commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca, "Acessibilidade à Liderança")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Plano de Carreiras:
                </label>
                {renderStars(planoCarreiras, setPlanoCarreiras, commentPlanoCarreiras, setCommentPlanoCarreiras, "Plano de Carreiras")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Bem-estar e Ambiente:
                </label>
                {renderStars(bemestar, setBemestar, commentBemestar, setCommentBemestar, "Bem-estar e Ambiente")}
              </div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label className="font-semibold text-slate-700 w-full md:w-1/3 mb-2 md:mb-0">
                  Estímulo à Organização:
                </label>
                {renderStars(estimulacaoOrganizacao, setEstimulacaoOrganizacao, commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao, "Estímulo à Organização")}
              </div>

              {/* Comentário Geral */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                <label htmlFor="general-comment" className="font-semibold text-slate-700 mb-3 block">
                  Comentário Geral:
                </label>
                <textarea
                  id="general-comment"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                  placeholder="Escreva seu comentário geral sobre a empresa..."
                  value={generalComment}
                  onChange={(e) => setGeneralComment(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-red-600 text-center font-medium my-4">{error}</p>
              )}

              <div className="text-center mt-6">
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

        </div>

        <footer className="w-full max-w-4xl px-6 py-8 text-center">
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

export default TrabalheiLaMobile;