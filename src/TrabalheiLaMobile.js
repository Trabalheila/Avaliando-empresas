import React, { useEffect, useMemo, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FaChartBar } from "react-icons/fa"; // Importação adicionada para o ícone de gráfico
import {
  FaStar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaBriefcase,
  FaHeart,
  FaLightbulb,
} from "react-icons/fa"; // Ícones para as categorias de avaliação
import Select from "react-select"; // Importação do react-select

// Importações de componentes e módulos auxiliares
import LoginLinkedInButton from "./LoginLinkedInButton"; // Assumindo que este é um componente para o botão do LinkedIn
import * as featuredModule from "./data/featuredCompanies"; // Assumindo que este módulo existe

// Funções auxiliares (mantidas como estavam)
const featuredSeed = featuredModule.featuredCompanies ?? featuredModule.default ?? [];

function normalizeCompanyName(item) {
  if (typeof item === "string") return item.trim();

  if (item && typeof item === "object") {
    const candidate = item.name ?? item.company ?? item.nome ?? item.label ?? item.value;
    if (typeof candidate === "string") return candidate.trim();
  }
  return "";
}

function uniqueStrings(list) {
  const out = [];
  const seen = new Set();
  for (const x of list) {
    const s = typeof x === "string" ? x.trim() : "";
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Componente TrabalheiLaMobile (com as melhorias de acessibilidade)
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
  // Estado para detectar mobile (mantido como estava)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleResize = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  // Definição das categorias de avaliação (mantido como estava)
  const ratingCategories = useMemo(
    () => [
      {
        label: "Avaliação Geral",
        value: rating,
        setter: setRating,
        icon: FaStar,
        color: "text-yellow-500",
        comment: commentRating,
        setComment: setCommentRating,
        idPrefix: "rating-geral", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Contato do RH",
        value: contatoRH,
        setter: setContatoRH,
        icon: FaHandshake,
        color: "text-blue-500",
        comment: commentContatoRH,
        setComment: setCommentContatoRH,
        idPrefix: "rating-rh", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Salário e Benefícios",
        value: salarioBeneficios,
        setter: setSalarioBeneficios,
        icon: FaMoneyBillWave,
        color: "text-green-500",
        comment: commentSalarioBeneficios,
        setComment: setCommentSalarioBeneficios,
        idPrefix: "rating-salario", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Estrutura",
        value: estruturaEmpresa,
        setter: setEstruturaEmpresa,
        icon: FaBuilding,
        color: "text-gray-600",
        comment: commentEstruturaEmpresa,
        setComment: setCommentEstruturaEmpresa,
        idPrefix: "rating-estrutura", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Liderança",
        value: acessibilidadeLideranca,
        setter: setAcessibilidadeLideranca,
        icon: FaUserTie,
        color: "text-purple-500",
        comment: commentAcessibilidadeLideranca,
        setComment: setCommentAcessibilidadeLideranca,
        idPrefix: "rating-lideranca", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Plano de Carreira",
        value: planoCarreiras,
        setter: setPlanoCarreiras,
        icon: FaBriefcase,
        color: "text-red-500",
        comment: commentPlanoCarreiras,
        setComment: setCommentPlanoCarreiras,
        idPrefix: "rating-carreira", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Bem-estar",
        value: bemestar,
        setter: setBemestar,
        icon: FaHeart,
        color: "text-pink-500",
        comment: commentBemestar,
        setComment: setCommentBemestar,
        idPrefix: "rating-bemestar", // Acessibilidade: idPrefix para os campos
      },
      {
        label: "Organização",
        value: estimulacaoOrganizacao,
        setter: setEstimulacaoOrganizacao,
        icon: FaLightbulb,
        color: "text-indigo-500",
        comment: commentEstimulacaoOrganizacao,
        setComment: setCommentEstimulacaoOrganizacao,
        idPrefix: "rating-organizacao", // Acessibilidade: idPrefix para os campos
      },
    ],
    [
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
    ]
  );

  return (
    <div
      className="min-h-screen p-2"
      style={{
        backgroundImage: 'url("/fundo-new.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Header (mantido como estava) */}
      <div className="max-w-7xl mx-auto mb-2">
        <div className="bg-black/50 text-white text-[11px] px-3 py-2 rounded-xl border border-white/10">
          viewport: <b>{typeof window !== "undefined" ? window.innerWidth : "?"}</b>
          px • companyOptions: <b>{Array.isArray(companyOptions) ? companyOptions.length : "?"}</b>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-6">
        <div className="rounded-3xl shadow-2xl border border-white/20 overflow-hidden relative bg-black/50 backdrop-blur-sm">
          <div className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <h1 className="text-3xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">
                  Trabalhei{" "}
                  <span className="text-[#4FC3F7] drop-shadow-[0_0_8px_rgba(0,0,0,1)]">
                    Lá
                  </span>
                </h1>
                <p className="mt-2 text-xs font-bold text-white">
                  Avaliações reais, anônimas e confiáveis.
                </p>
              </div>
              {isAuthenticated && (
                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full shadow-lg border border-white/30 backdrop-blur-md">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-white font-semibold">
                    Autenticado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid gap-6">
        {/* Formulário de Avaliação */}
        <div>
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-3 border border-white/20">
            {!isAuthenticated && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-4 mb-6 text-white shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🔒</div>
                  <div>
                    <h3 className="font-bold text-base mb-1">
                      Sua privacidade é garantida
                    </h3>
                    <p className="text-xs text-blue-50">
                      Usamos o LinkedIn ou Google apenas para verificar seu
                      vínculo profissional. Suas avaliações são{" "}
                      <strong>100% anônimas</strong> — nome e perfil nunca são
                      exibidos.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seleção de Empresa */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 border border-gray-200">
                {/* Acessibilidade: Adicionado htmlFor e id */}
                <label
                  htmlFor="company-select"
                  className="block text-xs font-bold text-gray-700 mb-2 flex items-center gap-2"
                >
                  <FaBuilding className="text-blue-600" /> Selecione a Empresa
                </label>
                <Select
                  id="company-select" // Acessibilidade: id para o Select
                  value={company}
                  onChange={setCompany}
                  options={companyOptions}
                  formatOptionLabel={formatOptionLabel}
                  placeholder="Digite ou selecione..."
                  className="mb-3 text-sm"
                  noOptionsMessage={() =>
                    companyOptions.length === 0
                      ? "Sem empresas (options vazio)"
                      : "Nenhuma opção"
                  }
                />
                <div className="flex gap-2">
                  {/* Acessibilidade: Adicionado htmlFor e id */}
                  <label htmlFor="new-company-input" className="sr-only">
                    Ou adicione uma nova empresa
                  </label>{" "}
                  {/* sr-only para esconder visualmente, mas manter para leitores de tela */}
                  <input
                    id="new-company-input" // Acessibilidade: id para o input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="flex-1 border-2 border-gray-300 p-2 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="Ou adicione uma nova empresa"
                  />
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-2 rounded-xl hover:shadow-lg transition-all font-semibold whitespace-nowrap text-xs"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Categorias de Avaliação */}
              <div className="grid grid-cols-1 gap-3">
                {ratingCategories.map((category, index) => {
                  const Icon = category.icon;
                  return (
                    <div
                      key={index}
                      className="bg-white rounded-xl p-3 border-2 border-gray-200 hover:border-purple-400 transition-all"
                    >
                      {/* Acessibilidade: Adicionado htmlFor e id */}
                      <label
                        htmlFor={`${category.idPrefix}-comment`}
                        className="block text-xs font-extrabold text-[#1E3A8A] mb-2 flex items-center gap-2 drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]"
                      >
                        <Icon className={category.color} /> {category.label}{" "}
                        <span className="ml-auto text-purple-600">
                          {category.value}/5
                        </span>
                      </label>
                      <div className="flex gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <FaStar
                            key={starValue}
                            size={20}
                            className="cursor-pointer transition-all hover:scale-110"
                            color={
                              starValue <= category.value ? "#facc15" : "#e5e7eb"
                            }
                            onClick={() => category.setter(starValue)}
                            // Acessibilidade: Adicionado aria-label para cada estrela
                            aria-label={`Avaliar ${category.label} com ${starValue} de 5 estrelas`}
                          />
                        ))}
                      </div>
                      <textarea
                        id={`${category.idPrefix}-comment`} // Acessibilidade: id para o textarea
                        value={category.comment}
                        onChange={(e) => category.setComment(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 p-2 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y max-h-32"
                        placeholder={`Comente sobre ${category.label.toLowerCase()} (opcional)`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Comentário Geral */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                {/* Acessibilidade: Adicionado htmlFor e id */}
                <label
                  htmlFor="general-comment"
                  className="block text-xs font-bold text-gray-700 mb-2"
                >
                  💬 Comentário Geral (opcional)
                </label>
                <textarea
                  id="general-comment" // Acessibilidade: id para o textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="w-full border-2 border-purple-300 p-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y max-h-40 text-xs"
                  placeholder="Compartilhe uma visão geral sobre sua experiência (opcional)"
                />
              </div>

              {/* Login + Envio */}
              <div className="flex flex-col items-center space-y-3">
                {!isAuthenticated ? (
                  <div className="w-full max-w-xs space-y-3">
                    <LoginLinkedInButton
                      clientId={process.env.REACT_APP_LINKEDIN_CLIENT_ID}
                      redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                      onLoginSuccess={handleLinkedInSuccess}
                      onLoginFailure={handleLinkedInFailure}
                      disabled={isLoading}
                    />

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 hover:border-gray-400 hover:shadow-lg px-6 py-3 rounded-xl transition-all font-semibold text-gray-700 text-sm"
                    >
                      <FcGoogle size={24} />
                      Entrar com Google
                    </button>

                    {isLoading && (
                      <p className="text-xs text-gray-600 mt-2 text-center animate-pulse">
                        Autenticando...
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl p-3 text-white text-center font-semibold shadow-lg max-w-md text-xs">
                    ✅ Pronto! Agora você pode enviar sua avaliação anônima
                  </div>
                )}

                <button
                  type="submit"
                  className={`px-6 py-2.5 rounded-xl text-white font-semibold text-xs transition-all max-w-xs w-full ${
                    isAuthenticated
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg"
                      : "bg-gray-400 cursor-not-allowed opacity-60"
                  }`}
                  disabled={!isAuthenticated}
                >
                  {isAuthenticated ? "🚀 Enviar Avaliação" : "🔒 Faça login para avaliar"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Ranking */}
        <div>
          <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-4 border border-white/20">
            <div className="flex flex-col items-center mb-4">
              <h2 className="text-sm font-bold text-slate-700 text-center mb-3">
                Ranking - Top Empresas Avaliadas
              </h2>
              <img
                src="/trofeu-new.png"
                alt="Troféu Trabalhei Lá"
                className="w-16 h-16 object-contain drop-shadow-lg"
              />
            </div>

            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-4 space-y-2">
                {top3.map((emp, idx) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={idx}
                      className={`bg-gradient-to-r ${getMedalColor(idx)} rounded-2xl p-3 text-white shadow-lg`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getMedalEmoji(idx)}</span>
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
