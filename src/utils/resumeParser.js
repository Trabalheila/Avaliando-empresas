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

  const companyLine =
    knownCompany ||
    filtered.find((line) => {
      if (line === periodLine) return false;
      if (ROLE_HINT_PATTERN.test(line)) return false;
      if (DATE_RANGE_PATTERN.test(line)) return false;
      return COMPANY_HINT_PATTERN.test(line) || line.split(" ").length >= 2;
    }) ||
    "";

  const roleLine =
    filtered.find((line) => {
      if (line === companyLine || line === periodLine) return false;
      return ROLE_HINT_PATTERN.test(line);
    }) ||
    "Nao identificado";

  const details = filtered
    .filter((line) => line !== companyLine && line !== roleLine && line !== periodLine)
    .slice(0, 4)
    .join(" | ");

  let confidence = 0;
  if (companyLine) confidence += 0.45;
  if (roleLine && roleLine !== "Nao identificado") confidence += 0.25;
  if (periodLine) confidence += 0.2;
  if (details) confidence += 0.1;

  const confidenceLevel = confidence >= 0.75 ? "alta" : confidence >= 0.5 ? "media" : "baixa";

  if (!companyLine && roleLine === "Nao identificado" && !periodLine) return null;

  return {
    company: companyLine || "Nao identificado",
    role: roleLine,
    period: periodLine,
    details,
    confidence,
    confidenceLevel,
  };
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
    new Set(experiencesStructured.map((item) => item.company).filter((value) => value && value !== "Nao identificado"))
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
