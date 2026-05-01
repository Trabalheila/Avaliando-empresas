import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

const SECTION_TITLES = [
  "objetivo",
  "objetivo profissional",
  "formacao",
  "formacao academica",
  "dados pessoais",
  "contato",
  "competencias",
  "habilidades",
  "idiomas",
  "cursos",
  "perfil",
  "resumo",
  "projetos",
  "certificacoes",
  "certificacoes e cursos",
];

const EXPERIENCE_SECTION_PATTERN =
  /experiencia|experiencia profissional|historico profissional|historico de experiencia/i;

const ROLE_HINT_PATTERN =
  /(cargo|funcao|analista|assistente|engenheir|desenvolvedor|gerente|coordenador|supervisor|estagi|tecnico|consultor|especialista|auxiliar)/i;

const COMPANY_HINT_PATTERN =
  /(ltda|s\/a|sa\b|eireli|mei|empresa|grupo|group|industria|comercio|comercial|consultoria|servicos|engenharia|hospital|clinica|instituto|prefeitura|secretaria|universidade|faculdade|banco)/i;

const DATE_RANGE_PATTERN =
  /\b((?:19|20)\d{2}|\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{4})\b\s*(?:a|ate|até|-|\/|\u2013|\u2014)\s*\b((?:19|20)\d{2}|atual|presente|\d{2}\/\d{4}|\d{2}\/\d{2}\/\d{4})\b/i;

const NOISE_LINE_PATTERN =
  /(linkedin\.com|github\.com|@|email|e-mail|telefone|celular|whatsapp|cpf|rg\b|endereco|rua\b|avenida\b|bairro|cep\b|contato)/i;

// Linhas que parecem fragmentos de frases descritivas ao invés de nomes de empresa/cargo.
// Ex.: "softwares com", "atualização das", "responsável por". Esses padrões são usados
// para rejeitar candidatos a empresa/cargo extraídos do PDF do LinkedIn.
const FRAGMENT_END_PATTERN =
  /\b(com|sem|de|da|do|das|dos|na|no|nas|nos|em|entre|para|por|a|o|e|ou|que|pela|pelo|pelas|pelos|sobre|ate|até)\s*[.,;:]?$/i;
const FRAGMENT_START_PATTERN =
  /^(responsavel|atualizacao|desenvolvimento|implementacao|criacao|elaboracao|gestao|coordenacao|operacao|softwares?|sistemas?|projetos?|atividades?|principais|realizei|executei|atuei|atuacao|liderei|particip(?:ei|acao)|apoio|suporte|manuten[cs]ao|gerenciamento)\b/i;
const LINKEDIN_DELIM = /\s[·•|]\s/; // "Empresa · Tempo integral" / "Empresa • Full-time"
const PT_LOWERCASE_STARTERS = new Set([
  "a", "o", "e", "de", "da", "do", "das", "dos", "em", "na", "no", "para", "por",
  "com", "sobre", "que", "se", "como", "mais", "muito", "todo", "toda", "todos",
]);
const NOT_IDENTIFIED_COMPANY = "Empresa não identificada";
const NOT_IDENTIFIED_ROLE = "Cargo não identificado";

// Padrões de dados sensíveis inline que podem aparecer dentro de linhas de texto livre.
const INLINE_CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const INLINE_PHONE_PATTERN = /\(?\d{2}\)?[\s-]?\d{4,5}[-\s]?\d{4}/g;
const INLINE_EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi;
const INLINE_CEP_PATTERN = /\b\d{5}-?\d{3}\b/g;

