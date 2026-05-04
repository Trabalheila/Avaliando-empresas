// src/api/geminiService.js
// Cliente do frontend para o endpoint serverless do Gemini.
// IMPORTANTE: a chave (GEMINI_API_KEY) NUNCA fica aqui — ela vive somente
// no backend (Vercel Function em /api/chat-with-gemini.js).

const ENDPOINT = "/api/chat-with-gemini";

/**
 * Envia uma pergunta do usuário + a base de conhecimento para o backend
 * seguro, que por sua vez consulta a API do Gemini.
 *
 * @param {string} question - Pergunta digitada pelo usuário.
 * @param {Array<{pergunta: string, resposta: string}>} knowledgeBase
 *        Conteúdo de src/chatbotKnowledge.json.
 * @returns {Promise<string>} Texto da resposta gerada.
 */
export async function askGemini(question, knowledgeBase) {
  if (!question || typeof question !== "string") {
    throw new Error("askGemini: 'question' inválida.");
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      knowledgeBase: Array.isArray(knowledgeBase) ? knowledgeBase : [],
    }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err?.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(
      `Falha ao consultar o assistente (HTTP ${response.status})${
        detail ? `: ${detail}` : ""
      }`
    );
  }

  const data = await response.json();
  return data.response || "";
}

export default askGemini;
