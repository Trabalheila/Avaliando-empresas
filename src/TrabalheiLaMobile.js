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
  setTop3,
  showNewCompanyInput,
  setShowNewCompanyInput,
  handleAddNewCompany,
  linkedInClientId,
  handleLinkedInLogin,
  handleGoogleLogin,
  error, // ✅ CORRIGIDO: Adicionado como prop
  isAuthenticated, // ✅ CORRIGIDO: Adicionado como prop
  selectedCompanyData, // ✅ NOVO: Para a logo e nota dinâmica
  calcularMedia, // ✅ NOVO: Para calcular a média
}) {
  // Funções auxiliares para o cálculo da média e cores
  // ✅ CORRIGIDO: calcularMedia agora é recebida como prop de Home.js
  // ✅ CORRIGIDO: getBadgeColor foi mantida
  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-green-500";
    if (media >= 3.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  // ✅ CORRIGIDO: getMedalColor foi re-adicionada
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

  // Estilos para o componente Select (mantidos)
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem", // rounded-xl
      padding: "0.25rem", // p-1
      borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb", // focus:border-purple-500
      boxShadow: state.isFocused ? "0 0 0 1px #8b5cf6" : "none", // focus:ring-1 focus:ring-purple-500
      "&:hover": {
        borderColor: state.isFocused ? "#8b5cf6" : "#d1d5db",
      },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#ede9fe" : "white", // focus:bg-purple-100
      color: "#4a4a4a",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#4a4a4a",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af", // text-gray-400
    }),
  };

  // Componente para renderizar as estrelas e o campo de comentário
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
      ></textarea>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col p-4">
      <div className="w-full max-w-4xl min-w-0 mx-auto">
        {/* Novo Cabeçalho */}
        <header className="bg-blue-200 rounded-3xl shadow-xl p-6 mb-8 border border-blue-300 flex flex-col md:flex-row items-center justify-between text-center md:text-left">
          {/* Seção Esquerda: Logo e Nota */}
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0 md:w-1/4">
            <img
              src={selectedCompanyData ? getCompanyLogoUrl(selectedCompanyData.company) : "https://via.placeholder.com/100x50?text=Logo"}
              alt={selectedCompanyData ? `${selectedCompanyData.company} Logo` : "Company Logo"}
              className="w-24 h-auto mb-2"
            />
            <p className="text-xl font-bold text-slate-700">
              NOTA {selectedCompanyData ? calcularMedia(selectedCompanyData) : "X.X"}/5
            </p>
          </div>

          {/* Seção Central: Título, Subtítulos e Botão */}
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
            <p className="text-green-700 text-sm font-semibold flex items-center">
              <span className="mr-2">✓ Anônimo</span>
              <span className="mr-2">✓ Verificado</span>
              <span>✓ Confiável</span>
            </p>
          </div>

          {/* Seção Direita: Ranking Top 3 */}
          <div className="md:w-1/4 flex flex-col items-center md:items-end mt-4 md:mt-0">
            <h2 className="text-xl font-bold text-slate-700 mb-3">
              Melhores Empresas
            </h2>
            <div className="space-y-2 w-full">
              {Array.isArray(top3) && top3.length === 0 ? (
                <p className="text-gray-500 text-sm text-center">
                  Nenhuma empresa no ranking ainda.
                </p>
              ) : (
                (top3 || []).map((emp, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white rounded-lg p-2 shadow-sm border border-gray-200"
                  >
                    <span className="text-lg mr-2">
                      {getMedalEmoji(index)}
                    </span>
                    <span className="font-medium text-gray-800 flex-1 text-left">
                      {emp.company}
                    </span>
                    <span className="text-yellow-500 font-bold">
                      {calcularMedia(emp)} ⭐
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </header>

        {/* Seção de Login e Avaliação */}
        <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mb-8">
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">
            Login para Avaliar
          </h2>
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

        {/* Formulário de Avaliação */}
        <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mt-6">
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">
            Avalie uma Empresa
          </h2>

          <div className="mb-6">
            <label
              htmlFor="company-select"
              className="block text-slate-700 text-lg font-semibold mb-3"
            >
              Selecione a Empresa
            </label>
            <Select
              id="company-select"
              options={empresas.map((emp) => ({
                value: emp.company,
                label: emp.company,
              }))}
              value={company ? { value: company, label: company } : null}
              onChange={(selectedOption) => setCompany(selectedOption.value)}
              placeholder="Buscar ou selecionar empresa..."
              isClearable
              styles={selectStyles}
            />
          </div>

          {showNewCompanyInput ? (
            <div className="mb-6">
              <label
                htmlFor="new-company-name"
                className="block text-slate-700 text-lg font-semibold mb-3"
              >
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
                className="mt-3 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-all transform hover:scale-105"
              >
                Adicionar Empresa
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCompanyInput(true)}
              className="w-full flex items-center justify-center bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all transform hover:scale-105 mb-6"
            >
              <FaPlus className="mr-2" /> Adicionar Nova Empresa
            </button>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-6 mb-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaStar className="mr-2 text-yellow-500" /> Avaliação Geral
                </label>
                {renderStars(rating, setRating, commentRating, setCommentRating, "Avaliação Geral")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaHandshake className="mr-2 text-blue-500" /> Contato com RH
                </label>
                {renderStars(contatoRH, setContatoRH, commentContatoRH, setCommentContatoRH, "Contato com RH")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaMoneyBillWave className="mr-2 text-green-500" /> Salário e Benefícios
                </label>
                {renderStars(salarioBeneficios, setSalarioBeneficios, commentSalarioBeneficios, setCommentSalarioBeneficios, "Salário e Benefícios")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaBuilding className="mr-2 text-indigo-500" /> Estrutura da Empresa
                </label>
                {renderStars(estruturaEmpresa, setEstruturaEmpresa, commentEstruturaEmpresa, setCommentEstruturaEmpresa, "Estrutura da Empresa")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaUserTie className="mr-2 text-purple-500" /> Acessibilidade à Liderança
                </label>
                {renderStars(acessibilidadeLideranca, setAcessibilidadeLideranca, commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca, "Acessibilidade à Liderança")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaHeart className="mr-2 text-red-500" /> Bem-estar e Ambiente
                </label>
                {renderStars(bemestar, setBemestar, commentBemestar, setCommentBemestar, "Bem-estar e Ambiente")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaBriefcase className="mr-2 text-teal-500" /> Plano de Carreiras
                </label>
                {renderStars(planoCarreiras, setPlanoCarreiras, commentPlanoCarreiras, setCommentPlanoCarreiras, "Plano de Carreiras")}
              </div>

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                  <FaLightbulb className="mr-2 text-yellow-600" /> Estímulo à Inovação
                </label>
                {renderStars(estimulacaoOrganizacao, setEstimulacaoOrganizacao, commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao, "Estímulo à Inovação")}
              </div>
            </div>

            {/* Campo de Comentário Geral (Reintroduzido) */}
            <div className="mt-8">
              <label
                htmlFor="general-comment"
                className="block text-slate-700 text-lg font-semibold mb-3"
              >
                Comentário Geral (Opcional)
              </label>
              <textarea
                id="general-comment"
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                placeholder="Escreva seu comentário geral sobre a empresa..."
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:shadow-outline transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? "Enviando..." : "Avaliar Empresa"}
            </button>
          </form>
        </section>

        {/* Ranking e Outras Avaliações (agora fora do cabeçalho) */}
        <section className="mt-8">
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mt-6">
            <div className="flex flex-col items-center mb-5">
              <h2 className="text-2xl font-bold text-slate-700 text-center mb-3">
                Outras Avaliações
              </h2>
              <img
                src="/trofeu-new.png"
                alt="Troféu Trabalhei Lá"
                className="w-24 h-24 object-contain drop-shadow-lg"
              />
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {Array.isArray(empresas) && empresas.length === 0 ? (
                <div className="text-center py-8">
                  <FaChartBar className="text-gray-300 text-5xl mx-auto mb-3" />
                  <p className="text-gray-500 font-medium text-lg">
                    Nenhuma avaliação ainda
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Seja o primeiro a avaliar!
                  </p>
                </div>
              ) : (
                (empresas || []).map((emp, t) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={t}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors text-base">
                            {emp.company}
                          </h3>
                          <p className="text-xs opacity-90">
                            {emp.area} • {emp.periodo}
                          </p>
                        </div>
                        <div
                          className={`${getBadgeColor(
                            media
                          )} px-3 py-1.5 rounded-full text-white font-bold text-sm shadow-md`}
                        >
                          {media} ⭐
                        </div>
                      </div>

                      {emp.comment && (
                        <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                          "{emp.comment.substring(0, 100)}
                          {emp.comment.length > 100 ? "..." : ""}"
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
              .custom-scrollbar::-webkit-scrollbar-thumb {
                background: linear-gradient(to bottom, #8b5cf6, #ec4899);
                border-radius: 10px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(to bottom, #7c3aed, #db2777);
              }
            `}</style>
          </div>
        </section>
      </div>

      <footer
        className="mx-auto px-6 md:px-8 py-8 text-center"
        style={{ maxWidth: 1120 }}
      >
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

// Função auxiliar para obter URL da logo (pode ser movida para um utilitário se necessário)
const getCompanyLogoUrl = (companyName) => {
  const logos = {
    "Petrobras": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Petrobras_logo.svg/1200px-Petrobras_logo.svg.png",
    "Empresa A": "https://via.placeholder.com/100x50?text=Empresa+A",
    "Empresa B": "https://via.placeholder.com/100x50?text=Empresa+B",
    "Empresa C": "https://via.placeholder.com/100x50?text=Empresa+C",
    // Adicione mais logos aqui
  };
  return logos[companyName] || "https://via.placeholder.com/100x50?text=Logo";
};

// ✅ CORRIGIDO: Era "export default TrabalheiLaDesktop;" - ESSE ERA O BUG PRINCIPAL
export default TrabalheiLaMobile;