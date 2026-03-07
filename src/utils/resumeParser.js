import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

const EDUCATION_RANKING = [
  { label: "Sem estudo", weight: 0, pattern: /(sem estudo|sem escolaridade)/i },
  { label: "Ensino Fundamental", weight: 1, pattern: /(ensino fundamental|fundamental incompleto|fundamental completo)/i },
  { label: "Ensino Medio", weight: 2, pattern: /(ensino medio|segundo grau|colegial)/i },
  { label: "Tecnico", weight: 3, pattern: /(tecnico|tecnologo|curso tecnico)/i },
  { label: "Bacharel", weight: 4, pattern: /(bacharel|graduacao|ensino superior|licenciatura)/i },
  { label: "Pos-graduacao", weight: 5, pattern: /(pos[-\s]?gradu|especializa|mba)/i },
  { label: "Mestrado", weight: 6, pattern: /mestrad/i },
  { label: "Doutorado", weight: 7, pattern: /doutorad/i },
];

const RESUME_SECTION_TITLES = [
  "objetivo",
  "objetivo profissional",
  "formacao",
  "formacao academica",
  "experiencia",
  "experiencia profissional",
  "dados pessoais",
  "contato",
  "competencias",
  "habilidades",
];

function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanLine(line) {
  return (line || "")
    .replace(/^[\s\-•*]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHeading(line) {
  const normalized = normalizeText(line);
  return RESUME_SECTION_TITLES.some((title) => normalized.includes(normalizeText(title)));
}

function firstMeaningfulLine(lines) {
  const candidate = (lines || []).slice(0, 12).find((line) => {
    const l = cleanLine(line);
    if (!l) return false;
    if (l.length < 5 || l.length > 80) return false;
    if (/\d{3,}/.test(l)) return false;
    const lower = normalizeText(l);
    if (lower.includes("curriculo") || lower.includes("resume")) return false;
    if (lower.includes("email") || lower.includes("telefone") || lower.includes("linkedin")) return false;
    if (looksLikeHeading(l)) return false;
    return l.split(" ").length >= 2;
  });

  return candidate ? cleanLine(candidate) : "";
}

function extractSection(lines, sectionPattern) {
  const startIndex = lines.findIndex((line) => sectionPattern.test(normalizeText(line)));
  if (startIndex < 0) return [];

  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const current = cleanLine(lines[i]);
    if (!current) {
      collected.push("");
      continue;
    }
    if (looksLikeHeading(current)) break;
    collected.push(current);
  }

  return collected;
}

function extractObjective(lines) {
  const objectiveLines = extractSection(lines, /objetivo/);
  const compact = objectiveLines
    .filter(Boolean)
    .slice(0, 4)
    .join("\n")
    .trim();
  return compact || "Nao identificado";
}

function extractHighestEducation(text) {
  const matches = EDUCATION_RANKING.filter((item) => item.pattern.test(text));
  if (!matches.length) return { label: "Sem estudo", weight: 0 };
  return matches.sort((a, b) => b.weight - a.weight)[0];
}

function extractProfession(lines) {
  const roleLine = (lines || []).find((line) => {
    const normalized = normalizeText(line);
    return (
      normalized.includes("cargo") ||
      normalized.includes("profissao") ||
      normalized.includes("funcao") ||
      normalized.includes("analista") ||
      normalized.includes("engenheiro") ||
      normalized.includes("desenvolvedor") ||
      normalized.includes("coordenador") ||
      normalized.includes("gerente")
    );
  });

  if (!roleLine) return "Nao identificado";
  return cleanLine(roleLine).replace(/^(cargo|profissao|funcao)\s*[:-]?\s*/i, "") || "Nao identificado";
}

function splitExperienceBlocks(text) {
  return (text || "")
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map(cleanLine)
        .filter(Boolean)
    )
    .filter((block) => block.length);
}

