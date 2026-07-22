// src/utils/laborCalculations.js
//
// Cálculo de verbas rescisórias trabalhistas e geração de texto-base de
// petição inicial. Funções puras (sem dependências externas), usadas pela
// seção "Ferramentas do Caso" na página de detalhes do caso do advogado.
//
// AVISO: os cálculos são estimativas simplificadas para apoio ao advogado.
// Não substituem a conferência manual conforme a CCT/ACT aplicável, verbas
// variáveis (comissões, horas extras, adicionais) e particularidades do caso.

/** Converte "1.234,56" (pt-BR) ou número em Number. Retorna NaN se inválido. */
export function parseMoney(input) {
  if (typeof input === "number") return input;
  if (input === null || input === undefined) return NaN;
  const s = String(input).trim().replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  // Remove separador de milhar (.) e troca vírgula decimal por ponto.
  const normalized = s.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

/** Formata número em BRL. */
export function formatBRL(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Arredonda para 2 casas (centavos). */
function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** Diferença em dias inteiros entre duas datas (ISO yyyy-mm-dd). */
function diffDays(startISO, endISO) {
  const a = new Date(startISO);
  const b = new Date(endISO);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

/** Meses trabalhados no ano da rescisão para 13º e férias proporcionais.
 *  Fração ≥ 15 dias conta como mês cheio (regra prática CLT). */
function proportionalMonths(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());
  // Ajuste pelos dias do mês final: ≥ 15 dias conta como mês.
  if (end.getDate() >= 15) months += 1;
  return Math.max(0, Math.min(12, months));
}

/** Meses do 13º / férias no ANO da rescisão (base 1º de janeiro). */
function monthsInTerminationYear(endISO) {
  const end = new Date(endISO);
  if (Number.isNaN(end.getTime())) return 0;
  let months = end.getMonth() + 1; // jan=1
  if (end.getDate() < 15) months -= 1;
  return Math.max(0, Math.min(12, months));
}

export const TIPOS_RESCISAO = [
  { value: "sem_justa_causa", label: "Dispensa sem justa causa" },
  { value: "pedido_demissao", label: "Pedido de demissão" },
  { value: "justa_causa", label: "Dispensa por justa causa" },
  { value: "acordo", label: "Acordo (art. 484-A CLT)" },
];

/**
 * Calcula as verbas rescisórias estimadas.
 *
 * @param {object} args
 * @param {string} args.admissao      data de admissão (yyyy-mm-dd)
 * @param {string} args.demissao      data de demissão (yyyy-mm-dd)
 * @param {number|string} args.salario último salário
 * @param {string} args.tipoRescisao  um dos TIPOS_RESCISAO.value
 * @returns {{ ok: boolean, error?: string, itens?: Array<{label,value}>, total?: number, raw?: object }}
 */
export function calcularVerbasRescisorias({ admissao, demissao, salario, tipoRescisao }) {
  const salarioNum = parseMoney(salario);
  if (!admissao || !demissao) {
    return { ok: false, error: "Informe as datas de admissão e demissão." };
  }
  if (!Number.isFinite(salarioNum) || salarioNum <= 0) {
    return { ok: false, error: "Informe um último salário válido." };
  }
  const totalDias = diffDays(admissao, demissao);
  if (!Number.isFinite(totalDias) || totalDias < 0) {
    return { ok: false, error: "A data de demissão deve ser posterior à admissão." };
  }

  const tipo = String(tipoRescisao || "sem_justa_causa");
  const salarioDia = salarioNum / 30;

  // Saldo de salário: dias trabalhados no mês da rescisão.
  const diasSaldo = new Date(demissao).getDate();
  const saldoSalario = round2(salarioDia * diasSaldo);

  // 13º proporcional: meses no ano da rescisão (avos/12).
  const meses13 = monthsInTerminationYear(demissao);
  const decimoTerceiro = round2((salarioNum / 12) * meses13);

  // Férias proporcionais + 1/3: avos desde o último período aquisitivo.
  // Simplificação: usa meses proporcionais no vínculo (máx. 12) do ciclo atual.
  const mesesFerias = proportionalMonths(admissao, demissao);
  const feriasProporcionais = round2((salarioNum / 12) * mesesFerias);
  const tercoFerias = round2(feriasProporcionais / 3);

  // Aviso prévio indenizado: devido em dispensa sem justa causa (e no acordo,
  // pela metade). 30 dias + 3 dias/ano (teto 90) — usa base 30 dias aqui.
  let avisoPrevio = 0;
  if (tipo === "sem_justa_causa") {
    avisoPrevio = round2(salarioNum);
  } else if (tipo === "acordo") {
    avisoPrevio = round2(salarioNum / 2);
  }

  // FGTS do período (8% sobre salário × meses) — estimativa.
  const mesesVinculo = Math.max(0, Math.floor(totalDias / 30));
  const fgtsDepositos = round2(salarioNum * 0.08 * mesesVinculo);

  // Multa 40% (sem justa causa) ou 20% (acordo) sobre o FGTS estimado.
  let multaFgts = 0;
  if (tipo === "sem_justa_causa") {
    multaFgts = round2(fgtsDepositos * 0.4);
  } else if (tipo === "acordo") {
    multaFgts = round2(fgtsDepositos * 0.2);
  }

  const itens = [
    { key: "saldoSalario", label: `Saldo de salário (${diasSaldo} dias)`, value: saldoSalario },
    { key: "avisoPrevio", label: "Aviso prévio indenizado", value: avisoPrevio },
    { key: "decimoTerceiro", label: `13º proporcional (${meses13}/12)`, value: decimoTerceiro },
    { key: "feriasProporcionais", label: `Férias proporcionais (${mesesFerias}/12)`, value: feriasProporcionais },
    { key: "tercoFerias", label: "1/3 sobre férias", value: tercoFerias },
    { key: "fgtsDepositos", label: `FGTS estimado (${mesesVinculo} meses)`, value: fgtsDepositos },
    { key: "multaFgts", label: "Multa FGTS", value: multaFgts },
  ];

  const total = round2(itens.reduce((acc, it) => acc + (it.value || 0), 0));

  return {
    ok: true,
    itens,
    total,
    raw: {
      admissao,
      demissao,
      salario: salarioNum,
      tipoRescisao: tipo,
      totalDias,
      mesesVinculo,
    },
  };
}

/** Rótulo amigável de um tipo de rescisão. */
export function labelTipoRescisao(value) {
  return TIPOS_RESCISAO.find((t) => t.value === value)?.label || value || "—";
}

/**
 * Gera um texto-base editável de petição inicial trabalhista com os dados do
 * caso já preenchidos. É um rascunho de apoio — o advogado revisa e completa.
 *
 * @param {object} p
 * @param {string} [p.autorNome]      nome do reclamante (cliente)
 * @param {string} [p.autorCpf]
 * @param {string} [p.autorEndereco]
 * @param {string} [p.reclamada]      nome/razão social da reclamada
 * @param {string} [p.vara]           instância / vara
 * @param {string} [p.valorCausa]     valor da causa (número ou string BRL)
 * @param {string} [p.fatos]          descrição dos fatos
 * @param {Array<{label,value}>} [p.verbas] verbas do cálculo (opcional)
 * @returns {string}
 */
export function gerarPeticaoInicial(p = {}) {
  const {
    autorNome = "[NOME DO RECLAMANTE]",
    autorCpf = "[CPF]",
    autorEndereco = "[ENDEREÇO]",
    reclamada = "[NOME DA RECLAMADA]",
    vara = "[VARA DO TRABALHO]",
    valorCausa,
    fatos = "[Descrever os fatos: contratação, função, jornada, salário, motivo e data da rescisão, verbas não pagas.]",
  } = p;

  const valorCausaFmt =
    valorCausa != null && String(valorCausa).trim() !== ""
      ? formatBRL(parseMoney(valorCausa))
      : "[VALOR DA CAUSA]";

  const verbasTexto =
    Array.isArray(p.verbas) && p.verbas.length
      ? p.verbas
          .filter((v) => Number(v.value) > 0)
          .map((v) => `        ${v.label} — ${formatBRL(v.value)};`)
          .join("\n")
      : "        [Listar as verbas pleiteadas];";

  return `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DA ${vara.toUpperCase()}

${autorNome}, inscrito(a) no CPF sob o nº ${autorCpf}, residente e domiciliado(a) em ${autorEndereco}, por seu(sua) advogado(a) que esta subscreve, vem, respeitosamente, à presença de Vossa Excelência, com fundamento na Consolidação das Leis do Trabalho, propor a presente

RECLAMAÇÃO TRABALHISTA

em face de ${reclamada}, pelos fatos e fundamentos a seguir expostos.

I - DOS FATOS

${fatos}

II - DO DIREITO

Os fatos narrados encontram amparo na Consolidação das Leis do Trabalho (CLT) e na Constituição Federal, que asseguram ao trabalhador o pagamento integral das verbas rescisórias e demais direitos decorrentes do contrato de trabalho.

III - DOS PEDIDOS

Ante o exposto, requer-se:

    a) a citação da reclamada para, querendo, apresentar defesa, sob pena de revelia e confissão;

    b) a procedência dos pedidos, com a condenação da reclamada ao pagamento das seguintes verbas:
${verbasTexto}

    c) a condenação da reclamada ao pagamento de custas, honorários advocatícios e correção monetária;

    d) a produção de todos os meios de prova em direito admitidos.

Dá-se à causa o valor de ${valorCausaFmt}.

Nestes termos,
Pede deferimento.

[LOCAL], [DATA].

_______________________________________
[NOME DO ADVOGADO(A)] — OAB/[UF] nº [NÚMERO]`;
}

/** Itens padrão do checklist do processo trabalhista. */
export const DEFAULT_CHECKLIST_ITEMS = [
  "Documentação do cliente recebida",
  "Petição inicial protocolada",
  "Citação do réu realizada",
  "Audiência de conciliação realizada",
  "Instrução probatória concluída",
  "Alegações finais apresentadas",
  "Sentença recebida",
  "Prazo recursal verificado",
];

/** Opções de status do processo. */
export const PROCESS_STATUS_OPTIONS = [
  "Ativo",
  "Em andamento",
  "Aguardando audiência",
  "Recurso interposto",
  "Sentença proferida",
  "Transitado em julgado",
  "Encerrado",
];
