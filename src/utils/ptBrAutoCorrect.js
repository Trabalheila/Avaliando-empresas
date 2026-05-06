// src/utils/ptBrAutoCorrect.js
// ------------------------------------------------------------------
// Autocorretor leve pt-BR para campos de texto.
// Foco: erros de digitação reais e palavras digitadas sem acento.
// Estratégia: dispara quando o usuário insere um caractere de fronteira
// de palavra (espaço, pontuação, quebra de linha) e corrige a palavra
// imediatamente anterior, preservando capitalização.
//
// Sem dependências externas. Mantenha o dicionário enxuto para evitar
// falsos positivos.

const CORRECTIONS = {
  // ---------- pronomes / advérbios comuns sem acento ----------
  voce: "você",
  voces: "vocês",
  ja: "já",
  ate: "até",
  tres: "três",
  alem: "além",
  apos: "após",
  atras: "atrás",
  atraves: "através",
  porem: "porém",
  tambem: "também",
  ninguem: "ninguém",
  alguem: "alguém",
  parabens: "parabéns",
  ambito: "âmbito",

  // ---------- verbos comuns ----------
  nao: "não",
  naum: "não",
  estao: "estão",
  serao: "serão",
  irao: "irão",
  farao: "farão",
  terao: "terão",
  virao: "virão",
  poderao: "poderão",
  saberao: "saberão",
  sao: "são",
  vao: "vão",
  vc: "você",
  vcs: "vocês",
  pq: "porque",
  tbm: "também",
  tb: "também",
  obg: "obrigado",
  obgda: "obrigada",

  // ---------- substantivos com -ção / -são ----------
  atencao: "atenção",
  intencao: "intenção",
  intencoes: "intenções",
  opcao: "opção",
  opcoes: "opções",
  decisao: "decisão",
  decisoes: "decisões",
  discussao: "discussão",
  discussoes: "discussões",
  missao: "missão",
  visao: "visão",
  razao: "razão",
  razoes: "razões",
  questao: "questão",
  questoes: "questões",
  situacao: "situação",
  situacoes: "situações",
  informacao: "informação",
  informacoes: "informações",
  organizacao: "organização",
  organizacoes: "organizações",
  comunicacao: "comunicação",
  educacao: "educação",
  remuneracao: "remuneração",
  negociacao: "negociação",
  negociacoes: "negociações",
  avaliacao: "avaliação",
  avaliacoes: "avaliações",
  operacao: "operação",
  operacoes: "operações",
  obrigacao: "obrigação",
  obrigacoes: "obrigações",
  condicao: "condição",
  condicoes: "condições",
  posicao: "posição",
  posicoes: "posições",
  selecao: "seleção",
  direcao: "direção",
  execucao: "execução",
  evolucao: "evolução",
  solucao: "solução",
  solucoes: "soluções",
  atuacao: "atuação",
  duracao: "duração",
  geracao: "geração",
  comissao: "comissão",
  comissoes: "comissões",
  demissao: "demissão",
  demissoes: "demissões",
  promocao: "promoção",
  promocoes: "promoções",
  reuniao: "reunião",
  reunioes: "reuniões",
  funcao: "função",
  funcoes: "funções",
  contribuicao: "contribuição",
  contribuicoes: "contribuições",
  reducao: "redução",
  introducao: "introdução",
  producao: "produção",
  manutencao: "manutenção",
  retencao: "retenção",
  formacao: "formação",
  contratacao: "contratação",
  contratacoes: "contratações",

  // ---------- substantivos com -ência / -ância ----------
  experiencia: "experiência",
  experiencias: "experiências",
  ciencia: "ciência",
  ciencias: "ciências",
  consciencia: "consciência",
  competencia: "competência",
  competencias: "competências",
  preferencia: "preferência",
  preferencias: "preferências",
  consequencia: "consequência",
  consequencias: "consequências",
  frequencia: "frequência",
  sequencia: "sequência",
  agencia: "agência",
  tendencia: "tendência",
  tendencias: "tendências",
  presenca: "presença",
  ausencia: "ausência",
  paciencia: "paciência",
  excelencia: "excelência",
  diferenca: "diferença",
  diferencas: "diferenças",
  lideranca: "liderança",
  comeco: "começo",
  esperanca: "esperança",
  mudanca: "mudança",
  mudancas: "mudanças",
  cobranca: "cobrança",
  cobrancas: "cobranças",

  // ---------- adjetivos comuns ----------
  facil: "fácil",
  dificil: "difícil",
  rapido: "rápido",
  rapida: "rápida",
  publico: "público",
  publica: "pública",
  proprio: "próprio",
  propria: "própria",
  pratico: "prático",
  pratica: "prática",
  etico: "ético",
  etica: "ética",
  ultimo: "último",
  ultima: "última",
  proximo: "próximo",
  proxima: "próxima",
  minimo: "mínimo",
  minima: "mínima",
  maximo: "máximo",
  maxima: "máxima",
  otimo: "ótimo",
  otima: "ótima",
  pessimo: "péssimo",
  pessima: "péssima",
  unico: "único",
  unica: "única",
  basico: "básico",
  basica: "básica",
  tecnico: "técnico",
  tecnica: "técnica",
  logico: "lógico",
  logica: "lógica",
  flexivel: "flexível",
  responsavel: "responsável",
  agradavel: "agradável",
  desagradavel: "desagradável",
  inacreditavel: "inacreditável",
  imprevisivel: "imprevisível",

  // ---------- substantivos comuns com acento ----------
  salario: "salário",
  salarios: "salários",
  horario: "horário",
  horarios: "horários",
  necessario: "necessário",
  necessaria: "necessária",
  trafego: "tráfego",
  credito: "crédito",
  debito: "débito",
  video: "vídeo",
  audio: "áudio",
  midia: "mídia",
  saude: "saúde",
  pais: "país",
  paises: "países",
  beneficio: "benefício",
  beneficios: "benefícios",
  oficio: "ofício",
  oficios: "ofícios",
  ferias: "férias",
  estagio: "estágio",
  estagios: "estágios",
  servico: "serviço",
  servicos: "serviços",
  almoco: "almoço",
  cafe: "café",
  area: "área",
  areas: "áreas",

  // ---------- regiões e plurais em -ão ----------
  regiao: "região",
  regioes: "regiões",
  irmao: "irmão",
  irmaos: "irmãos",
  patrao: "patrão",
  patroes: "patrões",
  amanha: "amanhã",
  amanhas: "amanhãs",

  // ---------- typos físicos comuns ----------
  qeu: "que",
  euq: "que",
  comoa: "como a",
  emrpesa: "empresa",
  empersa: "empresa",
  emperesa: "empresa",
  ambeinte: "ambiente",
  amviente: "ambiente",
  trbalho: "trabalho",
  trabalo: "trabalho",
  travalho: "trabalho",
  muinto: "muito",
  muto: "muito",
};

