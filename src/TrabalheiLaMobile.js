import React from "react";
import {
  FaStar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaHeart,
  FaChartBar,
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
  isAuthenticated,
  setIsAuthenticated,
  user,
  setUser,
  companyOptions,
  handleSubmit,
  isLoading,
  error,
  empresas,
  calcularMedia,
  top3,
  getMedalColor,
  getMedalEmoji,
  getBadgeColor,
}) {
  const safeCompanyOptions = Array.isArray(companyOptions) ? companyOptions : [];

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || "";
  const linkedInDisabled = Boolean(isLoading || !linkedInClientId);

  // O bloco useMemo de debug foi removido, pois não é necessário para o deploy
  // e para manter o código limpo, seguindo as práticas de produção.

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem", // rounded-xl
      padding: "0.1rem", // Ajustado para mobile: um pouco menos de padding
      borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb", // focus:border-purple-500
      boxShadow: state.isFocused ? "0 0 0 1px #8b5cf6" : "none", // focus:ring-1 focus:ring-purple-500
      "&:hover": {
        borderColor: state.isFocused ? "#8b5cf6" : "#d1d5db",
      },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "#8b5cf6"
        : state.isFocused
          ? "#f3e8ff"
          : null,
      color: state.isSelected ? "white" : "#4b5563",
      fontSize: "0.875rem", // Ajustado para mobile: text-sm para as opções
      "&:active": {
        backgroundColor: "#a78bfa",
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: "#1f2937", // text-gray-900
      fontWeight: "500", // font-medium
      fontSize: "0.875rem", // Ajustado para mobile: text-sm para o valor selecionado
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af", // text-gray-400
      fontSize: "0.875rem", // Ajustado para mobile: text-sm para o placeholder
    }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-4"> {/* Removido md:p-8 para mobile */}
      <header className="text-center mb-8 px-2"> {/* Removido max-w-7xl e mx-auto, adicionado px-2 para um pequeno espaçamento lateral */}
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 drop-shadow-lg mb-3"> {/* Ajustado para text-4xl no mobile, sm:text-5xl para telas maiores */}
          Trabalhei Lá
        </h1>
        <p className="text-lg sm:text-xl text-slate-700 font-medium"> {/* Ajustado para text-lg no mobile, sm:text-xl para telas maiores */}
          Sua plataforma para avaliar empresas e encontrar o lugar ideal para
          trabalhar.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4"> {/* Adicionado flex-col para empilhar no mobile, sm:flex-row para lado a lado em telas maiores */}
          <LoginLinkedInButton
            clientId={linkedInClientId}
            onLoginSuccess={(userData) => {
              setIsAuthenticated(true);
              setUser(userData);
              console.log("Login LinkedIn bem-sucedido:", userData);
            }}
            onLoginFailure={(error) => {
              setIsAuthenticated(false);
              setUser(null);
              console.error("Login LinkedIn falhou:", error);
            }}
            disabled={linkedInDisabled}
          />
          <button
            type="button"
            className="flex items-center gap-2 px-5 py-2 bg-white text-gray-700 font-semibold rounded-full shadow-md hover:shadow-lg transition-all transform hover:scale-105 text-sm"
            aria-label="Entrar com Google"
          >
            <FcGoogle className="text-xl" />
            Entrar com Google
          </button>
        </div>
        {isAuthenticated && user && (
          <p className="mt-3 text-green-700 font-semibold text-sm">
            Bem-vindo(a), {user.name}!
          </p>
        )}
      </header>

      <div className="max-w-7xl mx-auto px-2">
        {/* Formulário de Avaliação */}
        <div className="bg-white rounded-3xl shadow-2xl p-5 border border-slate-200 mb-6">
          <h2 className="text-xl font-bold text-slate-700 text-center mb-5">
            Avalie uma Empresa
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="company-select-mobile"
                className="block text-gray-700 text-sm font-medium mb-2"
              >
                Empresa:
              </label>
              <Select
                id="company-select-mobile"
                options={safeCompanyOptions}
                value={company}
                onChange={setCompany}
                placeholder="Selecione uma empresa existente"
                isClearable
                styles={selectStyles}
                aria-label="Selecione uma empresa"
              />
            </div>

            <div className="flex items-center gap-3 text-gray-500 text-sm">
              <hr className="flex-grow border-gray-300" />
              OU
              <hr className="flex-grow border-gray-300" />
            </div>

            <div>
              <label
                htmlFor="new-company-input-mobile"
                className="block text-gray-700 text-sm font-medium mb-2"
              >
                Nova Empresa:
              </label>
              <input
                id="new-company-input-mobile"
                type="text"
                className="w-full p-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                placeholder="Digite o nome da nova empresa"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                aria-label="Digite o nome da nova empresa"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                  className="w-full p-2 mt-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 text-xs"
                  placeholder="Comentário (opcional)"
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
                  className="w-full p-2 mt-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-xs"
                  placeholder="Comentário (opcional)"
                  value={commentContatoRH}
                  onChange={(e) => setCommentContatoRH(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre contato com RH"
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
                  className="w-full p-2 mt-3 border border-green-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-400 text-xs"
                  placeholder="Comentário (opcional)"
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
                  className="w-full p-2 mt-3 border border-yellow-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400 text-xs"
                  placeholder="Comentário (opcional)"
                  value={commentEstruturaEmpresa}
                  onChange={(e) => setCommentEstruturaEmpresa(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre estrutura da empresa"
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
                  className="w-full p-2 mt-3 border border-red-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 text-xs"
                  placeholder="Comentário (opcional)"
                  value={commentAcessibilidadeLideranca}
                  onChange={(e) =>
                    setCommentAcessibilidadeLideranca(e.target.value)
                  }
                  rows="2"
                  aria-label="Comentário sobre acessibilidade à liderança"
                ></textarea>
              </div>

              {/* Categoria: Plano de Carreiras */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <label className="block text-indigo-800 text-sm font-semibold mb-2 flex items-center gap-2">
                  <FaBriefcase className="text-indigo-600" /> Plano de
                  Carreiras:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= planoCarreiras}
                      onClick={() => setPlanoCarreiras(star)}
                      label={`${star} estrelas para plano de carreiras`}
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-xs"
                  placeholder="Comentário (opcional)"
                  value={commentPlanoCarreiras}
                  onChange={(e) => setCommentPlanoCarreiras(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre plano de carreiras"
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
                  className="w-full p-2 mt-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-400 text-xs"
                  placeholder="Comentário (opcional)"
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
                  className="w-full p-2 mt-3 border border-teal-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400 text-xs"
                  placeholder="Comentário (opcional)"
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
              <p className="text-red-600 text-center font-medium text-sm">
                {error}
              </p>
            )}

            <div className="text-center">
              <button
                type="submit"
                className={`px-6 py-3 rounded-full font-extrabold text-white text-base transition-all transform ${
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
        <div className="bg-white rounded-3xl shadow-2xl p-5 border border-slate-200">
          <div className="flex flex-col items-center mb-5">
            <h2 className="text-xl font-bold text-slate-700 text-center mb-3">
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
                    )} rounded-2xl p-3 text-white shadow-lg`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getMedalEmoji(t)}</span>
                        <div>
                          <h3 className="font-bold text-sm">{emp.company}</h3>
                          <p className="text-xs opacity-90">
                            {emp.area} • {emp.periodo}
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/20 px-2 py-1 rounded-full font-bold text-xs">
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
                <FaChartBar className="text-gray-300 text-4xl mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-sm">
                  Nenhuma avaliação ainda
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Seja o primeiro a avaliar!
                </p>
              </div>
            ) : (
              (empresas || []).slice(3).map((emp, idx) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={idx}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-3 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors text-sm">
                          {emp.company}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {emp.area} • {emp.periodo}
                        </p>
                      </div>
                      <div
                        className={`${getBadgeColor(media)} px-2 py-1 rounded-full text-white font-bold text-xs shadow-md`}
                      >
                        {media} ⭐
                      </div>
                    </div>

                    {emp.comment && (
                      <p className="text-xs text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                        "{emp.comment.substring(0, 80)}
                        {emp.comment.length > 80 ? "..." : ""}"
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
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: linear-gradient(to bottom, #8b5cf6, #ec4899);
              border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(to bottom, #7c3aed, #db2777);
            }
          `}</style>
        </div>
      </div>

      {/* Footer (mantido como estava) */}
      <footer className="max-w-7xl mx-auto mt-8 text-center">
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
          <p className="text-gray-600 text-xs">
            <a
              href="/politica-de-privacidade.html"
              className="text-purple-600 hover:text-purple-800 font-semibold underline"
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

export default TrabalheiLaMobile;
