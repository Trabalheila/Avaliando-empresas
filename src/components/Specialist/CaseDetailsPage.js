// src/components/Specialist/CaseDetailsPage.js
//
// Página de detalhes do caso para o dashboard do especialista.
// Rota: /especialista/:specialistType/caso/:caseId
//
// Renderiza informações específicas por tipo (advogado, psicologo,
// contador, etc.). Hoje consome o mock em src/data/mockCaseDetails.js;
// quando existir a coleção real /apoiadores/{id}/cases o fetch pode
// ser plugado aqui sem alterar a interface.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../AppHeader";
import { getCaseDetails } from "../../data/mockCaseDetails";

/** Normaliza o tipo (aceita "consultor-rh" e "consultor_rh"). */
function normalizeTipo(tipo) {
  return (tipo || "").toString().trim().toLowerCase().replace(/-/g, "_");
}

/** Tradução do slug para rótulo amigável no cabeçalho. */
const TIPO_LABELS = {
  advogado: "Advogado(a) Trabalhista",
  consultor_rh: "Consultor(a) de RH",
  recrutador: "Recrutador(a)",
  psicologo: "Psicólogo(a) Organizacional",
  medico: "Médico(a) do Trabalho",
  contador: "Contador(a)",
  engenheiro_seguranca: "Engenheiro(a) de Segurança",
  fisioterapeuta_ocupacional: "Fisioterapeuta Ocupacional",
  outro: "Especialista",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function InfoCard({ children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5">
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
        {label}
      </p>
      <p className="text-sm text-slate-800 dark:text-slate-100 mt-0.5">
        {value || "—"}
      </p>
    </div>
  );
}

function DocumentList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">📁</span> {title}
      </h2>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((d, idx) => (
          <li key={`${d.name}-${idx}`} className="py-2 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {d.name}
            </span>
            <a
              href={d.url || "#"}
              target={d.url && d.url !== "#" ? "_blank" : undefined}
              rel={d.url && d.url !== "#" ? "noopener noreferrer" : undefined}
              onClick={(e) => {
                if (!d.url || d.url === "#") {
                  e.preventDefault();
                  alert(`O download de "${d.name}" estará disponível em breve.`);
                }
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              Baixar
            </a>
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}

function TimelineList({ title, items, labelKey = "event" }) {
  if (!items || items.length === 0) return null;
  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">🗓️</span> {title}
      </h2>
      <ol className="mt-3 space-y-3">
        {items.map((t, idx) => (
          <li key={idx} className="flex gap-3">
            <div className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300 w-24">
              {formatDate(t.date)}
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-200">
              {t[labelKey] || t.event || t.notes}
            </div>
          </li>
        ))}
      </ol>
    </InfoCard>
  );
}

function NotesCard({ notes }) {
  if (!notes) return null;
  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">📝</span> Notas do atendimento
      </h2>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
        {notes}
      </p>
    </InfoCard>
  );
}

/** Conteúdo específico por tipo de especialista. */
function CaseBody({ tipo, data }) {
  switch (tipo) {
    case "advogado":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente" value={data.client} />
              <Field label="Tipo de caso" value={data.caseType} />
              <Field label="Nº do processo" value={data.processNumber} />
              <Field label="Instância / Vara" value={data.court} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Documentos do processo" items={data.documents} />
          <TimelineList title="Linha do tempo do processo" items={data.timeline} />
          <NotesCard notes={data.notes} />
        </>
      );

    case "psicologo":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Paciente" value={data.client} />
              <Field label="Tipo de atendimento" value={data.caseType} />
              <Field label="Sessões realizadas" value={data.sessionsCount} />
              <Field label="Foco principal" value={data.focusArea} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima sessão" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Laudos e relatórios" items={data.reports} />
          <TimelineList title="Histórico de sessões" items={data.sessions} labelKey="notes" />
          <NotesCard notes={data.notes} />
        </>
      );

    case "consultor_rh":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente" value={data.client} />
              <Field label="Tipo de projeto" value={data.caseType} />
              <Field label="Fase do projeto" value={data.projectPhase} />
              <Field label="Próxima entrega" value={data.deliverable} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Documentos do projeto" items={data.documents} />
          <TimelineList title="Marcos do projeto" items={data.milestones} />
          <NotesCard notes={data.notes} />
        </>
      );

    case "recrutador":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente" value={data.client} />
              <Field label="Vaga / Tipo" value={`${data.position || ""} · ${data.caseType || ""}`} />
              <Field label="Etapa do pipeline" value={data.pipelineStage} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          {data.candidates && data.candidates.length > 0 && (
            <InfoCard>
              <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span aria-hidden="true">👥</span> Candidatos no pipeline
              </h2>
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {data.candidates.map((c, idx) => (
                  <li key={idx} className="py-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-800 dark:text-slate-100 font-semibold">{c.name}</span>
                    <span className="text-slate-600 dark:text-slate-300">{c.stage}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>
          )}
          <DocumentList title="Documentos da vaga" items={data.documents} />
          <NotesCard notes={data.notes} />
        </>
      );

    case "medico":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Paciente" value={data.client} />
              <Field label="Tipo de consulta" value={data.caseType} />
              <Field label="Tipo de exame" value={data.examType} />
              <Field label="Status CRM" value={data.crmStatus} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Exames e atestados" items={data.exams} />
          <TimelineList title="Histórico clínico" items={data.history} />
          <NotesCard notes={data.notes} />
        </>
      );

    case "contador":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente" value={data.client} />
              <Field label="Tipo de serviço" value={data.caseType} />
              <Field label="Regime tributário" value={data.regime} />
              <Field label="Próxima obrigação" value={data.nextObligation} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Documentos fiscais" items={data.fiscalDocs} />
          <TimelineList title="Obrigações e prazos" items={data.obligations} />
          <NotesCard notes={data.notes} />
        </>
      );

    case "engenheiro_seguranca":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente" value={data.client} />
              <Field label="Tipo de trabalho" value={data.caseType} />
              <Field label="Local" value={data.siteLocation} />
              <Field label="Nível de risco" value={data.riskLevel} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Laudos e relatórios técnicos" items={data.reports} />
          <TimelineList title="Histórico de vistorias" items={data.history} />
          <NotesCard notes={data.notes} />
        </>
      );

    case "fisioterapeuta_ocupacional":
      return (
        <>
          <InfoCard>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Paciente" value={data.client} />
              <Field label="Tipo de atendimento" value={data.caseType} />
              <Field label="Protocolo" value={data.protocol} />
              <Field label="Sessões restantes" value={data.sessionsRemaining} />
              <Field label="Status" value={data.status} />
              <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
            </div>
          </InfoCard>
          <DocumentList title="Relatórios e avaliações" items={data.reports} />
          <TimelineList title="Histórico de sessões" items={data.sessions} labelKey="notes" />
          <NotesCard notes={data.notes} />
        </>
      );

    default:
      return (
        <InfoCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Cliente" value={data.client} />
            <Field label="Tipo de caso" value={data.caseType} />
            <Field label="Status" value={data.status} />
            <Field label="Próxima ação" value={`${data.nextAction || "—"} · ${formatDate(data.nextActionDate)}`} />
          </div>
          <NotesCard notes={data.notes} />
        </InfoCard>
      );
  }
}

