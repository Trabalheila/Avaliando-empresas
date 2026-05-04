// /api/chat-gemini.js
// Endpoint serverless (Vercel) — proxy seguro para a Google Gemini API.
// Equivalente ao "pages/api/chat-gemini.js" de projetos Next.js: este
// repositório é Create React App + Vercel Functions, então o handler vive
// em /api/. A chave GEMINI_API_KEY fica somente no servidor.

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
  const { message } = body || {};

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY not set in environment variables.');
    return res
      .status(500)
      .json({ message: 'Server configuration error: API key missing.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' }); // Ou 'gemini-1.5-pro' se preferir e tiver acesso

    // --- AQUI É ONDE VOCÊ INJETA O CONTEXTO DO SEU PROJETO ---
    const systemInstruction = `
      Você é um assistente virtual amigável e prestativo da plataforma "Trabalhei Lá".
      Sua função é responder a perguntas sobre a plataforma, seus recursos, planos (Trabalhador Premium, Empresa Premium, Fundador),
      como funciona a avaliação de empresas, o anonimato, a importação de experiências, etc.
      Mantenha suas respostas concisas, informativas e sempre focadas na plataforma "Trabalhei Lá".
      Não responda a perguntas que não sejam sobre a plataforma.

      **Contexto da Plataforma Trabalhei Lá:**
      - **Nome:** Trabalhei Lá (ou Avaliando Empresas)
      - **Propósito:** Plataforma para trabalhadores avaliarem empresas onde trabalharam ou trabalham, com foco em transparência e autenticidade.
      - **Anonimato:** Avaliações são publicadas sob pseudônimo. Nome real, e-mail e CPF são separados e nunca expostos publicamente. O pseudônimo é editável.
      - **Importação de Experiências:** Aceita importação via LinkedIn (OAuth), upload de PDF do LinkedIn (parsing de empresa e cargo), e entrada manual. Apenas LinkedIn OAuth dá "certified: true".
      - **Planos Trabalhador:**
        - Gratuito: Avaliar empresas, ver avaliações básicas.
        - Premium (R$ 29,90/mês): Comparar empresas, ver avaliações reais e tendências, relatórios executivos, dashboard detalhado, mais segurança na decisão.
      - **Planos Empresa:**
        - Gratuito: Ver nota geral, acompanhar avaliações públicas.
        - Fundador (R$ 0 até 31/07/2026, depois R$ 1.499,90/mês): Painel completo, relatório de reputação, ferramenta de resposta, X Créditos de Contato/mês para Apoiadores Premium.
        - Premium (R$ 3.499,90/ano): Tudo do Fundador avançado, Y Créditos de Contato/mês para Apoiadores Premium, Z Créditos de Contato/mês para Trabalhadores Premium, Gerenciamento Centralizado de Contatos, comparação com concorrentes, benchmarks exclusivos.
      - **Campos Obrigatórios (Empresa):** Ramo e Segmento são obrigatórios para edição de perfil de empresa para fins de comparação e análise.
      - **Botão Premium no Cabeçalho:** É um CTA importante, deve ser visível e convidativo.
      - **Cards Laterais:** Foram ajustados para serem mais largos e com melhor tipografia no desktop.
      - **Visão:** Dar voz ao trabalhador, expor injustiças (ex: demissões por condições de saúde, jornadas exaustivas, falta de recursos).
    `;
    // --- FIM DO CONTEXTO ---

    const chat = model.startChat({
      history: [
        // Você pode adicionar histórico de conversas anteriores aqui se quiser manter o contexto
        // Ex: { role: "user", parts: "Olá" }, { role: "model", parts: "Olá! Como posso ajudar?" },
      ],
      generationConfig: {
        maxOutputTokens: 200, // Limite o tamanho da resposta para evitar respostas muito longas
      },
      systemInstruction, // Injeta o contexto aqui
    });

    const result = await chat.sendMessage(message);
    const responseText = await result.response.text();

    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('Erro ao chamar a API do Gemini:', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor ao se comunicar com a IA.' });
  }
}
