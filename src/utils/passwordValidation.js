// src/utils/passwordValidation.js
//
// Regras compartilhadas de força de senha para os formulários de
// criação/alteração de senha (trabalhador, especialista, empresa).

const SPECIAL_RE = /[!@#$%&*()_\-+=[\]{};:,.<>?]/;

/** Avalia uma senha e devolve o status de cada regra. */
export function getPasswordChecks(password) {
  const pw = String(password || "");
  return {
    tamanho: pw.length >= 8,
    maiuscula: /[A-Z]/.test(pw),
    minuscula: /[a-z]/.test(pw),
    numero: /\d/.test(pw),
    especial: SPECIAL_RE.test(pw),
  };
}

/** true quando a senha satisfaz todas as regras. */
export function isPasswordStrong(password) {
  const c = getPasswordChecks(password);
  return c.tamanho && c.maiuscula && c.minuscula && c.numero && c.especial;
}

/** Mensagem de erro padrão quando a senha é fraca (ou null se forte). */
export function passwordStrengthError(password) {
  if (isPasswordStrong(password)) return null;
  return "A senha deve ter no mínimo 8 caracteres, com letra maiúscula, minúscula, número e caractere especial.";
}

/** Itens de checklist prontos para renderizar na UI. */
export function passwordChecklist(password) {
  const c = getPasswordChecks(password);
  return [
    { ok: c.tamanho, label: "Mínimo 8 caracteres" },
    { ok: c.maiuscula, label: "Uma letra maiúscula" },
    { ok: c.minuscula, label: "Uma letra minúscula" },
    { ok: c.numero, label: "Um número" },
    { ok: c.especial, label: "Um caractere especial (@#$%&*!)" },
  ];
}
