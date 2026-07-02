import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import AppHeader from "../components/AppHeader";
import {
  listIncomingApoiadorRequests,
  markApoiadorRequestRead,
  respondToApoiadorRequest,
} from "../services/contactRequests";
import { listConversationsForParticipant } from "../services/chat";
import { isTestApoiador } from "../utils/testAccounts";
import { buildSpecialistConversationId } from "../utils/chatId";
import { listSpecialistCases, closeSpecialistCase } from "../services/specialistCases";

/* ──────────────────────────────────────────────────────────────
 * Configurações por tipo de especialista (área de atuação).
 *
 * `tipo` segue os valores salvos em `apoiadores/{id}.tipo`
 * (advogado, medico, psicologo, consultor_rh, contador,
 *  engenheiro_seguranca, fisioterapeuta_ocupacional, recrutador,
 *  outro). Cada entrada define:
 *   - label:             título amigável exibido no cabeçalho.
 *   - caseLabel:         termo usado em "Tipo de caso" (Processo / Projeto / Atendimento).
 *   - extraColumns:      colunas adicionais na tabela de Casos Ativos.
 *                        Cada item é { key, label, render? }.
 *   - resourceLinks:     array de links exibidos em "Recursos e Ferramentas".
 *   - mockActiveCases:   dados mockados (substituir por queries reais à
 *                        coleção /apoiadores/{id}/cases quando existir).
 *   - dashboardSections: ordem (e visibilidade) das seções renderizadas
 *                        no dashboard. IDs válidos: overview, activeCases,
 *                        pendingRequests, caseHistory, reputation,
 *                        resources, profileSettings.
 * ────────────────────────────────────────────────────────────── */
const DEFAULT_DASHBOARD_SECTIONS = [
  "overview",
  "activeCases",
  "pendingRequests",
  "caseHistory",
  "reputation",
  "resources",
  "profileSettings",
];

