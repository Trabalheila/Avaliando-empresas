import React, { useMemo } from "react";
// import { useNavigate } from "react-router-dom"; // Removido: 'navigate' não é usado
import {
  FaStar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  // FaRocket, // Removido: 'FaRocket' não é usado
  FaHeart,
  FaChartBar,
  // FaExternalLinkAlt, // Removido: 'FaExternalLinkAlt' não é usado
  FaMedal, // Mantido: Usado por getMedalEmoji e getMedalColor
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

// Removido: 'medalColor' não é usado diretamente, 'getMedalColor' é usado
// function medalColor(idx) {
//   if (idx === 0) return "#fbbf24"; // ouro
//   if (idx === 1) return "#cbd5e1"; // prata
//   return "#f59e0b"; // bronze
// }

// Removido: 'getScoreColor' não é usado
// function getScoreColor(score) {
//   if (score >= 4.3) return { className: "text-emerald-600", hex: "#059669" };
//   if (score >= 3.6) return { className: "text-lime-600", hex: "#65a30d" };
//   if (score >= 2.8) return { className: "text-yellow-600", hex: "#ca8a04" };
//   if (score >= 2.0) return { className: "text-orange-600", hex: "#ea580c" };
//   return { className: "text-rose-600", hex: "#e11d48" };
// }

// Removido: 'safeCompanyName' não é usado
// function safeCompanyName(company) {
//   if (!company) return "";
//   if (typeof company === "string") return company;
//   return company.label || company.value || "";
// }

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
  comment,
  setComment,
  empresas,
  isAuthenticated,
  isLoading,
  companies,
  companyOptions,
  formatOptionLabel,
  handleAddCompany,
  handleLinkedInSuccess,
  handleLinkedInFailure,
  handleGoogleLogin,
  handleSubmit,
  calcularMedia,
  getBadgeColor,
  top3,
  getMedalColor,
  getMedalEmoji,
}) {
  // const navigate = useNavigate(); // Removido: 'navigate' não é usado

  const safeCompanyOptions = Array.isArray(companyOptions) ? companyOptions : [];

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || "";
  const linkedInDisabled = Boolean(isLoading || !linkedInClientId);

  const debug = useMemo(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : null;
    return { w, optCount: safeCompanyOptions.length };
  }, [safeCompanyOptions.length]);

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: 14,
      borderColor: state.isFocused ? "#22d3ee" : "#e2e8f0",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(34,211,238,.25)" : "none",
      padding: "2px 6px",
      minHeight: 44,
    }),
    menu: (base) => ({
      ...base,
      borderRadius: 14,
      overflow: "hidden",
      zIndex: 60,
    }),
  };

  // Acessibilidade: Definição dos critérios com IDs únicos
  const criteria = [
    {
      id: "rating-geral-desktop", // Acessibilidade: ID único
      label: "Avaliação Geral",
      value: rating,
      setter: setRating,
      icon: FaStar,
      color: "text-yellow-500",
      comment: commentRating,
      setComment: setCommentRating,
    },
    {
      id: "contato-rh-desktop", // Acessibilidade: ID único
      label: "Contato do RH",
      value: contatoRH,
      setter: setContatoRH,
      icon: FaHandshake,
      color: "text-blue-500",
      comment: commentContatoRH,
      setComment: setCommentContatoRH,
    },
    {
      id: "salario-beneficios-desktop", // Acessibilidade: ID único
      label: "Salário e Benefícios",
      value: salarioBeneficios,
      setter: setSalarioBeneficios,
      icon: FaMoneyBillWave,
      color: "text-green-500",
      comment: commentSalarioBeneficios,
      setComment: setCommentSalarioBeneficios,
    },
    {
      id: "estrutura-empresa-desktop", // Acessibilidade: ID único
      label: "Estrutura da Empresa",
      value: estruturaEmpresa,
      setter: setEstruturaEmpresa,
      icon: FaBuilding,
      color: "text-indigo-500",
      comment: commentEstruturaEmpresa,
      setComment: setCommentEstruturaEmpresa,
    },
    {
      id: "acessibilidade-lideranca-desktop", // Acessibilidade: ID único
      label: "Acessibilidade e Liderança",
      value: acessibilidadeLideranca,
      setter: setAcessibilidadeLideranca,
      icon: FaUserTie,
      color: "text-purple-500",
      comment: commentAcessibilidadeLideranca,
      setComment: setCommentAcessibilidadeLideranca,
    },
    {
      id: "plano-carreiras-desktop", // Acessibilidade: ID único
      label: "Plano de Carreira",
      value: planoCarreiras,
      setter: setPlanoCarreiras,
      icon: FaBriefcase,
      color: "text-cyan-500",
      comment: commentPlanoCarreiras,
      setComment: setCommentPlanoCarreiras,
    },
    {
      id: "bem-estar-desktop", // Acessibilidade: ID único
      label: "Bem-estar e Ambiente",
      value: bemestar,
      setter: setBemestar,
      icon: FaHeart,
      color: "text-rose-500",
      comment: commentBemestar,
      setComment: setCommentBemestar,
    },
    {
      id: "estimulacao-organizacao-desktop", // Acessibilidade: ID único
      label: "Estímulo e Organização",
      value: estimulacaoOrganizacao,
      setter: setEstimulacaoOrganizacao,
      icon: FaLightbulb,
      color: "text-orange-500",
      comment: commentEstimulacaoOrganizacao,
      setComment: setCommentEstimulacaoOrganizacao,
    },
  ];

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 text-slate-800"
      style={{
        backgroundImage: 'url("/fundo-new.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* DEBUG BAR (remova depois) */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="bg-black/50 text-white text-[11px] px-4 py-2 rounded-xl border border-white/10">
          viewport: <b>{debug.w ?? "?"}</b>px • companyOptions:{" "}
          <b>{debug.optCount}</b>
        </div>
      </div>

      <section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-auto px-4"
        style={{ maxWidth: 1120 }}
      >
        {/* Formulário de Avaliação */}
        <div>
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            <h1 className="text-3xl font-extrabold text-center text-violet-700 mb-6">
              Avalie sua Experiência na Empresa
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seleção de Empresa */}
              <div>
                <label
                  htmlFor="company-select-desktop"
                  className="block text-sm font-extrabold text-slate-800 mb-2"
                >
                  🏢 Empresa
                </label>
                <Select
                  id="company-select-desktop"
                  options={companyOptions}
                  value={company}
                  onChange={setCompany}
                  formatOptionLabel={formatOptionLabel}
                  isClearable
                  placeholder="Selecione ou digite o nome da empresa"
                  styles={selectStyles}
                  className="text-sm"
                />
              </div>

              {/* Nova Empresa */}
              {company && company.value === "add_new" && (
                <div>
                  <label
                    htmlFor="new-company-name-desktop"
                    className="block text-sm font-extrabold text-slate-800 mb-2"
                  >
                    Nome da Nova Empresa
                  </label>
                  <input
                    id="new-company-name-desktop"
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full border-2 border-slate-200 p-3 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-sm bg-white/80"
                    placeholder="Digite o nome da nova empresa"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                  >
                    Adicionar Empresa
                  </button>
                </div>
              )}

              {/* Critérios de Avaliação */}
              <div className="space-y-5">
                {criteria.map((item) => {
                  const idPrefix = item.id; // Usar o id já definido
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-5 border-2 border-violet-200"
                    >
                      <label
                        htmlFor={`${idPrefix}-stars-desktop`} // Acessibilidade: htmlFor para o grupo de estrelas
                        className="block text-sm font-extrabold text-slate-800 mb-2 flex items-center gap-2"
                      >
                        <item.icon className={item.color} size={20} />
                        {item.label}
                        <span className="ml-auto text-violet-600 font-bold text-base">
                          {item.value} ⭐
                        </span>
                      </label>
                      <div
                        id={`${idPrefix}-stars-desktop`} // Acessibilidade: ID para o grupo de estrelas
                        className="flex items-center gap-1 mb-3"
                        role="radiogroup" // Acessibilidade: Indica que é um grupo de rádio
                        aria-labelledby={`${idPrefix}-stars-desktop`} // Acessibilidade: Associa ao label
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <OutlinedStar
                            key={star}
                            active={star <= item.value}
                            onClick={() => item.setter(star)}
                            size={24}
                            label={`Avaliar ${item.label} com ${star} de 5 estrelas`} // Acessibilidade: Label para cada estrela
                          />
                        ))}
                      </div>

                      <label htmlFor={`${item.id}-comment-desktop`} className="sr-only">
                        Comentário sobre {item.label.toLowerCase()}
                      </label>
                      <textarea
                        id={`${item.id}-comment-desktop`}
                        value={item.comment}
                        onChange={(e) => item.setComment(e.target.value)}
                        rows={2}
                        className="w-full border-2 border-slate-200 p-2 rounded-xl focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-y text-xs bg-white/80"
                        placeholder={`Comentário sobre ${item.label.toLowerCase()} (opcional)`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Comentário Geral */}
              <div className="bg-white rounded-2xl p-5 border-2 border-violet-200">
                <label
                  htmlFor="general-comment-desktop"
                  className="block text-sm font-extrabold text-slate-800 mb-2"
                >
                  💬 Comentário Geral (opcional)
                </label>
                <textarea
                  id="general-comment-desktop"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full border-2 border-violet-200 p-3 rounded-2xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-y text-sm bg-white/80"
                  placeholder="Compartilhe uma visão geral sobre sua experiência"
                />
              </div>

              {/* Login + envio */}
              <div className="flex flex-col items-center space-y-3">
                {!isAuthenticated ? (
                  <div className="w-full max-w-md space-y-3">
                    <LoginLinkedInButton
                      clientId={linkedInClientId}
                      redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                      onLoginSuccess={handleLinkedInSuccess}
                      onLoginFailure={handleLinkedInFailure}
                      disabled={linkedInDisabled}
                    />

                    {!linkedInClientId && (
                      <div className="text-xs text-rose-700 font-bold">
                        REACT_APP_LINKEDIN_CLIENT_ID não está definido no build.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-lg px-6 py-3 rounded-2xl transition-all font-extrabold text-slate-700 text-sm"
                    >
                      <FcGoogle size={22} />
                      Entrar com Google
                    </button>

                    {isLoading && (
                      <p className="text-sm text-slate-600 text-center animate-pulse">
                        Autenticando...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-3 text-white text-center font-extrabold shadow-lg max-w-md text-sm">
                    ✅ Pronto! Agora você pode enviar sua avaliação anônima
                  </div>
                )}

                <button
                  type="submit"
                  className={`px-10 py-3.5 rounded-2xl text-white font-extrabold text-base transition-all ${
                    isAuthenticated
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-2xl hover:scale-[1.02]"
                      : "bg-slate-400 cursor-not-allowed opacity-60"
                  }`}
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? "Enviar avaliação" : "Faça login para avaliar"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Ranking e Outras Avaliações */}
        <section>
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            <div className="flex flex-col items-center mb-4">
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
