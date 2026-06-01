// src/utils/testAccounts.js
// Helpers para identificar e filtrar contas de teste (seed) que não devem
// aparecer em listagens públicas.

const TEST_EMAIL_PATTERNS = [
  /\.teste@trabalheila\.com\.br$/i,
  /^teste\.[^@]+@trabalheila\.com\.br$/i,
];

/**
 * Retorna true se o documento de apoiador parece ser uma conta de teste.
 * Critérios:
 *  - flag explícita `isTest === true`
 *  - id começa com "apoiador_test_"
 *  - e-mail bate com algum padrão de teste conhecido
 */
export function isTestApoiador(a) {
  if (!a) return false;
  if (a.isTest === true) return true;
  const id = String(a.id || "").toLowerCase();
  if (id.startsWith("apoiador_test_")) return true;
  const email = String(a.email || "").toLowerCase();
  if (TEST_EMAIL_PATTERNS.some((re) => re.test(email))) return true;
  return false;
}

/** Remove contas de teste de uma lista de apoiadores. */
export function filterOutTestApoiadores(list) {
  if (!Array.isArray(list)) return list;
  return list.filter((a) => !isTestApoiador(a));
}
