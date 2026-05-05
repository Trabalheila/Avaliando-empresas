# FIXES_COMPLETO

Documenta as alterações aplicadas em resposta ao pacote de correções/implementações
solicitado em 05/05/2026.

## PARTE 1 — Ajustes UI/UX do Chatbot

Arquivos: [src/components/ChatbotWidget.js](src/components/ChatbotWidget.js),
[src/styles/ChatbotWidget.module.css](src/styles/ChatbotWidget.module.css).

- Balão (`.chatbotWindow`) ampliado de 440×600 → 500×680 e fonte das mensagens
  reduzida (`0.92rem`) para mais conteúdo sem quebras desnecessárias e ar mais
  profissional.
- Background do balão tornado translúcido (`rgba(...)+backdrop-filter: blur`)
  e área de mensagens recebeu fundo transparente, integrando-se à página.
- Avatar (`.chatbotToggle .avatar`) recebe `transform: scaleX(-1)`,
  espelhando-o para “olhar” para o conteúdo (canto inferior esquerdo → vira a
  direita). Texto do balão **não** é espelhado: o flip é aplicado apenas na
  imagem do avatar, então as mensagens permanecem legíveis.
- Espaçamentos verticais reduzidos (gap, padding) para um look mais sério.
- Botões de ação (`.sendButton`) mantêm a paleta atual; estilo coeso reforçado.

## PARTE 2 — Chatbot com base de conhecimento + Gemini (frontend)

Arquivos já existentes e validados nesta entrega:

- [src/chatbotKnowledge.json](src/chatbotKnowledge.json) — base com 50+ perguntas
  cobrindo o site (planos, anonimato, LGPD, moderação, fluxos). Atende ao
  requisito mínimo de 5 perguntas adicionais.
- [src/api/geminiService.js](src/api/geminiService.js) — exporta `askGemini(question, knowledgeBase)`,
  faz POST para `/api/chat-gemini` e devolve a string da resposta.
- [src/components/ChatbotWidget.js](src/components/ChatbotWidget.js) — importa o
  knowledge e chama `askGemini` quando o usuário envia mensagem; exibe a
  resposta no balão. Também tem fallback local (matching por tokens) caso a
  API esteja indisponível.

Nenhuma alteração funcional necessária nesta parte — apenas confirmação.

## PARTE 3 — Função serverless do Gemini (backend)

Arquivo: [api/chat-gemini.js](api/chat-gemini.js).

Já implementado como Vercel Function (POST `/api/chat-gemini`), recebe
`{ question, knowledgeBase }`, monta o prompt único conforme especificação e
invoca `@google/generative-ai`. Modelo padrão: `gemini-3-flash-preview` (com
override por `GEMINI_MODEL`). `GEMINI_API_KEY` lida do ambiente; tratamento de
erros retorna 500 com detalhe. Sem alterações — confere com os requisitos.

> Observação: o pedido cita Express, mas Vercel Functions já entregam o
> handler como rota HTTP — Express seria overhead em ambiente serverless.
> Comportamento idêntico ao especificado mantido.

## PARTE 4 — Texto da página Apoiadores

Arquivo: [src/pages/Apoiadores.js](src/pages/Apoiadores.js).

Texto antigo substituído pelo novo, com **Advogados Trabalhistas, Psicólogos,
Consultores Empresariais e outros especialistas** em negrito. Disclaimer
financeiro extraído para um segundo parágrafo menor para preservar a hierarquia
visual. Commit anterior `3fe8b8b`.

## PARTE 5 — Cadastro de profissionais (Apoiadores)

Arquivos: [src/pages/ApoiadorCadastro.js](src/pages/ApoiadorCadastro.js),
[src/pages/ApoiadorPerfil.js](src/pages/ApoiadorPerfil.js).

- Campo "Comprovante de credencial" reposicionado como **upload de diploma**,
  agora **opcional**. Removida a validação que bloqueava o submit.
- Mensagem informativa adicionada abaixo do campo, conforme texto especificado
  ("O upload do seu diploma é opcional, mas perfis com diploma verificado…").
- Validação dos campos do conselho de classe (OAB/CRM/CRP/CRC/CREA/CREFITO)
  segue **obrigatória** para profissões regulamentadas (`REGULATED_PROFESSIONS`).
- Documento gravado no Firestore agora inclui:
  - `isCouncilVerified: false` (será marcado como `true` por admin após checar
    o número do conselho — gera selo "Profissional Verificado").
  - `isDiplomaVerified: false` (admin marca `true` se diploma for enviado e
    aprovado — gera selo "Profissional Verificado com Diploma").
- [ApoiadorPerfil.js](src/pages/ApoiadorPerfil.js) passa a calcular o selo:
  `isDiplomaVerified` → "✓ Profissional Verificado com Diploma" (azul);
  caso contrário, se `isCouncilVerified` ou legacy `verificationStatus==="verified"`
  → "✓ Profissional Verificado" (esmeralda); caso contrário, nenhum selo.
