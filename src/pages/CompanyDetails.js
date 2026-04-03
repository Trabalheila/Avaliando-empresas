import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCompanyLogoCandidates } from "../utils/getCompanyLogo";
import { db } from "../firebase";
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where, updateDoc } from "firebase/firestore";
import { hasCompanyInResumeExperiences } from "../utils/resumeParser";
import { listReviewsByCompanySlug } from "../services/reviews";
import { listCompanies, enrichCompanyWithBrasilAPI } from "../services/companies";
import { getUserRole, isPremium, isAdmin } from "../utils/rbac";
import { handleCheckout } from "../services/billing";
import AppHeader from "../components/AppHeader";
// import PremiumPieCard from "../components/PremiumPieCard"; // removido pois não é mais usado
// ...existing code...

function normalizeKey(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toSlug(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .replace(/-+$/g, "");
}

const AUTO_MODERATION_TERMS = [
  "racista",
  "nazista",
  "estupr",
  "amea",
  "matar",
  "suicid",
  "porno",
  "xingamento",
];

function detectAutoModeration(rawText) {
  const text = (rawText || "").toString().trim();
  const normalized = normalizeKey(text);

  if (!normalized) {
    return { status: "review", reasons: ["conteudo_vazio"] };
  }

  const reasons = [];

  const hasBlockedTerm = AUTO_MODERATION_TERMS.some((term) => normalized.includes(term));
  if (hasBlockedTerm) {
    reasons.push("linguagem_inadequada");
  }

  const linksCount = (text.match(/https?:\/\//gi) || []).length;
  if (linksCount >= 2) {
    reasons.push("spam_links");
  }

  if (/([A-Za-z])\1{8,}/.test(text)) {
    reasons.push("texto_repetitivo");
  }

  if (text.length > 2500) {
    reasons.push("texto_extenso");
  }

  if (hasBlockedTerm) {
    return { status: "hidden", reasons };
  }

  if (reasons.length > 0) {
    return { status: "review", reasons };
  }

  return { status: "approved", reasons: [] };
}

function hasTextValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function fetchWikidataLabels(ids) {
  if (!ids.length) return {};
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&format=json&props=labels&languages=pt|en&origin=*`;
  const response = await fetch(url);
  if (!response.ok) return {};
  const data = await response.json();
  const entities = data?.entities || {};

  const labels = {};
  Object.keys(entities).forEach((id) => {
    labels[id] =
      entities[id]?.labels?.pt?.value ||
      entities[id]?.labels?.en?.value ||
      id;
  });

  return labels;
}

async function fetchCompanyInsightsByName(companyName) {
  if (!companyName) return null;

  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    companyName
  )}&language=pt&uselang=pt&type=item&limit=5&format=json&origin=*`;

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const items = searchData?.search || [];
  if (!items.length) return null;

  const normalizedCompanyName = normalizeKey(companyName);
  const bestMatch =
    items.find((item) => normalizeKey(item.label).includes(normalizedCompanyName)) ||
    items[0];

  const entityId = bestMatch?.id;
  if (!entityId) return null;

  const detailsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&format=json&props=labels|descriptions|claims&languages=pt|en&origin=*`;
  const detailsRes = await fetch(detailsUrl);
  if (!detailsRes.ok) return null;
  const detailsData = await detailsRes.json();
  const entity = detailsData?.entities?.[entityId];
  if (!entity) return null;

  const getClaimValue = (claimKey) => {
    const claim = entity?.claims?.[claimKey]?.[0];
    return claim?.mainsnak?.datavalue?.value;
  };

  const industryValue = getClaimValue("P452");
  const hqValue = getClaimValue("P159");
  const websiteValue = getClaimValue("P856");
  const linkedinValue = getClaimValue("P6634");
  const twitterValue = getClaimValue("P2002");
  const instagramValue = getClaimValue("P2003");
  const facebookValue = getClaimValue("P2013");

  const idCandidates = [industryValue?.id, hqValue?.id].filter(Boolean);
  const labelsMap = await fetchWikidataLabels(idCandidates);

  return {
    description:
      entity?.descriptions?.pt?.value ||
      entity?.descriptions?.en?.value ||
      bestMatch?.description ||
      "Não identificado automaticamente",
    sector: industryValue?.id ? labelsMap[industryValue.id] : "Não identificado automaticamente",
    location: hqValue?.id ? labelsMap[hqValue.id] : "Não identificado automaticamente",
    website: typeof websiteValue === "string" ? websiteValue : "Não identificado automaticamente",
    socialLinks: [
      { label: "LinkedIn", value: linkedinValue ? `https://www.linkedin.com/company/${linkedinValue}` : "Não identificado automaticamente" },
      { label: "X / Twitter", value: twitterValue ? `https://twitter.com/${twitterValue}` : "Não identificado automaticamente" },
      { label: "Instagram", value: instagramValue ? `https://instagram.com/${instagramValue}` : "Não identificado automaticamente" },
      { label: "Facebook", value: facebookValue ? `https://facebook.com/${facebookValue}` : "Não identificado automaticamente" },
    ],
  };
}

function CompanyDetails({ theme, toggleTheme }) {
  const EDIT_DELETE_WINDOW_MS = 5 * 60 * 1000;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name");
  const [company, setCompany] = useState(null);




  // Busca empresa ao montar/com nome mudar
  useEffect(() => {
    if (!name) {
      setCompany(null);
      return;
    }
    try {
      const stored = localStorage.getItem("empresasData");
      if (!stored) {
        setCompany(null);
        return;
      }
      const empresas = JSON.parse(stored);
      const found = empresas.find((emp) => emp.company === name) || null;
      setCompany(found);
    } catch (err) {
      setCompany(null);
    }
  }, [name]);

  // Enriquecimento automático via Brasil API
  useEffect(() => {
    async function tryEnrichCompany() {
      if (!company?.cnpj || !company?.slug) return;
      if (!company.ramo || !company.cidade || !company.estado || !company.descricao) {
        const enriched = await enrichCompanyWithBrasilAPI(company.cnpj);
        if (enriched) {
          const ref = doc(db, "companies", company.slug);
          await updateDoc(ref, enriched);
        }
      }
    }
    tryEnrichCompany();
  }, [company]);

  const calculateAverage = (emp) => {
    if (!emp) return "--";
    const values = [
      emp.comunicacao,
      emp.etica,
      emp.salario,
      emp.cultura,
      emp.saudeBemEstar,
      emp.lideranca,
      emp.ambiente,
      emp.estimacaoOrganizacao,
      emp.desenvolvimento,
      emp.reconhecimento,
      emp.equilibrio,
      emp.diversidade,
      emp.rating,
    ].filter((v) => typeof v === "number" && !isNaN(v) && v > 0);
    if (values.length === 0) return "--";
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const avg = sum / values.length;
    return Number.isFinite(avg) ? avg.toFixed(1) : "--";
  };

  const openLinkedInJobs = () => {
    if (!company?.company) return;
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company.company)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getEvaluations = () => {
    if (!company) return {};
    try {
      const stored = localStorage.getItem(`evaluations_${company.company}`);
      return stored ? JSON.parse(stored) : {};
    } catch (err) {
      return {};
    }
  };

  const getScoreColor = (score) => {
    const n = parseFloat(score);
    if (Number.isNaN(n)) return "text-gray-700";
    if (n < 2) return "text-red-600";
    if (n < 3) return "text-purple-600";
    if (n < 4) return "text-yellow-600";
    if (n < 4.5) return "text-lime-600";
    return "text-emerald-700";
  };

  const [comments, setComments] = React.useState([]);
  const [mandatoryComment, setMandatoryComment] = React.useState("");
  const [commentError, setCommentError] = React.useState("");
  const [replyTo, setReplyTo] = React.useState(null);
  const [replyText, setReplyText] = React.useState("");
  const [reactionRegistry, setReactionRegistry] = React.useState({});
  const [animatedReactionKey, setAnimatedReactionKey] = React.useState("");
  const [blockedAuthors, setBlockedAuthors] = React.useState({});
  const [hiddenContentIds, setHiddenContentIds] = React.useState({});
  const [reportsRegistry, setReportsRegistry] = React.useState({});
  const [moderationInfo, setModerationInfo] = React.useState("");
  const [actionNotice, setActionNotice] = React.useState("");
  const [editingTargetId, setEditingTargetId] = React.useState(null);
  const [editingText, setEditingText] = React.useState("");
  const [openReactionPickerId, setOpenReactionPickerId] = React.useState(null);
  const [nowTimestamp, setNowTimestamp] = React.useState(Date.now());
  const reactionAnimationTimeout = React.useRef(null);
  const reactionHoldTimeout = React.useRef(null);
  const [insights, setInsights] = React.useState(null);
  const [insightsLoading, setInsightsLoading] = React.useState(false);

    // RBAC
    const userRole = React.useMemo(() => getUserRole(), []);
    const userIsPremium = React.useMemo(() => isPremium(), []);
    const userIsLoggedIn = React.useMemo(() => {
      try {
        const p = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const provider = (p?.loginProvider || "").toString().toLowerCase();
        return provider && provider !== "anonymous" && !p?.fallback;
      } catch { return false; }
    }, []);

    // Dashboard premium: dados de tendência por período
    const [trendData, setTrendData] = React.useState([]);
    const [trendLoading, setTrendLoading] = React.useState(false);
    const [trendError, setTrendError] = React.useState("");
    const [periodStart, setPeriodStart] = React.useState("");
    const [periodEnd, setPeriodEnd] = React.useState("");
    const [selectedTrendKey, setSelectedTrendKey] = React.useState("rating");
    const [dashboardVisible, setDashboardVisible] = React.useState(false);
    const [checkoutLoadingAudience, setCheckoutLoadingAudience] = React.useState(null);
    // Removidos: premiumNotice, setPremiumNotice, premiumAudience, setPremiumAudience pois não são mais usados
  // Removido premiumPaymentMethod e setPremiumPaymentMethod pois não são mais usados
  const [compareOptions, setCompareOptions] = React.useState([]);
  const [compareTargetSlug, setCompareTargetSlug] = React.useState("");

  // Removidos: compareLoading, setCompareLoading, compareError, setCompareError pois não são mais usados
  const logoCandidates = company
    ? getCompanyLogoCandidates(company.company, { size: 128, website: company.website })
    : [];
  const [logoIndex, setLogoIndex] = React.useState(0);
  const companyLogo = logoCandidates[logoIndex] || null;
  const [itemCommentCounts, setItemCommentCounts] = React.useState({});
  const [companyReviewCount, setCompanyReviewCount] = React.useState(0);
  const [companyAverages, setCompanyAverages] = React.useState({});


  const average = companyReviewCount > 0
    ? calculateAverage({ ...company, ...companyAverages })
    : calculateAverage(company);
  const averageScore = Number.parseFloat(average);
  const hasAverageScore = Number.isFinite(averageScore);
  const isRecommendedCompany = hasAverageScore && averageScore >= 3;

  const evaluations = getEvaluations();
  const localEvaluationCount = Object.keys(evaluations).length;
  const evaluationCount = companyReviewCount || localEvaluationCount;

  React.useEffect(() => {
    setLogoIndex(0);
  }, [company?.company, company?.website]);



  React.useEffect(() => {
    return () => {
      if (reactionAnimationTimeout.current) {
        clearTimeout(reactionAnimationTimeout.current);
      }
      if (reactionHoldTimeout.current) {
        clearTimeout(reactionHoldTimeout.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    let alive = true;

    const loadInsights = async () => {
      if (!company?.company) {
        setInsights(null);
        return;
      }

      setInsightsLoading(true);
      try {
        const remote = await fetchCompanyInsightsByName(company.company);
        if (!alive) return;
        setInsights(remote);
      } catch (err) {
        if (!alive) return;
        setInsights(null);
      } finally {
        if (!alive) return;
        setInsightsLoading(false);
      }
    };

    loadInsights();

    return () => {
      alive = false;
    };
  }, [company?.company]);

  React.useEffect(() => {
    let alive = true;

    const loadItemCommentsCount = async () => {
      const companySlug = (company?.company || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/g, "")
        .replace(/-+$/g, "");
      if (!companySlug) {
        setItemCommentCounts({});
        return;
      }

      try {
        const reviews = await listReviewsByCompanySlug(companySlug, 300);
        if (!alive) return;

        const nextCounts = {
          comunicacao: 0,
          etica: 0,
          salario: 0,
          cultura: 0,
          saudeBemEstar: 0,
          lideranca: 0,
          ambiente: 0,
          estimacaoOrganizacao: 0,
          desenvolvimento: 0,
          reconhecimento: 0,
          equilibrio: 0,
          diversidade: 0,
          rating: 0,
        };

        const metricKeys = [
          "comunicacao",
          "etica",
          "salario",
          "cultura",
          "saudeBemEstar",
          "lideranca",
          "ambiente",
          "estimacaoOrganizacao",
          "desenvolvimento",
          "reconhecimento",
          "equilibrio",
          "diversidade",
          "rating",
        ];
        const totals = Object.fromEntries(metricKeys.map((key) => [key, 0]));
        const nextSourceStats = {
          indicacao: 0,
          siteVagas: 0,
          gruposWhatsapp: 0,
          redesSociais: 0,
        };

        for (const review of reviews || []) {
          if (hasTextValue(review?.commentComunicacao)) nextCounts.comunicacao += 1;
          if (hasTextValue(review?.commentEtica)) nextCounts.etica += 1;
          if (hasTextValue(review?.commentSalario) || hasTextValue(review?.commentBeneficios)) nextCounts.salario += 1;
          if (hasTextValue(review?.commentCultura)) nextCounts.cultura += 1;
          if (hasTextValue(review?.commentSaudeBemEstar)) nextCounts.saudeBemEstar += 1;
          if (hasTextValue(review?.commentLideranca)) nextCounts.lideranca += 1;
          if (hasTextValue(review?.commentAmbiente)) nextCounts.ambiente += 1;
          if (hasTextValue(review?.commentEstimacaoOrganizacao)) nextCounts.estimacaoOrganizacao += 1;
          if (hasTextValue(review?.commentDesenvolvimento)) nextCounts.desenvolvimento += 1;
          if (hasTextValue(review?.commentReconhecimento)) nextCounts.reconhecimento += 1;
          if (hasTextValue(review?.commentEquilibrio)) nextCounts.equilibrio += 1;
          if (hasTextValue(review?.commentDiversidade)) nextCounts.diversidade += 1;
          if (hasTextValue(review?.commentRating)) nextCounts.rating += 1;

          for (const metricKey of metricKeys) {
            totals[metricKey] += Number(review?.[metricKey]) || 0;
          }

          if (review?.entrySource && nextSourceStats[review.entrySource] != null) {
            nextSourceStats[review.entrySource] += 1;
          }
        }

        setItemCommentCounts(nextCounts);
        const reviewCount = (reviews || []).length;
        setCompanyReviewCount(reviewCount);
        setCompanyAverages(
          Object.fromEntries(
            metricKeys.map((key) => [
              key,
              reviewCount > 0 ? Number((totals[key] / reviewCount).toFixed(2)) : 0,
            ])
          )
        );
      } catch (err) {
        if (!alive) return;
        setItemCommentCounts({});
        setCompanyReviewCount(0);
        setCompanyAverages({});
      }
    };

    loadItemCommentsCount();

    return () => {
      alive = false;
    };
  }, [company?.company]);

  const reactions = [
    { key: "thumbsDown", label: "👎" },
    { key: "laugh", label: "😂" },
    { key: "thumbsUp", label: "👍" },
    { key: "cry", label: "😢" },
    { key: "clap", label: "👏" },
  ];

  const clearReactionHoldTimer = () => {
    if (!reactionHoldTimeout.current) return;
    clearTimeout(reactionHoldTimeout.current);
    reactionHoldTimeout.current = null;
  };

  const startReactionHold = (pickerId) => {
    clearReactionHoldTimer();
    reactionHoldTimeout.current = setTimeout(() => {
      setOpenReactionPickerId(pickerId);
      reactionHoldTimeout.current = null;
    }, 450);
  };

  const getTotalReactions = (comment) => {
    return Object.values(comment.reactions || {}).reduce((sum, v) => sum + (v || 0), 0);
  };

  const getCurrentPseudonym = () => {
    return (localStorage.getItem("userPseudonym") || "Anônimo").toString().trim();
  };

  const getContentCreatedAtMs = (item) => {
    const ts = new Date(item?.createdAt || "").getTime();
    return Number.isFinite(ts) ? ts : null;
  };

  const isOwnedByCurrentUser = (item) => {
    return normalizeKey(item?.author) === normalizeKey(getCurrentPseudonym());
  };

  const canManageContent = (item) => {
    if (!item?.id || !isOwnedByCurrentUser(item)) return false;
    const createdAtMs = getContentCreatedAtMs(item);
    if (createdAtMs == null) return false;
    return nowTimestamp - createdAtMs <= EDIT_DELETE_WINDOW_MS;
  };

  const getRemainingManageTimeLabel = (item) => {
    const createdAtMs = getContentCreatedAtMs(item);
    if (createdAtMs == null) return "";

    const remainingMs = Math.max(0, EDIT_DELETE_WINDOW_MS - (nowTimestamp - createdAtMs));
    if (remainingMs <= 0) return "";

    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  };

  const getPositiveReactions = (comment) => {
    return (
      (comment?.reactions?.thumbsUp || 0) +
      (comment?.reactions?.clap || 0) +
      (comment?.reactions?.laugh || 0)
    );
  };

  const companyInfo = useMemo(() => {
    if (!company) return null;

    const sector =
      insights?.sector ||
      company.ramo ||
      company.setor ||
      company.segmento ||
      company.industry ||
      "Não identificado automaticamente";

    const location =
      insights?.location ||
      [company.cidade, company.estado, company.pais].filter(Boolean).join(" - ") ||
      "Não identificado automaticamente";

    const website =
      insights?.website ||
      company.website ||
      company.site ||
      company.url ||
      "Não identificado automaticamente";

    const cnpj = company.cnpj || "Não informado";

    const socialLinks = insights?.socialLinks || [
      { label: "LinkedIn", value: company.linkedin || "Não identificado automaticamente" },
      { label: "Instagram", value: company.instagram || "Não identificado automaticamente" },
      { label: "Facebook", value: company.facebook || "Não identificado automaticamente" },
    ];

    const description = insights?.description || "Informação automática ainda não identificada para esta empresa.";

    return {
      sector,
      location,
      website,
      cnpj,
      socialLinks,
      description,
    };
  }, [company, insights]);

  const userHasResumeProof = useMemo(() => {
    if (!company?.company) return false;
    try {
      const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      return hasCompanyInResumeExperiences(company.company, userProfile?.resumeData);
    } catch {
      return false;
    }
  }, [company?.company]);

  const fetchTrend = React.useCallback(async () => {
    if (!userIsPremium || !company?.company) return;
    const slug = company.company
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    setTrendLoading(true);
    setTrendError("");
    try {
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const res = await fetch("/api/admin-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug: slug,
          is_premium: profile?.is_premium || userRole === "admin_empresa",
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar tendências.");
      setTrendData(data.trend || []);
    } catch (err) {
      setTrendError(err.message);
    } finally {
      setTrendLoading(false);
    }
  }, [userIsPremium, company?.company, userRole, periodStart, periodEnd]);

  React.useEffect(() => {
    if (userIsPremium && dashboardVisible) fetchTrend();
  }, [fetchTrend, userIsPremium, dashboardVisible]);

  const handlePremiumUnlock = React.useCallback(async (audience = "worker") => {
    // Linha removida: setPremiumNotice não é mais usado
    const companyName = (company?.company || "").toString().trim();
    const companySlug = companyName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/g, "")
      .replace(/-+$/g, "");
    const cnpj = (companyInfo?.cnpj || "").toString();
    const cleaned = cnpj.replace(/\D/g, "");
    if (!companySlug) {
      // Linha removida: setPremiumNotice não é mais usado
      return;
    }

    setCheckoutLoadingAudience(audience);
    try {
      await handleCheckout({
        cnpj: cleaned,
        companySlug,
        companyName,
        audience,
      });
    } catch (err) {
      // Linha removida: setPremiumNotice não é mais usado
    } finally {
      setCheckoutLoadingAudience(null);
    }
  }, [company?.company, companyInfo?.cnpj]);

  const getCommentsKey = React.useCallback(() => {
    return company ? `comments_${company.company}` : null;
  }, [company]);

  const getCompanySlug = React.useCallback(() => {
    if (!company?.company) return "";
    return toSlug(company.company);
  }, [company]);

  React.useEffect(() => {
    let alive = true;

    const loadCompareOptions = async () => {
      const currentSlug = getCompanySlug();
      if (!currentSlug) {
        if (alive) {
          setCompareOptions([]);
          setCompareTargetSlug("");
        }
        return;
      }

      const optionMap = new Map();

      try {
        const stored = JSON.parse(localStorage.getItem("empresasData") || "[]");
        for (const item of stored) {
          const itemName = (item?.company || item?.name || "").toString().trim();
          const itemSlug = toSlug(itemName);
          if (!itemSlug || itemSlug === currentSlug) continue;
          if (!optionMap.has(itemSlug)) {
            optionMap.set(itemSlug, { slug: itemSlug, name: itemName || itemSlug });
          }
        }
      } catch {
        // fallback silencioso
      }

      try {
        const remoteCompanies = await listCompanies(250);
        for (const item of remoteCompanies || []) {
          const itemName = (item?.name || item?.company || item?.slug || "").toString().trim();
          const itemSlug = toSlug(item?.slug || itemName);
          if (!itemSlug || itemSlug === currentSlug) continue;
          if (!optionMap.has(itemSlug)) {
            optionMap.set(itemSlug, { slug: itemSlug, name: itemName || itemSlug });
          }
        }
      } catch {
        // mantém opções locais se o remoto falhar
      }

      if (!alive) return;

      const merged = [...optionMap.values()]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        .slice(0, 80);

      setCompareOptions(merged);
      if (!merged.some((item) => item.slug === compareTargetSlug)) {
        setCompareTargetSlug(merged[0]?.slug || "");
      }
    };

    loadCompareOptions();

    return () => {
      alive = false;
    };
  }, [company?.company, getCompanySlug, compareTargetSlug]);

  const getReactionsKey = React.useCallback(() => {
    return company ? `comment_reactions_${company.company}` : null;
  }, [company]);

  const getBlockedAuthorsKey = React.useCallback(() => {
    return company ? `blocked_authors_${company.company}` : null;
  }, [company]);

  const getHiddenContentKey = React.useCallback(() => {
    return company ? `hidden_content_${company.company}` : null;
  }, [company]);

  const getReportsRegistryKey = React.useCallback(() => {
    return company ? `reports_registry_${company.company}` : null;
  }, [company]);

  const saveComments = React.useCallback((nextComments) => {
    setComments(nextComments);
    try {
      const key = getCommentsKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(nextComments));
      }
    } catch (err) {
      console.warn("Falha ao salvar comentários:", err);
    }
  }, [getCommentsKey]);

  const syncCommentsToFirestore = async (nextComments) => {
    try {
      const companySlug = getCompanySlug();
      if (!companySlug) return;

      await Promise.all(
        (nextComments || []).map((comment) =>
          setDoc(
            doc(db, "comments", comment.id),
            {
              ...comment,
              companySlug,
              companyName: company.company,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          )
        )
      );
    } catch (err) {
      console.warn("Falha ao sincronizar comentários no Firebase:", err);
    }
  };

  React.useEffect(() => {
    const key = getCommentsKey();
    if (!key) {
      setComments([]);
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setComments(JSON.parse(stored));
      } else {
        setComments([]);
      }
    } catch (err) {
      console.warn("Falha ao carregar comentários:", err);
      setComments([]);
    }
  }, [getCommentsKey]);

  React.useEffect(() => {
    const fetchRemoteComments = async () => {
      try {
        const companySlug = getCompanySlug();
        if (!companySlug) return;

        const ref = collection(db, "comments");
        const q = query(
          ref,
          where("companySlug", "==", companySlug),
          orderBy("createdAt", "desc"),
          limit(120)
        );

        const snap = await getDocs(q);
        if (snap.empty) return;

        const normalized = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            author: data.author || "Anônimo",
            text: data.text || "",
            createdAt:
              typeof data.createdAt?.toDate === "function"
                ? data.createdAt.toDate().toISOString()
                : data.createdAt || new Date().toISOString(),
            editedAt:
              typeof data.editedAt?.toDate === "function"
                ? data.editedAt.toDate().toISOString()
                : data.editedAt || null,
            reactions: {
              thumbsDown: data.reactions?.thumbsDown || 0,
              laugh: data.reactions?.laugh || 0,
              thumbsUp: data.reactions?.thumbsUp || 0,
              cry: data.reactions?.cry || 0,
              clap: data.reactions?.clap || 0,
            },
            replies: Array.isArray(data.replies)
              ? data.replies.map((reply) => ({
                  ...reply,
                  editedAt:
                    typeof reply?.editedAt?.toDate === "function"
                      ? reply.editedAt.toDate().toISOString()
                      : reply?.editedAt || null,
                }))
              : [],
          };
        });

        saveComments(normalized);
      } catch (err) {
        console.warn("Falha ao carregar comentários do Firebase:", err);
      }
    };

    fetchRemoteComments();
  }, [getCompanySlug, saveComments]);

  React.useEffect(() => {
    const key = getReactionsKey();
    if (!key) {
      setReactionRegistry({});
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setReactionRegistry(stored ? JSON.parse(stored) : {});
    } catch (err) {
      console.warn("Falha ao carregar reações:", err);
      setReactionRegistry({});
    }
  }, [getReactionsKey]);

  React.useEffect(() => {
    const key = getBlockedAuthorsKey();
    if (!key) {
      setBlockedAuthors({});
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setBlockedAuthors(stored ? JSON.parse(stored) : {});
    } catch {
      setBlockedAuthors({});
    }
  }, [getBlockedAuthorsKey]);

  React.useEffect(() => {
    const key = getHiddenContentKey();
    if (!key) {
      setHiddenContentIds({});
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setHiddenContentIds(stored ? JSON.parse(stored) : {});
    } catch {
      setHiddenContentIds({});
    }
  }, [getHiddenContentKey]);

  React.useEffect(() => {
    const key = getReportsRegistryKey();
    if (!key) {
      setReportsRegistry({});
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      setReportsRegistry(stored ? JSON.parse(stored) : {});
    } catch {
      setReportsRegistry({});
    }
  }, [getReportsRegistryKey]);

  const saveReactionRegistry = (next) => {
    setReactionRegistry(next);
    try {
      const key = getReactionsKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch (err) {
      console.warn("Falha ao salvar reações:", err);
    }
  };

  const saveHiddenContentIds = (next) => {
    setHiddenContentIds(next);
    try {
      const key = getHiddenContentKey();
      if (key) localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const saveReportsRegistry = (next) => {
    setReportsRegistry(next);
    try {
      const key = getReportsRegistryKey();
      if (key) localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const getAuthorBlockKey = (author) => normalizeKey(author || "anonimo");

  const isAuthorBlocked = React.useCallback(
    (author) => Boolean(blockedAuthors[getAuthorBlockKey(author)]),
    [blockedAuthors]
  );

  const isContentHidden = React.useCallback(
    (targetId) => Boolean(hiddenContentIds[targetId]),
    [hiddenContentIds]
  );

  const hideContent = (targetId) => {
    if (!targetId) return;
    saveHiddenContentIds({
      ...hiddenContentIds,
      [targetId]: {
        hiddenAt: new Date().toISOString(),
      },
    });
    setModerationInfo("Conteúdo ocultado com sucesso.");
  };

  const syncReportToFirestore = async (report) => {
    try {
      await setDoc(doc(db, "content_reports", report.id), report, { merge: true });
    } catch (err) {
      console.warn("Falha ao salvar denuncia no Firebase:", err);
    }
  };

  const reportTarget = ({ targetId, targetType, author, text }) => {
    const reporter = localStorage.getItem("userPseudonym") || "anon";
    const registryKey = `${targetId}__${reporter}`;
    if (reportsRegistry[registryKey]) {
      setModerationInfo("Você já denunciou este item.");
      return;
    }

    const moderationSnapshot = detectAutoModeration(text || "");
    const report = {
      id: `report_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      companyName: company?.company || "",
      companySlug: getCompanySlug(),
      targetId,
      targetType,
      targetAuthor: author || "Anônimo",
      reporter,
      textSnippet: (text || "").slice(0, 320),
      autoModerationStatus: moderationSnapshot.status,
      autoModerationReasons: moderationSnapshot.reasons,
      createdAt: new Date().toISOString(),
      status: "pending_review",
    };

    if (moderationSnapshot.status === "hidden") {
      hideContent(targetId);
    }

    syncReportToFirestore(report);
    saveReportsRegistry({
      ...reportsRegistry,
      [registryKey]: report.id,
    });
    setModerationInfo("Denúncia enviada. Moderação automática aplicada.");
  };

  const handleAddComment = () => {
    const mandatoryText = mandatoryComment.trim();

    if (!mandatoryText) {
      setCommentError("O comentário precisa ser preenchido.");
      return;
    }

    setCommentError("");

    const pseudonym = localStorage.getItem("userPseudonym") || "Anônimo";

    const finalText = mandatoryText;

    const moderation = detectAutoModeration(finalText);
    const moderatedText = moderation.status === "approved"
      ? finalText
      : "[Conteúdo ocultado automaticamente pela moderação.]";

    const comment = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: pseudonym,
      text: moderatedText,
      createdAt: new Date().toISOString(),
      moderation,
      reactions: { thumbsDown: 0, laugh: 0, thumbsUp: 0, cry: 0, clap: 0 },
      replies: [],
    };
    saveComments([comment, ...comments]);
    syncCommentsToFirestore([comment, ...comments]);
    setActionNotice("Comentário publicado. Você pode editar ou apagar por até 5 minutos.");
    setMandatoryComment("");

    if (moderation.status !== "approved") {
      setModerationInfo("Seu comentário passou por moderação automática.");
    }
  };

  const incrementReactionById = (items, targetId, reactionKey) => {
    return items.map((item) => {
      if (item.id === targetId) {
        return {
          ...item,
          reactions: {
            thumbsDown: item.reactions?.thumbsDown || 0,
            laugh: item.reactions?.laugh || 0,
            thumbsUp: item.reactions?.thumbsUp || 0,
            cry: item.reactions?.cry || 0,
            clap: item.reactions?.clap || 0,
            [reactionKey]: (item.reactions?.[reactionKey] || 0) + 1,
          },
        };
      }

      if (item.replies && item.replies.length) {
        return {
          ...item,
          replies: incrementReactionById(item.replies, targetId, reactionKey),
        };
      }

      return item;
    });
  };

  const handleReact = (targetId, reactionKey) => {
    const pseudonym = localStorage.getItem("userPseudonym") || "anon";
    const registryKey = `${targetId}__${pseudonym}`;

    // Uma reação por usuário por post/resposta.
    if (reactionRegistry[registryKey]) return;

    const nextComments = incrementReactionById(comments, targetId, reactionKey);
    saveComments(nextComments);
    syncCommentsToFirestore(nextComments);
    setOpenReactionPickerId(null);
    const animationKey = `${targetId}__${reactionKey}`;
    setAnimatedReactionKey(animationKey);
    if (reactionAnimationTimeout.current) {
      clearTimeout(reactionAnimationTimeout.current);
    }
    reactionAnimationTimeout.current = setTimeout(() => {
      setAnimatedReactionKey("");
    }, 450);
    saveReactionRegistry({
      ...reactionRegistry,
      [registryKey]: reactionKey,
    });
  };

  const addReplyToItem = (items, targetId, replyObj) => {
    return items.map((item) => {
      if (item.id === targetId) {
        return {
          ...item,
          replies: [...(item.replies || []), replyObj],
        };
      }
      if (item.replies && item.replies.length) {
        return {
          ...item,
          replies: addReplyToItem(item.replies, targetId, replyObj),
        };
      }
      return item;
    });
  };

  const handleReply = (targetId) => {
    if (!replyText.trim()) return;
    const pseudonym = localStorage.getItem("userPseudonym") || "Anônimo";
    const moderation = detectAutoModeration(replyText.trim());
    const reply = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      author: pseudonym,
      text:
        moderation.status === "approved"
          ? replyText.trim()
          : "[Conteúdo ocultado automaticamente pela moderação.]",
      createdAt: new Date().toISOString(),
      moderation,
      replies: [],
    };
    const next = addReplyToItem(comments, targetId, reply);
    saveComments(next);
    syncCommentsToFirestore(next);
    setActionNotice("Resposta publicada. Você pode editar ou apagar por até 5 minutos.");
    setReplyText("");
    setReplyTo(null);

    if (moderation.status !== "approved") {
      setModerationInfo("Sua resposta passou por moderação automática.");
    }
  };

  const updateItemById = (items, targetId, updater) => {
    return items.map((item) => {
      if (item.id === targetId) {
        return updater(item);
      }

      if (item.replies && item.replies.length) {
        return {
          ...item,
          replies: updateItemById(item.replies, targetId, updater),
        };
      }

      return item;
    });
  };

  const removeItemById = (items, targetId) => {
    return (items || [])
      .filter((item) => item.id !== targetId)
      .map((item) => {
        if (item.replies && item.replies.length) {
          return {
            ...item,
            replies: removeItemById(item.replies, targetId),
          };
        }

        return item;
      });
  };

  const startEditingItem = (item) => {
    if (!canManageContent(item)) {
      setActionNotice("O prazo de 5 minutos para editar/ apagar este conteúdo já expirou.");
      return;
    }

    setEditingTargetId(item.id);
    setEditingText(item.text || "");
    setActionNotice("Modo de edição ativado. Lembre-se: o prazo total é de 5 minutos após a publicação.");
  };

  const cancelEditing = () => {
    setEditingTargetId(null);
    setEditingText("");
  };

  const saveEditedItem = (item) => {
    if (!item?.id) return;

    if (!canManageContent(item)) {
      setActionNotice("O prazo de 5 minutos para editar este conteúdo já expirou.");
      cancelEditing();
      return;
    }

    const cleaned = editingText.trim();
    if (!cleaned) {
      setActionNotice("O texto não pode ficar vazio.");
      return;
    }

    const moderation = detectAutoModeration(cleaned);
    const moderatedText = moderation.status === "approved"
      ? cleaned
      : "[Conteúdo ocultado automaticamente pela moderação.]";

    const next = updateItemById(comments, item.id, (current) => ({
      ...current,
      text: moderatedText,
      moderation,
      editedAt: new Date().toISOString(),
    }));

    saveComments(next);
    syncCommentsToFirestore(next);
    cancelEditing();
    setActionNotice("Conteúdo editado com sucesso.");

    if (moderation.status !== "approved") {
      setModerationInfo("Seu conteúdo editado passou por moderação automática.");
    }
  };

  const deleteItem = (item) => {
    if (!item?.id) return;

    const confirmed = window.confirm("Tem certeza que deseja apagar este conteúdo? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    if (!canManageContent(item)) {
      setActionNotice("O prazo de 5 minutos para apagar este conteúdo já expirou.");
      return;
    }

    const next = removeItemById(comments, item.id);
    saveComments(next);
    syncCommentsToFirestore(next);

    if (replyTo === item.id) {
      setReplyTo(null);
      setReplyText("");
    }

    if (editingTargetId === item.id) {
      cancelEditing();
    }

    setActionNotice("Conteúdo apagado com sucesso.");
  };

  const scoreFields = useMemo(() => [
    { key: "comunicacao", label: "Processo de Recrutamento" },
    { key: "etica", label: "Proposta salarial e benefícios" },
    { key: "cultura", label: "Visão e valores da empresa" },
    { key: "salario", label: "Data do Pagamento" },
    { key: "lideranca", label: "Acessibilidade e respeito da liderança" },
    { key: "estimacaoOrganizacao", label: "Condições de trabalho" },
    { key: "ambiente", label: "Estímulo ao respeito" },
    { key: "diversidade", label: "sofreu discriminação?" },
    { key: "rating", label: "Segurança e integridade" },
    { key: "saudeBemEstar", label: "Preocupação com o bem estar" },
    { key: "equilibrio", label: "Rotatividade" },
    { key: "reconhecimento", label: "Reconhecimento" },
    { key: "desenvolvimento", label: "Planos de cargos e salários" },
  ], []);

  const currentMetrics = useMemo(() => {
    const source = companyReviewCount > 0 ? companyAverages : (company || {});
    return Object.fromEntries(
      scoreFields.map((field) => {
        const value = Number(source?.[field.key]) || 0;
        return [field.key, value > 0 ? value : 0];
      })
    );
  }, [companyReviewCount, companyAverages, company, scoreFields]);

  React.useEffect(() => {
    let alive = true;

    const loadCompareSnapshot = async () => {
      if (!userIsPremium || !compareTargetSlug) {
        if (alive) {
          // Linha removida: setCompareError não é mais usado
        }
        return;
      }

      // Linha removida: setCompareLoading não é mais usado
      // Linha removida: setCompareError não é mais usado
      try {
        const reviews = await listReviewsByCompanySlug(compareTargetSlug, 300);
        if (!alive) return;

        const totals = Object.fromEntries(scoreFields.map((field) => [field.key, 0]));

        for (const review of reviews || []) {
          for (const field of scoreFields) {
            totals[field.key] += Number(review?.[field.key]) || 0;
          }
        }


      } catch (err) {
        if (!alive) return;
        // Linha removida: setCompareError não é mais usado
      } finally {
        if (!alive) return;
        // Linha removida: setCompareLoading não é mais usado
      }
    };

    loadCompareSnapshot();

    return () => {
      alive = false;
    };
  }, [userIsPremium, compareTargetSlug, compareOptions, scoreFields]);



  const premiumRadar = useMemo(() => {
    const entries = scoreFields
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: Number(currentMetrics?.[field.key]) || 0,
      }))
      .filter((item) => item.value > 0);

    const strengths = [...entries].sort((a, b) => b.value - a.value).slice(0, 3);
    const risks = [...entries].sort((a, b) => a.value - b.value).slice(0, 3);

    const trendDelta = trendData.length >= 2
      ? Number(((trendData[trendData.length - 1]?.averages?.rating || 0) - (trendData[0]?.averages?.rating || 0)).toFixed(2))
      : 0;

    return { strengths, risks, trendDelta };
  }, [scoreFields, currentMetrics, trendData]);

  // Removidos: premiumAudienceLabel, premiumBenefitsByAudience pois não são mais usados

  // Removido: handleDownloadPremiumReport pois não é mais usado





  // Removido: companySourcePieData pois não é mais usado

  const visibleComments = useMemo(() => {
    const filterReplies = (replies) => {
      return (replies || []).filter((reply) => {
        if (!reply?.id) return false;
        if (isContentHidden(reply.id)) return false;
        if (isAuthorBlocked(reply.author)) return false;
        return true;
      });
    };

    return (comments || [])
      .filter((comment) => {
        if (!comment?.id) return false;
        if (isContentHidden(comment.id)) return false;
        if (isAuthorBlocked(comment.author)) return false;
        return true;
      })
      .map((comment) => ({
        ...comment,
        replies: filterReplies(comment.replies),
      }));
  }, [comments, isAuthorBlocked, isContentHidden]);

  const featuredComment = useMemo(() => {
    if (!Array.isArray(visibleComments) || visibleComments.length === 0) return null;

    return [...visibleComments].sort((a, b) => {
      const positiveDiff = getPositiveReactions(b) - getPositiveReactions(a);
      if (positiveDiff !== 0) return positiveDiff;
      return getTotalReactions(b) - getTotalReactions(a);
    })[0] || null;
  }, [visibleComments]);

  const renderCommentReplies = (replies = []) => {
    return (replies || []).map((reply) => (
        <div key={reply.id} className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reply.author}</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {new Date(reply.createdAt).toLocaleString()}
                {reply.editedAt ? " (editado)" : ""}
              </p>
              <button
                type="button"
                onClick={() => setReplyTo(reply.id)}
                className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
              >
                Responder
              </button>
              <button
                type="button"
                onMouseDown={() => startReactionHold(`reply_${reply.id}`)}
                onMouseUp={clearReactionHoldTimer}
                onMouseLeave={clearReactionHoldTimer}
                onTouchStart={() => startReactionHold(`reply_${reply.id}`)}
                onTouchEnd={clearReactionHoldTimer}
                onTouchCancel={clearReactionHoldTimer}
                onClick={(e) => e.preventDefault()}
                className="h-7 w-7 rounded-full border border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center justify-center"
                aria-label="Reagir à resposta"
                title="Segure para reagir"
              >
                🙂
              </button>
              {openReactionPickerId === `reply_${reply.id}` && (
                <div className="flex flex-wrap items-center gap-1">
                  {reactions.map((reaction) => {
                    const animKey = `${reply.id}__${reaction.key}`;
                    const isAnimated = animatedReactionKey === animKey;
                    return (
                      <button
                        key={reaction.key}
                        type="button"
                        onClick={() => handleReact(reply.id, reaction.key)}
                        className={`flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-transform ${isAnimated ? "reaction-burst" : ""}`}
                        aria-label={`Reagir com ${reaction.label}`}
                      >
                        <span className="text-base">{reaction.label}</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                          {reply.reactions?.[reaction.key] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {canManageContent(reply) && (
                <>
                  <button
                    type="button"
                    onClick={() => startEditingItem(reply)}
                    className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteItem(reply)}
                    className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                  >
                    Apagar ({getRemainingManageTimeLabel(reply)})
                  </button>
                </>
              )}
              {!isOwnedByCurrentUser(reply) && (
                <button
                  type="button"
                  onClick={() =>
                    reportTarget({
                      targetId: reply.id,
                      targetType: "reply",
                      author: reply.author,
                      text: reply.text,
                    })
                  }
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                >
                  Denunciar conteúdo
                </button>
              )}
              {!isOwnedByCurrentUser(reply) && (
                <button
                  type="button"
                  onClick={() =>
                    reportTarget({
                      targetId: `user_${getAuthorBlockKey(reply.author)}`,
                      targetType: "user",
                      author: reply.author,
                      text: "",
                    })
                  }
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                >
                  Denunciar usuário
                </button>
              )}
            </div>
          </div>
          {editingTargetId === reply.id ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="w-full p-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => saveEditedItem(reply)}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Salvar edição
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">{reply.text}</p>
          )}

          {replyTo === reply.id && (
            <div className="mt-3 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escreva sua resposta..."
                className="w-full p-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyText("");
                  }}
                  className="px-3 py-1 text-sm font-semibold text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleReply(reply.id)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  Enviar
                </button>
              </div>
            </div>
          )}

          {Array.isArray(reply.replies) && reply.replies.length > 0 && (
            <div className="mt-3 ml-3 space-y-3 border-l-2 border-blue-100 dark:border-slate-700 pl-3">
              {renderCommentReplies(reply.replies)}
            </div>
          )}
        </div>
      ));
  };


  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-blue-100 max-w-lg text-center">
          <h1 className="text-2xl font-bold text-blue-800 dark:text-slate-100 mb-4">Empresa não encontrada</h1>
          <p className="text-sm text-slate-600 mb-6">
            Não foi possível localizar a empresa informada. Volte à página inicial e selecione outra empresa.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Voltar para início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      {/* ═══ LINHA 2 — Logo empresa + nome ═══ */}
      <div className="w-full bg-white/80 dark:bg-slate-800/70 border-b border-blue-100 dark:border-slate-700">
        <div className="max-w-5xl mx-auto flex items-center gap-4 px-4 py-4">
          {/* Esquerda: logo + nome + setor + localização */}
          <div className="flex items-center gap-4 min-w-0">
            {companyLogo && (
              <div className="w-14 h-14 rounded-2xl overflow-hidden border border-blue-200 dark:border-slate-600 bg-white flex-shrink-0">
                <img
                  src={companyLogo}
                  alt={`Logo ${company.company}`}
                  className="w-full h-full object-contain p-1"
                  onError={() => {
                    if (logoIndex < logoCandidates.length - 1) {
                      setLogoIndex((prev) => prev + 1);
                    }
                  }}
                />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold text-blue-800 dark:text-slate-100 leading-tight truncate">{company.company}</h1>
              {companyInfo?.sector && companyInfo.sector !== "Não identificado automaticamente" && (
                <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{companyInfo.sector}</p>
              )}
              {companyInfo?.location && companyInfo.location !== "Não identificado automaticamente" && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{companyInfo.location}</p>
              )}
            </div>
          </div>

            </div>
          </div>
        </div>
      </div>

      {/* ═══ LINHA 3 — Banner Premium (só p/ não-premium e não-admin) ═══ */}
      {!userIsPremium && !isAdmin() && (
        <div className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 dark:from-amber-800 dark:to-yellow-700">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold text-white">
              Desbloqueie análises completas com o <span className="font-bold">Plano Premium</span>
            </p>
            <button
              type="button"
              onClick={() => navigate("/escolha-perfil")}
              className="shrink-0 px-4 py-1.5 text-sm font-bold text-amber-800 bg-white rounded-lg hover:bg-amber-50 transition"
            >
              Saiba mais
            </button>
          </div>
        </div>
      )}

      {/* ═══ LINHA 4 — Botão Ver Avaliações centralizado ═══ */}
      <div className="w-full bg-blue-50/50 dark:bg-slate-900/50 border-b border-blue-100 dark:border-slate-700">
        <div className="max-w-5xl mx-auto flex justify-center px-4 py-4">
          {(() => {
            const userCommented = comments.some((c) => normalizeKey(c?.author) === normalizeKey(getCurrentPseudonym()));
            if (userCommented) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("secao-comentarios");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition text-sm"
                >
                  Ver minha avaliação
                </button>
              );
            }
            return (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("secao-comentarios");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition text-sm"
              >
                Avaliar esta empresa
              </button>
            );
          })()}
        </div>
      </div>

      {/* ═══ Conteúdo principal ═══ */}
      <div className="flex-1 px-4 pt-6 pb-10">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div>
              <p className={`text-lg font-bold ${getScoreColor(average)}`}>
                {average === "--" ? "--" : `${average} / 5`}
              </p>
              <p className="text-xs text-gray-500">{evaluationCount} avaliação{evaluationCount === 1 ? "" : "es"}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={openLinkedInJobs}
              className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
            >
              Ver vagas no LinkedIn
            </button>
            {hasAverageScore && (
              <div
                className={`px-4 py-2 rounded-xl border font-bold text-sm flex flex-col items-center justify-center leading-tight ${
                  isRecommendedCompany
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <span className="text-xl" aria-hidden="true">{isRecommendedCompany ? "✓" : "X"}</span>
                <span>{isRecommendedCompany ? "Empresa indicada" : "Empresa não indicada"}</span>
              </div>
            )}
          </div>
        </div>

        {userHasResumeProof && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-emerald-800 font-bold">
              Experiência comprovada: esta empresa aparece no currículo carregado pelo profissional.
            </p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {scoreFields.map((field) => {
            const value = companyReviewCount > 0
              ? companyAverages[field.key]
              : company[field.key];
            if (typeof value !== "number" || value <= 0) return null;
            return (
              <div key={field.key} className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-100">{field.label}</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(value)}`}>
                    {value.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`${getScoreColor(value)} h-full rounded-full`}
                    style={{ width: `${Math.min(100, (value / 5) * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/empresa/comentarios-item?name=${encodeURIComponent(company.company)}&item=${field.key}`)}
                  className="mt-3 text-xs font-medium text-[#1a237e] dark:text-blue-300 hover:text-blue-900 dark:hover:text-white hover:underline focus:underline transition-colors"
                >
                  Ver comentários deste item ({itemCommentCounts[field.key] || 0})
                </button>
              </div>
            );
          })}
        </div>

        <div className="clear-both" />

        {/* ── DASHBOARD PREMIUM (admin_empresa / is_premium) ── */}
        {userIsPremium ? (
          <div className="mt-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm p-6 border border-indigo-200">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-100 border border-indigo-200 rounded-full px-3 py-1">
                  {userRole === "admin_empresa" ? "Admin Empresa" : "Premium"}
                </span>
                <h2 className="mt-2 text-lg font-bold text-indigo-900">Dashboard Detalhado</h2>
                <p className="text-xs text-indigo-600">
                  Tendência de cada quesito ao longo do tempo com filtro por período.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDashboardVisible((v) => !v)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition"
              >
                {dashboardVisible ? "Fechar Dashboard" : "Abrir Dashboard"}
              </button>
            </div>

            {dashboardVisible && (
              <>
                {/* Filtros de período */}
                <div className="flex flex-wrap gap-3 mb-5 items-end">
                  <div>
                    <label className="text-xs font-semibold text-indigo-700 block mb-1">De</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="p-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-indigo-700 block mb-1">Até</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="p-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchTrend}
                    disabled={trendLoading}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-60"
                  >
                    {trendLoading ? "Buscando..." : "Aplicar filtro"}
                  </button>
                  {(periodStart || periodEnd) && (
                    <button
                      type="button"
                      onClick={() => { setPeriodStart(""); setPeriodEnd(""); }}
                      className="px-3 py-2 text-xs text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Seletor de quesito */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-indigo-700 block mb-1">Quesito em foco</label>
                  <select
                    value={selectedTrendKey}
                    onChange={(e) => setSelectedTrendKey(e.target.value)}
                    className="p-2 border border-indigo-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {scoreFields.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {trendError && (
                  <p className="text-sm text-red-600 mb-3">{trendError}</p>
                )}

                {trendData.length === 0 && !trendLoading && !trendError && (
                  <p className="text-sm text-indigo-500">Nenhum dado encontrado para o período selecionado.</p>
                )}

                {trendData.length > 0 && (() => {
                  const maxVal = Math.max(...trendData.map((d) => d.averages?.[selectedTrendKey] || 0), 1);
                  return (
                    <div className="space-y-2">
                      {trendData.map((row) => {
                        const val = row.averages?.[selectedTrendKey] || 0;
                        const pct = maxVal > 0 ? (val / 5) * 100 : 0;
                        const barColor =
                          val >= 4 ? "bg-emerald-500" :
                          val >= 3 ? "bg-lime-500" :
                          val >= 2 ? "bg-yellow-500" : "bg-red-500";
                        return (
                          <div key={row.month} className="flex items-center gap-3">
                            <span className="text-xs font-mono text-indigo-700 w-16 shrink-0">{row.month}</span>
                            <div className="flex-1 h-4 bg-indigo-100 rounded-full overflow-hidden">
                              <div
                                className={`${barColor} h-full rounded-full transition-all`}
                                style={{ width: `${pct.toFixed(1)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-indigo-800 w-8 text-right">{val.toFixed(1)}</span>
                            <span className="text-xs text-indigo-500">({row.count} av.)</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {trendData.length > 0 && (() => {
                  const last = trendData[trendData.length - 1];
                  return (
                    <div className="mt-6">
                      <p className="text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wide">
                        Médias por quesito — {last.month} ({last.count} avaliações)
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {scoreFields.map((f) => {
                          const v = last.averages?.[f.key] || 0;
                          return (
                            <div key={f.key} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-indigo-100">
                              <span className="text-xs text-slate-700">{f.label}</span>
                              <span className={`text-xs font-bold ${getScoreColor(v)}`}>{v > 0 ? v.toFixed(1) : "—"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        ) : (
          <div className="mt-8 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl p-6 border border-indigo-200 flex items-center gap-4">
            <div className="text-3xl">🔒</div>
            <div>
              <p className="font-bold text-indigo-800 text-sm">Dashboard Detalhado — Premium</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                {userIsLoggedIn
                  ? "Assine o Premium Trabalhador para desbloquear o Dashboard Detalhado."
                  : "Faça login para ver mais."}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-blue-800">Radar de decisão Premium</h2>
              <p className="text-xs text-slate-600">Resumo prático para apoiar sua decisão de candidatura.</p>
            </div>
            {!userIsPremium && (
              <button
                type="button"
                onClick={userIsLoggedIn ? () => handlePremiumUnlock("worker") : () => navigate("/")}
                disabled={userIsLoggedIn && !!checkoutLoadingAudience}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-70"
              >
                {userIsLoggedIn
                  ? (checkoutLoadingAudience === "worker" ? "Abrindo checkout..." : "Assine Premium Trabalhador")
                  : "Faça login para ver mais"}
              </button>
            )}
          </div>

          <div className={userIsPremium ? "" : "pointer-events-none select-none blur-[5px] opacity-80"}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pontos fortes</p>
                <ul className="mt-2 space-y-1 text-sm text-emerald-900">
                  {premiumRadar.strengths.map((item) => (
                    <li key={`strength_${item.key}`}>{item.label}: {item.value.toFixed(1)}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Pontos de atenção</p>
                <ul className="mt-2 space-y-1 text-sm text-rose-900">
                  {premiumRadar.risks.map((item) => (
                    <li key={`risk_${item.key}`}>{item.label}: {item.value.toFixed(1)}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Sinal de tendência</p>
              <p className="mt-1 text-sm text-indigo-900">
                {trendData.length >= 2
                  ? `No período analisado, a métrica de segurança e integridade variou ${premiumRadar.trendDelta >= 0 ? "+" : ""}${premiumRadar.trendDelta.toFixed(2)} ponto(s).`
                  : "Ative o Dashboard Detalhado para capturar tendência mensal e enriquecer este radar."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
          <h2 className="text-lg font-bold text-[#1a237e] dark:text-blue-300 font-azonix tracking-[0.08em] mb-4">Sobre a empresa</h2>
          <div className="bg-blue-50 dark:bg-slate-800 rounded-xl p-4 border border-blue-100 dark:border-slate-700 space-y-3">
            {insightsLoading && (
              <p className="text-sm text-[#1a237e] dark:text-blue-300 font-semibold">Buscando dados automáticos da empresa...</p>
            )}
            <div>
              <p className="text-xs font-semibold text-[#1a237e] dark:text-blue-300 uppercase tracking-wide">Descrição Automática</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{companyInfo?.description}</p>
              {companyInfo?.description?.includes("Não identificado") && (
                <button className="mt-1 text-xs text-blue-600 underline" onClick={() => alert('Sugestão: envie um email para contato@trabalheila.com.br com as informações da empresa!')}>Sugerir informações desta empresa</button>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a237e] dark:text-blue-300 uppercase tracking-wide">Ramo</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{companyInfo?.sector}</p>
              {companyInfo?.sector?.includes("Não identificado") && (
                <button className="mt-1 text-xs text-blue-600 underline" onClick={() => alert('Sugestão: envie um email para contato@trabalheila.com.br com o ramo da empresa!')}>Sugerir informações desta empresa</button>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a237e] dark:text-blue-300 uppercase tracking-wide">Localização</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{companyInfo?.location}</p>
              {companyInfo?.location?.includes("Não identificado") && (
                <button className="mt-1 text-xs text-blue-600 underline" onClick={() => alert('Sugestão: envie um email para contato@trabalheila.com.br com a localização da empresa!')}>Sugerir informações desta empresa</button>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a237e] dark:text-blue-300 uppercase tracking-wide">CNPJ</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{companyInfo?.cnpj}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a237e] dark:text-blue-300 uppercase tracking-wide">Site</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 font-medium break-all">{companyInfo?.website}</p>
              {companyInfo?.website?.includes("Não identificado") && (
                <button className="mt-1 text-xs text-blue-600 underline" onClick={() => alert('Sugestão: envie um email para contato@trabalheila.com.br com o site da empresa!')}>Sugerir informações desta empresa</button>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#1a237e] dark:text-blue-300 uppercase tracking-wide">Redes sociais</p>
              <div className="mt-1 space-y-1">
                {(companyInfo?.socialLinks || []).map((item) => (
                  <div key={item.label}>
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                      {item.label}: {item.value}
                    </p>
                    {item.value?.includes("Não identificado") && (
                      <button className="mt-1 text-xs text-blue-600 underline" onClick={() => alert(`Sugestão: envie um email para contato@trabalheila.com.br com o link do ${item.label}!`)}>Sugerir informações desta empresa</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div id="secao-comentarios" className="mt-8 bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
          <h2 className="text-lg font-bold text-blue-800 font-azonix tracking-[0.08em] mb-4">Comentários</h2>
          <div className="space-y-4">
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Após publicar, você pode editar ou apagar seu comentário/resposta por até 5 minutos.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-700">
                Você trabalhou lá? Quer compartilhar sua experiência? Digite aqui.
              </label>
              <textarea
                value={mandatoryComment}
                onChange={(e) => {
                  setMandatoryComment(e.target.value);
                  if (commentError) setCommentError("");
                }}
                placeholder="Escreva um comentário sobre essa empresa..."
                className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${commentError ? "border-red-400" : "border-gray-200"}`}
                rows={3}
                required
              />
              {commentError && <p className="text-sm text-red-600">{commentError}</p>}

              <button
                type="button"
                onClick={handleAddComment}
                className="self-end px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
              >
                Publicar comentário
              </button>
            </div>

            {moderationInfo && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {moderationInfo}
              </p>
            )}

            {actionNotice && (
              <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                {actionNotice}
              </p>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 font-azonix mb-2">Comentário mais bem avaliado</p>
              {featuredComment ? (
                <>
                  <p className="text-sm text-slate-800 italic whitespace-pre-line">"{featuredComment.text}"</p>
                  <p className="text-xs text-slate-600 text-right mt-3">- {featuredComment.author}</p>
                </>
              ) : (
                <p className="text-sm text-slate-500">--</p>
              )}
            </div>

            {visibleComments.length === 0 ? (
              <p className="text-center text-gray-500">Seja o primeiro a comentar sobre esta empresa.</p>
            ) : (
              [...visibleComments]
                .sort((a, b) => getTotalReactions(b) - getTotalReactions(a))
                .map((comment) => (
                  <div key={comment.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{comment.author}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {new Date(comment.createdAt).toLocaleString()}
                          {comment.editedAt ? " (editado)" : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReplyTo(comment.id)}
                          className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                        >
                          Responder
                        </button>
                        <button
                          type="button"
                          onMouseDown={() => startReactionHold(`comment_${comment.id}`)}
                          onMouseUp={clearReactionHoldTimer}
                          onMouseLeave={clearReactionHoldTimer}
                          onTouchStart={() => startReactionHold(`comment_${comment.id}`)}
                          onTouchEnd={clearReactionHoldTimer}
                          onTouchCancel={clearReactionHoldTimer}
                          onClick={(e) => e.preventDefault()}
                          className="h-7 w-7 rounded-full border border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center justify-center"
                          aria-label="Reagir ao comentário"
                          title="Segure para reagir"
                        >
                          🙂
                        </button>
                        {openReactionPickerId === `comment_${comment.id}` && (
                          <div className="flex flex-wrap items-center gap-1">
                            {reactions.map((reaction) => {
                              const animKey = `${comment.id}__${reaction.key}`;
                              const isAnimated = animatedReactionKey === animKey;
                              return (
                                <button
                                  key={reaction.key}
                                  type="button"
                                  onClick={() => handleReact(comment.id, reaction.key)}
                                  className={`flex items-center gap-1 px-2 py-1 border border-gray-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 transition-transform ${isAnimated ? "reaction-burst" : ""}`}
                                  aria-label={`Reagir com ${reaction.label}`}
                                >
                                  <span className="text-base">{reaction.label}</span>
                                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                                    {comment.reactions?.[reaction.key] || 0}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {canManageContent(comment) && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingItem(comment)}
                              className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItem(comment)}
                              className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                            >
                              Apagar ({getRemainingManageTimeLabel(comment)})
                            </button>
                          </>
                        )}
                        {!isOwnedByCurrentUser(comment) && (
                          <button
                            type="button"
                            onClick={() =>
                              reportTarget({
                                targetId: comment.id,
                                targetType: "comment",
                                author: comment.author,
                                text: comment.text,
                              })
                            }
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                          >
                            Denunciar conteúdo
                          </button>
                        )}
                        {!isOwnedByCurrentUser(comment) && (
                          <button
                            type="button"
                            onClick={() =>
                              reportTarget({
                                targetId: `user_${getAuthorBlockKey(comment.author)}`,
                                targetType: "user",
                                author: comment.author,
                                text: "",
                              })
                            }
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:underline"
                          >
                            Denunciar usuário
                          </button>
                        )}
                      </div>
                    </div>

                    {editingTargetId === comment.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full p-3 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditedItem(comment)}
                            className="px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Salvar edição
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line">{comment.text}</p>
                    )}

                    {replyTo === comment.id && (
                      <div className="mt-3 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-700">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escreva sua resposta..."
                          className="w-full p-2 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo(null);
                              setReplyText("");
                            }}
                            className="px-3 py-1 text-sm font-semibold text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReply(comment.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                          >
                            Enviar
                          </button>
                        </div>
                      </div>
                    )}

                    {comment.replies?.length > 0 && (
                      <div className="mt-4 space-y-3">{renderCommentReplies(comment.replies)}</div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
      </div>{/* /px-4 pt-6 */}

    </div>
  );
}

export default CompanyDetails;
