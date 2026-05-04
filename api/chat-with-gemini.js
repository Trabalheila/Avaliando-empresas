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

  // Contexto geral da plataforma — usado quando a Base de Conhecimento não
  // cobre exatamente a pergunta. Mantém o assistente fiel aos fatos do site.
  const platformContext = `
Plataforma: Trabalhei Lá (também conhecida como "Avaliando Empresas").
Domínio: trabalheila.com.br | Stack: React + Firebase + Vercel Functions.

Propósito:
- Plataforma brasileira que dá voz ao trabalhador para avaliar empresas de forma anônima
  (ambiente, salário, liderança, benefícios, equilíbrio, oportunidades de crescimento).
- Empresas podem responder publicamente, acompanhar reputação e contatar profissionais.

Perfis de usuário:
- Trabalhador: avalia empresas, importa experiências (LinkedIn OAuth, PDF do LinkedIn, manual),
  pode virar Trabalhador Premium para receber ofertas de empresas.
- Empresa: gerencia perfil, responde avaliações, contrata plano para ter painel completo.
- Apoiador (RH/headhunter/mentor/consultor): cadastra-se para oferecer ajuda em
  recolocação e mentoria; aparece na lista de Apoiadores.
- Admin: equipe interna do Trabalhei Lá.

Anonimato e privacidade (LGPD):
- Avaliações públicas usam apenas pseudônimo (editável).
- Nome real, CPF e e-mail ficam separados, com acesso restrito.
- Usuário pode pedir exclusão dos dados a qualquer momento ("Minha Conta" → "Excluir dados").

Cadastro e login:
- E-mail/senha (com confirmação por e-mail) ou login LinkedIn (OAuth).
- Login LinkedIn marca experiências como "certificadas".

Cadastro de empresa:
- Informa CNPJ, nome, ramo, segmento e e-mail corporativo.
- Empresa só fica pública após confirmação por link no e-mail corporativo.
- Ramo e Segmento são obrigatórios para participar de comparações e benchmarks.

Avaliação:
- Notas de 1 a 5 estrelas em vários critérios + comentário opcional.
- Uma avaliação ativa por usuário/empresa; usuário pode atualizar/remover.

Planos Trabalhador:
- Gratuito: avaliar empresas, ver avaliações básicas.
- Premium R$ 29,90/mês: comparação de empresas, relatórios executivos, dashboard
  detalhado, tendências, recebe ofertas de contato de empresas premium.

Planos Empresa:
- Gratuito: ver nota e avaliações públicas, perfil básico.
- Fundador: gratuito até 31/07/2026, depois R$ 1.499,90/mês. Painel completo,
  ferramenta de resposta, relatório de reputação, créditos de contato com Apoiadores Premium.
- Premium R$ 3.499,90/ano: tudo do Fundador + créditos de contato com Trabalhadores Premium,
  gestão centralizada de contatos, comparação com concorrentes, benchmarks por ramo/segmento.

Pagamentos:
- Stripe (cartão de crédito). Trabalhador é mensal recorrente; Empresa Premium é anual.
- Cancelamento em "Minha Conta" → "Plano". Acesso continua até o fim do ciclo pago.

Apoiadores Premium:
- Profissionais de carreira (RH, headhunters, mentores) que oferecem ajuda.
- Empresas com plano pago usam créditos mensais para iniciar contato.
- Contato só é entregue se o destinatário aceitar; créditos não acumulam.

Selo de Reputação:
- Selo público nas empresas que mantêm boa reputação no tempo.
- Calculado a partir de avaliações e do engajamento da empresa em responder.

Páginas/áreas relevantes do site:
- Home, busca de empresas, perfil da empresa, perfil do trabalhador (WorkerProfile),
  Apoiadores e perfil de Apoiador, Cadastro de Empresa e Confirmação,
  Painel da Empresa (Business Dashboard), Minha Conta, Política de Privacidade,
  Termos de Uso, Login, Selo (Seal Details).
  `.trim();

  const systemInstruction = `
Você é o assistente virtual oficial da plataforma "Trabalhei Lá".
Seu papel é responder dúvidas sobre o site, seus recursos, planos, anonimato,
avaliações, cadastro, importação de experiências, pagamentos, Apoiadores e LGPD.

Regras:
- Responda em português do Brasil, em tom amigável, claro e objetivo.
- Mantenha respostas concisas (1 a 5 frases). Use bullet points apenas se ajudar.
- Use a Base de Conhecimento como fonte primária. Se a resposta exata estiver lá,
  use-a (pode reformular levemente).
- Se a pergunta não estiver na Base, responda usando o Contexto Geral da Plataforma
  abaixo. NUNCA invente preços, datas, recursos, links, números de telefone, e-mails
  específicos ou nomes de pessoas. Se não souber, diga que não tem essa informação
  e oriente a entrar em contato pelo formulário no rodapé.
- Se a pergunta não tiver nada a ver com o Trabalhei Lá, responda educadamente
  que você só ajuda com dúvidas sobre a plataforma.

== Contexto Geral da Plataforma ==
${platformContext}
== Fim do Contexto Geral ==

== Base de Conhecimento (perguntas frequentes) ==
${kbText || '(nenhuma fornecida)'}
== Fim da Base de Conhecimento ==
  `.trim();

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-pro foi descontinuado na API v1; usamos gemini-1.5-flash
    // (rápido, gratuito no nível básico e disponível na chave padrão).
    // Permite override via GEMINI_MODEL.
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
    });

    const chat = model.startChat({
      history: [],
      generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error('Erro ao chamar a API do Gemini:', error);
    return res
      .status(500)
      .json({ message: 'Erro interno do servidor ao se comunicar com a IA.' });
  }
}

