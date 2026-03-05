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

  const [isAuthenticated, setIsAuthenticated] = useState(false); // Estado para controle de autenticação
  const [user, setUser] = useState(null); // Estado para armazenar dados do usuário

  const [empresas, setEmpresas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const companyOptions = useMemo(() => {
    const allCompanies = uniqueStrings([
      ...featuredSeed.map(normalizeCompanyName),
      ...empresas.map(normalizeCompanyName),
    ]);
    return allCompanies.map((c) => ({ value: c, label: c }));
  }, [empresas]);

  // Funções auxiliares para o ranking (definidas aqui, onde FaMedal é importado)
  const getMedalColor = (idx) => {
    if (idx === 0) return "from-yellow-400 to-yellow-600"; // ouro
    if (idx === 1) return "from-gray-300 to-gray-500"; // prata
    return "from-amber-600 to-amber-800"; // bronze
  };

  const getMedalEmoji = (idx) => {
    if (idx === 0) return "🥇";
    if (idx === 1) return "🥈";
    if (idx === 2) return "🥉";
    return <FaMedal className="text-white" />; // Para posições além do top 3
  };

  const getBadgeColor = (score) => {
    if (score >= 4.5) return "bg-emerald-500";
    if (score >= 3.5) return "bg-lime-500";
    if (score >= 2.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const calcularMedia = (empresa) => {
    const totalRatings =
      empresa.rating +
      empresa.contatoRH +
      empresa.salarioBeneficios +
      empresa.estruturaEmpresa +
      empresa.acessibilidadeLideranca +
      empresa.planoCarreiras +
      empresa.bemestar +
      empresa.estimulacaoOrganizacao;
    const media = totalRatings / 8;
    return media.toFixed(1);
  };

  const top3 = useMemo(() => {
    return [...empresas]
      .sort((a, b) => calcularMedia(b) - calcularMedia(a))
      .slice(0, 3);
  }, [empresas]);

  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Simulação de fetch de dados
        const mockData = [
          {
            company: "Tech Innovators",
            area: "TI",
            periodo: "2020-2023",
            rating: 4.5,
            contatoRH: 4.0,
            salarioBeneficios: 4.2,
            estruturaEmpresa: 4.8,
            acessibilidadeLideranca: 4.7,
            planoCarreiras: 4.5,
            bemestar: 4.6,
            estimulacaoOrganizacao: 4.9,
            comment: "Ótimo ambiente e oportunidades de crescimento.",
          },
          {
            company: "Creative Solutions",
            area: "Marketing",
            periodo: "2019-2022",
            rating: 3.8,
            contatoRH: 3.5,
            salarioBeneficios: 3.9,
            estruturaEmpresa: 4.0,
            acessibilidadeLideranca: 3.7,
            planoCarreiras: 3.8,
            bemestar: 3.6,
            estimulacaoOrganizacao: 3.9,
            comment: "Cultura inovadora, mas com desafios de comunicação.",
          },
          {
            company: "Global Corp",
            area: "Finanças",
            periodo: "2021-2024",
            rating: 4.9,
            contatoRH: 4.8,
            salarioBeneficios: 4.7,
            estruturaEmpresa: 4.9,
            acessibilidadeLideranca: 4.9,
            planoCarreiras: 4.8,
            bemestar: 4.9,
            estimulacaoOrganizacao: 4.9,
            comment: "Lugar excelente para desenvolver carreira e ter bons benefícios.",
          },
          {
            company: "Startup X",
            area: "Desenvolvimento",
            periodo: "2022-2024",
            rating: 3.2,
            contatoRH: 3.0,
            salarioBeneficios: 3.1,
            estruturaEmpresa: 3.3,
            acessibilidadeLideranca: 3.0,
            planoCarreiras: 3.2,
            bemestar: 3.1,
            estimulacaoOrganizacao: 3.0,
            comment: "Ambiente dinâmico, mas com alta pressão e pouca estrutura.",
          },
          {
            company: "Consultoria Ágil",
            area: "Consultoria",
            periodo: "2018-2021",
            rating: 4.1,
            contatoRH: 4.2,
            salarioBeneficios: 4.0,
            estruturaEmpresa: 4.1,
            acessibilidadeLideranca: 4.0,
            planoCarreiras: 4.2,
            bemestar: 4.1,
            estimulacaoOrganizacao: 4.0,
            comment: "Boa empresa para aprender, mas exige muita dedicação.",
          },
        ];
        setEmpresas(mockData);
      } catch (err) {
        setError("Falha ao carregar empresas.");
        console.error("Erro ao carregar empresas:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const companyName = company ? company.value : newCompany;

    if (!companyName) {
      setError("Por favor, selecione ou digite o nome da empresa.");
      setIsLoading(false);
      return;
    }

    const newEvaluation = {
      company: companyName,
      area: "Não informado", // Pode ser adicionado um campo para isso
      periodo: "Não informado", // Pode ser adicionado um campo para isso
      rating,
      contatoRH,
      salarioBeneficios,
      estruturaEmpresa,
      acessibilidadeLideranca,
      planoCarreiras,
      bemestar,
      estimulacaoOrganizacao,
      comment: commentRating, // Usando o comentário principal para simplificar
    };

    try {
      // Simulação de envio de dados
      console.log("Avaliação enviada:", newEvaluation);
      setEmpresas((prev) => [...prev, newEvaluation]);
      // Resetar formulário
      setCompany(null);
      setNewCompany("");
      setRating(0);
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
    } catch (err) {
      setError("Falha ao enviar avaliação.");
      console.error("Erro ao enviar avaliação:", err);
    } finally {
      setIsLoading(false);
    }
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
    isAuthenticated,
    setIsAuthenticated,
    user,
    setUser,
    companyOptions,
    handleSubmit,
    isLoading,
    error,
    empresas,
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
