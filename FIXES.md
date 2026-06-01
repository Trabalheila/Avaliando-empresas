. Home — vão em branco entre o botão "Clique e Saiba Mais" e a seção "Login para Avaliar" Localize o elemento vazio que está causando esse espaçamento excessivo entre as duas seções e remova-o ou ajuste seu padding/margin para zero.

2. ChoosePseudonym.js — campo de pseudônimo bloqueado O campo de pseudônimo está sendo marcado como somente leitura quando um CPF está vinculado. Remova essa restrição. O pseudônimo deve sempre ser editável independentemente de CPF, e-mail ou qualquer outro dado preenchido.

3. ChoosePseudonym.js — importação via LinkedIn não executa ação após login O botão "Importar do LinkedIn" detecta o login mas não dispara a importação. Corrija o fluxo para que, ao detectar login LinkedIn ativo, o clique no botão efetivamente chame a função de busca de experiências e exiba os resultados logo abaixo do botão, mostrando apenas empresa e cargo de cada posição.

4. ChoosePseudonym.js — importação via currículo PDF/DOCX/TXT Restaure o preview do currículo que existia antes — ele deve aparecer logo abaixo do botão "Escolher arquivo" após o upload. O preview deve exibir apenas empresa e cargo de cada experiência identificada, com um badge "Verificado" ou "Não verificado" ao lado de cada uma. Experiências sem empresa identificada devem exibir o texto "Empresa não identificada" em vermelho, não o nome do cargo ou fragmentos do texto do arquivo.

5. ChoosePseudonym.js — botões Solides e Glassdoor Os botões "Importar do Solides" e "Importar do Glassdoor" não executam nenhuma ação. Como o parsing por colagem de texto dessas plataformas é instável, substitua esses dois blocos por uma única seção chamada "Importar via currículo do LinkedIn". Instrua o usuário a exportar o PDF do perfil LinkedIn em linkedin.com/in/seu-perfil → Mais → Salvar como PDF e fazer upload aqui. O parsing desse PDF é mais estruturado e confiável. Remova também os botões "Criar conta no LinkedIn", "Criar conta no Solides" e "Criar conta no Glassdoor" — eles não agregam valor nesse fluxo.

6. ChoosePseudonym.js — formulário manual Mantenha o formulário manual com dois campos bem visíveis: Empresa e Cargo/Função. Garanta que os placeholders estejam legíveis e que o botão "Adicionar experiência" esteja imediatamente abaixo dos dois campos sem espaço excessivo.

