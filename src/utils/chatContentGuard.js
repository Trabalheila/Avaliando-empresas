// src/utils/chatContentGuard.js
//
// Detecta tentativas de troca de contato direto (email, telefone, URLs)
// em mensagens de chat. Usado no Plano Essencial para bloquear envio.
// Esta validação é apenas no frontend; uma camada equivalente deve
// existir no backend / Cloud Functions antes de persistir a mensagem.

const EMAIL_RE = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[a-z]{2,}/i;
// 8+ dígitos com possíveis separadores ( ) - . espaço — pega celulares e fixos BR.
const PHONE_RE = /(?:\+?\d[\s().-]?){8,}\d/;
// URLs e domínios “soltos” (excluindo o próprio domínio da plataforma).
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|br|app|co)\b/i;
const PLATFORM_DOMAIN_RE = /trabalheila\.com\.br/i;

export function detectContactInfo(text) {
  const raw = String(text || "");
  const normalized = raw
    .replace(/[\s.()-]+/g, " ") // colapsa separadores comuns para detecção
    .replace(/\s+/g, " ");

  const reasons = [];
  if (EMAIL_RE.test(raw) || EMAIL_RE.test(normalized)) reasons.push("email");
  if (PHONE_RE.test(raw)) reasons.push("telefone");
  if (URL_RE.test(raw) && !PLATFORM_DOMAIN_RE.test(raw)) reasons.push("link externo");

  return { hasContact: reasons.length > 0, reasons };
}

/** Mensagem padrão exibida ao usuário quando o conteúdo é bloqueado. */
export const CONTACT_BLOCK_MESSAGE =
  "Compartilhamento de informações de contato direto não é permitido no Plano Essencial. " +
  "Faça upgrade para o Plano Premium para liberar troca de contatos, links e arquivos.";

/** Limite de mensagens por conversa no plano Essencial. */
export const ESSENCIAL_MESSAGE_LIMIT = 5;
