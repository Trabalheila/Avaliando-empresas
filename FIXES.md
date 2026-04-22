. Home — vão em branco entre o botão "Clique e Saiba Mais" e a seção "Login para Avaliar" Localize o elemento vazio que está causando esse espaçamento excessivo entre as duas seções e remova-o ou ajuste seu padding/margin para zero.

2. ChoosePseudonym.js — campo de pseudônimo bloqueado O campo de pseudônimo está sendo marcado como somente leitura quando um CPF está vinculado. Remova essa restrição. O pseudônimo deve sempre ser editável independentemente de CPF, e-mail ou qualquer outro dado preenchido.

3. ChoosePseudonym.js — importação via LinkedIn não executa ação após login O botão "Importar do LinkedIn" detecta o login mas não dispara a importação. Corrija o fluxo para que, ao detectar login LinkedIn ativo, o clique no botão efetivamente chame a função de busca de experiências e exiba os resultados logo abaixo do botão, mostrando apenas empresa e cargo de cada posição.

4. ChoosePseudonym.js — importação via currículo PDF/DOCX/TXT Restaure o preview do currículo que existia antes — ele deve aparecer logo abaixo do botão "Escolher arquivo" após o upload. O preview deve exibir apenas empresa e cargo de cada experiência identificada, com um badge "Verificado" ou "Não verificado" ao lado de cada uma. Experiências sem empresa identificada devem exibir o texto "Empresa não identificada" em vermelho, não o nome do cargo ou fragmentos do texto do arquivo.

5. ChoosePseudonym.js — botões Solides e Glassdoor Os botões "Importar do Solides" e "Importar do Glassdoor" não executam nenhuma ação. Como o parsing por colagem de texto dessas plataformas é instável, substitua esses dois blocos por uma única seção chamada "Importar via currículo do LinkedIn". Instrua o usuário a exportar o PDF do perfil LinkedIn em linkedin.com/in/seu-perfil → Mais → Salvar como PDF e fazer upload aqui. O parsing desse PDF é mais estruturado e confiável. Remova também os botões "Criar conta no LinkedIn", "Criar conta no Solides" e "Criar conta no Glassdoor" — eles não agregam valor nesse fluxo.

6. ChoosePseudonym.js — formulário manual Mantenha o formulário manual com dois campos bem visíveis: Empresa e Cargo/Função. Garanta que os placeholders estejam legíveis e que o botão "Adicionar experiência" esteja imediatamente abaixo dos dois campos sem espaço excessivo.

7. CompanyDetails.js — cor do texto na seção "Sobre a Empresa" Os labels como RAMO, LOCALIZAÇÃO, CNPJ, SITE e REDES SOCIAIS estão em ciano claro, ilegível tanto no tema claro quanto no escuro. Troque a cor desses labels para o azul principal da plataforma (#1a237e ou a variável CSS de cor primária já usada no projeto). O texto de valor abaixo de cada label deve ser cinza escuro no tema claro e branco/cinza claro no tema escuro.

8. CompanyDetails.js — card Plano Premium O card atual mistura benefícios para trabalhador e empresa. Separe em dois cards distintos lado a lado:

Card 1 — "Premium Trabalhador — R$ 29,90/mês" com os benefícios: Compare empresas antes de aceitar propostas, Veja avaliações reais e tendências, Relatórios executivos com pontos fortes e riscos, Dashboard de análise de ambiente e cultura. Destaque: "Quem é Premium sente até 3x mais segurança na escolha do emprego."

Card 2 — "Premium Empresa — R$ 1.499,90/mês" com os benefícios: Compare sua empresa com concorrentes em tempo real, Identifique tendências e riscos do setor, Relatórios executivos com oportunidades e ameaças, Benchmarks exclusivos e reputação de mercado. Destaque: "Empresas Premium aumentam em até 3x a assertividade nas decisões."

Cada card deve ter seu próprio botão de conversão. No card de trabalhador, o botão chama o fluxo de assinatura atual. No card de empresa, o botão pode por ora exibir um modal simples com "Em breve — entre em contato: [e-mail do projeto]".

9. CompanyDetails.js — informações restritas a Premium As informações bloqueadas para não-premium devem exibir mensagens separadas por tipo de usuário. Se o visitante não tem conta, mostrar "Faça login para ver mais". Se tem conta free de trabalhador, mostrar "Assine o Premium Trabalhador para desbloquear". Não misture mensagens de empresa e trabalhador na mesma tela.

Não crie novos arquivos além do FIXES.md. Não altere estrutura do Firestore. Não adicione dependências. Aplique as correções uma de cada vez e confirme cada arquivo alterado.