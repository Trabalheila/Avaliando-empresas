import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import AppHeader from "../components/AppHeader";
import {
  listIncomingApoiadorRequests,
  markApoiadorRequestRead,
  respondToApoiadorRequest,
} from "../services/contactRequests";

/* ──────────────────────────────────────────────────────────────
 * Configurações por tipo de especialista (área de atuação).
 *
 * `tipo` segue os valores salvos em `apoiadores/{id}.tipo`
 * (advogado, medico, psicologo, consultor_rh, contador,
 *  engenheiro_seguranca, fisioterapeuta_ocupacional, recrutador,
 *  outro). Cada entrada define:
 *   - label:           título amigável exibido no cabeçalho.
 *   - caseLabel:       termo usado em "Tipo de caso" (Processo / Projeto / Atendimento).
 *   - extraColumns:    colunas adicionais na tabela de Casos Ativos.
 *                      Cada item é { key, label, render? }.
 *   - resourceLinks:   array de links exibidos em "Recursos e Ferramentas".
 * ────────────────────────────────────────────────────────────── */
const SPECIALIST_CONFIGS = {
  advogado: {
    label: "Advogado(a) trabalhista",
    caseLabel: "Processo",
    extraColumns: [
      { key: "processNumber", label: "Nº do processo" },
      { key: "court", label: "Instância / Vara" },
    ],
    resourceLinks: [
      { label: "Legislação trabalhista (CLT)", href: "#", emoji: "⚖️" },
      { label: "Jurisprudência TST", href: "#", emoji: "📚" },
      { label: "Modelos de petições", href: "#", emoji: "📄" },
      { label: "Calendário de audiências", href: "#", emoji: "📅" },
    ],
  },
  consultor_rh: {
    label: "Consultor(a) de RH",
    caseLabel: "Projeto",
    extraColumns: [
      { key: "projectPhase", label: "Fase do projeto" },
      { key: "deliverable", label: "Próxima entrega" },
    ],
    resourceLinks: [
      { label: "Melhores práticas de RH", href: "#", emoji: "🌟" },
      { label: "Modelos de avaliação de desempenho", href: "#", emoji: "📊" },
      { label: "Pesquisas salariais", href: "#", emoji: "💰" },
      { label: "Fórum de Especialistas", href: "#", emoji: "💬" },
    ],
  },
  recrutador: {
    label: "Recrutador(a)",
    caseLabel: "Vaga",
    extraColumns: [
      { key: "position", label: "Cargo" },
      { key: "pipelineStage", label: "Etapa do pipeline" },
    ],
    resourceLinks: [
      { label: "Banco de talentos", href: "#", emoji: "🎯" },
      { label: "Tendências de mercado", href: "#", emoji: "📈" },
      { label: "Modelos de entrevista", href: "#", emoji: "📝" },
      { label: "Fórum de Especialistas", href: "#", emoji: "💬" },
    ],
  },
  psicologo: {
    label: "Psicólogo(a) organizacional",
    caseLabel: "Atendimento",
    extraColumns: [
      { key: "sessionsCount", label: "Sessões realizadas" },
      { key: "focusArea", label: "Foco clínico" },
    ],
    resourceLinks: [
      { label: "Código de ética CRP", href: "#", emoji: "⚖️" },
      { label: "Protocolos de saúde mental no trabalho", href: "#", emoji: "🧠" },
      { label: "Modelos de anâmnese", href: "#", emoji: "📄" },
      { label: "Agenda de sessões", href: "#", emoji: "📅" },
    ],
  },
  medico: {
    label: "Médico(a) do trabalho",
    caseLabel: "Atendimento",
    extraColumns: [
      { key: "examType", label: "Tipo de exame" },
      { key: "crmStatus", label: "Status clínico" },
    ],
    resourceLinks: [
      { label: "NRs de saúde ocupacional", href: "#", emoji: "🩺" },
      { label: "Protocolos PCMSO", href: "#", emoji: "📋" },
      { label: "Modelos de ASO", href: "#", emoji: "📄" },
      { label: "Calendário de exames", href: "#", emoji: "📅" },
    ],
  },
  contador: {
    label: "Contador(a)",
    caseLabel: "Cliente",
    extraColumns: [
      { key: "regime", label: "Regime tributário" },
      { key: "nextObligation", label: "Próxima obrigação" },
    ],
    resourceLinks: [
      { label: "Calendário fiscal", href: "#", emoji: "📅" },
      { label: "Tabela de tributos", href: "#", emoji: "💰" },
      { label: "Modelos de balancete", href: "#", emoji: "📄" },
      { label: "Atualizações da Receita", href: "#", emoji: "📰" },
    ],
  },
  engenheiro_seguranca: {
    label: "Engenheiro(a) de Segurança",
    caseLabel: "Projeto",
    extraColumns: [
      { key: "siteLocation", label: "Local da obra/empresa" },
      { key: "riskLevel", label: "Nível de risco" },
    ],
    resourceLinks: [
      { label: "NRs do MTE", href: "#", emoji: "🦺" },
      { label: "Laudos técnicos (PPRA/PCMSO)", href: "#", emoji: "📄" },
      { label: "Checklists de inspeção", href: "#", emoji: "✅" },
      { label: "Calendário de auditorias", href: "#", emoji: "📅" },
    ],
  },
  fisioterapeuta_ocupacional: {
    label: "Fisioterapeuta Ocupacional",
    caseLabel: "Atendimento",
    extraColumns: [
      { key: "protocol", label: "Protocolo" },
      { key: "sessionsCount", label: "Sessões" },
    ],
    resourceLinks: [
      { label: "Protocolos de ginástica laboral", href: "#", emoji: "🤸" },
      { label: "Avaliação ergonômica", href: "#", emoji: "📐" },
      { label: "Modelos de relatório", href: "#", emoji: "📄" },
      { label: "Fórum de Especialistas", href: "#", emoji: "💬" },
    ],
  },
  outro: {
    label: "Especialista",
    caseLabel: "Caso",
    extraColumns: [],
    resourceLinks: [
      { label: "Modelos de documentos", href: "#", emoji: "📄" },
      { label: "Legislação trabalhista", href: "#", emoji: "⚖️" },
      { label: "Fórum de Especialistas", href: "#", emoji: "💬" },
      { label: "Calendário", href: "#", emoji: "📅" },
    ],
  },
};

