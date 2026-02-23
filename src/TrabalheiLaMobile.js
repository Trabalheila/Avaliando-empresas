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
  FaLock, // Importado para o ícone de privacidade
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
      "&:active": {
        backgroundColor: "#a78bfa",
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: "#1f2937", // text-gray-900
      fontWeight: "500", // font-medium
      fontSize: "0.875rem", // text-sm para o valor selecionado
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af", // text-gray-400
      fontSize: "0.875rem", // text-sm para o placeholder
    }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 p-4"> {/* Removido md:p-8 para mobile */}
      <header className="text-center mb-6 px-2"> {/* Removido max-w-7xl e mx-auto, adicionado px-2 para um pequeno espaçamento lateral */}
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 drop-shadow-lg mb-2"> {/* Ajustado para text-4xl no mobile, sm:text-5xl para telas maiores */}
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
            className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 font-semibold rounded-full shadow-md hover:shadow-lg transition-all transform hover:scale-105"
            aria-label="Entrar com Google"
          >
            <FcGoogle className="text-2xl" />
            Entrar com Google
          </button>
        </div>
        {isAuthenticated && user && (
          <p className="mt-4 text-green-700 font-semibold">
            Bem-vindo(a), {user.name}!
          </p>
        )}
      </header>

      {/* Nova Seção: Sua privacidade é garantida */}
      <div className="max-w-full mx-auto px-4 mt-6">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-5 rounded-2xl shadow-lg flex items-start gap-4">
          <FaLock className="text-3xl mt-1" />
          <div>
            <h3 className="font-bold text-xl mb-1">Sua privacidade é garantida</h3>
            <p className="text-sm opacity-90">
              Usamos o LinkedIn ou Google apenas para verificar seu vínculo
              profissional. Suas avaliações são{" "}
              <span className="font-extrabold">100% anônimas</span> — nome e
              perfil nunca são exibidos.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário de Avaliação */}
      <section className="max-w-full mx-auto px-4 mt-6"> {/* Removido grid-cols-1 lg:grid-cols-2 e style, ajustado mt */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200"> {/* Aumentado padding */}
          <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">
            Avalie uma Empresa
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="company-select"
                className="block text-gray-700 text-sm font-semibold mb-2"
              >
                Empresa:
              </label>
              <Select
                id="company-select"
                options={safeCompanyOptions}
                value={
                  company
                    ? { label: company, value: company }
                    : null
                }
                onChange={(selectedOption) =>
                  setCompany(selectedOption ? selectedOption.value : "")
                }
                placeholder="Selecione uma empresa existente"
                isClearable
                styles={selectStyles}
                className="text-sm" // Adicionado para controlar o tamanho da fonte do Select
              />
            </div>

            <div className="text-center text-gray-500 font-medium my-4">OU</div>

            <div>
              <label
                htmlFor="new-company"
                className="block text-gray-700 text-sm font-semibold mb-2"
              >
                Nova Empresa:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="new-company"
                  className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder="Digite o nome da nova empresa"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  aria-label="Nome da nova empresa"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newCompany.trim()) {
                      setCompany(newCompany.trim());
                      setNewCompany("");
                    }
                  }}
                  className="px-5 py-3 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-colors shadow-md"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {/* Ajustado para grid-cols-1 no mobile, sm:grid-cols-2 em telas maiores */}
              {/* Categoria: Avaliação Geral */}
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <label className="block text-purple-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaStar className="text-purple-600 text-xl" /> Avaliação Geral:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= rating}
                      onClick={() => setRating(star)}
                      label={`${star} estrelas para avaliação geral`}
                      size={24} /* Aumentado tamanho da estrela */
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 text-sm"
                  placeholder="Comentário sobre avaliação geral (opcional)"
                  value={commentRating}
                  onChange={(e) => setCommentRating(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre avaliação geral"
                ></textarea>
              </div>

              {/* Categoria: Contato do RH */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <label className="block text-blue-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaHandshake className="text-blue-600 text-xl" /> Contato do RH:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= contatoRH}
                      onClick={() => setContatoRH(star)}
                      label={`${star} estrelas para contato do RH`}
                      size={24} /* Aumentado tamanho da estrela */
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm"
                  placeholder="Comentário sobre contato do RH (opcional)"
                  value={commentContatoRH}
                  onChange={(e) => setCommentContatoRH(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre contato do RH"
                ></textarea>
              </div>

              {/* Categoria: Salário e Benefícios */}
              <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <label className="block text-green-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaMoneyBillWave className="text-green-600 text-xl" /> Salário e
                  Benefícios:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= salarioBeneficios}
                      onClick={() => setSalarioBeneficios(star)}
                      label={`${star} estrelas para salário e benefícios`}
                      size={24} /* Aumentado tamanho da estrela */
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
                <label className="block text-yellow-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaBuilding className="text-yellow-600 text-xl" /> Estrutura da
                  Empresa:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= estruturaEmpresa}
                      onClick={() => setEstruturaEmpresa(star)}
                      label={`${star} estrelas para estrutura da empresa`}
                      size={24} /* Aumentado tamanho da estrela */
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-yellow-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-yellow-400 text-sm"
                  placeholder="Comentário sobre estrutura da empresa (opcional)"
                  value={commentEstruturaEmpresa}
                  onChange={(e) => setCommentEstruturaEmpresa(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre estrutura da empresa"
                ></textarea>
              </div>

              {/* Categoria: Acessibilidade à Liderança */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <label className="block text-red-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaUserTie className="text-red-600 text-xl" /> Acessibilidade à
                  Liderança:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= acessibilidadeLideranca}
                      onClick={() => setAcessibilidadeLideranca(star)}
                      label={`${star} estrelas para acessibilidade à liderança`}
                      size={24} /* Aumentado tamanho da estrela */
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

              {/* Categoria: Plano de Carreiras */}
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                <label className="block text-indigo-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaBriefcase className="text-indigo-600 text-xl" /> Plano de
                  Carreiras:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= planoCarreiras}
                      onClick={() => setPlanoCarreiras(star)}
                      label={`${star} estrelas para plano de carreiras`}
                      size={24} /* Aumentado tamanho da estrela */
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-indigo-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 text-sm"
                  placeholder="Comentário sobre plano de carreiras (opcional)"
                  value={commentPlanoCarreiras}
                  onChange={(e) => setCommentPlanoCarreiras(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre plano de carreiras"
                ></textarea>
              </div>

              {/* Categoria: Bem-estar e Ambiente */}
              <div className="bg-pink-50 p-4 rounded-xl border border-pink-200">
                <label className="block text-pink-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaHeart className="text-pink-600 text-xl" /> Bem-estar e
                  Ambiente:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= bemestar}
                      onClick={() => setBemestar(star)}
                      label={`${star} estrelas para bem-estar e ambiente`}
                      size={24} /* Aumentado tamanho da estrela */
                    />
                  ))}
                </div>
                <textarea
                  className="w-full p-2 mt-3 border border-pink-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-400 text-sm"
                  placeholder="Comentário sobre bem-estar e ambiente (opcional)"
                  value={commentBemestar}
                  onChange={(e) => setCommentBemestar(e.target.value)}
                  rows="2"
                  aria-label="Comentário sobre bem-estar e ambiente"
                ></textarea>
              </div>

              {/* Categoria: Estímulo à Inovação e Organização */}
              <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                <label className="block text-teal-800 text-base font-semibold mb-2 flex items-center gap-2"> {/* Ajustado para text-base */}
                  <FaLightbulb className="text-teal-600 text-xl" /> Estímulo à
                  Inovação e Organização:
                </label>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <OutlinedStar
                      key={star}
                      active={star <= estimulacaoOrganizacao}
                      onClick={() => setEstimulacaoOrganizacao(star)}
                      label={`${star} estrelas para estímulo à inovação e organização`}
                      size={24} /* Aumentado tamanho da estrela */
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
              <p className="text-red-600 text-center font-medium text-base"> {/* Aumentado texto */}
                {error}
              </p>
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
      </section> {/* Fechamento da seção do formulário */}

      {/* Ranking e Outras Avaliações */}
      <section className="max-w-full mx-auto px-4 mt-6"> {/* max-w-full e px-4, ajustado mt */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200"> {/* Aumentado padding */}
          <div className="flex flex-col items-center mb-5">
            <h2 className="text-2xl font-bold text-slate-700 text-center mb-3">
              Ranking - Top Empresas Avaliadas
            </h2>
            <img
              src="/trofeu-new.png"
              alt="Troféu Trabalhei Lá"
              className="w-24 h-24 object-contain drop-shadow-lg" // Aumentado tamanho da imagem
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
              (empresas || []).slice(3).map((emp, idx) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={idx}
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
                        className={`${getBadgeColor(media)} px-3 py-1.5 rounded-full text-white font-bold text-sm shadow-md`}
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
      </section> {/* Fechamento da seção de ranking */}

      <footer className="max-w-full mx-auto mt-8 px-4 text-center"> {/* max-w-full e px-4 */}
        <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-white/20"> {/* Aumentado padding */}
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

export default TrabalheiLaMobile;
