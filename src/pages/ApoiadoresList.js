import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import PlanosApoiador from "../components/PlanosApoiador";

const TIPO_LABELS = { consultor: "Consultor de RH", advogado: "Advogado Trabalhista", prestador: "Prestador de Serviços" };
const TIPO_COLORS = {
  consultor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  advogado: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  prestador: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
};

const NICHOS = ["Recrutamento", "Direito trabalhista", "Saúde ocupacional", "Tecnologia", "Benefícios corporativos", "Treinamento", "Outros"];
const STARS = [1, 2, 3, 4, 5];

function StarDisplay({ rating, size = "w-4 h-4" }) {
  return (
    <span className="inline-flex gap-0.5">
      {STARS.map((s) => (
        <svg key={s} className={`${size} ${s <= Math.round(rating) ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

function ApoiadoresList({ theme, toggleTheme }) {
  const [apoiadores, setApoiadores] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Filtros ── */
  const [filterTipo, setFilterTipo] = useState("");
  const [filterNicho, setFilterNicho] = useState("");
  const [filterMinRating, setFilterMinRating] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "apoiadores"), where("status", "==", "ativo")));
        setApoiadores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Erro ao carregar apoiadores:", err);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = apoiadores;
    if (filterTipo) list = list.filter((a) => a.tipo === filterTipo);
    if (filterNicho) {
      list = list.filter((a) => {
        const nichos = a.nichos || a.areas || a.segmentos || [];
        return nichos.includes(filterNicho);
      });
    }
    if (filterMinRating > 0) list = list.filter((a) => (a.rating || 0) >= filterMinRating);

    /* Premium primeiro: com avaliação (rating desc), sem avaliação; depois gratuitos: com avaliação (rating desc), sem avaliação (alfa) */
    const premium = list.filter((a) => a.plano === "premium");
    const premiumRated = premium.filter((a) => (a.totalAvaliacoes || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const premiumUnrated = premium.filter((a) => !(a.totalAvaliacoes > 0)).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    const free = list.filter((a) => a.plano !== "premium");
    const freeRated = free.filter((a) => (a.totalAvaliacoes || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const freeUnrated = free.filter((a) => !(a.totalAvaliacoes > 0)).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    return [...premiumRated, ...premiumUnrated, ...freeRated, ...freeUnrated];
  }, [apoiadores, filterTipo, filterNicho, filterMinRating]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Apoiadores" />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Apoiadores</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Consultores, advogados e prestadores parceiros da plataforma.</p>
          </div>
          <Link to="/apoiadores/cadastro" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition">
            Quero ser Apoiador
          </Link>
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200">
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterNicho} onChange={(e) => setFilterNicho(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200">
            <option value="">Todos os nichos</option>
            {NICHOS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={filterMinRating} onChange={(e) => setFilterMinRating(Number(e.target.value))}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200">
            <option value={0}>Qualquer avaliação</option>
            {STARS.map((s) => <option key={s} value={s}>≥ {s} estrela{s > 1 ? "s" : ""}</option>)}
          </select>
        </div>

        {/* ── Lista ── */}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando apoiadores…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum apoiador encontrado com os filtros selecionados.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((a) => {
              const isPremium = a.plano === "premium";
              return (
                <Link
                  key={a.id}
                  to={`/apoiadores/perfil/${a.id}`}
                  className={`block rounded-2xl p-5 border transition hover:shadow-lg ${
                    isPremium
                      ? "bg-white dark:bg-slate-800 border-2 border-blue-500 dark:border-blue-400 shadow-md"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {a.foto ? (
                      <img src={a.foto} alt={a.nome} className="h-12 w-12 rounded-full object-cover border border-slate-200 dark:border-slate-600 shrink-0" />
                    ) : (
                      <span className="h-12 w-12 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-xl shrink-0">👤</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{a.nome}</h3>
                        {isPremium && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full whitespace-nowrap">
                            ✓ Apoiador Premium Verificado
                          </span>
                        )}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${TIPO_COLORS[a.tipo] || "bg-slate-100 text-slate-600"}`}>
                        {TIPO_LABELS[a.tipo] || a.tipo}
                      </span>
                    </div>
                  </div>

                  {a.especialidade && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{a.especialidade}</p>}
                  {a.descricao && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                      {a.descricao.slice(0, 200)}
                    </p>
                  )}

                  {isPremium && (a.rating > 0 || a.totalAvaliacoes > 0) && (
                    <div className="flex items-center gap-2 mt-3">
                      <StarDisplay rating={a.rating || 0} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {(a.rating || 0).toFixed(1)} ({a.totalAvaliacoes || 0})
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {(a.nichos || a.areas || a.segmentos || []).slice(0, 3).map((n) => (
                      <span key={n} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">{n}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Seção de Planos ── */}
      <PlanosApoiador />
    </div>
  );
}

export default ApoiadoresList;