function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanLine(line) {
  return (line || "")
    .replace(/^[\s\-\u2022*]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSectionTitle(line) {
  const normalized = normalizeText(cleanLine(line));
  if (!normalized) return false;
  if (EXPERIENCE_SECTION_PATTERN.test(normalized)) return true;
  return SECTION_TITLES.some((title) => normalized.includes(normalizeText(title)));
}

function isNoiseLine(line) {
  const cleaned = cleanLine(line);
  if (!cleaned) return true;
  if (cleaned.length < 2) return true;
  if (NOISE_LINE_PATTERN.test(cleaned)) return true;
  return false;
}

// Heurística para descartar fragmentos de frases descritivas (ex: "softwares com",
// "atualização das") que o parser pode capturar dentro do bloco de experiência.
function looksLikeFragment(line) {
  const cleaned = cleanLine(line);
  if (!cleaned) return true;
  if (cleaned.length < 3) return true;

  const normalized = normalizeText(cleaned);

  // Termina em conector/preposição
  if (FRAGMENT_END_PATTERN.test(normalized)) return true;
  // Começa com verbo/substantivo genérico de descrição
  if (FRAGMENT_START_PATTERN.test(normalized)) return true;

  // Começa com palavra comum em minúsculo (ex: "com", "de", "para")
  const firstWord = normalized.split(/\s+/)[0] || "";
  const firstChar = cleaned[0];
  const startsLower = firstChar && firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase();
  if (startsLower && PT_LOWERCASE_STARTERS.has(firstWord)) return true;

  // Frase muito longa (> 8 palavras) raramente é nome de empresa ou cargo.
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount > 8) return true;

  return false;
}

function splitBlocks(lines) {
  const blocks = [];
  let current = [];

  for (const line of lines) {
    const cleaned = cleanLine(line);

    if (!cleaned) {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
      continue;
    }

    if (looksLikeSectionTitle(cleaned) && current.length) {
      blocks.push(current);
      current = [];
      continue;
    }

    current.push(cleaned);
  }

  if (current.length) blocks.push(current);
  return blocks;
}

function enhanceLineBreaks(rawText) {
  const text = (rawText || "").replace(/\r/g, "\n");
  if (!text) return "";

  // Some PDFs merge all text into one line; inject breaks around date ranges and common labels.
  return text
    .replace(/\s+(?=(?:experiencia|historico profissional|cargo|empresa)\s*:)/gi, "\n")
    .replace(/\s+(?=(?:19|20)\d{2}\s*(?:a|ate|até|-|\/|\u2013|\u2014)\s*(?:19|20)\d{2}|atual|presente)/gi, "\n")
    .replace(/\s+(?=\d{2}\/\d{4}\s*(?:a|ate|até|-|\/|\u2013|\u2014)\s*(?:\d{2}\/\d{4}|atual|presente))/gi, "\n");
}

function extractExperienceLines(rawText) {
  const enhancedText = enhanceLineBreaks(rawText);
  const lines = enhancedText.split("\n");
  const normalizedLines = lines.map(cleanLine);

  const start = normalizedLines.findIndex((line) => EXPERIENCE_SECTION_PATTERN.test(normalizeText(line)));
  if (start < 0) return normalizedLines;

  const collected = [];
  for (let idx = start + 1; idx < normalizedLines.length; idx += 1) {
    const line = normalizedLines[idx];

    if (!line) {
      collected.push("");
      continue;
    }

    if (!EXPERIENCE_SECTION_PATTERN.test(normalizeText(line)) && looksLikeSectionTitle(line)) {
      break;
    }

    collected.push(line);
  }

  return collected.length ? collected : normalizedLines;
}

function findKnownCompany(lines, knownCompaniesMap) {
  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    for (const [normalizedCompany, originalCompany] of knownCompaniesMap.entries()) {
      if (normalizedLine.includes(normalizedCompany)) return originalCompany;
    }
  }
  return "";
}

function parseExperienceBlock(lines, knownCompaniesMap) {
  const filtered = lines
    .map(cleanLine)
    .filter(Boolean)
    .filter((line) => !looksLikeSectionTitle(line))
    .filter((line) => !isNoiseLine(line));

  if (!filtered.length) return null;

  const periodLine = filtered.find((line) => DATE_RANGE_PATTERN.test(line)) || "";
  const knownCompany = findKnownCompany(filtered, knownCompaniesMap);

  // 1) Detecção estilo LinkedIn: linha contém " · " separando nome da empresa
  // do tipo de emprego (ex.: "Empresa X · Tempo integral").
  let linkedInCompany = "";
  let linkedInRole = "";
  for (const line of filtered) {
    if (DATE_RANGE_PATTERN.test(line)) continue;
    if (LINKEDIN_DELIM.test(line)) {
      const [first, second = ""] = line.split(LINKEDIN_DELIM).map((s) => s.trim());
      const tail = normalizeText(second);
      // Padrão clássico: "Empresa · Tempo integral|Meio período|Estagio|Freelance|Full-time|Part-time"
      if (/(tempo integral|meio periodo|meio per[ií]odo|estagi|freelance|aut[oó]nomo|full[-\s]time|part[-\s]time|contrato|temporario|terceirizado)/.test(tail)) {
        if (!linkedInCompany && !looksLikeFragment(first)) {
          linkedInCompany = first;
        }
      } else if (!linkedInRole && !looksLikeFragment(first) && ROLE_HINT_PATTERN.test(line)) {
        linkedInRole = first;
      }
    }
    if (linkedInCompany && linkedInRole) break;
  }

  const candidateCompany =
    knownCompany ||
    linkedInCompany ||
    filtered.find((line) => {
      if (line === periodLine) return false;
      if (ROLE_HINT_PATTERN.test(line)) return false;
      if (DATE_RANGE_PATTERN.test(line)) return false;
      if (looksLikeFragment(line)) return false;
      return COMPANY_HINT_PATTERN.test(line) || line.split(" ").length >= 2;
    }) ||
    "";

  const candidateRole =
    linkedInRole ||
    filtered.find((line) => {
      if (line === candidateCompany || line === periodLine) return false;
      if (looksLikeFragment(line)) return false;
      return ROLE_HINT_PATTERN.test(line);
    }) ||
    "";

  const companyLine = candidateCompany && !looksLikeFragment(candidateCompany) ? candidateCompany : "";
  const roleLine = candidateRole && !looksLikeFragment(candidateRole) ? candidateRole : "";

  const rawDetails = filtered
    .filter((line) => line !== companyLine && line !== roleLine && line !== periodLine)
    .slice(0, 4)
    .join(" | ");
  const details = scrubSensitiveFromDetails(rawDetails);

  let confidence = 0;
  if (companyLine) confidence += 0.45;
  if (roleLine) confidence += 0.25;
  if (periodLine) confidence += 0.2;
  if (details) confidence += 0.1;

  const confidenceLevel = confidence >= 0.75 ? "alta" : confidence >= 0.5 ? "media" : "baixa";

  if (!companyLine && !roleLine && !periodLine) return null;

  return {
    company: companyLine || NOT_IDENTIFIED_COMPANY,
    role: roleLine || NOT_IDENTIFIED_ROLE,
    period: periodLine,
    periodNormalized: normalizePeriod(periodLine),
    details,
    confidence,
    confidenceLevel,
  };
}

