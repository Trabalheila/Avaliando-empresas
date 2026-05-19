import React from "react";

/**
 * SelectionProcessReviewForm
 * ----------------------------------------------------------------------
 * Formulário alternativo de avaliação para usuários que NÃO foram
 * contratados pela empresa. Substitui o bloco dos 18 critérios quando o
 * usuário marca "Não se aplica" ao lado do campo de Data de Contratação.
 *
 * Campos:
 *  - Clareza das etapas do processo seletivo (1-5 estrelas)
 *  - Comunicação e feedback da empresa (1-5 estrelas)
 *  - Tempo de resposta da empresa (1-5 estrelas)
 *  - Senti que houve discriminação subjetiva (checkbox)
 *  - Descreva sua percepção (textarea opcional, só quando o checkbox acima
 *    estiver marcado)
 */

function Stars({ value, onChange, ariaLabel }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-1"
    >
      {stars.map((star) => {
        const filled = Number(value) >= star;
        return (
          <button
            type="button"
            key={star}
            onClick={() => onChange(star)}
            aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
            aria-checked={Number(value) === star}
            role="radio"
            className={`text-2xl leading-none transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
              filled ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"
            }`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default function SelectionProcessReviewForm({
  clarity,
  setClarity,
  communication,
  setCommunication,
  responseTime,
  setResponseTime,
  discriminationFelt,
  setDiscriminationFelt,
  discriminationComment,
  setDiscriminationComment,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-600/60 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        <p className="font-semibold mb-1">Avaliação do Processo Seletivo</p>
        <p className="text-xs">
          Você indicou que <strong>não foi contratado</strong> por esta empresa.
          Compartilhe abaixo como foi sua experiência durante o processo.
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
        <label className="block text-slate-700 dark:text-slate-100 font-semibold text-sm mb-2">
          Clareza das etapas do processo seletivo
        </label>
        <Stars
          value={clarity}
          onChange={setClarity}
          ariaLabel="Clareza das etapas do processo seletivo"
        />
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
        <label className="block text-slate-700 dark:text-slate-100 font-semibold text-sm mb-2">
          Comunicação e feedback da empresa
        </label>
        <Stars
          value={communication}
          onChange={setCommunication}
          ariaLabel="Comunicação e feedback da empresa"
        />
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
        <label className="block text-slate-700 dark:text-slate-100 font-semibold text-sm mb-2">
          Tempo de resposta da empresa
        </label>
        <Stars
          value={responseTime}
          onChange={setResponseTime}
          ariaLabel="Tempo de resposta da empresa"
        />
      </div>

      <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-100 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(discriminationFelt)}
            onChange={(e) => {
              setDiscriminationFelt(e.target.checked);
              if (!e.target.checked) setDiscriminationComment("");
            }}
          />
          <span>
            Senti que houve discriminação subjetiva (ex: idade, gênero, raça,
            aparência, condição de saúde).
          </span>
        </label>

        {discriminationFelt && (
          <textarea
            className="mt-3 w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Descreva sua percepção (opcional)"
            rows={3}
            value={discriminationComment}
            onChange={(e) => setDiscriminationComment(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
