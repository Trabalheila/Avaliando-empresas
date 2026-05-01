import React, { useMemo, useState } from "react";
import RestrictedComment from "./RestrictedComment";

/**
 * CompanyCommentsManager
 * --------------------------------------------------------------------------
 * Gerenciador avançado de comentários para empresas Premium.
 *
 * Props:
 *  - isPremium:        boolean — controla o acesso (gate visual)
 *  - reviews:          array de avaliações da empresa
 *  - criteria:         array [{ key, label }] dos critérios suportados
 *  - sentiment:        objeto opcional vindo de uma API:
 *      { positive, neutral, negative, positiveKeywords[], negativeKeywords[] }
 *      (porcentagens 0..100). Se não vier, é calculado uma heurística simples
 *      no frontend (placeholder).
 *  - replyDrafts:      { [reviewId]: string }
 *  - replyingId:       reviewId em submissão (loading)
 *  - onReplyChange:    (reviewId, text) => void
 *  - onSubmitReply:    (reviewId) => Promise<void> | void
 *  - onUpgradeClick:   () => void  (CTA de upgrade)
 */

const REPLY_MAX_LEN = 1000;

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo o período" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "custom", label: "Personalizado" },
];

const POSITIVE_HINTS = ["bom", "boa", "ótimo", "ótima", "excelente", "gostei", "feliz", "respeito", "crescimento", "oportunidade", "transparente"];
const NEGATIVE_HINTS = ["ruim", "péssimo", "péssima", "horrível", "tóxico", "tóxica", "estresse", "burocracia", "atrasado", "atrasada", "demitido", "demitida"];

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const ms = toMillis(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pt-BR");
}

// Heurística: classifica um comentário em positivo/neutro/negativo combinando
// rating (se houver) com termos-chave em PT-BR. Apenas placeholder para a UI;
// idealmente substituído por uma API de NLP no backend.
function classifySentiment(review) {
  const rating = Number(review?.rating) || 0;
  const text = String(review?.comment || "").toLowerCase();
  const pos = POSITIVE_HINTS.filter((w) => text.includes(w)).length;
  const neg = NEGATIVE_HINTS.filter((w) => text.includes(w)).length;
  if (rating >= 4 || pos - neg >= 2) return "positive";
  if (rating > 0 && rating <= 2) return "negative";
  if (neg - pos >= 2) return "negative";
  return "neutral";
}