7. CompanyDetails.js — cor do texto na seção "Sobre a Empresa" Os labels como RAMO, LOCALIZAÇÃO, CNPJ, SITE e REDES SOCIAIS estão em ciano claro, ilegível tanto no tema claro quanto no escuro. Troque a cor desses labels para o azul principal da plataforma (#1a237e ou a variável CSS de cor primária já usada no projeto). O texto de valor abaixo de cada label deve ser cinza escuro no tema claro e branco/cinza claro no tema escuro.

---

# Modelo Freemium Completo — Benefícios, Pagamento e Limites

Resumo das alterações implementadas para fechar o modelo freemium em
ambos os lados (especialista e trabalhador), incluindo modal de
pagamento, página de benefícios do trabalhador, restrições do plano
Essencial no chat e na videoconferência, e botão de "como funciona o
pagamento?" no cadastro do especialista.

## 1. Modal compartilhado de pagamento
- **Novo:** `src/components/Specialist/PaymentInfoModal.js`
  - Componente reutilizável com duas variantes via prop `audience`:
    - `"specialist"`: explica mensalidade fixa, repasse de 100% do valor
      cobrado pelo profissional, faixa de referência R$ 100 – R$ 300
      por consulta e responsabilidade pela emissão de NF.
    - `"worker"`: explica que o Essencial paga direto com desconto na 1ª
      consulta e que o Premium inclui créditos / consultas gratuitas.
  - Link para `/termos` com aviso anti-desintermediação.

## 2. Lado do especialista
- **`src/components/Specialist/SpecialistBenefitsPage.js`** (atualizado)
  - Título: "Escolha o Plano Ideal para Sua Carreira Profissional".
  - Essencial passou a ser PAGO (R$ 19/mês — selo "Início") com
    limites: até 5 casos ativos, oportunidades limitadas, chat
    restrito e videoconferência até 30 min / 5 sessões por mês.
  - Premium (R$ 49/mês — selo "Recomendado") com tudo ilimitado,
    relatórios e suporte prioritário.
  - Botão "💳 Como funciona o pagamento?" abre `PaymentInfoModal`
    (audience=`specialist`).
  - Nova seção "Valor médio cobrado por profissional" com referência
    R$ 100 – R$ 300 e destaque "100% desse valor vai para você".
  - Dois CTAs `handleAssinarEssencial` e `handleAssinarPremium`
    (placeholder "Em breve").
  - Link para `/termos` no rodapé.
- **`src/pages/ApoiadorCadastro.js`** (atualizado)
  - Novo botão "💳 Como funciona o pagamento?" logo após a descrição
    inicial, abrindo o `PaymentInfoModal` (audience=`specialist`).
  - State `showPaymentInfo` adicionado.
- **`src/components/Specialist/CaseDetailsPage.js`** (atualizado)
  - Substituído `VideoUpgradeCard` por `VideoEssencialCard`:
    - O Essencial agora vê o botão "🎬 Iniciar Videoconferência", mas:
      - Modal de confirmação avisa que a sessão é limitada a 30 minutos
        e quantas sessões restam no mês.
      - Limite mensal de 5 sessões controlado em `localStorage` na
        chave `videoSessionsUsed:YYYY-MM:<apoiadorId>`.
      - Ao atingir o limite, segundo modal exibe "Limite de
        videoconferências atingido para o seu plano. Faça upgrade para
        o Plano Premium." com botão "Ver planos".
    - Premium continua usando o `VideoConferenceCard` original sem
      limites.

## 3. Lado do trabalhador
- **Novo:** `src/components/Worker/WorkerBenefitsPage.js`
  - Rota: `/trabalhador/beneficios` (registrada em `src/App.js`).
  - Título: "Encontre o Suporte Ideal para Sua Jornada Profissional".
  - Essencial (Grátis): busca/filtro, chat limitado e recursos
    básicos. Highlight financeiro: "Desconto exclusivo na primeira
    consulta com especialistas Essenciais."
  - Premium (R$ 29/mês): chat ilimitado, videoconferência,
    acompanhamento e documentos. Highlight financeiro: "Inclui 2
    consultas gratuitas por mês com especialistas Premium (ou crédito
    equivalente)."
  - Botão "💳 Como funciona o pagamento?" abre `PaymentInfoModal`
    (audience=`worker`).
  - CTA Essencial → `/trabalhador/encontrar-especialista`;
    CTA Premium é placeholder ("Em breve").
  - Link para `/termos` no rodapé.
- **`src/components/Worker/FindSpecialistPage.js`** (atualizado)
  - `MOCK_SPECIALISTS` agora inclui `planType` (Essencial/Premium),
    `offersFirstConsultationDiscount` (bool) e
    `averageConsultationPrice` (number). Os dados remotos do Firestore
    também são normalizados para esses campos.
  - Filtro "Tipo de especialista" (Todos / Essencial / Premium).
  - Badges no card: "✨ Premium" (indigo) ou "Essencial" (cinza);
    badge "🎁 Desconto na 1ª consulta para Essencial" quando aplicável.
  - Preço exibe `averageConsultationPrice` com valor riscado quando há
    desconto da primeira consulta.
  - Novo botão "📅 Agendar consulta" com dica contextual baseada no
    plano do trabalhador (detectado via `localStorage.userProfile`):
    - Worker Premium + spec Premium → "Usa seus créditos / consultas
      gratuitas Premium."
    - Worker Premium + spec Essencial → "Pague normalmente ao
      especialista (sem crédito Premium)."
    - Worker Essencial + spec Essencial com desconto → "Preço com
      desconto na 1ª consulta: R$ X."
    - Worker Essencial + spec Premium → "Preço integral; assine o
      Premium do trabalhador para ganhar créditos."
  - Link sutil "✨ Conheça o Plano Premium do trabalhador" aparece para
    trabalhadores não-Premium e leva para `/trabalhador/beneficios`.
- **`src/components/Chat/PlatformChat.js`** (atualizado)
  - O link "Conheça o Premium" no banner do Essencial agora é
    ciente do papel: se `peerRole === "especialista"` (usuário logado
    é trabalhador) o link aponta para `/trabalhador/beneficios`; caso
    contrário continua em `/especialista/beneficios`.

## 4. Roteamento
- **`src/App.js`**
  - Novo import `WorkerBenefitsPage`.
  - Nova rota
    `<Route path="/trabalhador/beneficios" element={<WorkerBenefitsPage ... />} />`.
  - Rota `/especialista/beneficios` já existente continua válida para
    a `SpecialistBenefitsPage`.

## 5. Detecção de plano (mock)
- Especialista Premium: `userProfile.isPremium === true` ou
  `userProfile.plano === "premium"` em `localStorage`, com fallback ao
  documento `/apoiadores/{apoiadorId}` (`CaseDetailsPage`).
- Trabalhador Premium: mesmas chaves no `localStorage.userProfile`
  (também aceita `isWorkerPremium`). Usado em `FindSpecialistPage`.

## 6. Termos de uso (placeholder)
- Todos os modais e páginas de benefícios apontam para `/termos`. A
  rota/página final pode ser criada depois sem quebrar a navegação
  (link comum). Mantém o aviso anti-desintermediação visível.

## 7. Arquivos tocados nesta rodada
- Adicionados:
  - `src/components/Specialist/PaymentInfoModal.js`
  - `src/components/Worker/WorkerBenefitsPage.js`
- Modificados:
  - `src/App.js`
  - `src/components/Specialist/SpecialistBenefitsPage.js`
  - `src/components/Specialist/CaseDetailsPage.js`
  - `src/components/Chat/PlatformChat.js`
  - `src/components/Worker/FindSpecialistPage.js`
  - `src/pages/ApoiadorCadastro.js`
  - `FIXES.md`

## 8. Próximos passos sugeridos
- Implementar Stripe/checkout real nas CTAs "Assinar" (placeholders).
- Criar página real de `/termos` consolidando o contrato de uso e
  cláusulas anti-desintermediação.
- Persistir o plano efetivo no Firestore (`apoiadores` / `usuarios`)
  para refletir cobranças reais em vez do mock por `localStorage`.
- Endurecer o controle de limite de videoconferência no backend (hoje
  é apenas mock client-side).

8. CompanyDetails.js — card Plano Premium O card atual mistura benefícios para trabalhador e empresa. Separe em dois cards distintos lado a lado:

Card 1 — "Premium Trabalhador — R$ 29,90/mês" com os benefícios: Compare empresas antes de aceitar propostas, Veja avaliações reais e tendências, Relatórios executivos com pontos fortes e riscos, Dashboard de análise de ambiente e cultura. Destaque: "Quem é Premium sente até 3x mais segurança na escolha do emprego."

Card 2 — "Premium Empresa — R$ 1.499,90/mês" com os benefícios: Compare sua empresa com concorrentes em tempo real, Identifique tendências e riscos do setor, Relatórios executivos com oportunidades e ameaças, Benchmarks exclusivos e reputação de mercado. Destaque: "Empresas Premium aumentam em até 3x a assertividade nas decisões."

Cada card deve ter seu próprio botão de conversão. No card de trabalhador, o botão chama o fluxo de assinatura atual. No card de empresa, o botão pode por ora exibir um modal simples com "Em breve — entre em contato: [e-mail do projeto]".

9. CompanyDetails.js — informações restritas a Premium As informações bloqueadas para não-premium devem exibir mensagens separadas por tipo de usuário. Se o visitante não tem conta, mostrar "Faça login para ver mais". Se tem conta free de trabalhador, mostrar "Assine o Premium Trabalhador para desbloquear". Não misture mensagens de empresa e trabalhador na mesma tela.

Não crie novos arquivos além do FIXES.md. Não altere estrutura do Firestore. Não adicione dependências. Aplique as correções uma de cada vez e confirme cada arquivo alterado.