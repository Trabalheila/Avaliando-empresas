import React, { useEffect, useMemo, useState } from "react";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import * as featuredModule from "./data/featuredCompanies";

const featuredSeed = featuredModule.featuredCompanies ?? featuredModule.default ?? [];

function normalizeCompanyName(item) {
  if (typeof item === "string") return item.trim();

  if (item && typeof item === "object") {
    // tenta achar um "nome" em formatos comuns
    const candidate =
      item.name ??
      item.company ??
      item.nome ??
      item.label ??
      item.value;

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

function TrabalheiLa() {
  const [company, setCompany] = useState(null);
  const [newCompany, setNewCompany] = useState("");

  const [rating, setRating] = useState(0);
  const [contatoRH, setContatoRH] = useState(0);
  const [salarioBeneficios, setSalarioBeneficios] = useState(0);
  const [estruturaEmpresa, setEstruturaEmpresa] = useState(0);
  const [acessibilidadeLideranca, setAcessibilidadeLideranca] = useState(0);
  const [planoCarreiras, setPlanoCarreiras] = useState(0);
  const [bemestar, setBemestar] = useState(0);
  const [estimulacaoOrganizacao, setEstimulacaoOrganizacao] = useState(0);

  const [commentRating, setCommentRating] = useState("");
  const [commentContatoRH, setCommentContatoRH] = useState("");
  const [commentSalarioBeneficios, setCommentSalarioBeneficios] = useState("");
  const [commentEstruturaEmpresa, setCommentEstruturaEmpresa] = useState("");
  const [commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca] =
    useState("");
  const [commentPlanoCarreiras, setCommentPlanoCarreiras] = useState("");
  const [commentBemestar, setCommentBemestar] = useState("");
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] =
    useState("");

  const [comment, setComment] = useState("");
  const [empresas, setEmpresas] = useState([]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ Companies: featured + custom do localStorage (robusto)
  const [companies, setCompanies] = useState(() => {
    const baseRaw = Array.isArray(featuredSeed) ? featuredSeed : [];
    const base = uniqueStrings(baseRaw.map(normalizeCompanyName));

    // SSR/ambiente sem window
    if (typeof window === "undefined") return base;

    let custom = [];
    try {
      const saved = localStorage.getItem("companies_custom");
      custom = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(custom)) custom = [];
    } catch {
      custom = [];
    }

    const merged = uniqueStrings([...base, ...custom.map((x) => String(x))]);
    return merged;
  });

  // ✅ Detector de tela (mobile <= 1023)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsMobile(mq.matches);

    onChange();

    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    } else {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
  }, []); // listener + cleanup <sources>[1]</sources>

  // ✅ Auth inicial
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("auth_token");
    setIsAuthenticated(Boolean(token));
  }, []);

  // ✅ Mantém auth em sync se localStorage mudar (útil p/ popup/callback real)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e) => {
      if (e.key === "auth_token") {
        setIsAuthenticated(Boolean(e.newValue));
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []); // padrão de event listener com cleanup <sources>[1,9]</sources>

  const companyOptions = useMemo(
    () =>
      (Array.isArray(companies) ? companies : []).map((c) => ({
        label: c,
        value: c,
      })),
    [companies]
  );

  const formatOptionLabel = ({ label }) => (
    <div className="flex items-center gap-2">
      <img
        src={`https://logo.clearbit.com/${label
          .toLowerCase()
          .replace(/\s/g, "")
          .replace(/[^a-z0-9]/g, "")}.com`}
        onError={(e) => {
          e.target.style.display = "none";
        }}
        alt={`logo ${label}`}
        className="w-5 h-5 rounded"
      />
      <span>{label}</span>
    </div>
  );

  const handleAddCompany = () => {
    const name = String(newCompany || "").trim();
    if (!name) return;

    setCompanies((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const next = uniqueStrings([...current, name]);

      // persiste só as custom (as que não estão no featured normalizado)
      const baseRaw = Array.isArray(featuredSeed) ? featuredSeed : [];
      const base = uniqueStrings(baseRaw.map(normalizeCompanyName));
      const customOnly = next.filter(
        (n) => !base.some((b) => b.toLowerCase() === n.toLowerCase())
      );

      try {
        localStorage.setItem("companies_custom", JSON.stringify(customOnly));
      } catch {
        // ignore
      }

      return next;
    });

    setNewCompany("");
    setCompany({ label: name, value: name });
  };

  const handleLinkedInSuccess = async () => {
    setIsLoading(true);
    setTimeout(() => {
      const fakeToken = "token_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("auth_token", fakeToken);
      setIsAuthenticated(true);
      setIsLoading(false);
      alert("Autenticação realizada! Suas avaliações serão anônimas.");
    }, 1500);
  };

  const handleLinkedInFailure = (error) => {
    console.error("Erro no LinkedIn:", error);
    alert("Falha ao conectar com o LinkedIn. Tente novamente.");
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const fakeToken =
        "google_token_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("auth_token", fakeToken);
      setIsAuthenticated(true);
      setIsLoading(false);
      alert("Login com Google realizado! Suas avaliações serão anônimas.");
    }, 1500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      alert("Você precisa fazer login antes de avaliar.");
      return;
    }
    if (!company) {
      alert("Selecione uma empresa antes de enviar.");
      return;
    }

    const novaAvaliacao = {
      company: company.value,
      rating,
      contatoRH,
      salarioBeneficios,
      estruturaEmpresa,
      acessibilidadeLideranca,
      planoCarreiras,
      bemestar,
      estimulacaoOrganizacao,
      comments: {
        rating: commentRating,
        contatoRH: commentContatoRH,
        salarioBeneficios: commentSalarioBeneficios,
        estruturaEmpresa: commentEstruturaEmpresa,
        acessibilidadeLideranca: commentAcessibilidadeLideranca,
        planoCarreiras: commentPlanoCarreiras,
        bemestar: commentBemestar,
        estimulacaoOrganizacao: commentEstimulacaoOrganizacao,
      },
      comment,
      area: "Tecnologia",
      periodo: "2021-2024",
    };

    setEmpresas((prev) => [novaAvaliacao, ...prev]);

    setCompany(null);
    setNewCompany("");
    setRating(0);
    setComment("");
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

    alert("Avaliação enviada com sucesso!");
  };

  // ✅ agora retorna NUMBER (melhor p/ sort e cálculos)
  const calcularMedia = (emp) => {
    const values = [
      emp?.rating,
      emp?.contatoRH,
      emp?.salarioBeneficios,
      emp?.estruturaEmpresa,
      emp?.acessibilidadeLideranca,
      emp?.planoCarreiras,
      emp?.bemestar,
      emp?.estimulacaoOrganizacao,
    ]
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n));

    if (values.length === 0) return 0;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.round(avg * 10) / 10;
  };

  const getBadgeColor = (nota) => {
    const n = Number(nota);
    if (n >= 4.5) return "bg-gradient-to-r from-green-400 to-emerald-500";
    if (n >= 3.5) return "bg-gradient-to-r from-blue-400 to-cyan-500";
    if (n >= 2.5) return "bg-gradient-to-r from-yellow-400 to-orange-500";
    return "bg-gradient-to-r from-red-400 to-pink-500";
  };

  const empresasOrdenadas = useMemo(() => {
    const arr = [...empresas];
    arr.sort((a, b) => calcularMedia(b) - calcularMedia(a));
    return arr;
  }, [empresas]);

  const top3 = empresasOrdenadas.slice(0, 3);

  const getMedalColor = (position) => {
    if (position === 0) return "from-yellow-400 to-yellow-600";
    if (position === 1) return "from-gray-300 to-gray-500";
    if (position === 2) return "from-orange-400 to-orange-600";
    return "from-gray-300 to-gray-500";
  };

  const getMedalEmoji = (position) => {
    if (position === 0) return "🥇";
    if (position === 1) return "🥈";
    if (position === 2) return "🥉";
    return "🏅";
  };

  const sharedProps = {
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
  };

  return isMobile ? (
    <TrabalheiLaMobile {...sharedProps} />
  ) : (
    <TrabalheiLaDesktop {...sharedProps} />
  );
}

export default TrabalheiLa;
