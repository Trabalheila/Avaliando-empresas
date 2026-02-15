import React, { useMemo } from "react";
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
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";

/** ⭐ Estrela com contorno preto (overlay 100% confiável via inline style) */
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
  if (idx === 0) return "#fbbf24"; // gold
  if (idx === 1) return "#cbd5e1"; // silver
  return "#f59e0b"; // bronze-ish
}

function getScoreColor(score) {
  // score 0..5
  if (score >= 4.3) return { className: "text-emerald-600", hex: "#059669" };
  if (score >= 3.6) return { className: "text-lime-600", hex: "#65a30d" };
  if (score >= 2.8) return { className: "text-yellow-600", hex: "#ca8a04" };
  if (score >= 2.0) return { className: "text-orange-600", hex: "#ea580c" };
  return { className: "text-rose-600", hex: "#e11d48" };
}

function safeCompanyName(company) {
  if (!company) return "";
  if (typeof company === "string") return company;
  // react-select costuma usar { value, label }
  return company.label || company.value || "";
}

function getCompanyLogo(company) {
  if (!company || typeof company === "string") return "";
  // compatível com vários formatos possíveis
  return company.logoUrl || company.logo || company.imageUrl || company.image || "";
}

/** Converte calcularMedia(emp) em número de forma robusta */
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
  getBadgeColor,
  top3,
  getMedalColor, // pode continuar existindo (não atrapalha)
  getMedalEmoji, // pode continuar existindo (não atrapalha)
}) {
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

  const criteria = [
    {
      label: "Avaliação Geral",
      value: rating,
      setter: setRating,
      icon: FaStar,
      color: "text-yellow-500",
      comment: commentRating,
      setComment: setCommentRating,
    },
    {
      label: "Contato do RH",
      value: contatoRH,
      setter: setContatoRH,
      icon: FaHandshake,
      color: "text-blue-600",
      comment: commentContatoRH,
      setComment: setCommentContatoRH,
    },
    {
      label: "Salário",
      value: salarioBeneficios,
      setter: setSalarioBeneficios,
      icon: FaMoneyBillWave,
      color: "text-emerald-600",
      comment: commentSalarioBeneficios,
      setComment: setCommentSalarioBeneficios,
    },
    {
      label: "Estrutura",
      value: estruturaEmpresa,
      setter: setEstruturaEmpresa,
      icon: FaBuilding,
      color: "text-slate-700",
      comment: commentEstruturaEmpresa,
      setComment: setCommentEstruturaEmpresa,
    },
    {
      label: "Liderança",
      value: acessibilidadeLideranca,
      setter: setAcessibilidadeLideranca,
      icon: FaUserTie,
      color: "text-violet-700",
      comment: commentAcessibilidadeLideranca,
      setComment: setCommentAcessibilidadeLideranca,
    },
    {
      label: "Plano de Carreira",
      value: planoCarreiras,
      setter: setPlanoCarreiras,
      icon: FaRocket,
      color: "text-rose-700",
      comment: commentPlanoCarreiras,
      setComment: setCommentPlanoCarreiras,
    },
    {
      label: "Bem-estar",
      value: bemestar,
      setter: setBemestar,
      icon: FaHeart,
      color: "text-pink-700",
      comment: commentBemestar,
      setComment: setCommentBemestar,
    },
    {
      label: "Organização",
      value: estimulacaoOrganizacao,
      setter: setEstimulacaoOrganizacao,
      icon: FaChartBar,
      color: "text-indigo-700",
      comment: commentEstimulacaoOrganizacao,
      setComment: setCommentEstimulacaoOrganizacao,
    },
  ];

  const selectedCompanyName = safeCompanyName(company);
  const selectedCompanyLogo = getCompanyLogo(company);

  const selectedCompanyScore = useMemo(() => {
    if (!selectedCompanyName) return null;
    const list = (empresas || []).filter((e) => e?.company === selectedCompanyName);
    if (list.length === 0) return null;

    // média da média (robusta, sem conhecer campos internos)
    const medias = list
      .map((e) => mediaToNumber(calcularMedia(e)))
      .filter((n) => Number.isFinite(n));

    if (medias.length === 0) return null;

    const avg = medias.reduce((a, b) => a + b, 0) / medias.length;
    return Math.round(avg * 10) / 10;
  }, [empresas, selectedCompanyName, calcularMedia]);

  const scoreColor = selectedCompanyScore == null ? null : getScoreColor(selectedCompanyScore);

  function goToCompanyPage() {
    if (!selectedCompanyName) {
      document.getElementById("avaliacao")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.location.href = `/empresa/${encodeURIComponent(selectedCompanyName)}`;
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{
        backgroundImage: 'url("/fundo-new.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* HEADER */}
      <header className="relative overflow-hidden bg-slate-950/70 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        {/* glow */}
        <div className="absolute inset-0 opacity-35 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-cyan-400 rounded-full blur-3xl" />
          <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        </div>

        <div
          className="relative mx-auto px-6 md:px-8 py-6"
          style={{ maxWidth: 1120 }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* ESQUERDA: marca + empresa selecionada */}
            <div>
              <div className="flex items-start justify-between">
                <div className="text-white/60 text-xs font-bold hidden md:block">
                  Avaliações anônimas • Profissionais verificados
                </div>

                {isAuthenticated ? (
                  <div className="flex items-center gap-2 bg-emerald-500/15 px-4 py-2 rounded-full border border-emerald-400/40">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs md:text-sm text-white font-semibold">
                      Autenticado
                    </span>
                  </div>
                ) : (
                  <div className="hidden md:block text-white/50 text-xs">
                    Login para avaliar
                  </div>
                )}
              </div>

              {/* Marca em CAIXA ALTA */}
              <div className="text-center lg:text-left mt-3">
                <h1 className="font-display text-4xl md:text-5xl font-extrabold text-white tracking-[0.12em]">
                  TRABALHEI{" "}
                  <span className="text-[#4FC3F7] drop-shadow-[0_0_18px_rgba(79,195,247,0.55)]">
                    LÁ
                  </span>
                </h1>

                <p className="text-white/90 text-sm md:text-base mt-2 font-extrabold">
                  Descubra como as empresas realmente são por dentro.
                </p>
                <p className="text-white/60 text-xs md:text-sm mt-1 font-extrabold">
                  Avaliações anônimas feitas por profissionais verificados.
                </p>

                {/* selos abaixo do título */}
                <div className="mt-3 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-white/75 text-xs font-semibold">
                  <span>✓ Anônimo</span>
                  <span>✓ Verificado</span>
                  <span>✓ Confiável</span>
                </div>

                {/* Empresa selecionada + logo + nota geral */}
                <div className="mt-5 flex items-center justify-center lg:justify-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
                    {selectedCompanyLogo ? (
                      <img
                        src={selectedCompanyLogo}
                        alt={`Logo de ${selectedCompanyName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-extrabold">
                        {selectedCompanyName ? selectedCompanyName[0]?.toUpperCase() : "?"}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="text-white font-extrabold truncate">
                      {selectedCompanyName || "Selecione uma empresa abaixo"}
                    </div>

                    <div className="text-xs font-extrabold">
                      {selectedCompanyScore == null ? (
                        <span className="text-white/70">Sem nota ainda</span>
                      ) : (
                        <span
                          className={scoreColor?.className || ""}
                          style={{ color: scoreColor?.hex }}
                        >
                          Nota geral: {selectedCompanyScore.toFixed(1)} / 5
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botão menor */}
                  <button
                    type="button"
                    onClick={goToCompanyPage}
                    className="shrink-0 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-extrabold px-4 py-2 rounded-xl text-xs tracking-wide"
                    style={{ textTransform: "uppercase" }}
                  >
                    CLIQUE E SAIBA MAIS
                  </button>
                </div>
              </div>
            </div>

            {/* DIREITA: ranking top 3 */}
            <aside className="bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-md">
              <div className="text-white font-extrabold text-sm mb-3">
                Ranking • Top 3
              </div>

              <div className="space-y-3">
                {(top3 || []).slice(0, 3).map((emp, idx) => {
                  const media = calcularMedia(emp);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        (window.location.href = `/empresa/${encodeURIComponent(emp.company)}`)
                      }
                      className="w-full text-left flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl px-3 py-2 transition"
                    >
                      <FaMedal size={18} color={medalColor(idx)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-bold text-sm truncate">
                          {emp.company}
                        </div>
                        <div className="text-white/70 text-xs">
                          {media} ⭐
                        </div>
                      </div>
                      <FaExternalLinkAlt className="text-white/60" size={12} />
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </header>

      {/* FORM */}
      <section
        id="avaliacao"
        className="mx-auto px-6 md:px-8 py-10"
        style={{ maxWidth: 1120 }}
      >
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-6">
            <h2 className="font-display text-3xl font-extrabold text-slate-900 mb-2">
              Avalie uma Empresa
            </h2>
            <p className="text-slate-600">
              Sua opinião é anônima e ajuda outros profissionais
            </p>
          </div>

          {!isAuthenticated && (
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 mb-6 text-white shadow-lg">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔒</div>
                <div>
                  <h3 className="font-bold text-base mb-1">
                    Sua privacidade é garantida
                  </h3>
                  <p className="text-sm text-white/90">
                    Usamos o LinkedIn ou Google apenas para verificar seu vínculo
                    profissional. Suas avaliações são <strong>100% anônimas</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Empresa */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border border-slate-200">
              <label className="block text-sm font-extrabold text-slate-800 mb-3 flex items-center gap-2">
                <FaBuilding className="text-indigo-700" />
                Selecione a Empresa
              </label>

              <Select
                value={company}
                onChange={setCompany}
                options={companyOptions}
                formatOptionLabel={formatOptionLabel}
                placeholder="Digite ou selecione..."
                styles={selectStyles}
                classNamePrefix="react-select"
              />

              <div className="flex gap-2 mt-3">
                <input
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

            {/* Critérios */}
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
                          label={`${item.label}: dar nota ${star} de 5`}
                        />
                      ))}
                    </div>

                    <textarea
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
              <label className="block text-sm font-extrabold text-slate-800 mb-2">
                💬 Comentário Geral (opcional)
              </label>
              <textarea
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
                    clientId={process.env.REACT_APP_LINKEDIN_CLIENT_ID || "77dv5urtc8ixj3"}
                    redirectUri="https://www.trabalheila.com.br/auth/linkedin"
                    onLoginSuccess={handleLinkedInSuccess}
                    onLoginFailure={handleLinkedInFailure}
                    disabled={isLoading}
                  />

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

      {/* Footer */}
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
