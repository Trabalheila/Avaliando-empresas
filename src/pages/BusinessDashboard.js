import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { getUserRole, isPremium, isAdmin } from "../utils/rbac";
import AppHeader from "../components/AppHeader";
import { slugifyCompany, listReviewsByCompanySlug } from "../services/reviews";
import { listCompanies } from "../services/companies";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell,
} from "recharts";

/* ────────────────────────────────────────────────
   Critérios avaliados (mesmos do CompanyDetails)
   ──────────────────────────────────────────────── */
const SCORE_FIELDS = [
  { key: "comunicacao", label: "Recrutamento" },
  { key: "etica", label: "Proposta salarial" },
  { key: "cultura", label: "Cultura" },
  { key: "salario", label: "Pagamento" },
  { key: "lideranca", label: "Liderança" },
  { key: "estimacaoOrganizacao", label: "Condições de trabalho" },
  { key: "ambiente", label: "Respeito" },
  { key: "diversidade", label: "Diversidade" },
  { key: "rating", label: "Segurança" },
  { key: "saudeBemEstar", label: "Bem-estar" },
  { key: "equilibrio", label: "Equilíbrio" },
  { key: "reconhecimento", label: "Reconhecimento" },
  { key: "desenvolvimento", label: "Plano de carreira" },
];

const BENCHMARK_FIELDS = ["cultura", "lideranca", "salario", "equilibrio"];

const PERIOD_OPTIONS = [
  { label: "30 dias", days: 30 },
  { label: "60 dias", days: 60 },
  { label: "90 dias", days: 90 },
];

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */
function toMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function avgField(reviews, key) {
  const values = reviews
    .map((r) => parseFloat(r?.[key]))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function generalAvg(reviews) {
  const allKeys = SCORE_FIELDS.map((f) => f.key);
  const averages = allKeys.map((k) => avgField(reviews, k)).filter((v) => v !== null);
  if (averages.length === 0) return null;
  return averages.reduce((a, b) => a + b, 0) / averages.length;
}

function filterByDays(reviews, days) {
  const cutoff = Date.now() - days * 86400000;
  return reviews.filter((r) => toMs(r?.createdAt) >= cutoff);
}

function getMyCompanySlug() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const companyName =
      profile?.companyManaged ||
      profile?.verification?.company ||
      "";
    return companyName ? slugifyCompany(companyName) : "";
  } catch {
    return "";
  }
}

function getMyCompanyName() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return (
      profile?.companyManaged ||
      profile?.verification?.company ||
      ""
    );
  } catch {
    return "";
  }
}

/* ════════════════════════════════════════════════
   BusinessDashboard — Painel Exclusivo Empresa
   ════════════════════════════════════════════════ */
