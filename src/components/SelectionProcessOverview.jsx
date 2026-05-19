import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { slugifyCompany } from "../services/reviews";

/**
 * SelectionProcessOverview
 * ----------------------------------------------------------------------
 * Exibe, no perfil da empresa, dados agregados das avaliações de processo
 * seletivo (coleção `selectionProcessReviews`). Mostra:
 *  - Médias de estrelas para 3 dimensões (clareza, comunicação, tempo de
 *    resposta).
 *  - Contagem de candidatos que relataram discriminação subjetiva.
 *  - Feed paginado de comentários de discriminação (anonimizados).
 */

function StarsRow({ value, max = 5 }) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return (
    <div className="flex items-center gap-2" aria-label={`${rounded} de ${max} estrelas`}>
      <div className="flex">
        {Array.from({ length: max }).map((_, i) => {
          const filled = Number(value) >= i + 1;
          const half = !filled && Number(value) >= i + 0.5;
          return (
            <span
              key={i}
              className={`text-lg leading-none ${
                filled || half ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"
              }`}
              aria-hidden="true"
            >
              ★
            </span>
          );
        })}
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {Number.isFinite(rounded) ? rounded.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function AverageBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100));
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{label}</p>
        <StarsRow value={value} />
      </div>
      <div className="w-full h-2 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const PAGE_SIZE = 5;

export default function SelectionProcessOverview({ company }) {
  const companyName = company?.company || company?.razaoSocial || "";
  const companySlug = useMemo(() => slugifyCompany(companyName || ""), [companyName]);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!companySlug) {
          if (active) {
            setReviews([]);
            setLoading(false);
          }
          return;
        }
        const ref = collection(db, "selectionProcessReviews");
        let snap;
        try {
          snap = await getDocs(
            query(
              ref,
              where("companySlug", "==", companySlug),
              orderBy("createdAt", "desc"),
              limit(200)
            )
          );
        } catch {
          // Fallback sem orderBy/limit caso o índice composto ainda não exista.
          snap = await getDocs(query(ref, where("companySlug", "==", companySlug)));
        }
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (active) setReviews(items);
      } catch (err) {
        console.error("Falha ao carregar avaliações de processo seletivo:", err);
        if (active) setError("Não foi possível carregar as avaliações do processo seletivo.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [companySlug]);

  const stats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        total: 0,
        avgClarity: 0,
        avgCommunication: 0,
        avgResponseTime: 0,
        discriminationCount: 0,
      };
    }
    const sum = (key) =>
      reviews.reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0);
    return {
      total,
      avgClarity: sum("clarity") / total,
      avgCommunication: sum("communication") / total,
      avgResponseTime: sum("responseTime") / total,
      discriminationCount: reviews.filter((r) => r?.discriminationFelt).length,
    };
  }, [reviews]);

  const discriminationComments = useMemo(
    () =>
      reviews
        .filter(
          (r) =>
            r?.discriminationFelt &&
            typeof r?.discriminationComment === "string" &&
            r.discriminationComment.trim().length > 0
        )
        .map((r) => r.discriminationComment.trim()),
    [reviews]
  );

  const pageCount = Math.max(1, Math.ceil(discriminationComments.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleComments = discriminationComments.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <section className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600/60 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        <p>
          Aqui você encontra a percepção de candidatos que participaram do
          processo seletivo desta empresa, mesmo sem terem sido contratados. As
          avaliações são agregadas e anônimas.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-slate-600 dark:text-slate-300">Carregando avaliações…</p>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && stats.total === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center">
          <p className="text-slate-700 dark:text-slate-200 font-semibold mb-1">
            Ainda não há avaliações de processo seletivo para esta empresa.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Seja o(a) primeiro(a) a compartilhar sua experiência como candidato(a).
          </p>
        </div>
      )}

      {!loading && !error && stats.total > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AverageBar label="Clareza das etapas" value={stats.avgClarity} />
            <AverageBar label="Comunicação e feedback" value={stats.avgCommunication} />
            <AverageBar label="Tempo de resposta" value={stats.avgResponseTime} />
          </div>

          <div className="rounded-xl border border-rose-200 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-900/20 px-4 py-4">
            <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-200">
              {stats.discriminationCount}{" "}
              <span className="text-base font-semibold">
                {stats.discriminationCount === 1
                  ? "candidato relatou"
                  : "candidatos relataram"}{" "}
                discriminação subjetiva
              </span>
            </p>
            <p className="text-xs text-rose-700/80 dark:text-rose-200/80 mt-1">
              Total de avaliações de processo seletivo: {stats.total}
            </p>
          </div>

          {discriminationComments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-100">
                Relatos anônimos
              </h3>
              <ul className="space-y-3">
                {visibleComments.map((text, idx) => (
                  <li
                    key={`${safePage}-${idx}`}
                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-100 whitespace-pre-wrap"
                  >
                    “{text}”
                  </li>
                ))}
              </ul>
              {pageCount > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-slate-600 dark:text-slate-300">
                    Página {safePage + 1} de {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