// Palavras que NÃO devem ser corrigidas mesmo se aparecerem no dicionário
// (ex.: a sigla "DA" maiúscula é um nome próprio frequente — preservamos
// se o usuário digitou em maiúsculas).
function shouldSkipByCase(originalWord) {
  // se está em CAIXA ALTA (sigla), não corrige
  return originalWord.length > 1 && originalWord === originalWord.toUpperCase();
}

const WORD_BOUNDARY = /[\s.,;:!?)\]}"'»]/;
const LETTER_RUN = /[A-Za-zÀ-ÖØ-öø-ÿ]+$/;

function matchCase(originalWord, correctedWord) {
  if (!originalWord) return correctedWord;
  // CAIXA ALTA → "VOCE" → "VOCÊ"
  if (originalWord === originalWord.toUpperCase()) return correctedWord.toUpperCase();
  // Capitalizada → "Voce" → "Você"
  if (originalWord[0] === originalWord[0].toUpperCase()) {
    return correctedWord[0].toUpperCase() + correctedWord.slice(1);
  }
  return correctedWord;
}

/**
 * Tenta aplicar autocorreção quando o valor mudou de `prev` para `next`.
 * Retorna { value, caret } se houver correção, senão null.
 *
 * Regras:
 *  - O usuário deve ter inserido exatamente UM caractere (digitação normal).
 *  - O caractere inserido deve ser uma fronteira de palavra.
 *  - A palavra anterior (somente letras) precisa estar no dicionário.
 *  - Não corrige palavras totalmente em CAIXA ALTA (siglas).
 */
