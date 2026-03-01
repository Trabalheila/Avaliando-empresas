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
  handleSubmit,
  isLoading,
  empresas,
  top3,
  error,
  isAuthenticated,
  setIsAuthenticated,
  user,
  setUser,
  linkedInClientId,
  linkedInDisabled,
  handleLinkedInLogin,
  handleGoogleLogin,
  safeCompanyOptions,
  selectedCompanyData, // <-- NOVO: Recebendo os dados da empresa selecionada
  calcularMedia, // <-- NOVO: Recebendo a função calcularMedia
}) {
  // Funções auxiliares para o cálculo da média e cores
  // calcularMedia agora vem de Home.js
  const getBadgeColor = (media) => {
    if (media >= 4.5) return "bg-green-500";
    if (media >= 3.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getMedalColor = (index) => {
    if (index === 0) return "from-yellow-400 to-yellow-600";
    if (index === 1) return "from-gray-400 to-gray-600";
    if (index === 2) return "from-orange-400 to-orange-600";
    return "from-blue-400 to-blue-600";
  };

  const getMedalEmoji = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🏅";
  };

  // Estilos para o componente Select
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

  // Função para obter a URL da logo da empresa
  const getCompanyLogoUrl = (companyName) => {
    if (companyName === "Petrobras") {
      return "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Petrobras_logo.svg/1200px-Petrobras_logo.svg.png";
    }
    // Adicione outras logos aqui ou uma lógica para buscar de uma API
    return "https://via.placeholder.com/100x50?text=Logo"; // Logo padrão
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col">
      <header
        className="bg-white rounded-b-3xl shadow-lg p-6 mb-8 flex flex-col md:flex-row items-center justify-between mx-auto w-full"
        style={{ maxWidth: 1120 }}
      >
        <div className="flex items-center mb-4 md:mb-0">
          <img
            src={selectedCompanyData ? getCompanyLogoUrl(selectedCompanyData.company) : "https://via.placeholder.com/100x50?text=Logo"}
            alt={selectedCompanyData ? `${selectedCompanyData.company} Logo` : "Company Logo"}
            className="w-20 h-auto mr-4"
          />
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-800">
              TRABALHEI LÁ
            </h1>
            <p className="text-slate-700 text-sm">
              Sua opinião é anônima e ajuda outros profissionais
            </p>
            <p className="text-xl font-bold text-slate-700">
              NOTA {selectedCompanyData ? calcularMedia(selectedCompanyData) : "X.X"}/5
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center space-y-3 md:space-y-0 md:space-x-4">
          <LoginLinkedInButton
            clientId={linkedInClientId}
            onLoginSuccess={handleLinkedInLogin}
            disabled={linkedInDisabled}
            className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-xl shadow-sm transition-all transform hover:scale-105"
          />
          <button
            onClick={handleGoogleLogin}
            className="bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105"
          >
            <FcGoogle className="inline-block mr-2 text-xl" />
            Entrar com Google
          </button>
        </div>
        {isAuthenticated && user && (
          <p className="mt-4 text-green-700 font-semibold">
            Bem-vindo(a), {user.name}!
          </p>
        )}
      </header>

      <section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-auto px-4"
        style={{ maxWidth: 1120 }}
      >
        {/* Formulário de Avaliação */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">
            Avalie uma Empresa
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="company-select"
                className="block text-gray-700 text-sm font-medium mb-2"
              >
                Empresa:
              </label>
              <Select
                id="company-select"
                options={safeCompanyOptions}
                value={company}
                onChange={setCompany}
                placeholder="Selecione uma empresa existente"
                isClearable
                styles={selectStyles}
                aria-label="Selecione uma empresa"
              />
            </div>

            <div className="flex items-center gap-3 text-gray-500">
              <hr className="flex-grow border-gray-300" />
              OU
              <hr className="flex-grow border-gray-300" />
            </div>

            <div>
              <label
                htmlFor="new-company-input"
                className="block text-gray-700 text-sm font-medium mb-2"
              >
                Nova Empresa:
              </label>
              <input
                id="new-company-input"
                type="text"
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                placeholder="Digite o nome da nova empresa"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                aria-label="Digite o nome da nova empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Categoria: Avaliação Geral */}
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <label className="block text-purple-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaStar className="text-purple-600" /> Avaliação Geral:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= rating}
                      onClick={() => setRating(star)}
                      label={`${star} estrelas de avaliação geral`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
                  placeholder="Comentário sobre a avaliação geral (opcional)"
                  value={commentRating}
                  onChange={(e) => setCommentRating(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre a avaliação geral"
                ></textarea>
              </div>

              {/* Categoria: Contato com RH */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <label className="block text-blue-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaHandshake className="text-blue-600" /> Contato com RH:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= contatoRH}
                      onClick={() => setContatoRH(star)}
                      label={`${star} estrelas para contato com RH`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm"
                  placeholder="Comentário sobre o contato com RH (opcional)"
                  value={commentContatoRH}
                  onChange={(e) => setCommentContatoRH(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre o contato com RH"
                ></textarea>
              </div>

              {/* Categoria: Salário e Benefícios */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <label className="block text-green-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaMoneyBillWave className="text-green-600" /> Salário e
                  Benefícios:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= salarioBeneficios}
                      onClick={() => setSalarioBeneficios(star)}
                      label={`${star} estrelas para salário e benefícios`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-green-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-400 text-sm"
                  placeholder="Comentário sobre salário e benefícios (opcional)"
                  value={commentSalarioBeneficios}
                  onChange={(e) => setCommentSalarioBeneficios(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre salário e benefícios"
                ></textarea>
              </div>

              {/* Categoria: Estrutura da Empresa */}
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <label className="block text-yellow-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaBuilding className="text-yellow-600" /> Estrutura da
                  Empresa:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= estruturaEmpresa}
                      onClick={() => setEstruturaEmpresa(star)}
                      label={`${star} estrelas para estrutura da empresa`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-yellow-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400 text-sm"
                  placeholder="Comentário sobre a estrutura da empresa (opcional)"
                  value={commentEstruturaEmpresa}
                  onChange={(e) => setCommentEstruturaEmpresa(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre a estrutura da empresa"
                ></textarea>
              </div>

              {/* Categoria: Acessibilidade à Liderança */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <label className="block text-red-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaUserTie className="text-red-600" /> Acessibilidade à
                  Liderança:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= acessibilidadeLideranca}
                      onClick={() => setAcessibilidadeLideranca(star)}
                      label={`${star} estrelas para acessibilidade à liderança`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-red-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 text-sm"
                  placeholder="Comentário sobre acessibilidade à liderança (opcional)"
                  value={commentAcessibilidadeLideranca}
                  onChange={(e) =>
                    setCommentAcessibilidadeLideranca(e.target.value)
                  }
                  rows="2"
                  aria-label="Comentário sobre acessibilidade à liderança"
                ></textarea>
              </div>

              {/* Categoria: Plano de Carreira */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <label className="block text-indigo-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaBriefcase className="text-indigo-600" /> Plano de Carreira:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= planoCarreiras}
                      onClick={() => setPlanoCarreiras(star)}
                      label={`${star} estrelas para plano de carreira`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm"
                  placeholder="Comentário sobre plano de carreira (opcional)"
                  value={commentPlanoCarreiras}
                  onChange={(e) => setCommentPlanoCarreiras(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre plano de carreira"
                ></textarea>
              </div>

              {/* Categoria: Bem-estar e Qualidade de Vida */}
              <div className="bg-pink-50 p-4 rounded-xl border border-pink-200">
                <label className="block text-pink-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaHeart className="text-pink-600" /> Bem-estar e Qualidade de
                  Vida:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= bemestar}
                      onClick={() => setBemestar(star)}
                      label={`${star} estrelas para bem-estar e qualidade de vida`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-400 text-sm"
                  placeholder="Comentário sobre bem-estar e qualidade de vida (opcional)"
                  value={commentBemestar}
                  onChange={(e) => setCommentBemestar(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre bem-estar e qualidade de vida"
                ></textarea>
              </div>

              {/* Categoria: Estímulo à Inovação e Organização */}
              <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                <label className="block text-teal-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaLightbulb className="text-teal-600" /> Estímulo à Inovação e
                  Organização:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= estimulacaoOrganizacao}
                      onClick={() => setEstimulacaoOrganizacao(star)}
                      label={`${star} estrelas para estímulo à inovação e organização`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-teal-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 text-sm"
                  placeholder="Comentário sobre estímulo à inovação e organização (opcional)"
                  value={commentEstimulacaoOrganizacao}
                  onChange={(e) =>
                    setCommentEstimulacaoOrganizacao(e.target.value)
                  }
                  rows="2"
                  aria-label="Comentário sobre estímulo à inovação e organização"
                ></textarea>
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-center font-medium">{error}</p>
            )}

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
                {isLoading
                  ? "Enviando..."
                  : isAuthenticated
                    ? "Enviar avaliação"
                    : "Faça login para avaliar"}
              </button>
            </div>
          </form>
        </div>

        {/* Ranking e Outras Avaliações */}
        <section>
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            <div className="flex flex-col items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-700 text-center mb-3">
                Ranking - Top Empresas Avaliadas
              </h2>
              <img
                src="/trofeu-new.png"
                alt="Troféu Trabalhei Lá"
                className="w-20 h-20 object-contain drop-shadow-lg"
              />
            </div>
            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-4 space-y-3">
                {top3.map((emp, t) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={t}
                      className={`bg-gradient-to-r ${getMedalColor(
                        t
                      )} rounded-2xl p-4 text-white shadow-lg`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getMedalEmoji(t)}</span>
                          <div>
                            <h3 className="font-bold text-base">{emp.company}</h3>
                            <p className="text-xs opacity-90">
                              {emp.area} • {emp.periodo}
                            </p>
                          </div>
                        </div>
                        <div className="bg-white/20 px-3 py-1.5 rounded-full font-bold text-sm">
                          {media} ⭐
                        </div>
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
                  <p className="text-gray-500 font-medium text-lg">
                    Nenhuma avaliação ainda
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Seja o primeiro a avaliar!
                  </p>
                </div>
              ) : (
                (empresas || []).slice(3).map((emp, t) => {
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
                          <p className="text-xs text-gray-500 mt-1">
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
      </section>

      <footer
        className="mx-auto px-6 md:px-8 py-8 text-center"
        style={{ maxWidth: 1120 }}
      >
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
          <p className="text-slate-700 text-sm">
            <a
              href="/politica-de-privacidade.html"
              className="text-indigo-700 hover:text-indigo-900 font-extrabold underline"
            >
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