// src/components/Worker/FindSpecialistPage.js
//
// Página de busca e filtro de Especialistas para o trabalhador.
// Rota: /trabalhador/encontrar-especialista
//
// Aceita query string para pré-popular filtros:
//   ?especialidade=advogado
//   ?q=horas+extras
//
// Hoje usa dados mockados (MOCK_SPECIALISTS) e, se o Firestore retornar
// apoiadores ativos, mescla os reais com os mocks — permitindo testar a
// interface mesmo sem dados em produção.

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import AppHeader from "../AppHeader";
import { filterOutTestApoiadores } from "../../utils/testAccounts";
import { isPremiumWorker } from "../../utils/rbac";
import { FREE_PLAN_CONSULTATION_PRICE } from "../../data/consultationPricing";

/* ────────────────────────────────────────────────────────────── */
/* Especialidades suportadas (alinhadas ao SPECIALIST_CONFIGS).   */
/* ────────────────────────────────────────────────────────────── */
const SPECIALTY_OPTIONS = [
  { value: "", label: "Todas as especialidades" },
  { value: "advogado", label: "Advogado(a) trabalhista" },
  { value: "consultor_rh", label: "Consultor(a) de RH" },
  { value: "recrutador", label: "Recrutador(a)" },
  { value: "psicologo", label: "Psicólogo(a) organizacional" },
  { value: "medico", label: "Médico(a) do trabalho" },
  { value: "contador", label: "Contador(a)" },
  { value: "engenheiro_seguranca", label: "Engenheiro(a) de segurança" },
  { value: "fisioterapeuta_ocupacional", label: "Fisioterapeuta ocupacional" },
  { value: "outro", label: "Outros" },
];

