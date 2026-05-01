import React from "react";
import { isSupporter } from "../utils/rbac";

/**
 * WorkPeriodBadge
 * ------------------------------------------------------------------
 * Exibe o período (mês/ano) em que o trabalhador esteve na empresa.
 * Visível APENAS para Apoiadores autenticados — para qualquer outro
 * usuário (incluindo trabalhador comum, premium e empresa) renderiza
 * `null`, garantindo que a informação fique invisível.
 *
 * Aceita um objeto `workPeriod` no formato gravado pela avaliação:
 *   { startMonth, startYear, endMonth, endYear, stillWorking }
 */

const MONTH_NAMES = [
  "",
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatMonthYear(month, year) {
  const m = Number(month);
  const y = String(year || "").trim();
  if (!y) return "";
  if (m >= 1 && m <= 12) return `${MONTH_NAMES[m]}/${y}`;
  return y;
}

export default function WorkPeriodBadge({ workPeriod, className = "" }) {
  if (!isSupporter()) return null;
  if (!workPeriod || typeof workPeriod !== "object") return null;

  const start = formatMonthYear(workPeriod.startMonth, workPeriod.startYear);
  const end = workPeriod.stillWorking
    ? "atual"
    : formatMonthYear(workPeriod.endMonth, workPeriod.endYear);

  if (!start && !end) return null;

  const label = start && end ? `${start} → ${end}` : start || end;

  return (
    <span
      title="Período de trabalho — visível apenas para Apoiadores"
      className={
        "inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-100 border border-purple-300 rounded-full px-2 py-0.5 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700 " +
        className
      }
    >
      <span aria-hidden="true">🔒</span>
      <span>{label}</span>
    </span>
  );
}
