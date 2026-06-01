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

/* Dados mockados para garantir UX testável sem depender do Firestore. */
const MOCK_SPECIALISTS = [
  {
    id: "mock_adv_001",
    nome: "Dra. Ana Ribeiro",
    tipo: "advogado",
    foto: "",
    bio: "Direito do trabalho com foco em rescisões e horas extras.",
    precoConsulta: 180,
    rating: 4.8,
    totalAvaliacoes: 42,
    isVerified: true,
  },
  {
    id: "mock_psi_001",
    nome: "Lucas Mendes",
    tipo: "psicologo",
    foto: "",
    bio: "Saúde mental no trabalho, burnout e clima organizacional.",
    precoConsulta: 150,
    rating: 4.6,
    totalAvaliacoes: 31,
    isVerified: true,
  },
  {
    id: "mock_cont_001",
    nome: "Carla Souza",
    tipo: "contador",
    foto: "",
    bio: "Folha de pagamento, eSocial e IR para PJs.",
    precoConsulta: 120,
    rating: 4.4,
    totalAvaliacoes: 18,
    isVerified: false,
  },
  {
    id: "mock_med_001",
    nome: "Dr. Paulo Vieira",
    tipo: "medico",
    foto: "",
    bio: "Medicina do trabalho, ASO e exames periódicos.",
    precoConsulta: 220,
    rating: 4.9,
    totalAvaliacoes: 57,
    isVerified: true,
  },
  {
    id: "mock_rh_001",
    nome: "Mariana Alves",
    tipo: "consultor_rh",
    foto: "",
    bio: "Gestão de pessoas, avaliações de desempenho e cargos & salários.",
    precoConsulta: 200,
    rating: 4.3,
    totalAvaliacoes: 12,
    isVerified: false,
  },
  {
    id: "mock_rec_001",
    nome: "Rafael Costa",
    tipo: "recrutador",
    foto: "",
    bio: "Recrutamento de tecnologia e operações.",
    precoConsulta: 0,
    rating: 4.1,
    totalAvaliacoes: 9,
    isVerified: false,
  },
  {
    id: "mock_eng_001",
    nome: "Eng. Bruno Lima",
    tipo: "engenheiro_seguranca",
    foto: "",
    bio: "PPRA, PCMSO e auditorias de segurança em obras.",
    precoConsulta: 250,
    rating: 4.7,
    totalAvaliacoes: 22,
    isVerified: true,
  },
  {
    id: "mock_fis_001",
    nome: "Juliana Pereira",
    tipo: "fisioterapeuta_ocupacional",
    foto: "",
    bio: "Ginástica laboral, ergonomia e reabilitação ocupacional.",
    precoConsulta: 130,
    rating: 4.5,
    totalAvaliacoes: 15,
    isVerified: true,
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

function SpecialistCard({ specialist }) {
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
          </div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
            {tipoLabel}
          </p>
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
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {specialist.precoConsulta > 0
            ? `R$ ${Number(specialist.precoConsulta).toFixed(0)}`
            : "Sob consulta"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/apoiadores/perfil/${specialist.id}`}
          className="text-center px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          Ver perfil
        </Link>
        <Link
          to={`/chat/spec_${encodeURIComponent(specialist.id)}?peer=${encodeURIComponent(
            specialist.nome || "Especialista"
          )}&peerRole=especialista&specialistType=${encodeURIComponent(
            normalizeTipo(specialist.tipo) || "outro"
          )}`}
          className="text-center px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
        >
          💬 Iniciar conversa
        </Link>
      </div>
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
  const [sortBy, setSortBy] = useState("rating");

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
            isTest: data.isTest === true,
            email: data.email || "",
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
  }, [allSpecialists, searchText, specialty, verifiedOnly, minRating, minPrice, maxPrice, sortBy]);

  const handleClearFilters = () => {
    setSearchText("");
    setSpecialty("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating(0);
    setVerifiedOnly(false);
    setSortBy("rating");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Encontre um especialista" />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5">
        <header className="text-center">
          <p className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
            Diretório de especialistas
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Encontre o especialista ideal para você
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Busque por nome, especialidade ou área de atuação e filtre por
            preço, avaliação e verificação.
          </p>
        </header>

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
              <SpecialistCard key={s.id} specialist={s} />
            ))}
          </section>
        )}

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>
      </main>
    </div>
  );
}
