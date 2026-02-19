import React, { useEffect, useMemo, useState } from "react";
import TrabalheiLaMobile from "./TrabalheiLaMobile";
import TrabalheiLaDesktop from "./TrabalheiLaDesktop";
import * as featuredModule from "./data/featuredCompanies";
import useIsMobile from "./hooks/useIsMobile"; // Importe o novo hook
import { FaMedal } from "react-icons/fa"; // Acessibilidade: Importe FaMedal AQUI, onde é usado por getMedalEmoji

const featuredSeed = featuredModule.featuredCompanies ?? featuredModule.default ?? [];

function normalizeCompanyName(item) {
  if (typeof item === "string") return item.trim();

  if (item && typeof item === "object") {
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
  const isMobile = useIsMobile(768); // Use o hook aqui!

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
  const [commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca] = useState("");
  const [commentPlanoCarreiras, setCommentPlanoCarreiras] = useState("");
  const [commentBemestar, setCommentBemestar] = useState("");
  const [commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao] = useState("");

  const [comment, setComment] = useState("");

  const [empresas, setEmpresas] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Simulação de carregamento de dados e autenticação
    const loadData = async () => {
      setIsLoading(true);
      // Aqui você faria a chamada real para sua API ou Firebase
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simula delay
      setEmpresas([
        {
          company: "Tech Solutions",
          area: "Desenvolvimento",
          periodo: "2020-2023",
          rating: 4,
          contatoRH: 3,
          salarioBeneficios: 4,
          estruturaEmpresa: 5,
          acessibilidadeLideranca: 4,
          planoCarreiras: 3,
          bemestar: 5,
          estimulacaoOrganizacao: 4,
          comment: "Ótima empresa para desenvolvimento de carreira.",
        },
        {
          company: "Global Innovate",
          area: "Marketing",
          periodo: "2021-2024",
          rating: 5,
          contatoRH: 5,
          salarioBeneficios: 4,
          estruturaEmpresa: 4,
          acessibilidadeLideranca: 5,
          planoCarreiras: 4,
          bemestar: 4,
          estimulacaoOrganizacao: 5,
          comment: "Ambiente dinâmico e inovador, com bom suporte.",
        },
        {
          company: "Creative Minds",
          area: "Design",
          periodo: "2019-2022",
          rating: 3,
          contatoRH: 2,
          salarioBeneficios: 3,
          estruturaEmpresa: 3,
          acessibilidadeLideranca: 3,
          planoCarreiras: 2,
          bemestar: 3,
          estimulacaoOrganizacao: 3,
          comment: "Cultura um pouco rígida, mas com projetos interessantes.",
        },
        {
          company: "Future Systems",
          area: "TI",
          periodo: "2022-2025",
          rating: 4,
          contatoRH: 4,
          salarioBeneficios: 4,
          estruturaEmpresa: 4,
          acessibilidadeLideranca: 4,
          planoCarreiras: 4,
          bemestar: 4,
          estimulacaoOrganizacao: 4,
          comment: "Equipe colaborativa e boa infraestrutura.",
        },
        {
          company: "Digital Dreams",
          area: "Vendas",
          periodo: "2020-2023",
          rating: 3,
          contatoRH: 3,
          salarioBeneficios: 3,
          estruturaEmpresa: 3,
          acessibilidadeLideranca: 3,
          planoCarreiras: 3,
          bemestar: 3,
          estimulacaoOrganizacao: 3,
          comment: "Metas desafiadoras, mas com bom reconhecimento.",
        },
      ]);
      setIsAuthenticated(true); // Simula que o usuário está autenticado
      setIsLoading(false);
    };
    loadData();
  }, []);

  const companyOptions = useMemo(() => {
    const allCompanies = uniqueStrings([
      ...featuredSeed.map(normalizeCompanyName),
      ...empresas.map((e) => normalizeCompanyName(e.company)),
    ]);
    return allCompanies.map((c) => ({ value: c, label: c }));
  }, [empresas]);

  const getMedalColor = (idx) => {
    if (idx === 0) return "from-yellow-400 to-yellow-600"; // Ouro
    if (idx === 1) return "from-gray-300 to-gray-500"; // Prata
    return "from-amber-600 to-amber-800"; // Bronze
  };

  const getMedalEmoji = (idx) => {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    return "🥉";
  };

  const getBadgeColor = (score) => {
    if (score >= 4.3) return "bg-emerald-500";
    if (score >= 3.6) return "bg-lime-500";
    if (score >= 2.8) return "bg-yellow-500";
    if (score >= 2.0) return "bg-orange-500";
    return "bg-rose-500";
  };

  const calcularMedia = (empresa) => {
    const scores = [
      empresa.rating,
      empresa.contatoRH,
      empresa.salarioBeneficios,
      empresa.estruturaEmpresa,
      empresa.acessibilidadeLideranca,
      empresa.planoCarreiras,
      empresa.bemestar,
      empresa.estimulacaoOrganizacao,
    ].filter((score) => typeof score === "number" && score > 0);

    if (scores.length === 0) return "N/A";
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return (sum / scores.length).toFixed(1);
  };

  const top3 = useMemo(() => {
    return [...empresas]
      .sort((a, b) => calcularMedia(b) - calcularMedia(a))
      .slice(0, 3);
  }, [empresas, calcularMedia]);

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
    setEmpresas,
    isAuthenticated,
    setIsAuthenticated,
    isLoading,
    companyOptions,
    calcularMedia,
    top3,
    getMedalColor,
    getMedalEmoji,
    getBadgeColor,
  };

  return isMobile ? (
    <TrabalheiLaMobile {...sharedProps} />
  ) : (
    <TrabalheiLaDesktop {...sharedProps} />
  );
}

export default TrabalheiLa;
