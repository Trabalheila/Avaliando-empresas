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
import { SPECIALIST_CONFIGS } from "../../pages/MyContactsApoiador";
import { db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

/** Gera (ou recupera) o link de videoconferência para um caso.
 *  Usa Jitsi Meet por ser público, gratuito e sem cadastro. O nome
 *  da sala é derivado do caseId, garantindo unicidade por caso. */
function buildVideoCallLink(caseId, existing) {
  if (existing) return existing;
  const safe = encodeURIComponent(String(caseId || "sem_id").replace(/[^a-zA-Z0-9_-]/g, "_"));
  return `https://meet.jit.si/TrabalheiLa_Caso_${safe}`;
}

/** Card de videoconferência: botão de iniciar, link compartilhável
 *  e aviso de privacidade. Só é renderizado quando o tipo de
 *  especialista tem `canVideoConference: true` em SPECIALIST_CONFIGS. */
function VideoConferenceCard({ caseId, data }) {
  const link = useMemo(() => buildVideoCallLink(caseId, data?.videoCallLink), [caseId, data]);
  const [copied, setCopied] = useState(false);

  const handleStart = () => {
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: seleciona o texto do input para o usuário copiar manualmente.
      const el = document.getElementById(`video-link-${caseId}`);
      if (el && el.select) {
        el.select();
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
            <span aria-hidden="true">🎥</span> Atendimento por videoconferência
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 mt-1">
            Inicie uma chamada segura com o cliente ou paciente deste caso.
          </p>
        </div>
        <button
          type="button"
          onClick={handleStart}
          className="px-4 py-2 rounded-xl bg-white text-blue-700 font-bold text-sm hover:bg-blue-50 shadow"
        >
          Iniciar videoconferência
        </button>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`video-link-${caseId}`}
          className="text-[11px] uppercase tracking-wide font-semibold text-blue-100"
        >
          Link da chamada
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={`video-link-${caseId}`}
            type="text"
            readOnly
            value={link}
            className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-lg bg-white/95 text-slate-800 font-mono truncate"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-2 rounded-lg bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] sm:text-xs text-blue-100 leading-relaxed">
        <span aria-hidden="true">🔒</span>{" "}
        Lembre-se: dados de atendimento são sensíveis. Compartilhe o link
        apenas com o cliente/paciente do caso, prefira ambientes privados e
        certifique-se de obter o consentimento antes de gravar a chamada.
      </p>
    </div>
  );
}

/** Limites do plano Essencial para videoconferência (mock). */
const ESSENCIAL_VIDEO_MAX_MINUTES = 30;
const ESSENCIAL_VIDEO_LIMIT_PER_MONTH = 5;

function readEssencialVideoUsage(apoiadorId) {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const key = `videoSessionsUsed:${month}:${apoiadorId || "anon"}`;
  let used = 0;
  try {
    used = Number(localStorage.getItem(key) || "0") || 0;
  } catch {
    used = 0;
  }
  return { key, used, month };
}

/** Card de videoconferência para especialistas no plano Essencial.
 *  Permite iniciar a chamada, mas com limite de 30 min / 5 sessões por mês. */
function VideoEssencialCard({ caseId, navigate }) {
  const apoiadorId = useMemo(() => {
    try {
      const p = JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
      return p.apoiadorId || p.uid || p.id || "";
    } catch {
      return "";
    }
  }, []);

  const [{ key, used }, setUsage] = useState(() => readEssencialVideoUsage(apoiadorId));
  const remaining = Math.max(0, ESSENCIAL_VIDEO_LIMIT_PER_MONTH - used);
  const limitReached = remaining <= 0;

  const [showConfirm, setShowConfirm] = useState(false);
  const [showLimit, setShowLimit] = useState(false);

  const handleStartClick = () => {
    if (limitReached) {
      setShowLimit(true);
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    try {
      const next = used + 1;
      localStorage.setItem(key, String(next));
      setUsage({ key, used: next });
    } catch {
      // ignore
    }
    setShowConfirm(false);
    const url = buildVideoCallLink(caseId);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-5">
      <h2 className="text-base md:text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
        <span aria-hidden="true">🎥</span> Videoconferência · Plano Essencial
      </h2>
      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/90">
        No plano Essencial cada sessão é limitada a{" "}
        <strong>{ESSENCIAL_VIDEO_MAX_MINUTES} minutos</strong> e você tem até{" "}
        <strong>{ESSENCIAL_VIDEO_LIMIT_PER_MONTH} sessões por mês</strong>.
      </p>
      <p className="mt-1 text-xs font-bold text-amber-900 dark:text-amber-100">
        Sessões restantes este mês: {remaining} / {ESSENCIAL_VIDEO_LIMIT_PER_MONTH}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleStartClick}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
        >
          🎬 Iniciar Videoconferência
        </button>
        <button
          type="button"
          onClick={() => navigate("/especialista/beneficios")}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          ✨ Fazer upgrade para Premium
        </button>
      </div>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              Iniciar sessão (Essencial)
            </h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              Sua sessão será limitada a{" "}
              <strong>{ESSENCIAL_VIDEO_MAX_MINUTES} minutos</strong>.<br />
              Você tem <strong>{remaining}</strong> sessão(ões) restante(s) este mês.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Ao confirmar, abriremos a sala em uma nova aba. O contador é
              informativo; encerre a chamada ao atingir o tempo do plano.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                Iniciar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {showLimit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowLimit(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              Limite atingido
            </h3>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              Limite de videoconferências atingido para o seu plano. Faça
              upgrade para o <strong>Plano Premium</strong> para ter
              videoconferências ilimitadas e sem limite de tempo.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLimit(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLimit(false);
                  navigate("/especialista/beneficios");
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
              >
                Ver planos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  // Plano do especialista: 'premium' libera videoconferência.
  // MOCK: se userProfile.isPremium estiver presente, prevalece;
  // senão buscamos o doc /apoiadores/{apoiadorId} para ler `plano`.
  const [isPremium, setIsPremium] = useState(false);
  useEffect(() => {
    let prof = {};
    try {
      prof = JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      prof = {};
    }
    const apoiadorId = prof?.apoiadorId || prof?.uid || prof?.id || "";
    setAuthorized(Boolean(apoiadorId));

    // Mock/override imediato vindo do localStorage.
    if (typeof prof?.isPremium === "boolean") {
      setIsPremium(prof.isPremium);
    } else if (typeof prof?.plano === "string") {
      setIsPremium(prof.plano.toLowerCase() === "premium");
    }

    // Fonte de verdade: documento do apoiador no Firestore.
    if (apoiadorId) {
      (async () => {
        try {
          const snap = await getDoc(doc(db, "apoiadores", apoiadorId));
          if (snap.exists()) {
            const plano = String(snap.data()?.plano || "").toLowerCase();
            setIsPremium(plano === "premium");
          }
        } catch (err) {
          console.warn("Falha ao ler plano do apoiador:", err);
        }
      })();
    }
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

        {data && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/chat/case_${encodeURIComponent(caseId)}?peer=${encodeURIComponent(
                    data.client || "Cliente do caso"
                  )}&peerRole=trabalhador&caseId=${encodeURIComponent(
                    caseId
                  )}&specialistType=${encodeURIComponent(tipo)}`
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            >
              💬 Abrir chat deste caso
            </button>
          </div>
        )}

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
          <>
            {SPECIALIST_CONFIGS?.[tipo]?.canVideoConference &&
              (isPremium ? (
                <VideoConferenceCard caseId={caseId} data={data} />
              ) : (
                <VideoEssencialCard caseId={caseId} navigate={navigate} />
              ))}
            <CaseBody tipo={tipo} data={data} />
          </>
        )}
      </main>
    </div>
  );
}
