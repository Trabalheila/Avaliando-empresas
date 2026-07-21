// src/data/occupationalDiseases.js
//
// Doenças ocupacionais reconhecidas pelo CID-10 relevantes à Psicologia do
// Trabalho. Usadas na "Identificação do Caso" (checkboxes) da anamnese do
// especialista psicólogo e no filtro de "Clientes em busca de atendimento".

// Lista principal de doenças/agravos ocupacionais (CID-10) usada nos
// checkboxes de identificação do caso.
export const OCCUPATIONAL_DISEASES = [
  { code: "Z73.0", label: "Síndrome de Burnout (esgotamento profissional)", category: "burnout" },
  { code: "F41", label: "Transtorno de Ansiedade", category: "ansiedade" },
  { code: "F32", label: "Depressão relacionada ao trabalho", category: "depressao" },
  { code: "F43.1", label: "Transtorno do Estresse Pós-Traumático (TEPT)", category: "condicoes" },
  { code: "F43.2", label: "Transtorno de Adaptação", category: "condicoes" },
  { code: "Z56.5", label: "Assédio moral / incompatibilidade com o trabalho", category: "assedio" },
  { code: "F43.0", label: "Reação aguda ao estresse", category: "condicoes" },
  { code: "F33", label: "Transtorno depressivo recorrente", category: "depressao" },
  { code: "F48.0", label: "Neurastenia (síndrome de fadiga)", category: "condicoes" },
  { code: "Z56.3", label: "Ritmo de trabalho penoso", category: "condicoes" },
  { code: "Z56.6", label: "Outras dificuldades físicas e mentais no trabalho", category: "condicoes" },
  { code: "F10.2", label: "Alcoolismo crônico relacionado ao trabalho", category: "outros" },
  { code: "G47", label: "Distúrbios do sono relacionados ao trabalho", category: "condicoes" },
];

// Categorias de problema usadas nos filtros de "Clientes em busca de
// atendimento". Cada categoria traz palavras-chave para casar com o texto
// livre das avaliações do trabalhador.
export const PROBLEM_CATEGORIES = [
  {
    value: "burnout",
    label: "Burnout",
    keywords: ["burnout", "esgotamento", "exaust", "sobrecarga", "esgotad"],
  },
  {
    value: "assedio",
    label: "Assédio",
    keywords: ["assédio", "assedio", "humilha", "constrang", "moral", "importun"],
  },
  {
    value: "ansiedade",
    label: "Ansiedade",
    keywords: ["ansiedade", "ansios", "pânico", "panico", "nervos", "angústia", "angustia"],
  },
  {
    value: "depressao",
    label: "Depressão",
    keywords: ["depress", "tristeza", "desânimo", "desanimo", "vazio", "sem sentido"],
  },
  {
    value: "lideranca",
    label: "Conflitos com liderança",
    keywords: ["chefe", "gestor", "líder", "lider", "gerente", "liderança", "lideranca", "supervisor"],
  },
  {
    value: "condicoes",
    label: "Condições de trabalho",
    keywords: ["jornada", "hora extra", "condições", "condicoes", "insalubr", "estresse", "estress", "pressão", "pressao", "carga"],
  },
  { value: "outros", label: "Outros", keywords: [] },
];

// Palavras-chave gerais que indicam sofrimento/saúde mental no trabalho,
// usadas para incluir um trabalhador na lista mesmo quando o score é >= 3.0.
export const MENTAL_HEALTH_KEYWORDS = PROBLEM_CATEGORIES.flatMap(
  (c) => c.keywords
);

// Detecta a categoria de problema predominante em um texto livre. Retorna o
// `value` da categoria ou "outros" quando nada casa.
export function detectProblemCategory(text) {
  const t = String(text || "").toLowerCase();
  for (const cat of PROBLEM_CATEGORIES) {
    if (cat.keywords.some((kw) => t.includes(kw))) return cat.value;
  }
  return "outros";
}

// Indica se um texto contém sinais de sofrimento/saúde mental no trabalho.
export function mentionsMentalHealth(text) {
  const t = String(text || "").toLowerCase();
  return MENTAL_HEALTH_KEYWORDS.some((kw) => t.includes(kw));
}
