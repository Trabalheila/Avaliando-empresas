// api/parse-cv.js
// Endpoint serverless (Vercel) — extrai experiências profissionais
// estruturadas de um currículo (PDF ou DOCX) usando o Google Gemini.
//
// Contrato:
//   POST /api/parse-cv
//   body JSON: { filename: string, mimeType: string, base64: string }
//   resp 200: { experiencias: [{ empresa, funcao, data_inicio, data_fim }] }
//   resp 4xx/5xx: { error: string }
//
// Decisões:
//   - PDF: vai direto pro Gemini como inlineData (multimodal).
//   - DOCX: extraído com `mammoth` -> texto -> Gemini.
//   - JSON Mode (responseMimeType + schema) garante shape estável.
//   - Tamanho máximo: 4 MB (limite prático do Vercel + custo do LLM).
//   - Nenhuma escrita no Firestore — só devolve o JSON pro usuário
//     revisar/aprovar antes de salvar.

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: { sizeLimit: "5mb" },
  },
};

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
const MODEL_NAME =
  process.env.GEMINI_CV_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-2.0-flash";

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    experiencias: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          empresa: { type: SchemaType.STRING },
          funcao: { type: SchemaType.STRING },
          data_inicio: { type: SchemaType.STRING },
          data_fim: { type: SchemaType.STRING },
        },
        required: ["empresa", "funcao"],
      },
    },
  },
  required: ["experiencias"],
};

const SYSTEM_PROMPT = `Você extrai histórico profissional de currículos.
Devolva APENAS JSON no schema definido.
Para cada experiência, preencha:
- empresa: nome oficial da empresa, sem cargo nem cidade.
- funcao: cargo/função exercida.
- data_inicio: formato "AAAA-MM" sempre que possível.
- data_fim: formato "AAAA-MM" ou a string "Atual" se for o emprego atual.
Ignore seções de educação, cursos, idiomas, habilidades, projetos pessoais,
voluntariado sem empresa nomeada. Não invente datas — omita o campo se
não houver indicação clara. Não duplique experiências.`;

function readJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

async function extractDocxText(buffer) {
  const mammoth = (await import("mammoth")).default || (await import("mammoth"));
  const result = await mammoth.extractRawText({ buffer });
  return String(result?.value || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não configurada.");
    return res.status(500).json({ error: "Servidor sem chave Gemini." });
  }

  const { filename, mimeType, base64 } = readJsonBody(req);

  if (!base64 || typeof base64 !== "string") {
    return res.status(400).json({ error: "Campo base64 é obrigatório." });
  }
  const mt = String(mimeType || "").toLowerCase();
  const isPdf = mt === "application/pdf" || /\.pdf$/i.test(filename || "");
  const isDocx =
    mt ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(filename || "");

  if (!isPdf && !isDocx) {
    return res
      .status(415)
      .json({ error: "Formato não suportado. Envie PDF ou DOCX." });
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ error: "Base64 inválido." });
  }
  if (!buffer.length) {
    return res.status(400).json({ error: "Arquivo vazio." });
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return res
      .status(413)
      .json({ error: "Arquivo maior que 4MB. Compacte ou envie um trecho." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
      },
    });

    let result;
    if (isPdf) {
      result = await model.generateContent([
        { text: "Extraia o histórico profissional deste currículo." },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: buffer.toString("base64"),
          },
        },
      ]);
    } else {
      const text = await extractDocxText(buffer);
      if (!text) {
        return res
          .status(422)
          .json({ error: "Não consegui ler o conteúdo do DOCX." });
      }
      result = await model.generateContent([
        {
          text: `Extraia o histórico profissional do texto abaixo.\n\n---\n${text.slice(
            0,
            60000
          )}\n---`,
        },
      ]);
    }

    const raw = result?.response?.text?.() || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("Gemini não retornou JSON válido:", raw.slice(0, 300));
      return res
        .status(502)
        .json({ error: "Resposta da IA não veio em JSON. Tente novamente." });
    }

    const list = Array.isArray(parsed?.experiencias) ? parsed.experiencias : [];
    const cleaned = list
      .map((e) => ({
        empresa: String(e?.empresa || "").trim(),
        funcao: String(e?.funcao || "").trim(),
        data_inicio: e?.data_inicio ? String(e.data_inicio).trim() : "",
        data_fim: e?.data_fim ? String(e.data_fim).trim() : "",
      }))
      .filter((e) => e.empresa && e.funcao);

    return res.status(200).json({ experiencias: cleaned });
  } catch (err) {
    console.error("Falha em parse-cv:", err);
    return res
      .status(500)
      .json({ error: "Não foi possível processar o currículo." });
  }
}