function inferCompanyFromBlock(lines, knownCompaniesMap) {
  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    for (const [normalizedCompany, originalCompany] of knownCompaniesMap.entries()) {
      if (normalizedLine.includes(normalizedCompany)) return originalCompany;
    }
  }

  const first = cleanLine(lines[0] || "");
  if (!first || looksLikeHeading(first) || /\b(19|20)\d{2}\b/.test(first)) return "";
  return first;
}

function inferRoleFromBlock(lines) {
  const candidates = lines.filter((line) => !looksLikeHeading(line));
  const roleLine = candidates.find((line, idx) => {
    if (idx === 0) return false;
    const normalized = normalizeText(line);
    return (
      normalized.includes("cargo") ||
      normalized.includes("funcao") ||
      normalized.includes("analista") ||
      normalized.includes("assistente") ||
      normalized.includes("engenheiro") ||
      normalized.includes("gerente") ||
      normalized.includes("coordenador") ||
      normalized.includes("estagi") ||
      normalized.includes("desenvolvedor")
    );
  });

  if (roleLine) return cleanLine(roleLine).replace(/^(cargo|funcao)\s*[:-]?\s*/i, "");
  return cleanLine(candidates[1] || "") || "Nao identificado";
}

function extractExperiences(text, lines, knownCompanies = []) {
  const normalizedCompaniesMap = new Map(
    (knownCompanies || []).filter(Boolean).map((name) => [normalizeText(name), name])
  );

  const sectionLines = extractSection(lines, /experiencia/);
  const sourceText = sectionLines.length ? sectionLines.join("\n") : text;
  const blocks = splitExperienceBlocks(sourceText);

  const structured = blocks
    .map((block) => {
      const company = inferCompanyFromBlock(block, normalizedCompaniesMap);
      const role = inferRoleFromBlock(block);
      const details = block.slice(2).join(" | ");
      if (!company) return null;
      return { company: company.trim(), role: role || "Nao identificado", details: details || "" };
    })
    .filter(Boolean);

  const knownMatches = Array.from(normalizedCompaniesMap.entries())
    .filter(([normalized]) => normalizeText(text).includes(normalized))
    .map(([, original]) => ({ company: original, role: "Nao identificado", details: "" }));

  const merged = [...structured, ...knownMatches];
  const uniqueMap = new Map();
  merged.forEach((exp) => {
    const key = `${normalizeText(exp.company)}__${normalizeText(exp.role)}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, exp);
  });

  return Array.from(uniqueMap.values());
}

async function readPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();

  // Avoid runtime error: No "GlobalWorkerOptions.workerSrc" specified.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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
  const text = (rawText || "").replace(/\r/g, "");
  const compactText = text.replace(/\s+/g, " ");
  const lines = text.split("\n").map(cleanLine).filter(Boolean);

  const emailMatch = compactText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const linkedInMatch = compactText.match(/https?:\/\/(www\.)?linkedin\.com\/[\w\-/?=&%.]+/i);
  const cpfMatch = compactText.match(/\b\d{3}[.-]?\d{3}[.-]?\d{3}[-]?\d{2}\b/);
  const phoneMatch = compactText.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}|\d{4})[-\s]?\d{4}/);

  const name = firstMeaningfulLine(lines);
  const objective = extractObjective(lines);
  const latestEducation = extractHighestEducation(text);
  const profession = extractProfession(lines);
  const experiencesStructured = extractExperiences(text, text.split("\n"), knownCompanies);
  const experiences = Array.from(new Set(experiencesStructured.map((item) => item.company).filter(Boolean)));
  const matchedCompanies = experiences.slice();
  const educationSummary = `${latestEducation.label} - ${profession}`;

  return {
    rawText: text,
    name,
    objective,
    email: emailMatch?.[0] || "",
    linkedInUrl: linkedInMatch?.[0] || "",
    cpf: (cpfMatch?.[0] || "").replace(/\D/g, ""),
    phone: phoneMatch?.[0] || "",
    educationLevel: latestEducation.label,
    profession,
    educationSummary,
    experiences,
    experiencesStructured,
    matchedCompanies,
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
