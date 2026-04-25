import React from "react";
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from "react-router-dom";
import Select from "react-select";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";
import { FaPlus, FaStar, FaRegStar, FaUserEdit, FaGoogle } from "react-icons/fa";
import {
  FiMessageCircle, FiDollarSign, FiCompass, FiCalendar, FiUsers,
  FiBriefcase, FiShield, FiHeart, FiRepeat, FiAward, FiTrendingUp, FiAlertCircle,
} from "react-icons/fi";
import LoginLinkedInButton from "./LoginLinkedInButton";
import CaptchaModal from "./components/CaptchaModal";

function CommentTextarea({
  value,
  onValueChange,
  containsPossiblePersonName,
  guidanceText,
  warningText,
  placeholder,
  rows = 3,
  className = "",
}) {
  const [draftValue, setDraftValue] = React.useState(() => (typeof value === "string" ? value : ""));
  const [showWarning, setShowWarning] = React.useState(false);
  const lastEmittedValueRef = React.useRef(typeof value === "string" ? value : "");

  React.useEffect(() => {
    const nextValue = typeof value === "string" ? value : "";
    if (nextValue !== lastEmittedValueRef.current) {
      setDraftValue(nextValue);
      lastEmittedValueRef.current = nextValue;
    }
  }, [value]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowWarning(containsPossiblePersonName(draftValue));

      if (draftValue !== lastEmittedValueRef.current) {
        onValueChange(draftValue);
        lastEmittedValueRef.current = draftValue;
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [containsPossiblePersonName, draftValue, onValueChange]);

  const handleBlur = React.useCallback(() => {
    if (draftValue !== lastEmittedValueRef.current) {
      onValueChange(draftValue);
      lastEmittedValueRef.current = draftValue;
    }
  }, [draftValue, onValueChange]);

  return (
    <>
      <p className="text-xs text-slate-500 dark:text-slate-400">{guidanceText}</p>
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={draftValue}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={handleBlur}
        className={className}
      />
      {showWarning && (
        <p className="text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md px-2 py-1">
          {warningText}
        </p>
      )}
    </>
  );
}

function TrabalheiLaDesktop({
  theme, toggleTheme, firebaseStatus,
  company, setCompany, rating, setRating, commentRating, setCommentRating,
  salario, setSalario, commentSalario, setCommentSalario, beneficios, setBeneficios, commentBeneficios, setCommentBeneficios,
  cultura, setCultura, commentCultura, setCommentCultura, oportunidades, setOportunidades, commentOportunidades, setCommentOportunidades,
  inovacao, setInovacao, commentInovacao, setCommentInovacao, lideranca, setLideranca, commentLideranca, setCommentLideranca,
  diversidade, setDiversidade, commentDiversidade, setCommentDiversidade, ambiente, setAmbiente, commentAmbiente, setCommentAmbiente,
  equilibrio, setEquilibrio, commentEquilibrio, setCommentEquilibrio, reconhecimento, setReconhecimento, commentReconhecimento, setCommentReconhecimento,
  comunicacao, setComunicacao, commentComunicacao, setCommentComunicacao, etica, setEtica, commentEtica, setCommentEtica,
  desenvolvimento, setDesenvolvimento, commentDesenvolvimento, setCommentDesenvolvimento, saudeBemEstar, setSaudeBemEstar, commentSaudeBemEstar, setCommentSaudeBemEstar,
  impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial, reputacao, setReputacao, commentReputacao, setCommentReputacao,
  estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
  entrySource, setEntrySource, contractType, setContractType, workModel, setWorkModel,
  generalComment, setGeneralComment, handleSubmit, isLoading, empresas, top3,
  handleSaibaMais,
  showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany, handleConfirmNewCompany, pendingCompanyData, newCompanyCnpj, setNewCompanyCnpj, cnpjError,
  sectorFilter, setSectorFilter, setoresList,
  linkedInClientId, linkedInRedirectUri, error, setError, isAuthenticated, userProfile, userPseudonym, onLoginSuccess, selectedCompanyData, calcularMedia,
  handleLogout,
  onGoogleLogin,
  globalContractStats,
  globalWorkModelStats,
  getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed
}) {

  const { t } = useTranslation();
  const navigate = useNavigate();
  const COMMENT_GUIDANCE_TEXT = "Descreva comportamentos e situações. Evite citar nomes de pessoas.";
  const COMMENT_WARNING_TEXT = "Identificamos possível citação de nome. Considere substituir por descrição do comportamento ou situação.";

  const containsPossiblePersonName = React.useCallback((value) => {
    const replacements = {
      "3": "e",
      "0": "o",
      "4": "a",
      "@": "a",
      "1": "i",
      "!": "i",
      "5": "s",
      "7": "t",
      "8": "b",
    };
    const text = String(value || "").replace(/[304@1!578]/g, (char) => replacements[char] || char);
    const namePattern = /\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+)+\b/g;
    const sentenceBoundaryPattern = /[.!?\n]/;
    let match = namePattern.exec(text);

    while (match) {
      const idx = match.index;
      const before = text.slice(0, idx);
      const lastBoundary = Math.max(
        before.lastIndexOf("."),
        before.lastIndexOf("!"),
        before.lastIndexOf("?"),
        before.lastIndexOf("\n")
      );
      const segmentBeforeMatch = before.slice(lastBoundary + 1);

      if (sentenceBoundaryPattern.test(before) && segmentBeforeMatch.trim().length === 0) {
        match = namePattern.exec(text);
        continue;
      }

      if (segmentBeforeMatch.trim().length > 0) {
        return true;
      }

      match = namePattern.exec(text);
    }

    return false;
  }, []);

  const headerRef = React.useRef(null);
  const [headerSpacerHeight, setHeaderSpacerHeight] = React.useState(0);
  const hasCompletedProfile = Boolean((userPseudonym || "").toString().trim());

  React.useEffect(() => {
    const updateHeaderSpacer = () => {
      setHeaderSpacerHeight(headerRef.current?.offsetHeight || 0);
    };
    updateHeaderSpacer();
    window.addEventListener("resize", updateHeaderSpacer);
    return () => window.removeEventListener("resize", updateHeaderSpacer);
  }, [company, firebaseStatus, hasCompletedProfile, isAuthenticated, theme, userProfile?.avatar, userProfile?.name, userProfile?.verification?.certified, userPseudonym]);
  const isDark = theme === "dark";
  const selectStyles = {
    control: (base) => ({
      ...base,
      borderRadius: "0.75rem",
      padding: "0.25rem",
      borderColor: isDark ? "#475569" : "#d1d5db",
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      boxShadow: "none",
      "&:hover": { borderColor: "#3b82f6" },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      border: `1px solid ${isDark ? "#475569" : "#dbeafe"}`,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused
        ? (isDark ? "#1e293b" : "#eff6ff")
        : (isDark ? "#0f172a" : "#ffffff"),
      color: isDark ? "#e2e8f0" : "#1e293b",
      cursor: "pointer",
    }),
    singleValue: (base) => ({ ...base, color: isDark ? "#e2e8f0" : "#1e293b" }),
    input: (base) => ({ ...base, color: isDark ? "#e2e8f0" : "#1e293b" }),
    placeholder: (base) => ({ ...base, color: isDark ? "#94a3b8" : "#64748b" }),
  };
    const legacyMetricsBridge = {
      beneficios, setBeneficios, commentBeneficios, setCommentBeneficios,
      oportunidades, setOportunidades, commentOportunidades, setCommentOportunidades,
      inovacao, setInovacao, commentInovacao, setCommentInovacao,
      impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial,
      reputacao, setReputacao, commentReputacao, setCommentReputacao,
      estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
    };
    void legacyMetricsBridge;

  const renderStars = (value, setValue, comment, setComment, label) => (
    <div className="flex flex-col w-full md:w-2/3 gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setValue(star)} className="focus:outline-none transition-transform hover:scale-110">
            {star <= value ? <FaStar className="text-yellow-400 text-2xl drop-shadow-sm" /> : <FaRegStar className="text-gray-300 text-2xl hover:text-yellow-200" />}
          </button>
        ))}
      </div>
      <CommentTextarea
        guidanceText={COMMENT_GUIDANCE_TEXT}
        warningText={COMMENT_WARNING_TEXT}
        containsPossiblePersonName={containsPossiblePersonName}
        rows={3}
        placeholder={`Comentário sobre ${label.toLowerCase()} (opcional)`}
        value={comment}
        onValueChange={setComment}
        className="w-full p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100"
      />
    </div>
  );

  const campos = [
    { label: t('Processo de Recrutamento'), value: comunicacao, set: setComunicacao, comment: commentComunicacao, setComment: setCommentComunicacao, icon: <FiMessageCircle className="text-cyan-700" />, iconBg: "from-cyan-50 to-sky-100 border-cyan-200" },
    { label: t('Proposta salarial e benefícios'), value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica, icon: <FiDollarSign className="text-emerald-600" />, iconBg: "from-emerald-50 to-lime-100 border-emerald-200" },
    { label: t('Visão e valores da empresa'), value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura, icon: <FiCompass className="text-blue-700" />, iconBg: "from-blue-50 to-sky-100 border-blue-200" },
    { label: t('Data do Pagamento'), value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario, icon: <FiCalendar className="text-rose-600" />, iconBg: "from-rose-50 to-red-100 border-rose-200" },
    { label: t('Acessibilidade e respeito da liderança'), value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca, icon: <FiUsers className="text-indigo-600" />, iconBg: "from-indigo-50 to-blue-100 border-indigo-200" },
    { label: t('Condições de trabalho'), value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimacaoOrganizacao, icon: <FiBriefcase className="text-blue-600" />, iconBg: "from-blue-50 to-indigo-100 border-blue-200" },
    { label: t('Estímulo ao respeito'), value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente, icon: <FiUsers className="text-violet-600" />, iconBg: "from-violet-50 to-fuchsia-100 border-violet-200" },
    { label: t('Sofreu discriminação?'), value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade, icon: <FiAlertCircle className="text-teal-600" />, iconBg: "from-teal-50 to-cyan-100 border-teal-200" },
    { label: t('Segurança e integridade'), value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FiShield className="text-amber-600" />, iconBg: "from-amber-50 to-yellow-100 border-amber-200" },
    { label: t('Preocupação com o bem estar'), value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar, icon: <FiHeart className="text-pink-600" />, iconBg: "from-pink-50 to-rose-100 border-pink-200" },
    { label: t('Rotatividade'), subtitle: t('(Demite com facilidade?)'), value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio, icon: <FiRepeat className="text-slate-700" />, iconBg: "from-slate-50 to-gray-100 border-slate-300" },
    { label: t('Reconhecimento'), value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento, icon: <FiAward className="text-amber-700" />, iconBg: "from-amber-50 to-orange-100 border-amber-200" },
    { label: t('Planos de cargos e salários'), value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento, icon: <FiTrendingUp className="text-red-600" />, iconBg: "from-red-50 to-rose-100 border-red-200" },
  ];

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "--";
  const isCompanyUnrated = companyNote === "--";
  const companyNoteValue = Number.parseFloat(companyNote);
  const isCompanyRecommended = !isCompanyUnrated && Number.isFinite(companyNoteValue) && companyNoteValue >= 3;

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

  const progressPercent = visibleCriterionIdx >= 0
    ? Math.round(((visibleCriterionIdx + 1) / campos.length) * 100)
    : 0;
  const stickyProgressTop = headerSpacerHeight + 8;

  const sourceConfig = [
    { key: "indicacao", label: "Indicação", color: "#2563eb" },
    { key: "siteVagas", label: "Site de vagas", color: "#16a34a" },
    { key: "gruposWhatsapp", label: "Grupos de WhatsApp", color: "#d97706" },
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
    if (!total) {
      return {
        chart: "#e5e7eb 0deg 360deg",
        items: config.map((item) => ({ ...item, percent: 0 })),
      };
    }

    let cursor = 0;
    const items = config.map((item) => {
      const value = stats?.[item.key] || 0;
      const percent = (value / total) * 100;
      const deg = (percent / 100) * 360;
      const start = cursor;
      cursor += deg;
      return {
        ...item,
        percent,
        slice: `${item.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`,
      };
    });

    return {
      chart: items.filter((item) => item.percent > 0).map((item) => item.slice).join(", "),
      items,
    };
  };

  const sourcePieData = buildPieData(selectedCompanyData?.sourceStats, sourceConfig);
  const contractPieData = buildPieData(selectedCompanyData?.contractStats, contractConfig);
  const globalContractPieData = buildPieData(globalContractStats, contractConfig);
  const workModelPieData = buildPieData(selectedCompanyData?.workModelStats, workModelConfig);
  const globalWorkModelPieData = buildPieData(globalWorkModelStats, workModelConfig);

  const getTopSliceLabel = (pieData) => {
    const topItem = pieData.items.reduce((best, current) => (current.percent > best.percent ? current : best), pieData.items[0]);
    if (!topItem || topItem.percent <= 0) {
      return "Ainda sem dados suficientes";
    }
    return `${topItem.label} lidera com ${topItem.percent.toFixed(0)}%`;
  };

  // Lógica para gerar a Logo baseada no nome da empresa
  const companyNameForLogo = selectedCompanyData ? selectedCompanyData.company : "TL";
  const logoCandidates = getCompanyLogoCandidates(companyNameForLogo, {
    size: 128,
    website: selectedCompanyData?.website,
  });
  const [logoIndex, setLogoIndex] = React.useState(0);
  const logoUrl = logoCandidates[logoIndex] || null;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [companyNameForLogo, selectedCompanyData?.website]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-6">
      <div className="w-full max-w-6xl">
        {/* HEADER */}
        <header ref={headerRef} className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl bg-gradient-to-br from-blue-50/95 via-blue-100/95 to-blue-50/95 dark:from-slate-900/95 dark:via-slate-950/95 dark:to-slate-900/95 backdrop-blur-sm rounded-b-3xl shadow-2xl px-3 py-1.5 border-2 border-blue-200 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex w-[110px] flex-col items-center">

              {/* ÁREA DA LOGO ATUALIZADA */}
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border-2 overflow-hidden ${logoUrl ? 'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-slate-600' : 'bg-blue-900 border-blue-700'}`}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${companyNameForLogo}`}
                    className="w-full h-full object-contain p-1"
                    onError={() => {
                      if (logoIndex < logoCandidates.length - 1) {
                        setLogoIndex((prev) => prev + 1);
                      }
                    }}
                  />
                ) : (
                  <span className="text-white font-black text-3xl tracking-tight">TL</span>
                )}
              </div>
              <span className="text-xs mt-2 text-blue-500 dark:text-slate-300 text-center max-w-[100px] truncate" title={companyNameForLogo}>
                {companyNameForLogo}
              </span>

              <div className={`mt-2 rounded-xl px-3 py-1 text-center shadow-lg ${isCompanyUnrated ? "bg-slate-500 dark:bg-slate-600" : "bg-blue-700 dark:bg-blue-800"}`}>
                <p className="text-xl font-extrabold text-white">{isCompanyUnrated ? "--" : `${companyNote}/5`}</p>
                <p className={`text-xs ${isCompanyUnrated ? "text-slate-200" : "text-blue-200"}`}>NOTA</p>
              </div>
              {!isCompanyUnrated && (
                <p
                  className={`mt-2 text-[11px] font-bold px-2 py-1 rounded-lg border ${
                    isCompanyRecommended
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  {isCompanyRecommended ? "✓ Empresa indicada" : "X Empresa não indicada"}
                </p>
              )}
            </div>

            <div className="flex-1 text-center px-4 overflow-visible">
              <h1
                className="font-extrabold text-blue-800 dark:text-blue-300 drop-shadow-[0_3px_0_rgba(30,64,175,0.25)] dark:drop-shadow-[0_3px_0_rgba(15,23,42,0.6)] tracking-[0.05em] mb-0.5 logo-syne"
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  flexShrink: 0,
                  lineHeight: 1.2,
                  color: '#FFFFFF'
                }}
              >
                TRABALHEI LÁ
              </h1>
              <div className="w-32 h-1 mx-auto rounded-full bg-gradient-to-r from-blue-300 via-blue-700 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500 mb-1.5" />
              <p className="text-blue-700 dark:text-blue-200 text-base font-extrabold leading-tight">
                {t('Evoluindo o mercado de trabalho')}
              </p>

              {isAuthenticated && (
                <div className="mb-2 mx-auto flex max-w-3xl items-center justify-center gap-3 bg-blue-50/70 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-600 rounded-2xl px-3 py-2">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center text-xl">
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
                    <div className="text-left">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{userPseudonym || userProfile?.name || "Usuário"}</p>
                      {userProfile?.verification?.certified && (
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          ✓ Certificado
                        </p>
                      )}
                      <a
                        href="/pseudonym"
                        className="inline-flex items-center mt-1 px-3 py-1.5 rounded-full bg-emerald-300 text-emerald-900 text-xs font-medium tracking-normal hover:bg-emerald-400 shadow-md transition"
                      >
                        <FaUserEdit className="mr-1 text-[11px]" />
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
                                className="inline-flex items-center mt-1 px-3 py-1.5 rounded-full bg-amber-400 text-amber-900 text-xs font-bold tracking-normal hover:bg-amber-500 shadow-md transition"
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
                                className="mt-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                              >
                                Admin
                              </a>
                            );
                          }
                        } catch { /* silencioso */ }
                        return null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="ml-3 px-3 py-1.5 border-2 border-blue-700 text-blue-700 text-sm font-bold rounded-md hover:bg-blue-50 transition dark:border-blue-400 dark:text-blue-300 dark:hover:bg-slate-700"
                    >
                      Sair
                    </button>
                  </div>

                </div>
              )}
              {firebaseStatus && <p className="text-xs text-red-500 dark:text-red-400 mb-4">{firebaseStatus}</p>}

              {/* Banner Premium — sempre visível abaixo do card do usuário */}
              <div className="mb-3 flex items-center justify-center">
                <div className="flex max-w-4xl flex-col md:flex-row items-center gap-3 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400 rounded-2xl shadow-lg px-5 py-2 border-2 border-blue-200 dark:border-slate-700">
                  <span className="text-white text-base md:text-lg font-bold drop-shadow text-center">Premium para trabalhadores, empresas e apoiadores — <span className="underline">conheça os planos</span></span>
                  <button
                    className="mt-1 md:mt-0 px-5 py-2 rounded-lg bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-200 font-bold shadow hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                    onClick={() => navigate('/escolha-perfil?planos=1')}
                  >
                    Ver benefícios
                  </button>
                </div>
              </div>

              {company && (
                <button
                  type="button"
                  onClick={handleSaibaMais}
                  className="bg-blue-700 text-white font-extrabold py-3 px-12 min-w-[21rem] rounded-2xl shadow-lg transition-all transform hover:scale-105 hover:bg-blue-800 text-lg font-azonix"
                >
                  {`Ver avaliações da ${company.value.length > 25 ? company.value.slice(0, 25) + "…" : company.value}`}
                </button>
              )}
            </div>

            <div className="flex w-[110px] flex-col items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-sm whitespace-nowrap"
                aria-label="Alternar tema"
              >
                {theme === "dark" ? "🌙 Tema" : "☀️ Tema"}
              </button>
              <span className="flex items-center gap-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold">✓ Anônimo</span>
              <span className="flex items-center gap-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold">✓ Verificado</span>
              <span className="flex items-center gap-2 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-4 py-2 rounded-full font-semibold">✓ Confiável</span>
            </div>
          </div>
        </header>

        <div style={{ height: headerSpacerHeight + 32 }} />

        {/* CONTEÚDO - 3 COLUNAS NO DESKTOP (>1024px), 2 COLUNAS NO MOBILE (<1024px) */}
        <div className="flex flex-col lg:flex-row lg:flex-nowrap gap-6 mb-8">

          {/* COLUNA ESQUERDA - LOGIN + RANKING (flex-col ordem 1) */}
          <div className="w-full lg:basis-[20%] lg:max-w-[20%] lg:min-w-[220px] lg:shrink-0 flex flex-col gap-6 order-1 lg:order-1">

            {/* LOGIN ATUALIZADO (Sem Google, LinkedIn Corrigido) */}
            <section
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 mb-6 border border-blue-100 dark:border-slate-700"
              style={{ animation: "homeLoginSectionIn 700ms ease-out both" }}
            >
              <style>{`
                @keyframes homeLoginSectionIn {
                  from { opacity: 0; transform: translateY(18px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes homeCalloutIn {
                  from { opacity: 0; transform: translateX(-18px); }
                  to { opacity: 1; transform: translateX(0); }
                }
              `}</style>
              <h2 className="text-3xl font-extrabold text-blue-900 dark:text-blue-200 text-center mb-2 tracking-wide font-azonix">Login para Avaliar</h2>
              <div className="w-28 h-1 mx-auto mb-5 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />
              <div className="flex flex-col items-center space-y-4">
                <div className="w-full max-w-xs -ml-3">
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
                  className="w-full max-w-xs -ml-3 flex items-center justify-center gap-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-800 dark:text-blue-200 font-semibold py-2 px-4 rounded-lg shadow hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-sm md:text-base disabled:opacity-60"
                >
                  <FaGoogle className="text-lg" /> Cadastrar com Google
                </button>
                <Link
                  to="/pseudonym"
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-lime-400 text-emerald-950 shadow-[0_0_14px_rgba(20,83,45,0.85),0_0_28px_rgba(132,204,22,0.65)] animate-pulse hover:bg-lime-300 hover:shadow-[0_0_16px_rgba(20,83,45,0.9),0_0_30px_rgba(132,204,22,0.75)] transition"
                  aria-label="Ir para editar perfil"
                  title="Editar perfil"
                >
                  <FaUserEdit className="text-xl" />
                </Link>
                <div className="w-full max-w-full flex items-center justify-center px-2">
                  <p className="text-black dark:text-slate-100 font-extrabold text-[1.2rem] xl:text-[1.45rem] leading-tight tracking-tight text-center break-words [text-wrap:balance]">
                    CRIE SEU PERFIL E AVALIE ANONIMAMENTE!
                  </p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300 text-center">
                  Sem LinkedIn: entre com Google e complete seu perfil manualmente na próxima etapa.
                </p>
              </div>
              {isAuthenticated && (
                <p className="text-green-600 font-semibold text-center mt-4">✓ Você está autenticado!</p>
              )}
            </section>

            {/* RANKING DE EMPRESAS */}
            <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 border border-blue-100 dark:border-slate-700">
              <h2 className="text-2xl font-extrabold text-blue-900 dark:text-blue-200 text-center mb-2 font-azonix tracking-wide">🏆 Ranking de Empresas</h2>
              <div className="w-24 h-1 mx-auto mb-4 rounded-full bg-gradient-to-r from-yellow-300 via-amber-500 to-yellow-300" />
              {Array.isArray(setoresList) && setoresList.length > 0 && (
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="w-full mb-4 p-2 text-sm border border-blue-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                      <div key={i} className={`${isUnrated ? "bg-slate-200 text-slate-600" : `bg-gradient-to-r ${getMedalColor(i)} text-white`} rounded-2xl p-3`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{getMedalEmoji(i)}</span>
                            <div>
                              <p className="font-bold text-sm">{emp.company}</p>
                              {!isUnrated && (
                                <p className={`text-[11px] font-bold ${isUnrated ? "text-slate-600" : "text-white/90"}`}>
                                  {isRecommendedCompany ? "✓ Empresa indicada" : "X Empresa não indicada"}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className={`${isUnrated ? "bg-slate-300 text-slate-700" : "bg-white/20 text-white"} px-2 py-1 rounded-full font-bold text-xs`}>
                            {isUnrated ? "--" : `${media} ⭐`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-slate-800 rounded-2xl p-4 border border-blue-200 dark:border-slate-700">
                <h3 className="text-base font-extrabold text-blue-900 dark:text-blue-200 mb-2 tracking-wide">Empresas por Autocompletação</h3>
                <p className="text-sm text-blue-900 dark:text-slate-200 leading-relaxed">
                  Para manter performance com muitas empresas, a seleção agora é feita pelo campo
                  <span className="font-semibold"> "Selecione a Empresa"</span> no formulário.
                  Digite parte do nome para buscar rapidamente.
                </p>
              </div>
            </section>
          </div>

          {/* COLUNA CENTRAL - FORMULÁRIO (ordem 2 no desktop) */}
          <div className="w-full lg:basis-[55%] lg:min-w-[500px] lg:flex-none flex flex-col gap-6 order-2 lg:order-2">

            {/* FORMULÁRIO */}
            <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 border border-blue-100 dark:border-slate-700">
              <h2 className="text-3xl font-extrabold text-blue-900 dark:text-blue-200 text-center mb-2 tracking-wide font-azonix">Avalie uma Empresa</h2>
              <div className="w-32 h-1 mx-auto mb-5 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />
              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 mb-2 block">Selecione a Empresa</label>
                  <Select
                    options={safeCompanyOptions}
                    value={company}
                    onChange={setCompany}
                    placeholder="Buscar ou selecionar empresa..."
                    styles={selectStyles}
                    isClearable
                  />

                  <button type="button" onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow transition-all">
                    <FaPlus />
                    {showNewCompanyInput ? "Cancelar" : "Adicione a empresa"}
                  </button>

                  {showNewCompanyInput && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <input type="text"
                          className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="00.000.000/0001-00"
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
                          inputMode="numeric"
                          autoComplete="off"
                        />
                        <button type="button" onClick={handleAddNewCompany}
                          disabled={isLoading}
                          className="px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
                          {isLoading ? "Consultando..." : "Consultar CNPJ"}
                        </button>
                      </div>
                      {cnpjError && <p className="text-sm text-red-600">{cnpjError}</p>}

                      {pendingCompanyData && (
                        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-3 text-sm text-blue-900 dark:text-blue-100">
                          <p className="font-semibold">Empresa encontrada: {pendingCompanyData.company}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">CNPJ: {pendingCompanyData.cnpj}</p>
                          {pendingCompanyData.cnaeDescricao && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">Setor: {pendingCompanyData.cnaeDescricao}</p>
                          )}
                          <p className="mt-2 font-medium">👍 Está correto?</p>
                          <button
                            type="button"
                            onClick={handleConfirmNewCompany}
                            disabled={isLoading}
                            className="mt-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition"
                          >
                            {isLoading ? "Confirmando..." : "Confirmar empresa"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">Como entrou na empresa?</p>
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      {sourceConfig.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="entrySource"
                            checked={entrySource === item.key}
                            onChange={() => setEntrySource(item.key)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">Forma de contratação</p>
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                      {contractConfig.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="contractType"
                            checked={contractType === item.key}
                            onChange={() => setContractType(item.key)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>

                <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">Modelo de trabalho</p>
                  <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {workModelConfig.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="workModel"
                          checked={workModel === item.key}
                          onChange={() => setWorkModel(item.key)}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
                </div>

                {/* Barra de progresso dos critérios */}
                {visibleCriterionIdx >= 0 && (
                  <div
                    className="sticky z-10 mb-2 ml-auto w-full max-w-[380px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg border border-blue-100 dark:border-slate-700 px-3 py-2 shadow-sm"
                    style={{ top: stickyProgressTop }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-blue-800 dark:text-blue-200">Critério {visibleCriterionIdx + 1} de {campos.length}</span>
                      <span className="text-[11px] text-slate-500">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                )}

                {campos.map((campo, idx) => (
                  <div key={idx} ref={el => criterionRefs.current[idx] = el} data-criterion-idx={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <label className="w-full md:w-1/3 text-slate-700 dark:text-slate-100 font-semibold flex items-center gap-2 mb-2 md:mb-0">
                      <span className={`w-9 h-9 rounded-xl border bg-gradient-to-br ${campo.iconBg} flex items-center justify-center shadow-sm`}>
                        {campo.icon}
                      </span>
                      <span>
                        <span className="block">{campo.label}</span>
                        {campo.subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400">{campo.subtitle}</span>}
                      </span>
                    </label>
                    {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                  </div>
                ))}

                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                  <label className="text-slate-700 dark:text-slate-100 font-semibold text-lg block mb-2">Algo que queira acrescentar?</label>
                  <CommentTextarea
                    guidanceText={COMMENT_GUIDANCE_TEXT}
                    warningText={COMMENT_WARNING_TEXT}
                    containsPossiblePersonName={containsPossiblePersonName}
                    className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Descreva sua experiência na empresa..."
                    rows={3}
                    value={generalComment}
                    onValueChange={setGeneralComment}
                  />
                </div>

                {error && <p className="text-red-600 text-center text-sm font-medium">{error}</p>}

                <div className="text-center pt-2">
                  <style>{`
                    @keyframes ctaGlow {
                      0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.4); }
                      50% { box-shadow: 0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(59,130,246,0.3); }
                    }
                  `}</style>
                  <button type="submit"
                    className={`px-8 py-3 rounded-full font-extrabold text-white transition-all ${
                      isAuthenticated ? (
                        (commentRating && containsPossiblePersonName(commentRating) ||
                         generalComment && containsPossiblePersonName(generalComment) ||
                         Object.values(campos).some(c => c.comment && containsPossiblePersonName(c.comment)))
                          ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-xl hover:scale-105"
                        ) : "bg-blue-600"
                    }`}
                    style={!isAuthenticated ? { animation: 'ctaGlow 2s ease-in-out infinite' } : undefined}
                    disabled={!isAuthenticated || isLoading || 
                             (commentRating && containsPossiblePersonName(commentRating)) ||
                             (generalComment && containsPossiblePersonName(generalComment)) ||
                             Object.values(campos).some(c => c.comment && containsPossiblePersonName(c.comment))}
                  >
                    {isLoading ? "Enviando..." : isAuthenticated ? "Enviar Avaliação" : "Faça login para avaliar"}
                  </button>
                  {(commentRating && containsPossiblePersonName(commentRating) ||
                    generalComment && containsPossiblePersonName(generalComment) ||
                    Object.values(campos).some(c => c.comment && containsPossiblePersonName(c.comment))) && (
                    <p className="text-red-600 dark:text-red-400 text-xs font-semibold text-center mt-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-2 py-1">
                      Detectamos possível citação de nome. Reformule usando descrição de comportamento/situação.
                    </p>
                  )}
                  <p className="text-blue-600 dark:text-blue-300 text-xs font-semibold leading-tight mt-2">
                    {t('Sua opinião é anônima e ajuda outros profissionais')}
                  </p>
                </div>

              </form>
            </section>
          </div>

          {/* COLUNA DIREITA - GRÁFICOS + COMO FUNCIONA (ordem 3 no desktop) */}
          <div className="w-full lg:basis-[25%] lg:max-w-[25%] lg:min-w-[280px] lg:shrink-0 flex flex-col gap-6 order-3 lg:order-3">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 border border-blue-100 dark:border-slate-700">
              <div className="mb-4 space-y-4">
                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Classificação profissional da empresa</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(contractPieData)}</p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${contractPieData.chart})` }}
                    />
                    <div className="space-y-1 text-xs">
                      {contractPieData.items.map((item) => (
                        <p key={`company_contract_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}: {item.percent.toFixed(0)}%
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Classificação profissional geral</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(globalContractPieData)}</p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${globalContractPieData.chart})` }}
                    />
                    <div className="space-y-1 text-xs">
                      {globalContractPieData.items.map((item) => (
                        <p key={`global_contract_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}: {item.percent.toFixed(0)}%
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Modelo de trabalho geral</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(globalWorkModelPieData)}</p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${globalWorkModelPieData.chart})` }}
                    />
                    <div className="space-y-1 text-xs">
                      {globalWorkModelPieData.items.map((item) => (
                        <p key={`global_work_model_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}: {item.percent.toFixed(0)}%
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Formas de entrada na empresa</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(sourcePieData)}</p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${sourcePieData.chart})` }}
                    />
                    <div className="space-y-1 text-xs">
                      {sourcePieData.items.map((item) => (
                        <p key={`source_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}: {item.percent.toFixed(0)}%
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Modelo de trabalho na empresa</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(workModelPieData)}</p>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${workModelPieData.chart})` }}
                    />
                    <div className="space-y-1 text-xs">
                      {workModelPieData.items.map((item) => (
                        <p key={`company_work_model_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}: {item.percent.toFixed(0)}%
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 border border-emerald-200 dark:border-slate-700">
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200 mb-2">Como funciona a plataforma</h3>
                <p className="text-sm text-emerald-900 dark:text-slate-200 leading-relaxed mb-3">
                  O objetivo do Trabalhei Lá é ajudar profissionais a decidir melhor onde trabalhar por meio de avaliações anônimas e verificadas.
                </p>
                <ul className="space-y-2 text-sm text-emerald-900 dark:text-slate-200">
                  <li><span className="font-semibold">1.</span> Entre com LinkedIn e ajuste seu perfil anônimo.</li>
                  <li><span className="font-semibold">2.</span> Escolha uma empresa e avalie os critérios da sua experiência.</li>
                  <li><span className="font-semibold">3.</span> Veja notas, comentários e ranking para comparar empresas.</li>
                </ul>
              </div>
            </div>
          </div>

        </div>

        <footer className="w-full px-6 py-8 text-center">
          <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-lg rounded-2xl p-5 border border-blue-100 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-200 text-sm">
              <Link to="/termos-de-uso" className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-extrabold underline">
                Termos de Uso
              </Link>
              {" • "}
              <a href="/politica-de-privacidade" className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-extrabold underline">
                Política de Privacidade
              </a>
              {" • "}
              <Link to="/purpose" className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-extrabold underline">
                Qual o nosso propósito?
              </Link>
              {" • "}
              <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
            </p>
          </div>
        </footer>

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

      </div>
    </div>
  );
}

export default TrabalheiLaDesktop;