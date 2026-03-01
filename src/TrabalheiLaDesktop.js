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
  setTop3,
  showNewCompanyInput,
  setShowNewCompanyInput,
  handleAddNewCompany,
  linkedInClientId,
  handleLinkedInLogin,
  handleGoogleLogin,
  error,
  isAuthenticated,
  safeCompanyOptions,
  selectedCompanyData, // <-- AGORA RECEBE COMO PROP
  calcularMedia,      // <-- AGORA RECEBE COMO PROP
  getBadgeColor,      // <-- AGORA RECEBE COMO PROP
  getMedalColor,      // <-- AGORA RECEBE COMO PROP
  getMedalEmoji,      // <-- AGORA RECEBE COMO PROP
}) {
  // Estilos para o Select
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

  // Função para renderizar as estrelas e o campo de comentário
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

  // Dados para o cabeçalho dinâmico
  const companyName = selectedCompanyData?.company || "Empresa Não Selecionada";
  const companyRating = selectedCompanyData ? calcularMedia(selectedCompanyData) : "0.0";
  const companyLogo = selectedCompanyData?.logo || "https://via.placeholder.com/150?text=Logo"; // Placeholder se não houver logo

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">

        {/* Cabeçalho */}
        <header className="bg-blue-200 rounded-3xl shadow-xl p-6 mb-8 border border-blue-300 flex flex-col md:flex-row items-center justify-between text-center md:text-left">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0 md:w-1/4">
            <img
              src={companyLogo}
              alt={`Logo da ${companyName}`}
              className="w-24 h-auto mb-2"
            />
            <p className="text-xl font-bold text-slate-700">NOTA {companyRating}/5</p>
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
                    <span className="text-gray-600 text-sm">{calcularMedia(emp)} ⭐</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Coluna Esquerda: Formulário */}
          <div className="w-full md:w-2/3">
            <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
              <h2 className="text-3xl font-bold text-slate-700 mb-6 text-center">
                Avalie uma Empresa
              </h2>

              {/* Seleção de Empresa */}
              <div className="mb-6">
                <label htmlFor="company-select" className="block text-slate-700 font-semibold mb-2">
                  Selecione a Empresa:
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
                <button
                  onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                  className="mt-3 text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                >
                  <FaPlus /> Adicionar nova empresa
                </button>
                {showNewCompanyInput && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Nome da nova empresa"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                    />
                    <button
                      onClick={handleAddNewCompany}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl"
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </div>

              {/* Login para Avaliar */}
              {!isAuthenticated && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-center">
                  <p className="text-yellow-800 font-semibold mb-3">
                    Faça login para enviar sua avaliação:
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-3">
                    <LoginLinkedInButton
                      clientId={linkedInClientId}
                      onSuccess={handleLinkedInLogin}
                      onError={(err) => console.error("LinkedIn Login Error:", err)}
                    />
                    <button
                      onClick={handleGoogleLogin}
                      className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                    >
                      <FcGoogle className="text-xl" /> Login com Google
                    </button>
                  </div>
                </div>
              )}

              {/* Formulário de Avaliação Detalhada */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-2xl font-bold text-slate-700 mb-4 text-center">
                  Detalhes da Avaliação
                </h3>

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
    </div>
  );
}

export default TrabalheiLaDesktop;