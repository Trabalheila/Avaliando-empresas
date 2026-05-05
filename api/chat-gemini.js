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

  // Conteúdo oficial das páginas institucionais (Termos + Privacidade) em
  // texto cru. Mantemos no servidor para não inflar o bundle do React.
  const siteContent = `
== TERMOS DE USO ==
1. Objeto: o Trabalhei Lá permite que usuários compartilhem avaliações e relatos
sobre experiências profissionais em empresas, com foco em transparência,
utilidade pública e melhoria do mercado de trabalho.
2. Uso aceitável — é proibido publicar conteúdo que:
  - seja difamatório, calunioso, injurioso ou ofensivo;
  - cite nomes de pessoas físicas ou permita identificação individual de terceiros;
  - viole direitos de privacidade, imagem, honra ou qualquer legislação aplicável;
  - contenha ameaças, discurso de ódio, assédio ou qualquer forma de abuso.
3. Responsabilidade: o usuário é integralmente responsável pelo conteúdo que
publica. A plataforma não endossa opiniões dos usuários e pode cooperar com
autoridades competentes quando exigido por lei.
4. Remoção: a plataforma pode moderar, ocultar ou remover conteúdo que viole os
Termos, normas internas ou a legislação, sem aviso prévio.
5. Privacidade: regida pela Política de Privacidade.

== POLÍTICA DE PRIVACIDADE (LGPD) ==
1. Informações coletadas:
  - Dados pessoais: nome, e-mail, telefone, cargo etc. fornecidos no cadastro.
  - Dados de navegação: IP, localização aproximada, navegador, interações.
  - Dados de autenticação: via Google, LinkedIn etc.
2. Finalidade: prestar e personalizar o serviço (avaliações, feedback), enviar
notificações e e-mails sobre conteúdo e funcionalidades, melhorar a experiência
e cumprir obrigações legais ou regulatórias.
3. Compartilhamento: não compartilhamos dados pessoais, exceto com parceiros
estratégicos/prestadores que apoiam a operação (análise, segurança) ou quando
exigido por lei, sempre dentro da LGPD.
4. Direitos do titular (LGPD): acesso aos dados, correção, exclusão quando não
forem mais necessários e portabilidade.
5. Segurança: adotamos medidas para proteger contra perda, roubo e acesso não
autorizado, mas nenhum sistema é 100% seguro.
6. Alterações: a política pode mudar; alterações relevantes são notificadas.
7. Exclusão: o usuário pode solicitar exclusão pela página /excluir-dados.

== TABELA DE PLANOS (oficial — página /escolha-perfil) ==

PLANOS PARA TRABALHADOR:
- Gratuito: avaliar empresas, publicar comentários sob pseudônimo, ver
  avaliações públicas, criar perfil com pseudônimo e avatar, importar
  experiências via LinkedIn ou currículo. Bloqueado: comparação,
  relatórios executivos, assessoria jurídica, dashboard, tendências.
- Premium Trabalhador — R$ 29,90/mês: tudo do Gratuito + comparação de
  empresas, avaliações reais com tendências, relatórios executivos, dashboard
  detalhado, resumo de trechos sensíveis em avaliações restritas, Assessoria
  Jurídica Trabalhista (advogados parceiros, primeira consulta gratuita) e
  selo de perfil verificado.

PLANOS PARA EMPRESA (gratuidade promocional vai até 31/07/2026):
- Gratuito (R$ 0): ver nota geral da empresa e acompanhar avaliações
  públicas. Não tem painel completo, relatório de reputação, ferramenta
  de resposta nem créditos de contato.
- Plano Fundador: GRATUITO até 31/07/2026 e DEPOIS R$ 1.499,90/mês.
  Quem entra como Fundador mantém esse preço para sempre, mesmo após o
  lançamento de novos recursos. Inclui:
    • Painel completo de avaliações por critério (salário, cultura,
      liderança, benefícios e mais).
    • Relatório de reputação da empresa com visão geral por área.
    • Ferramenta de resposta pública identificada como “Resposta oficial
      da empresa”.
    • Acesso prioritário aos próximos recursos (comparação com
      concorrentes, benchmarks de setor).
    • 5 Créditos de Contato/mês para iniciar conversas com Apoiadores
      Premium.
    • Acesso à página “Meus Contatos” para gerenciar interações com
      Apoiadores.
- Empresa Premium: GRATUITO até 31/07/2026 e DEPOIS R$ 3.499,90/ano.
  É o Plano Fundador em versão avançada — inclui:
    • Painel por critério com filtros, séries históricas e exportação.
    • Relatórios de reputação avançados e comparativos (período, setor,
      concorrentes).
    • Ferramenta de resposta com análise de sentimento e sugestões de IA.
    • Acesso antecipado a todos os recursos em desenvolvimento, sem custo
      adicional.
    • 20 Créditos de Contato/mês com Apoiadores Premium.
    • 10 Créditos de Contato/mês com Trabalhadores Premium (Conexão
      Exclusiva com Talentos de alto Índice de Credibilidade).
    • Gerenciamento Centralizado de Contatos (Apoiadores + Trabalhadores).
    • Comparação em tempo real com concorrentes diretos do setor.
    • Identificação automática de tendências e riscos do mercado.
    • Relatórios executivos com oportunidades, ameaças e recomendações.
    • Dashboard dinâmico para análise de desempenho e contratos.
    • Benchmarks exclusivos e índice de reputação de mercado.

PLANOS PARA APOIADOR:
- Apoiador Premium — a partir de R$ 199,90/mês (varia por nicho e nível
  de destaque): até 3 nichos, descrição estendida (até 600 caracteres),
  portfólio com até 5 casos, documentos e certificações visíveis, destaque
  nas páginas, recebimento de avaliações com estrelas, selo "Apoiador
  Premium Verificado", posicionamento prioritário e relatório mensal de
  visualizações e cliques.

PAGAMENTO: Mercado Pago — PIX, cartão ou boleto no checkout.
  `.trim();

  // Prompt original conforme especificação do produto.
  const prompt = `Você é um assistente do site Trabalhei Lá. Responda à seguinte pergunta do usuário usando apenas as informações fornecidas sobre o site. Se a pergunta não puder ser respondida com as informações fornecidas, diga que não tem essa informação.

Informações do site:
${kbText}

${siteContent}

Pergunta do usuário: ${userQuestion}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Modelo público estável da Gemini API com free tier amplo.
    // Pode ser sobrescrito por env (ex.: GEMINI_MODEL=gemini-2.0-flash)
    // sem novo deploy se o projeto tiver quota paga habilitada.
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 400, temperature: 0.2, topP: 0.9 },
    });

    const responseText = result?.response?.text?.() || "";
    return res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    // Detecta erro de quota (HTTP 429) para que o frontend possa exibir
    // mensagem amigável sem despejar o JSON cru da Google.
    const raw = (error?.message || String(error)).toString();
    const isQuota = /\b429\b|quota|rate.?limit/i.test(raw);
    return res.status(isQuota ? 429 : 500).json({
      message: isQuota
        ? "Cota da IA excedida no momento. Tente novamente em instantes."
        : "Erro interno do servidor ao se comunicar com a IA.",
      error: isQuota ? "quota_exceeded" : raw,
      name: error?.name,
      status: error?.status,
    });
  }
}
