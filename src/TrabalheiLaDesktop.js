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
  // FaMedal, // Removido: 'FaMedal' é importado em TrabalheiLa.js
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
  comment,
  setComment,
  empresas,
  setEmpresas,
  isAuthenticated,
  isLoading,
  companyOptions,
  calcularMedia,
  top3,
  getMedalColor,
  getMedalEmoji,
  getBadgeColor,
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
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#e0f7fa" : "white",
      color: "#333",
      "&:active": {
        backgroundColor: "#b2ebf2",
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: "#333",
      fontWeight: "bold",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#9ca3af",
    }),
  };

  const criteria = [
    {
      id: "rating",
      label: "Avaliação Geral",
      icon: FaStar,
      value: rating,
      setValue: setRating,
      comment: commentRating,
      setComment: setCommentRating,
    },
    {
      id: "contatoRH",
      label: "Contato com RH",
      icon: FaHandshake,
      value: contatoRH,
      setValue: setContatoRH,
      comment: commentContatoRH,
      setComment: setCommentContatoRH,
    },
    {
      id: "salarioBeneficios",
      label: "Salário e Benefícios",
      icon: FaMoneyBillWave,
      value: salarioBeneficios,
      setValue: setSalarioBeneficios,
      comment: commentSalarioBeneficios,
      setComment: setCommentSalarioBeneficios,
    },
    {
      id: "estruturaEmpresa",
      label: "Estrutura da Empresa",
      icon: FaBuilding,
      value: estruturaEmpresa,
      setValue: setEstruturaEmpresa,
      comment: commentEstruturaEmpresa,
      setComment: setCommentEstruturaEmpresa,
    },
    {
      id: "acessibilidadeLideranca",
      label: "Acessibilidade à Liderança",
      icon: FaUserTie,
      value: acessibilidadeLideranca,
      setValue: setAcessibilidadeLideranca,
      comment: commentAcessibilidadeLideranca,
      setComment: setCommentAcessibilidadeLideranca,
    },
    {
      id: "planoCarreiras",
      label: "Plano de Carreira",
      icon: FaBriefcase,
      value: planoCarreiras,
      setValue: setPlanoCarreiras,
      comment: commentPlanoCarreiras,
      setComment: setCommentPlanoCarreiras,
    },
    {
      id: "bemestar",
      label: "Bem-estar e Qualidade de Vida",
      icon: FaHeart,
      value: bemestar,
      setValue: setBemestar,
      comment: commentBemestar,
      setComment: setCommentBemestar,
    },
    {
      id: "estimulacaoOrganizacao",
      label: "Estímulo à Organização",
      icon: FaLightbulb,
      value: estimulacaoOrganizacao,
      setValue: setEstimulacaoOrganizacao,
      comment: commentEstimulacaoOrganizacao,
      setComment: setCommentEstimulacaoOrganizacao,
    },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert("Por favor, faça login para enviar sua avaliação.");
      return;
    }
    if (!company && !newCompany) {
      alert("Por favor, selecione ou digite o nome da empresa.");
      return;
    }

    const companyName = company ? company.value : newCompany;
    if (!companyName) {
      alert("O nome da empresa não pode ser vazio.");
      return;
    }

    const newEvaluation = {
      company: companyName,
      rating,
      contatoRH,
      salarioBeneficios,
      estruturaEmpresa,
      acessibilidadeLideranca,
      planoCarreiras,
      bemestar,
      estimulacaoOrganizacao,
      commentRating,
      commentContatoRH,
      commentSalarioBeneficios,
      commentEstruturaEmpresa,
      commentAcessibilidadeLideranca,
      commentPlanoCarreiras,
      commentBemestar,
      commentEstimulacaoOrganizacao,
      comment,
      // Outros campos como área e período seriam adicionados aqui
      // Ex: area: "Desenvolvimento", periodo: "2023-2024"
    };

    console.log("Nova Avaliação:", newEvaluation);
    setEmpresas((prev) => [...prev, newEvaluation]);

    // Resetar formulário
    setCompany(null);
    setNewCompany("");
    setRating(0);
    setContatoRH(0);
    setSalarioBeneficios(0);
    setEstruturaEmpresa(0);
    setAcessibilidadeLideranca(0);
    setPlanoCarreiras(0);
    setBemestar(0);
    setEstimulacaoOrganizacao(0);
    setCommentRating("");
    setCommentContatoRH("");
    setCommentSalarioBeneficios("");
    setCommentEstruturaEmpresa("");
    setCommentAcessibilidadeLideranca("");
    setCommentPlanoCarreiras("");
    setCommentBemestar("");
    setCommentEstimulacaoOrganizacao("");
    setComment("");

    alert("Avaliação enviada com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-extrabold text-indigo-800 drop-shadow-lg mb-4">
          Trabalhei Lá
        </h1>
        <p className="text-xl text-indigo-600 font-medium max-w-2xl mx-auto">
          Sua plataforma para avaliar empresas de forma anônima e transparente.
          Compartilhe sua experiência e ajude outros profissionais!
        </p>
      </header>

      <section
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-auto"
        style={{ maxWidth: 1120 }}
      >
        {/* Formulário de Avaliação */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-200">
          <h2 className="text-3xl font-bold text-slate-700 text-center mb-6">
            Avalie uma Empresa
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="company-select" className="block text-lg font-semibold text-gray-700 mb-2">
                Empresa:
              </label>
              <Select
                id="company-select"
                options={safeCompanyOptions}
                value={company}
                onChange={setCompany}
                placeholder="Selecione uma empresa existente..."
                isClearable
                isSearchable
                styles={selectStyles}
                className="mb-4"
              />
              <input
                type="text"
                id="new-company-input"
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Ou digite o nome de uma nova empresa"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                aria-label="Nome da nova empresa"
              />
            </div>

            <div className="space-y-5">
              {criteria.map((c) => (
                <div key={c.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor={`rating-${c.id}`} className="flex items-center text-lg font-medium text-gray-800 cursor-pointer">
                      <c.icon className="text-indigo-500 mr-3 text-2xl" />
                      {c.label}:
                    </label>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <OutlinedStar
                          key={star}
                          active={star <= c.value}
                          onClick={() => c.setValue(star)}
                          label={`${star} estrelas para ${c.label}`}
                        />
                      ))}
                    </div>
                  </div>
                  <textarea
                    id={`comment-${c.id}`}
                    className="mt-2 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder={`Comentário sobre ${c.label} (opcional)`}
                    value={c.comment}
                    onChange={(e) => c.setComment(e.target.value)}
                    rows="2"
                    aria-label={`Comentário sobre ${c.label}`}
                  ></textarea>
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="overall-comment" className="block text-lg font-semibold text-gray-700 mb-2">
                Comentário Geral (opcional):
              </label>
              <textarea
                id="overall-comment"
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Adicione um comentário geral sobre sua experiência na empresa..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="4"
                aria-label="Comentário geral sobre a empresa"
              ></textarea>
            </div>

            <div className="flex flex-col items-center space-y-4 pt-4">
              {!isAuthenticated && (
                <div className="flex flex-col items-center space-y-3">
                  <p className="text-sm text-gray-600 font-medium">
                    Faça login para enviar sua avaliação:
                  </p>
                  <LoginLinkedInButton
                    clientId={linkedInClientId}
                    disabled={linkedInDisabled}
                    onLoginSuccess={() => console.log("Login LinkedIn Sucesso!")}
                    onLoginFailure={(error) => console.error("Login LinkedIn Falha:", error)}
                  />
                  <button
                    type="button"
                    className="flex items-center justify-center px-6 py-2.5 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    aria-label="Login com Google"
                  >
                    <FcGoogle className="mr-2 text-xl" />
                    Login com Google
                  </button>
                </div>
              )}

              {isAuthenticated && (
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

        {/* Ranking e Outras Avaliações */}
        <section className="bg-white rounded-3xl shadow-2xl p-8 border border-slate-200">
          <div className="flex flex-col items-center mb-6">
            <h2 className="text-3xl font-bold text-slate-700 text-center mb-3">
              Ranking - Top Empresas Avaliadas
            </h2>
            <img
              src="/trofeu-new.png"
              alt="Troféu Trabalhei Lá"
              className="w-24 h-24 object-contain drop-shadow-lg"
            />
          </div>
          {Array.isArray(top3) && top3.length > 0 && (
            <div className="mb-6 space-y-4">
              {top3.map((emp, t) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={t}
                    className={`bg-gradient-to-r ${getMedalColor(
                      t
                    )} rounded-2xl p-5 text-white shadow-lg`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-4xl">{getMedalEmoji(t)}</span>
                        <div>
                          <h3 className="font-bold text-lg">{emp.company}</h3>
                          <p className="text-sm opacity-90">
                            {emp.area} • {emp.periodo}
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/20 px-4 py-2 rounded-full font-bold text-base">
                        {media} ⭐
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
            {Array.isArray(empresas) && empresas.length === 0 ? (
              <div className="text-center py-10">
                <FaChartBar className="text-gray-300 text-6xl mx-auto mb-4" />
                <p className="text-gray-500 font-medium text-xl">
                  Nenhuma avaliação ainda
                </p>
                <p className="text-base text-gray-400 mt-2">
                  Seja o primeiro a avaliar!
                </p>
              </div>
            ) : (
              (empresas || []).slice(3).map((emp, t) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={t}
                    className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-5 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors text-lg">
                          {emp.company}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {emp.area} • {emp.periodo}
                        </p>
                      </div>
                      <div
                        className={`${getBadgeColor(
                          media
                        )} px-4 py-2 rounded-full text-white font-bold text-base shadow-md`}
                      >
                        {media} ⭐
                      </div>
                    </div>

                    {emp.comment && (
                      <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-3 mt-3">
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
