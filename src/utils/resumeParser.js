import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Prevent runtime error: No "GlobalWorkerOptions.workerSrc" specified.
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

function normalizeText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function readPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  let doc;

  try {
    doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch {
    // Fallback if worker cannot be loaded in restricted environments.
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

  const emailMatch = compactText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const linkedInMatch = compactText.match(/https?:\/\/(www\.)?linkedin\.com\/[\w\-/?=&%.]+/i);
  const cpfMatch = compactText.match(/\b\d{3}[.-]?\d{3}[.-]?\d{3}[-]?\d{2}\b/);
  const phoneMatch = compactText.match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}|\d{4})[-\s]?\d{4}/);

  const educationKeywords = [
    { level: "Pos-graduacao", pattern: /(pos[-\s]?gradu|mba|especializa)/i },
    { level: "Mestrado", pattern: /mestrad/i },
    { level: "Doutorado", pattern: /doutorad/i },
    { level: "Ensino Superior", pattern: /(graduacao|bacharel|licenciatura|tecnologo|ensino superior)/i },
    { level: "Ensino Medio", pattern: /ensino medio/i },
  ];

  const educationLevel =
    educationKeywords.find((item) => item.pattern.test(text))?.level || "Nao identificado";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const experienceCandidates = lines.filter((line) => {
    const normalized = normalizeText(line);
    return (
      normalized.includes("experiencia") ||
      normalized.includes("empresa") ||
      normalized.includes("trabalhou") ||
      /\b(19|20)\d{2}\b/.test(line)
    );
  });

  const normalizedCompanies = (knownCompanies || [])
    .map((name) => name?.toString().trim())
    .filter(Boolean);

  const companyMatches = normalizedCompanies.filter((companyName) => {
    const normalizedName = normalizeText(companyName);
    return normalizedName && normalizeText(text).includes(normalizedName);
  });

  const experiences = Array.from(new Set([...experienceCandidates.slice(0, 10), ...companyMatches]));

  return {
    rawText: text,
    email: emailMatch?.[0] || "",
    linkedInUrl: linkedInMatch?.[0] || "",
    cpf: (cpfMatch?.[0] || "").replace(/\D/g, ""),
    phone: phoneMatch?.[0] || "",
    educationLevel,
    experiences,
    matchedCompanies: companyMatches,
  };
}

export function hasCompanyInResumeExperiences(companyName, resumeData) {
  if (!companyName || !resumeData) return false;
  const target = normalizeText(companyName);

  const pool = [
    ...(resumeData.experiences || []),
    ...(resumeData.matchedCompanies || []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return pool.some((entry) => entry.includes(target) || target.includes(entry));
}
