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

/**
 * Tabela de preços tabelados para consultas EMPRESARIAIS (audience=employer).
 * Valores mais altos refletem o escopo corporativo da consulta.
 * Chaves casam com `tipo` do documento do apoiador.
 */
export const EMPLOYER_CONSULTATION_PRICE_TABLE = {
  consultor_rh: 250.0,
  contador: 200.0,
  advogado: 300.0,
  advogado_trabalhista: 300.0,
  employer_branding: 220.0,
  consultor_employer_branding: 220.0,
  consultor_beneficios: 180.0,
};

/**
 * Catálogo de especialidades exibidas na busca segmentado por audiência.
 * Quando um trabalhador busca apoiador → use SPECIALTIES_BY_AUDIENCE.worker.
 * Quando uma empresa busca apoiador → use SPECIALTIES_BY_AUDIENCE.employer.
 */
export const SPECIALTIES_BY_AUDIENCE = {
  worker: [
    { value: "advogado_trabalhista", label: "Direito trabalhista" },
    { value: "psicologo", label: "Psicologia" },
    { value: "coach_carreira", label: "Coach de carreira" },
    { value: "consultor_rh", label: "Consultoria de RH" },
    { value: "consultor_beneficios", label: "Benefícios" },
  ],
  employer: [
    { value: "consultor_rh", label: "Consultoria de RH" },
    { value: "contador", label: "Contabilidade" },
    { value: "advogado_trabalhista", label: "Advocacia empresarial trabalhista" },
    { value: "employer_branding", label: "Employer branding" },
    { value: "consultor_beneficios", label: "Benefícios corporativos" },
  ],
};

/** Preço padrão para tipos não mapeados na tabela acima. */
export const CONSULTATION_DEFAULT_PRICE = 100.0;

/**
 * Preços FIXOS das consultas avulsas solicitadas por trabalhadores no
 * Plano Gratuito. Independem do plano/tipo do especialista — o que difere
 * é apenas a modalidade (texto/chat vs. videochamada).
 *
 * Espelha a tabela do backend em `api/_paymentsHelpers.js`
 * (CONSULTA_PRICE_TABLE.essencial) — mantenha os dois lados em sincronia.
 */
export const FREE_PLAN_CONSULTATION_PRICE = {
  chat: 45.0,
  video: 75.0,
};

/**
 * SLA de resposta (em minutos) que o profissional assume ao aceitar uma
 * consulta avulsa do Plano Gratuito. Exibido ao trabalhador (promessa) e
 * ao especialista (compromisso) na interface.
 */
export const FREE_PLAN_RESPONSE_SLA_MINUTES = 10;

/**
 * Retorna o preço fixo do Plano Gratuito para a modalidade informada.
 * `modalidade` aceita "video"/"videochamada"/"videocall" → vídeo; o resto
 * cai em chat (texto).
 */
export function getFreePlanConsultationPrice(modalidade) {
  const m = String(modalidade || "").toLowerCase().trim();
  const isVideo = m === "video" || m === "videochamada" || m === "videocall";
  return isVideo
    ? FREE_PLAN_CONSULTATION_PRICE.video
    : FREE_PLAN_CONSULTATION_PRICE.chat;
}

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
 * `audience` (worker|employer) seleciona a tabela apropriada.
 */
export function getTabledPriceForTipo(tipo, audience = "worker") {
  const key = String(tipo || "").toLowerCase().trim();
  const table =
    audience === "employer" ? EMPLOYER_CONSULTATION_PRICE_TABLE : CONSULTATION_PRICE_TABLE;
  if (Object.prototype.hasOwnProperty.call(table, key)) {
    return table[key];
  }
  return CONSULTATION_DEFAULT_PRICE;
}

/**
 * Calcula o preço efetivo de consulta para um apoiador.
 *  - Premium com `precoConsulta` definido → usa o valor próprio.
 *  - Essencial → usa o valor tabelado da `audience` (worker/employer).
 *  - Gratuito → retorna null (não oferece consulta intermediada).
 */
export function getConsultationPrice(apoiador, audience = "worker") {
  if (!apoiador) return null;
  const plano = String(apoiador.plano || "").toLowerCase();
  if (plano === "premium") {
    // Apoiador Premium pode ter preço diferente por audiência.
    const fieldByAudience =
      audience === "employer"
        ? Number(apoiador.precoConsultaEmpresa)
        : Number(apoiador.precoConsulta);
    if (Number.isFinite(fieldByAudience) && fieldByAudience > 0) return fieldByAudience;
    const own = Number(apoiador.precoConsulta);
    if (Number.isFinite(own) && own > 0) return own;
    return null;
  }
  if (plano === "essencial" || plano === "essential") {
    return getTabledPriceForTipo(apoiador.tipo, audience);
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
