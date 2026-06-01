// src/data/mockCaseDetails.js
//
// Detalhes mockados de casos por tipo de especialista, indexados pelo
// `caseId` usado nos `mockActiveCases` de `src/pages/MyContactsApoiador.js`.
// Quando a coleção real `/apoiadores/{id}/cases` existir, este módulo
// pode ser substituído por uma camada de fetch real (mantendo a mesma
// forma de retorno em `getCaseDetails`).

const mockCaseDetails = {
  advogado: {
    case_001: {
      client: "Trabalhador #A82F",
      caseType: "Horas extras não pagas",
      processNumber: "1001234-56.2026.5.02.0001",
      court: "1ª Vara do Trabalho – SP",
      status: "Em andamento",
      nextAction: "Audiência inicial",
      nextActionDate: "2026-06-10",
      documents: [
        { name: "Petição Inicial.pdf", url: "#" },
        { name: "Contestação.pdf", url: "#" },
        { name: "Cálculo de horas extras.xlsx", url: "#" },
      ],
      timeline: [
        { date: "2026-04-12", event: "Petição Inicial protocolada" },
        { date: "2026-05-03", event: "Citação da empresa ré" },
        { date: "2026-06-10", event: "Audiência inicial agendada" },
      ],
      notes: "Cliente apresentou registros de ponto e e-mails comprovando horas extras não pagas.",
    },
    case_002: {
      client: "Trabalhador #71BC",
      caseType: "Rescisão indireta",
      processNumber: "1009876-12.2026.5.02.0010",
      court: "10ª Vara do Trabalho – SP",
      status: "Aguardando documentos",
      nextAction: "Receber holerites",
      nextActionDate: "2026-06-05",
      documents: [
        { name: "Procuração.pdf", url: "#" },
        { name: "CTPS digital.pdf", url: "#" },
      ],
      timeline: [
        { date: "2026-05-20", event: "Consulta inicial" },
        { date: "2026-05-25", event: "Solicitação de documentos ao cliente" },
      ],
      notes: "Aguardando holerites dos últimos 6 meses para complementar a inicial.",
    },
    case_003: {
      client: "Empresa Acme S.A.",
      caseType: "Defesa em ação coletiva",
      processNumber: "2007777-99.2026.5.02.0003",
      court: "TRT – 2ª Região",
      status: "Em andamento",
      nextAction: "Protocolar contestação",
      nextActionDate: "2026-06-12",
      documents: [
        { name: "Petição Inicial (autor).pdf", url: "#" },
        { name: "Minuta de contestação.docx", url: "#" },
      ],
      timeline: [
        { date: "2026-05-15", event: "Recebimento da ação" },
        { date: "2026-06-12", event: "Prazo para contestação" },
      ],
      notes: "Ação coletiva referente a equiparação salarial — preparar defesa preliminar.",
    },
    case_004: {
      client: "Trabalhador #55DD",
      caseType: "Indenização por assédio",
      processNumber: "1004444-33.2025.5.02.0007",
      court: "7ª Vara do Trabalho – SP",
      status: "Aguardando pagamento",
      nextAction: "Emitir alvará",
      nextActionDate: "2026-06-03",
      documents: [
        { name: "Sentença.pdf", url: "#" },
        { name: "Cálculo final.xlsx", url: "#" },
      ],
      timeline: [
        { date: "2025-11-10", event: "Sentença favorável" },
        { date: "2026-05-28", event: "Trânsito em julgado" },
      ],
      notes: "Verificar dados bancários do cliente para emissão de alvará.",
    },
  },
  consultor_rh: {
    rh_001: {
      client: "Empresa Alfa",
      caseType: "Recrutamento e Seleção",
      projectPhase: "Sourcing",
      deliverable: "Shortlist de candidatos",
      status: "Em andamento",
      nextAction: "Entrevistas finais",
      nextActionDate: "2026-06-03",
      documents: [
        { name: "Briefing da vaga.pdf", url: "#" },
        { name: "Shortlist candidatos.xlsx", url: "#" },
      ],
      milestones: [
        { date: "2026-05-10", event: "Kickoff do projeto" },
        { date: "2026-05-20", event: "Sourcing iniciado" },
        { date: "2026-06-03", event: "Entrevistas finais" },
      ],
      notes: "Foco em perfis de TI com experiência em scale-ups.",
    },
    rh_002: {
      client: "Empresa Beta",
      caseType: "Plano de Carreira",
      projectPhase: "Desenho",
      deliverable: "Proposta de plano",
      status: "Aguardando aprovação",
      nextAction: "Reunião com diretoria",
      nextActionDate: "2026-06-10",
      documents: [
        { name: "Matriz de competências.xlsx", url: "#" },
        { name: "Proposta inicial.pdf", url: "#" },
      ],
      milestones: [
        { date: "2026-04-15", event: "Diagnóstico de cargos" },
        { date: "2026-05-30", event: "Proposta entregue" },
      ],
      notes: "Diretoria solicitou alinhamento com banda salarial de mercado.",
    },
    rh_003: {
      client: "Startup Beta",
      caseType: "Diagnóstico de clima",
      projectPhase: "Coleta de dados",
      deliverable: "Relatório executivo",
      status: "Aguardando documentos",
      nextAction: "Receber pesquisa interna",
      nextActionDate: "2026-06-04",
      documents: [
        { name: "Questionário de clima.pdf", url: "#" },
      ],
      milestones: [
        { date: "2026-05-25", event: "Lançamento da pesquisa" },
      ],
      notes: "Aguardar 70% de adesão antes de consolidar resultados.",
    },
  },
  recrutador: {
    rec_001: {
      client: "Empresa Gama",
      caseType: "Recrutamento Tech",
      position: "Desenvolvedor Sênior",
      pipelineStage: "Triagem de CVs",
      status: "Em andamento",
      nextAction: "Agendar entrevistas",
      nextActionDate: "2026-06-02",
      candidates: [
        { name: "Candidato #001", stage: "Entrevista técnica" },
        { name: "Candidato #002", stage: "Aguardando teste" },
      ],
      documents: [
        { name: "Job Description.pdf", url: "#" },
        { name: "Funil de candidatos.xlsx", url: "#" },
      ],
      notes: "Cliente prioriza experiência com Go e Kubernetes.",
    },
    rec_002: {
      client: "Empresa Delta",
      caseType: "Recrutamento Comercial",
      position: "Gerente de Vendas",
      pipelineStage: "Entrevistas",
      status: "Aguardando feedback",
      nextAction: "Follow-up cliente",
      nextActionDate: "2026-06-07",
      candidates: [
        { name: "Candidato #A", stage: "Painel final" },
      ],
      documents: [
        { name: "Avaliação de fit cultural.pdf", url: "#" },
      ],
      notes: "Aguardando devolutiva do CEO sobre painel final.",
    },
    rec_003: {
      client: "Startup Gama",
      caseType: "Vaga aberta",
      position: "Product Designer Sênior",
      pipelineStage: "Sourcing",
      status: "Em andamento",
      nextAction: "Triagem inicial",
      nextActionDate: "2026-06-02",
      candidates: [],
      documents: [
        { name: "Brief de design.pdf", url: "#" },
      ],
      notes: "Buscar perfis com portfólio em produtos B2B SaaS.",
    },
  },
  psicologo: {
    psi_001: {
      client: "Trabalhador #C123",
      caseType: "Acompanhamento",
      sessionsCount: 3,
      focusArea: "Estresse no trabalho",
      status: "Em andamento",
      nextAction: "Próxima sessão",
      nextActionDate: "2026-06-04",
      reports: [
        { name: "Laudo Psicológico Inicial.pdf", url: "#" },
        { name: "Relatório – Sessão 1.pdf", url: "#" },
        { name: "Relatório – Sessão 2.pdf", url: "#" },
      ],
      sessions: [
        { date: "2026-05-07", notes: "Paciente relata sobrecarga; iniciado plano de manejo." },
        { date: "2026-05-21", notes: "Aplicação de técnicas de respiração e mindfulness." },
        { date: "2026-05-28", notes: "Melhora no sono; manter acompanhamento quinzenal." },
      ],
      notes: "Paciente demonstra melhora na gestão do estresse.",
    },
    psi_002: {
      client: "Trabalhador #D456",
      caseType: "Avaliação",
      sessionsCount: 1,
      focusArea: "Burnout",
      status: "Aguardando laudo",
      nextAction: "Finalizar relatório",
      nextActionDate: "2026-06-08",
      reports: [
        { name: "Anamnese.pdf", url: "#" },
      ],
      sessions: [
        { date: "2026-05-30", notes: "Aplicação de MBI; sinais de exaustão emocional severa." },
      ],
      notes: "Encaminhamento sugerido para afastamento temporário.",
    },
    psi_003: {
      client: "Empresa Acme S.A.",
      caseType: "Programa de bem-estar",
      sessionsCount: 2,
      focusArea: "Prevenção",
      status: "Em andamento",
      nextAction: "Workshop coletivo",
      nextActionDate: "2026-06-14",
      reports: [
        { name: "Diagnóstico de clima.pdf", url: "#" },
        { name: "Plano de ação.pdf", url: "#" },
      ],
      sessions: [
        { date: "2026-05-15", notes: "Reunião com RH para alinhamento de objetivos." },
        { date: "2026-05-29", notes: "Definição de KPIs do programa." },
      ],
      notes: "Próximo workshop terá foco em comunicação não-violenta.",
    },
  },
  medico: {
    med_001: {
      client: "Funcionário #E789",
      caseType: "Exame Admissional",
      examType: "Clínico",
      crmStatus: "Ativo",
      status: "Finalizado",
      nextAction: "Entregar ASO",
      nextActionDate: "2026-06-01",
      exams: [
        { name: "ASO admissional.pdf", url: "#" },
        { name: "Acuidade visual.pdf", url: "#" },
      ],
      history: [
        { date: "2026-05-29", event: "Consulta admissional realizada" },
        { date: "2026-06-01", event: "ASO assinado" },
      ],
      notes: "Apto sem restrições.",
    },
    med_002: {
      client: "Funcionário #F012",
      caseType: "Consulta Ocupacional",
      examType: "Periódico",
      crmStatus: "Ativo",
      status: "Em andamento",
      nextAction: "Solicitar exames",
      nextActionDate: "2026-06-06",
      exams: [
        { name: "Solicitação de hemograma.pdf", url: "#" },
      ],
      history: [
        { date: "2026-05-28", event: "Consulta periódica" },
      ],
      notes: "Solicitados exames complementares.",
    },
    med_003: {
      client: "Empresa Acme S.A.",
      caseType: "PCMSO anual",
      examType: "Periódico",
      crmStatus: "Em andamento",
      status: "Em andamento",
      nextAction: "Realizar exames periódicos",
      nextActionDate: "2026-06-06",
      exams: [
        { name: "Cronograma PCMSO.pdf", url: "#" },
      ],
      history: [
        { date: "2026-04-10", event: "Renovação do PCMSO" },
      ],
      notes: "Coordenando agenda de exames periódicos com o RH.",
    },
  },
  contador: {
    cont_001: {
      client: "Empresa GHI",
      caseType: "Assessoria Fiscal",
      regime: "Simples Nacional",
      nextObligation: "DAS",
      status: "Em andamento",
      nextAction: "Fechamento mensal",
      nextActionDate: "2026-06-05",
      fiscalDocs: [
        { name: "DAS Maio/2026.pdf", url: "#" },
        { name: "Balancete Maio.xlsx", url: "#" },
      ],
      obligations: [
        { date: "2026-06-20", event: "Vencimento do DAS" },
        { date: "2026-06-30", event: "Entrega de declarações acessórias" },
      ],
      notes: "Cliente migrou para faturamento misto (serviços + comércio).",
    },
    cont_002: {
      client: "Empresa JKL",
      caseType: "Declaração de IR",
      regime: "Lucro Presumido",
      nextObligation: "IRPJ",
      status: "Aguardando dados",
      nextAction: "Solicitar documentos",
      nextActionDate: "2026-06-15",
      fiscalDocs: [
        { name: "Checklist documentos.pdf", url: "#" },
      ],
      obligations: [
        { date: "2026-06-30", event: "Encerramento do trimestre fiscal" },
      ],
      notes: "Aguardando notas fiscais de serviços do trimestre.",
    },
    cont_003: {
      client: "Empresa Acme S.A.",
      caseType: "Folha de pagamento",
      regime: "Lucro Real",
      nextObligation: "DCTFWeb 15/06",
      status: "Em andamento",
      nextAction: "Fechar folha",
      nextActionDate: "2026-06-05",
      fiscalDocs: [
        { name: "Folha Maio.pdf", url: "#" },
        { name: "Recibos de pagamento.zip", url: "#" },
      ],
      obligations: [
        { date: "2026-06-15", event: "Entrega da DCTFWeb" },
      ],
      notes: "Provisão de férias precisa ser revisada antes do fechamento.",
    },
  },
  engenheiro_seguranca: {
    eng_001: {
      client: "Construtora MNO",
      caseType: "Auditoria de Canteiro",
      siteLocation: "Obra Centro",
      riskLevel: "Alto",
      status: "Em andamento",
      nextAction: "Relatório de não conformidades",
      nextActionDate: "2026-06-07",
      reports: [
        { name: "Checklist de campo.pdf", url: "#" },
        { name: "Foto-laudo.zip", url: "#" },
      ],
      history: [
        { date: "2026-05-30", event: "Vistoria realizada" },
      ],
      notes: "Identificadas falhas em proteção coletiva no 4º pavimento.",
    },
    eng_002: {
      client: "Indústria PQR",
      caseType: "Elaboração de PPRA",
      siteLocation: "Fábrica",
      riskLevel: "Médio",
      status: "Aguardando dados",
      nextAction: "Levantamento de riscos",
      nextActionDate: "2026-06-12",
      reports: [
        { name: "Inventário de riscos preliminar.xlsx", url: "#" },
      ],
      history: [
        { date: "2026-05-20", event: "Kickoff com SESMT do cliente" },
      ],
      notes: "Coleta de dados em campo agendada para 12/06.",
    },
    eng_003: {
      client: "Empresa Acme S.A.",
      caseType: "Implantação PPRA",
      siteLocation: "Galpão industrial – SP",
      riskLevel: "Grau 3",
      status: "Em andamento",
      nextAction: "Visita técnica",
      nextActionDate: "2026-06-11",
      reports: [
        { name: "PPRA – minuta.pdf", url: "#" },
      ],
      history: [
        { date: "2026-05-10", event: "Início da implantação" },
      ],
      notes: "Treinamento dos brigadistas previsto para semana seguinte.",
    },
  },
  fisioterapeuta_ocupacional: {
    fis_001: {
      client: "Trabalhador #S345",
      caseType: "Reabilitação Postural",
      protocol: "Protocolo Coluna",
      sessionsRemaining: 5,
      status: "Em andamento",
      nextAction: "Próxima sessão",
      nextActionDate: "2026-06-03",
      sessions: [
        { date: "2026-05-13", notes: "Avaliação postural; início do protocolo." },
        { date: "2026-05-20", notes: "Alongamentos e fortalecimento de core." },
      ],
      reports: [
        { name: "Avaliação inicial.pdf", url: "#" },
      ],
      notes: "Paciente relata melhora na dor lombar.",
    },
    fis_002: {
      client: "Trabalhador #T678",
      caseType: "Prevenção de LER/DORT",
      protocol: "Protocolo LER",
      sessionsRemaining: 3,
      status: "Aguardando avaliação",
      nextAction: "Avaliação ergonômica",
      nextActionDate: "2026-06-09",
      sessions: [],
      reports: [
        { name: "Questionário de sintomas.pdf", url: "#" },
      ],
      notes: "Aguardando agenda na empresa para análise do posto de trabalho.",
    },
    fis_003: {
      client: "Empresa Acme S.A.",
      caseType: "Ginástica laboral",
      protocol: "Cervical / postural",
      sessionsRemaining: 4,
      status: "Em andamento",
      nextAction: "Próxima sessão",
      nextActionDate: "2026-06-06",
      sessions: [
        { date: "2026-05-23", notes: "Sessão coletiva no setor administrativo." },
      ],
      reports: [
        { name: "Cronograma semanal.pdf", url: "#" },
      ],
      notes: "Próxima rodada de avaliação postural em julho.",
    },
  },
  outro: {},
};

/** Normaliza o tipo de especialista para casar com as chaves do mapa. */
function normalizeTipo(tipo) {
  return (tipo || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

/**
 * Retorna os detalhes mockados do caso ou `null` se não houver.
 */
export function getCaseDetails(tipo, caseId) {
  if (!caseId) return null;
  const key = normalizeTipo(tipo);
  return mockCaseDetails[key]?.[caseId] || null;
}

export default mockCaseDetails;
