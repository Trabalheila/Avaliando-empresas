import React from "react";
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from "react-router-dom";
import Select from "react-select";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";
import { FaPlus, FaStar, FaRegStar, FaUserEdit, FaGoogle, FaUserSecret, FaCheckCircle, FaShieldAlt } from "react-icons/fa";
import {
  FiMessageCircle, FiDollarSign, FiCompass, FiCalendar, FiUsers,
  FiBriefcase, FiShield, FiHeart, FiRepeat, FiAward, FiTrendingUp, FiAlertCircle,
  FiClock, FiArrowUpCircle, FiInfo,
} from "react-icons/fi";
import LoginLinkedInButton from "./LoginLinkedInButton";
import CaptchaModal from "./components/CaptchaModal";
import RestrictableTextarea from "./components/RestrictableTextarea";
import WorkPeriodPicker from "./components/WorkPeriodPicker";
import { handleAutoCorrectChange } from "./utils/ptBrAutoCorrect";
import { resolveProfileId } from "./utils/profileIdentity";

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
        onChange={(e) => handleAutoCorrectChange(e, draftValue, setDraftValue)}
        onBlur={handleBlur}
        className={className}
        spellCheck="true"
        lang="pt-BR"
        autoCorrect="on"
        autoCapitalize="sentences"
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
  discriminacao, setDiscriminacao, commentDiscriminacao, setCommentDiscriminacao,
  cargaHoraria, setCargaHoraria, commentCargaHoraria, setCommentCargaHoraria,
  crescimento, setCrescimento, commentCrescimento, setCommentCrescimento,
  equilibrio, setEquilibrio, commentEquilibrio, setCommentEquilibrio, reconhecimento, setReconhecimento, commentReconhecimento, setCommentReconhecimento,
  comunicacao, setComunicacao, commentComunicacao, setCommentComunicacao, etica, setEtica, commentEtica, setCommentEtica,
  desenvolvimento, setDesenvolvimento, commentDesenvolvimento, setCommentDesenvolvimento, saudeBemEstar, setSaudeBemEstar, commentSaudeBemEstar, setCommentSaudeBemEstar,
  impactoSocial, setImpactoSocial, commentImpactoSocial, setCommentImpactoSocial, reputacao, setReputacao, commentReputacao, setCommentReputacao,
  estimacaoOrganizacao, setEstimacaoOrganizacao, commentEstimacaoOrganizacao, setCommentEstimacaoOrganizacao,
  entrySource, setEntrySource, contractType, setContractType, workModel, setWorkModel,
  workPeriodStartMonth, setWorkPeriodStartMonth, workPeriodStartYear, setWorkPeriodStartYear,
  workPeriodEndMonth, setWorkPeriodEndMonth, workPeriodEndYear, setWorkPeriodEndYear,
  workPeriodStillWorking, setWorkPeriodStillWorking,
  generalComment, setGeneralComment,
  generalCommentRestrictedSegments, setGeneralCommentRestrictedSegments,
  criterionRestrictedSegments, setSegmentsForCriterion,
  handleSubmit, isLoading, empresas, top3,
  handleSaibaMais,
  showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany, handleConfirmNewCompany, pendingCompanyData, newCompanyCnpj, setNewCompanyCnpj, cnpjError,
  sectorFilter, setSectorFilter, setoresList,
  segmentFilter, setSegmentFilter, segmentosList,
  manualCompanyName, setManualCompanyName,
  manualSegment, setManualSegment,
  manualRazaoSocial, setManualRazaoSocial,
  cnaeSegmentOptions, isUserAdmin, handleAddCompanyWithoutCnpj,
  linkedInClientId, linkedInRedirectUri, error, setError, isAuthenticated, userProfile, userPseudonym, onLoginSuccess, selectedCompanyData, calcularMedia,
  handleLogout,
  onGoogleLogin,
  globalContractStats,
  globalWorkModelStats,
  getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed,
  handleCaptchaConfirmed,
}) {

  const { t } = useTranslation();
  const navigate = useNavigate();
  const COMMENT_GUIDANCE_TEXT = "Descreva comportamentos e situaÃ§Ãµes. Evite citar nomes de pessoas.";
  const COMMENT_WARNING_TEXT = "Identificamos possÃ­vel citaÃ§Ã£o de nome. Considere substituir por descriÃ§Ã£o do comportamento ou situaÃ§Ã£o.";

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
    const namePattern = /\b[A-ZÃÃ€Ã‚ÃƒÃ‰ÃŠÃÃ“Ã”Ã•ÃšÃ‡][a-zÃ¡Ã Ã¢Ã£Ã©ÃªÃ­Ã³Ã´ÃµÃºÃ§]+(?:\s+[A-ZÃÃ€Ã‚ÃƒÃ‰ÃŠÃÃ“Ã”Ã•ÃšÃ‡][a-zÃ¡Ã Ã¢Ã£Ã©ÃªÃ­Ã³Ã´ÃµÃºÃ§]+)+\b/g;
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

  const renderStars = (value, setValue, comment, setComment, label, restrictKey) => (
    <div className="flex flex-col w-full md:w-2/3 gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => setValue(star)} className="focus:outline-none transition-transform hover:scale-110">
            {star <= value ? <FaStar className="text-yellow-400 text-2xl drop-shadow-sm" /> : <FaRegStar className="text-gray-300 text-2xl hover:text-yellow-200" />}
          </button>
        ))}
      </div>
      {restrictKey ? (
        <RestrictableTextarea
          guidanceText={COMMENT_GUIDANCE_TEXT}
          warningText={COMMENT_WARNING_TEXT}
          containsPossiblePersonName={containsPossiblePersonName}
          rows={3}
          placeholder={`ComentÃ¡rio sobre ${label.toLowerCase()} (opcional). Selecione trechos para marcar como restritos.`}
          value={comment}
          onValueChange={setComment}
          segments={(criterionRestrictedSegments && criterionRestrictedSegments[restrictKey]) || []}
          onSegmentsChange={(segs) => setSegmentsForCriterion?.(restrictKey, segs)}
          className="w-full p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100"
        />
      ) : (
        <CommentTextarea
        guidanceText={COMMENT_GUIDANCE_TEXT}
        warningText={COMMENT_WARNING_TEXT}
        containsPossiblePersonName={containsPossiblePersonName}
        rows={3}
        placeholder={`ComentÃ¡rio sobre ${label.toLowerCase()} (opcional)`}
        value={comment}
        onValueChange={setComment}
        className="w-full p-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100"
      />
      )}
    </div>
  );

  const renderYesNo = (value, setValue, commentValue, setCommentValue, label) => {
    const isRequired = value === "sim";
    const showError = isRequired && !commentValue.trim();
    return (
      <div className="flex flex-col w-full md:w-2/3 gap-2">
        <div className="flex items-center gap-3" role="radiogroup" aria-label={label}>
          {[
            { v: "sim", l: t('Sim') },
            { v: "nao", l: t('NÃ£o') },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={value === opt.v}
              onClick={() => setValue(opt.v)}
              className={`px-5 py-2 rounded-lg border text-sm font-semibold transition ${
                value === opt.v
                  ? (opt.v === "sim"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-emerald-600 text-white border-emerald-600")
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
        {isRequired && (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            * {t('ComentÃ¡rio obrigatÃ³rio ao informar "Sim".')}
          </p>
        )}
        <CommentTextarea
          guidanceText={COMMENT_GUIDANCE_TEXT}
          warningText={COMMENT_WARNING_TEXT}
          containsPossiblePersonName={containsPossiblePersonName}
          rows={3}
          placeholder={`ComentÃ¡rio sobre ${label.toLowerCase()}${isRequired ? " (obrigatÃ³rio)" : " (opcional)"}`}
          value={commentValue}
          onValueChange={setCommentValue}
          className={`w-full p-2 text-sm border rounded-lg focus:outline-none focus:ring-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 ${
            showError ? "border-rose-500 focus:ring-rose-500" : "border-gray-200 dark:border-slate-700 focus:ring-blue-400"
          }`}
        />
      </div>
    );
  };

  const campos = [
    { restrictKey: "comunicacao", label: t('Processo de Recrutamento'), value: comunicacao, set: setComunicacao, comment: commentComunicacao, setComment: setCommentComunicacao, icon: <FiMessageCircle className="text-cyan-700" />, iconBg: "from-cyan-50 to-sky-100 border-cyan-200" },
    { restrictKey: "etica", label: t('Proposta salarial e benefÃ­cios'), value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica, icon: <FiDollarSign className="text-emerald-600" />, iconBg: "from-emerald-50 to-lime-100 border-emerald-200" },
    { restrictKey: "cultura", label: t('VisÃ£o e valores da empresa'), value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura, icon: <FiCompass className="text-blue-700" />, iconBg: "from-blue-50 to-sky-100 border-blue-200" },
    { restrictKey: "salario", label: t('Data do Pagamento'), value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario, icon: <FiCalendar className="text-rose-600" />, iconBg: "from-rose-50 to-red-100 border-rose-200" },
    { restrictKey: "lideranca", label: t('Acessibilidade e respeito da lideranÃ§a'), value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca, icon: <FiUsers className="text-indigo-600" />, iconBg: "from-indigo-50 to-blue-100 border-indigo-200" },
    { restrictKey: "estimacaoOrganizacao", label: t('CondiÃ§Ãµes de trabalho'), value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimacaoOrganizacao, icon: <FiBriefcase className="text-blue-600" />, iconBg: "from-blue-50 to-indigo-100 border-blue-200" },
    { restrictKey: "ambiente", label: t('EstÃ­mulo ao respeito'), value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente, icon: <FiUsers className="text-violet-600" />, iconBg: "from-violet-50 to-fuchsia-100 border-violet-200" },
    { type: "yesno", label: t('Sofreu discriminaÃ§Ã£o?'), restrictedNote: "InformaÃ§Ã£o de visualizaÃ§Ã£o restrita a apoiadores.", value: discriminacao, set: setDiscriminacao, comment: commentDiscriminacao, setComment: setCommentDiscriminacao, icon: <FiAlertCircle className="text-teal-600" />, iconBg: "from-teal-50 to-cyan-100 border-teal-200" },
    { restrictKey: "diversidade", label: t('Diversidade e InclusÃ£o'), value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade, icon: <FiUsers className="text-pink-600" />, iconBg: "from-pink-50 to-rose-100 border-pink-200" },
    { restrictKey: "cargaHoraria", label: t('Carga HorÃ¡ria / Jornada de Trabalho'), value: cargaHoraria, set: setCargaHoraria, comment: commentCargaHoraria, setComment: setCommentCargaHoraria, icon: <FiClock className="text-indigo-700" />, iconBg: "from-indigo-50 to-blue-100 border-indigo-200" },
    { restrictKey: "crescimento", label: t('Oportunidades de Desenvolvimento / Crescimento'), value: crescimento, set: setCrescimento, comment: commentCrescimento, setComment: setCommentCrescimento, icon: <FiArrowUpCircle className="text-emerald-700" />, iconBg: "from-emerald-50 to-teal-100 border-emerald-200" },
    { restrictKey: "rating", label: t('SeguranÃ§a e integridade'), value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FiShield className="text-amber-600" />, iconBg: "from-amber-50 to-yellow-100 border-amber-200" },
    { restrictKey: "saudeBemEstar", label: t('PreocupaÃ§Ã£o com o bem estar'), value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar, icon: <FiHeart className="text-pink-600" />, iconBg: "from-pink-50 to-rose-100 border-pink-200" },
    { restrictKey: "equilibrio", label: t('Rotatividade'), subtitle: t('(Demite com facilidade?)'), value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio, icon: <FiRepeat className="text-slate-700" />, iconBg: "from-slate-50 to-gray-100 border-slate-300" },
    { restrictKey: "reconhecimento", label: t('Reconhecimento'), value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento, icon: <FiAward className="text-amber-700" />, iconBg: "from-amber-50 to-orange-100 border-amber-200" },
    { restrictKey: "desenvolvimento", label: t('Planos de cargos e salÃ¡rios'), value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento, icon: <FiTrendingUp className="text-red-600" />, iconBg: "from-red-50 to-rose-100 border-red-200" },
  ];

  const companyNote = selectedCompanyData ? calcularMedia(selectedCompanyData) : "--";
  const isCompanyUnrated = companyNote === "--";
  const companyNoteValue = Number.parseFloat(companyNote);
  const isCompanyRecommended = !isCompanyUnrated && Number.isFinite(companyNoteValue) && companyNoteValue >= 3;

  // Progress bar: IntersectionObserver para critÃ©rios
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
    { key: "indicacao", label: "IndicaÃ§Ã£o", color: "#2563eb" },
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
    { key: "hibrida", label: "HÃ­brida (Semi presencial)", color: "#d97706" },
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

  // LÃ³gica para gerar a Logo baseada no nome da empresa
  const companyNameForLogo = selectedCompanyData ? selectedCompanyData.company : "TL";
  const logoCandidates = getCompanyLogoCandidates(companyNameForLogo, {
    size: 128,
    website: selectedCompanyData?.website,
    logoUrl: selectedCompanyData?.logoUrl,
  });
  const [logoIndex, setLogoIndex] = React.useState(0);
  const logoUrl = logoCandidates[logoIndex] || null;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [companyNameForLogo, selectedCompanyData?.website, selectedCompanyData?.logoUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col items-center p-6">
      <div className="w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1480px]">
        {/* HEADER â€” TRABALHEI LÃ centralizado, avatar/pseudÃ´nimo Ã  direita */}
        <header
          ref={headerRef}
          className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl xl:max-w-7xl 2xl:max-w-[1480px] bg-gradient-to-br from-blue-50/95 via-blue-100/95 to-blue-50/95 dark:from-slate-900/95 dark:via-slate-950/95 dark:to-slate-900/95 backdrop-blur-sm rounded-b-3xl shadow-xl px-6 py-2 border-2 border-blue-200 dark:border-slate-700"
        >
          <div className="relative flex items-center justify-center min-h-[64px]">
            {/* Tema (canto esquerdo) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-sm whitespace-nowrap"
                aria-label="Alternar tema"
              >
                {theme === "dark" ? "ðŸŒ™ Tema" : "â˜€ï¸ Tema"}
              </button>
            </div>

            {/* TRABALHEI LÃ â€” grande e centralizado */}
            <h1
              className="logo-syne tracking-wide text-blue-900 dark:text-blue-100 text-center font-black select-none"
              style={{
                fontSize: 'clamp(28px, 4.6vw, 56px)',
                letterSpacing: '0.02em',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              TRABALHEI LÃ
            </h1>

            {/* Avatar + pseudÃ´nimo (canto direito) ou botÃ£o Entrar */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <div className="flex flex-col items-end leading-tight max-w-[200px]">
                    <span className="text-base md:text-lg font-bold text-blue-900 dark:text-blue-100 truncate max-w-[200px]">
                      {userPseudonym || userProfile?.name || "UsuÃ¡rio"}
                    </span>
                    {userProfile?.verification?.certified && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        âœ“ Certificado
                      </span>
                    )}
                  </div>
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-2xl overflow-hidden border-2 border-blue-300 dark:border-slate-600 shadow">
                    {userProfile?.avatar ? (
                      typeof userProfile.avatar === "string" && (userProfile.avatar.startsWith("data:") || userProfile.avatar.startsWith("http")) ? (
                        <img src={userProfile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{userProfile.avatar}</span>
                      )
                    ) : (
                      <span className="text-blue-600">ðŸ‘¤</span>
                    )}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  aria-label="Entrar"
                  className="px-4 py-2 rounded-full bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-md whitespace-nowrap transition dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </header>

        <div>
          <div style={{ height: headerSpacerHeight + 24 }} />

          {/* CARD CENTRAL â€” "Evoluindo o mercado de trabalho" + aÃ§Ãµes agrupadas */}
          <div className="mx-auto max-w-2xl mb-6 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-200 dark:border-slate-700 px-6 py-4 text-center">
            <div className="w-32 h-1 mx-auto rounded-full bg-gradient-to-r from-blue-300 via-blue-700 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500 mb-2" />
            <p className="text-blue-700 dark:text-blue-200 text-base md:text-lg font-extrabold leading-tight mb-3">
              {t('Evoluindo o mercado de trabalho')}
            </p>

            {!isAuthenticated && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span
                  title="Sua identidade Ã© mantida em sigilo: avaliaÃ§Ãµes sÃ£o publicadas sob pseudÃ´nimo."
                  className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help"
                >
                  <FaUserSecret className="text-[11px]" aria-hidden="true" />
                  AnÃ´nimo
                </span>
                <span
                  title="Conta verificada via login LinkedIn ou Google."
                  className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help"
                >
                  <FaCheckCircle className="text-[11px]" aria-hidden="true" />
                  Verificado
                </span>
                <span
                  title="Plataforma com regras anti-fraude e moderaÃ§Ã£o de avaliaÃ§Ãµes."
                  className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 text-blue-700 dark:text-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help"
                >
                  <FaShieldAlt className="text-[11px]" aria-hidden="true" />
                  ConfiÃ¡vel
                </span>
              </div>
            )}

            {isAuthenticated && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {(() => {
                  // Regra de negÃ³cio:
                  //  - empresÃ¡rio => apenas "Painel Empresa".
                  //  - trabalhador => "Editar perfil" / "Crie seu perfil".
                  const role = (userProfile?.role || "").toString().toLowerCase().trim();
                  const userType = (userProfile?.userType || "").toString().toLowerCase().trim();
                  const isEmployer =
                    role === "admin_empresa" ||
                    userType === "empresario" ||
                    userType === "empres\u00e1rio" ||
                    userProfile?.isEmployer === true ||
                    Boolean(userProfile?.managedCompanyId);
                  if (isEmployer) {
                    return (
                      <button
                        type="button"
                        onClick={() => navigate("/empresa-dashboard")}
                        className="inline-flex items-center px-3 py-1.5 border border-blue-700 text-blue-700 text-sm font-bold rounded-md bg-transparent hover:bg-blue-50 transition dark:border-blue-400 dark:text-blue-300 dark:hover:bg-slate-700"
                      >
                        Painel Empresa
                      </button>
                    );
                  }
                  return (
                    <a
                      href="/pseudonym"
                      className="inline-flex items-center px-3 py-1.5 border border-blue-700 text-blue-700 text-sm font-bold rounded-md bg-transparent hover:bg-blue-50 transition dark:border-blue-400 dark:text-blue-300 dark:hover:bg-slate-700"
                    >
                      <FaUserEdit className="mr-1 text-[11px]" />
                      {hasCompletedProfile ? "Editar perfil" : "Crie seu perfil"}
                    </a>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => {
                    const pid =
                      userProfile?.profileId ||
                      resolveProfileId(userProfile, { persistGeneratedId: false });
                    if (pid) {
                      navigate(`/perfil/${encodeURIComponent(pid)}`);
                    } else {
                      navigate("/minha-conta");
                    }
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-blue-700 text-blue-700 text-sm font-bold rounded-md bg-transparent hover:bg-blue-50 transition dark:border-blue-400 dark:text-blue-300 dark:hover:bg-slate-700"
                >
                  Ver meu perfil
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-1.5 border border-blue-700 text-blue-700 text-sm font-bold rounded-md bg-transparent hover:bg-blue-50 transition dark:border-blue-400 dark:text-blue-300 dark:hover:bg-slate-700"
                >
                  Sair
                </button>
                {(() => {
                  try {
                    const { isAdmin } = require("./utils/rbac");
                    if (isAdmin()) {
                      return (
                        <a
                          href="/admin"
                          className="inline-flex items-center px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                        >
                          Admin
                        </a>
                      );
                    }
                  } catch { /* silencioso */ }
                  return null;
                })()}
              </div>
            )}

            {firebaseStatus && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-3">{firebaseStatus}</p>
            )}

            {company && (
              <button
                type="button"
                onClick={handleSaibaMais}
                className="mt-4 bg-blue-700 text-white font-extrabold py-3 px-12 min-w-[21rem] rounded-2xl shadow-lg transition-all transform hover:scale-105 hover:bg-blue-800 text-lg font-azonix"
              >
                {`Ver avaliaÃ§Ãµes da ${company.value.length > 25 ? company.value.slice(0, 25) + "â€¦" : company.value}`}
              </button>
            )}

            {/* Banner Premium */}
            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                onClick={() => navigate('/escolha-perfil?planos=1')}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 text-blue-700 dark:text-blue-200 text-xs font-medium hover:bg-blue-100 dark:hover:bg-slate-700 transition"
              >
                <span>Premium para trabalhadores, empresas e apoiadores</span>
                <span className="underline font-semibold">ver benefÃ­cios</span>
              </button>
            </div>
          </div>

          {/* CONTEÃšDO - 3 COLUNAS NO DESKTOP (>1024px), 2 COLUNAS NO MOBILE (<1024px) */}
          <div className="flex flex-col lg:flex-row lg:flex-nowrap gap-6 mb-8">
            {/* COLUNA ESQUERDA - LOGIN + RANKING (flex-col ordem 1) */}
            <div className="w-full lg:basis-[16%] lg:max-w-[16%] lg:min-w-[180px] xl:basis-[14%] xl:max-w-[14%] xl:min-w-[190px] lg:shrink-0 flex flex-col gap-6 order-1 lg:order-1 break-words">
              {/* ...coluna esquerda... */}
            </div>
            {/* COLUNA CENTRAL - FORMULÃRIO (ordem 2 no desktop) */}
            <div className="w-full lg:basis-[62%] lg:min-w-[560px] xl:basis-[68%] xl:min-w-[640px] lg:flex-none flex flex-col gap-6 order-2 lg:order-2">
              {/* ...coluna central... */}
            </div>
            {/* COLUNA DIREITA - OUTROS (ordem 3 no desktop) */}
            <div className="w-full lg:basis-[22%] lg:max-w-[22%] lg:min-w-[240px] xl:basis-[18%] xl:max-w-[18%] xl:min-w-[240px] lg:shrink-0 flex flex-col gap-6 order-3 lg:order-3 break-words">
              {/* ...coluna direita... */}
            </div>
          </div>

        </div>

        <footer className="w-full px-6 py-8 text-center">
          <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-lg rounded-2xl p-5 border border-blue-100 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-200 text-sm">
              <Link to="/termos-de-uso" className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-extrabold underline">
                Termos de Uso
              </Link>
              {" â€¢ "}
              <a href="/politica-de-privacidade" className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-extrabold underline">
                PolÃ­tica de Privacidade
              </a>
              {" â€¢ "}
              <Link to="/purpose" className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 font-extrabold underline">
                Qual o nosso propÃ³sito?
              </Link>
              {" â€¢ "}
              <span>Â© 2026 Trabalhei LÃ¡ - Todos os direitos reservados</span>
            </p>
          </div>
        </footer>

        <CaptchaModal
          open={showCaptcha}
          onClose={() => setShowCaptcha(false)}
          checked={captchaConfirmed}
          onChange={setCaptchaConfirmed}
          onConfirm={() => {
            if (typeof handleCaptchaConfirmed === "function") {
              handleCaptchaConfirmed();
            } else {
              setCaptchaConfirmed(true);
              setShowCaptcha(false);
            }
          }}
        />

      </div>
    </div>
  );
}

export default TrabalheiLaDesktop;