function normalizeTipo(v) {
  return String(v || "").toLowerCase().trim().replace(/-/g, "_");
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

/* Dados mockados para garantir UX testável sem depender do Firestore. */
const MOCK_SPECIALISTS = [
  {
    id: "mock_adv_001",
    nome: "Dra. Ana Ribeiro",
    tipo: "advogado",
    foto: "",
    bio: "Direito do trabalho com foco em rescisões e horas extras.",
    precoConsulta: 180,
    averageConsultationPrice: 180,
    rating: 4.8,
    totalAvaliacoes: 42,
    isVerified: true,
    planType: "Premium",
    offersFirstConsultationDiscount: false,
    email: "ana.ribeiro@example.com",
    whatsapp: "5511999990001",
  },
  {
    id: "mock_psi_001",
    nome: "Lucas Mendes",
    tipo: "psicologo",
    foto: "",
    bio: "Saúde mental no trabalho, burnout e clima organizacional.",
    precoConsulta: 150,
    averageConsultationPrice: 150,
    rating: 4.6,
    totalAvaliacoes: 31,
    isVerified: true,
    planType: "Premium",
    offersFirstConsultationDiscount: false,
    email: "lucas.mendes@example.com",
    whatsapp: "5511999990002",
  },
  {
    id: "mock_cont_001",
    nome: "Carla Souza",
    tipo: "contador",
    foto: "",
    bio: "Folha de pagamento, eSocial e IR para PJs.",
    precoConsulta: 120,
    averageConsultationPrice: 120,
    rating: 4.4,
    totalAvaliacoes: 18,
    isVerified: false,
    planType: "Essencial",
    offersFirstConsultationDiscount: true,
  },
  {
    id: "mock_med_001",
    nome: "Dr. Paulo Vieira",
    tipo: "medico",
    foto: "",
    bio: "Medicina do trabalho, ASO e exames periódicos.",
    precoConsulta: 220,
    averageConsultationPrice: 220,
    rating: 4.9,
    totalAvaliacoes: 57,
    isVerified: true,
    planType: "Premium",
    offersFirstConsultationDiscount: false,
    email: "paulo.vieira@example.com",
    whatsapp: "5511999990003",
  },
  {
    id: "mock_rh_001",
    nome: "Mariana Alves",
    tipo: "consultor_rh",
    foto: "",
    bio: "Gestão de pessoas, avaliações de desempenho e cargos & salários.",
    precoConsulta: 200,
    averageConsultationPrice: 200,
    rating: 4.3,
    totalAvaliacoes: 12,
    isVerified: false,
    planType: "Essencial",
    offersFirstConsultationDiscount: true,
  },
  {
    id: "mock_rec_001",
    nome: "Rafael Costa",
    tipo: "recrutador",
    foto: "",
    bio: "Recrutamento de tecnologia e operações.",
    precoConsulta: 0,
    averageConsultationPrice: 150,
    rating: 4.1,
    totalAvaliacoes: 9,
    isVerified: false,
    planType: "Essencial",
    offersFirstConsultationDiscount: true,
  },
  {
    id: "mock_eng_001",
    nome: "Eng. Bruno Lima",
    tipo: "engenheiro_seguranca",
    foto: "",
    bio: "PPRA, PCMSO e auditorias de segurança em obras.",
    precoConsulta: 250,
    averageConsultationPrice: 250,
    rating: 4.7,
    totalAvaliacoes: 22,
    isVerified: true,
    planType: "Premium",
    offersFirstConsultationDiscount: false,
    email: "bruno.lima@example.com",
    whatsapp: "5511999990004",
  },
  {
    id: "mock_fis_001",
    nome: "Juliana Pereira",
    tipo: "fisioterapeuta_ocupacional",
    foto: "",
    bio: "Ginástica laboral, ergonomia e reabilitação ocupacional.",
    precoConsulta: 130,
    averageConsultationPrice: 130,
    rating: 4.5,
    totalAvaliacoes: 15,
    isVerified: true,
    planType: "Essencial",
    offersFirstConsultationDiscount: true,
  },
];

const SORT_OPTIONS = [
  { value: "rating", label: "Melhor avaliação" },
  { value: "priceAsc", label: "Menor preço" },
  { value: "priceDesc", label: "Maior preço" },
];

function StarRow({ rating }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <span className="inline-flex gap-0.5" aria-label={`Avaliação ${rating || 0} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= r ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

function SpecialistCard({ specialist, workerIsPremium, onPontualClick }) {
  const tipoLabel =
    SPECIALTY_OPTIONS.find((o) => o.value === normalizeTipo(specialist.tipo))?.label ||
    "Especialista";
  const initials =
    (specialist.nome || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  const planType = specialist.planType === "Premium" ? "Premium" : "Essencial";
  const avgPrice = Number(
    specialist.averageConsultationPrice || specialist.precoConsulta || 0
  );

  let scheduleHint = "";
  if (planType === "Essencial") {
    // Essencial: a consulta pontual tem preço fixo da plataforma — esse valor
    // tem PRIORIDADE sobre qualquer outro preço configurado pelo profissional.
    scheduleHint = `Consulta pontual: R$ ${FREE_PLAN_CONSULTATION_PRICE.chat} (chat) ou R$ ${FREE_PLAN_CONSULTATION_PRICE.video} (videochamada).`;
  } else if (workerIsPremium) {
    scheduleHint =
      planType === "Premium"
        ? "Usa seus créditos / consultas gratuitas Premium."
        : "Pague normalmente ao especialista (sem crédito Premium).";
  } else {
    scheduleHint = "Preço integral; assine o Premium do trabalhador para ganhar créditos.";
  }

  return (
    <article className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 flex flex-col">
      <header className="flex items-start gap-3">
        {specialist.foto ? (
          <img
            src={specialist.foto}
            alt={specialist.nome}
            className="w-14 h-14 rounded-full object-cover bg-slate-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">
              {specialist.nome}
            </h3>
            {specialist.isVerified && (
              <span
                title="Especialista verificado"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                ✓ Verificado
              </span>
            )}
            <span
              title={`Especialista ${planType}`}
              className={[
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                planType === "Premium"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
              ].join(" ")}
            >
              {planType === "Premium" ? "✨ Premium" : "Essencial"}
            </span>
          </div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
            {tipoLabel}
          </p>
          {planType === "Essencial" && (
            <p className="mt-1 inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              ✉️ Consulta pontual: R$ {FREE_PLAN_CONSULTATION_PRICE.chat} chat · R$ {FREE_PLAN_CONSULTATION_PRICE.video} vídeo
            </p>
          )}
        </div>
      </header>

      {specialist.bio && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
          {specialist.bio}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <StarRow rating={specialist.rating} />
          <span className="font-semibold">
            {Number(specialist.rating || 0).toFixed(1)}
          </span>
          <span className="text-slate-400">({specialist.totalAvaliacoes || 0})</span>
        </div>
        {planType === "Essencial" ? (
          // Plano Essencial: a consulta pontual tem preço FIXO da plataforma
          // (independe do valor configurado pelo profissional) — chat R$ 45 /
          // videochamada R$ 75. Exibimos ambas as modalidades no card.
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Consulta pontual
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              R$ {FREE_PLAN_CONSULTATION_PRICE.chat} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">chat</span>
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              R$ {FREE_PLAN_CONSULTATION_PRICE.video} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">vídeo</span>
            </p>
          </div>
        ) : (
          // Plano Premium: usa o valor definido pelo próprio profissional.
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Consulta
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {avgPrice > 0 ? formatBRL(avgPrice) : "Sob consulta"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/apoiadores/perfil/${specialist.id}`}
          className="text-center px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          Ver perfil
        </Link>
        {workerIsPremium ? (
          <Link
            to={`/chat/spec_${encodeURIComponent(specialist.id)}?peer=${encodeURIComponent(
              specialist.nome || "Especialista"
            )}&peerRole=especialista&specialistType=${encodeURIComponent(
              normalizeTipo(specialist.tipo) || "outro"
            )}`}
            className="text-center px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            title="Consulta com acompanhamento contínuo (Premium)"
          >
            💬 Consulta com acompanhamento
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onPontualClick?.(specialist)}
            className="text-center px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            title="Pergunta única, sem histórico nem follow-up"
          >
            ✉️ Consulta pontual
          </button>
        )}
      </div>

      {planType === "Premium" && (specialist.email || specialist.whatsapp) ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {specialist.email ? (
            <a
              href={`mailto:${specialist.email}`}
              className="text-center px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-900/30"
              title="Contato direto por e-mail (exclusivo Premium)"
            >
              📧 E-mail
            </a>
          ) : (
            <span />
          )}
          {specialist.whatsapp ? (
            <a
              href={`https://wa.me/${String(specialist.whatsapp).replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
              title="Contato direto por WhatsApp (exclusivo Premium)"
            >
              📱 WhatsApp
            </a>
          ) : (
            <span />
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
          Contato direto (e-mail/WhatsApp) disponível apenas para especialistas Premium.
        </p>
      )}

      <button
        type="button"
        onClick={() =>
          alert(
            `Agendamento de consulta com ${specialist.nome}.\n${scheduleHint}\n\n(Funcionalidade completa em breve.)`
          )
        }
        className="mt-2 w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
      >
        📅 Agendar consulta
      </button>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-center">
        {scheduleHint}
      </p>
    </article>
  );
}

export default function FindSpecialistPage({ theme, toggleTheme }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filtros
  const [searchText, setSearchText] = useState(searchParams.get("q") || "");
  const [specialty, setSpecialty] = useState(
    normalizeTipo(searchParams.get("especialidade") || "")
  );
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [planTypeFilter, setPlanTypeFilter] = useState(""); // "", "Essencial", "Premium"
  const [sortBy, setSortBy] = useState("rating");

  // Plano do trabalhador. Usa a util centralizada de RBAC (que considera
  // is_premium_worker, role e fallback de apoiador). Aceita também as flags
  // legadas (isWorkerPremium / isPremium / plano="premium").
  const workerIsPremium = useMemo(() => {
    try {
      if (isPremiumWorker()) return true;
      const p = JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
      return (
        p.isWorkerPremium === true ||
        p.isPremium === true ||
        String(p.plano || "").toLowerCase() === "premium"
      );
    } catch {
      return false;
    }
  }, []);

  // Especialista selecionado para "consulta pontual" (fluxo gratuito).
  const [pontualSpecialist, setPontualSpecialist] = useState(null);

  // Dados
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "apoiadores"), where("status", "==", "ativo"))
        );
        if (cancelled) return;
        const list = snap.docs.map((d) => {
          const data = d.data() || {};
          return {
            id: d.id,
            nome: data.nome || data.displayName || "Especialista",
            tipo: normalizeTipo(data.tipo || data.profissao),
            foto: data.foto || data.photoURL || data.avatar || "",
            bio: data.bio || data.descricao || data.about || "",
            precoConsulta:
              Number(data.precoConsulta || data.preco || 0) || 0,
            rating: Number(data.rating || 0) || 0,
            totalAvaliacoes: Number(data.totalAvaliacoes || 0) || 0,
            isVerified: Boolean(
              data.isVerified || data.verified || data.verificado
            ),
            planType:
              String(data.plano || data.planType || "").toLowerCase() === "premium"
                ? "Premium"
                : "Essencial",
            offersFirstConsultationDiscount: Boolean(
              data.offersFirstConsultationDiscount
            ),
            averageConsultationPrice: Number(
              data.averageConsultationPrice || data.precoConsulta || 0
            ),
            isTest: data.isTest === true,
            email: data.email || "",
            whatsapp: data.whatsapp || data.telefone || "",
          };
        });
        setRemote(filterOutTestApoiadores(list));
      } catch (err) {
        console.warn("Falha ao carregar apoiadores:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mescla mocks + reais. IDs únicos: real prevalece sobre mock de mesmo id.
  const allSpecialists = useMemo(() => {
    const map = new Map();
    MOCK_SPECIALISTS.forEach((s) => map.set(s.id, s));
    remote.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [remote]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    let list = allSpecialists.filter((s) => {
      if (specialty && normalizeTipo(s.tipo) !== specialty) return false;
      if (verifiedOnly && !s.isVerified) return false;
      if (planTypeFilter && (s.planType || "Essencial") !== planTypeFilter) return false;
      if (minRating && (s.rating || 0) < Number(minRating)) return false;
      const price = Number(s.precoConsulta || 0);
      if (minPrice !== "" && price < Number(minPrice)) return false;
      if (maxPrice !== "" && price > Number(maxPrice)) return false;
      if (q) {
        const hay = `${s.nome || ""} ${s.bio || ""} ${
          SPECIALTY_OPTIONS.find((o) => o.value === normalizeTipo(s.tipo))?.label || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "priceAsc") {
        return (a.precoConsulta || 0) - (b.precoConsulta || 0);
      }
      if (sortBy === "priceDesc") {
        return (b.precoConsulta || 0) - (a.precoConsulta || 0);
      }
      // rating
      return (b.rating || 0) - (a.rating || 0);
    });

    return list;
  }, [allSpecialists, searchText, specialty, verifiedOnly, planTypeFilter, minRating, minPrice, maxPrice, sortBy]);

  const handleClearFilters = () => {
    setSearchText("");
    setSpecialty("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating(0);
    setVerifiedOnly(false);
    setPlanTypeFilter("");
    setSortBy("rating");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Encontre um especialista" />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5">
        {/* Tour guiado para Especialistas do Plano Gratuito */}
        {searchParams.get("tour") === "1" && (
          <div className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
              Modo Tour · Você está visualizando como um cliente
            </p>
            <h2 className="mt-1 text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100">
              É assim que os trabalhadores encontram especialistas
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              Use os filtros abaixo, explore os perfis e veja como um cliente
              chegaria até você. Com um plano pago, você passa a aparecer
              destacado e pode receber e responder solicitações.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/especialista/beneficios")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition"
              >
                Ver planos do Especialista
              </button>
              <button
                type="button"
                onClick={() => navigate("/apoiador/requisicoes")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                Voltar ao meu painel
              </button>
            </div>
          </div>
        )}

        <header className="text-center">
          <p className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
            Diretório de especialistas
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            De quem você precisa de ajuda?
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            {workerIsPremium ? (
              <>
                Escolha a especialidade abaixo, selecione o profissional e
                inicie uma <strong>consulta com acompanhamento</strong> contínuo.
              </>
            ) : (
              <>
                Selecione uma especialidade para ver os profissionais
                disponíveis para uma <strong>consulta pontual</strong> (uma
                pergunta, sem histórico).{" "}
                <span className="text-blue-700 dark:text-blue-300 font-semibold">
                  Para uma consulta com acompanhamento é necessário o plano
                  Premium.
                </span>
              </>
            )}
          </p>
        </header>

        {!workerIsPremium && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-amber-700 dark:text-amber-300">
                Plano Gratuito
              </p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                Para consulta com acompanhamento e escolha de profissional,
                assine o <strong>Plano Premium</strong> (R$ 29,90/mês).
              </p>
            </div>
            <Link
              to="/trabalhador/beneficios"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition"
            >
              ✨ Assinar Premium
            </Link>
          </div>
        )}

        {/* Painel de filtros */}
        <section
          aria-label="Filtros"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-4 sm:p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="fsp-q" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Busca
              </label>
              <input
                id="fsp-q"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Nome, especialidade ou área de atuação"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="fsp-tipo" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Especialidade
              </label>
              <select
                id="fsp-tipo"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              >
                {SPECIALTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {workerIsPremium && (
              <>
            <div>
              <label htmlFor="fsp-rating" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Avaliação mínima
              </label>
              <select
                id="fsp-rating"
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value={0}>Qualquer avaliação</option>
                <option value={3}>3+ estrelas</option>
                <option value={4}>4+ estrelas</option>
                <option value={4.5}>4,5+ estrelas</option>
              </select>
            </div>

            <div>
              <label htmlFor="fsp-plan" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Tipo de especialista
              </label>
              <select
                id="fsp-plan"
                value={planTypeFilter}
                onChange={(e) => setPlanTypeFilter(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              >
                <option value="">Todos</option>
                <option value="Essencial">Essencial</option>
                <option value="Premium">Premium</option>
              </select>
            </div>

            <div>
              <label htmlFor="fsp-sort" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Ordenar por
              </label>
              <select
                id="fsp-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="fsp-min" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Preço mínimo (R$)
              </label>
              <input
                id="fsp-min"
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="fsp-max" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Preço máximo (R$)
              </label>
              <input
                id="fsp-max"
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Sem limite"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                Apenas verificados
              </label>
            </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {loading ? "Carregando..." : `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`}
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        {/* CTA destacado de Consulta Avulsa (trabalhador não-Premium) */}
        {!workerIsPremium && (
          <section className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
                Sem assinatura? Sem problema
              </p>
              <h2 className="mt-1 text-base sm:text-lg font-extrabold text-slate-800 dark:text-slate-100">
                Faça uma <span className="text-blue-700 dark:text-blue-300">Consulta Avulsa</span> agora
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Pague apenas pela pergunta que precisa — chat ou vídeo, sem mensalidade.
              </p>
            </div>
            <Link
              to="/consulta-avulsa"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold shadow-lg shadow-blue-600/20 transition transform hover:-translate-y-0.5 whitespace-nowrap"
            >
              ✉️ Consulta Avulsa
            </Link>
          </section>
        )}

        {/* Resultados */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Nenhum especialista encontrado com os filtros atuais.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-3 inline-flex px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <SpecialistCard
                key={s.id}
                specialist={s}
                workerIsPremium={workerIsPremium}
                onPontualClick={setPontualSpecialist}
              />
            ))}
          </section>
        )}

        <div className="text-center pt-2 flex flex-col items-center gap-2">
          {!workerIsPremium && (
            <>
              <Link
                to="/consulta-avulsa"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold shadow-lg shadow-blue-600/20 transition transform hover:-translate-y-0.5"
              >
                ✉️ Iniciar consulta avulsa
              </Link>
              <Link
                to="/trabalhador/beneficios"
                className="text-sm font-bold text-blue-700 dark:text-blue-300 hover:underline"
              >
                ✨ Conheça o Plano Premium do trabalhador
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>
      </main>

      {pontualSpecialist && (
        <PontualConsultationModal
          specialist={pontualSpecialist}
          onClose={() => setPontualSpecialist(null)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Modal de "Consulta Pontual" (fluxo gratuito).                  */
/* Pergunta única, sem histórico, sem follow-up. Ao final, exibe  */
/* CTA para o Plano Premium (acompanhamento).                     */
/* ────────────────────────────────────────────────────────────── */
function PontualConsultationModal({ specialist, onClose }) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const MAX = 600;

  const send = () => {
    const text = question.trim();
    if (!text) return;
    // Persistência simples local — o backend real de mensagem pontual
    // pode ser plugado aqui (ex.: api/send-contact-request).
    try {
      const key = `pontualConsults:${specialist.id}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push({ at: Date.now(), question: text });
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* silencioso */
    }
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {!submitted ? (
          <>
            <p className="text-[11px] uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
              Consulta Pontual · Plano Gratuito
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-800 dark:text-slate-100">
              Pergunta única para {specialist.nome}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Você pode enviar <strong>uma pergunta</strong>. Não há histórico
              nem follow-up. Para acompanhamento contínuo e escolha de
              profissional, assine o Plano Premium.
            </p>
            <label htmlFor="pontual-q" className="sr-only">
              Sua pergunta
            </label>
            <textarea
              id="pontual-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX))}
              placeholder="Descreva sua dúvida em poucas linhas..."
              rows={5}
              className="mt-3 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-right">
              {question.length}/{MAX}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={send}
                disabled={!question.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
              >
                Enviar pergunta
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
              ✅ Pergunta enviada
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Sua pergunta foi enviada a {specialist.nome}. Como você está no
              plano Gratuito, esta é uma <strong>interação única</strong> —
              não haverá histórico ou follow-up.
            </p>
            <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Para consulta com acompanhamento e escolha de profissional,
                assine o <strong>Plano Premium</strong> (R$ 29,90/mês).
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/trabalhador/beneficios");
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold"
              >
                ✨ Assinar Premium
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
