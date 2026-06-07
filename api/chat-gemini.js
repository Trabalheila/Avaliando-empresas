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

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: { sizeLimit: "5mb" },
  },
};

// ============================================================
// Sub-rota: ?op=parse-cv
// Extrai experiências profissionais estruturadas de um currículo
// (PDF ou DOCX) via Gemini JSON Mode.
// Contrato: { filename, mimeType, base64 } -> { experiencias: [...] }
// ============================================================
const PARSE_CV_MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const PARSE_CV_SCHEMA = {
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
const PARSE_CV_SYSTEM = `Você extrai histórico profissional de currículos.
Devolva APENAS JSON no schema definido.
Para cada experiência, preencha:
- empresa: nome oficial da empresa, sem cargo nem cidade.
- funcao: cargo/função exercida.
- data_inicio: formato "AAAA-MM" sempre que possível.
- data_fim: formato "AAAA-MM" ou a string "Atual" se for o emprego atual.
Ignore seções de educação, cursos, idiomas, habilidades, projetos pessoais,
voluntariado sem empresa nomeada. Não invente datas — omita o campo se
não houver indicação clara. Não duplique experiências.`;

async function handleParseCv(req, res, body, apiKey) {
  const { filename, mimeType, base64 } = body || {};
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
  if (!buffer.length) return res.status(400).json({ error: "Arquivo vazio." });
  if (buffer.length > PARSE_CV_MAX_BYTES) {
    return res
      .status(413)
      .json({ error: "Arquivo maior que 4MB. Compacte ou envie um trecho." });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName =
      process.env.GEMINI_CV_MODEL ||
      process.env.GEMINI_MODEL ||
      "gemini-2.0-flash";
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: PARSE_CV_SYSTEM,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: PARSE_CV_SCHEMA,
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
      const mammothMod = await import("mammoth");
      const mammoth = mammothMod.default || mammothMod;
      const extracted = await mammoth.extractRawText({ buffer });
      const text = String(extracted?.value || "").trim();
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY não configurada.");
    return res
      .status(500)
      .json({ message: "Server configuration error: API key missing." });
  }

  // Roteamento de sub-operações.
  const op = (req.query?.op || body?.op || "").toString().toLowerCase();
  if (op === "parse-cv") {
    return handleParseCv(req, res, body, apiKey);
  }

  // Aceita o contrato novo (question + knowledgeBase) e o antigo (message)
  // por retrocompatibilidade.
  const { question, message, knowledgeBase } = body || {};
  const userQuestion = (question || message || "").toString().trim();

  if (!userQuestion) {
    return res.status(400).json({ message: "question is required" });
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

    // Cadeia de modelos: tenta o primário e cai para fallbacks em caso de
    // 503 (sobrecarga) ou 404 (modelo descontinuado). Pode ser sobrescrito
    // por env: GEMINI_MODEL para o primário, GEMINI_FALLBACK_MODELS como
    // lista separada por vírgula. Free tier amplo em todos.
    const primary = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
    const fallbacks = (
      process.env.GEMINI_FALLBACK_MODELS ||
      "gemini-2.5-flash-lite,gemini-2.5-flash,gemini-flash-latest"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const candidates = [primary, ...fallbacks.filter((m) => m !== primary)];

    const generationConfig = {
      maxOutputTokens: 400,
      temperature: 0.2,
      topP: 0.9,
    };

    const isOverloaded = (err) => {
      const msg = (err?.message || String(err)).toString();
      return err?.status === 503 || /\b503\b|overloaded|unavailable|high demand/i.test(msg);
    };
    const isModelMissing = (err) => {
      const msg = (err?.message || String(err)).toString();
      return err?.status === 404 || /\b404\b|not.?found/i.test(msg);
    };
    const isQuotaExceeded = (err) => {
      const msg = (err?.message || String(err)).toString();
      return err?.status === 429 || /\b429\b|quota|rate.?limit/i.test(msg);
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let lastError = null;
    for (const modelName of candidates) {
      const model = genAI.getGenerativeModel({ model: modelName });
      // Até 2 tentativas por modelo quando for 503 transitório.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
          });
          const responseText = result?.response?.text?.() || "";
          return res
            .status(200)
            .json({ response: responseText, modelUsed: modelName });
        } catch (err) {
          lastError = err;
          if (isOverloaded(err) && attempt === 0) {
            await sleep(800);
            continue; // retry mesmo modelo
          }
          if (isOverloaded(err) || isModelMissing(err) || isQuotaExceeded(err)) {
            break; // tenta o próximo modelo
          }
          throw err; // erro não-recuperável (auth, prompt inválido, etc.)
        }
      }
    }
    throw lastError || new Error("Falha desconhecida ao gerar resposta.");
  } catch (error) {
    console.error("Erro ao chamar a API do Gemini:", error);
    const raw = (error?.message || String(error)).toString();
    const isQuota = /\b429\b|quota|rate.?limit/i.test(raw);
    const isOverloaded = error?.status === 503 || /\b503\b|overloaded|high demand/i.test(raw);
    const httpStatus = isQuota ? 429 : isOverloaded ? 503 : 500;
    return res.status(httpStatus).json({
      message: isQuota
        ? "Cota da IA excedida no momento. Tente novamente em instantes."
        : isOverloaded
        ? "A IA está sobrecarregada no momento. Tente novamente em instantes."
        : "Erro interno do servidor ao se comunicar com a IA.",
      error: isQuota
        ? "quota_exceeded"
        : isOverloaded
        ? "model_overloaded"
        : raw,
      name: error?.name,
      status: error?.status,
    });
  }
}
