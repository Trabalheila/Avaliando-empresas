import React from "react";

import { Link, useNavigate } from "react-router-dom";
import {
  FaStar, FaUserEdit, FaGoogle, FaBuilding,
} from "react-icons/fa";
import {
  FiMessageCircle, FiDollarSign, FiCompass, FiCalendar, FiUsers,
  FiBriefcase, FiShield, FiHeart, FiRepeat, FiAward, FiTrendingUp, FiAlertCircle,
} from "react-icons/fi";
import Select from "react-select";
import LoginLinkedInButton from "./LoginLinkedInButton";
import CaptchaModal from "./components/CaptchaModal";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";

function OutlinedStar({ active, onClick, size = 18, label }) {
  const outlineScale = 1.24;
  const touchSize = size * 1.8;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        padding: 4,
        margin: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        lineHeight: 0,
        touchAction: "manipulation",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: touchSize,
        height: touchSize,
      }}
    >
      <span
        style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle" }}
      >
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
        <span style={{ position: "relative" }} aria-hidden="true">
          <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
        </span>
      </span>
    </button>
  );
}


function TrabalheiLaMobile({
  theme, toggleTheme, firebaseStatus,
  company, setCompany,
  rating, setRating,
  salario, setSalario,
  beneficios, setBeneficios,
  cultura, setCultura,
  oportunidades, setOportunidades,
  inovacao, setInovacao,
  lideranca, setLideranca,
  diversidade, setDiversidade,
  ambiente, setAmbiente,
  equilibrio, setEquilibrio,
  reconhecimento, setReconhecimento,
  comunicacao, setComunicacao,
  etica, setEtica,
  desenvolvimento, setDesenvolvimento,
  saudeBemEstar, setSaudeBemEstar,
  impactoSocial, setImpactoSocial,
  reputacao, setReputacao,
  estimacaoOrganizacao, setEstimacaoOrganizacao,
  commentRating, setCommentRating,
  commentSalario, setCommentSalario,
  commentBeneficios, setCommentBeneficios,
  commentCultura, setCommentCultura,
  commentOportunidades, setCommentOportunidades,
  commentInovacao, setCommentInovacao,
  commentLideranca, setCommentLideranca,
  commentDiversidade, setCommentDiversidade,
  commentAmbiente, setCommentAmbiente,
  commentEquilibrio, setCommentEquilibrio,
  commentReconhecimento, setCommentReconhecimento,
  commentComunicacao, setCommentComunicacao,
  commentEtica, setCommentEtica,
  commentDesenvolvimento, setCommentDesenvolvimento,
  commentSaudeBemEstar, setCommentSaudeBemEstar,
  commentImpactoSocial, setCommentImpactoSocial,
  commentReputacao, setCommentReputacao,
  commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
  entrySource, setEntrySource, contractType, setContractType, workModel, setWorkModel,
  generalComment, setGeneralComment,
  handleSubmit, isLoading,
  empresas, top3,
  showNewCompanyInput, setShowNewCompanyInput,
  handleAddNewCompany, handleConfirmNewCompany, pendingCompanyData, newCompanyCnpj, setNewCompanyCnpj, cnpjError,
  sectorFilter, setSectorFilter, setoresList,
  handleSaibaMais,
  linkedInClientId, linkedInRedirectUri,
  error, setError, isAuthenticated, userProfile, userPseudonym, onLoginSuccess, safeCompanyOptions,
  handleLogout,
  onGoogleLogin,
  globalContractStats,
  globalWorkModelStats,
  selectedCompanyData,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed,
}) {
  // const { t } = useTranslation();
  const navigate = useNavigate();
  const legacyMetricsBridge = {
    beneficios, setBeneficios,
    oportunidades, setOportunidades,
    inovacao, setInovacao,
    impactoSocial, setImpactoSocial,
    reputacao, setReputacao,
    estimacaoOrganizacao, setEstimacaoOrganizacao,
    commentBeneficios, setCommentBeneficios,
    commentOportunidades, setCommentOportunidades,
    commentInovacao, setCommentInovacao,
    commentImpactoSocial, setCommentImpactoSocial,
    commentReputacao, setCommentReputacao,
    commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
  };
  void legacyMetricsBridge;

  const calcularMedia = (emp) => {
    if (!emp) return "--";

    const ratings = [
      emp.rating, emp.salario, emp.beneficios, emp.cultura, emp.oportunidades,
      emp.inovacao, emp.lideranca, emp.diversidade, emp.ambiente, emp.equilibrio,
      emp.reconhecimento, emp.comunicacao, emp.etica, emp.desenvolvimento,
      emp.saudeBemEstar, emp.impactoSocial, emp.reputacao, emp.estimacaoOrganizacao,
    ].filter((val) => typeof val === "number" && !isNaN(val) && val > 0);

    if (ratings.length === 0) return "--";
    const sum = ratings.reduce((acc, curr) => acc + curr, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const logoCandidates = selectedCompanyData
    ? getCompanyLogoCandidates(selectedCompanyData.company, {
      size: 128,
      website: selectedCompanyData.website,
    })
    : [];
  const [logoIndex, setLogoIndex] = React.useState(0);
  const companyLogoUrl = logoCandidates[logoIndex] || null;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [selectedCompanyData?.company, selectedCompanyData?.website]);
  const companyAverage = selectedCompanyData ? calcularMedia(selectedCompanyData) : "--";
  const companyAverageValue = Number.parseFloat(companyAverage);
  const isCompanyRecommended = companyAverage !== "--" && Number.isFinite(companyAverageValue) && companyAverageValue >= 3;


  const getBadgeColor = (media) => {
    if (media == null || media === "--") return "bg-slate-500";

    const numeric = typeof media === "number" ? media : Number(media);
    if (!Number.isFinite(numeric)) return "bg-slate-500";

    if (numeric >= 4.5) return "bg-emerald-700";
    if (numeric >= 4) return "bg-lime-600";
    if (numeric >= 3) return "bg-yellow-600";
    if (numeric >= 2) return "bg-purple-600";
    return "bg-red-600";
  };

  const getMedalColor = (index) => {
      // Exemplo de uso de tradução:
      // t('Processo de Recrutamento')
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

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: "0.75rem",
      padding: "0.25rem",
      borderColor: state.isFocused ? "#1d4ed8" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #1d4ed8" : "none",
      backgroundColor: "#ffffff",
    }),
    menu: (base) => ({
      ...base,
      borderRadius: "0.75rem",
      overflow: "hidden",
      border: "1px solid #dbeafe",
      boxShadow: "0 10px 30px rgba(30, 58, 138, 0.12)",
    }),
    option: (base, state) => ({
      ...base,
      color: "#1e3a8a",
      backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#eff6ff" : "#ffffff",
      fontWeight: state.isSelected ? 700 : 500,
      cursor: "pointer",
    }),
    singleValue: (base) => ({
      ...base,
      color: "#1e3a8a",
      fontWeight: 600,
    }),
    input: (base) => ({
      ...base,
      color: "#1e3a8a",
    }),
    placeholder: (base) => ({
      ...base,
      color: "#1e3a8a",
      fontWeight: 500,
    }),
  };

  const renderStars = (value, setValue, commentValue, setCommentValue, label) => (
    <div className="flex flex-col items-end w-full mt-2">
      <div className="flex items-center space-x-1 mb-2">
        {[...Array(5)].map((_, i) => (
          <OutlinedStar key={i} active={i < value} onClick={() => setValue(i + 1)} label={`${i + 1} estrelas`} />
        ))}
        <span className="ml-2 text-slate-700 dark:text-blue-200 font-medium">{value}/5</span>
      </div>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 mt-2"
        placeholder={`Comentário sobre ${label.toLowerCase()} (opcional)`}
        rows={3}
        value={commentValue}
        onChange={(e) => setCommentValue(e.target.value)}
      />
    </div>
  );

  const campos = [
    { label: "Processo de Recrutamento", icon: <FiMessageCircle className="text-cyan-700" />, iconBg: "from-cyan-50 to-sky-100 border-cyan-200", value: comunicacao, set: setComunicacao, comment: commentComunicacao, setComment: setCommentComunicacao },
    { label: "Proposta salarial e benefícios", icon: <FiDollarSign className="text-emerald-600" />, iconBg: "from-emerald-50 to-lime-100 border-emerald-200", value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica },
    { label: "Visão e valores da empresa", icon: <FiCompass className="text-slate-700" />, iconBg: "from-slate-50 to-slate-100 border-slate-300", value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura },
    { label: "Data do Pagamento", icon: <FiCalendar className="text-rose-600" />, iconBg: "from-rose-50 to-red-100 border-rose-200", value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario },
    { label: "Acessibilidade e respeito da liderança", icon: <FiUsers className="text-violet-700" />, iconBg: "from-violet-50 to-indigo-100 border-violet-200", value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca },
    { label: "Condições de trabalho", icon: <FiBriefcase className="text-blue-600" />, iconBg: "from-blue-50 to-indigo-100 border-blue-200", value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimacaoOrganizacao },
    { label: "Estímulo ao respeito", icon: <FiUsers className="text-teal-700" />, iconBg: "from-teal-50 to-emerald-100 border-teal-200", value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente },
    { label: "sofreu discriminação?", icon: <FiAlertCircle className="text-cyan-700" />, iconBg: "from-cyan-50 to-sky-100 border-cyan-200", value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade },
    { label: "Segurança e integridade", icon: <FiShield className="text-amber-600" />, iconBg: "from-amber-50 to-yellow-100 border-amber-200", value: rating, set: setRating, comment: commentRating, setComment: setCommentRating },
    { label: "Preocupação com o bem estar", icon: <FiHeart className="text-red-600" />, iconBg: "from-red-50 to-rose-100 border-red-200", value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar },
    { label: "Rotatividade", subtitle: "(Demite com facilidade?)", icon: <FiRepeat className="text-slate-700" />, iconBg: "from-slate-50 to-gray-100 border-slate-300", value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio },
    { label: "Reconhecimento", icon: <FiAward className="text-amber-600" />, iconBg: "from-amber-50 to-orange-100 border-amber-200", value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento },
    { label: "Planos de cargos e salários", icon: <FiTrendingUp className="text-fuchsia-700" />, iconBg: "from-fuchsia-50 to-pink-100 border-fuchsia-200", value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento },
  ];

  // Progress bar: IntersectionObserver para critérios
  const criterionRefs = React.useRef([]);
  const [visibleCriterionIdx, setVisibleCriterionIdx] = React.useState(-1);

  React.useEffect(() => {
    const refs = criterionRefs.current;
    if (!refs.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let maxIdx = -1;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.criterionIdx);
            if (idx > maxIdx) maxIdx = idx;
          }
        }
        if (maxIdx >= 0) setVisibleCriterionIdx(maxIdx);
      },
      { threshold: 0.5 }
    );
    for (const el of refs) { if (el) observer.observe(el); }
    return () => observer.disconnect();
  }, [campos.length]);

  const sourceConfig = [
    { key: "indicacao", label: "Indicação", color: "#2563eb" },
    { key: "siteVagas", label: "Site de vagas", color: "#16a34a" },
    { key: "gruposWhatsapp", label: "WhatsApp", color: "#d97706" },
    { key: "redesSociais", label: "Redes sociais", color: "#9333ea" },
  ];

  const contractConfig = [
    { key: "pj", label: "PJ", color: "#0284c7" },
    { key: "clt", label: "CLT", color: "#16a34a" },
  ];

  const workModelConfig = [
    { key: "presencial", label: "Presencial", color: "#2563eb" },
    { key: "hibrida", label: "Híbrida (Semi presencial)", color: "#d97706" },
    { key: "remota", label: "Remota", color: "#16a34a" },
  ];

  const buildPieData = (stats, config) => {
    const total = config.reduce((sum, item) => sum + (stats?.[item.key] || 0), 0);
    if (!total) return { chart: "#e5e7eb 0deg 360deg", items: config.map((item) => ({ ...item, percent: 0 })) };

    let cursor = 0;
    const items = config.map((item) => {
      const value = stats?.[item.key] || 0;
      const percent = (value / total) * 100;
      const deg = (percent / 100) * 360;
      const start = cursor;
      cursor += deg;
      return { ...item, percent, slice: `${item.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg` };
    });

    return { chart: items.filter((item) => item.percent > 0).map((item) => item.slice).join(", "), items };
  };

  const sourcePieData = buildPieData(selectedCompanyData?.sourceStats, sourceConfig);
  const contractPieData = buildPieData(selectedCompanyData?.contractStats, contractConfig);
  const globalContractPieData = buildPieData(globalContractStats, contractConfig);
  const workModelPieData = buildPieData(selectedCompanyData?.workModelStats, workModelConfig);
  const globalWorkModelPieData = buildPieData(globalWorkModelStats, workModelConfig);
  const hasCompletedProfile = Boolean((userPseudonym || "").toString().trim());
  const headerRef = React.useRef(null);
  const [headerSpacerHeight, setHeaderSpacerHeight] = React.useState(0);

  const getTopSliceLabel = (pieData) => {
    const topItem = pieData.items.reduce((best, current) => (current.percent > best.percent ? current : best), pieData.items[0]);
    if (!topItem || topItem.percent <= 0) {
      return "Ainda sem dados suficientes";
    }
    return `${topItem.label} lidera com ${topItem.percent.toFixed(0)}%`;
  };

  React.useEffect(() => {
    const updateHeaderSpacer = () => {
      setHeaderSpacerHeight(headerRef.current?.offsetHeight || 0);
    };

    updateHeaderSpacer();
    window.addEventListener("resize", updateHeaderSpacer);

    return () => {
      window.removeEventListener("resize", updateHeaderSpacer);
    };
  }, [company, firebaseStatus, hasCompletedProfile, isAuthenticated, theme, userProfile?.avatar, userProfile?.name, userProfile?.verification?.certified, userPseudonym]);

  return (
    <div
      className={`min-h-screen font-sans pb-10 ${
        theme === "dark"
          ? "bg-slate-800"
          : "bg-gradient-to-b from-blue-50 via-sky-50 to-blue-100"
      }`}
    >
      <header ref={headerRef} className="fixed top-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm px-2 py-2 z-50 border-b border-blue-100 dark:border-slate-700">
        {/* ── Linha do título + botão tema ── */}
        <div className="flex items-center justify-between">
          <div style={{ flex: "1 1 0%" }} />
          <h1 className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-blue-200 dark:border-blue-500 bg-gradient-to-r from-blue-100 via-white to-blue-100 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 shadow-[0_4px_16px_rgba(37,99,235,0.18)]">
            <FaStar className="text-amber-500" style={{ maxWidth: 18, width: 18, height: 18 }} />
            <span className="text-[1.1rem] font-black text-blue-900 dark:text-blue-300 logo-syne tracking-[0.05em] leading-none whitespace-nowrap">
              TRABALHEI LÁ
            </span>
          </h1>
          <div className="flex justify-end" style={{ flex: "1 1 0%" }}>
            <button
              type="button"
              onClick={toggleTheme}
              className="shrink-0 px-2 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-full text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
              aria-label="Alternar tema claro/escuro"
            >
              {theme === "dark" ? "🌙" : "☀️"}
              <span className="mobileThemeLabel"> Tema</span>
            </button>
          </div>
        </div>
        <style>{`
          @media (max-width: 480px) {
            .mobileThemeLabel { display: none; }
          }
        `}</style>
        <div className="text-center">
          <div className="w-20 h-1 mx-auto mt-1 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />
          <p className="mt-1 text-[0.72rem] leading-tight font-bold text-blue-700 dark:text-blue-200">
            Sua opinião anônima evolui o mercado de trabalho
          </p>
        </div>

        {company && (
          <div className="mt-2 w-full rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50/60 dark:bg-slate-800/70" style={{ padding: 10 }}>
            <div className="flex items-center gap-3">
              {/* Logo + Nota à esquerda */}
              <div className="shrink-0 flex flex-col items-center">
                <div className={`rounded-xl flex items-center justify-center border overflow-hidden ${companyLogoUrl ? 'bg-blue-50 dark:bg-slate-800 border-blue-100 dark:border-slate-600' : 'bg-blue-900 border-blue-700'}`} style={{ width: 48, height: 48 }}>
                  {companyLogoUrl ? (
                    <img
                      src={companyLogoUrl}
                      alt="Logo da empresa"
                      className="w-full h-full object-contain p-1"
                      onError={() => {
                        if (logoIndex < logoCandidates.length - 1) {
                          setLogoIndex((prev) => prev + 1);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-white font-black text-lg tracking-tight">TL</span>
                  )}
                </div>
                <div className="mt-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span className={`px-2 py-0.5 rounded-lg text-base leading-none font-extrabold text-white ${getBadgeColor(companyAverage)}`}>
                      {companyAverage}
                    </span>
                    {companyAverage !== "--" && (
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">/5</span>
                    )}
                  </div>
                  {companyAverage !== "--" && (
                    <p
                      className={`mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        isCompanyRecommended
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}
                    >
                      {isCompanyRecommended ? "✓ Empresa indicada" : "X Empresa não indicada"}
                    </p>
                  )}
                </div>
              </div>

              {/* Nome da empresa (centro) */}
              <div className="flex-1 min-w-0">
                <p className="text-[0.95rem] font-bold text-blue-800 dark:text-blue-100 leading-tight break-words">
                  {company.value}
                </p>
              </div>

              {/* Botão à direita */}
              <button
                type="button"
                onClick={handleSaibaMais}
                className="shrink-0 py-2 px-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition"
                style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                Ver avaliações
              </button>
            </div>
          </div>
        )}

        <div className="mt-2 w-full flex items-center justify-between gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-lg overflow-hidden">
                {userProfile?.avatar ? (
                  typeof userProfile.avatar === "string" && (userProfile.avatar.startsWith("data:") || userProfile.avatar.startsWith("http")) ? (
                    <img src={userProfile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span>{userProfile.avatar}</span>
                  )
                ) : (
                  <span className="text-blue-600">👤</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 dark:text-blue-100 truncate">{userPseudonym || userProfile?.name || "Usuário"}</p>
                {userProfile?.verification?.certified && (
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ Certificado
                  </p>
                )}
                <a
                  href="/pseudonym"
                  className="inline-flex items-center mt-0.5 px-2.5 py-1 rounded-full bg-emerald-300 text-emerald-900 text-[11px] font-medium hover:bg-emerald-400 shadow-sm transition"
                >
                  <FaUserEdit className="mr-1 text-[10px]" />
                  {hasCompletedProfile ? "Editar perfil" : "Crie seu perfil"}
                </a>
                {(() => {
                  try {
                    const { getUserRole, isPremium, isAdmin } = require("./utils/rbac");
                    const role = getUserRole();
                    if (role === "admin_empresa" || isPremium() || isAdmin()) {
                      return (
                        <a
                          href="/empresa/dashboard"
                          className="inline-flex items-center mt-0.5 px-2.5 py-1 rounded-full bg-amber-400 text-amber-900 text-[11px] font-bold hover:bg-amber-500 shadow-sm transition"
                        >
                          Painel Empresa
                        </a>
                      );
                    }
                  } catch { /* silencioso */ }
                  return null;
                })()}
                {(() => {
                  try {
                    const { isAdmin } = require("./utils/rbac");
                    if (isAdmin()) {
                      return (
                        <a
                          href="/admin"
                          className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                        >
                          Admin
                        </a>
                      );
                    }
                  } catch { /* silencioso */ }
                  return null;
                })()}
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>

        {firebaseStatus && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 text-center">{firebaseStatus}</p>}
      </header>

      <div style={{ height: headerSpacerHeight }} />

      <main className="px-4 space-y-3">
        {/* Banner Premium Mobile */}
        <div
          className="mobilePremiumBanner"
          style={{
            display: 'none',
            background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)',
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            gap: 8,
          }}
        >
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>⭐</span>
          <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600, flex: 1, textAlign: 'center', whiteSpace: 'normal', lineHeight: 1.3 }}>
            Premium para trabalhadores, empresas e apoiadores — conheça os planos
          </span>
          <button
            type="button"
            onClick={() => navigate('/escolha-perfil')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#1e293b',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              padding: '4px 10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Ver
          </button>
        </div>
        <style>{`
          @media (max-width: 768px) {
            .mobilePremiumBanner { display: flex !important; }
          }
        `}</style>

        {/* LOGIN */}
        <section
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-5 border border-blue-50 dark:border-slate-700"
          style={{ animation: "homeLoginSectionIn 700ms ease-out both" }}
        >
          <style>{`
            @keyframes homeLoginSectionIn {
              from { opacity: 0; transform: translateY(16px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes homeCalloutIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <h2 className="text-sm uppercase tracking-[0.14em] font-extrabold text-blue-800 dark:text-blue-200 text-center mb-3">Acesso para Avaliar</h2>
          <div className="flex flex-col items-center space-y-3">
            <div className="w-full max-w-xs">
              <LoginLinkedInButton 
                clientId={linkedInClientId} 
                redirectUri={linkedInRedirectUri}
                onLoginSuccess={onLoginSuccess}
                onLoginFailure={(err) => setError(err?.message || String(err))}
                disabled={isLoading}
              />
            </div>
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isLoading}
              className="w-full max-w-xs flex items-center justify-center gap-3 bg-white border border-blue-200 text-blue-800 font-semibold py-2 px-4 rounded-lg shadow hover:bg-blue-50 transition-colors text-sm md:text-base disabled:opacity-60"
            >
              <FaGoogle className="text-lg" /> Cadastrar com Google
            </button>
            <Link
              to="/pseudonym"
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-lime-400 text-emerald-950 shadow-[0_0_12px_rgba(20,83,45,0.85),0_0_24px_rgba(132,204,22,0.65)] animate-pulse hover:bg-lime-300 hover:shadow-[0_0_14px_rgba(20,83,45,0.9),0_0_26px_rgba(132,204,22,0.75)] transition"
              aria-label="Ir para editar perfil"
              title="Editar perfil"
            >
              <FaUserEdit className="text-base" />
            </Link>
            <div
              className="w-full flex flex-col items-center justify-center gap-1"
              style={{ animation: "homeCalloutIn 900ms ease-out both" }}
            >
              <p className="text-black dark:text-white font-extrabold text-lg leading-tight text-center">
                CRIE SEU PERFIL E AVALIE ANONIMAMENTE!
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap" style={{ animation: "homeCalloutIn 1100ms ease-out both" }}>
              <span className="flex items-center gap-1 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">✓ Anônimo</span>
              <span className="flex items-center gap-1 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">✓ Verificado</span>
              <span className="flex items-center gap-1 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold">✓ Confiável</span>
            </div>
            {isAuthenticated && (
              <div className="w-full flex justify-end">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 border-2 border-blue-700 text-blue-700 text-sm font-bold rounded-md hover:bg-blue-50 transition"
                >
                  Sair
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500 text-center">
              Sem LinkedIn: entre com Google e complete seu perfil manualmente na etapa seguinte.
            </p>
          </div>
          {isAuthenticated && <p className="text-green-600 font-semibold text-center mt-3 text-sm">✓ Autenticado!</p>}
        </section>

        {/* FORMULÁRIO */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-5 border border-blue-50 dark:border-slate-700">
          <h2 className="text-sm uppercase tracking-[0.14em] font-extrabold text-blue-800 dark:text-blue-200 text-center mb-3">Avaliar Empresa</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-semibold text-slate-700 dark:text-blue-200 mb-2 block text-sm">Selecione a Empresa</label>
              <Select
                options={safeCompanyOptions}
                value={company}
                onChange={setCompany}
                placeholder="Buscar empresa..."
                styles={selectStyles}
                isClearable
                noOptionsMessage={() => "Empresa não encontrada"}
              />

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                  className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
                >
                  {showNewCompanyInput ? "Cancelar" : "Adicione a empresa"}
                </button>
              </div>

              {showNewCompanyInput && (
                <div className="mt-3 space-y-2">
                  <input
                    value={newCompanyCnpj}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 14);
                      let m = d;
                      if (d.length > 12) m = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
                      else if (d.length > 8) m = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
                      else if (d.length > 5) m = `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
                      else if (d.length > 2) m = `${d.slice(0,2)}.${d.slice(2)}`;
                      setNewCompanyCnpj(m);
                    }}
                    placeholder="00.000.000/0001-00"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                  {cnpjError && <p className="text-sm text-red-600">{cnpjError}</p>}
                  <button
                    type="button"
                    onClick={handleAddNewCompany}
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
                  >
                    {isLoading ? "Consultando CNPJ..." : "Consultar CNPJ"}
                  </button>

                  {pendingCompanyData && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
                      <p className="font-semibold">Empresa encontrada: {pendingCompanyData.company}</p>
                      <p className="text-xs text-blue-700 mt-1">CNPJ: {pendingCompanyData.cnpj}</p>
                      {pendingCompanyData.cnaeDescricao && (
                        <p className="text-xs text-emerald-700 mt-0.5">Setor: {pendingCompanyData.cnaeDescricao}</p>
                      )}
                      <p className="mt-2 font-medium">👍 Está correto?</p>
                      <button
                        type="button"
                        onClick={handleConfirmNewCompany}
                        disabled={isLoading}
                        className="mt-2 w-full py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
                      >
                        {isLoading ? "Confirmando..." : "Confirmar empresa"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-sm font-bold text-blue-800 mb-2">Como entrou na empresa?</p>
                  <div className="space-y-2 text-sm text-slate-700">
                    {sourceConfig.map((item) => (
                      <label key={item.key} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="entrySourceMobile"
                          checked={entrySource === item.key}
                          onChange={() => setEntrySource(item.key)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-sm font-bold text-blue-800 mb-2">Forma de contratação</p>
                  <div className="space-y-2 text-sm text-slate-700">
                    {contractConfig.map((item) => (
                      <label key={item.key} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="contractTypeMobile"
                          checked={contractType === item.key}
                          onChange={() => setContractType(item.key)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-sm font-bold text-blue-800 mb-2">Modelo de trabalho</p>
                  <div className="space-y-2 text-sm text-slate-700">
                    {workModelConfig.map((item) => (
                      <label key={item.key} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workModelMobile"
                          checked={workModel === item.key}
                          onChange={() => setWorkModel(item.key)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {selectedCompanyData && (
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div className="bg-white border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">Classificação profissional geral</p>
                    <p className="text-xs text-blue-600 mb-2">{getTopSliceLabel(globalContractPieData)}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-24 rounded-full border border-gray-200" style={{ background: `conic-gradient(${globalContractPieData.chart})` }} />
                      <div className="space-y-1 text-xs">
                        {globalContractPieData.items.map((item) => (
                          <p key={`global_contract_${item.key}`} className="flex items-center gap-2 text-slate-700">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}: {item.percent.toFixed(0)}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">Modelo de trabalho geral</p>
                    <p className="text-xs text-blue-600 mb-2">{getTopSliceLabel(globalWorkModelPieData)}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-24 rounded-full border border-gray-200" style={{ background: `conic-gradient(${globalWorkModelPieData.chart})` }} />
                      <div className="space-y-1 text-xs">
                        {globalWorkModelPieData.items.map((item) => (
                          <p key={`global_work_model_${item.key}`} className="flex items-center gap-2 text-slate-700">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}: {item.percent.toFixed(0)}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">Entradas na empresa</p>
                    <p className="text-xs text-blue-600 mb-2">{getTopSliceLabel(sourcePieData)}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-24 rounded-full border border-gray-200" style={{ background: `conic-gradient(${sourcePieData.chart})` }} />
                      <div className="space-y-1 text-xs">
                        {sourcePieData.items.map((item) => (
                          <p key={item.key} className="flex items-center gap-2 text-slate-700">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}: {item.percent.toFixed(0)}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">Classificação profissional da empresa</p>
                    <p className="text-xs text-blue-600 mb-2">{getTopSliceLabel(contractPieData)}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-24 rounded-full border border-gray-200" style={{ background: `conic-gradient(${contractPieData.chart})` }} />
                      <div className="space-y-1 text-xs">
                        {contractPieData.items.map((item) => (
                          <p key={item.key} className="flex items-center gap-2 text-slate-700">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}: {item.percent.toFixed(0)}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-xl p-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">Modelo de trabalho na empresa</p>
                    <p className="text-xs text-blue-600 mb-2">{getTopSliceLabel(workModelPieData)}</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-24 rounded-full border border-gray-200" style={{ background: `conic-gradient(${workModelPieData.chart})` }} />
                      <div className="space-y-1 text-xs">
                        {workModelPieData.items.map((item) => (
                          <p key={`company_work_model_${item.key}`} className="flex items-center gap-2 text-slate-700">
                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}: {item.percent.toFixed(0)}%
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Barra de progresso dos critérios */}
              {visibleCriterionIdx >= 0 && (
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl border border-blue-100 dark:border-slate-700 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-200">Critério {visibleCriterionIdx + 1} de {campos.length}</span>
                    <span className="text-xs text-slate-500">{Math.round(((visibleCriterionIdx + 1) / campos.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-300" style={{ width: `${((visibleCriterionIdx + 1) / campos.length) * 100}%` }} />
                  </div>
                </div>
              )}

              {campos.map((campo, idx) => (
                <div key={idx} ref={el => criterionRefs.current[idx] = el} data-criterion-idx={idx} className="bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                  <label className="text-slate-700 dark:text-blue-200 font-semibold flex items-center gap-2 text-sm">
                    <span className={`w-9 h-9 rounded-xl border bg-gradient-to-br ${campo.iconBg} flex items-center justify-center shadow-sm`}>
                      {campo.icon}
                    </span>
                    <span>
                      <span className="block">{campo.label}</span>
                      {campo.subtitle && <span className="block text-xs text-slate-500 dark:text-blue-300">{campo.subtitle}</span>}
                    </span>
                  </label>
                  {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                </div>
              ))}
            </div>

            <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
              <label className="text-slate-700 dark:text-blue-200 font-semibold text-sm block mb-2">Algo que queira acrescentar?</label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Descreva sua experiência na empresa..."
                rows={3}
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />
            </div>

            {error && <p className="text-red-600 text-center text-xs font-medium">{error}</p>}

            <style>{`
              @keyframes ctaGlow {
                0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.4); }
                50% { box-shadow: 0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(59,130,246,0.3); }
              }
            `}</style>
            <button type="submit"
              className={`w-full py-3 rounded-xl font-bold text-white transition-all ${isAuthenticated ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600"}`}
              style={!isAuthenticated ? { animation: 'ctaGlow 2s ease-in-out infinite' } : undefined}
              disabled={!isAuthenticated || isLoading}>
              {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
            </button>
          </form>
        </section>

        {/* RANKING */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-5 border border-blue-50 dark:border-slate-700">
          <h2 className="text-sm uppercase tracking-[0.14em] font-extrabold text-blue-800 dark:text-blue-200 text-center mb-3">🏆 Ranking</h2>
          {Array.isArray(setoresList) && setoresList.length > 0 && (
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full mb-3 p-2 text-sm border border-blue-200 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Todos os setores</option>
              {setoresList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {Array.isArray(top3) && top3.length > 0 && (
            <div className="mb-4 space-y-2">
              {top3.map((emp, i) => {
                const media = calcularMedia(emp);
                const isUnrated = media === "--";
                const mediaValue = Number.parseFloat(media);
                const isRecommendedCompany = !isUnrated && Number.isFinite(mediaValue) && mediaValue >= 3;
                return (
                  <div key={i} className={`${isUnrated ? "bg-slate-200 text-slate-600" : `bg-gradient-to-r ${getMedalColor(i)} text-white`} rounded-xl p-3 flex justify-between items-center`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl">{getMedalEmoji(i)}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate max-w-[120px]">{emp.company}</p>
                        {!isUnrated && (
                          <p className={`text-[10px] font-bold ${isUnrated ? "text-slate-600" : "text-white/90"}`}>
                            {isRecommendedCompany ? "✓ Empresa indicada" : "X Empresa não indicada"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className={`${isUnrated ? "bg-slate-300 text-slate-700" : "bg-white/20 text-white"} px-2 py-1 rounded-lg font-bold text-xs`}>
                      {isUnrated ? "--" : `${media} ⭐`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* AUTOCOMPLETAÇÃO */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-md p-5 border border-blue-50 dark:border-slate-700">
          <h2 className="text-sm uppercase tracking-[0.12em] font-extrabold text-blue-800 dark:text-blue-200 text-center mb-2">🏢 Empresas por busca</h2>
          <p className="text-sm text-slate-700 dark:text-blue-100 text-center leading-relaxed">
            Para encontrar empresas em bases maiores, use o campo
            <span className="font-semibold"> "Selecione a Empresa"</span> acima.
            Digite parte do nome e escolha na lista sugerida.
          </p>
        </section>
      </main>

      <CaptchaModal
        open={showCaptcha}
        onClose={() => setShowCaptcha(false)}
        checked={captchaConfirmed}
        onChange={setCaptchaConfirmed}
        onConfirm={() => {
          setCaptchaConfirmed(true);
          setShowCaptcha(false);
        }}
      />

      <footer className="text-center text-xs text-slate-500 dark:text-slate-300 mt-6 space-x-2">
        <a href="/politica-de-privacidade.html" className="text-blue-600 dark:text-blue-300 hover:underline font-semibold">
          Política de Privacidade
        </a>
        <span>•</span>
        <Link to="/purpose" className="text-blue-600 dark:text-blue-300 hover:underline">
          Qual o nosso propósito?
        </Link>
      </footer>
    </div>
  );
}

export default TrabalheiLaMobile;