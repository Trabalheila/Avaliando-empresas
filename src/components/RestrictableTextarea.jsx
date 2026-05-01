import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeSegments } from "./RestrictedComment";

/**
 * RestrictableTextarea
 * ------------------------------------------------------------------
 * Textarea controlada que permite ao usuário marcar trechos como
 * "Conteúdo Restrito" — visível em camadas (apoiadores / premium / free).
 *
 * Funciona em conjunto com:
 *   - estado externo `value` / `onValueChange`
 *   - estado externo `segments` / `onSegmentsChange`
 *
 * Cada segmento tem o formato { start, end, summary }, onde start/end
 * são índices de caractere em `value` e `summary` é o "Resumo Curto"
 * exibido para Trabalhadores Premium.
 *
 * Detecção de nome (warning) é mantida via `containsPossiblePersonName`.
 */

const SUMMARY_MAX = 80;

function shiftSegmentsOnChange(prev, oldText, newText) {
  if (!Array.isArray(prev) || prev.length === 0) return [];
  if (oldText === newText) return prev;

  // Encontra prefixo comum.
  const minLen = Math.min(oldText.length, newText.length);
  let commonStart = 0;
  while (commonStart < minLen && oldText[commonStart] === newText[commonStart]) {
    commonStart += 1;
  }
  // Encontra sufixo comum.
  let commonEnd = 0;
  while (
    commonEnd < minLen - commonStart &&
    oldText[oldText.length - 1 - commonEnd] === newText[newText.length - 1 - commonEnd]
  ) {
    commonEnd += 1;
  }
  const oldChangeEnd = oldText.length - commonEnd; // exclusivo
  const newChangeEnd = newText.length - commonEnd; // exclusivo
  const delta = newChangeEnd - oldChangeEnd; // tamanho do shift após oldChangeEnd

  return prev
    .map((seg) => {
      // Segmento totalmente antes da edição → preserva.
      if (seg.end <= commonStart) return seg;
      // Segmento totalmente após a edição → desloca.
      if (seg.start >= oldChangeEnd) {
        return { ...seg, start: seg.start + delta, end: seg.end + delta };
      }
      // Sobreposição com região editada → invalida o segmento.
      return null;
    })
    .filter(Boolean);
}