export const SPECIALIST_CONFIGS = {
  advogado: {
    label: "Advogado(a) trabalhista",
    caseLabel: "Processo",
    canVideoConference: true,
    extraColumns: [
      { key: "processNumber", label: "Nº do processo" },
      { key: "court", label: "Instância / Vara" },
    ],
    resourceLinks: [
      { label: "CLT - Consolidação das Leis do Trabalho", href: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm", emoji: "⚖️", type: "legislation" },
      { label: "Súmulas do TST", href: "https://www.tst.jus.br/sumulas", emoji: "📖", type: "jurisprudence" },
      { label: "OJs da SDI-1 do TST", href: "https://www.tst.jus.br/oj-sdi-1", emoji: "📑", type: "jurisprudence" },
      { label: "Jurisprudência TST", href: "https://www.tst.jus.br/jurisprudencia", emoji: "📚", type: "jurisprudence" },
      { label: "Modelos de petições", href: "https://www.google.com/search?q=modelos+de+peti%C3%A7%C3%B5es+trabalhistas", emoji: "📄", type: "template" },
      { label: "Calendário de audiências", href: "https://www.google.com/search?q=calend%C3%A1rio+de+audi%C3%AAncias+trabalhistas", emoji: "📅", type: "tool" },
      { label: "Notícias: Jurisprudência trabalhista", href: "https://www.tst.jus.br/noticias", emoji: "📰", type: "news" },
      { label: "Notícias: Reforma trabalhista e impactos", href: "https://www.google.com/search?q=not%C3%ADcias+reforma+trabalhista+impactos", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "activeCases",
      "pendingRequests",
      "clientOpportunities",
      "caseHistory",
      "reputation",
      "resources",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "case_001",
        clientAlias: "Trabalhador #A82F",
        caseType: "Horas extras não pagas",
        status: "Em andamento",
        nextAction: "Audiência inicial",
        nextActionDate: "2026-06-10",
        processNumber: "1001234-56.2026.5.02.0001",
        court: "1ª Vara do Trabalho – SP",
      },
      {
        id: "case_002",
        clientAlias: "Trabalhador #71BC",
        caseType: "Rescisão indireta",
        status: "Aguardando documentos",
        nextAction: "Receber holerites",
        nextActionDate: "2026-06-05",
        processNumber: "1009876-12.2026.5.02.0010",
        court: "10ª Vara do Trabalho – SP",
      },
      {
        id: "case_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "Defesa em ação coletiva",
        status: "Em andamento",
        nextAction: "Protocolar contestação",
        nextActionDate: "2026-06-12",
        processNumber: "2007777-99.2026.5.02.0003",
        court: "TRT – 2ª Região",
      },
      {
        id: "case_004",
        clientAlias: "Trabalhador #55DD",
        caseType: "Indenização por assédio",
        status: "Aguardando pagamento",
        nextAction: "Emitir alvará",
        nextActionDate: "2026-06-03",
        processNumber: "1004444-33.2025.5.02.0007",
        court: "7ª Vara do Trabalho – SP",
      },
    ],
    mockPotentialClients: [
      {
        id: "opp_001",
        pseudonym: "Trabalhador #L4F2",
        complaintType: "Atraso de Salário",
        location: "São Paulo / SP",
        status: "Novo",
        summary: "Salário atrasado há 3 meses na empresa atual.",
      },
      {
        id: "opp_002",
        pseudonym: "Trabalhador #M8C1",
        complaintType: "Assédio Moral",
        location: "Belo Horizonte / MG",
        status: "Em Análise",
        summary: "Gestor humilha publicamente em reuniões.",
      },
      {
        id: "opp_003",
        pseudonym: "Trabalhador #N220",
        complaintType: "Demissão Injusta",
        location: "Curitiba / PR",
        status: "Novo",
        summary: "Demitido após afastamento por saúde.",
      },
      {
        id: "opp_004",
        pseudonym: "Trabalhador #O9A7",
        complaintType: "Horas Extras",
        location: "Porto Alegre / RS",
        status: "Novo",
        summary: "Média de 20h extras/mês não pagas.",
      },
      {
        id: "opp_005",
        pseudonym: "Trabalhador #P6B3",
        complaintType: "Verbas rescisórias",
        location: "Rio de Janeiro / RJ",
        status: "Em Análise",
        summary: "Rescisão sem pagamento de FGTS e multa.",
      },
      {
        id: "opp_006",
        pseudonym: "Trabalhador #Q1D8",
        complaintType: "Assédio Moral",
        location: "Blumenau / SC",
        status: "Novo",
        summary: "Pressão por metas inatingíveis e ameaças.",
      },
    ],
  },
  consultor_rh: {
    label: "Consultor(a) de RH",
    caseLabel: "Projeto",
    canVideoConference: true,
    extraColumns: [
      { key: "projectPhase", label: "Fase do projeto" },
      { key: "deliverable", label: "Próxima entrega" },
    ],
    resourceLinks: [
      { label: "Melhores práticas de RH", href: "https://www.gupy.io/blog/melhores-praticas-rh", emoji: "🌟", type: "guide" },
      { label: "Modelos de avaliação de desempenho", href: "https://www.google.com/search?q=modelos+de+avalia%C3%A7%C3%A3o+de+desempenho", emoji: "📊", type: "template" },
      { label: "Pesquisas salariais atualizadas", href: "https://www.vagas.com.br/blog/pesquisa-salarial/", emoji: "💰", type: "tool" },
      { label: "Fórum de Especialistas", href: "https://www.linkedin.com/groups/?keywords=recursos%20humanos", emoji: "💬", type: "community" },
      { label: "Notícias: Tendências em gestão de pessoas", href: "https://www.rhpravo.com.br/noticias/", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "activeCases",
      "resources",
      "reputation",
      "pendingRequests",
      "caseHistory",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "rh_001",
        clientAlias: "Empresa Alfa",
        caseType: "Recrutamento e Seleção",
        status: "Em andamento",
        nextAction: "Entrevistas finais",
        nextActionDate: "2026-06-03",
        projectPhase: "Sourcing",
        deliverable: "Shortlist de candidatos",
      },
      {
        id: "rh_002",
        clientAlias: "Empresa Beta",
        caseType: "Plano de Carreira",
        status: "Aguardando aprovação",
        nextAction: "Reunião com diretoria",
        nextActionDate: "2026-06-10",
        projectPhase: "Desenho",
        deliverable: "Proposta de plano",
      },
      {
        id: "rh_003",
        clientAlias: "Startup Beta",
        caseType: "Diagnóstico de clima",
        status: "Aguardando documentos",
        nextAction: "Receber pesquisa interna",
        nextActionDate: "2026-06-04",
        projectPhase: "Coleta de dados",
        deliverable: "Relatório executivo",
      },
    ],
  },
  recrutador: {
    label: "Recrutador(a)",
    caseLabel: "Vaga",
    canVideoConference: true,
    extraColumns: [
      { key: "position", label: "Posição" },
      { key: "pipelineStage", label: "Etapa do pipeline" },
    ],
    resourceLinks: [
      { label: "Ferramentas de Recrutamento", href: "https://www.gupy.io/blog/ferramentas-de-recrutamento", emoji: "🎯", type: "tool" },
      { label: "Tendências de Mercado de Talentos", href: "https://www.vagas.com.br/blog/tendencias-mercado-trabalho/", emoji: "📈", type: "guide" },
      { label: "Modelos de Job Description", href: "https://www.google.com/search?q=modelos+de+job+description", emoji: "📝", type: "template" },
      { label: "Fórum de Especialistas", href: "https://www.linkedin.com/groups/?keywords=recrutamento%20e%20sele%C3%A7%C3%A3o", emoji: "💬", type: "community" },
      { label: "Notícias: O Futuro do Recrutamento", href: "https://www.linkedin.com/news/topics/recruitment/", emoji: "📰", type: "news" },
    ],
    dashboardSections: DEFAULT_DASHBOARD_SECTIONS,
    mockActiveCases: [
      {
        id: "rec_001",
        clientAlias: "Empresa Gama",
        caseType: "Recrutamento Tech",
        status: "Em andamento",
        nextAction: "Agendar entrevistas",
        nextActionDate: "2026-06-02",
        position: "Desenvolvedor Sênior",
        pipelineStage: "Triagem de CVs",
      },
      {
        id: "rec_002",
        clientAlias: "Empresa Delta",
        caseType: "Recrutamento Comercial",
        status: "Aguardando feedback",
        nextAction: "Follow-up cliente",
        nextActionDate: "2026-06-07",
        position: "Gerente de Vendas",
        pipelineStage: "Entrevistas",
      },
      {
        id: "rec_003",
        clientAlias: "Startup Gama",
        caseType: "Vaga aberta",
        status: "Em andamento",
        nextAction: "Triagem inicial",
        nextActionDate: "2026-06-02",
        position: "Product Designer Sênior",
        pipelineStage: "Sourcing",
      },
    ],
  },
  psicologo: {
    label: "Psicólogo(a) organizacional",
    caseLabel: "Atendimento",
    canVideoConference: true,
    extraColumns: [
      { key: "sessionsCount", label: "Sessões realizadas" },
      { key: "focusArea", label: "Foco principal" },
    ],
    resourceLinks: [
      { label: "Código de ética CRP", href: "https://site.cfp.org.br/documentos/codigo-de-etica-profissional-do-psicologo/", emoji: "⚖️", type: "legislation" },
      { label: "Protocolos de saúde mental no trabalho", href: "https://www.google.com/search?q=protocolos+sa%C3%BAde+mental+trabalho", emoji: "🧠", type: "guide" },
      { label: "Modelos de anamnese", href: "https://www.google.com/search?q=modelos+de+anamnese+psicol%C3%B3gica", emoji: "📄", type: "template" },
      { label: "Agenda de sessões", href: "https://calendar.google.com/", emoji: "📅", type: "tool" },
      { label: "Notícias: Bem-estar e produtividade", href: "https://www.psicologia.pt/noticias/", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "reputation",
      "activeCases",
      "pendingRequests",
      "caseHistory",
      "resources",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "psi_001",
        clientAlias: "Trabalhador #C123",
        caseType: "Acompanhamento",
        status: "Em andamento",
        nextAction: "Próxima sessão",
        nextActionDate: "2026-06-04",
        sessionsCount: 3,
        focusArea: "Estresse no trabalho",
      },
      {
        id: "psi_002",
        clientAlias: "Trabalhador #D456",
        caseType: "Avaliação",
        status: "Aguardando laudo",
        nextAction: "Finalizar relatório",
        nextActionDate: "2026-06-08",
        sessionsCount: 1,
        focusArea: "Burnout",
      },
      {
        id: "psi_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "Programa de bem-estar",
        status: "Em andamento",
        nextAction: "Workshop coletivo",
        nextActionDate: "2026-06-14",
        sessionsCount: 2,
        focusArea: "Prevenção",
      },
    ],
  },
  assistente_social: {
    label: "Assistente Social",
    caseLabel: "Atendimento",
    canVideoConference: true,
    extraColumns: [
      { key: "vinculo", label: "Vínculo / Benefício" },
      { key: "encaminhamento", label: "Encaminhamento" },
    ],
    resourceLinks: [
      { label: "Código de Ética do/a Assistente Social (CFESS)", href: "https://www.cfess.org.br/arquivos/CEP_CFESS-SITE.pdf", emoji: "⚖️", type: "legislation" },
      { label: "Lei 8.662/1993 — Regulamentação da profissão", href: "https://www.planalto.gov.br/ccivil_03/leis/l8662.htm", emoji: "📖", type: "legislation" },
      { label: "CFESS — Conselho Federal de Serviço Social", href: "https://www.cfess.org.br/", emoji: "🏛️", type: "tool" },
      { label: "Benefícios sociais (INSS / Bolsa Família / BPC)", href: "https://www.gov.br/pt-br/servicos", emoji: "🤝", type: "guide" },
      { label: "Modelos de parecer e relatório social", href: "https://www.google.com/search?q=modelo+de+parecer+social+assistente+social", emoji: "📄", type: "template" },
      { label: "Notícias: Serviço Social e políticas públicas", href: "https://www.cfess.org.br/visualizar/noticias", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "activeCases",
      "pendingRequests",
      "caseHistory",
      "reputation",
      "resources",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "as_001",
        clientAlias: "Trabalhador #E771",
        caseType: "Orientação sobre benefícios",
        status: "Em andamento",
        nextAction: "Reunião de acolhimento",
        nextActionDate: "2026-06-07",
        vinculo: "Auxílio-doença (INSS)",
        encaminhamento: "CRAS de referência",
      },
      {
        id: "as_002",
        clientAlias: "Trabalhador #F204",
        caseType: "Apoio psicossocial no trabalho",
        status: "Aguardando documentos",
        nextAction: "Elaborar relatório social",
        nextActionDate: "2026-06-11",
        vinculo: "Afastamento por saúde",
        encaminhamento: "Rede de saúde mental",
      },
      {
        id: "as_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "Programa de assistência ao empregado",
        status: "Em andamento",
        nextAction: "Workshop de direitos sociais",
        nextActionDate: "2026-06-16",
        vinculo: "Programa corporativo",
        encaminhamento: "RH / benefícios",
      },
    ],
    mockPotentialClients: [
      {
        id: "as_opp_001",
        pseudonym: "Trabalhador #R3K9",
        complaintType: "Acesso a benefícios",
        location: "São Paulo / SP",
        status: "Novo",
        summary: "Precisa de orientação para solicitar BPC/LOAS.",
      },
      {
        id: "as_opp_002",
        pseudonym: "Trabalhador #T8M2",
        complaintType: "Apoio psicossocial",
        location: "Recife / PE",
        status: "Em Análise",
        summary: "Afastado por saúde, busca acompanhamento social.",
      },
    ],
  },
  medico: {
    label: "Médico(a) do trabalho",
    caseLabel: "Consulta",
    canVideoConference: true,
    extraColumns: [
      { key: "examType", label: "Tipo de exame" },
      { key: "crmStatus", label: "Status CRM" },
    ],
    resourceLinks: [
      { label: "Normas Regulamentadoras (NRs)", href: "https://www.gov.br/trabalho-e-previdencia/pt-br/composicao/orgaos-especificos/secretaria-de-inspecao-do-trabalho/seguranca-e-saude-no-trabalho/normatizacao/normas-regulamentadoras", emoji: "🩺", type: "legislation" },
      { label: "Protocolos Médicos Ocupacionais", href: "https://www.google.com/search?q=protocolos+m%C3%A9dicos+ocupacionais", emoji: "📋", type: "guide" },
      { label: "Modelos de ASO", href: "https://www.google.com/search?q=modelo+de+ASO+atestado+sa%C3%BAde+ocupacional", emoji: "📄", type: "template" },
      { label: "Legislação de Saúde Ocupacional", href: "https://www.gov.br/trabalho-e-previdencia/pt-br/composicao/orgaos-especificos/secretaria-de-inspecao-do-trabalho/seguranca-e-saude-no-trabalho/legislacao", emoji: "📅", type: "legislation" },
      { label: "Notícias: Avanços em medicina do trabalho", href: "https://www.anamt.org.br/portal/noticias/", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "reputation",
      "activeCases",
      "pendingRequests",
      "caseHistory",
      "resources",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "med_001",
        clientAlias: "Funcionário #E789",
        caseType: "Exame Admissional",
        status: "Finalizado",
        nextAction: "Entregar ASO",
        nextActionDate: "2026-06-01",
        examType: "Clínico",
        crmStatus: "Ativo",
      },
      {
        id: "med_002",
        clientAlias: "Funcionário #F012",
        caseType: "Consulta Ocupacional",
        status: "Em andamento",
        nextAction: "Solicitar exames",
        nextActionDate: "2026-06-06",
        examType: "Periódico",
        crmStatus: "Ativo",
      },
      {
        id: "med_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "PCMSO anual",
        status: "Em andamento",
        nextAction: "Realizar exames periódicos",
        nextActionDate: "2026-06-06",
        examType: "Periódico",
        crmStatus: "Em andamento",
      },
    ],
  },
  contador: {
    label: "Contador(a)",
    caseLabel: "Cliente",
    canVideoConference: true,
    extraColumns: [
      { key: "regime", label: "Regime tributário" },
      { key: "nextObligation", label: "Próxima obrigação" },
    ],
    resourceLinks: [
      { label: "Calendário fiscal", href: "https://www.gov.br/pt-br/servicos/consultar-calendario-fiscal", emoji: "📅", type: "tool" },
      { label: "Tabela de tributos", href: "https://www.gov.br/pt-br/servicos/consultar-tabela-de-tributos", emoji: "💰", type: "tool" },
      { label: "Modelos de balancete", href: "https://www.google.com/search?q=modelos+de+balancete+cont%C3%A1bil", emoji: "📄", type: "template" },
      { label: "Atualizações da Receita", href: "https://www.gov.br/receitafederal/pt-br/servicos/noticias", emoji: "📰", type: "news" },
      { label: "Notícias: Mudanças na legislação fiscal", href: "https://www.gov.br/receitafederal/pt-br/servicos/noticias", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "activeCases",
      "caseHistory",
      "pendingRequests",
      "resources",
      "reputation",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "cont_001",
        clientAlias: "Empresa GHI",
        caseType: "Assessoria Fiscal",
        status: "Em andamento",
        nextAction: "Fechamento mensal",
        nextActionDate: "2026-06-05",
        regime: "Simples Nacional",
        nextObligation: "DAS",
      },
      {
        id: "cont_002",
        clientAlias: "Empresa JKL",
        caseType: "Declaração de IR",
        status: "Aguardando dados",
        nextAction: "Solicitar documentos",
        nextActionDate: "2026-06-15",
        regime: "Lucro Presumido",
        nextObligation: "IRPJ",
      },
      {
        id: "cont_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "Folha de pagamento",
        status: "Em andamento",
        nextAction: "Fechar folha",
        nextActionDate: "2026-06-05",
        regime: "Lucro Real",
        nextObligation: "DCTFWeb 15/06",
      },
    ],
  },
  engenheiro_seguranca: {
    label: "Engenheiro(a) de Segurança",
    caseLabel: "Auditoria",
    canVideoConference: true,
    extraColumns: [
      { key: "siteLocation", label: "Local da obra/empresa" },
      { key: "riskLevel", label: "Nível de risco" },
    ],
    resourceLinks: [
      { label: "NRs e Normas Técnicas", href: "https://www.gov.br/trabalho-e-previdencia/pt-br/composicao/orgaos-especificos/secretaria-de-inspecao-do-trabalho/seguranca-e-saude-no-trabalho/normatizacao/normas-regulamentadoras", emoji: "🦺", type: "legislation" },
      { label: "Laudos técnicos (PPRA/PCMSO)", href: "https://www.google.com/search?q=modelo+laudo+t%C3%A9cnico+PPRA+PCMSO", emoji: "📄", type: "template" },
      { label: "Checklists de Segurança", href: "https://www.google.com/search?q=checklists+de+seguran%C3%A7a+do+trabalho", emoji: "✅", type: "template" },
      { label: "Relatórios de Acidentes", href: "https://www.gov.br/trabalho-e-previdencia/pt-br/composicao/orgaos-especificos/secretaria-de-inspecao-do-trabalho/seguranca-e-saude-no-trabalho/estatisticas-e-pesquisas/acidentes-de-trabalho", emoji: "📊", type: "tool" },
      { label: "Notícias: Inovações em segurança do trabalho", href: "https://www.protecao.com.br/noticias/", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "activeCases",
      "resources",
      "pendingRequests",
      "caseHistory",
      "reputation",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "eng_001",
        clientAlias: "Construtora MNO",
        caseType: "Auditoria de Canteiro",
        status: "Em andamento",
        nextAction: "Relatório de não conformidades",
        nextActionDate: "2026-06-07",
        siteLocation: "Obra Centro",
        riskLevel: "Alto",
      },
      {
        id: "eng_002",
        clientAlias: "Indústria PQR",
        caseType: "Elaboração de PPRA",
        status: "Aguardando dados",
        nextAction: "Levantamento de riscos",
        nextActionDate: "2026-06-12",
        siteLocation: "Fábrica",
        riskLevel: "Médio",
      },
      {
        id: "eng_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "Implantação PPRA",
        status: "Em andamento",
        nextAction: "Visita técnica",
        nextActionDate: "2026-06-11",
        siteLocation: "Galpão industrial – SP",
        riskLevel: "Grau 3",
      },
    ],
  },
  fisioterapeuta_ocupacional: {
    label: "Fisioterapeuta Ocupacional",
    caseLabel: "Atendimento",
    canVideoConference: true,
    extraColumns: [
      { key: "protocol", label: "Protocolo" },
      { key: "sessionsRemaining", label: "Sessões restantes" },
    ],
    resourceLinks: [
      { label: "Exercícios Terapêuticos", href: "https://www.google.com/search?q=exerc%C3%ADcios+terap%C3%AAuticos+fisioterapia+ocupacional", emoji: "🤸", type: "guide" },
      { label: "Ergonomia no Trabalho", href: "https://www.google.com/search?q=ergonomia+no+trabalho+guia", emoji: "📐", type: "guide" },
      { label: "Artigos Científicos em Fisioterapia", href: "https://www.scielo.br/j/rbfis/", emoji: "📚", type: "guide" },
      { label: "Fórum de Especialistas", href: "https://www.linkedin.com/groups/?keywords=fisioterapia%20ocupacional", emoji: "💬", type: "community" },
      { label: "Notícias: Saúde postural no ambiente de trabalho", href: "https://www.crefito11.org.br/noticias/", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "reputation",
      "activeCases",
      "pendingRequests",
      "caseHistory",
      "resources",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "fis_001",
        clientAlias: "Trabalhador #S345",
        caseType: "Reabilitação Postural",
        status: "Em andamento",
        nextAction: "Próxima sessão",
        nextActionDate: "2026-06-03",
        protocol: "Protocolo Coluna",
        sessionsRemaining: 5,
      },
      {
        id: "fis_002",
        clientAlias: "Trabalhador #T678",
        caseType: "Prevenção de LER/DORT",
        status: "Aguardando avaliação",
        nextAction: "Avaliação ergonômica",
        nextActionDate: "2026-06-09",
        protocol: "Protocolo LER",
        sessionsRemaining: 3,
      },
      {
        id: "fis_003",
        clientAlias: "Empresa Acme S.A.",
        caseType: "Ginástica laboral",
        status: "Em andamento",
        nextAction: "Próxima sessão",
        nextActionDate: "2026-06-06",
        protocol: "Cervical / postural",
        sessionsRemaining: 4,
      },
    ],
  },
  outro: {
    label: "Especialista",
    caseLabel: "Atendimento",
    canVideoConference: false,
    extraColumns: [],
    resourceLinks: [
      { label: "Recursos Gerais", href: "https://www.google.com/search?q=recursos+profissionais", emoji: "📄", type: "guide" },
      { label: "Legislação trabalhista", href: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm", emoji: "⚖️", type: "legislation" },
      { label: "Fórum de Especialistas", href: "https://www.linkedin.com/groups/", emoji: "💬", type: "community" },
      { label: "Suporte", href: "https://www.trabalheila.com.br/suporte", emoji: "🛟", type: "tool" },
      { label: "Notícias do mercado de trabalho", href: "https://www.gupy.io/blog/", emoji: "📰", type: "news" },
    ],
    dashboardSections: [
      "overview",
      "activeCases",
      "pendingRequests",
      "resources",
      "profileSettings",
    ],
    mockActiveCases: [
      {
        id: "out_001",
        clientAlias: "Trabalhador #U901",
        caseType: "Consultoria",
        status: "Em andamento",
        nextAction: "Reunião inicial",
        nextActionDate: "2026-06-05",
      },
    ],
  },
};

function getSpecialistConfig(tipo) {
  // Normaliza: lower-case, troca hífen por underscore (aceita "consultor-rh"
  // e "consultor_rh"), remove espaços. Cai no fallback "outro" se desconhecido.
  const key = (tipo || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const cfg = SPECIALIST_CONFIGS[key] || SPECIALIST_CONFIGS.outro;
  // Garante que dashboardSections sempre exista.
  return {
    ...cfg,
    dashboardSections:
      cfg.dashboardSections && cfg.dashboardSections.length > 0
        ? cfg.dashboardSections
        : DEFAULT_DASHBOARD_SECTIONS,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Histórico de casos — terminologia por especialidade.
 *
 * A estrutura de dados no Firestore não muda (clientAlias, caseType,
 * finishedAt, result). Aqui apenas adaptamos o TÍTULO e os RÓTULOS das
 * colunas exibidas conforme a área de atuação do profissional.
 * ────────────────────────────────────────────────────────────── */
const CASE_HISTORY_CONFIGS = {
  advogado: {
    title: "Histórico de casos",
    clientLabel: "Cliente",
    typeLabel: "Tipo de caso",
    outcomeLabel: "Resultado",
  },
  medico: {
    title: "Histórico de atendimentos",
    clientLabel: "Empresa",
    typeLabel: "Tipo de serviço",
    outcomeLabel: "Status",
  },
  psicologo: {
    title: "Histórico de sessões",
    clientLabel: "Cliente",
    typeLabel: "Tipo de sessão",
    outcomeLabel: "Status",
  },
  engenheiro_seguranca: {
    title: "Histórico de auditorias",
    clientLabel: "Empresa",
    typeLabel: "Tipo de auditoria",
    outcomeLabel: "Resultado",
  },
  fisioterapeuta_ocupacional: {
    title: "Histórico de atendimentos",
    clientLabel: "Empresa",
    typeLabel: "Tipo de atendimento",
    outcomeLabel: "Status",
  },
  contador: {
    title: "Histórico de serviços",
    clientLabel: "Cliente",
    typeLabel: "Tipo de serviço",
    outcomeLabel: "Status",
  },
};

const DEFAULT_CASE_HISTORY_CONFIG = {
  title: "Histórico de atendimentos",
  clientLabel: "Cliente",
  typeLabel: "Tipo de serviço",
  outcomeLabel: "Status",
};

function getCaseHistoryConfig(tipo) {
  const key = (tipo || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return CASE_HISTORY_CONFIGS[key] || DEFAULT_CASE_HISTORY_CONFIG;
}

/* ──────────────────────────────────────────────────────────────
 * Placeholders de busca no Firestore.
 *
 * Estas funções devolvem dados mockados enquanto as coleções
 * reais (casos do especialista, avaliações, etc.) não estão
 * mapeadas. Substituir a implementação interna por queries reais
 * quando os modelos estiverem definidos.
 * ────────────────────────────────────────────────────────────── */
/* Mocks consolidados dentro de SPECIALIST_CONFIGS[tipo].mockActiveCases.
 * fetchActiveCases lê dali; substitua a implementação interna por
 * queries reais à coleção /apoiadores/{id}/cases quando existir. */
async function fetchActiveCases(/* apoiadorId */ _apoiadorId, tipo) {
  return getSpecialistConfig(tipo).mockActiveCases || [];
}

async function fetchCaseHistory(/* apoiadorId */) {
  return [
    {
      id: "hist_001",
      clientAlias: "Trabalhador #2A11",
      caseType: "Horas extras",
      finishedAt: "2026-05-18",
      result: "Acordo favorável",
    },
    {
      id: "hist_002",
      clientAlias: "Trabalhador #B903",
      caseType: "Verbas rescisórias",
      finishedAt: "2026-05-02",
      result: "Sentença favorável",
    },
    {
      id: "hist_003",
      clientAlias: "Empresa Delta Ltda.",
      caseType: "Compliance trabalhista",
      finishedAt: "2026-04-22",
      result: "Concluído",
    },
  ];
}

async function fetchSpecialistReviews(apoiadorId) {
  // Reputação real do especialista. Especialistas recém-cadastrados (sem
  // nenhuma avaliação) retornam total 0 — nesse caso a UI exibe "5/5" como
  // nota inicial, em vez de uma média fabricada (ex.: 4.8/5).
  const EMPTY = { average: 0, total: 0, items: [] };
  if (!apoiadorId) return EMPTY;
  try {
    const snap = await getDoc(doc(db, "apoiadores", apoiadorId));
    if (!snap.exists()) return EMPTY;
    const data = snap.data() || {};
    const total = Number(data.totalAvaliacoes || 0) || 0;
    // Só consideramos a média quando há avaliações reais.
    const average = total > 0 ? Number(data.rating || data.satisfacaoMedia || 0) || 0 : 0;
    const items = Array.isArray(data.reviews) ? data.reviews : [];
    return { average, total, items };
  } catch (err) {
    console.warn("Falha ao carregar avaliações do especialista:", err);
    return EMPTY;
  }
}

const RESOURCE_LINKS_FALLBACK = [
  { label: "Modelos de documentos", href: "https://www.google.com/search?q=modelos+de+documentos+profissionais", emoji: "📄", type: "template" },
  { label: "Legislação trabalhista recente", href: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm", emoji: "⚖️", type: "legislation" },
  { label: "Fórum de Especialistas", href: "https://www.linkedin.com/groups/", emoji: "💬", type: "community" },
  { label: "Calendário", href: "https://calendar.google.com/", emoji: "📅", type: "tool" },
];

/**
 * MyContactsApoiador — página /apoiador/my-contacts
 * --------------------------------------------------------------
 * Dashboard do Especialista: visão geral, clientes ativos,
 * pedidos de contato de empresas (real), histórico, reputação
 * e recursos. Dados não-críticos são mockados via funções
 * placeholder (fetchActiveCases, fetchCaseHistory, fetchSpecialistReviews).
 */
export default function MyContactsApoiador({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [activeReply, setActiveReply] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [revealEmail, setRevealEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  // Dados mockados via placeholders.
  const [activeCases, setActiveCases] = useState([]);
  const [caseHistory, setCaseHistory] = useState([]);
  const [reviews, setReviews] = useState({ average: 0, total: 0, items: [] });

  // Conversas recentes lidas do Firestore (chat real entre o especialista e
  // os trabalhadores). Substitui a varredura antiga de localStorage, que só
  // enxergava as mensagens do próprio navegador.
  const [recentConversations, setRecentConversations] = useState([]);

  // Perfil do apoiador no Firestore — usado para descobrir o `tipo`
  // (área de atuação) e adaptar dinamicamente o dashboard.
  const [apoiadorDoc, setApoiadorDoc] = useState(null);
  // Filtro do card "Oportunidades de Clientes" (visivel apenas para
  // advogados via dashboardSections). Mantido fora do switch para
  // preservar estado entre renders.
  const [opportunityFilter, setOpportunityFilter] = useState("all");

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);
  const apoiadorId = profile?.apoiadorId || profile?.uid || profile?.id || "";
  const specialistName =
    profile?.name || profile?.nome || profile?.displayName || "Especialista";

  // Caso selecionado para encerramento (abre o modal de confirmação).
  const [closingCase, setClosingCase] = useState(null);
  const [closingBusy, setClosingBusy] = useState(false);

  // Tipo de especialista — preferência: doc Firestore > localStorage.
  const specialistTipo =
    apoiadorDoc?.tipo ||
    profile?.tipo ||
    profile?.areaDeAtuacao ||
    "outro";
  const specialistConfig = useMemo(
    () => getSpecialistConfig(specialistTipo),
    [specialistTipo]
  );
  // Terminologia do card "Histórico de casos" adaptada à especialidade.
  const caseHistoryConfig = useMemo(
    () => getCaseHistoryConfig(specialistTipo),
    [specialistTipo]
  );

  // Saudação personalizada: "Dr.(a) Nome Sobrenome" a partir do perfil do
  // especialista (doc do Firestore tem prioridade sobre o localStorage).
  const specialistGreetingName = useMemo(() => {
    const raw = String(
      apoiadorDoc?.nome ||
        apoiadorDoc?.name ||
        apoiadorDoc?.displayName ||
        specialistName ||
        ""
    ).trim();
    if (!raw || raw.toLowerCase() === "especialista") return "";
    const parts = raw.split(/\s+/).filter(Boolean);
    const nome = parts[0];
    const sobrenome = parts.length > 1 ? parts[parts.length - 1] : "";
    return sobrenome ? `${nome} ${sobrenome}` : nome;
  }, [apoiadorDoc, specialistName]);

  // O card "Histórico de casos" é específico de profissionais do Direito.
  // Só é renderizado quando a especialidade/role contém "advogado" ou
  // "jurídico". Para os demais (médico, recrutador, psicólogo, coach, etc.)
  // o card não aparece de forma alguma — nem vazio, nem só com título.
  const isLawyer = useMemo(() => {
    const haystack = `${specialistTipo || ""} ${apoiadorDoc?.specialty || ""} ${
      apoiadorDoc?.role || ""
    } ${profile?.specialty || ""} ${profile?.role || ""}`.toLowerCase();
    return /advogad|jur[ií]dic/.test(haystack);
  }, [specialistTipo, apoiadorDoc, profile]);

  // ───────────────────────────────────────────────────────────────
  // Exibição de dados mockados (clientes/casos de demonstração)
  // ---------------------------------------------------------------
  // Especialistas REAIS e autenticados em produção NÃO devem ver
  // nenhum dado fictício (clientes falsos, processos inexistentes).
  // Os mocks só aparecem quando:
  //   (a) estamos em ambiente de desenvolvimento, OU
  //   (b) a própria conta logada é uma conta de teste/demonstração
  //       (flag `isTest`, id `apoiador_test_*` ou e-mail de teste).
  // Para qualquer especialista real em produção, as listas mockadas
  // ficam vazias até que existam queries reais ao Firestore.
  const showMockData = useMemo(() => {
    if (process.env.NODE_ENV === "development") return true;
    return isTestApoiador({
      id: apoiadorId,
      isTest: apoiadorDoc?.isTest,
      email: apoiadorDoc?.email || profile?.email,
    });
  }, [apoiadorId, apoiadorDoc, profile]);

  // Busca o documento do apoiador para descobrir tipo e ramo de
  // especialização. Falha silenciosa: o dashboard cai no preset "outro".
  useEffect(() => {
    if (!apoiadorId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "apoiadores", apoiadorId));
        if (cancelled) return;
        if (snap.exists()) setApoiadorDoc(snap.data());
      } catch (err) {
        console.warn("Falha ao carregar perfil do apoiador:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  const load = useCallback(async () => {
    if (!apoiadorId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const authUid = auth.currentUser?.uid || profile?.uid || "";
      const data = await listIncomingApoiadorRequests(apoiadorId, 100, authUid);
      setItems(data);
      await Promise.all(
        data
          .filter((r) => !r.readByApoiador && r.status === "pending")
          .map((r) => markApoiadorRequestRead(r.id))
      );
    } finally {
      setLoading(false);
    }
  }, [apoiadorId]);

  useEffect(() => {
    load();
  }, [load]);

  // Carrega dados das demais seções em paralelo. Casos ativos e histórico
  // ainda são mockados (placeholders) e por isso só são exibidos quando
  // `showMockData` é verdadeiro (dev ou conta de teste). A reputação já lê
  // dados reais do Firestore e é carregada sempre.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mockCases, realCases, history, rev] = await Promise.all([
          showMockData ? fetchActiveCases(apoiadorId, specialistTipo) : Promise.resolve([]),
          listSpecialistCases(apoiadorId),
          showMockData ? fetchCaseHistory(apoiadorId) : Promise.resolve([]),
          fetchSpecialistReviews(apoiadorId),
        ]);
        if (cancelled) return;
        // Casos reais (clientes aceitos no chat) primeiro; mocks depois,
        // sem duplicar ids já presentes nos casos reais. Casos com status
        // "finalizado"/"encerrado" saem da lista de ativos e entram no
        // histórico.
        const isFinished = (s) => /finaliz|encerrad/i.test(String(s || ""));
        const activeReal = realCases.filter((c) => !isFinished(c.status));
        const closedReal = realCases
          .filter((c) => isFinished(c.status))
          .map((c) => ({
            id: c.id,
            clientAlias: c.clientAlias,
            caseType: c.caseType,
            finishedAt: c.finishedAt || c._updatedAt?.seconds
              ? new Date((c._updatedAt?.seconds || 0) * 1000).toISOString()
              : "",
            result: "Encerrado",
          }));
        const realIds = new Set(activeReal.map((c) => c.id));
        const merged = [
          ...activeReal,
          ...mockCases.filter((c) => !realIds.has(c.id)),
        ];
        setActiveCases(merged);
        setCaseHistory([...closedReal, ...history]);
        setReviews(rev);
      } catch (err) {
        console.warn("Falha ao carregar dados do dashboard do especialista:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId, specialistTipo, showMockData]);

  // Carrega as conversas recentes do Firestore (chat real). O especialista é
  // identificado pelo UID do Firebase Auth, presente no array `participants`
  // de cada conversa — garantindo que ele veja todas as conversas dele (uma
  // por trabalhador) e somente as dele.
  useEffect(() => {
    let cancelled = false;
    const uid = auth.currentUser?.uid || profile?.uid || profile?.id || "";
    if (!uid) {
      setRecentConversations([]);
      return undefined;
    }
    (async () => {
      try {
        const convs = await listConversationsForParticipant(uid, 20);
        if (!cancelled) setRecentConversations(convs);
      } catch (err) {
        console.warn("Falha ao carregar conversas recentes:", err);
        if (!cancelled) setRecentConversations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId, profile]);

  const handleAccept = useCallback(
    async (id) => {
      if (!replyText.trim()) {
        alert("Escreva uma resposta.");
        return;
      }
      setBusy(true);
      try {
        await respondToApoiadorRequest(id, {
          accept: true,
          reply: replyText.trim(),
          revealEmail,
        });
        setActiveReply(null);
        setReplyText("");
        setRevealEmail(false);
        await load();
      } catch (err) {
        console.error(err);
        alert("Não foi possível enviar a resposta. Tente novamente.");
      } finally {
        setBusy(false);
      }
    },
    [replyText, revealEmail, load]
  );

  const handleDecline = useCallback(
    async (id) => {
      if (!window.confirm("Recusar este pedido de contato?")) return;
      setBusy(true);
      try {
        await respondToApoiadorRequest(id, { accept: false });
        await load();
      } catch (err) {
        console.error(err);
        alert("Não foi possível recusar. Tente novamente.");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  // NOTE: O card "Pedidos Ad Exitum" foi removido do painel do especialista.
  // A aceitação de pedidos Ad Exitum agora é feita exclusivamente pelo chat
  // inicial com o trabalhador (ver PlatformChat / handleAcceptClient).
  // Encerra um caso ativo: atualiza o status no Firestore e move o caso da
  // lista de ativos para o histórico (otimista, sem recarregar tudo).
  const handleCloseCase = useCallback(async () => {
    if (!closingCase || !apoiadorId) return;
    setClosingBusy(true);
    try {
      await closeSpecialistCase(apoiadorId, closingCase.id);
      setActiveCases((prev) => prev.filter((c) => c.id !== closingCase.id));
      setCaseHistory((prev) => [
        {
          id: closingCase.id,
          clientAlias: closingCase.clientAlias,
          caseType: closingCase.caseType,
          finishedAt: new Date().toISOString(),
          result: "Encerrado",
        },
        ...prev,
      ]);
      setClosingCase(null);
    } catch (err) {
      console.error("Falha ao encerrar caso:", err);
      alert("Não foi possível encerrar o caso. Tente novamente.");
    } finally {
      setClosingBusy(false);
    }
  }, [closingCase, apoiadorId]);
  // Métricas derivadas para a seção Visão Geral.
  // Importante: hooks devem ser chamados antes de qualquer early return.
  const pendingCount = useMemo(
    () => items.filter((r) => (r.status || "pending") === "pending").length,
    [items]
  );

  if (!apoiadorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Contatos (Especialista)" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-slate-600 dark:text-slate-300 text-center">
            Você precisa estar logado como Apoiador para ver seus pedidos de contato.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Contatos (Especialista)" />

      <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
        {/* Cabeçalho do dashboard */}
        <header className="bg-white dark:bg-slate-900 rounded-2xl shadow p-4 sm:p-5 border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="tl-eyebrow">
              Dashboard do Especialista · {specialistConfig.label}
            </p>
            <h1 className="tl-page-title mt-1">
              Olá, {specialistGreetingName ? `Dr.(a) ${specialistGreetingName}` : "Especialista"} 👋
            </h1>
            <p className="tl-subtitle mt-1">
              Acompanhe seus clientes, pedidos de contato e reputação em um único lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/apoiador/perfil")}
            className="self-stretch sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 min-h-[44px]"
          >
            ⚙️ Gerenciar perfil
          </button>
        </header>

        {/* Banner do plano atual / upgrade */}
        {(() => {
          const plano = String(apoiadorDoc?.plano || "essencial").toLowerCase();
          const isPremium = plano === "premium";
          return (
            <section
              aria-label="Seu plano atual"
              className={[
                "rounded-2xl shadow border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                isPremium
                  ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-blue-700"
                  : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-100",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider opacity-80">
                  Seu plano atual
                </p>
                <p className="mt-1 text-base sm:text-lg font-extrabold">
                  {isPremium ? "Premium ✨" : "Essencial (Grátis)"}
                </p>
                <p className="mt-1 text-xs sm:text-sm opacity-90">
                  {isPremium
                    ? "Você tem acesso a todos os recursos, incluindo videoconferência integrada."
                    : "Desbloqueie videoconferência, contato direto e mais visibilidade no Premium."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/especialista/beneficios")}
                className={[
                  "self-stretch sm:self-auto px-4 py-2.5 rounded-lg text-sm font-bold min-h-[44px]",
                  isPremium
                    ? "bg-white text-blue-700 hover:bg-blue-50"
                    : "bg-blue-600 hover:bg-blue-700 text-white",
                ].join(" ")}
              >
                {isPremium ? "Conheça os planos" : "Conheça o Premium"}
              </button>
            </section>
          );
        })()}

        {/* Mensagens recentes (chats reais com trabalhadores, via Firestore) */}
        {(() => {
          const myUid = auth.currentUser?.uid || profile?.uid || profile?.id || "";
          const convs = recentConversations.map((c) => {
            const names = c.peerNames || {};
            // Nome do interlocutor: o participante diferente de mim.
            const peerUid =
              (Array.isArray(c.participants)
                ? c.participants.find((p) => p && p !== myUid)
                : "") || c.workerId || "";
            const peerName =
              names[peerUid] ||
              (peerUid ? `Trabalhador ${String(peerUid).slice(0, 6)}` : "Trabalhador");
            const last = c.lastMessage || null;
            return { id: c.id, peerName, last };
          });
          return (
            <section
              aria-labelledby="messages-title"
              className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
            >
              <header className="flex items-center justify-between gap-2 flex-wrap">
                <h2
                  id="messages-title"
                  className="tl-section-title"
                >
                  <span aria-hidden="true">💬</span> Mensagens recentes
                </h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {convs.length} conversa{convs.length === 1 ? "" : "s"}
                </span>
              </header>
              {convs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma conversa ativa ainda. Quando um trabalhador iniciar um chat com você, ele aparecerá aqui.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {convs.map((c) => (
                    <li
                      key={c.id}
                      className="py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {c.peerName}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {c.last?.text ||
                            (c.last?.attachmentName ? `📎 ${c.last.attachmentName}` : "—")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/chat/${encodeURIComponent(c.id)}?peer=${encodeURIComponent(c.peerName)}&peerRole=trabalhador`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })()}

        {/* ─── Seções dinâmicas (ordem definida em specialistConfig.dashboardSections) ─── */}
        {(specialistConfig.dashboardSections || DEFAULT_DASHBOARD_SECTIONS)
          // Card "Pedidos de contato de empresas" removido da interface.
          .filter((sectionId) => sectionId !== "pendingRequests")
          .map((sectionId) => {
          switch (sectionId) {
            case "overview":
              return (
                <section key="overview" aria-labelledby="overview-title">
                  <h2
                    id="overview-title"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2"
                  >
                    Visão geral
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <OverviewCard
                      label="Clientes ativos"
                      value={activeCases.length}
                      accent="blue"
                      emoji="👥"
                    />
                    <OverviewCard
                      label="Pedidos pendentes"
                      value={pendingCount}
                      accent="amber"
                      emoji="📬"
                      onClick={() => navigate("/especialista/pedidos-pendentes")}
                    />
                    <OverviewCard
                      label="Finalizados"
                      value={caseHistory.length}
                      accent="emerald"
                      emoji="✅"
                    />
                    <OverviewCard
                      label="Satisfação média"
                      value={reviews.total > 0 ? `${reviews.average.toFixed(1)}/5` : "5/5"}
                      accent="indigo"
                      emoji="⭐"
                    />
                  </div>
                </section>
              );

            case "activeCases":
              return (
                <section
                  key="activeCases"
                  aria-labelledby="active-cases-title"
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700"
                >
                  <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <h2
                      id="active-cases-title"
                      className="tl-section-title"
                    >
                      <span aria-hidden="true">📂</span> Meus clientes / casos ativos
                    </h2>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {activeCases.length} ativo{activeCases.length === 1 ? "" : "s"}
                    </span>
                  </header>

                  {activeCases.length === 0 ? (
                    <p className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                      Você ainda não possui casos ativos.
                    </p>
                  ) : (
                    <>
                    {/* Mobile: cada caso vira um card */}
                    <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {activeCases.map((c) => (
                        <li key={c.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-100 break-words">
                                {c.clientAlias}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                {specialistConfig.caseLabel}: {c.caseType}
                              </p>
                            </div>
                            <StatusBadge status={c.status} />
                          </div>
                          {specialistConfig.extraColumns.map((col) => (
                            <p key={col.key} className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-semibold">{col.label}:</span>{" "}
                              {col.render ? col.render(c) : c[col.key] || "—"}
                            </p>
                          ))}
                          <div className="text-xs text-slate-700 dark:text-slate-200">
                            <span className="font-semibold">Próxima ação:</span> {c.nextAction}
                            {c.nextActionDate && (
                              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                                {new Date(c.nextActionDate).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/especialista/${encodeURIComponent(specialistTipo)}/caso/${encodeURIComponent(c.id)}`
                              )
                            }
                            className="w-full mt-2 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white min-h-[40px]"
                          >
                            Ver detalhes
                          </button>
                          <button
                            type="button"
                            onClick={() => setClosingCase(c)}
                            className="w-full mt-2 px-3 py-2 rounded-lg text-xs font-bold border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 min-h-[40px]"
                          >
                            🗑️ Encerrar caso
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                          <tr>
                            <Th>Cliente</Th>
                            <Th>{specialistConfig.caseLabel}</Th>
                            {specialistConfig.extraColumns.map((col) => (
                              <Th key={col.key}>{col.label}</Th>
                            ))}
                            <Th>Status</Th>
                            <Th>Próxima ação / prazo</Th>
                            <Th className="text-right pr-5">Ações</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeCases.map((c) => (
                            <tr
                              key={c.id}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            >
                              <Td className="font-semibold text-slate-800 dark:text-slate-100">
                                {c.clientAlias}
                              </Td>
                              <Td className="text-slate-700 dark:text-slate-200">{c.caseType}</Td>
                              {specialistConfig.extraColumns.map((col) => (
                                <Td
                                  key={col.key}
                                  className="text-slate-700 dark:text-slate-200"
                                >
                                  {col.render ? col.render(c) : c[col.key] || "—"}
                                </Td>
                              ))}
                              <Td>
                                <StatusBadge status={c.status} />
                              </Td>
                              <Td className="text-slate-700 dark:text-slate-200">
                                <div className="flex flex-col">
                                  <span>{c.nextAction}</span>
                                  {c.nextActionDate && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {new Date(c.nextActionDate).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                              </Td>
                              <Td className="text-right pr-5">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/especialista/${encodeURIComponent(specialistTipo)}/caso/${encodeURIComponent(c.id)}`
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    Ver detalhes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setClosingCase(c)}
                                    title="Encerrar caso"
                                    aria-label="Encerrar caso"
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </section>
              );

            case "pendingRequests":
              return (
                <section
                  key="pendingRequests"
                  aria-labelledby="requests-title"
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h2
                      id="requests-title"
                      className="tl-section-title"
                    >
                      <span aria-hidden="true">📬</span> Pedidos de contato de empresas
                      {pendingCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-bold bg-red-600 text-white">
                          {pendingCount}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Empresas Premium podem solicitar consultoria especializada.
                    </p>
                  </div>

                  {loading ? (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-8 animate-pulse">
                      Carregando…
                    </p>
                  ) : items.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400 text-center py-8 text-sm">
                      Nenhum pedido de contato no momento.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((r) => {
                        const isReplying = activeReply === r.id;
                        const status = r.status || "pending";
                        return (
                          <article
                            key={r.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/60 dark:bg-slate-800/40"
                          >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                  Pedido de contato (empresa)
                                </p>
                                <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                                  {r.fromCompanyName || "Empresa Premium"}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {r.createdAt
                                    ? new Date(r.createdAt).toLocaleString("pt-BR")
                                    : ""}
                                </p>
                              </div>
                              <span
                                className={
                                  "text-[11px] font-bold px-2 py-0.5 rounded-full " +
                                  (status === "accepted"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                    : status === "declined"
                                    ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300")
                                }
                              >
                                {status === "accepted"
                                  ? "Respondido"
                                  : status === "declined"
                                  ? "Recusado"
                                  : "Pendente"}
                              </span>
                            </div>

                            <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
                              {r.message || "(sem mensagem)"}
                            </p>

                            {status === "pending" && !isReplying && (
                              <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDecline(r.id)}
                                  disabled={busy}
                                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50 min-h-[44px]"
                                >
                                  Recusar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReply(r.id);
                                    setReplyText("");
                                    setRevealEmail(false);
                                  }}
                                  disabled={busy}
                                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 min-h-[44px]"
                                >
                                  Aceitar / Responder
                                </button>
                              </div>
                            )}

                            {isReplying && (
                              <div className="mt-4">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                  Sua resposta
                                </label>
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  rows={4}
                                  maxLength={2000}
                                  placeholder="Escreva sua resposta para a empresa…"
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={revealEmail}
                                    onChange={(e) => setRevealEmail(e.target.checked)}
                                  />
                                  Autorizar a empresa a ver meu e-mail/contato direto.
                                </label>
                                <div className="mt-3 flex flex-col sm:flex-row sm:justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveReply(null);
                                      setReplyText("");
                                    }}
                                    disabled={busy}
                                    className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-50 min-h-[44px]"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAccept(r.id)}
                                    disabled={busy}
                                    className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 min-h-[44px]"
                                  >
                                    {busy ? "Enviando…" : "Enviar resposta"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {status === "accepted" && r.reply && (
                              <div className="mt-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3">
                                <p className="text-xs font-bold uppercase tracking-wider mb-1">
                                  Sua resposta
                                </p>
                                <p className="whitespace-pre-wrap">{r.reply}</p>
                                {r.revealEmail && (
                                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                                    ✅ Contato direto compartilhado com a empresa.
                                  </p>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );

            case "caseHistory":
              // Card exclusivo de advogados/jurídico. Para qualquer outra
              // especialidade, não renderiza nada (nem título, nem tabela).
              if (!isLawyer) return null;
              return (
                <section
                  key="caseHistory"
                  aria-labelledby="history-title"
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700"
                >
                  <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2
                      id="history-title"
                      className="tl-section-title"
                    >
                      <span aria-hidden="true">🗂️</span> {caseHistoryConfig.title}
                    </h2>
                  </header>
                  {caseHistory.length === 0 ? (
                    <p className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                      Você ainda não finalizou nenhum caso.
                    </p>
                  ) : (
                    <>
                    {/* Mobile: histórico em cards */}
                    <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {caseHistory.map((c) => (
                        <li key={c.id} className="p-4 space-y-1">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {c.clientAlias}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{c.caseType}</p>
                          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {c.finishedAt
                                ? new Date(c.finishedAt).toLocaleDateString("pt-BR")
                                : "—"}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              {c.result}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                          <tr>
                            <Th>{caseHistoryConfig.clientLabel}</Th>
                            <Th>{caseHistoryConfig.typeLabel}</Th>
                            <Th>Finalizado em</Th>
                            <Th>{caseHistoryConfig.outcomeLabel}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {caseHistory.map((c) => (
                            <tr
                              key={c.id}
                              className="border-t border-slate-100 dark:border-slate-800"
                            >
                              <Td className="font-semibold text-slate-800 dark:text-slate-100">
                                {c.clientAlias}
                              </Td>
                              <Td className="text-slate-700 dark:text-slate-200">{c.caseType}</Td>
                              <Td className="text-slate-700 dark:text-slate-200">
                                {c.finishedAt
                                  ? new Date(c.finishedAt).toLocaleDateString("pt-BR")
                                  : "—"}
                              </Td>
                              <Td>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  {c.result}
                                </span>
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </section>
              );

            case "reputation":
              return (
                <section
                  key="reputation"
                  aria-labelledby="reputation-title"
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
                >
                  <h2
                    id="reputation-title"
                    className="tl-section-title"
                  >
                    <span aria-hidden="true">⭐</span> Minha reputação
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Avaliação média:{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {reviews.total > 0 ? `${reviews.average.toFixed(1)}/5` : "5/5"}
                    </span>{" "}
                    <span className="text-slate-500 dark:text-slate-400">
                      {reviews.total > 0
                        ? `(${reviews.total} avaliações)`
                        : "(novo · sem avaliações)"}
                    </span>
                  </p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {reviews.items.length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Nenhum depoimento ainda.
                      </p>
                    )}
                    {reviews.items.map((rv) => (
                      <div
                        key={rv.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-800/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {rv.author}
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-300">
                            {"★".repeat(rv.rating)}
                            <span className="text-slate-300 dark:text-slate-600">
                              {"★".repeat(5 - rv.rating)}
                            </span>
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                          “{rv.text}”
                        </p>
                        {rv.createdAt && (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {new Date(rv.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );

            case "clientOpportunities": {
              // Oportunidades são dados de demonstração — ocultas para
              // especialistas reais em produção.
              const opportunities = showMockData
                ? specialistConfig.mockPotentialClients || []
                : [];
              if (opportunities.length === 0) return null;
              const complaintTypes = Array.from(
                new Set(opportunities.map((o) => o.complaintType).filter(Boolean))
              );
              const filtered =
                opportunityFilter === "all"
                  ? opportunities
                  : opportunities.filter(
                      (o) => o.complaintType === opportunityFilter
                    );
              return (
                <section
                  key="clientOpportunities"
                  aria-labelledby="opportunities-title"
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2
                      id="opportunities-title"
                      className="tl-section-title"
                    >
                      <span aria-hidden="true">🧲</span> Oportunidades de Clientes
                    </h2>
                    <label className="text-xs text-slate-600 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 w-full sm:w-auto">
                      <span className="font-semibold">Filtrar por queixa:</span>
                      <select
                        value={opportunityFilter}
                        onChange={(e) => setOpportunityFilter(e.target.value)}
                        className="w-full sm:w-auto px-2 py-2 sm:py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 min-h-[40px] sm:min-h-0"
                      >
                        <option value="all">Todas</option>
                        {complaintTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Trabalhadores que descreveram queixas compatíveis com sua
                    área de atuação. Demonstre interesse para iniciar o
                    contato (pagamento e revelação de identidade seguem o
                    fluxo padrão da plataforma).
                  </p>
                  {filtered.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma oportunidade encontrada para esse filtro.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {filtered.map((opp) => (
                        <li
                          key={opp.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                {opp.pseudonym}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold">
                                {opp.complaintType}
                              </span>
                              {opp.status && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 font-semibold">
                                  {opp.status}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              📍 {opp.location}
                            </p>
                            {opp.summary && (
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                {opp.summary}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  `Detalhes de ${opp.pseudonym} estarão disponíveis em breve.`
                                )
                              }
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition min-h-[40px]"
                            >
                              Ver detalhes
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                alert(
                                  `Interesse registrado em ${opp.pseudonym}. O trabalhador será notificado.`
                                )
                              }
                              className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition min-h-[40px]"
                            >
                              Expressar interesse
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            }

            case "resources":
              return (
                <section
                  key="resources"
                  aria-labelledby="resources-title"
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
                >
                  <h2
                    id="resources-title"
                    className="tl-section-title"
                  >
                    <span aria-hidden="true">🧰</span> Recursos e ferramentas
                  </h2>
                  <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(specialistConfig.resourceLinks || RESOURCE_LINKS_FALLBACK).map((res) => {
                      const isPlaceholder = !res.href || res.href === "#";
                      return (
                      <li key={res.label}>
                        <a
                          href={res.href || "#"}
                          target={isPlaceholder ? undefined : "_blank"}
                          rel={isPlaceholder ? undefined : "noopener noreferrer"}
                          onClick={(e) => {
                            if (isPlaceholder) {
                              e.preventDefault();
                              alert(`"${res.label}" estará disponível em breve.`);
                            }
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                        >
                          <span className="text-lg" aria-hidden="true">
                            {res.emoji}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {res.label}
                          </span>
                        </a>
                      </li>
                      );
                    })}
                  </ul>
                </section>
              );

            default:
              return null;
          }
        })}
      </div>

      {/* Modal de confirmação para encerrar um caso ativo. */}
      {closingCase && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-case-title"
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3
              id="close-case-title"
              className="text-base font-bold text-slate-800 dark:text-slate-100"
            >
              Encerrar caso
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Tem certeza que deseja encerrar o caso de{" "}
              <span className="font-semibold">{closingCase.clientAlias}</span>?
              Ele sairá da lista de casos ativos e será movido para o histórico.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClosingCase(null)}
                disabled={closingBusy}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseCase}
                disabled={closingBusy}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {closingBusy ? "Encerrando…" : "Encerrar caso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Helpers visuais locais (sem novos arquivos).
 * ────────────────────────────────────────────────────────────── */
function OverviewCard({ label, value, emoji, accent = "blue", onClick }) {
  const accents = {
    blue: "from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200",
    amber:
      "from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200",
    emerald:
      "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200",
    indigo:
      "from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-900/10 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200",
  };
  const baseClass =
    "rounded-2xl border bg-gradient-to-br shadow-sm p-4 " +
    (accents[accent] || accents.blue);
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
        <span className="text-lg" aria-hidden="true">
          {emoji}
        </span>
      </div>
      <p className="mt-2 text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-50">
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={
          baseClass +
          " text-left w-full cursor-pointer transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 min-h-[44px]"
        }
      >
        {inner}
        <span className="mt-1 block text-[11px] font-semibold opacity-80">
          Ver pedidos →
        </span>
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}

function Th({ children, className = "" }) {
  return (
    <th
      className={
        "text-left text-[11px] font-bold uppercase tracking-wider px-3 sm:px-5 py-2 " +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={"px-3 sm:px-5 py-3 align-top " + className}>{children}</td>;
}

function StatusBadge({ status }) {
  const map = {
    "Em andamento":
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
    "Aguardando documentos":
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
    "Aguardando pagamento":
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200",
    Concluído:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  };
  const cls =
    map[status] ||
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span
      className={
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold " +
        cls
      }
    >
      {status}
    </span>
  );
}