/**
 * Normaliza o período bruto extraído do currículo para o formato "AAAA-AAAA" ou "AAAA-Atual".
 * Exemplos:
 *   "03/2020 - atual"  → "2020-Atual"
 *   "2018 a 2021"      → "2018-2021"
 *   "jan de 2019"      → "2019"
 */
function normalizePeriod(raw) {
  if (!raw) return "";
  const text = raw.toString().trim();
  const isCurrent = /atual|presente|current|momento/i.test(text);
  const years = Array.from(text.matchAll(/\b((?:19|20)\d{2})\b/g)).map((m) => m[1]);

  if (years.length >= 2) {
    const start = years[0];
    const end = isCurrent ? "Atual" : years[years.length - 1];
    return `${start}-${end}`;
  }
  if (years.length === 1) {
    return isCurrent ? `${years[0]}-Atual` : years[0];
  }
  if (isCurrent) return "Atual";
  return text;
}

/**
 * Remove dados sensíveis que possam aparecer inline dentro de campos de texto livre
 * (ex: CPF, telefone, e-mail, CEP embutidos em uma descrição de cargo).
 */
function scrubSensitiveFromDetails(text) {
  return (text || "")
    .replace(INLINE_CPF_PATTERN, "")
    .replace(INLINE_PHONE_PATTERN, "")
    .replace(INLINE_EMAIL_PATTERN, "")
    .replace(INLINE_CEP_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function deduplicateExperiences(items) {
  const map = new Map();

  for (const item of items) {
    const key = [normalizeText(item.company), normalizeText(item.role), normalizeText(item.period)].join("__");
    if (!map.has(key)) map.set(key, item);
  }

  return Array.from(map.values());
}

function extractExperiences(rawText, knownCompanies = []) {
  const knownCompaniesMap = new Map(
    (knownCompanies || [])
      .filter(Boolean)
      .map((company) => [normalizeText(company), company])
  );

  const experienceLines = extractExperienceLines(rawText);
  const blocks = splitBlocks(experienceLines);

  const parsed = blocks
    .map((block) => parseExperienceBlock(block, knownCompaniesMap))
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);

  const experiencesStructured = deduplicateExperiences(parsed);
  const experiences = Array.from(
    new Set(
      experiencesStructured
        .map((item) => item.company)
        .filter((value) => value && value !== NOT_IDENTIFIED_COMPANY)
    )
  );

  return {
    experiencesStructured,
    experiences,
    experienceText: experienceLines.filter(Boolean).join("\n"),
  };
}

async function readPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();

  // Avoid runtime error: No "GlobalWorkerOptions.workerSrc" specified.
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch {
    doc = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
  }

  let fullText = "";
  for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex += 1) {
    const page = await doc.getPage(pageIndex);
    const content = await page.getTextContent();
    const pageText = (content.items || []).map((item) => item.str || "").join(" ");
    fullText += `${pageText}\n`;
  }

  return fullText;
}

async function readDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

async function readPlainText(file) {
  return file.text();
}

export async function extractResumeText(file) {
  if (!file) return "";

  const lowerName = (file.name || "").toLowerCase();

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    return readPdfText(file);
  }

  if (
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return readDocxText(file);
  }

  if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".rtf") ||
    file.type.startsWith("text/")
  ) {
    return readPlainText(file);
  }

  throw new Error("Formato ainda nao suportado para leitura automatica. Use PDF, DOCX, TXT, MD ou RTF.");
}

export { normalizePeriod };

export function parseResumeText(rawText, knownCompanies = []) {
  const text = (rawText || "").replace(/\r/g, "\n");
  const { experiencesStructured, experiences, experienceText } = extractExperiences(text, knownCompanies);

  return {
    rawText: "",
    experienceText,
    name: "",
    objective: "",
    email: "",
    linkedInUrl: "",
    cpf: "",
    phone: "",
    educationLevel: "",
    profession: "",
    educationSummary: "",
    experiences,
    experiencesStructured,
    matchedCompanies: experiences,
  };
}

export function hasCompanyInResumeExperiences(companyName, resumeData) {
  if (!companyName || !resumeData) return false;
  const target = normalizeText(companyName);

  const pool = [
    ...(resumeData.experiences || []),
    ...(resumeData.matchedCompanies || []),
    ...((resumeData.experiencesStructured || []).map((item) => item.company)),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return pool.some((entry) => entry.includes(target) || target.includes(entry));
}
