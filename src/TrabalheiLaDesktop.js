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
        padding: 0,
        margin: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        lineHeight: 0,
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-block",
          width: size,
          height: size,
          verticalAlign: "middle",
        }}
      >
        {/* contorno */}
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

        {/* estrela principal */}
        <span style={{ position: "relative" }} aria-hidden="true">
          <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
        </span>
      </span>
    </button>
  );
}

function TrabalheiLaDesktop({
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
  selectedCompanyData, // ✅ NOVO: Dados da empresa selecionada
  calcularMedia, // ✅ NOVO: Função para calcular média
  getMedalColor, // ✅ NOVO: Função para cores das medalhas
  getMedalEmoji, // ✅ NOVO: Função para emojis das medalhas
  getBadgeColor, // ✅ NOVO: Função para cor do badge
  safeCompanyOptions, // ✅ NOVO: Opções para o Select
}) {
  // ✅ REMOVIDO: calcularMedia, getBadgeColor, getMedalColor, getMedalEmoji agora vêm de props do Home.js

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

  // Dados para o cabeçalho dinâmico
  const currentCompany = selectedCompanyData || {
    company: "Empresa",
    rating: 0,
    contatoRH: 0,
    salarioBeneficios: 0,
    estruturaEmpresa: 0,
    acessibilidadeLideranca: 0,
    planoCarreiras: 0,
    bemestar: 0,
    estimulacaoOrganizacao: 0,
  };
  const currentCompanyMedia = calcularMedia(currentCompany);
  const companyLogo = currentCompany.company === "Petrobras"
    ? "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Petrobras_logo.svg/1200px-Petrobras_logo.svg.png"
    : "/default-company-logo.png"; // Imagem padrão se não for Petrobras

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
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-8">

        {/* Coluna Esquerda: Cabeçalho e Formulário */}
        <div className="w-full md:w-2/3 flex-shrink-0">
          {/* Cabeçalho */}
          <header className="bg-blue-200 rounded-3xl shadow-xl p-6 mb-8 border border-blue-300 flex items-center justify-between text-center md:text-left">
            <div className="flex items-center mb-4 md:mb-0">
              <img
                src={companyLogo} // ✅ DINÂMICO: Logo da empresa selecionada
                alt={`Logo da ${currentCompany.company}`}
                className="w-24 h-auto mr-4"
              />
              <div>
                <h1 className="text-4xl font-extrabold text-indigo-800 mb-1 drop-shadow-md">
                  TRABALHEI LÁ
                </h1>
                <p className="text-slate-700 text-sm">
                  Sua opinião é anônima e ajuda outros profissionais
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-700">NOTA {currentCompanyMedia}/5</p> {/* ✅ DINÂMICO: Nota da empresa selecionada */}
              <p className="text-green-700 text-sm font-semibold flex items-center gap-2 mt-1">
                <span>✓ Anônimo</span>
                <span>✓ Verificado</span>
                <span>✓ Confiável</span>
              </p>
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
            <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">
              Avalie a Empresa
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seleção de Empresa */}
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label htmlFor="company-select" className="font-semibold text-slate-700 w-1/3">
                  Empresa:
                </label>
                <div className="w-2/3 flex flex-col">
                  <Select
                    id="company-select"
                    options={safeCompanyOptions}
                    value={company}
                    onChange={setCompany}
                    placeholder="Selecione uma empresa..."
                    isClearable
                    styles={selectStyles}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                    className="mt-2 text-purple-600 hover:text-purple-800 font-medium text-sm flex items-center justify-center"
                  >
                    <FaPlus className="mr-1" /> Adicionar nova empresa
                  </button>
                  {showNewCompanyInput && (
                    <div className="mt-3 flex items-center">
                      <input
                        type="text"
                        className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Nome da nova empresa"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddNewCompany}
                        className="ml-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-xl transition-colors"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Critérios de Avaliação */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3">
                    Avaliação Geral:
                  </label>
                  {renderStars(rating, setRating, commentRating, setCommentRating, "Avaliação Geral")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaHandshake className="mr-2 text-purple-500" /> Contato RH:
                  </label>
                  {renderStars(contatoRH, setContatoRH, commentContatoRH, setCommentContatoRH, "Contato RH")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaMoneyBillWave className="mr-2 text-green-500" /> Salário e Benefícios:
                  </label>
                  {renderStars(salarioBeneficios, setSalarioBeneficios, commentSalarioBeneficios, setCommentSalarioBeneficios, "Salário e Benefícios")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaBuilding className="mr-2 text-blue-500" /> Estrutura da Empresa:
                  </label>
                  {renderStars(estruturaEmpresa, setEstruturaEmpresa, commentEstruturaEmpresa, setCommentEstruturaEmpresa, "Estrutura da Empresa")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaUserTie className="mr-2 text-indigo-500" /> Acessibilidade à Liderança:
                  </label>
                  {renderStars(acessibilidadeLideranca, setAcessibilidadeLideranca, commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca, "Acessibilidade à Liderança")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaBriefcase className="mr-2 text-yellow-500" /> Plano de Carreiras:
                  </label>
                  {renderStars(planoCarreiras, setPlanoCarreiras, commentPlanoCarreiras, setCommentPlanoCarreiras, "Plano de Carreiras")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaHeart className="mr-2 text-red-500" /> Bem-estar e Qualidade de Vida:
                  </label>
                  {renderStars(bemestar, setBemestar, commentBemestar, setCommentBemestar, "Bem-estar e Qualidade de Vida")}
                </div>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="font-semibold text-slate-700 w-1/3 flex items-center">
                    <FaLightbulb className="mr-2 text-orange-500" /> Estímulo à Inovação:
                  </label>
                  {renderStars(estimulacaoOrganizacao, setEstimulacaoOrganizacao, commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao, "Estímulo à Inovação")}
                </div>
              </div>

              {/* Comentário Geral */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
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

        {/* Coluna Direita: Ranking e Outras Avaliações */}
        <div className="w-full md:w-1/3 flex-shrink-0">
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            <div className="flex flex-col items-center mb-5">
              <h2 className="text-2xl font-bold text-slate-700 text-center mb-3">Ranking - Top Empresas Avaliadas</h2>
              <img src="/trofeu-new.png" alt="Troféu" className="w-20 h-20 object-contain drop-shadow-lg" />
            </div>

            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-4 space-y-3">
                {top3.map((emp, t) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={t} className={`bg-gradient-to-r ${getMedalColor(t)} rounded-2xl p-4 text-white shadow-lg`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getMedalEmoji(t)}</span>
                          <div>
                            <h3 className="font-bold text-base">{emp.company}</h3>
                            <p className="text-xs opacity-90">{emp.area} • {emp.periodo}</p>
                          </div>
                        </div>
                        <div className="bg-white/20 px-3 py-1.5 rounded-full font-bold text-sm">{media} ⭐</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {Array.isArray(empresas) && empresas.length === 0 ? (
                <div className="text-center py-8">
                  <FaChartBar className="text-gray-300 text-5xl mx-auto mb-3" />
                  <p className="text-gray-500 font-medium text-lg">Nenhuma avaliação ainda</p>
                  <p className="text-sm text-gray-400 mt-2">Seja o primeiro a avaliar!</p>
                </div>
              ) : (
                (empresas || []).slice(3).map((emp, t) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={t} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors text-base">{emp.company}</h3>
                          <p className="text-xs text-gray-500 mt-1">{emp.area} • {emp.periodo}</p>
                        </div>
                        <div className={`${getBadgeColor(media)} px-3 py-1.5 rounded-full text-white font-bold text-sm shadow-md`}>
                          {media} ⭐
                        </div>
                      </div>
                      {emp.comment && (
                        <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                          "{emp.comment.substring(0, 100)}{emp.comment.length > 100 ? "..." : ""}"
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 8px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #8b5cf6, #ec4899); border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: linear-gradient(to bottom, #7c3aed, #db2777); }
            `}</style>
          </div>
        </div>
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
  );
}

export default TrabalheiLaDesktop;