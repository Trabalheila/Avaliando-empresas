import React from "react";
import {
  FaStar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaHeart,
  FaChartBar,
  FaLightbulb,
  FaLock, // Importado para o card de privacidade (manter por enquanto, pode ser removido se não for mais usado)
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";

import LoginLinkedInButton from "./components/LoginLinkedInButton"; // Manter por enquanto, pode ser removido se não for mais usado

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
      padding: "0.25rem", // p-1
      borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb", // focus:border-purple-500
      boxShadow: state.isFocused ? "0 0 0 1px #8b5cf6" : "none", // focus:ring-1 focus:ring-purple-500
      "&:hover": {
        borderColor: state.isFocused ? "#8b5cf6" : "#d1d5db",
      },
      minHeight: "48px", // Garante altura mínima para mobile
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
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af", // text-gray-400
    }),
  };

  const ratingFields = [
    {
      label: "Avaliação Geral",
      value: rating,
      setter: setRating,
      comment: commentRating,
      commentSetter: setCommentRating,
    },
    {
      label: "Contato com RH",
      value: contatoRH,
      setter: setContatoRH,
      comment: commentContatoRH,
      commentSetter: setCommentContatoRH,
    },
    {
      label: "Salário e Benefícios",
      value: salarioBeneficios,
      setter: setSalarioBeneficios,
      comment: commentSalarioBeneficios,
      commentSetter: setCommentSalarioBeneficios,
    },
    {
      label: "Estrutura da Empresa",
      value: estruturaEmpresa,
      setter: setEstruturaEmpresa,
      comment: commentEstruturaEmpresa,
      commentSetter: setCommentEstruturaEmpresa,
    },
    {
      label: "Acessibilidade à Liderança",
      value: acessibilidadeLideranca,
      setter: setAcessibilidadeLideranca,
      comment: commentAcessibilidadeLideranca,
      commentSetter: setCommentAcessibilidadeLideranca,
    },
    {
      label: "Plano de Carreiras",
      value: planoCarreiras,
      setter: setPlanoCarreiras,
      comment: commentPlanoCarreiras,
      commentSetter: setCommentPlanoCarreiras,
    },
    {
      label: "Bem-estar e Ambiente",
      value: bemestar,
      setter: setBemestar,
      comment: commentBemestar,
      commentSetter: setCommentBemestar,
    },
    {
      label: "Estímulo à Organização",
      value: estimulacaoOrganizacao,
      setter: setEstimulacaoOrganizacao,
      comment: commentEstimulacaoOrganizacao,
      commentSetter: setCommentEstimulacaoOrganizacao,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 text-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Novo Cabeçalho - Adaptado da imagem */}
        <header className="bg-blue-100 p-6 rounded-2xl shadow-lg mb-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Seção da Empresa em Destaque (Esquerda) */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              {/* Placeholder para logo da empresa em destaque */}
              <img
                src="/petrobras-logo.png" // Você precisará adicionar esta imagem ao seu projeto
                alt="Logo Petrobras"
                className="w-20 h-20 object-contain mb-2"
              />
              <p className="text-xl font-bold text-gray-800">NOTA 4.5/5</p>
            </div>

            {/* Seção Central do Título e Botão */}
            <div className="flex-1 flex flex-col items-center md:items-center text-center">
              <h1 className="text-4xl font-extrabold text-purple-700 mb-2">
                TRABALHEI LÁ
              </h1>
              <p className="text-sm text-gray-600 mb-1">
                Sua opinião é anônima e ajuda outros profissionais
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Avaliações anônimas feitas por profissionais verificados.
              </p>
              <a
                href="#" // Link para a página de detalhes ou mais informações
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all transform hover:scale-105 mb-3"
              >
                CLIQUE E SAIBA MAIS
              </a>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span className="flex items-center gap-1">
                  <FaLock className="text-green-500" /> Anônimo
                </span>
                <span className="flex items-center gap-1">
                  <FaStar className="text-green-500" /> Verificado
                </span>
                <span className="flex items-center gap-1">
                  <FaHeart className="text-green-500" /> Confiável
                </span>
              </div>
            </div>

            {/* Seção de Melhores Empresas (Direita) */}
            <div className="flex flex-col items-center md:items-end text-center md:text-right">
              <h2 className="text-xl font-bold text-gray-800 mb-3">
                MELHORES EMPRESAS
              </h2>
              {Array.isArray(top3) && top3.length > 0 ? (
                <div className="space-y-2">
                  {top3.map((emp, t) => {
                    const media = calcularMedia(emp);
                    return (
                      <div key={t} className="flex items-center gap-2">
                        <span className="text-lg">{getMedalEmoji(t)}</span>
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">
                            {t === 0
                              ? "PRIMEIRA EMPRESA"
                              : t === 1
                                ? "SEGUNDA EMPRESA"
                                : "TERCEIRA EMPRESA"}
                          </span>{" "}
                          <span className="font-bold text-green-600">
                            {media}/5
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nenhuma empresa no ranking.</p>
              )}
            </div>
          </div>
        </header>

        {/* Seção de Avaliação da Empresa */}
        <section className="mt-8">
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            <h2 className="text-3xl font-bold text-center text-purple-700 mb-6">
              Avalie uma Empresa
            </h2>
            {error && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
                role="alert"
              >
                <strong className="font-bold">Erro:</strong>
                <span className="block sm:inline"> {error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="company-select"
                  className="block text-gray-700 text-base font-semibold mb-2"
                >
                  Empresa
                </label>
                <Select
                  id="company-select"
                  options={safeCompanyOptions}
                  value={
                    company
                      ? { value: company, label: company }
                      : newCompany
                        ? { value: newCompany, label: newCompany }
                        : null
                  }
                  onChange={(selectedOption) => {
                    if (selectedOption && selectedOption.value === "new-company") {
                      setCompany("");
                      setNewCompany("");
                    } else if (selectedOption) {
                      setCompany(selectedOption.value);
                      setNewCompany("");
                    } else {
                      setCompany("");
                      setNewCompany("");
                    }
                  }}
                  placeholder="Selecione ou digite uma empresa..."
                  isClearable
                  isSearchable
                  styles={selectStyles}
                />
              </div>

              {(company === "new-company" || (!company && newCompany)) && (
                <div>
                  <label
                    htmlFor="new-company-name"
                    className="block text-gray-700 text-base font-semibold mb-2"
                  >
                    Nome da Nova Empresa
                  </label>
                  <input
                    type="text"
                    id="new-company-name"
                    className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Digite o nome da nova empresa"
                    required
                  />
                </div>
              )}

              {ratingFields.map((field, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-gray-800 text-base font-semibold">
                      {field.label}
                    </label>
                  </div>
                  <div className="flex justify-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <OutlinedStar
                        key={star}
                        active={star <= field.value}
                        onClick={() => field.setter(star)}
                        size={28}
                        label={`${star} estrelas para ${field.label}`}
                      />
                    ))}
                  </div>
                  <textarea
                    className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                    rows="2"
                    value={field.comment}
                    onChange={(e) => field.commentSetter(e.target.value)}
                    placeholder={`Comentário sobre ${field.label.toLowerCase()} (opcional)`}
                  ></textarea>
                </div>
              ))}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:shadow-outline transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Avaliar Empresa"}
              </button>
            </form>
          </div>
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
                (empresas || []).map((emp, t) => { // Removido .slice(3) pois top3 está no header
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