function BusinessDashboard({ theme, toggleTheme }) {
  const navigate = useNavigate();

  /* ── Controle de acesso ── */
  const hasAccess = useMemo(() => {
    const role = getUserRole();
    return role === "admin_empresa" || isPremium() || isAdmin();
  }, []);

  useEffect(() => {
    if (!hasAccess) navigate("/escolha-perfil?planos=1", { replace: true });
  }, [hasAccess, navigate]);

  /* ── Estado da empresa do usuário ── */
  const mySlug = useMemo(getMyCompanySlug, []);
  const myCompanyName = useMemo(getMyCompanyName, []);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Estado de benchmarking ── */
  const [companyOptions, setCompanyOptions] = useState([]);
  const [mySegment, setMySegment] = useState("");
  const [competitors, setCompetitors] = useState(["", "", ""]);
  const [competitorReviews, setCompetitorReviews] = useState({});
  const [benchLoading, setBenchLoading] = useState(false);

  /* ── Estado de consultores e serviços ── */
  const [consultores, setConsultores] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [contactModal, setContactModal] = useState(null);

  /* ── Carregar dados iniciais ── */
  useEffect(() => {
    if (!hasAccess) return;

    (async () => {
      setLoading(true);
      try {
        if (mySlug) {
          const data = await listReviewsByCompanySlug(mySlug, 500);
          setReviews(data);
        }
      } catch (err) {
        console.warn("Falha ao carregar avaliações:", err);
      }
      setLoading(false);
    })();

    (async () => {
      try {
        const all = await listCompanies(300);

        const myCompanyRecord = (all || []).find((c) => {
          const itemName = c?.name || c?.company || "";
          const itemSlug = c?.slug || slugifyCompany(itemName);
          return itemSlug === mySlug;
        });
        const currentSegment = (myCompanyRecord?.segmento || "").toString().trim();
        setMySegment(currentSegment);

        setCompanyOptions(
          all
            .map((c) => ({
              slug: c.slug || slugifyCompany(c.name || c.company || ""),
              name: c.name || c.company || c.slug || "",
              segmento: (c.segmento || "").toString().trim(),
            }))
            .filter((c) => {
              if (!c.slug || c.slug === mySlug) return false;
              if (currentSegment && c.segmento !== currentSegment) return false;
              return true;
            })
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
        );
      } catch {
        /* silencioso */
      }
    })();

    /* Firestore: coleção "consultores"
       Para popular, crie documentos com: { nome, especialidade, descricao, email, whatsapp } */
    (async () => {
      try {
        const snap = await getDocs(collection(db, "consultores"));
        setConsultores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch { /* silencioso */ }
    })();

    /* Firestore: coleção "servicosRH"
       Para popular, crie documentos com: { nome, tipo, descricao, email, whatsapp, site } */
    (async () => {
      try {
        const snap = await getDocs(collection(db, "servicosRH"));
        setServicos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch { /* silencioso */ }
    })();
  }, [hasAccess, mySlug]);

  /* ── Benchmark: carregar concorrentes ── */
  const loadCompetitor = useCallback(async (slug) => {
    if (!slug) return;
    if (competitorReviews[slug]) return;
    setBenchLoading(true);
    try {
      const data = await listReviewsByCompanySlug(slug, 500);
      setCompetitorReviews((prev) => ({ ...prev, [slug]: data }));
    } catch {
      /* silencioso */
    }
    setBenchLoading(false);
  }, [competitorReviews]);

  const handleCompetitorChange = useCallback((idx, slug) => {
    setCompetitors((prev) => {
      const next = [...prev];
      next[idx] = slug;
      return next;
    });
    if (slug) loadCompetitor(slug);
  }, [loadCompetitor]);

  /* ── Dados calculados ── */
  const generalScore = generalAvg(reviews);
  const reviewCount = reviews.length;

  const trendData = useMemo(() => {
    return PERIOD_OPTIONS.map((p) => {
      const filtered = filterByDays(reviews, p.days);
      const entry = { period: p.label, count: filtered.length };
      SCORE_FIELDS.forEach((f) => {
        const avg = avgField(filtered, f.key);
        entry[f.key] = avg !== null ? parseFloat(avg.toFixed(2)) : null;
      });
      entry.geral = generalAvg(filtered);
      if (entry.geral !== null) entry.geral = parseFloat(entry.geral.toFixed(2));
      return entry;
    });
  }, [reviews]);

  /* ── Crescimento de quadro (estimativa) ── */
  const staffData = useMemo(() => {
    if (reviews.length === 0) return [];
    const buckets = {};
    reviews.forEach((r) => {
      const ms = toMs(r?.createdAt);
      if (!ms) return;
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });
    const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    let acc = 0;
    return sorted.map(([month, count]) => {
      acc += count;
      return { mes: month, avaliadores: acc };
    });
  }, [reviews]);

  /* ── Guard ── */
  if (!hasAccess) return null;

  /* ════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Painel Empresa" />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* ═══ SEÇÃO 1 — Painel da própria empresa ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-blue-800 dark:text-blue-200 mb-1">
            {myCompanyName || "Sua empresa"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Indicadores baseados em {reviewCount} avaliação{reviewCount === 1 ? "" : "es"} na plataforma.
          </p>

          {loading ? (
            <p className="text-sm text-slate-500">Carregando indicadores…</p>
          ) : reviewCount === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma avaliação encontrada para esta empresa ainda.</p>
          ) : (
            <>
              {/* Nota geral */}
              <div className="mb-6 flex items-center gap-4">
                <div className="px-5 py-3 rounded-2xl bg-blue-600 text-white">
                  <p className="text-3xl font-extrabold">{generalScore !== null ? generalScore.toFixed(1) : "--"}</p>
                  <p className="text-xs opacity-80">Nota geral</p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">baseado em {reviewCount} avaliações</p>
              </div>

              {/* Critérios */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
                {SCORE_FIELDS.map((f) => {
                  const val = avgField(reviews, f.key);
                  const pct = val !== null ? ((val / 5) * 100).toFixed(0) : "--";
                  const sampleCount = reviews.filter((r) => { const v = parseFloat(r?.[f.key]); return Number.isFinite(v) && v > 0; }).length;
                  return (
                    <div key={f.key} className="bg-blue-50 dark:bg-slate-900 rounded-xl p-3 border border-blue-100 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{f.label}</p>
                      <p className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{pct}%</p>
                      <p className="text-[10px] text-slate-400">aprovação · amostra: {sampleCount}</p>
                    </div>
                  );
                })}
              </div>

              {/* Gráfico de evolução */}
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Evolução nos últimos períodos</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="geral" stroke="#2563eb" strokeWidth={2} name="Nota geral" dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="cultura" stroke="#059669" strokeWidth={1.5} name="Cultura" />
                    <Line type="monotone" dataKey="lideranca" stroke="#d97706" strokeWidth={1.5} name="Liderança" />
                    <Line type="monotone" dataKey="equilibrio" stroke="#7c3aed" strokeWidth={1.5} name="Equilíbrio" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Cada ponto representa a média das avaliações no período indicado.</p>
            </>
          )}
        </section>

        {/* ═══ SEÇÃO 2 — Benchmarking com concorrentes ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-blue-800 dark:text-blue-200 mb-1">Benchmarking com concorrentes</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Compare até 3 empresas. Valores de concorrentes são indicativos.</p>
          {mySegment && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
              Lista filtrada por segmento CNAE da sua empresa: <span className="font-bold">{mySegment}</span>
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {competitors.map((slug, idx) => (
              <select
                key={idx}
                value={slug}
                onChange={(e) => handleCompetitorChange(idx, e.target.value)}
                className="w-full p-2 rounded-lg border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200"
              >
                <option value="">Selecionar concorrente {idx + 1}</option>
                {companyOptions.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            ))}
          </div>

          {benchLoading && <p className="text-xs text-slate-500 mb-2">Carregando dados…</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-blue-100 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-200 font-semibold">Critério</th>
                  <th className="py-2 px-3 text-blue-700 dark:text-blue-300 font-bold">{myCompanyName || "Sua empresa"}</th>
                  {competitors.filter(Boolean).map((slug) => {
                    const name = companyOptions.find((c) => c.slug === slug)?.name || slug;
                    return <th key={slug} className="py-2 px-3 text-slate-600 dark:text-slate-300 font-semibold">{name}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Nota geral */}
                <tr className="border-b border-blue-50 dark:border-slate-700">
                  <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">Nota geral</td>
                  <td className="py-2 px-3 text-center font-bold text-blue-700 dark:text-blue-300">{generalScore !== null ? generalScore.toFixed(1) : "--"}</td>
                  {competitors.filter(Boolean).map((slug) => {
                    const cr = competitorReviews[slug] || [];
                    const avg = generalAvg(cr);
                    const low = cr.length < 10;
                    return (
                      <td key={slug} className="py-2 px-3 text-center">
                        <span className="font-semibold">{avg !== null ? avg.toFixed(1) : "--"}</span>
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">indicativo</span>
                        {low && <p className="text-[10px] text-orange-500 mt-0.5">amostra reduzida — dado indicativo</p>}
                      </td>
                    );
                  })}
                </tr>
                {/* Campos de benchmark */}
                {BENCHMARK_FIELDS.map((key) => {
                  const label = SCORE_FIELDS.find((f) => f.key === key)?.label || key;
                  const myVal = avgField(reviews, key);
                  return (
                    <tr key={key} className="border-b border-blue-50 dark:border-slate-700">
                      <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">{label}</td>
                      <td className="py-2 px-3 text-center font-bold text-blue-700 dark:text-blue-300">{myVal !== null ? myVal.toFixed(1) : "--"}</td>
                      {competitors.filter(Boolean).map((slug) => {
                        const cr = competitorReviews[slug] || [];
                        const avg = avgField(cr, key);
                        const low = cr.length < 10;
                        return (
                          <td key={slug} className="py-2 px-3 text-center">
                            <span className="font-semibold">{avg !== null ? avg.toFixed(1) : "--"}</span>
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">indicativo</span>
                            {low && <p className="text-[10px] text-orange-500 mt-0.5">amostra reduzida — dado indicativo</p>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══ SEÇÃO 3 — Crescimento de quadro ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-blue-800 dark:text-blue-200 mb-1">Crescimento de quadro (estimativa)</h2>
          <p className="text-xs text-orange-500 font-semibold mb-4">
            ⚠ Estimativa baseada na quantidade de avaliadores da plataforma — não é um dado oficial da empresa.
          </p>

          {staffData.length === 0 ? (
            <p className="text-sm text-slate-500">Sem dados suficientes para gerar o gráfico.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="avaliadores" name="Avaliadores acumulados" radius={[4, 4, 0, 0]}>
                    {staffData.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? "#2563eb" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* ═══ SEÇÃO 4 — Marketplace de consultores ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-blue-800 dark:text-blue-200 mb-4">Consultores parceiros</h2>

          {consultores.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Em breve — consultores parceiros serão listados aqui.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {consultores.map((c) => (
                <div key={c.id} className="rounded-xl border border-blue-100 dark:border-slate-700 p-4 bg-blue-50 dark:bg-slate-900">
                  <h3 className="font-bold text-blue-800 dark:text-blue-200">{c.nome}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{c.especialidade}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.descricao}</p>
                  <button
                    type="button"
                    onClick={() => setContactModal({ nome: c.nome, email: c.email, whatsapp: c.whatsapp })}
                    className="mt-3 px-4 py-1.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                  >
                    Entrar em contato
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ═══ SEÇÃO 5 — Marketplace de serviços de RH ═══ */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 p-6">
          <h2 className="text-xl font-extrabold text-blue-800 dark:text-blue-200 mb-4">Serviços de RH</h2>

          {servicos.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Em breve — ferramentas e serviços de RH parceiros serão listados aqui.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {servicos.map((s) => (
                <div key={s.id} className="rounded-xl border border-blue-100 dark:border-slate-700 p-4 bg-blue-50 dark:bg-slate-900">
                  <h3 className="font-bold text-blue-800 dark:text-blue-200">{s.nome}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{s.tipo}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{s.descricao}</p>
                  <button
                    type="button"
                    onClick={() => setContactModal({ nome: s.nome, email: s.email, whatsapp: s.whatsapp })}
                    className="mt-3 px-4 py-1.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                  >
                    Entrar em contato
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ═══ Modal de contato ═══ */}
      {contactModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setContactModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-sm w-full border border-blue-100 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-3">Contato — {contactModal.nome}</h3>
            {contactModal.email && (
              <p className="text-sm text-slate-700 dark:text-slate-200 mb-2">
                <span className="font-semibold">E-mail:</span>{" "}
                <a href={`mailto:${contactModal.email}`} className="text-blue-600 underline">{contactModal.email}</a>
              </p>
            )}
            {contactModal.whatsapp && (
              <p className="text-sm text-slate-700 dark:text-slate-200 mb-2">
                <span className="font-semibold">WhatsApp:</span>{" "}
                <a href={`https://wa.me/${contactModal.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-600 underline">{contactModal.whatsapp}</a>
              </p>
            )}
            {!contactModal.email && !contactModal.whatsapp && (
              <p className="text-sm text-slate-500">Informações de contato não disponíveis.</p>
            )}
            <button
              type="button"
              onClick={() => setContactModal(null)}
              className="mt-4 w-full py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BusinessDashboard;
