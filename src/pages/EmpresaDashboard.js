import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const PREMIUM_PRICE_LABEL = "R$ 1.499,99/mês";
const PREMIUM_AVAILABLE_AT = "01/08/2026";

// Critérios suportados nas avaliações (mesmos campos usados em Home.js).
const CRITERIA = [
  { key: "rating", label: "Nota geral" },
  { key: "salario", label: "Salário" },
  { key: "beneficios", label: "Benefícios" },
  { key: "cultura", label: "Cultura" },
  { key: "oportunidades", label: "Oportunidades" },
  { key: "lideranca", label: "Liderança" },
  { key: "ambiente", label: "Ambiente" },
  { key: "equilibrio", label: "Equilíbrio vida/trabalho" },
  { key: "reconhecimento", label: "Reconhecimento" },
  { key: "comunicacao", label: "Comunicação" },
  { key: "etica", label: "Ética" },
  { key: "desenvolvimento", label: "Desenvolvimento" },
  { key: "diversidade", label: "Diversidade" },
];

function formatCnpj(value) {
  const v = (value || "").toString().replace(/\D/g, "").slice(0, 14);
  if (v.length !== 14) return value || "—";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function StarRow({ value = 0, size = "h-5 w-5" }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Nota ${v.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`${size} ${v >= i - 0.25 ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
          viewBox="0 0 24 24"
          fill={v >= i - 0.25 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export default function EmpresaDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [peerStats, setPeerStats] = useState(null); // { count, avg }
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    notifyOnReview: true,
    publicProfile: true,
  });

  // Auth ready
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Carrega o documento da empresa do Firestore (sem recadastrar CNPJ).
  const loadCompany = useCallback(async (currentUser) => {
    setLoading(true);
    try {
      let data = null;
      let docId = null;

      // 1) tenta por ownerUid (caso já tenha sido vinculado).
      try {
        const snap = await getDocs(query(collection(db, "companies"), where("ownerUid", "==", currentUser.uid)));
        if (!snap.empty) {
          data = snap.docs[0].data();
          docId = snap.docs[0].id;
        }
      } catch {
        /* segue */
      }

      // 2) fallback por e-mail (que é como o cadastro original grava).
      if (!data && currentUser.email) {
        const snap = await getDocs(query(collection(db, "companies"), where("email", "==", currentUser.email)));
        if (!snap.empty) {
          data = snap.docs[0].data();
          docId = snap.docs[0].id;
        }
      }

      if (data) {
        setCompany({ id: docId, ...data });
        setPrefs((prev) => ({
          notifyOnReview: data?.prefs?.notifyOnReview ?? prev.notifyOnReview,
          publicProfile: data?.prefs?.publicProfile ?? prev.publicProfile,
        }));
      } else {
        setCompany(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadCompany(user);
  }, [authReady, user, loadCompany]);

  // Carrega avaliações da empresa.
  useEffect(() => {
    async function fetchReviews() {
      if (!company) return;
      try {
        const ref = collection(db, "reviews");
        const candidates = [];
        if (company.razaoSocial) {
          candidates.push(query(ref, where("company", "==", company.razaoSocial)));
        }
        if (company.cnpj) {
          candidates.push(query(ref, where("companyCnpj", "==", company.cnpj)));
        }
        const map = new Map();
        for (const q of candidates) {
          try {
            const snap = await getDocs(q);
            snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
          } catch {
            /* segue */
          }
        }
        const list = Array.from(map.values()).sort(
          (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
        );
        setReviews(list);
      } catch (err) {
        console.error("Erro ao carregar avaliações:", err);
      }
    }
    fetchReviews();
  }, [company]);

  // Carrega comparativo do mesmo CNAE (apenas para Premium).
  const isPremium = company?.plan === "premium";

  useEffect(() => {
    async function fetchPeers() {
      if (!isPremium || !company) return;
      const cnaeKey = company?.cnaeCodigo || company?.cnae?.codigo || company?.setor;
      if (!cnaeKey) return;
      try {
        // Busca outras empresas do mesmo CNAE (campo cnaeCodigo ou setor).
        const ref = collection(db, "companies");
        let snap;
        try {
          snap = await getDocs(query(ref, where("cnaeCodigo", "==", String(cnaeKey))));
        } catch {
          snap = null;
        }
        if (!snap || snap.empty) {
          try {
            snap = await getDocs(query(ref, where("setor", "==", String(cnaeKey).slice(0, 2))));
          } catch {
            /* sem permissão / índice */
          }
        }
        if (!snap) return;

        const peerCnpjs = snap.docs
          .map((d) => d.data()?.cnpj)
          .filter((c) => c && c !== company.cnpj);

        if (!peerCnpjs.length) {
          setPeerStats({ count: 0, avg: 0 });
          return;
        }

        // Limita a 10 vizinhos para evitar custo alto.
        const sample = peerCnpjs.slice(0, 10);
        const reviewsRef = collection(db, "reviews");
        let total = 0;
        let count = 0;
        for (const peerCnpj of sample) {
          try {
            const peerSnap = await getDocs(query(reviewsRef, where("companyCnpj", "==", peerCnpj)));
            peerSnap.docs.forEach((d) => {
              const r = d.data();
              const v = Number(r.rating) || 0;
              if (v > 0) {
                total += v;
                count += 1;
              }
            });
          } catch {
            /* segue */
          }
        }
        setPeerStats({ count, avg: count ? total / count : 0 });
      } catch (err) {
        console.error("Erro ao carregar comparativo CNAE:", err);
      }
    }
    fetchPeers();
  }, [isPremium, company]);

  const overallAvg = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return total / reviews.length;
  }, [reviews]);

  const criteriaAverages = useMemo(() => {
    return CRITERIA.map((c) => {
      const values = reviews
        .map((r) => Number(r[c.key]))
        .filter((v) => Number.isFinite(v) && v > 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { ...c, avg, count: values.length };
    });
  }, [reviews]);

  const handleSavePrefs = async () => {
    if (!company?.id) return;
    setSavingPrefs(true);
    try {
      await setDoc(
        doc(db, "companies", company.id),
        { prefs, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
      alert("Não foi possível salvar as preferências.");
    } finally {
      setSavingPrefs(false);
    }
  };

  // ---------- UI ----------

  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-700 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Faça login com a conta da sua empresa para acessar o dashboard.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            Voltar para a página inicial
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <h1 className="mt-6 text-xl font-bold text-slate-800 dark:text-slate-100">Empresa não encontrada</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Não localizamos uma empresa vinculada a esta conta. Conclua o cadastro primeiro.
          </p>
          <button
            type="button"
            onClick={() => navigate("/empresa/cadastro")}
            style={{ backgroundColor: "#1a237e" }}
            className="mt-6 w-full h-12 rounded-lg font-bold text-white hover:brightness-110"
          >
            Cadastrar empresa
          </button>
        </div>
      </div>
    );
  }

  const cnaeCodigo = company?.cnaeCodigo || company?.cnae?.codigo || "";
  const cnaeDescricao = company?.cnaeDescricao || company?.cnae?.descricao || "";
  const setor = company?.setor || (cnaeCodigo ? cnaeCodigo.slice(0, 2) : "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header / Resumo */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="min-w-0">
              <div className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Dashboard da empresa
              </div>
              <h1 className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                {company.razaoSocial || "Empresa sem nome"}
              </h1>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                <div><span className="text-slate-400 dark:text-slate-500">CNPJ:</span> {formatCnpj(company.cnpj)}</div>
                <div><span className="text-slate-400 dark:text-slate-500">CNAE:</span> {cnaeCodigo || "—"}{cnaeDescricao ? ` · ${cnaeDescricao}` : ""}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Setor (divisão):</span> {setor || "—"}</div>
                <div><span className="text-slate-400 dark:text-slate-500">Plano:</span>{" "}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isPremium
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {isPremium ? "Premium" : "Free"}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/empresa/perfil")}
              className="h-10 px-4 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Ver perfil público
            </button>
          </div>
        </section>

        {/* Avaliações */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Avaliações recebidas</h2>
            <div className="flex items-center gap-3">
              <StarRow value={overallAvg} />
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{overallAvg.toFixed(1)}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"})
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {criteriaAverages.map((c) => (
              <div
                key={c.key}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 flex items-center justify-between gap-3"
              >
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{c.label}</span>
                <div className="flex items-center gap-2">
                  <StarRow value={c.avg} size="h-4 w-4" />
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-9 text-right">
                    {c.count ? c.avg.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {reviews.length === 0 && (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400 text-center">
              Ainda não há avaliações para esta empresa.
            </p>
          )}
        </section>

        {/* Comparativo CNAE (Premium) */}
        <section className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Comparativo com empresas do mesmo CNAE
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Como sua nota geral se compara à média do setor {cnaeDescricao ? `“${cnaeDescricao}”` : `(CNAE ${cnaeCodigo || "—"})`}.
          </p>

          <div className={`mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 ${isPremium ? "" : "blur-sm select-none pointer-events-none"}`}>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sua média</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-slate-100">{overallAvg.toFixed(1)}</div>
              <StarRow value={overallAvg} size="h-4 w-4" />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Média do setor</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                {peerStats?.count ? peerStats.avg.toFixed(1) : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {peerStats?.count ? `${peerStats.count} avaliações de pares` : "Sem dados suficientes"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Diferença</div>
              <div className="mt-2 text-3xl font-extrabold text-slate-800 dark:text-slate-100">
                {peerStats?.count
                  ? `${overallAvg >= peerStats.avg ? "+" : ""}${(overallAvg - peerStats.avg).toFixed(1)}`
                  : "—"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">vs. média de pares</div>
            </div>
          </div>

          {!isPremium && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                <div className="inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                  PLANO PREMIUM EMPRESA
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">
                  Comparativo de setor disponível no Premium
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {PREMIUM_PRICE_LABEL} — Disponível a partir de {PREMIUM_AVAILABLE_AT}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full h-11 rounded-lg font-bold text-white bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                >
                  Fazer upgrade (em breve)
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Relatório executivo (Premium) */}
        <section className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Relatório executivo</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Síntese mensal pronta para apresentação à diretoria, com pontos fortes, oportunidades e plano de ação.
          </p>

          <div className={`mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-6 ${isPremium ? "" : "blur-sm select-none pointer-events-none"}`}>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <li>• Resumo de avaliações e tendências do mês</li>
              <li>• Top 3 forças e top 3 oportunidades por critério</li>
              <li>• Benchmark vs. setor (CNAE) e porte da empresa</li>
              <li>• Recomendações priorizadas de ação</li>
            </ul>
            {isPremium && (
              <button
                type="button"
                style={{ backgroundColor: "#1a237e" }}
                className="mt-4 h-11 px-5 rounded-lg font-bold text-white hover:brightness-110"
              >
                Gerar relatório do mês
              </button>
            )}
          </div>

          {!isPremium && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800 p-6 text-center">
                <div className="inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                  PLANO PREMIUM EMPRESA
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-800 dark:text-slate-100">
                  Relatório executivo no Premium
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {PREMIUM_PRICE_LABEL} — Disponível a partir de {PREMIUM_AVAILABLE_AT}
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-5 w-full h-11 rounded-lg font-bold text-white bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                >
                  Fazer upgrade (em breve)
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Configurações */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configurações do perfil</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Preferências básicas. Para editar nome, logo, redes sociais e demais dados, abra o perfil público.
          </p>

          <div className="mt-5 space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Notificar por e-mail novas avaliações</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Você recebe um aviso assim que uma avaliação pública for publicada.</div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.notifyOnReview}
                onChange={(e) => setPrefs({ ...prefs, notifyOnReview: e.target.checked })}
                className="h-5 w-5"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Perfil público visível</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Permite que sua empresa apareça nas listagens e buscas.</div>
              </div>
              <input
                type="checkbox"
                checked={!!prefs.publicProfile}
                onChange={(e) => setPrefs({ ...prefs, publicProfile: e.target.checked })}
                className="h-5 w-5"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/empresa/perfil")}
              className="h-11 px-4 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Editar perfil público
            </button>
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={savingPrefs}
              style={{ backgroundColor: savingPrefs ? undefined : "#1a237e" }}
              className={`h-11 px-5 rounded-lg font-bold text-white transition ${
                savingPrefs ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
              }`}
            >
              {savingPrefs ? "Salvando..." : "Salvar preferências"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