export default function RestrictableTextarea({
  value,
  onValueChange,
  segments,
  onSegmentsChange,
  containsPossiblePersonName,
  guidanceText,
  warningText,
  placeholder,
  rows = 3,
  className = "",
  maxLength,
  disabled = false,
}) {
  const textareaRef = useRef(null);
  const [draftValue, setDraftValue] = useState(() => (typeof value === "string" ? value : ""));
  const lastEmittedValueRef = useRef(typeof value === "string" ? value : "");
  const [showWarning, setShowWarning] = useState(false);

  const [pendingRange, setPendingRange] = useState(null); // { start, end }
  const [pendingSummary, setPendingSummary] = useState("");
  const [feedback, setFeedback] = useState("");

  // Estado do botão flutuante de marcação (sobre seleção ativa).
  const [floatingTrigger, setFloatingTrigger] = useState(null); // { top, left, start, end }
  const containerRef = useRef(null);

  // Sincroniza valor externo → interno.
  useEffect(() => {
    const next = typeof value === "string" ? value : "";
    if (next !== lastEmittedValueRef.current) {
      setDraftValue(next);
      lastEmittedValueRef.current = next;
    }
  }, [value]);

  // Debounce: emite valor + atualiza warning.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof containsPossiblePersonName === "function") {
        setShowWarning(containsPossiblePersonName(draftValue));
      }
      if (draftValue !== lastEmittedValueRef.current) {
        onValueChange?.(draftValue);
        lastEmittedValueRef.current = draftValue;
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [containsPossiblePersonName, draftValue, onValueChange]);

  const handleChange = useCallback(
    (e) => {
      const next = e.target.value;
      const oldText = draftValue;
      setDraftValue(next);
      if (Array.isArray(segments) && segments.length > 0) {
        const shifted = shiftSegmentsOnChange(segments, oldText, next);
        if (shifted.length !== segments.length || shifted.some((s, i) => s !== segments[i])) {
          onSegmentsChange?.(sanitizeSegments(shifted, next.length));
        }
      }
      // Cancela marcação pendente se intervalo virou inválido.
      if (pendingRange) {
        if (pendingRange.end > next.length || pendingRange.start >= next.length) {
          setPendingRange(null);
          setPendingSummary("");
        }
      }
    },
    [draftValue, segments, onSegmentsChange, pendingRange]
  );

  const handleBlur = useCallback(() => {
    if (draftValue !== lastEmittedValueRef.current) {
      onValueChange?.(draftValue);
      lastEmittedValueRef.current = draftValue;
    }
  }, [draftValue, onValueChange]);

  const startMarkSelection = useCallback(() => {
    setFeedback("");
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end <= start) {
      setFeedback("Selecione um trecho do texto antes de marcar como restrito.");
      return;
    }
    // Verifica sobreposição com segmentos existentes.
    const overlaps = (segments || []).some(
      (s) => !(end <= s.start || start >= s.end)
    );
    if (overlaps) {
      setFeedback("Esse trecho já se sobrepõe a outro segmento marcado.");
      return;
    }
    setPendingRange({ start, end });
    setPendingSummary("");
    setFloatingTrigger(null);
  }, [segments]);

  // Atualiza posição do botão flutuante conforme a seleção do textarea.
  const updateFloatingTrigger = useCallback(() => {
    const el = textareaRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end <= start || disabled) {
      setFloatingTrigger(null);
      return;
    }
    // Sobreposição com segmento existente → não oferecer marcação.
    const overlaps = (segments || []).some(
      (s) => !(end <= s.start || start >= s.end)
    );
    if (overlaps) {
      setFloatingTrigger(null);
      return;
    }
    const taRect = el.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    setFloatingTrigger({
      top: taRect.top - cRect.top - 36,
      left: Math.min(taRect.right - cRect.left - 220, taRect.left - cRect.left + 12),
      start,
      end,
    });
  }, [segments, disabled]);

  useEffect(() => {
    if (pendingRange) setFloatingTrigger(null);
  }, [pendingRange]);

  useEffect(() => {
    const onDocSelectionChange = () => {
      const active = document.activeElement;
      if (active && active === textareaRef.current) {
        updateFloatingTrigger();
      }
    };
    document.addEventListener("selectionchange", onDocSelectionChange);
    return () => document.removeEventListener("selectionchange", onDocSelectionChange);
  }, [updateFloatingTrigger]);

  const confirmPending = useCallback(() => {
    if (!pendingRange) return;
    const summary = pendingSummary.trim();
    if (!summary) {
      setFeedback("Informe um Resumo Curto para o trecho marcado.");
      return;
    }
    const next = [...(segments || []), { ...pendingRange, summary }];
    onSegmentsChange?.(sanitizeSegments(next, draftValue.length));
    setPendingRange(null);
    setPendingSummary("");
    setFeedback("Trecho marcado como restrito.");
  }, [pendingRange, pendingSummary, segments, onSegmentsChange, draftValue.length]);

  const cancelPending = useCallback(() => {
    setPendingRange(null);
    setPendingSummary("");
    setFeedback("");
  }, []);

  const removeSegment = useCallback(
    (idx) => {
      const next = (segments || []).filter((_, i) => i !== idx);
      onSegmentsChange?.(next);
    },
    [segments, onSegmentsChange]
  );

  const updateSegmentSummary = useCallback(
    (idx, summary) => {
      const next = (segments || []).map((s, i) =>
        i === idx ? { ...s, summary } : s
      );
      onSegmentsChange?.(next);
    },
    [segments, onSegmentsChange]
  );

  const previewText = useMemo(() => {
    if (!pendingRange) return "";
    return draftValue.slice(pendingRange.start, pendingRange.end);
  }, [pendingRange, draftValue]);

  const sortedSegments = useMemo(
    () => sanitizeSegments(segments, draftValue.length),
    [segments, draftValue.length]
  );

  return (
    <div ref={containerRef} className="relative space-y-2">
      {guidanceText && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{guidanceText}</p>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          className={className}
          placeholder={placeholder}
          rows={rows}
          value={draftValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onSelect={updateFloatingTrigger}
          onKeyUp={updateFloatingTrigger}
          onMouseUp={updateFloatingTrigger}
          maxLength={maxLength}
          disabled={disabled}
        />
        {sortedSegments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {sortedSegments.map((seg) => (
              <span
                key={`badge-${seg.start}-${seg.end}`}
                title={`Resumo: ${seg.summary}`}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-dashed border-amber-400 dark:border-amber-500/50"
              >
                <span aria-hidden>🔒</span>
                <span className="max-w-[140px] truncate">{draftValue.slice(seg.start, seg.end)}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {floatingTrigger && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startMarkSelection}
          style={{ top: floatingTrigger.top, left: Math.max(0, floatingTrigger.left) }}
          className="absolute z-20 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white shadow-lg border border-amber-700"
        >
          <span aria-hidden>🔒</span>
          Marcar como restrito
        </button>
      )}

      {showWarning && warningText && (
        <p className="text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md px-2 py-1">
          {warningText}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startMarkSelection}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 transition"
        >
          <span aria-hidden>🔒</span>
          Marcar trecho selecionado como restrito
        </button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          Selecione o texto no campo acima e clique para ocultá-lo de não-apoiadores.
        </span>
      </div>

      {feedback && (
        <p className="text-xs text-slate-600 dark:text-slate-300">{feedback}</p>
      )}

      {pendingRange && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Trecho selecionado:
          </p>
          <p className="text-xs italic text-amber-900/90 dark:text-amber-100/90 break-words">
            "{previewText}"
          </p>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Resumo Curto (visível para Trabalhadores Premium)
          </label>
          <input
            type="text"
            value={pendingSummary}
            onChange={(e) => setPendingSummary(e.target.value.slice(0, SUMMARY_MAX))}
            placeholder="Ex.: relato sobre conduta de gestão"
            maxLength={SUMMARY_MAX}
            className="w-full px-2 py-1.5 text-sm rounded border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {pendingSummary.length}/{SUMMARY_MAX}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelPending}
                className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmPending}
                className="text-xs font-semibold px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white"
              >
                Confirmar marcação
              </button>
            </div>
          </div>
        </div>
      )}

      {sortedSegments.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Trechos restritos ({sortedSegments.length})
          </p>
          <ul className="space-y-2">
            {sortedSegments.map((seg, idx) => (
              <li
                key={`${seg.start}-${seg.end}`}
                className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs space-y-1"
              >
                <p className="italic text-slate-700 dark:text-slate-200 break-words">
                  "{draftValue.slice(seg.start, seg.end)}"
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={seg.summary}
                    onChange={(e) =>
                      updateSegmentSummary(idx, e.target.value.slice(0, SUMMARY_MAX))
                    }
                    maxLength={SUMMARY_MAX}
                    className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="Resumo curto"
                  />
                  <button
                    type="button"
                    onClick={() => removeSegment(idx)}
                    className="text-[11px] font-semibold px-2 py-1 rounded bg-red-100 hover:bg-red-200 dark:bg-red-900/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-200"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