export default function CaseDetailsPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const { specialistType, caseId } = useParams();
  const tipo = useMemo(() => normalizeTipo(specialistType), [specialistType]);

  // Guard de acesso: precisa estar logado como especialista (apoiadorId
  // no userProfile do localStorage — mesmo padrão usado pelo dashboard).
  const [authorized, setAuthorized] = useState(null);
  useEffect(() => {
    let prof = {};
    try {
      prof = JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      prof = {};
    }
    const apoiadorId = prof?.apoiadorId || prof?.uid || prof?.id || "";
    setAuthorized(Boolean(apoiadorId));
  }, []);

  const data = useMemo(() => getCaseDetails(tipo, caseId), [tipo, caseId]);
  const tipoLabel = TIPO_LABELS[tipo] || TIPO_LABELS.outro;

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} title="Detalhes do caso" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-slate-600 dark:text-slate-300">
            Você precisa estar logado como Especialista para visualizar este caso.
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
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Detalhes do caso" />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-wide font-bold text-blue-700 dark:text-blue-300">
              {tipoLabel}
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              Caso {caseId}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>

        {!data ? (
          <InfoCard>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Não encontramos detalhes para este caso. Ele pode ter sido removido
              ou os dados ainda não foram cadastrados.
            </p>
            <button
              type="button"
              onClick={() => navigate("/apoiador/my-contacts")}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            >
              Voltar para meus casos
            </button>
          </InfoCard>
        ) : (
          <CaseBody tipo={tipo} data={data} />
        )}
      </main>
    </div>
  );
}