export function applyAutoCorrect(prev, next, caretPos) {
  if (typeof prev !== "string" || typeof next !== "string") return null;
  if (next.length !== prev.length + 1) return null;
  if (caretPos == null || caretPos < 1 || caretPos > next.length) return null;

  const inserted = next[caretPos - 1];
  if (!WORD_BOUNDARY.test(inserted)) return null;

  // Confirma que a inserção realmente ocorreu na posição do caret
  // (evita corrigir colagens ou edições no meio do texto).
  if (next.slice(0, caretPos - 1) !== prev.slice(0, caretPos - 1)) return null;

  const before = next.slice(0, caretPos - 1);
  const match = before.match(LETTER_RUN);
  if (!match) return null;

  const word = match[0];
  if (word.length < 2) return null;
  if (shouldSkipByCase(word)) return null;

  const lower = word.toLowerCase();
  const corrected = CORRECTIONS[lower];
  if (!corrected || corrected.toLowerCase() === lower) return null;

  const cased = matchCase(word, corrected);
  const start = before.length - word.length;
  const newValue = next.slice(0, start) + cased + next.slice(before.length);
  const newCaret = caretPos + (cased.length - word.length);

  return { value: newValue, caret: newCaret, original: word, replacement: cased };
}

/**
 * Helper para usar dentro de um onChange de <textarea> controlado.
 * Aplica autocorreção quando aplicável e atualiza o caret no próximo frame.
 */
export function handleAutoCorrectChange(event, prevValue, setValue) {
  const el = event.target;
  const next = el.value;
  const caret = el.selectionStart;
  const result = applyAutoCorrect(prevValue, next, caret);
  if (result) {
    setValue(result.value);
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(result.caret, result.caret);
      } catch {
        /* noop */
      }
    });
    return result;
  }
  setValue(next);
  return null;
}

// ──────────────────────────────────────────────────────────────────
// Sugestões de correção em tempo real
// ──────────────────────────────────────────────────────────────────
//
// `findSpellingSuggestions(text)` percorre as palavras do texto e identifica
// candidatos a correção usando o mesmo dicionário de `applyAutoCorrect`.
// Retorna no máximo `limit` ocorrências.
//
// `applySuggestion(text, suggestion)` retorna o novo texto + posição do
// caret após substituir a palavra original pela correção, preservando
// capitalização original.

const WORD_TOKEN_REGEX = /\b[A-Za-zÀ-ÖØ-öø-ÿ]{2,}\b/g;

export function findSpellingSuggestions(text, { limit = 8 } = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const out = [];
  WORD_TOKEN_REGEX.lastIndex = 0;
  let match;
  while ((match = WORD_TOKEN_REGEX.exec(text)) !== null) {
    const word = match[0];
    if (shouldSkipByCase(word)) continue;
    const lower = word.toLowerCase();
    const corrected = CORRECTIONS[lower];
    if (!corrected || corrected.toLowerCase() === lower) continue;
    const replacement = matchCase(word, corrected);
    out.push({
      original: word,
      replacement,
      start: match.index,
      end: match.index + word.length,
    });
    if (out.length >= limit) break;
  }
  WORD_TOKEN_REGEX.lastIndex = 0;
  return out;
}

export function applySuggestion(text, suggestion) {
  if (!suggestion || typeof text !== "string") return null;
  const { start, end, replacement } = suggestion;
  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    start < 0 ||
    end > text.length ||
    end <= start
  ) {
    return null;
  }
  const value = text.slice(0, start) + replacement + text.slice(end);
  const caret = start + replacement.length;
  return { value, caret };
}
