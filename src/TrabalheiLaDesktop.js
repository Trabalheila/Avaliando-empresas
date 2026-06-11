import React from "react";
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from "react-router-dom";
import Select from "react-select";
import { getCompanyLogoCandidates } from "./utils/getCompanyLogo";
import { FaPlus, FaStar, FaRegStar, FaUserEdit, FaGoogle, FaUserSecret, FaCheckCircle, FaShieldAlt } from "react-icons/fa";
import YouTubeEmbed from "./components/YouTubeEmbed";
import PaymentInfoModal from "./components/Specialist/PaymentInfoModal";
import {
  FiMessageCircle, FiDollarSign, FiCompass, FiCalendar, FiUsers,
  FiBriefcase, FiShield, FiHeart, FiRepeat, FiAward, FiTrendingUp, FiAlertCircle,
  FiClock, FiArrowUpCircle, FiInfo,
} from "react-icons/fi";
import LoginLinkedInButton from "./LoginLinkedInButton";
import CaptchaModal from "./components/CaptchaModal";
import RestrictableTextarea from "./components/RestrictableTextarea";
import WorkPeriodPicker from "./components/WorkPeriodPicker";
import SelectionProcessReviewForm from "./components/SelectionProcessReviewForm";
import SpellCheckSuggestions from "./components/SpellCheckSuggestions";
import { handleAutoCorrectChange } from "./utils/ptBrAutoCorrect";
import { resolveProfileId } from "./utils/profileIdentity";
import {
  ensureSelectedProfileType,
  setSelectedProfileType,
} from "./services/profileType";

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
      <SpellCheckSuggestions value={draftValue} onChangeValue={setDraftValue} className="mt-1" />
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
  selectionProcessOnly, setSelectionProcessOnly,
  spClarity, setSpClarity,
  spCommunication, setSpCommunication,
  spResponseTime, setSpResponseTime,
  spDiscriminationFelt, setSpDiscriminationFelt,
  spDiscriminationComment, setSpDiscriminationComment,
  spEvidenceFiles, setSpEvidenceFiles,
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
  userVerificationLevel,
  getMedalColor, getMedalEmoji, getBadgeColor, safeCompanyOptions,
  handleCompanyInputChange,
  showCaptcha, setShowCaptcha, captchaConfirmed, setCaptchaConfirmed,
  handleCaptchaConfirmed,
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
  const [showPaymentInfo, setShowPaymentInfo] = React.useState(false);
  const hasCompletedProfile = Boolean(
    (userPseudonym || userProfile?.pseudonimo || userProfile?.name || "")
      .toString()
      .trim()
  );

  // Garante que ao carregar a Home o perfil padrão ("worker") esteja
  // persistido em sessionStorage. Assim, mesmo que o usuário clique
  // direto no login social sem escolher manualmente, ainda capturamos
  // a intenção de Trabalhador no callback do OAuth.
  React.useEffect(() => {
    ensureSelectedProfileType();
  }, []);

  // Clique nos cards de perfil: persiste a escolha e roteia conforme o tipo.
  // - Trabalhador: cadastro manual em /pseudonym?manual=1.
  // - Especialista: landing dedicada em /apoiadores (destino distinto do
  //   trabalhador, conforme comportamento histórico do botão).
  const handleChooseProfile = React.useCallback(
    (type) => {
      setSelectedProfileType(type);
      if (type === "specialist") {
        navigate("/apoiadores");
      } else {
        navigate("/pseudonym?manual=1");
      }
    },
    [navigate]
  );

  // Wrappers para os botões sociais: marcam o perfil padrão antes de
  // disparar o OAuth, garantindo que o callback saiba qual perfil aplicar.
  const handleGoogleClick = React.useCallback(() => {
    setSelectedProfileType("worker");
    if (typeof onGoogleLogin === "function") onGoogleLogin();
  }, [onGoogleLogin]);

  const handleLinkedInSuccessWrapped = React.useCallback(
    (payload) => {
      setSelectedProfileType("worker");
      if (typeof onLoginSuccess === "function") onLoginSuccess(payload);
    },
    [onLoginSuccess]
  );

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
      <div className="flex items-center gap-1 leading-none">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setValue(star)}
            className="inline-flex items-center justify-center p-0 m-0 bg-transparent border-0 focus:outline-none transition-transform hover:scale-110 leading-none align-middle"
            style={{ lineHeight: 0 }}
            aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
          >
            {star <= value ? <FaStar className="text-yellow-400 text-2xl drop-shadow-sm block" /> : <FaRegStar className="text-gray-300 text-2xl hover:text-yellow-200 block" />}
          </button>
        ))}
      </div>
      {restrictKey ? (
        <RestrictableTextarea
          guidanceText={COMMENT_GUIDANCE_TEXT}
          warningText={COMMENT_WARNING_TEXT}
          containsPossiblePersonName={containsPossiblePersonName}
          rows={3}
          placeholder={`Comentário sobre ${label.toLowerCase()} (opcional). Selecione trechos para marcar como restritos.`}
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
        placeholder={`Comentário sobre ${label.toLowerCase()} (opcional)`}
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
            { v: "nao", l: t('Não') },
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
            * {t('Comentário obrigatório ao informar "Sim".')}
          </p>
        )}
        <CommentTextarea
          guidanceText={COMMENT_GUIDANCE_TEXT}
          warningText={COMMENT_WARNING_TEXT}
          containsPossiblePersonName={containsPossiblePersonName}
          rows={3}
          placeholder={`Comentário sobre ${label.toLowerCase()}${isRequired ? " (obrigatório)" : " (opcional)"}`}
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
    { restrictKey: "etica", label: t('Proposta salarial e benefícios'), value: etica, set: setEtica, comment: commentEtica, setComment: setCommentEtica, icon: <FiDollarSign className="text-emerald-600" />, iconBg: "from-emerald-50 to-lime-100 border-emerald-200" },
    { restrictKey: "cultura", label: t('Visão e valores da empresa'), value: cultura, set: setCultura, comment: commentCultura, setComment: setCommentCultura, icon: <FiCompass className="text-blue-700" />, iconBg: "from-blue-50 to-sky-100 border-blue-200" },
    { restrictKey: "salario", label: t('Data do Pagamento'), value: salario, set: setSalario, comment: commentSalario, setComment: setCommentSalario, icon: <FiCalendar className="text-rose-600" />, iconBg: "from-rose-50 to-red-100 border-rose-200" },
    { restrictKey: "lideranca", label: t('Acessibilidade e respeito da liderança'), value: lideranca, set: setLideranca, comment: commentLideranca, setComment: setCommentLideranca, icon: <FiUsers className="text-indigo-600" />, iconBg: "from-indigo-50 to-blue-100 border-indigo-200" },
    { restrictKey: "estimacaoOrganizacao", label: t('Condições de trabalho'), value: estimacaoOrganizacao, set: setEstimacaoOrganizacao, comment: commentEstimacaoOrganizacao, setComment: setCommentEstimacaoOrganizacao, icon: <FiBriefcase className="text-blue-600" />, iconBg: "from-blue-50 to-indigo-100 border-blue-200" },
    { restrictKey: "ambiente", label: t('Estímulo ao respeito'), value: ambiente, set: setAmbiente, comment: commentAmbiente, setComment: setCommentAmbiente, icon: <FiUsers className="text-violet-600" />, iconBg: "from-violet-50 to-fuchsia-100 border-violet-200" },
    { type: "yesno", label: t('Sofreu discriminação?'), restrictedNote: "Informação de visualização restrita a especialistas.", value: discriminacao, set: setDiscriminacao, comment: commentDiscriminacao, setComment: setCommentDiscriminacao, icon: <FiAlertCircle className="text-teal-600" />, iconBg: "from-teal-50 to-cyan-100 border-teal-200" },
    { restrictKey: "diversidade", label: t('Diversidade e Inclusão'), value: diversidade, set: setDiversidade, comment: commentDiversidade, setComment: setCommentDiversidade, icon: <FiUsers className="text-pink-600" />, iconBg: "from-pink-50 to-rose-100 border-pink-200" },
    { restrictKey: "cargaHoraria", label: t('Carga Horária / Jornada de Trabalho'), value: cargaHoraria, set: setCargaHoraria, comment: commentCargaHoraria, setComment: setCommentCargaHoraria, icon: <FiClock className="text-indigo-700" />, iconBg: "from-indigo-50 to-blue-100 border-indigo-200" },
    { restrictKey: "crescimento", label: t('Oportunidades de Desenvolvimento / Crescimento'), value: crescimento, set: setCrescimento, comment: commentCrescimento, setComment: setCommentCrescimento, icon: <FiArrowUpCircle className="text-emerald-700" />, iconBg: "from-emerald-50 to-teal-100 border-emerald-200" },
    { restrictKey: "rating", label: t('Segurança e integridade'), value: rating, set: setRating, comment: commentRating, setComment: setCommentRating, icon: <FiShield className="text-amber-600" />, iconBg: "from-amber-50 to-yellow-100 border-amber-200" },
    { restrictKey: "saudeBemEstar", label: t('Preocupação com o bem estar'), value: saudeBemEstar, set: setSaudeBemEstar, comment: commentSaudeBemEstar, setComment: setCommentSaudeBemEstar, icon: <FiHeart className="text-pink-600" />, iconBg: "from-pink-50 to-rose-100 border-pink-200" },
    { restrictKey: "equilibrio", label: t('Rotatividade'), subtitle: t('(Demite com facilidade?)'), value: equilibrio, set: setEquilibrio, comment: commentEquilibrio, setComment: setCommentEquilibrio, icon: <FiRepeat className="text-slate-700" />, iconBg: "from-slate-50 to-gray-100 border-slate-300" },
    { restrictKey: "reconhecimento", label: t('Reconhecimento'), value: reconhecimento, set: setReconhecimento, comment: commentReconhecimento, setComment: setCommentReconhecimento, icon: <FiAward className="text-amber-700" />, iconBg: "from-amber-50 to-orange-100 border-amber-200" },
    { restrictKey: "desenvolvimento", label: t('Planos de cargos e salários'), value: desenvolvimento, set: setDesenvolvimento, comment: commentDesenvolvimento, setComment: setCommentDesenvolvimento, icon: <FiTrendingUp className="text-red-600" />, iconBg: "from-red-50 to-rose-100 border-red-200" },
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
  const workModelPieData = buildPieData(selectedCompanyData?.workModelStats, workModelConfig);

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
        {/* HEADER — TRABALHEI LÁ centralizado, avatar/pseudônimo à direita */}
        <header ref={headerRef} className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl xl:max-w-7xl 2xl:max-w-[1480px] bg-gradient-to-br from-blue-50/95 via-blue-100/95 to-blue-50/95 dark:from-slate-900/95 dark:via-slate-950/95 dark:to-slate-900/95 backdrop-blur-sm rounded-b-3xl shadow-xl px-4 py-2 border-2 border-blue-200 dark:border-slate-700">
          <div className="relative flex items-center justify-center gap-3 min-h-[64px]">
            {/* Tema (canto esquerdo) */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300 transition dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-sm whitespace-nowrap"
                aria-label="Alternar tema"
              >
                {theme === "dark" ? "🌙 Tema" : "☀️ Tema"}
              </button>
            </div>

            {/* TRABALHEI LÁ — grande e centralizado */}
            <h1
              className="logo-syne tracking-wide text-blue-900 dark:text-blue-100 text-center font-black select-none drop-shadow-[0_3px_0_rgba(30,64,175,0.25)] dark:drop-shadow-[0_3px_0_rgba(15,23,42,0.6)]"
              style={{
                fontSize: 'clamp(28px, 4.6vw, 56px)',
                letterSpacing: '0.04em',
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              TRABALHEI LÁ
            </h1>

            {/* Avatar + pseudônimo (canto direito) ou botão Entrar */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate("/minha-conta")}
                    title="Ir para Minha conta"
                    className="hidden sm:flex flex-col items-end leading-tight max-w-[220px] hover:opacity-80 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
                  >
                    <span className="text-base md:text-lg font-bold text-blue-900 dark:text-blue-100 truncate max-w-[220px]">
                      {userPseudonym || "Anônimo"}
                    </span>
                    {userProfile?.verification?.certified && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        ✓ Certificado
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/minha-conta")}
                    title="Ir para Minha conta"
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-2xl overflow-hidden border-2 border-blue-300 dark:border-slate-600 shadow hover:opacity-80 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {userProfile?.avatar ? (
                      typeof userProfile.avatar === "string" && (userProfile.avatar.startsWith("data:") || userProfile.avatar.startsWith("http")) ? (
                        <img src={userProfile.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{userProfile.avatar}</span>
                      )
                    ) : (
                      <span className="text-blue-600">👤</span>
                    )}
                  </button>
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

        <div style={{ height: headerSpacerHeight + 24 }} />

        {/* CARD DA EMPRESA SELECIONADA — logo grande, nota e classificação */}
        {company && (
          <div className="mx-auto max-w-3xl mb-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-200 dark:border-slate-700 p-5">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {/* Logo da empresa (grande) */}
              <div className={`shrink-0 w-28 h-28 md:w-32 md:h-32 rounded-2xl flex items-center justify-center border-2 overflow-hidden ${logoUrl ? 'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-slate-600' : 'bg-blue-900 border-blue-700'}`}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${companyNameForLogo}`}
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      if (logoIndex < logoCandidates.length - 1) {
                        setLogoIndex((prev) => prev + 1);
                      } else {
                        const initials = (companyNameForLogo || "")
                          .split(/\s+/).filter(Boolean).slice(0, 2)
                          .map((w) => w[0]).join("").toUpperCase() || "?";
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1a237e&color=fff&size=192&bold=true`;
                      }
                    }}
                  />
                ) : (
                  <span className="text-white font-black text-4xl tracking-tight">TL</span>
                )}
              </div>

              {/* Nome + classificação */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-300 font-bold mb-1">Empresa selecionada</p>
                <h2 className="text-2xl md:text-3xl font-extrabold text-blue-900 dark:text-blue-100 leading-tight break-words">
                  {companyNameForLogo}
                </h2>
                {!isCompanyUnrated && (
                  <span
                    className={`inline-flex items-center mt-2 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      isCompanyRecommended
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700"
                    }`}
                  >
                    {isCompanyRecommended ? "✓ Acima da média" : "✗ Abaixo da média"}
                  </span>
                )}
              </div>

              {/* Nota grande (avatar circular) */}
              <div className="shrink-0 flex flex-col items-center">
                <div
                  className={`w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center shadow-lg border-4 ${
                    isCompanyUnrated
                      ? "bg-slate-500 dark:bg-slate-600 border-slate-300 dark:border-slate-700"
                      : "bg-blue-700 dark:bg-blue-800 border-blue-300 dark:border-blue-900"
                  }`}
                >
                  <div className="text-center leading-none">
                    <p className="text-3xl md:text-4xl font-extrabold text-white">
                      {isCompanyUnrated ? "--" : `${companyNote}`}
                    </p>
                    {!isCompanyUnrated && (
                      <p className="text-xs text-blue-100 mt-1">de 5</p>
                    )}
                  </div>
                </div>
                <p className={`mt-2 text-[11px] font-bold tracking-widest ${isCompanyUnrated ? "text-slate-500" : "text-blue-700 dark:text-blue-300"}`}>
                  NOTA
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CONTEÚDO - 3 COLUNAS NO DESKTOP (>1024px), 2 COLUNAS NO MOBILE (<1024px).
            O hero e o vídeo agora vivem dentro da COLUNA CENTRAL para que as colunas
            laterais (Ranking e Gráficos) subam e fiquem alinhadas ao topo, sem o
            espaço vazio que existia quando o hero ficava acima da grade. */}
        <div className="flex flex-col lg:flex-row lg:flex-nowrap gap-6 mb-8 items-start">

          {/* COLUNA CENTRAL - HERO + VÍDEO + FORMULÁRIO (empilha primeiro no tablet; ordem 2 no desktop) */}
          <div className="w-full lg:basis-[56%] lg:min-w-[520px] xl:basis-[58%] xl:min-w-[600px] lg:flex-none flex flex-col gap-6 order-1 lg:order-2">

        {/* HERO CARD — único card dinâmico que substitui Evoluindo + Login + Crie sua conta */}
        {(() => {
          const role = (userProfile?.role || "").toString().toLowerCase().trim();
          const userType = (userProfile?.userType || "").toString().toLowerCase().trim();
          // Tipo de perfil escolhido na seleção inicial (gravado em
          // `profileTypeChosen` no fim do cadastro). Garante que, após a
          // escolha, a Home pare de exibir "Escolha seu perfil".
          const chosenType = (userProfile?.profileTypeChosen || "").toString().toLowerCase().trim();
          const isEmployerProfile =
            role === "admin_empresa" ||
            userType === "empresario" ||
            userType === "empres\u00e1rio" ||
            userProfile?.isEmployer === true ||
            Boolean(userProfile?.managedCompanyId);
          const isSpecialistProfile =
            userType === "apoiador" ||
            userType === "especialista" ||
            chosenType === "specialist" ||
            chosenType === "apoiador" ||
            chosenType === "especialista" ||
            Boolean(userProfile?.apoiadorId);
          const isWorkerProfile =
            hasCompletedProfile ||
            userType === "trabalhador" ||
            role === "trabalhador" ||
            chosenType === "worker" ||
            chosenType === "trabalhador";
          const hasDefinedProfileType = isEmployerProfile || isSpecialistProfile || isWorkerProfile;
          const greetingName =
            (userPseudonym || userProfile?.name || "").toString().trim() || "amigo(a)";
          let isAdminFlag = false;
          try {
            // eslint-disable-next-line global-require
            const { isAdmin } = require("./utils/rbac");
            isAdminFlag = isAdmin();
          } catch { /* silencioso */ }
          return (
            <div
              className="mx-auto max-w-2xl mb-6 rounded-2xl shadow-xl p-5 md:p-6 border-2 border-blue-400 dark:border-blue-500/60 bg-gradient-to-br from-blue-600 via-indigo-700 to-blue-800 dark:from-slate-800 dark:via-slate-900 dark:to-blue-950 ring-1 ring-white/10"
              style={{ animation: "homeHeroIn 700ms ease-out both" }}
            >
              <style>{`
                @keyframes homeHeroIn {
                  from { opacity: 0; transform: translateY(18px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                @keyframes homeLoginSectionIn {
                  from { opacity: 0; transform: translateY(18px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              {/*
                Hero redesenhado para reduzir atrito de cadastro:
                - Headline forte com benefício direto
                - Subtítulo objetivo (apenas para visitantes/não convertidos)
                - Badges grandes e vídeo grande saíram daqui:
                  • badges viraram um "trust strip" discreto após os botões (cenários 1 e 2)
                  • vídeo foi para a seção "Como funciona?" mais abaixo
              */}
              <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center mb-2 tracking-tight drop-shadow leading-snug">
                Avalie suas experiências profissionais de forma 100% anônima e segura.
              </h2>
              {(!isAuthenticated || !hasDefinedProfileType) && (
                <p className="text-sm md:text-base text-blue-100/90 text-center mb-4 max-w-2xl mx-auto leading-relaxed font-semibold">
                  Qual é o seu perfil para começar?
                </p>
              )}
              <div className="w-20 h-1 mx-auto mb-6 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]" />

              {/* CENÁRIO 1 — não autenticado: escolha de perfil + login social secundário */}
              {!isAuthenticated && (
                <>
                  <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3 mb-5">
                    <button
                      type="button"
                      onClick={() => handleChooseProfile("worker")}
                      className="relative flex-1 sm:max-w-xs flex flex-col items-center justify-center text-center py-2.5 px-4 rounded-lg bg-lime-400 text-emerald-950 text-sm md:text-base font-bold shadow ring-2 ring-amber-300/70 transition-all duration-200 hover:bg-lime-500 hover:scale-[1.03] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-lime-300"
                    >
                      <span className="absolute -top-2 right-3 inline-flex items-center gap-0.5 bg-amber-400 text-amber-950 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">★ Recomendado</span>
                      <span>Sou Trabalhador</span>
                      <span className="block text-[11px] md:text-xs font-medium text-emerald-900/80 mt-0.5">(avalia anonimamente)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseProfile("specialist")}
                      className="flex-1 sm:max-w-xs flex flex-col items-center justify-center text-center py-2.5 px-4 rounded-lg bg-white text-blue-800 text-sm md:text-base font-bold shadow transition-all duration-200 hover:bg-blue-50 hover:scale-[1.03] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <span>Sou Especialista</span>
                      <span className="block text-[11px] md:text-xs font-medium text-blue-700/80 mt-0.5">(advogados, psicólogos, consultores e outros)</span>
                    </button>
                  </div>
                  {/* Login social secundário — promovido a "Cadastre-se em 10s"
                      para reduzir abandono. O mesmo botão serve para login
                      e cadastro instantâneo (signInWithGoogle/LinkedIn). */}
                  <div className="pt-4 border-t border-white/15">
                    <p className="text-xs md:text-sm uppercase tracking-wider text-amber-200 text-center mb-1 font-extrabold">
                      ⚡ Cadastre-se em 10 segundos
                    </p>
                    <p className="text-xs md:text-sm text-blue-100/90 text-center mb-3">
                      Sem formulários. Sem senha. Sua identidade fica oculta nas avaliações.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleGoogleClick}
                        disabled={isLoading}
                        className="flex-1 sm:max-w-[16rem] inline-flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-slate-800 font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all text-sm md:text-base disabled:opacity-60"
                      >
                        <FaGoogle className="text-base" /> Continuar com Google
                      </button>
                      <div className="flex-1 sm:max-w-[16rem]">
                        <LoginLinkedInButton
                          clientId={linkedInClientId}
                          redirectUri={linkedInRedirectUri}
                          onLoginSuccess={handleLinkedInSuccessWrapped}
                          onLoginFailure={(err) => setError(err?.message || String(err))}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-blue-100/70 text-center mt-3 leading-snug">
                      Por padrão, você inicia como <strong className="text-white">Trabalhador</strong> (anônimo). É possível alterar o perfil depois.
                    </p>
                  </div>
                </>
              )}

              {/* CENÁRIO 2 — autenticado sem tipo de perfil */}
              {isAuthenticated && !hasDefinedProfileType && (
                <>
                  <p className="text-sm md:text-base text-blue-100 text-center mb-4">
                    Bem-vindo(a)! Escolha seu perfil para começar:
                  </p>
                  <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleChooseProfile("worker")}
                      className="flex-1 sm:max-w-xs flex flex-col items-center justify-center text-center py-2.5 px-4 rounded-lg bg-lime-400 text-emerald-950 text-sm md:text-base font-bold shadow transition-all duration-200 hover:bg-lime-500 hover:scale-[1.03] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-lime-300"
                    >
                      <span>Sou Trabalhador</span>
                      <span className="block text-[11px] md:text-xs font-medium text-emerald-900/80 mt-0.5">(avalia anonimamente)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChooseProfile("specialist")}
                      className="flex-1 sm:max-w-xs flex flex-col items-center justify-center text-center py-2.5 px-4 rounded-lg bg-white text-blue-800 text-sm md:text-base font-bold shadow transition-all duration-200 hover:bg-blue-50 hover:scale-[1.03] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <span>Sou Especialista</span>
                      <span className="block text-[11px] md:text-xs font-medium text-blue-700/80 mt-0.5">(advogados, psicólogos, consultores e outros)</span>
                    </button>
                  </div>
                </>
              )}

              {/* Trust strip — sinaliza Anônimo/Verificado/Confiável de forma discreta
                  apenas nas telas de aquisição (visitante ou logado sem perfil). */}
              {(!isAuthenticated || !hasDefinedProfileType) && (
                <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-center gap-2">
                  <span
                    title="Sua identidade é mantida em sigilo: avaliações são publicadas sob pseudônimo."
                    className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2.5 py-1 rounded-full text-xs font-semibold"
                  >
                    <FaUserSecret aria-hidden="true" /> Anônimo
                  </span>
                  <span
                    title="Conta verificada via login LinkedIn ou Google."
                    className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2.5 py-1 rounded-full text-xs font-semibold"
                  >
                    <FaCheckCircle aria-hidden="true" /> Verificado
                  </span>
                  <span
                    title="Plataforma com regras anti-fraude e moderação de avaliações."
                    className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2.5 py-1 rounded-full text-xs font-semibold"
                  >
                    <FaShieldAlt aria-hidden="true" /> Confiável
                  </span>
                </div>
              )}

              {/* CENÁRIO 3 — autenticado com tipo de perfil definido */}
              {isAuthenticated && hasDefinedProfileType && (
                <>
                  <p className="text-sm md:text-base text-blue-100 text-center mb-4">
                    Bem-vindo(a), <span className="font-extrabold text-white">{greetingName}</span>!
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {isEmployerProfile ? (
                      <button
                        type="button"
                        onClick={() => navigate("/empresa-dashboard")}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-blue-800 text-sm font-bold shadow hover:bg-blue-50 transition"
                      >
                        Painel Empresa
                      </button>
                    ) : isSpecialistProfile ? null : (
                      <a
                        href="/trabalhador/encontrar-especialista"
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-blue-800 text-sm font-bold shadow hover:bg-blue-50 transition"
                      >
                        Buscar ajuda
                      </a>
                    )}
                    {isSpecialistProfile ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate("/apoiador/my-contacts")}
                          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-white text-blue-800 text-sm font-bold shadow hover:bg-blue-50 transition"
                        >
                          Meu Painel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const aid = userProfile?.apoiadorId || "";
                            if (aid) {
                              navigate(`/apoiadores/perfil/${encodeURIComponent(aid)}`);
                            } else {
                              navigate("/apoiador/my-contacts");
                            }
                          }}
                          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-transparent border-2 border-white text-white text-sm font-bold hover:bg-white/10 transition"
                        >
                          Meu Perfil Público
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate("/minha-conta")}
                        className="inline-flex items-center px-4 py-2 rounded-lg bg-white text-blue-800 text-sm font-bold shadow hover:bg-blue-50 transition"
                      >
                        Minha conta
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-transparent border-2 border-white text-white text-sm font-bold hover:bg-white/10 transition"
                    >
                      Sair
                    </button>
                    {isAdminFlag && (
                      <a
                        href="/admin"
                        className="inline-flex items-center px-3 py-1.5 text-xs text-blue-100 hover:text-white underline transition"
                      >
                        Admin
                      </a>
                    )}
                  </div>
                </>
              )}

              {firebaseStatus && (
                <p className="text-xs text-red-200 dark:text-red-300 mt-3 text-center">{firebaseStatus}</p>
              )}

              {company && (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={handleSaibaMais}
                    className="bg-blue-900 text-white font-extrabold py-3 px-10 min-w-[18rem] rounded-2xl shadow-lg transition-all transform hover:scale-105 hover:bg-blue-950 text-base md:text-lg font-azonix"
                  >
                    {`Ver avaliações da ${company.value.length > 25 ? company.value.slice(0, 25) + "…" : company.value}`}
                  </button>
                </div>
              )}

              {/* Banner Premium — sempre visível na parte inferior do Hero */}
              <div className="mt-6 pt-5 border-t border-white/20 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/escolha-perfil?planos=1')}
                  className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-amber-950 text-sm md:text-[15px] font-bold tracking-tight whitespace-nowrap shadow-md shadow-amber-500/25 ring-1 ring-amber-300/60 hover:shadow-lg hover:shadow-amber-500/35 hover:from-amber-300 hover:via-amber-400 hover:to-orange-400 hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-amber-300/50 transition-all duration-200"
                  aria-label="Ver benefícios do plano Premium"
                >
                  <span className="text-base leading-none" aria-hidden="true">⭐</span>
                  <span>Premium para trabalhadores e especialistas</span>
                  <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/30 text-amber-950 text-[10px] font-bold uppercase tracking-wider">
                    Ver benefícios
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Como funciona? — vídeo de apresentação movido do topo do Hero para
            reduzir atrito de cadastro. Fica visível para quem rolar a página
            em busca de mais informações sobre a plataforma. */}
        <section className="mx-auto max-w-2xl mb-6 bg-white dark:bg-slate-900 rounded-2xl shadow-md p-6 border border-blue-100 dark:border-slate-700">
          <h3 className="text-sm md:text-base uppercase tracking-[0.14em] font-extrabold text-blue-800 dark:text-blue-200 text-center mb-2">
            Como funciona?
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center mb-4">
            Em 2 minutos, veja como avaliar empresas de forma anônima e verificada.
          </p>
          <YouTubeEmbed videoId="BXzgY1Q4hQw" title="Apresentação Trabalhei Lá" />
        </section>

            {/* FORMULÁRIO */}
            <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 border border-blue-100 dark:border-slate-700">
              <h2 className="text-3xl font-extrabold text-blue-900 dark:text-blue-200 text-center mb-2 tracking-wide font-azonix">Avalie uma Empresa</h2>
              <div className="w-32 h-1 mx-auto mb-5 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300 dark:from-slate-500 dark:via-blue-400 dark:to-slate-500" />
              {isAuthenticated && userVerificationLevel === "free" && (
                <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 p-4 text-center">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Para avaliar uma empresa, faça login com sua conta LinkedIn ou Google. Isso garante a autenticidade das avaliações sem revelar sua identidade.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <div className="w-full sm:w-auto">
                      <LoginLinkedInButton
                        clientId={linkedInClientId}
                        redirectUri={linkedInRedirectUri}
                        onLoginSuccess={handleLinkedInSuccessWrapped}
                        onLoginFailure={(err) => setError(err?.message || String(err))}
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleGoogleClick}
                      disabled={isLoading}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-slate-700 text-blue-800 dark:text-blue-200 font-semibold py-2 px-4 rounded-lg shadow hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors text-sm disabled:opacity-60"
                    >
                      <FaGoogle className="text-base" /> Entrar com Google
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-200 mb-2 block">Selecione a Empresa</label>
                  <Select
                    options={safeCompanyOptions}
                    value={company}
                    onChange={setCompany}
                    onInputChange={handleCompanyInputChange}
                    placeholder="Buscar por nome ou CNPJ..."
                    styles={selectStyles}
                    isClearable
                    noOptionsMessage={({ inputValue }) =>
                      inputValue && inputValue.length >= 2
                        ? "Nenhuma empresa encontrada. Use 'Adicionar nova empresa' abaixo."
                        : "Digite para buscar uma empresa"
                    }
                    filterOption={(option, rawInput) => {
                      const input = (rawInput || "").toString().trim().toLowerCase();
                      if (!input) return true;
                      const data = option?.data || {};
                      const label = (option?.label || data.label || "").toLowerCase();
                      const razao = (data.razaoSocial || "").toLowerCase();
                      const cnpjDigits = String(data.cnpj || "");
                      const cnpjFormatted = (data.cnpjFormatted || "").toLowerCase();
                      const inputDigits = input.replace(/\D/g, "");
                      if (label.includes(input) || razao.includes(input) || cnpjFormatted.includes(input)) return true;
                      if (inputDigits && cnpjDigits.includes(inputDigits)) return true;
                      return false;
                    }}
                  />

                  <button type="button" onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                    className={`mt-3 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-all ${showNewCompanyInput ? "w-auto py-2 px-4 text-sm" : "w-full py-3 px-4"}`}>
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
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Não sabe o CNPJ? Pesquise o nome da empresa no Google seguido de CNPJ.
                      </p>
                      {cnpjError && <p className="text-sm text-red-600">{cnpjError}</p>}

                      {isUserAdmin && (
                        <div className="rounded-xl border border-dashed border-blue-200 dark:border-slate-700 p-3 bg-blue-50/50 dark:bg-slate-800/60">
                          <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">
                            Sem CNPJ? Cadastro manual (apenas admin)
                          </p>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={manualCompanyName}
                              onChange={(e) => setManualCompanyName(e.target.value)}
                              placeholder="Nome da empresa"
                              className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm"
                            />
                            <input
                              type="text"
                              value={manualRazaoSocial}
                              onChange={(e) => setManualRazaoSocial(e.target.value)}
                              placeholder="Razão social (opcional)"
                              className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm"
                            />
                            <select
                              value={manualSegment}
                              onChange={(e) => setManualSegment(e.target.value)}
                              className="w-full p-2 border border-blue-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm"
                            >
                              <option value="">Selecione o segmento (divisão CNAE)</option>
                              {(cnaeSegmentOptions || []).map((opt) => (
                                <option key={opt.code} value={opt.code}>{opt.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleAddCompanyWithoutCnpj}
                              className="w-full px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition"
                            >
                              Preparar cadastro sem CNPJ
                            </button>
                          </div>
                        </div>
                      )}

                      {pendingCompanyData && (
                        <div className="bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 rounded-xl p-3 text-sm text-blue-900 dark:text-blue-100">
                          <p className="font-semibold">Empresa encontrada: {pendingCompanyData.company}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">CNPJ: {pendingCompanyData.cnpj || "não informado"}</p>
                          {pendingCompanyData.razaoSocial && (
                            <p className="text-xs text-blue-700 dark:text-blue-200 mt-0.5">Razão social: {pendingCompanyData.razaoSocial}</p>
                          )}
                          {pendingCompanyData.segmento && (
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">Segmento (CNAE): {pendingCompanyData.segmento}</p>
                          )}
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

                <div className="bg-blue-50 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">Modelo de trabalho</p>
                  <div className="space-y-2 text-sm text-slate-700 dark:text-slate-100">
                    {workModelConfig.map((item) => (
                      <label key={item.key} className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-100">
                        <input
                          type="radio"
                          name="workModel"
                          checked={workModel === item.key}
                          onChange={() => setWorkModel(item.key)}
                          className="accent-blue-600 dark:accent-blue-400"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <fieldset
                  disabled={selectionProcessOnly}
                  className={`m-0 p-0 border-0 ${selectionProcessOnly ? "opacity-50" : ""}`}
                >
                  <WorkPeriodPicker
                    idPrefix="wp-desktop"
                    startMonth={workPeriodStartMonth}
                    setStartMonth={setWorkPeriodStartMonth}
                    startYear={workPeriodStartYear}
                    setStartYear={setWorkPeriodStartYear}
                    endMonth={workPeriodEndMonth}
                    setEndMonth={setWorkPeriodEndMonth}
                    endYear={workPeriodEndYear}
                    setEndYear={setWorkPeriodEndYear}
                    stillWorking={workPeriodStillWorking}
                    setStillWorking={setWorkPeriodStillWorking}
                  />
                </fieldset>

                <label className="mt-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(selectionProcessOnly)}
                    onChange={(e) => setSelectionProcessOnly(e.target.checked)}
                  />
                  <span>
                    <strong>Não se aplica</strong> — não fui contratado(a) por esta empresa
                    (avaliar apenas o processo seletivo).
                  </span>
                </label>
                </div>

                {/* Barra de progresso dos critérios */}
                {!selectionProcessOnly && visibleCriterionIdx >= 0 && (
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

                {selectionProcessOnly ? (
                  <SelectionProcessReviewForm
                    clarity={spClarity}
                    setClarity={setSpClarity}
                    communication={spCommunication}
                    setCommunication={setSpCommunication}
                    responseTime={spResponseTime}
                    setResponseTime={setSpResponseTime}
                    discriminationFelt={spDiscriminationFelt}
                    setDiscriminationFelt={setSpDiscriminationFelt}
                    discriminationComment={spDiscriminationComment}
                    setDiscriminationComment={setSpDiscriminationComment}
                    evidenceFiles={spEvidenceFiles}
                    setEvidenceFiles={setSpEvidenceFiles}
                  />
                ) : (
                  campos.map((campo, idx) => (
                  <div key={idx} ref={el => criterionRefs.current[idx] = el} data-criterion-idx={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <label className="w-full md:w-1/3 text-slate-700 dark:text-slate-100 font-semibold flex items-center gap-2 mb-2 md:mb-0">
                      <span className={`w-9 h-9 rounded-xl border bg-gradient-to-br ${campo.iconBg} flex items-center justify-center shadow-sm`}>
                        {campo.icon}
                      </span>
                      <span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>{campo.label}</span>
                          {campo.restrictedNote && (
                            <span
                              title={campo.restrictedNote}
                              aria-label={campo.restrictedNote}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full px-2 py-0.5 cursor-help"
                            >
                              <FiInfo className="w-3 h-3" aria-hidden="true" />
                              <span>Restrito a especialistas</span>
                            </span>
                          )}
                        </span>
                        {campo.subtitle && <span className="block text-xs text-slate-500 dark:text-slate-400">{campo.subtitle}</span>}
                      </span>
                    </label>
                    {campo.type === "yesno"
                      ? renderYesNo(campo.value, campo.set, campo.comment, campo.setComment, campo.label)
                      : renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label, campo.restrictKey)}
                  </div>
                  ))
                )}

                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                  <label className="text-slate-700 dark:text-slate-100 font-semibold text-lg block mb-2">Algo que queira acrescentar?</label>
                  <RestrictableTextarea
                    guidanceText={COMMENT_GUIDANCE_TEXT}
                    warningText={COMMENT_WARNING_TEXT}
                    containsPossiblePersonName={containsPossiblePersonName}
                    className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Descreva sua experiência na empresa..."
                    rows={3}
                    value={generalComment}
                    onValueChange={setGeneralComment}
                    segments={generalCommentRestrictedSegments}
                    onSegmentsChange={setGeneralCommentRestrictedSegments}
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
                      isAuthenticated
                        ? "bg-gradient-to-r from-blue-600 to-blue-800 hover:shadow-xl hover:scale-105"
                        : "bg-blue-600"
                    }`}
                    style={!isAuthenticated ? { animation: 'ctaGlow 2s ease-in-out infinite' } : undefined}
                    disabled={!isAuthenticated || isLoading}
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
                        />
                        <span>Enviando</span>
                      </span>
                    ) : isAuthenticated ? (
                      "Enviar Avaliação"
                    ) : (
                      "Faça login para avaliar"
                    )}
                  </button>
                  {((commentRating && containsPossiblePersonName(commentRating)) ||
                    (generalComment && containsPossiblePersonName(generalComment)) ||
                    Object.values(campos).some(c => c.comment && containsPossiblePersonName(c.comment))) && (
                    <p className="text-yellow-700 dark:text-yellow-300 text-xs text-center mt-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/60 rounded px-2 py-1">
                      Identificamos possível citação de nome em seu comentário. Você pode enviar normalmente; consideramos apenas um aviso para revisão.
                    </p>
                  )}
                  <p className="text-blue-600 dark:text-blue-300 text-xs font-semibold leading-tight mt-2">
                    {t('Sua opinião é anônima e ajuda outros profissionais')}
                  </p>
                </div>

              </form>
            </section>
          </div>

          {/* COLUNA ESQUERDA - RANKING + LOGO (empilha depois do hero no tablet; ordem 1 no desktop) */}
          <div className="w-full lg:basis-[20%] lg:max-w-[20%] lg:min-w-[220px] xl:basis-[19%] xl:max-w-[19%] xl:min-w-[240px] lg:shrink-0 flex flex-col gap-6 order-2 lg:order-1 break-words">

            {/* RANKING DE EMPRESAS */}
            <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-5 lg:p-6 border border-blue-100 dark:border-slate-700">
              <h2 className="text-2xl xl:text-3xl font-extrabold text-blue-900 dark:text-blue-200 text-center mb-2 font-azonix tracking-wide leading-tight">🏆 Ranking de Empresas</h2>
              <div className="w-24 h-1 mx-auto mb-4 rounded-full bg-gradient-to-r from-yellow-300 via-amber-500 to-yellow-300" />
              {Array.isArray(setoresList) && setoresList.length > 0 && (
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="block w-full mb-3 px-3 py-2.5 text-sm border border-blue-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  title="Filtrar por setor"
                >
                  <option value="">Todos os setores</option>
                  {setoresList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {Array.isArray(segmentosList) && segmentosList.length > 0 && (
                <select
                  value={segmentFilter}
                  onChange={(e) => setSegmentFilter(e.target.value)}
                  className="block w-full mb-3 px-3 py-2.5 text-sm border border-blue-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  title="Filtrar por segmento (CNAE)"
                >
                  <option value="">Todos os segmentos (CNAE)</option>
                  {segmentosList.map((seg) => {
                    const opt = (cnaeSegmentOptions || []).find((item) => item.code === seg);
                    return <option key={seg} value={seg}>{opt ? opt.label : seg}</option>;
                  })}
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
                      <div key={i} className={`${isUnrated ? "bg-slate-200 text-slate-600" : `bg-gradient-to-r ${getMedalColor(i)} text-white`} rounded-2xl px-3.5 py-3`}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-2xl shrink-0 leading-none">{getMedalEmoji(i)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-base leading-snug truncate tracking-tight" title={emp.company}>{emp.company}</p>
                            {!isUnrated && (
                              <p className={`text-xs font-semibold leading-tight mt-0.5 ${isUnrated ? "text-slate-600" : "text-white/90"}`}>
                                {isRecommendedCompany ? "✓ Acima da média" : "✗ Abaixo da média"}
                              </p>
                            )}
                          </div>
                          <div className={`shrink-0 ${isUnrated ? "bg-slate-300 text-slate-700" : "bg-white/20 text-white"} px-2.5 py-1 rounded-full font-bold text-sm inline-flex items-center gap-1 leading-none`}>
                            {isUnrated ? (
                              <span>--</span>
                            ) : (
                              <>
                                <span>{media}</span>
                                <FaStar className="text-yellow-200" />
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-slate-800 rounded-2xl p-4 border border-blue-200 dark:border-slate-700">
                <h3 className="text-base font-extrabold text-blue-900 dark:text-blue-200 mb-1.5 tracking-wide leading-snug">Empresas por Autocompletação</h3>
                <p className="text-sm text-blue-900 dark:text-slate-200 leading-relaxed">
                  Para manter performance com muitas empresas, a seleção é feita pelo campo <span className="font-semibold">"Selecione a Empresa"</span> no formulário. Digite parte do nome para buscar rapidamente.
                </p>
              </div>
            </section>

            {/* LOGO LATERAL — favicon + "Trabalhei Lá" (destaque visual) */}
            <section
              className="relative overflow-hidden rounded-3xl p-6 md:p-7 flex flex-col items-center border-2 border-blue-300/70 dark:border-blue-500/40 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 dark:from-slate-800 dark:via-slate-900 dark:to-blue-950 shadow-2xl shadow-blue-900/40 dark:shadow-black/60 ring-1 ring-white/10"
              style={{ animation: "homeLoginSectionIn 700ms ease-out both" }}
            >
              {/* brilho decorativo */}
              <div
                className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -bottom-12 -left-10 w-32 h-32 rounded-full bg-blue-300/20 dark:bg-blue-400/10 blur-2xl"
                aria-hidden="true"
              />

              <div className="relative bg-white dark:bg-slate-100 rounded-2xl p-3 shadow-xl shadow-black/30 ring-1 ring-white/40">
                <img
                  src="/favicon.png"
                  alt="Trabalhei Lá"
                  className="w-32 h-32 md:w-36 md:h-36 object-contain select-none drop-shadow-md"
                  draggable="false"
                />
              </div>
              <span className="relative mt-4 text-2xl md:text-3xl font-black text-white tracking-wide text-center leading-tight drop-shadow-[0_2px_0_rgba(15,23,42,0.5)]">
                Trabalhei Lá
              </span>
              <span className="relative mt-1 h-1 w-16 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]" />
            </section>
          </div>

          {/* COLUNA DIREITA - GRÁFICOS + COMO FUNCIONA (ordem 3 no desktop) */}
          <div className="w-full lg:basis-[24%] lg:max-w-[24%] lg:min-w-[260px] xl:basis-[23%] xl:max-w-[23%] xl:min-w-[270px] lg:shrink-0 flex flex-col gap-6 order-3 lg:order-3 break-words">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 border border-blue-100 dark:border-slate-700">
              <div className="mb-4 space-y-4">
                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Classificação profissional da empresa</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(contractPieData)}</p>
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${contractPieData.chart})` }}
                    />
                    <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {contractPieData.items.map((item) => (
                        <p key={`company_contract_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200 break-words">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="flex-1">{item.label}: {item.percent.toFixed(0)}%</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Formas de entrada na empresa</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(sourcePieData)}</p>
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${sourcePieData.chart})` }}
                    />
                    <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {sourcePieData.items.map((item) => (
                        <p key={`source_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200 break-words">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="flex-1">{item.label}: {item.percent.toFixed(0)}%</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-1">Modelo de trabalho na empresa</p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">{getTopSliceLabel(workModelPieData)}</p>
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-24 h-24 rounded-full border border-gray-200 flex-shrink-0 aspect-square"
                      style={{ background: `conic-gradient(${workModelPieData.chart})` }}
                    />
                    <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {workModelPieData.items.map((item) => (
                        <p key={`company_work_model_${item.key}`} className="flex items-center gap-2 text-slate-700 dark:text-slate-200 break-words">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="flex-1">{item.label}: {item.percent.toFixed(0)}%</span>
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
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">
              Trabalhei Lá | CNPJ: 67.029.282/0001-20
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
      <PaymentInfoModal
        open={showPaymentInfo}
        onClose={() => setShowPaymentInfo(false)}
        audience="both"
      />
    </div>
  );
}

export default TrabalheiLaDesktop;