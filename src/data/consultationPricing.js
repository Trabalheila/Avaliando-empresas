/**
 * Tabela de preços tabelados de consulta para Apoiadores Essenciais
 * e configuração do split de pagamento via Mercado Pago.
 *
 * Edite os valores aqui — esse é o único ponto de configuração que
 * precisa ser alterado quando os preços mudarem.
 *
 * As chaves são as mesmas usadas no campo `tipo` do documento do
 * apoiador (slugs definidos em src/pages/ApoiadorCadastro.js).
 */

export const CONSULTATION_PRICE_TABLE = {
  advogado: 150.0,
  advogado_trabalhista: 150.0,
  psicologo: 120.0,
  consultor_rh: 100.0,
  consultor_beneficios: 90.0,
  coach_carreira: 80.0,
};

/** Preço padrão para tipos não mapeados na tabela acima. */
export const CONSULTATION_DEFAULT_PRICE = 100.0;

/**
 * Percentual retido pela plataforma na consulta intermediada.
 * - Essencial: 10% plataforma → 90% profissional
 * - Premium:   12.5% plataforma → 87.5% profissional
 */
export const CONSULTATION_PLATFORM_FEE_PCT = {
  essential: 0.1,
  premium: 0.125,
};

/**
 * Retorna o preço tabelado para um determinado `tipo` de apoiador.
 * Aceita o slug salvo no documento (`advogado`, `consultor_rh`, ...).
 */
export function getTabledPriceForTipo(tipo) {
  const key = String(tipo || "").toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(CONSULTATION_PRICE_TABLE, key)) {
    return CONSULTATION_PRICE_TABLE[key];
  }
  return CONSULTATION_DEFAULT_PRICE;
}

/**
 * Calcula o preço efetivo de consulta para um apoiador.
 *  - Premium com `precoConsulta` definido → usa o valor próprio.
 *  - Essencial → usa o valor tabelado.
 *  - Gratuito → retorna null (não oferece consulta intermediada).
 */
export function getConsultationPrice(apoiador) {
  if (!apoiador) return null;
  const plano = String(apoiador.plano || "").toLowerCase();
  if (plano === "premium") {
    const own = Number(apoiador.precoConsulta);
    if (Number.isFinite(own) && own > 0) return own;
    return null;
  }
  if (plano === "essencial" || plano === "essential") {
    return getTabledPriceForTipo(apoiador.tipo);
  }
  // Gratuito (ou sem plano explícito) NÃO tem consulta intermediada.
  return null;
}

/** Retorna o percentual de plataforma aplicável ao plano do apoiador. */
export function getPlatformFeePct(apoiador) {
  const plano = String(apoiador?.plano || "").toLowerCase();
  if (plano === "premium") return CONSULTATION_PLATFORM_FEE_PCT.premium;
  return CONSULTATION_PLATFORM_FEE_PCT.essential;
}

/* ──────────────────────────────────────────────
   Sistema de avaliação — 5 níveis
   ────────────────────────────────────────────── */
export const RATING_LEVELS = [
  { value: 1, label: "Ruim", color: "text-red-500" },
  { value: 2, label: "Regular", color: "text-orange-500" },
  { value: 3, label: "Bom", color: "text-yellow-500" },
  { value: 4, label: "Ótimo", color: "text-emerald-500" },
  { value: 5, label: "Excelente", color: "text-blue-600" },
];

export function getRatingLabel(rating) {
  const v = Math.round(Number(rating) || 0);
  const found = RATING_LEVELS.find((r) => r.value === v);
  return found ? found.label : "";
}
