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
  evidenceFiles = [],
  setEvidenceFiles,
}) {
  // Limites do upload de evidências (fotos/vídeos)
  const MAX_FILES = 5;
  const MAX_FILE_SIZE_MB = 25;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const ACCEPTED_TYPES_ATTR = "image/*,video/*";
  const [uploadError, setUploadError] = React.useState("");

  const handleAddFiles = (e) => {
    const incoming = Array.from(e.target.files || []);
    e.target.value = ""; // permite re-selecionar o mesmo arquivo após remover
    if (!incoming.length || !setEvidenceFiles) return;

    const errors = [];
    const accepted = [];

    for (const f of incoming) {
      const isMedia = (f.type || "").startsWith("image/") || (f.type || "").startsWith("video/");
      if (!isMedia) {
        errors.push(`"${f.name}" não é uma imagem ou vídeo.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`"${f.name}" excede ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }
      accepted.push(f);
    }

    const merged = [...evidenceFiles, ...accepted].slice(0, MAX_FILES);
    if (evidenceFiles.length + accepted.length > MAX_FILES) {
      errors.push(`Máximo de ${MAX_FILES} arquivos. Os excedentes foram ignorados.`);
    }
    setEvidenceFiles(merged);
    setUploadError(errors.join(" "));
  };

  const handleRemoveFile = (idx) => {
    if (!setEvidenceFiles) return;
    setEvidenceFiles(evidenceFiles.filter((_, i) => i !== idx));
    setUploadError("");
  };

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
          <>
            <textarea
              className="mt-3 w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Descreva sua percepção e, se possível, inclua detalhes que possam servir como evidência (ex: datas, frases exatas)."
              rows={3}
              value={discriminationComment}
              onChange={(e) => setDiscriminationComment(e.target.value)}
            />
            <p className="mt-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              <strong className="font-semibold">Atenção:</strong> Para buscar ajuda
              profissional (jurídica ou psicológica) através da plataforma, a
              apresentação de provas ou evidências da discriminação será
              necessária. Este campo serve para registrar sua percepção inicial.
            </p>

            {/* Upload de Provas e Evidências (fotos/vídeos) */}
            <div className="mt-4 rounded-lg border border-dashed border-blue-300 dark:border-blue-500/50 bg-blue-50/60 dark:bg-blue-900/20 p-3">
              <label className="block text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Provas e Evidências (opcional)
              </label>
              <p className="text-[11px] text-blue-800 dark:text-blue-200 mb-2 leading-snug">
                Anexe fotos ou vídeos como prova. Aceita imagens e vídeos, até
                <strong> {MAX_FILE_SIZE_MB}MB por arquivo</strong> e no máximo
                <strong> {MAX_FILES} arquivos</strong>.
              </p>

              <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Anexar fotos ou vídeos
                <input
                  type="file"
                  accept={ACCEPTED_TYPES_ATTR}
                  multiple
                  onChange={handleAddFiles}
                  className="hidden"
                />
              </label>

              {uploadError && (
                <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{uploadError}</p>
              )}

              {evidenceFiles.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {evidenceFiles.map((f, idx) => (
                    <li
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5"
                    >
                      <span className="truncate text-slate-700 dark:text-slate-200" title={f.name}>
                        {(f.type || "").startsWith("video/") ? "🎬" : "🖼️"} {f.name}
                        <span className="ml-2 text-slate-400">
                          ({(f.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-red-600 dark:text-red-400 font-bold text-xs hover:underline shrink-0"
                        aria-label={`Remover ${f.name}`}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
