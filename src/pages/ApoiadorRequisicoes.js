import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  limit,
} from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import SpecialistDemandInsights from "../components/Specialist/SpecialistDemandInsights";
import {
  getRatingLabel,
  FREE_PLAN_RESPONSE_SLA_MINUTES,
} from "../data/consultationPricing";
import {
  buildVideoCallLink,
  ESSENCIAL_VIDEO_MAX_MINUTES,
  ESSENCIAL_VIDEO_LIMIT_PER_MONTH,
  readEssencialVideoUsage,
  incrementEssencialVideoUsage,
  formatStartsIn,
} from "../utils/videoCall";

/**
 * Painel do Apoiador — Minhas Requisições.
 *
 * Lê a coleção `consultas` (criada pelo webhook do Mercado Pago após
 * aprovação do pagamento) filtrando por `apoiadorId == meu apoiador`.
 *
 * Três abas:
 *  - Pendentes: status = "approved" (paga, aguardando contato/atendimento)
 *  - Aceitas:   status = "accepted" (apoiador confirmou que vai atender)
 *  - Histórico: status = "concluded" | "declined"
 *
 * Apoiadores Premium podem definir / atualizar o `precoConsulta` diretamente
 * nessa página caso ainda esteja vazio.
 */

function BRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value) || 0
  );
}

const TABS = [
  { id: "pending", label: "Pendentes" },
  { id: "accepted", label: "Aceitas" },
  { id: "history", label: "Histórico" },
];

function tabForStatus(status) {
  switch ((status || "").toLowerCase()) {
    case "approved":
    case "paid":
    case "pending_acceptance":
      return "pending";
    case "accepted":
    case "in_progress":
      return "accepted";
    case "concluded":
    case "declined":
    case "refunded":
    case "expired":
      return "history";
    default:
      return "pending";
  }
}

