# Trabalhei La

Plataforma de reputacao e avaliacao de empresas, com foco em trabalhadores, especialistas e apoiadores. O projeto inclui:

- Frontend React (SPA)
- Backend serverless em api/ (Vercel)
- Firebase (Auth, Firestore e Storage)
- Integracoes com LinkedIn, pagamentos e envio de e-mail
- Build web e empacotamento mobile Android com Capacitor

## Visao geral

O produto permite que usuarios:

- Avaliem empresas e acompanhem historico de avaliacoes
- Gerenciem perfil profissional e experiencias
- Importem experiencias via LinkedIn e via parser de curriculo
- Contratem/consultem especialistas (fluxos de contato e consulta)
- Realizem pagamentos e recebam comprovantes

## Stack tecnica

- React 18 + React Router
- Tailwind CSS
- Firebase SDK + Firebase Admin (serverless)
- Vercel Functions (pasta api/)
- Node.js 22.x
- Capacitor Android
- Gemini API (recursos de IA)

## Estrutura do projeto

```text
.
|- src/                    # Frontend React (paginas, componentes, hooks, servicos)
|- api/                    # Funcoes serverless (Vercel)
|- public/                 # Assets estaticos e callbacks OAuth
|- android/                # Projeto Android (Capacitor)
|- scripts/                # Scripts de apoio e seed
|- firebase.json           # Config Firebase
|- firestore.rules         # Regras do Firestore
|- vercel.json             # Rewrites e limites de funcoes
|- dev-server.mjs          # Servidor local de API para desenvolvimento
|- capacitor.config.ts     # Config do app mobile
```

## Endpoints principais (api/)

- api/linkedin-auth.js
- api/chat-gemini.js
- api/payments.js
- api/webhook.js
- api/send-confirmation.js
- api/send-contact-request.js
- api/send-verification-email.js
- api/consulta-cpf.js
- api/cnpj.js
- api/admin.js
- api/seal-status.js

Observacao: as rotas publicas finais em ambiente Vercel usam rewrites definidos em vercel.json.

## Requisitos

- Node.js 22.x
- npm 10+
- Conta Firebase configurada
- Projeto Vercel (para deploy de funcoes)

## Configuracao de ambiente

1. Copie .env.example para .env.local.
2. Preencha as variaveis necessarias para o seu ambiente.

Variaveis comuns (resumo):

- Frontend/Auth
	- REACT_APP_FIREBASE_API_KEY
	- REACT_APP_FIREBASE_AUTH_DOMAIN
	- REACT_APP_FIREBASE_PROJECT_ID
	- REACT_APP_FIREBASE_STORAGE_BUCKET
	- REACT_APP_FIREBASE_MESSAGING_SENDER_ID
	- REACT_APP_FIREBASE_APP_ID
	- REACT_APP_ADMIN_UID
	- REACT_APP_LINKEDIN_CLIENT_ID
	- REACT_APP_LINKEDIN_REDIRECT_URI
	- REACT_APP_LINKEDIN_SCOPE (opcional, padrao: openid profile email)

- Backend/Integracoes
	- LINKEDIN_CLIENT_ID
	- LINKEDIN_CLIENT_SECRET
	- RESEND_API_KEY
	- EMAIL_VERIFICATION_SECRET
	- EMAIL_FROM_ADDRESS
	- GEMINI_API_KEY
	- MERCADO_PAGO_ACCESS_TOKEN
	- FOCUS_NFE_TOKEN

Importante:

- Nunca commite .env, .env.local ou chaves privadas.
- Se alguma chave foi exposta por engano, gere uma nova imediatamente.

## Desenvolvimento local

Instalar dependencias:

```bash
npm install
```

Rodar frontend:

```bash
npm start
```

Rodar API local (porta 3001):

```bash
npm run dev:api
```

Rodar frontend + API em paralelo:

```bash
npm run dev
```

Por padrao, o frontend em localhost:3000 usa proxy para encaminhar /api para localhost:3001.

## Build e deploy

Build web:

```bash
npm run build
```

Build e sync mobile:

```bash
npm run build:mobile
```

Comandos Android (Capacitor):

```bash
npm run cap:sync:android
npm run cap:open:android
npm run cap:run:android
```

Deploy web/serverless:

- O projeto usa configuracao de build em vercel.json.
- Rewrites de API e rotas SPA tambem estao em vercel.json.

## LinkedIn OAuth (resumo)

- Callback web: /auth/auth/
- Rota de apoio no app: /auth/linkedin
- Troca de code por token/perfil: api/linkedin-auth.js
- Importacao de experiencias no perfil: ExperienceManagerModal na Minha Conta

Para funcionar corretamente:

- O redirect URI precisa estar exatamente igual no LinkedIn Developer Console e no ambiente da aplicacao.
- Os scopes devem incluir ao menos openid profile email.

## Scripts disponiveis

- npm start
- npm run build
- npm run test
- npm run dev:api
- npm run dev
- npm run build:mobile
- npm run cap:sync
- npm run cap:sync:android
- npm run cap:open:android
- npm run cap:run:android

## Qualidade e manutencao

- Testes: react-scripts test
- Logs de build locais: build-log.txt, build-log-local.txt
- Regras Firestore versionadas em firestore.rules

## Licenca

Consulte o arquivo LICENSE.