function topKeywords(reviews, sentiment, limit = 8) {
  const stop = new Set([
    "que", "para", "com", "uma", "uns", "umas", "dos", "das", "como", "isso",
    "muito", "muita", "muitos", "muitas", "mais", "menos", "também", "ainda",
    "porque", "porém", "mas", "não", "sim", "este", "esta", "estes", "estas",
    "ele", "ela", "eles", "elas", "tem", "ter", "ser", "está", "estão", "foi",
    "são", "por", "pelo", "pela", "pelos", "pelas", "sem", "sua", "seu",
    "suas", "seus", "lá", "aqui", "nos", "nas", "num", "nem",
  ]);
  const counts = new Map();
  reviews.forEach((r) => {
    if (classifySentiment(r) !== sentiment) return;
    const text = String(r?.comment || "").toLowerCase();
    text
      .replace(/[^\p{L}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stop.has(w))
      .forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export default function CompanyCommentsManager({
  isPremium,
  reviews = [],
  criteria = [],
  sentiment = null,
  replyDrafts = {},
  replyingId = null,
  onReplyChange,
  onSubmitReply,
  onUpgradeClick,
}) {
  const [criterionFilter, setCriterionFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [openReplyId, setOpenReplyId] = useState(null);

  // -------------------------------------------------------------------------
  // Filtros aplicados
  // -------------------------------------------------------------------------
  const filteredReviews = useMemo(() => {
    const now = Date.now();
    let fromMs = null;
    let toMs = null;
    if (periodFilter === "custom") {
      if (customFrom) fromMs = new Date(customFrom).getTime();
      if (customTo) toMs = new Date(customTo).getTime() + 24 * 60 * 60 * 1000 - 1;
    } else if (periodFilter !== "all") {
      const days = Number(periodFilter);
      if (Number.isFinite(days) && days > 0) {
        fromMs = now - days * 24 * 60 * 60 * 1000;
      }
    }
    const kw = keyword.trim().toLowerCase();

    return reviews
      .filter((r) => {
        // Filtra por critério: mantém apenas reviews que pontuaram aquele critério.
        if (criterionFilter !== "all") {
          const v = Number(r?.[criterionFilter]);
          if (!Number.isFinite(v) || v <= 0) return false;
        }
        // Filtra por período (createdAt).
        if (fromMs != null || toMs != null) {
          const ms = toMillis(r?.createdAt);
          if (!ms) return false;
          if (fromMs != null && ms < fromMs) return false;
          if (toMs != null && ms > toMs) return false;
        }
        // Filtra por palavra-chave no comentário ou pseudônimo.
        if (kw) {
          const hay = `${r?.comment || ""} ${r?.pseudonym || ""}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [reviews, criterionFilter, periodFilter, customFrom, customTo, keyword]);

  // -------------------------------------------------------------------------
  // Sentimento (vem do backend OU é calculado no client)
  // -------------------------------------------------------------------------
  const sentimentSummary = useMemo(() => {
    if (sentiment && typeof sentiment === "object") {
      return {
        positive: Number(sentiment.positive) || 0,
        neutral: Number(sentiment.neutral) || 0,
        negative: Number(sentiment.negative) || 0,
        positiveKeywords: sentiment.positiveKeywords || [],
        negativeKeywords: sentiment.negativeKeywords || [],
      };
    }
    if (!filteredReviews.length) {
      return { positive: 0, neutral: 0, negative: 0, positiveKeywords: [], negativeKeywords: [] };
    }
    let pos = 0;
    let neu = 0;
    let neg = 0;
    filteredReviews.forEach((r) => {
      const s = classifySentiment(r);
      if (s === "positive") pos += 1;
      else if (s === "negative") neg += 1;
      else neu += 1;
    });
    const total = pos + neu + neg || 1;
    return {
      positive: Math.round((pos / total) * 100),
      neutral: Math.round((neu / total) * 100),
      negative: Math.round((neg / total) * 100),
      positiveKeywords: topKeywords(filteredReviews, "positive"),
      negativeKeywords: topKeywords(filteredReviews, "negative"),
    };
  }, [filteredReviews, sentiment]);

  // -------------------------------------------------------------------------
  // Premium gate (após hooks para respeitar rules-of-hooks)
  // -------------------------------------------------------------------------
  if (!isPremium) {
    return (
      <section
        aria-label="Gerenciar comentários (Premium)"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-amber-200 dark:border-amber-800 p-8"
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Gerenciar comentários
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Filtros avançados por critério, período e palavra-chave; análise de sentimento;
              palavras mais frequentes e resposta pública individual a cada avaliação. Disponível
              exclusivamente no <strong>Plano Empresa Premium</strong>.
            </p>
          </div>
          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="h-10 px-4 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
            >
              Fazer upgrade para Premium
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Gerenciar comentários"
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 space-y-6"
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Gerenciar comentários
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Recurso exclusivo do Plano Empresa Premium
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          ★ Premium
        </span>
      </header>

      {/* ----------------------------- Filtros ----------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-700 dark:text-slate-200">
            Critério de avaliação
          </span>
          <select
            value={criterionFilter}
            onChange={(e) => setCriterionFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            <option value="all">Todos os critérios</option>
            {criteria
              .filter((c) => c.key !== "rating")
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-700 dark:text-slate-200">
            Período
          </span>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 font-medium text-slate-700 dark:text-slate-200">
            Palavra-chave
          </span>
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="ex.: salário, liderança..."
            className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
        </label>

        {periodFilter === "custom" && (
          <>
            <label className="text-sm md:col-start-2">
              <span className="block mb-1 font-medium text-slate-700 dark:text-slate-200">De</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium text-slate-700 dark:text-slate-200">Até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </label>
          </>
        )}
      </div>

      {/* ---------------------- Análise de sentimento ---------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Sentimento dos comentários
          </h3>
          <SentimentBar
            positive={sentimentSummary.positive}
            neutral={sentimentSummary.neutral}
            negative={sentimentSummary.negative}
          />
          <ul className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <li>
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500 mr-2" />
              Positivos: <strong>{sentimentSummary.positive}%</strong>
            </li>
            <li>
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-400 mr-2" />
              Neutros: <strong>{sentimentSummary.neutral}%</strong>
            </li>
            <li>
              <span className="inline-block w-3 h-3 rounded-sm bg-rose-500 mr-2" />
              Negativos: <strong>{sentimentSummary.negative}%</strong>
            </li>
          </ul>
          {!sentiment && (
            <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
              * Análise heurística no cliente. Substituível por API de NLP no backend.
            </p>
          )}
        </div>

        <KeywordsCard
          title="Palavras frequentes — comentários positivos"
          tone="positive"
          words={sentimentSummary.positiveKeywords}
        />
        <KeywordsCard
          title="Palavras frequentes — comentários negativos"
          tone="negative"
          words={sentimentSummary.negativeKeywords}
        />
      </div>

      {/* ----------------------- Lista de comentários ---------------------- */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Comentários ({filteredReviews.length})
          </h3>
        </div>

        {filteredReviews.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            Nenhum comentário encontrado com os filtros atuais.
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredReviews.map((r) => {
              const sentimentTag = classifySentiment(r);
              const draft = replyDrafts[r.id] || "";
              const submitting = replyingId === r.id;
              const existing = r.companyResponse?.text || "";
              const isOpen = openReplyId === r.id;
              const criterionScore =
                criterionFilter !== "all" ? Number(r?.[criterionFilter]) : null;

              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <strong className="text-slate-800 dark:text-slate-100">
                        {r.pseudonym || "Anônimo"}
                      </strong>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <SentimentTag value={sentimentTag} />
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                        ★ {(Number(r.rating) || 0).toFixed(1)}
                      </span>
                      {criterionScore != null && Number.isFinite(criterionScore) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                          critério: {criterionScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {(r.generalComment || r.comment) ? (
                    <RestrictedComment
                      comment={r.generalComment || r.comment}
                      restrictedSegments={r.restrictedSegments}
                      className="mt-2 text-sm text-slate-700 dark:text-slate-200"
                    />
                  ) : (
                    <p className="mt-2 text-sm text-slate-400 italic">Sem texto.</p>
                  )}

                  {/* Resposta oficial (se já existir) */}
                  {existing && (
                    <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        Resposta oficial da empresa
                      </div>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                        {existing}
                      </p>
                    </div>
                  )}

                  {/* Toggle / formulário de resposta */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setOpenReplyId(isOpen ? null : r.id)}
                      className="h-9 px-3 rounded-lg text-sm font-bold text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      {existing ? "Atualizar resposta pública" : "Responder publicamente"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        rows={3}
                        maxLength={REPLY_MAX_LEN}
                        value={draft}
                        onChange={(e) => onReplyChange?.(r.id, e.target.value.slice(0, REPLY_MAX_LEN))}
                        placeholder="Escreva uma resposta oficial da empresa..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {draft.length}/{REPLY_MAX_LEN}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenReplyId(null)}
                            className="h-9 px-3 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={submitting || !draft.trim()}
                            onClick={async () => {
                              await onSubmitReply?.(r.id);
                              setOpenReplyId(null);
                            }}
                            className="h-9 px-4 rounded-lg text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 transition-colors"
                          >
                            {submitting ? "Enviando..." : "Publicar resposta"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function SentimentBar({ positive = 0, neutral = 0, negative = 0 }) {
  const total = Math.max(1, positive + neutral + negative);
  const p = (positive / total) * 100;
  const n = (neutral / total) * 100;
  const g = (negative / total) * 100;
  return (
    <div
      className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="img"
      aria-label={`Positivos ${positive}%, neutros ${neutral}%, negativos ${negative}%`}
    >
      <div className="bg-emerald-500" style={{ width: `${p}%` }} />
      <div className="bg-slate-400" style={{ width: `${n}%` }} />
      <div className="bg-rose-500" style={{ width: `${g}%` }} />
    </div>
  );
}

function SentimentTag({ value }) {
  const map = {
    positive: { label: "Positivo", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" },
    neutral: { label: "Neutro", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
    negative: { label: "Negativo", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200" },
  };
  const { label, cls } = map[value] || map.neutral;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{label}</span>;
}

function KeywordsCard({ title, tone, words = [] }) {
  const toneCls =
    tone === "positive"
      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
      : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800";
  const chipCls =
    tone === "positive"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
      : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200";
  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      {words.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic">Sem dados suficientes.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {words.slice(0, 10).map((w) => (
            <li
              key={w.word}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${chipCls}`}
            >
              {w.word}
              <span className="opacity-70">· {w.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
