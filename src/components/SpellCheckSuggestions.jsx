import React, { useEffect, useMemo, useState } from "react";
import { findSpellingSuggestions, applySuggestion } from "../utils/ptBrAutoCorrect";

/**
 * SpellCheckSuggestions
 * ------------------------------------------------------------------
 * Mostra, abaixo de um campo de texto, sugestões clicáveis para corrigir
 * palavras com erros ortográficos comuns (pt-BR), usando o dicionário
 * curado em `utils/ptBrAutoCorrect`.
 *
 * Uso:
 *   <SpellCheckSuggestions value={text} onChangeValue={setText} />
 *
 * Comportamento:
 *  - Usuário digita normalmente; o componente reavalia com debounce.
 *  - Cada sugestão é exibida como chip (palavra → correção). Clique aplica.
 *  - "Aceitar todas" aplica todas as sugestões em sequência.
 *  - "Ignorar" oculta uma sugestão até que o texto mude novamente.
 */
export default function SpellCheckSuggestions({
  value,
  onChangeValue,
  debounceMs = 350,
  limit = 8,
  className = "",
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [ignored, setIgnored] = useState(() => new Set());

  // Recalcula sugestões com debounce a cada mudança de valor.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const found = findSpellingSuggestions(value || "", { limit: limit * 2 });
      setSuggestions(found);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [value, debounceMs, limit]);

  // Reseta a lista de ignoradas quando o valor cresce/decresce significativamente.
  useEffect(() => {
    setIgnored((prev) => {
      if (prev.size === 0) return prev;
      // Mantém apenas as ignoradas que ainda existem no texto atual.
      const next = new Set();
      for (const key of prev) {
        const [word, posStr] = key.split("@");
        const pos = Number(posStr) || 0;
        if ((value || "").slice(pos, pos + (word?.length || 0)) === word) {
          next.add(key);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [value]);

  const visible = useMemo(() => {
    return suggestions
      .filter((s) => !ignored.has(`${s.original}@${s.start}`))
      .slice(0, limit);
  }, [suggestions, ignored, limit]);

  if (!visible.length) return null;

  const accept = (sug) => {
    const result = applySuggestion(value || "", sug);
    if (!result) return;
    onChangeValue?.(result.value);
  };

  const acceptAll = () => {
    let text = value || "";
    // Aplica do fim para o início para preservar índices.
    const sorted = [...visible].sort((a, b) => b.start - a.start);
    for (const s of sorted) {
      const r = applySuggestion(text, s);
      if (r) text = r.value;
    }
    onChangeValue?.(text);
  };

  const ignore = (sug) => {
    setIgnored((prev) => {
      const next = new Set(prev);
      next.add(`${sug.original}@${sug.start}`);
      return next;
    });
  };

  return (
    <div
      className={`rounded-md border border-blue-200 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-900/20 p-2 text-xs ${className}`}
      role="region"
      aria-label="Sugestões de correção ortográfica"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="font-semibold text-blue-800 dark:text-blue-200">
          Sugestões de correção ({visible.length})
        </p>
        {visible.length > 1 && (
          <button
            type="button"
            onClick={acceptAll}
            className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Aceitar todas
          </button>
        )}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {visible.map((s) => (
          <li
            key={`${s.original}-${s.start}-${s.end}`}
            className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700/60 rounded px-1.5 py-0.5"
          >
            <button
              type="button"
              onClick={() => accept(s)}
              title={`Substituir "${s.original}" por "${s.replacement}"`}
              className="font-mono text-[11px] text-blue-800 dark:text-blue-200 hover:underline"
            >
              <span className="line-through opacity-70">{s.original}</span>
              <span aria-hidden> → </span>
              <span className="font-semibold">{s.replacement}</span>
            </button>
            <button
              type="button"
              onClick={() => ignore(s)}
              aria-label={`Ignorar sugestão para ${s.original}`}
              title="Ignorar"
              className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