export default function ApoiadorRequisicoes({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [apoiador, setApoiador] = useState(null);
  const [apoiadorId, setApoiadorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consultas, setConsultas] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [precoInput, setPrecoInput] = useState("");
  const [savingPreco, setSavingPreco] = useState(false);
  const [precoMsg, setPrecoMsg] = useState("");

  /* Descobre o apoiadorId do usuário logado (via localStorage). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const id = stored?.apoiadorId || "";
        if (!id) {
          if (!cancelled) {
            setError("Você precisa estar logado como Especialista para ver suas requisições.");
            setLoading(false);
          }
          return;
        }
        const snap = await getDoc(doc(db, "apoiadores", id));
        if (!snap.exists()) {
          if (!cancelled) {
            setError("Perfil de Especialista não encontrado.");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setApoiadorId(id);
          setApoiador({ id, ...snap.data() });
          setPrecoInput(String(snap.data().precoConsulta || ""));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erro ao carregar perfil.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Carrega consultas associadas ao apoiador. */
  useEffect(() => {
    if (!apoiadorId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        // Tenta com orderBy; se faltar índice, faz fallback sem ordenação.
        let docs = [];
        try {
          const q1 = query(
            collection(db, "consultas"),
            where("apoiadorId", "==", apoiadorId),
            orderBy("createdAt", "desc"),
            limit(200)
          );
          const snap = await getDocs(q1);
          docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch {
          const q2 = query(
            collection(db, "consultas"),
            where("apoiadorId", "==", apoiadorId),
            limit(200)
          );
          const snap = await getDocs(q2);
          docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        if (!cancelled) {
          setConsultas(docs);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erro ao carregar requisições.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  const isPremium = String(apoiador?.plano || "").toLowerCase() === "premium";
  const planoLower = String(apoiador?.plano || "").toLowerCase();
  const isFreePlan = !planoLower || planoLower === "free" || planoLower === "gratuito";
  const precoConsulta = Number(apoiador?.precoConsulta) || 0;
  const precisaDefinirPreco = isPremium && !(precoConsulta > 0);

  const filtered = useMemo(
    () => consultas.filter((c) => tabForStatus(c.status) === activeTab),
    [consultas, activeTab]
  );

  const counts = useMemo(() => {
    const out = { pending: 0, accepted: 0, history: 0 };
    consultas.forEach((c) => {
      const t = tabForStatus(c.status);
      out[t] = (out[t] || 0) + 1;
    });
    return out;
  }, [consultas]);

  /* Marca como lida ao abrir a aba (best-effort). */
  useEffect(() => {
    if (!consultas.length) return;
    const unread = consultas.filter(
      (c) => tabForStatus(c.status) === activeTab && c.readByApoiador === false
    );
    if (unread.length === 0) return;
    Promise.all(
      unread.map((c) =>
        updateDoc(doc(db, "consultas", c.id), { readByApoiador: true }).catch(() => {})
      )
    );
  }, [activeTab, consultas]);

  async function handleSavePreco() {
    const value = Number(String(precoInput).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setPrecoMsg("Informe um valor numérico maior que zero.");
      return;
    }
    setSavingPreco(true);
    setPrecoMsg("");
    try {
      // Mantém `precoConsulta` e `averageConsultationPrice` em sincronia: a
      // busca de especialistas (FindSpecialistPage) prioriza
      // `averageConsultationPrice`, então atualizar apenas `precoConsulta`
      // faria o valor exibido divergir do que o profissional escolheu.
      await updateDoc(doc(db, "apoiadores", apoiadorId), {
        precoConsulta: value,
        averageConsultationPrice: value,
      });
      setApoiador((prev) =>
        prev ? { ...prev, precoConsulta: value, averageConsultationPrice: value } : prev
      );
      setPrecoMsg("Preço atualizado com sucesso.");
    } catch (err) {
      setPrecoMsg(err?.message || "Erro ao salvar preço.");
    } finally {
      setSavingPreco(false);
    }
  }

  async function handleStatusChange(consultaId, nextStatus) {
    try {
      const patch = { status: nextStatus };
      // Ao ACEITAR uma consulta avulsa (Plano Gratuito), registra o início
      // do SLA e o prazo de resposta — usados para exibir o contador e
      // cobrar o compromisso de atendimento em até N minutos.
      if (nextStatus === "accepted") {
        const target = consultas.find((c) => c.id === consultaId);
        const slaMin =
          Number(target?.responseSlaMinutes) || FREE_PLAN_RESPONSE_SLA_MINUTES;
        const acceptedAtMs = Date.now();
        patch.acceptedAt = new Date(acceptedAtMs).toISOString();
        patch.responseDeadlineAt = new Date(
          acceptedAtMs + slaMin * 60 * 1000
        ).toISOString();
        patch.responseSlaMinutes = slaMin;
      }
      await updateDoc(doc(db, "consultas", consultaId), patch);
      setConsultas((prev) =>
        prev.map((c) => (c.id === consultaId ? { ...c, ...patch } : c))
      );
    } catch (err) {
      setError(err?.message || "Erro ao atualizar requisição.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
          Minhas Requisições
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Requisições de consulta que chegaram pelo Trabalhei Lá.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Visao Geral da Demanda (Plano Gratuito) */}
        {isFreePlan && apoiador && (
          <SpecialistDemandInsights apoiador={apoiador} navigate={navigate} />
        )}

        {/* Meu valor de consulta (Apoiador Premium) — sempre visível para
            que o especialista possa ver e editar o valor que cobra. Quando
            ainda não há preço definido, o card assume o estilo de alerta. */}
        {isPremium && apoiador && (
          <div
            className={
              "mb-6 p-4 rounded-2xl border " +
              (precisaDefinirPreco
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700")
            }
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p
                  className={
                    "text-sm font-bold " +
                    (precisaDefinirPreco
                      ? "text-amber-800 dark:text-amber-200"
                      : "text-slate-800 dark:text-slate-100")
                  }
                >
                  {precisaDefinirPreco
                    ? "Defina seu preço de consulta para aparecer nas buscas."
                    : "Meu valor de consulta"}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {precisaDefinirPreco
                    ? 'Especialistas Premium definem o próprio valor. Sem esse campo preenchido, seu perfil não exibe botão "Solicitar consulta" para potenciais clientes.'
                    : "Como especialista Premium, você define o valor cobrado por consulta. Os clientes podem pagar via cartão ou PIX."}
                </p>
              </div>
              {!precisaDefinirPreco && (
                <div className="text-right shrink-0">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                    Valor atual
                  </p>
                  <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    {BRL(precoConsulta)}
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">R$</span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={precoInput}
                onChange={(e) => setPrecoInput(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleSavePreco}
                disabled={savingPreco}
                className={
                  "px-4 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 " +
                  (precisaDefinirPreco
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700")
                }
              >
                {savingPreco
                  ? "Salvando…"
                  : precisaDefinirPreco
                  ? "Salvar preço"
                  : "Atualizar valor"}
              </button>
              {precoMsg && (
                <span className="text-xs text-slate-600 dark:text-slate-300">{precoMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={
                "px-4 py-2 -mb-px text-sm font-bold border-b-2 transition " +
                (activeTab === t.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400")
              }
            >
              {t.label}
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {counts[t.id] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            Carregando…
          </p>
        ) : filtered.length === 0 ? (
          <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhuma requisição nesta aba.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const valor = isPremium ? precoConsulta || c.amount : c.amount;
              return (
                <li
                  key={c.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                        {c.requesterAudience === "employer" ? "Empresa" : "Trabalhador"}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                        {c.especialidade || "Consulta intermediada"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {c.createdAt?.toDate
                          ? c.createdAt.toDate().toLocaleString("pt-BR")
                          : ""}
                      </p>
                      {c.tipoAtendimento && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Formato: <strong>{c.tipoAtendimento}</strong>
                        </p>
                      )}
                      {c.mensagem && (
                        <p className="text-sm text-slate-700 dark:text-slate-200 mt-2 italic">
                          “{c.mensagem}”
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                        {BRL(valor)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Plataforma:{" "}
                        {BRL(Number(c.marketplaceFee) || 0)} (
                        {c.tier === "premium" ? "12,5%" : "10%"})
                      </p>
                      <p className="text-[11px] mt-1 font-semibold text-blue-600 dark:text-blue-400">
                        {(c.status || "approved").replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  {activeTab === "pending" && (
                    <div className="mt-3">
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 p-2 mb-2">
                        <span aria-hidden="true">⏱️</span>
                        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                          Ao aceitar, você se compromete a responder este
                          trabalhador em até{" "}
                          {Number(c.responseSlaMinutes) ||
                            FREE_PLAN_RESPONSE_SLA_MINUTES}{" "}
                          minutos.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(c.id, "accepted")}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        >
                          Aceitar e responder em até{" "}
                          {Number(c.responseSlaMinutes) ||
                            FREE_PLAN_RESPONSE_SLA_MINUTES}{" "}
                          min
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(c.id, "declined")}
                          className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-300 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  )}
                  {activeTab === "accepted" && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <SlaCountdown
                        deadlineAt={c.responseDeadlineAt}
                        slaMinutes={
                          Number(c.responseSlaMinutes) ||
                          FREE_PLAN_RESPONSE_SLA_MINUTES
                        }
                      />
                      <VideoCallButton
                        consulta={c}
                        apoiadorId={apoiadorId}
                        isPremium={isPremium}
                        navigate={navigate}
                      />
                      <button
                        type="button"
                        onClick={() => handleStatusChange(c.id, "concluded")}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                      >
                        Marcar como concluída
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

// Evita warning de variável não utilizada em ambientes que linkam auth.
void auth;
/* ════════════════════════════════════════════════
   SlaCountdown (especialista)
   ────────────────────────────────────────────────
   Contador regressivo do SLA de resposta (Plano Gratuito). Mostra o tempo
   restante para o profissional responder após aceitar a consulta. Quando
   o prazo estoura, exibe "Prazo de resposta esgotado" para reforçar o
   compromisso assumido.
   ════════════════════════════════════════════════ */
function SlaCountdown({ deadlineAt, slaMinutes }) {
  const [now, setNow] = useState(() => Date.now());

  const deadlineMs = useMemo(() => {
    if (!deadlineAt) return null;
    const ms = new Date(deadlineAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [deadlineAt]);

  useEffect(() => {
    if (!deadlineMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineMs]);

  if (!deadlineMs) {
    return (
      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
        ⏱️ Responda em até {slaMinutes} min
      </span>
    );
  }

  const remainingMs = deadlineMs - now;
  if (remainingMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
        ⏱️ Prazo de resposta esgotado
      </span>
    );
  }

  const totalSec = Math.floor(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
      ⏱️ Responder em {mm}:{ss}
    </span>
  );
}

/* ════════════════════════════════════════════════
   VideoCallButton (especialista)
   ────────────────────────────────────────────────
   - Premium: abre direto a sala da consulta.
   - Essencial: aplica limite mensal (30 min / 5 sessões);
     se atingido, mostra aviso com link para /especialista/beneficios.
   ════════════════════════════════════════════════ */
function VideoCallButton({ consulta, apoiadorId, isPremium, navigate }) {
  const [usage, setUsage] = useState(() => readEssencialVideoUsage(apoiadorId));
  const [showLimit, setShowLimit] = useState(false);

  const url = buildVideoCallLink(consulta.id, consulta.videoCallLink);
  const startsIn = formatStartsIn(consulta.scheduledFor);
  const remaining = Math.max(
    0,
    ESSENCIAL_VIDEO_LIMIT_PER_MONTH - (usage?.used || 0)
  );
  const essencialLimitReached = !isPremium && remaining <= 0;

  const handleClick = (e) => {
    if (essencialLimitReached) {
      e.preventDefault();
      setShowLimit(true);
      return;
    }
    if (!isPremium) {
      setUsage(incrementEssencialVideoUsage(apoiadorId));
    }
  };

  return (
    <>
      <a
        href={essencialLimitReached ? undefined : url}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        className={
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition " +
          (essencialLimitReached
            ? "bg-slate-300 text-slate-600 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
            : "bg-emerald-600 hover:bg-emerald-700 text-white")
        }
        title={
          isPremium
            ? "Abrir sala da videochamada"
            : `Plano Essencial: até ${ESSENCIAL_VIDEO_MAX_MINUTES} min/sessão, ${remaining}/${ESSENCIAL_VIDEO_LIMIT_PER_MONTH} restantes neste mês`
        }
      >
        🎥 Acessar Videochamada
      </a>
      {startsIn && (
        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
          {startsIn}
        </span>
      )}
      {!isPremium && (
        <span className="text-[11px] text-amber-700 dark:text-amber-300">
          Essencial: {remaining}/{ESSENCIAL_VIDEO_LIMIT_PER_MONTH} sessões restantes este mês
        </span>
      )}

      {showLimit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:px-4"
          onClick={() => setShowLimit(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
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
    </>
  );
}
