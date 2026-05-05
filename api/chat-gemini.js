// api/chat-gemini.js
// Endpoint serverless (Vercel) — proxy seguro para a Google Gemini API.
//
// Vercel Functions já expõem este arquivo automaticamente como
// POST /api/chat-gemini, então NÃO precisamos do Express aqui (Express
// num runtime serverless só adiciona overhead de cold start).
//
// Recebe { question, knowledgeBase } do frontend, monta o prompt único
// instruído pelo produto e devolve { response } com o texto gerado.
// A chave GEMINI_API_KEY vive somente no servidor.

import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  // O parser do Vercel pode entregar o body já como objeto ou como string.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  // Aceita o contrato novo (question + knowledgeBase) e o antigo (message)
  // por retrocompatibilidade.
  const { question, message, knowledgeBase } = body || {};
  const userQuestion = (question || message || "").toString().trim();

  if (!userQuestion) {
    return res.status(400).json({ message: "question is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não configurada.");
    return res
      .status(500)
      .json({ message: "Server configuration error: API key missing." });
  }

  // Serializa a base de conhecimento como pares Pergunta/Resposta.
  const kbText =
    Array.isArray(knowledgeBase) && knowledgeBase.length
      ? knowledgeBase
          .filter((it) => it && it.pergunta && it.resposta)
          .map(
            (it, i) =>
              `${i + 1}) Pergunta: ${it.pergunta}\n   Resposta: ${it.resposta}`
          )
          .join("\n")
      : "(nenhuma)";

  // Prompt único conforme especificação do produto.
  const prompt = `Você é um assistente do site Trabalhei Lá. Responda à seguinte pergunta do usuário usando apenas as informações fornecidas sobre o site. Se a pergunta não puder ser respondida com as informações fornecidas, diga que não tem essa informação.

Informações do site:
${kbText}

Pergunta do usuário: ${userQuestion}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Modelo padrão conforme especificação. Permite override via env
    // (ex.: GEMINI_MODEL=gemini-pro) sem novo deploy, caso o preview não
    // esteja habilitado para a sua chave.
    const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
    });

    const responseText = result?.response?.text?.() || "";
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    return res.status(500).json({
      message: "Erro interno do servidor ao se comunicar com a IA.",
      error: error?.message || String(error),
      name: error?.name,
      status: error?.status,
    });
  }
}
