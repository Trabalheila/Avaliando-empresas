// Detecção de potencial citação de nome de pessoa em comentários.
// Importante: a detecção é heurística (regex) e gera falsos positivos
// (ex.: "Aplus Engenharia", "Santa Catarina"). Por isso é usada apenas
// como aviso ao usuário e como flag de revisão (`hasPotentialPersonalName`),
// nunca como bloqueio para envio da avaliação.

const LEET_REPLACEMENTS = {
  "3": "e",
  "0": "o",
  "4": "a",
  "@": "a",
  "1": "i",
  "!": "i",
  "5": "s",
  "7": "t",
  "8": "b",
};

const NAME_PATTERN = /\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+)+\b/g;
const SENTENCE_BOUNDARY = /[.!?\n]/;

export function containsPossiblePersonName(value) {
  const text = String(value || "").replace(/[304@1!578]/g, (char) => LEET_REPLACEMENTS[char] || char);
  // Reset lastIndex porque NAME_PATTERN é global e mantém estado entre chamadas.
  NAME_PATTERN.lastIndex = 0;
  let match = NAME_PATTERN.exec(text);

  while (match) {
    const idx = match.index;
    const before = text.slice(0, idx);
    const lastBoundary = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("!"),
      before.lastIndexOf("?"),
      before.lastIndexOf("\n")
    );
    const segmentBeforeMatch = before.slice(lastBoundary + 1);

    if (SENTENCE_BOUNDARY.test(before) && segmentBeforeMatch.trim().length === 0) {
      match = NAME_PATTERN.exec(text);
      continue;
    }

    if (segmentBeforeMatch.trim().length > 0) {
      NAME_PATTERN.lastIndex = 0;
      return true;
    }

    match = NAME_PATTERN.exec(text);
  }

  NAME_PATTERN.lastIndex = 0;
  return false;
}

// Avalia múltiplos textos e retorna `true` se qualquer um disparar a detecção.
export function evaluationHasPotentialPersonalName(evaluation) {
  if (!evaluation || typeof evaluation !== "object") return false;

  const candidateTexts = [
    evaluation.generalComment,
    evaluation.commentRating,
    evaluation.commentSalario,
    evaluation.commentBeneficios,
    evaluation.commentCultura,
    evaluation.commentOportunidades,
    evaluation.commentInovacao,
    evaluation.commentLideranca,
    evaluation.commentDiversidade,
    evaluation.commentDiscriminacao,
    evaluation.commentCargaHoraria,
    evaluation.commentCrescimento,
    evaluation.commentAmbiente,
    evaluation.commentEquilibrio,
    evaluation.commentReconhecimento,
    evaluation.commentComunicacao,
    evaluation.commentEtica,
    evaluation.commentDesenvolvimento,
    evaluation.commentSaudeBemEstar,
    evaluation.commentImpactoSocial,
    evaluation.commentReputacao,
    evaluation.commentEstimacaoOrganizacao,
  ];

  return candidateTexts.some((text) => containsPossiblePersonName(text));
}
