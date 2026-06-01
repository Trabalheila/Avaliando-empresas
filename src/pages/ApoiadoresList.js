import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import { getUserRole } from "../utils/rbac";
import { filterOutTestApoiadores } from "../utils/testAccounts";
import { SPECIALTIES_BY_AUDIENCE } from "../data/consultationPricing";

const AD_EXITUM_DISMISS_KEY = "adExitumCardDismissed_v1";

/* Normalização para casar `tipo` (slug ou label) com `name` da profissão. */
function normalizeProfKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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
  const [professions, setProfessions] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Filtros ── */
  const [searchParams] = useSearchParams();
  const userRole = useMemo(() => getUserRole(), []);
  /* Audiência detectada: empresa/admin_empresa → employer; demais → worker. */
  const viewerAudience = useMemo(() => {
    const fromQuery = String(searchParams.get("audience") || "").toLowerCase();
    if (fromQuery === "employer" || fromQuery === "worker") return fromQuery;
    return userRole === "empresa" || userRole === "admin_empresa" ? "employer" : "worker";
  }, [searchParams, userRole]);
  const specialtyOptions = useMemo(
    () => SPECIALTIES_BY_AUDIENCE[viewerAudience] || SPECIALTIES_BY_AUDIENCE.worker,
    [viewerAudience]
  );
  const [filterTipo, setFilterTipo] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [filterNicho, setFilterNicho] = useState("");
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterAdExitum, setFilterAdExitum] = useState(false);
  const [filterPlano, setFilterPlano] = useState(""); // "", "essencial", "premium"
  const [adExitumDismissed, setAdExitumDismissed] = useState(() => {
    try { return window.localStorage.getItem(AD_EXITUM_DISMISS_KEY) === "1"; }
    catch { return false; }
  });

  /* Aceita pré-filtro via query string: ?plano=essencial|premium e ?adExitum=1 */
  useEffect(() => {
    const p = String(searchParams.get("plano") || "").toLowerCase();
    if (p === "essencial" || p === "essential") setFilterPlano("essencial");
    else if (p === "premium") setFilterPlano("premium");
    if (searchParams.get("adExitum") === "1") setFilterAdExitum(true);
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [apSnap, profSnap] = await Promise.all([
          getDocs(query(collection(db, "apoiadores"), where("status", "==", "ativo"))),
          getDocs(collection(db, "professions")),
        ]);
        setApoiadores(
          filterOutTestApoiadores(
            apSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          )
        );
        setProfessions(profSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Erro ao carregar apoiadores:", err);
      }
      setLoading(false);
    })();
  }, []);

  /* Mapa de chave normalizada (tipo/slug ou label) → categoria da profissão. */
  const tipoToCategoria = useMemo(() => {
    const map = new Map();
    professions.forEach((p) => {
      if (!p?.category) return;
      const keyByName = normalizeProfKey(p.name);
      if (keyByName) map.set(keyByName, p.category);
    });
    return map;
  }, [professions]);

  /* Lista única e ordenada de categorias disponíveis. */
  const categoriasDisponiveis = useMemo(() => {
    const set = new Set();
    professions.forEach((p) => {
      const c = String(p?.category || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [professions]);

  /* Resolve a categoria de um apoiador a partir do `categoria` direto ou do mapa. */
  const getCategoriaApoiador = (a) => {
    if (a?.categoria) return String(a.categoria).trim();
    const k = normalizeProfKey(a?.tipo);
    if (k && tipoToCategoria.has(k)) return tipoToCategoria.get(k);
    const k2 = normalizeProfKey(a?.especialidade);
    if (k2 && tipoToCategoria.has(k2)) return tipoToCategoria.get(k2);
    return "";
  };

  const filtered = useMemo(() => {
    let list = apoiadores;
    if (filterTipo) list = list.filter((a) => a.tipo === filterTipo);
    /* Filtra por audiência do solicitante: o apoiador deve atender esse contexto.
       Aceita o campo legado vazio (compatibilidade) ou os campos
       `servesAudiences` (array) e `audiences` (array) com 'worker'/'employer'. */
    list = list.filter((a) => {
      const list1 = Array.isArray(a.servesAudiences) ? a.servesAudiences : [];
      const list2 = Array.isArray(a.audiences) ? a.audiences : [];
      const all = [...list1, ...list2].map((v) => String(v).toLowerCase());
      if (all.length === 0) return true; // sem marcação = compatível com todos
      return all.includes(viewerAudience);
    });
    if (filterCategoria) list = list.filter((a) => getCategoriaApoiador(a) === filterCategoria);
    if (filterNicho) {
      list = list.filter((a) => {
        const nichos = a.nichos || a.areas || a.segmentos || [];
        return nichos.includes(filterNicho);
      });
    }
    if (filterMinRating > 0) list = list.filter((a) => (a.rating || 0) >= filterMinRating);
    if (filterAdExitum) list = list.filter((a) => a.adExitum === true);
    if (filterPlano === "premium") list = list.filter((a) => a.plano === "premium");
    else if (filterPlano === "essencial") {
      list = list.filter((a) => a.plano === "essencial" || a.plano === "essential");
    }

    /* Premium primeiro: com avaliação (rating desc), sem avaliação; depois gratuitos: com avaliação (rating desc), sem avaliação (alfa) */
    const premium = list.filter((a) => a.plano === "premium");
    const premiumRated = premium.filter((a) => (a.totalAvaliacoes || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const premiumUnrated = premium.filter((a) => !(a.totalAvaliacoes > 0)).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    const free = list.filter((a) => a.plano !== "premium");
    const freeRated = free.filter((a) => (a.totalAvaliacoes || 0) > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const freeUnrated = free.filter((a) => !(a.totalAvaliacoes > 0)).sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));

    return [...premiumRated, ...premiumUnrated, ...freeRated, ...freeUnrated];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apoiadores, filterTipo, filterCategoria, filterNicho, filterMinRating, filterAdExitum, filterPlano, viewerAudience, tipoToCategoria]);

  const dismissAdExitumCard = () => {
    setAdExitumDismissed(true);
    try { window.localStorage.setItem(AD_EXITUM_DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Especialistas" />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Especialistas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Consultores, advogados e prestadores parceiros da plataforma.</p>
          </div>
          <Link to="/apoiadores/cadastro" className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition">
            Quero ser Especialista
          </Link>
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200">
            <option value="">{viewerAudience === "employer" ? "Todas as especialidades (empresarial)" : "Todas as especialidades"}</option>
            {specialtyOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}
            disabled={categoriasDisponiveis.length === 0}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50">
            <option value="">Todas as categorias</option>
            {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
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
          <select value={filterPlano} onChange={(e) => setFilterPlano(e.target.value)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200">
            <option value="">Todos os planos</option>
            <option value="essencial">Essencial (preço tabelado)</option>
            <option value="premium">Premium (preço do profissional)</option>
          </select>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={filterAdExitum}
              onChange={(e) => setFilterAdExitum(e.target.checked)}
              className="accent-purple-600"
            />
            Aceita ad exitum
          </label>
        </div>

        {/* ── Card educativo Ad Exitum (dismissível) — apenas trabalhadores ── */}
        {viewerAudience === "worker" && !adExitumDismissed && (
          <div className="rounded-2xl p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 flex items-start gap-3">
            <span className="text-2xl" aria-hidden>⚖️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-purple-800 dark:text-purple-200">
                Você não precisa pagar agora.
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                Ad exitum é o modelo onde o advogado só recebe se ganhar a causa —
                você não paga nada adiantado. Veja quem oferece essa opção.
              </p>
              <button
                type="button"
                onClick={() => setFilterAdExitum(true)}
                className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
              >
                Mostrar apenas quem aceita
              </button>
            </div>
            <button
              type="button"
              onClick={dismissAdExitumCard}
              aria-label="Fechar"
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Lista ── */}
        {loading ? (
          <p className="text-sm text-slate-500">Carregando especialistas…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum especialista encontrado com os filtros selecionados.</p>
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
                            ✓ Especialista Premium Verificado
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
    </div>
  );
}

export default ApoiadoresList;
