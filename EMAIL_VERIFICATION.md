# Verificação de E-mail

Documenta o fluxo de verificação de e-mail introduzido no projeto.

## Visão geral do fluxo

1. O usuário preenche / atualiza o perfil em `ChoosePseudonym` com um e-mail.
2. Ao salvar, se o e-mail é novo (ou ainda não foi verificado), o frontend
   chama `POST /api/send-verification`.
3. `api/send-verification.js` gera um JWT (24h) assinado com
   `EMAIL_VERIFICATION_SECRET` e envia um e-mail (Resend) com o link
   `${APP_BASE_URL}/api/verify-email?token=<JWT>`.
4. O usuário clica no link, `api/verify-email.js` verifica o JWT, marca o
   documento `users/{userId}` no Firestore como `emailVerified: true` e
   redireciona para `${APP_BASE_URL}/?verified=1` (ou `?verified=0&reason=...` em erro).
5. O `ChoosePseudonym` lê esses parâmetros na URL, atualiza o perfil
   local e mostra feedback ao usuário.

## Variáveis de ambiente

Defina em `.env` local **e** no painel da Vercel (Production + Preview):

| Variável | Descrição |
|---|---|
| `EMAIL_VERIFICATION_SECRET` | Segredo usado para assinar/verificar o JWT (string longa, aleatória). |
| `RESEND_API_KEY` | Chave da [Resend](https://resend.com). |
| `EMAIL_FROM_ADDRESS` | Remetente verificado na Resend (ex.: `no-reply@trabalheila.com.br`). |
| `APP_BASE_URL` | URL pública da aplicação (ex.: `https://www.trabalheila.com.br`). |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Credenciais Firebase Admin (já usadas em outras rotas). |

> O `.env.example` lista também `EMAIL_SERVICE_HOST/PORT/USER/PASS` apenas como
> referência, caso no futuro o envio seja migrado para SMTP via `nodemailer`.
> As rotas atuais usam **somente** Resend.

## Arquivos alterados

- `package.json` — adicionada a dependência `jsonwebtoken`.
- `.env.example` — novas variáveis documentadas.
- `api/send-verification.js` — **novo**. Gera JWT + envia e-mail.
- `api/verify-email.js` — **novo**. Valida JWT + atualiza Firestore + redireciona.
- `src/pages/ChoosePseudonym.js`:
  - Estado: `emailVerified`, `verifiedEmailValue`, `sendingVerification`, `verificationStatus`.
  - `useEffect` que detecta `?verified=1` / `?verified=0&reason=...` na URL.
  - `sendVerificationEmail(email)` — chama `/api/send-verification`.
  - Após `saveUserProfile`, dispara verificação se o e-mail é novo / não verificado.
  - Persiste `emailVerified` no `nextProfile` (mantém `true` apenas se o e-mail
    não mudou; qualquer alteração reseta para `false`).
  - UI: badge "E-mail verificado" / "E-mail não verificado" + botão "Reenviar".

## Estrutura do token (JWT)

```json
{
  "userId": "<doc id em users/>",
  "email":  "<email_normalizado>",
  "exp":    <agora + 24h>
}
```

Assinado com HS256 + `EMAIL_VERIFICATION_SECRET`.

## Estrutura no Firestore

A rota de verificação grava no documento `users/{userId}`:

```js
{
  email: "<email_do_token>",
  emailVerified: true,
  emailVerifiedAt: <serverTimestamp>
}
```

Nenhum outro campo é alterado.

## Como testar

1. Configure todas as variáveis acima na Vercel.
2. `npm install` (para instalar `jsonwebtoken`).
3. Faça deploy.
4. Em uma aba anônima, abra o perfil, preencha um e-mail real e salve.
5. Abra a caixa de entrada → clique no link → você deve ser redirecionado
   para a home com `?verified=1` e ver "E-mail verificado com sucesso!".
6. Volte ao perfil — o badge "E-mail verificado" deve aparecer ao lado do label.

## Códigos de erro no redirect

`?verified=0&reason=<reason>`:

| `reason` | Significado |
|---|---|
| `missing_token` | Sem `token` na query. |
| `invalid_token` | JWT malformado / assinatura inválida. |
| `expired` | JWT expirou (>24h). |
| `invalid_payload` | Payload do JWT sem `userId` ou `email`. |
| `server_misconfigured` | `EMAIL_VERIFICATION_SECRET` ausente. |
| `persist_failed` | Falha ao gravar no Firestore. |

## Proteção de rotas (sugestão futura)

Para restringir publicação de avaliações a usuários verificados, basta checar
`profile?.emailVerified === true` antes de habilitar o botão de envio em
páginas como `EmpresaForm` / detalhes de empresa. Não foi implementado neste
ciclo para respeitar o escopo do pedido.