function getSpecialistConfig(tipo) {
  const key = (tipo || "").toString().trim().toLowerCase();
  return SPECIALIST_CONFIGS[key] || SPECIALIST_CONFIGS.outro;
}

/* ──────────────────────────────────────────────────────────────
 * Placeholders de busca no Firestore.
 *
 * Estas funções devolvem dados mockados enquanto as coleções
 * reais (casos do especialista, avaliações, etc.) não estão
 * mapeadas. Substituir a implementação interna por queries reais
 * quando os modelos estiverem definidos.
 * ────────────────────────────────────────────────────────────── */
/* Mocks por tipo de especialista. Substituir por queries reais quando
 * a coleção /apoiadores/{id}/cases existir. */
const MOCK_ACTIVE_CASES = {
  advogado: [
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
  consultor_rh: [
    {
      id: "proj_001",
      clientAlias: "Empresa Acme S.A.",
      caseType: "Recrutamento executivo",
      status: "Em andamento",
      nextAction: "Apresentar shortlist",
      nextActionDate: "2026-06-08",
      projectPhase: "Sourcing",
      deliverable: "3 candidatos finalistas",
    },
    {
      id: "proj_002",
      clientAlias: "Empresa Delta Ltda.",
      caseType: "Plano de carreira",
      status: "Em andamento",
      nextAction: "Workshop com liderança",
      nextActionDate: "2026-06-15",
      projectPhase: "Desenho",
      deliverable: "Matriz de competências",
    },
    {
      id: "proj_003",
      clientAlias: "Startup Beta",
      caseType: "Diagnóstico de clima",
      status: "Aguardando documentos",
      nextAction: "Receber pesquisa interna",
      nextActionDate: "2026-06-04",
      projectPhase: "Coleta de dados",
      deliverable: "Relatório executivo",
    },
  ],
  recrutador: [
    {
      id: "vaga_001",
      clientAlias: "Empresa Acme S.A.",
      caseType: "Vaga aberta",
      status: "Em andamento",
      nextAction: "Entrevistas finais",
      nextActionDate: "2026-06-09",
      position: "Head de Engenharia",
      pipelineStage: "Entrevista final",
    },
    {
      id: "vaga_002",
      clientAlias: "Startup Gama",
      caseType: "Vaga aberta",
      status: "Em andamento",
      nextAction: "Triagem inicial",
      nextActionDate: "2026-06-02",
      position: "Product Designer Sêrnior",
      pipelineStage: "Sourcing",
    },
  ],
  psicologo: [
    {
      id: "at_001",
      clientAlias: "Trabalhador #A82F",
      caseType: "Acompanhamento burnout",
      status: "Em andamento",
      nextAction: "Próxima sessão",
      nextActionDate: "2026-06-07",
      sessionsCount: 6,
      focusArea: "Saúde mental no trabalho",
    },
    {
      id: "at_002",
      clientAlias: "Empresa Acme S.A.",
      caseType: "Programa de bem-estar",
      status: "Em andamento",
      nextAction: "Workshop coletivo",
      nextActionDate: "2026-06-14",
      sessionsCount: 2,
      focusArea: "Prevenção",
    },
  ],
  medico: [
    {
      id: "med_001",
      clientAlias: "Empresa Acme S.A.",
      caseType: "PCMSO anual",
      status: "Em andamento",
      nextAction: "Realizar exames periódicos",
      nextActionDate: "2026-06-06",
      examType: "Periódico",
      crmStatus: "Em andamento",
    },
  ],
  contador: [
    {
      id: "cont_001",
      clientAlias: "Empresa Acme S.A.",
      caseType: "Folha de pagamento",
      status: "Em andamento",
      nextAction: "Fechar folha",
      nextActionDate: "2026-06-05",
      regime: "Lucro Real",
      nextObligation: "DCTFWeb 15/06",
    },
  ],
  engenheiro_seguranca: [
    {
      id: "eng_001",
      clientAlias: "Empresa Acme S.A.",
      caseType: "Implantação PPRA",
      status: "Em andamento",
      nextAction: "Visita técnica",
      nextActionDate: "2026-06-11",
      siteLocation: "Galpão industrial – SP",
      riskLevel: "Grau 3",
    },
  ],
  fisioterapeuta_ocupacional: [
    {
      id: "fis_001",
      clientAlias: "Empresa Acme S.A.",
      caseType: "Ginástica laboral",
      status: "Em andamento",
      nextAction: "Próxima sessão",
      nextActionDate: "2026-06-06",
      protocol: "Cervical / postural",
      sessionsCount: 4,
    },
  ],
  outro: [
    {
      id: "case_001",
      clientAlias: "Trabalhador #A82F",
      caseType: "Atendimento geral",
      status: "Em andamento",
      nextAction: "Próxima reunião",
      nextActionDate: "2026-06-10",
    },
  ],
};

async function fetchActiveCases(/* apoiadorId */ _apoiadorId, tipo) {
  const key = (tipo || "").toString().trim().toLowerCase();
  return MOCK_ACTIVE_CASES[key] || MOCK_ACTIVE_CASES.outro;
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

async function fetchSpecialistReviews(/* apoiadorId */) {
  return {
    average: 4.8,
    total: 25,
    items: [
      {
        id: "rev_1",
        author: "Trabalhador #A82F",
        rating: 5,
        text: "Atendimento excelente, me explicou tudo com clareza.",
        createdAt: "2026-05-12",
      },
      {
        id: "rev_2",
        author: "Empresa Acme S.A.",
        rating: 5,
        text: "Parecer técnico impecável e prazos cumpridos à risca.",
        createdAt: "2026-04-28",
      },
      {
        id: "rev_3",
        author: "Trabalhador #71BC",
        rating: 4,
        text: "Boa comunicação, recomendo.",
        createdAt: "2026-04-10",
      },
    ],
  };
}

const RESOURCE_LINKS_FALLBACK = [
  { label: "Modelos de documentos", href: "#", emoji: "📄" },
  { label: "Legislação trabalhista recente", href: "#", emoji: "⚖️" },
  { label: "Fórum de Especialistas", href: "#", emoji: "💬" },
  { label: "Calendário", href: "#", emoji: "📅" },
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

  // Perfil do apoiador no Firestore — usado para descobrir o `tipo`
  // (área de atuação) e adaptar dinamicamente o dashboard.
  const [apoiadorDoc, setApoiadorDoc] = useState(null);

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
      const data = await listIncomingApoiadorRequests(apoiadorId, 100);
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

  // Carrega dados mockados das demais seções em paralelo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cases, history, rev] = await Promise.all([
          fetchActiveCases(apoiadorId, specialistTipo),
          fetchCaseHistory(apoiadorId),
          fetchSpecialistReviews(apoiadorId),
        ]);
        if (cancelled) return;
        setActiveCases(cases);
        setCaseHistory(history);
        setReviews(rev);
      } catch (err) {
        console.warn("Falha ao carregar dados do dashboard do especialista:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId, specialistTipo]);

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

  // Métricas derivadas para a seção Visão Geral.
  const pendingCount = useMemo(
    () => items.filter((r) => (r.status || "pending") === "pending").length,
    [items]
  );
  const finishedLast30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return caseHistory.filter((c) => {
      const t = c.finishedAt ? new Date(c.finishedAt).getTime() : 0;
      return t >= cutoff;
    }).length;
  }, [caseHistory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Contatos (Especialista)" />

      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Cabeçalho do dashboard */}
        <header className="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Dashboard do Especialista · {specialistConfig.label}
            </p>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
              Olá, {specialistName} 👋
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Acompanhe seus clientes, pedidos de contato e reputação em um único lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/apoiador/perfil")}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30"
          >
            ⚙️ Gerenciar perfil
          </button>
        </header>

        {/* Visão Geral */}
        <section aria-labelledby="overview-title">
          <h2
            id="overview-title"
            className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2"
          >
            Visão geral
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            />
            <OverviewCard
              label="Finalizados (30 dias)"
              value={finishedLast30}
              accent="emerald"
              emoji="✅"
            />
            <OverviewCard
              label="Satisfação média"
              value={`${reviews.average?.toFixed(1) || "—"}/5`}
              accent="indigo"
              emoji="⭐"
            />
          </div>
        </section>

        {/* Meus Clientes / Casos Ativos */}
        <section
          aria-labelledby="active-cases-title"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700"
        >
          <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <h2
              id="active-cases-title"
              className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"
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
            <div className="overflow-x-auto">
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
                        <button
                          type="button"
                          onClick={() =>
                            alert(`Detalhes do caso ${c.id} (em desenvolvimento).`)
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Ver detalhes
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pedidos de Contato (dados reais) */}
        <section
          aria-labelledby="requests-title"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2
              id="requests-title"
              className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"
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
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecline(r.id)}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
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
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
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
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveReply(null);
                              setReplyText("");
                            }}
                            disabled={busy}
                            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAccept(r.id)}
                            disabled={busy}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
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

        {/* Histórico de Casos */}
        <section
          aria-labelledby="history-title"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700"
        >
          <header className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2
              id="history-title"
              className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"
            >
              <span aria-hidden="true">🗂️</span> Histórico de casos
            </h2>
          </header>
          {caseHistory.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              Você ainda não finalizou nenhum caso.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300">
                  <tr>
                    <Th>Cliente</Th>
                    <Th>Tipo de caso</Th>
                    <Th>Finalizado em</Th>
                    <Th>Resultado</Th>
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
          )}
        </section>

        {/* Minha Reputação + Recursos (2 colunas no desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section
            aria-labelledby="reputation-title"
            className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
          >
            <h2
              id="reputation-title"
              className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"
            >
              <span aria-hidden="true">⭐</span> Minha reputação
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Avaliação média:{" "}
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {reviews.average?.toFixed(1) || "—"}/5
              </span>{" "}
              <span className="text-slate-500 dark:text-slate-400">
                ({reviews.total} avaliações)
              </span>
            </p>
            <div className="mt-4 space-y-3">
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

          <section
            aria-labelledby="resources-title"
            className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5"
          >
            <h2
              id="resources-title"
              className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"
            >
              <span aria-hidden="true">🧰</span> Recursos e ferramentas
            </h2>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(specialistConfig.resourceLinks || RESOURCE_LINKS_FALLBACK).map((res) => (
                <li key={res.label}>
                  <a
                    href={res.href}
                    onClick={(e) => {
                      if (res.href === "#") {
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
              ))}
            </ul>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span aria-hidden="true">⚙️</span> Configurações do perfil
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Atualize áreas de atuação, descrição, nichos e disponibilidade.
              </p>
              <button
                type="button"
                onClick={() => navigate("/apoiador/perfil")}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                Gerenciar perfil de especialista
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Helpers visuais locais (sem novos arquivos).
 * ────────────────────────────────────────────────────────────── */
function OverviewCard({ label, value, emoji, accent = "blue" }) {
  const accents = {
    blue: "from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200",
    amber:
      "from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-200",
    emerald:
      "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200",
    indigo:
      "from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-900/10 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200",
  };
  return (
    <div
      className={
        "rounded-2xl border bg-gradient-to-br shadow-sm p-4 " +
        (accents[accent] || accents.blue)
      }
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
        <span className="text-lg" aria-hidden="true">
          {emoji}
        </span>
      </div>
      <p className="mt-2 text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-50">
        {value}
      </p>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={
        "text-left text-[11px] font-bold uppercase tracking-wider px-5 py-2 " +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return <td className={"px-5 py-3 align-top " + className}>{children}</td>;
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
