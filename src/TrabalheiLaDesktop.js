import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaStar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaRocket,
  FaHeart,
  FaChartBar,
  FaExternalLinkAlt,
  FaMedal,
  FaBriefcase, // Adicionado para "Plano de Carreira"
  FaLightbulb, // Adicionado para "Organização"
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";

// Acessibilidade: CORREÇÃO DO CAMINHO DE IMPORTAÇÃO
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

function medalColor(idx) {
  if (idx === 0) return "#fbbf24"; // ouro
  if (idx === 1) return "#cbd5e1"; // prata
  return "#f59e0b"; // bronze
}

function getScoreColor(score) {
  if (score >= 4.3) return { className: "text-emerald-600", hex: "#059669" };
  if (score >= 3.6) return { className: "text-lime-600", hex: "#65a30d" };
  if (score >= 2.8) return { className: "text-yellow-600", hex: "#ca8a04" };
  if (score >= 2.0) return { className: "text-orange-600", hex: "#ea580c" };
  return { className: "text-rose-600", hex: "#e11d48" };
}

function safeCompanyName(company) {
  if (!company) return "";
  if (typeof company === "string") return company;
  return company.label || company.value || "";
}

function getCompanyLogo(company) {
  if (!company || typeof company === "string") return "";
  return (
    company.logoUrl ||
    company.logo ||
    company.imageUrl ||
    company.image ||
    ""
  );
}

