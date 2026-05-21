import React from "react";

/**
 * WorkPeriodPicker
 * ------------------------------------------------------------------
 * Coleta o período em que o trabalhador esteve na empresa (mês/ano).
 *
 * Os dados informados aqui são marcados como visíveis apenas para
 * Apoiadores da plataforma — a UI deixa isso claro para o usuário e o
 * back-end deve respeitar a flag `workPeriodVisibility: "supporter"`
 * incluída nos dados da avaliação.
 */

const MONTHS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 60; y -= 1) {
    years.push(String(y));
  }
  return years;
}

const YEAR_OPTIONS = buildYearOptions();

export default function WorkPeriodPicker({
  startMonth,
  setStartMonth,
  startYear,
  setStartYear,
  endMonth,
  setEndMonth,
  endYear,
  setEndYear,
  stillWorking,
  setStillWorking,
  idPrefix = "wp",
}) {
  const selectClass =
    "rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm text-slate-800 dark:text-slate-100 dark:[color-scheme:dark]";

  return (
    <div className="bg-purple-50 dark:bg-slate-800/80 border border-purple-200 dark:border-slate-700 rounded-xl p-3">
      <p className="text-sm font-bold text-purple-800 dark:text-purple-200 mb-1">
        Quando você trabalhou nesta empresa?
      </p>
      <p className="text-xs text-purple-700 dark:text-purple-300 mb-3 leading-snug">
        🔒 Esta informação é <strong>privada</strong>: visível apenas para
        Apoiadores da plataforma. Não aparece para outros usuários.
      </p>

      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <label className="font-semibold w-12 text-slate-700 dark:text-slate-100">Início:</label>
          <select
            aria-label="Mês de início"
            className={selectClass}
            value={startMonth || ""}
            onChange={(e) => setStartMonth(e.target.value)}
          >
            <option value="">Mês</option>
            {MONTHS.map((m) => (
              <option key={`${idPrefix}-sm-${m.value}`} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Ano de início"
            className={selectClass}
            value={startYear || ""}
            onChange={(e) => setStartYear(e.target.value)}
          >
            <option value="">Ano</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={`${idPrefix}-sy-${y}`} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="font-semibold w-12 text-slate-700 dark:text-slate-100">Saída:</label>
          <select
            aria-label="Mês de saída"
            className={selectClass}
            value={stillWorking ? "" : endMonth || ""}
            onChange={(e) => setEndMonth(e.target.value)}
            disabled={stillWorking}
          >
            <option value="">Mês</option>
            {MONTHS.map((m) => (
              <option key={`${idPrefix}-em-${m.value}`} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Ano de saída"
            className={selectClass}
            value={stillWorking ? "" : endYear || ""}
            onChange={(e) => setEndYear(e.target.value)}
            disabled={stillWorking}
          >
            <option value="">Ano</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={`${idPrefix}-ey-${y}`} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 pt-1 text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={Boolean(stillWorking)}
            onChange={(e) => setStillWorking(e.target.checked)}
            className="accent-purple-600 dark:accent-purple-400"
          />
          <span>Ainda trabalho aqui</span>
        </label>
      </div>
    </div>
  );
}
