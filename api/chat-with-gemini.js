// /api/chat-with-gemini.js
// Endpoint serverless (Vercel) — proxy seguro para a Google Gemini API.
// Recebe { question, knowledgeBase } do frontend e injeta a base de
// conhecimento no systemInstruction. A chave GEMINI_API_KEY fica somente
// no servidor.

import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // O parser do Vercel pode entregar o body já como objeto ou como string.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  // Aceita tanto o novo contrato (question + knowledgeBase) quanto o antigo
  // (message), para retrocompatibilidade.
  const { question, message, knowledgeBase } = body || {};
  const userMessage = (question || message || '').toString().trim();

  if (!userMessage) {
    return res.status(400).json({ message: 'question is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in environment variables.');
    return res
      .status(500)
      .json({ message: 'Server configuration error: API key missing.' });
  }

  // Formata a base de conhecimento (se enviada) como pares Q/A.
  const kbText =
    Array.isArray(knowledgeBase) && knowledgeBase.length
      ? knowledgeBase
          .filter((item) => item && item.pergunta && item.resposta)
          .map(
            (item, i) =>
              `${i + 1}) Pergunta: ${item.pergunta}\n   Resposta: ${item.resposta}`
          )
          .join('\n')
      : '';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const systemInstruction = `
Você é um assistente virtual amigável e prestativo da plataforma "Trabalhei Lá".
Responda apenas a perguntas sobre a plataforma, seus recursos, planos, anonimato,
avaliações e importação de experiências. Mantenha respostas concisas (até ~4 frases),
em português do Brasil. Se a pergunta não tiver relação com a plataforma, diga
educadamente que só pode ajudar com o Trabalhei Lá.

Use prioritariamente a Base de Conhecimento abaixo. Se a resposta exata estiver
listada, use-a (pode reformular levemente). Se não estiver, responda com base
no contexto geral da plataforma sem inventar preços, datas ou recursos.

== Base de Conhecimento ==
${kbText || '(vazia)'}
== Fim da Base de Conhecimento ==
    `.trim();

    const chat = model.startChat({
      history: [],
      generationConfig: { maxOutputTokens: 250 },
      systemInstruction,
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = await result.response.text();

    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('Erro ao chamar a API do Gemini:', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor ao se comunicar com a IA.' });
  }
}

