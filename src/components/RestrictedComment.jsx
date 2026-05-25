import React, { useMemo } from "react";
import { getRestrictedContentTier } from "../utils/rbac";

/**
 * RestrictedComment
 * ------------------------------------------------------------------
 * Renderiza um comentário de avaliação aplicando "Conteúdo Restrito em Camadas".
 *
 * Props:
 *   - comment:            string original do comentário (texto completo)
 *   - restrictedSegments: array de objetos { start, end, summary }
 *                         posições baseadas em índice de caractere no `comment`
 *                         (start inclusivo, end exclusivo)
 *   - tier:               override opcional — "supporter" | "premium_worker" | "free"
 *                         (se omitido, é resolvido via rbac)
 *   - className:          classes adicionais aplicadas ao wrapper <p>
 *
 * Camadas de visibilidade:
 *   - supporter      → texto completo, com destaque visual nos trechos restritos
 *   - premium_worker → cada trecho restrito é substituído por [Resumo Curto]
 *   - free           → cada trecho restrito é substituído por
 *                      [Conteúdo sensível. Visível apenas para Apoiadores e Trabalhadores Premium]
 */

const FREE_PLACEHOLDER =
  "[Conteúdo sensível. Visível apenas para Especialistas e Trabalhadores Premium]";

function sanitizeSegments(segments, textLength) {
  if (!Array.isArray(segments)) return [];
  return segments
    .map((seg) => {
      if (!seg || typeof seg !== "object") return null;
      const start = Number(seg.start);
      const end = Number(seg.end);
      const summary = (seg.summary || "").toString().trim();
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
      if (start < 0 || end <= start || end > textLength) return null;
      if (!summary) return null;
      return { start, end, summary };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start)
    .reduce((acc, seg) => {
      // Remove sobreposições mantendo o primeiro segmento.
      const last = acc[acc.length - 1];
      if (last && seg.start < last.end) return acc;
      acc.push(seg);
      return acc;
    }, []);
}

export default function RestrictedComment({
  comment,
  restrictedSegments,
  tier: tierOverride,
  className = "",
}) {
  const text = typeof comment === "string" ? comment : "";
  const segments = useMemo(
    () => sanitizeSegments(restrictedSegments, text.length),
    [restrictedSegments, text.length]
  );
  const tier = tierOverride || getRestrictedContentTier();

  if (!text) return null;

  if (segments.length === 0) {
    return (
      <p className={`whitespace-pre-wrap break-words ${className}`}>{text}</p>
    );
  }

  const parts = [];
  let cursor = 0;
  segments.forEach((seg, idx) => {
    if (seg.start > cursor) {
      parts.push(
        <span key={`plain-${idx}`}>{text.slice(cursor, seg.start)}</span>
      );
    }

    if (tier === "supporter") {
      parts.push(
        <mark
          key={`seg-${idx}`}
          title={`Conteúdo restrito — Resumo: ${seg.summary}`}
          className="bg-yellow-200/80 dark:bg-yellow-500/30 text-slate-900 dark:text-yellow-100 px-1 rounded ring-1 ring-yellow-400/60 dark:ring-yellow-500/50"
        >
          <span aria-hidden="true" className="mr-0.5">🔒</span>
          {text.slice(seg.start, seg.end)}
        </mark>
      );
    } else if (tier === "premium_worker") {
      parts.push(
        <span
          key={`seg-${idx}`}
          title="Resumo de conteúdo restrito (acesso Trabalhador Premium)"
          className="inline italic text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded px-1"
        >
          <span aria-hidden="true" className="mr-0.5">🔒</span>
          [{seg.summary}]
        </span>
      );
    } else {
      parts.push(
        <span
          key={`seg-${idx}`}
          className="inline italic text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1"
        >
          <span aria-hidden="true" className="mr-0.5">🔒</span>
          {FREE_PLACEHOLDER}
        </span>
      );
    }

    cursor = seg.end;
  });

  if (cursor < text.length) {
    parts.push(<span key="plain-tail">{text.slice(cursor)}</span>);
  }

  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>{parts}</p>
  );
}

export { sanitizeSegments, FREE_PLACEHOLDER };