function mediaToNumber(m) {
  if (typeof m === "number") return m;
  if (typeof m === "string") {
    const cleaned = m.replace(",", ".").match(/[\d.]+/g)?.[0];
    const n = cleaned ? Number(cleaned) : NaN;
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
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
  isAuthenticated,
  isLoading,
  companyOptions,
  formatOptionLabel,
  handleAddCompany,
  handleLinkedInSuccess,
  handleLinkedInFailure,
  handleGoogleLogin,
  handleSubmit,
  calcularMedia,
  top3,
}) {
  const navigate = useNavigate();

  const safeCompanyOptions = Array.isArray(companyOptions) ? companyOptions : [];

  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || ""; // Acessibilidade: Garante que seja string
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
      id: "rating-geral", // Acessibilidade: ID único
      label: "Avaliação Geral",
      value: rating,
      setter: setRating,
      icon: FaStar,
      color: "text-yellow-500",
      comment: commentRating,
      setComment: setCommentRating,
    },
    {
      id: "contato-rh", // Acessibilidade: ID único
      label: "Contato do RH",
      value: contatoRH,
      setter: setContatoRH,
      icon: FaHandshake,
      color: "text-blue-600",
      comment: commentContatoRH,
      setComment: setCommentContatoRH,
    },
    {
      id: "salario-beneficios", // Acessibilidade: ID único
      label: "Salário",
      value: salarioBeneficios,
      setter: setSalarioBeneficios,
      icon: FaMoneyBillWave,
      color: "text-emerald-600",
      comment: commentSalarioBeneficios,
      setComment: setCommentSalarioBeneficios,
    },
    {
      id: "estrutura-empresa", // Acessibilidade: ID único
      label: "Estrutura",
      value: estruturaEmpresa,
      setter: setEstruturaEmpresa,
      icon: FaBuilding,
      color: "text-slate-700",
      comment: commentEstruturaEmpresa,
      setComment: setCommentEstruturaEmpresa,
    },
    {
      id: "acessibilidade-lideranca", // Acessibilidade: ID único
      label: "Liderança",
      value: acessibilidadeLideranca,
      setter: setAcessibilidadeLideranca,
      icon: FaUserTie,
      color: "text-violet-700",
      comment: commentAcessibilidadeLideranca,
      setComment: setCommentAcessibilidadeLideranca,
    },
    {
      id: "plano-carreiras", // Acessibilidade: ID único
      label: "Plano de Carreira",
      value: planoCarreiras,
      setter: setPlanoCarreiras,
      icon: FaBriefcase, // Ícone atualizado
      color: "text-rose-700",
      comment: commentPlanoCarreiras,
      setComment: setCommentPlanoCarreiras,
    },
    {
      id: "bem-estar", // Acessibilidade: ID único
      label: "Bem-estar",
      value: bemestar,
      setter: setBemestar,
      icon: FaHeart,
      color: "text-pink-700",
      comment: commentBemestar,
      setComment: setCommentBemestar,
    },
    {
      id: "estimulacao-organizacao", // Acessibilidade: ID único
      label: "Organização",
      value: estimulacaoOrganizacao,
      setter: setEstimulacaoOrganizacao,
      icon: FaLightbulb, // Ícone atualizado
      color: "text-indigo-700",
      comment: commentEstimulacaoOrganizacao,
      setComment: setCommentEstimulacaoOrganizacao,
    },
  ];

  const selectedCompanyName = safeCompanyName(company);
  const selectedCompanyLogo = getCompanyLogo(company);

  const selectedCompanyScore = useMemo(() => {
    if (!selectedCompanyName) return null;

    const list = (empresas || []).filter(
      (e) => e?.company === selectedCompanyName
    );
    if (list.length === 0) return null;

    const medias = list
      .map((e) => mediaToNumber(calcularMedia(e)))
      .filter((n) => Number.isFinite(n));

    if (med..          <div className="flex items-center justify-between gap-4">
              <div className="text-left">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight drop-shadow-[0_0_10px_rgba(0,0,0,0.1)]">
                  Trabalhei{" "}
                  <span className="text-cyan-500 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]">
                    Lá
                  </span>
                </h1>
                <p className="mt-2 text-sm font-bold text-slate-700">
                  Avaliações reais, anônimas e confiáveis.
                </p>
              </div>

              {isAuthenticated && (
                <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full shadow-lg border border-emerald-500/30 backdrop-blur-md">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-emerald-700 font-semibold">
                    Autenticado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Formulário de Avaliação */}
        <div>
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
                Sua Avaliação Faz a Diferença!
              </h2>
              <p className="text-slate-600">
                Sua opinião é anônima e ajuda outros profissionais
              </p>
            </div>

            {/* Mensagem de privacidade */}
            {!isAuthenticated && (
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 mb-6 text-white shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🔒</div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">
                      Sua privacidade é garantida
                    </h3>
                    <p className="text-sm text-white/90">
                      Usamos o LinkedIn ou Google apenas para verificar seu
                      vínculo profissional. Suas avaliações são{" "}
                      <strong>100% anônimas</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seleção de Empresa */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
                <label
                  htmlFor="company-select-desktop" // Acessibilidade: htmlFor
                  className="block text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-2"
                >
                  <FaBuilding className="text-indigo-700" /> Selecione a Empresa
                </label>

                <Select
                  id="company-select-desktop" // Acessibilidade: id
                  value={company}
                  onChange={setCompany}
                  options={safeCompanyOptions}
                  formatOptionLabel={formatOptionLabel}
                  placeholder="Digite ou selecione..."
                  styles={selectStyles}
                  classNamePrefix="react-select"
                  noOptionsMessage={() =>
                    safeCompanyOptions.length === 0
                      ? "Sem empresas (options vazio)"
                      : "Nenhuma opção"
                  }
                />

                <div className="flex gap-2 mt-3">
                  <label htmlFor="new-company-input-desktop" className="sr-only">
                    Adicionar nova empresa
                  </label>{" "}
                  {/* Acessibilidade: label para screen readers */}
                  <input
                    id="new-company-input-desktop" // Acessibilidade: id
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="flex-1 border-2 border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-sm bg-white"
                    placeholder="Ou adicione uma nova empresa"
                  />
                  <button
                    type="button"
                    onClick={handleAddCompany}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg transition-all font-extrabold whitespace-nowrap text-sm"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Critérios de Avaliação */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {criteria.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-2xl p-4 border-2 border-slate-200 hover:border-violet-400 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={item.color} size={14} />
                          <span className="truncate text-[12px] font-extrabold text-slate-900">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-indigo-700 whitespace-nowrap">
                          {item.value}/5
                        </span>
                      </div>

                      <div className="flex justify-center gap-2 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <OutlinedStar
                            key={star}
                            size={18}
                            active={star <= item.value}
                            onClick={() => item.setter(star)}
                            label={`${item.label}: dar nota ${star} de 5`} // Acessibilidade: label para estrela
                          />
                        ))}
                      </div>

                      <label htmlFor={`${item.id}-comment-desktop`} className="sr-only">
                        Comentário sobre {item.label.toLowerCase()}
                      </label>{" "}
                      {/* Acessibilidade: label para screen readers */}
                      <textarea
                        id={`${item.id}-comment-desktop`} // Acessibilidade: id
                        value={item.comment}
                        onChange={(e) => item.setComment(e.target.value)}
                        rows={2}
                        className="w-full mt-2 border border-slate-300 p-2 rounded-xl text-xs focus:ring-2 focus:ring-cyan-400 focus:border-transparent resize-none"
                        placeholder="Comente (opcional)"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Comentário geral */}
              <div className="bg-gradient-to-br from-violet-50 to-cyan-50 rounded-2xl p-5 border-2 border-violet-200">
                <label
                  htmlFor="general-comment-desktop" // Acessibilidade: htmlFor
                  className="block text-sm font-extrabold text-slate-800 mb-2"
                >
                  💬 Comentário Geral (opcional)
                </label>
                <textarea
                  id="general-comment-desktop" // Acessibilidade: id
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
        </section>

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
