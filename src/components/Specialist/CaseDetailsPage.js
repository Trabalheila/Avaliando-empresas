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
import { db, auth } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import { getSpecialistCase } from "../../services/specialistCases";
import { listWorkerDocuments } from "../../services/workerDocuments";
import AnamneseCard from "./AnamneseCard";
import {
  downloadContrato,
  downloadDeclaracao,
  downloadTermoFatos,
  downloadProcuracao,
} from "../../utils/legalDocuments";
import {
  getSpecialistIdFromConversationId,
  getWorkerIdFromConversationId,
} from "../../utils/chatId";
import {
  computeAdExitumCommission,
  registerAdExitumCommission,
} from "../../services/commissions";
import {
  saveProcessDetails,
  addHistoryEntry,
  listHistory,
  addPrivateNote,
  listPrivateNotes,
  updatePrivateNote,
  deletePrivateNote,
  saveChecklist,
  addDeadline,
  listDeadlines,
  setDeadlineStatus,
  deleteDeadline,
  uploadCaseDocument,
  listCaseDocuments,
  setDocumentVisibility,
  deleteCaseDocument,
  getCaseDoc,
} from "../../services/caseManagement";
import {
  calcularVerbasRescisorias,
  gerarPeticaoInicial,
  formatBRL as formatBRLUtil,
  TIPOS_RESCISAO,
  DEFAULT_CHECKLIST_ITEMS,
  PROCESS_STATUS_OPTIONS,
} from "../../utils/laborCalculations";
import {
  buildVideoCallLink,
  ESSENCIAL_VIDEO_MAX_MINUTES,
  ESSENCIAL_VIDEO_LIMIT_PER_MONTH,
  readEssencialVideoUsage,
  incrementEssencialVideoUsage,
} from "../../utils/videoCall";
import { buildApiUrl } from "../../utils/apiBase";

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

  const [{ used }, setUsage] = useState(() => readEssencialVideoUsage(apoiadorId));
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
    setUsage(incrementEssencialVideoUsage(apoiadorId));
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:px-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:px-4"
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
    </div>
  );
}

/** Card de upload e envio de recibo ao trabalhador (cliente/paciente).
 *  O profissional anexa o recibo do atendimento e, ao confirmar, ele é
 *  enviado por e-mail ao trabalhador via /api/send-receipt. */
const MAX_RECEIPT_MB = 2;
const ACCEPT_RECEIPT =
  ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      // result = "data:<mime>;base64,<conteúdo>"
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () =>
      reject(reader.error || new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function ReceiptUploadCard({ caseId, data, apoiadorId, specialistName }) {
  const [file, setFile] = useState(null);
  const [email, setEmail] = useState(
    () => data?.workerEmail || data?.clientEmail || ""
  );
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, msg }

  const workerUid = data?.workerUid || data?.workerId || "";

  const handleFile = (e) => {
    setFeedback(null);
    const f = e.target.files?.[0] || null;
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_RECEIPT_MB * 1024 * 1024) {
      setFile(null);
      setFeedback({
        ok: false,
        msg: `O arquivo excede o limite de ${MAX_RECEIPT_MB} MB.`,
      });
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = !!file && !sending && (Boolean(workerUid) || emailValid);

  const handleSend = async () => {
    if (!file) {
      setFeedback({ ok: false, msg: "Anexe o arquivo do recibo." });
      return;
    }
    if (!workerUid && !emailValid) {
      setFeedback({
        ok: false,
        msg: "Informe um e-mail de destinatário válido.",
      });
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      const fileContentBase64 = await fileToBase64(file);
      const resp = await fetch(buildApiUrl("/api/send-receipt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          consultaId: data?.consultaId || data?.consultationId || caseId,
          apoiadorId,
          specialistName,
          workerUid: workerUid || undefined,
          toEmail: email.trim() || undefined,
          note: note.trim() || undefined,
          fileName: file.name,
          fileType: file.type,
          fileContentBase64,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.ok === false) {
        setFeedback({
          ok: false,
          msg:
            json?.error ||
            "Não foi possível enviar o recibo. Tente novamente.",
        });
      } else if (json?.emailed === false) {
        setFeedback({
          ok: false,
          msg: "Envio de e-mail indisponível no momento. Tente mais tarde.",
        });
      } else {
        setFeedback({
          ok: true,
          msg: "Recibo enviado para o trabalhador com sucesso.",
        });
        setFile(null);
        setNote("");
      }
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err?.message || "Erro inesperado ao enviar o recibo.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-emerald-100 dark:border-slate-700 p-5">
      <h2 className="text-base md:text-lg font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
        <span aria-hidden="true">🧾</span> Enviar comprovante de atendimento
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
        Anexe o comprovante de atendimento realizado. A nota fiscal da consulta
        é emitida pelo Trabalhei Lá diretamente ao trabalhador.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
            Arquivo do recibo (PDF, PNG, JPG ou WEBP · até {MAX_RECEIPT_MB} MB)
          </label>
          <input
            type="file"
            accept={ACCEPT_RECEIPT}
            onChange={handleFile}
            className="mt-1 block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
          />
          {file && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Selecionado: {file.name} (
              {(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`receipt-email-${caseId}`}
            className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
          >
            E-mail do trabalhador
            {workerUid ? " (opcional — já vinculado ao caso)" : ""}
          </label>
          <input
            id={`receipt-email-${caseId}`}
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFeedback(null);
            }}
            placeholder="email@exemplo.com"
            className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label
            htmlFor={`receipt-note-${caseId}`}
            className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
          >
            Mensagem ao trabalhador (opcional)
          </label>
          <textarea
            id={`receipt-note-${caseId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ex.: Segue o recibo referente à consulta realizada."
            className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 resize-y"
          />
        </div>

        {feedback && (
          <p
            className={
              "text-sm font-semibold " +
              (feedback.ok
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-red-600 dark:text-red-400")
            }
          >
            {feedback.ok ? "✅ " : "⚠️ "}
            {feedback.msg}
          </p>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition " +
            (canSend
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400")
          }
        >
          {sending ? "Enviando…" : "Confirmar e enviar recibo"}
        </button>
      </div>
    </div>
  );
}

/** Converte uma entrada de texto em número (aceita vírgula decimal pt-BR). */
function parseAmount(input) {
  if (input === null || input === undefined) return NaN;
  const normalized = String(input).trim().replace(/\./g, "").replace(",", ".");
  if (normalized === "") return NaN;
  return Number(normalized);
}

function formatBRL(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Formata os dígitos digitados como moeda pt-BR "1.000,00" (sem o símbolo
 *  R$, que é exibido como prefixo fixo no input). Ex.: "100000" → "1.000,00". */
function formatCurrencyInput(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  const number = Number(digits) / 100;
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Card de pagamento de comissão "Ad Exitum".
 *  Exclusivo de advogados: ao finalizar/entrar na fase de pagamento de um
 *  processo Ad Exitum, o especialista informa o valor total do processo e o
 *  valor recebido pelo trabalhador. A plataforma calcula a comissão de 10%
 *  sobre o valor recebido e registra a intenção de pagamento no Firestore. */
function CommissionPaymentCard({ caseId, data, apoiadorId, specialistId }) {
  const [totalValue, setTotalValue] = useState("");
  const [feePercent, setFeePercent] = useState("");
  const [showFeesInfo, setShowFeesInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, msg }
  // Fluxo de pagamentos sequencial (Etapa 1 comissão -> Etapa 2 repasse).
  const [showPayments, setShowPayments] = useState(false);
  const [commissionStatus, setCommissionStatus] = useState("pendente");
  const [repasseStatus, setRepasseStatus] = useState("pendente");
  const [installmentMode, setInstallmentMode] = useState("avista"); // avista | parcelado
  const [installments, setInstallments] = useState(2);
  const effectiveSpecialistId = specialistId || apoiadorId;

  // Carrega o status de pagamento persistido no doc do caso.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveSpecialistId || !caseId) return;
      try {
        const c = await getCaseDoc(effectiveSpecialistId, caseId);
        if (cancelled || !c) return;
        setCommissionStatus(c.commissionStatus || "pendente");
        setRepasseStatus(c.repasseStatus || "pendente");
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSpecialistId, caseId]);

  const total = parseAmount(totalValue);
  const percent = parseAmount(feePercent);
  const totalValid = Number.isFinite(total) && total > 0;
  const percentValid = Number.isFinite(percent) && percent > 0 && percent <= 100;
  // Honorários do advogado = percentual informado sobre o valor da causa
  // (Valor Total do Processo). É o valor que o especialista vai receber.
  const feeAmount =
    totalValid && percentValid
      ? Math.round(total * (percent / 100) * 100) / 100
      : 0;
  // Valor que o trabalhador recebe = valor da causa − honorários do advogado.
  const workerReceives =
    totalValid && percentValid
      ? Math.round((total - feeAmount) * 100) / 100
      : 0;
  // Comissão da plataforma = faixa progressiva sobre os honorários do advogado.
  const commissionInfo =
    feeAmount > 0 ? computeAdExitumCommission(feeAmount) : { value: 0, label: "" };
  const commission = commissionInfo.value;

  const alreadyPaid = feedback?.ok === true;
  const canPay = totalValid && percentValid && !submitting && !alreadyPaid;

  const workerId =
    data?.workerUid || data?.workerId || data?.clientUid || "";
  const processId = data?.processNumber || caseId || "";

  // Etapa 1 — Comissão: registra a intenção (best-effort) e cria o checkout
  // no Mercado Pago, redirecionando para o init_point.
  const handlePayCommission = async () => {
    if (!(commission > 0) || !effectiveSpecialistId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const specialistUid = auth.currentUser?.uid || "";
      // Mantém a coleção `commissions` populada (usada no perfil do trabalhador).
      try {
        await registerAdExitumCommission({
          workerId,
          specialistId: apoiadorId,
          specialistUid,
          processId,
          totalProcessValue: total,
          receivedValue: workerReceives,
          feePercent: percent,
          feeValue: feeAmount,
          requestId: data?.requestId || data?.contactRequestId || "",
        });
      } catch {
        /* best-effort — segue para o pagamento */
      }
      const resp = await fetch(buildApiUrl("/api/criar-pagamento-comissao"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          commissionValue: commission,
          specialistId: effectiveSpecialistId,
        }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload?.init_point) {
        throw new Error(payload?.error || "Não foi possível iniciar o pagamento da comissão.");
      }
      window.location.assign(payload.init_point);
    } catch (err) {
      setFeedback({ ok: false, msg: err?.message || "Falha ao iniciar o pagamento." });
      setSubmitting(false);
    }
  };

  // Etapa 2 — Repasse: só habilitada após a comissão paga (validado também no
  // backend). Suporta à vista ou parcelado (até 12x).
  const handlePayRepasse = async () => {
    if (!(workerReceives > 0) || !effectiveSpecialistId) return;
    if (commissionStatus !== "pago") return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const resp = await fetch(buildApiUrl("/api/criar-pagamento-repasse"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          specialistId: effectiveSpecialistId,
          amount: workerReceives,
          installments: installmentMode === "parcelado" ? installments : 1,
        }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload?.init_point) {
        throw new Error(payload?.error || "Não foi possível iniciar o repasse.");
      }
      window.location.assign(payload.init_point);
    } catch (err) {
      setFeedback({ ok: false, msg: err?.message || "Falha ao iniciar o repasse." });
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    // Segurança: apenas o especialista autenticado associado ao processo pode
    // registrar a comissão. O uid vai no documento e é validado pelas rules.
    const specialistUid = auth.currentUser?.uid || "";
    if (!specialistUid) {
      setFeedback({
        ok: false,
        msg: "Sessão expirada. Faça login novamente como especialista.",
      });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await registerAdExitumCommission({
        workerId,
        specialistId: apoiadorId,
        specialistUid,
        processId,
        totalProcessValue: total,
        receivedValue: workerReceives,
        feePercent: percent,
        feeValue: feeAmount,
        requestId: data?.requestId || data?.contactRequestId || "",
      });
      setFeedback({
        ok: true,
        msg: `Comissão registrada com sucesso (${formatBRL(
          commission
        )}). Status: pendente de pagamento.`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err?.message || "Não foi possível registrar a comissão.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  // Mantido para compat: registro direto da comissão (não usado no fluxo de
  // pagamentos atual, que passa pelo Mercado Pago).
  void handleConfirm;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-amber-100 dark:border-slate-700 p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base md:text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <span aria-hidden="true">💰</span> Pagamento de comissão (Ad Exitum)
        </h2>
        <button
          type="button"
          onClick={() => setShowFeesInfo(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-200 dark:border-slate-600 text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-slate-800 transition"
          aria-label="Como a plataforma cobra?"
        >
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-current text-[10px] leading-none font-bold"
          >
            ?
          </span>
          <span className="hidden sm:inline">Como a plataforma cobra?</span>
        </button>
      </div>
      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
        Informe o valor total do processo e o percentual que você cobrou do
        cliente. A plataforma calcula automaticamente o seu recebimento
        (honorários), o valor que o trabalhador recebe e a comissão da
        plataforma sobre os seus honorários.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`commission-total-${caseId}`}
            className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
          >
            Valor Total do Processo (R$)
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
              R$
            </span>
            <input
              id={`commission-total-${caseId}`}
              type="text"
              inputMode="numeric"
              required
              value={totalValue}
              onChange={(e) => {
                setTotalValue(formatCurrencyInput(e.target.value));
                setFeedback(null);
              }}
              placeholder="1.000,00"
              className="block w-full text-sm pl-10 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={`commission-received-${caseId}`}
            className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
          >
            Valor Recebido pelo Trabalhador (R$)
          </label>
          <input
            id={`commission-received-${caseId}`}
            type="text"
            readOnly
            value={formatBRL(workerReceives)}
            className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold cursor-default"
          />
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Calculado: valor da causa − honorários.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`commission-fee-percent-${caseId}`}
            className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
          >
            Percentual cobrado do cliente (%)
          </label>
          <div className="relative mt-1">
            <input
              id={`commission-fee-percent-${caseId}`}
              type="text"
              inputMode="decimal"
              required
              value={feePercent}
              onChange={(e) => {
                setFeePercent(e.target.value.replace(/[^\d.,]/g, ""));
                setFeedback(null);
              }}
              placeholder="Ex.: 30"
              className="block w-full text-sm pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
              %
            </span>
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
            Seu recebimento (honorários)
          </label>
          <input
            type="text"
            readOnly
            value={formatBRL(feeAmount)}
            className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-bold cursor-default"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
          Comissão da Plataforma
        </label>
        <input
          type="text"
          readOnly
          value={formatBRL(commission)}
          className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold cursor-default"
        />
        {commissionInfo.label && (
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Faixa aplicada: {commissionInfo.label}
          </p>
        )}
      </div>

      {feedback && (
        <p
          className={
            "mt-3 text-sm font-semibold " +
            (feedback.ok
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-600 dark:text-red-400")
          }
        >
          {feedback.ok ? "✅ " : "⚠️ "}
          {feedback.msg}
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowPayments(true)}
        disabled={!canPay}
        className={
          "mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition " +
          (canPay
            ? "bg-amber-600 hover:bg-amber-700 text-white"
            : "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400")
        }
      >
        Fazer Pagamentos
      </button>

      {showPayments && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:px-4"
          onClick={() => !submitting && setShowPayments(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              Pagamentos do Caso
            </h3>

            {/* ── Etapa 1 — Comissão da Plataforma ── */}
            <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                  Etapa 1 — Comissão da Plataforma
                </h4>
                {commissionStatus === "pago" && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    ✓ Paga
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <span>Valor do processo</span>
                  <strong>{formatBRL(total)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Faixa aplicada</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {commissionInfo.label || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Comissão da plataforma</span>
                  <strong className="text-amber-700 dark:text-amber-300">
                    {formatBRL(commission)}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handlePayCommission}
                disabled={submitting || commissionStatus === "pago" || !(commission > 0)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {commissionStatus === "pago"
                  ? "Comissão paga"
                  : submitting
                    ? "Redirecionando…"
                    : "Confirmar e pagar comissão"}
              </button>
            </div>

            {/* ── Etapa 2 — Repasse ao Trabalhador ── */}
            <div
              className={
                "mt-4 rounded-xl border p-4 relative " +
                (commissionStatus === "pago"
                  ? "border-emerald-200 dark:border-emerald-800"
                  : "border-slate-200 dark:border-slate-700")
              }
            >
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                Etapa 2 — Repasse ao Trabalhador
              </h4>

              {commissionStatus !== "pago" ? (
                <div className="mt-3 flex flex-col items-center justify-center text-center py-6 text-slate-500 dark:text-slate-400">
                  <span className="text-2xl" aria-hidden="true">🔒</span>
                  <p className="mt-2 text-xs">
                    Disponível após confirmação do pagamento da comissão
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3">
                    <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                      Valor líquido a repassar
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatBRL(workerReceives)}
                      className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-bold cursor-default"
                    />
                  </div>
                  <div className="mt-3 flex gap-4 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="repasse-mode"
                        checked={installmentMode === "avista"}
                        onChange={() => setInstallmentMode("avista")}
                      />
                      À vista
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="repasse-mode"
                        checked={installmentMode === "parcelado"}
                        onChange={() => setInstallmentMode("parcelado")}
                      />
                      Parcelado
                    </label>
                  </div>
                  {installmentMode === "parcelado" && (
                    <div className="mt-3 grid grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                          Nº de parcelas (máx. 12)
                        </label>
                        <input
                          type="number"
                          min={2}
                          max={12}
                          value={installments}
                          onChange={(e) =>
                            setInstallments(Math.max(2, Math.min(12, Number(e.target.value) || 2)))
                          }
                          className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 pb-2">
                        {installments}x de{" "}
                        {formatBRL(
                          Math.round((workerReceives / installments) * 100) / 100
                        )}
                      </p>
                    </div>
                  )}
                  {repasseStatus === "pago" && (
                    <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      ✓ Repasse já confirmado.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handlePayRepasse}
                    disabled={submitting || !(workerReceives > 0)}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
                  >
                    {submitting ? "Redirecionando…" : "Registrar repasse"}
                  </button>
                </>
              )}
            </div>

            {feedback && !feedback.ok && (
              <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
                ⚠️ {feedback.msg}
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPayments(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold disabled:opacity-60"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeesInfo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:px-4"
          onClick={() => setShowFeesInfo(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              Tabela de Comissões — Trabalhei Lá
            </h3>

            <h4 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
              Processos Ad Exitum (honorários de êxito):
            </h4>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    <th className="text-left font-semibold px-3 py-2">
                      Faixa de honorários
                    </th>
                    <th className="text-left font-semibold px-3 py-2">
                      Comissão da plataforma
                    </th>
                  </tr>
                </thead>
                <tbody className="text-slate-600 dark:text-slate-300">
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-2">Até R$ 5.000,00</td>
                    <td className="px-3 py-2">12,5% sobre os honorários</td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-2">R$ 5.000,01 a R$ 10.000,00</td>
                    <td className="px-3 py-2">6,25% sobre os honorários</td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-2">Acima de R$ 10.000,00</td>
                    <td className="px-3 py-2">Valor fixo de R$ 750,00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
              Consultas avulsas:
            </h4>
            <ul className="mt-2 space-y-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>
                Atendimento por chat (30 min): R$ 45,00 — plataforma retém 12,5%
                = R$ 5,63
              </li>
              <li>
                Atendimento por vídeo (30 min): R$ 75,00 — plataforma retém 12,5%
                = R$ 9,38
              </li>
            </ul>

            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              A cobrança é realizada automaticamente pela plataforma no momento
              da confirmação do pagamento. O especialista recebe o valor líquido
              diretamente.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFeesInfo(false)}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Formata data/hora do Firestore Timestamp ou ISO em pt-BR curto. */
function formatDateTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

/** Card "Detalhes do Processo": editável pelo advogado, leitura para o
 *  trabalhador. Salva no Firestore e notifica o trabalhador por e-mail. */
function ProcessDetailsCard({ specialistId, caseId, realCase, specialistName }) {
  const initial = realCase?.processDetails || {};
  const [form, setForm] = useState({
    processNumber: initial.processNumber || realCase?.processNumber || "",
    court: initial.court || realCase?.court || "",
    status: initial.status || realCase?.status || PROCESS_STATUS_OPTIONS[0],
    processValue: initial.processValue ? String(initial.processValue) : "",
    nextActionText: initial.nextActionText || realCase?.nextAction || "",
    nextActionDate: initial.nextActionDate || "",
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!specialistId || !caseId) return;
      try {
        const h = await listHistory(specialistId, caseId);
        if (!cancelled) setHistory(h);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [specialistId, caseId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!specialistId || !caseId) return;
    setSaving(true);
    setMsg(null);
    try {
      const details = {
        ...form,
        processValue: Number(String(form.processValue).replace(/\./g, "").replace(",", ".")) || 0,
      };
      await saveProcessDetails(specialistId, caseId, details);
      await addHistoryEntry(
        specialistId,
        caseId,
        `Detalhes do processo atualizados. Status: ${details.status || "—"}.`
      );
      // Notifica o trabalhador (best-effort, não bloqueia o salvamento).
      try {
        const workerUid = realCase?.workerUid || realCase?.userId || "";
        if (workerUid) {
          await fetch(buildApiUrl("/api/send-contact-request"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "case-update",
              workerUid,
              specialistId,
              processStatus: details.status,
              specialistName,
            }),
          });
        }
      } catch {
        /* silencioso */
      }
      const h = await listHistory(specialistId, caseId);
      setHistory(h);
      setMsg({ ok: true, text: "Detalhes salvos e trabalhador notificado." });
    } catch (err) {
      setMsg({ ok: false, text: err?.message || "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100";
  const labelCls =
    "text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400";

  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">⚖️</span> Detalhes do Processo
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Visível para você e para o trabalhador. Apenas você pode editar.
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Número do Processo</label>
          <input className={inputCls} value={form.processNumber} onChange={set("processNumber")} placeholder="0000000-00.0000.0.00.0000" />
        </div>
        <div>
          <label className={labelCls}>Instância / Vara</label>
          <input className={inputCls} value={form.court} onChange={set("court")} placeholder="1ª Vara do Trabalho de..." />
        </div>
        <div>
          <label className={labelCls}>Status do processo</label>
          <select className={inputCls} value={form.status} onChange={set("status")}>
            {PROCESS_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Valor do processo (R$)</label>
          <input className={inputCls} inputMode="decimal" value={form.processValue} onChange={set("processValue")} placeholder="0,00" />
        </div>
        <div>
          <label className={labelCls}>Próxima ação / Prazo</label>
          <input className={inputCls} value={form.nextActionText} onChange={set("nextActionText")} placeholder="Ex.: Protocolar réplica" />
        </div>
        <div>
          <label className={labelCls}>Data do prazo</label>
          <input type="date" className={inputCls} value={form.nextActionDate} onChange={set("nextActionDate")} />
        </div>
      </div>

      {msg && (
        <p className={"mt-3 text-sm font-semibold " + (msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400")}>
          {msg.ok ? "✅ " : "⚠️ "}{msg.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar detalhes"}
      </button>

      {history.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Histórico de atualizações
          </h3>
          <ol className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3 text-sm">
                <span className="shrink-0 text-xs font-semibold text-blue-700 dark:text-blue-300 w-28">
                  {formatDateTime(h.createdAt)}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{h.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </InfoCard>
  );
}

/** Card "Minhas Anotações": notas privadas do advogado (nunca visíveis ao
 *  trabalhador — garantido pelas regras do Firestore). */
function PrivateNotesCard({ specialistId, caseId }) {
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text }

  const reload = async () => {
    if (!specialistId || !caseId) return;
    try {
      setNotes(await listPrivateNotes(specialistId, caseId));
    } catch {
      /* silencioso */
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialistId, caseId]);

  const handleAdd = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await addPrivateNote(specialistId, caseId, draft.trim());
      setDraft("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updatePrivateNote(specialistId, caseId, editing.id, editing.text);
      setEditing(null);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    setBusy(true);
    try {
      await deletePrivateNote(specialistId, caseId, id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">🔐</span> Minhas Anotações
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Visível apenas para você. O trabalhador nunca tem acesso a estas notas.
      </p>
      <textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Registre aqui informações importantes, estratégias, lembretes e observações sobre o caso…"
        className="mt-3 w-full p-3 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={busy || !draft.trim()}
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60"
      >
        Salvar anotação
      </button>

      <ul className="mt-4 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            {editing?.id === n.id ? (
              <>
                <textarea
                  rows={3}
                  value={editing.text}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                  className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={handleSaveEdit} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">Salvar</button>
                  <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold">Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{n.text}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(n.createdAt)}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing({ id: n.id, text: n.text })} className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline">Editar</button>
                    <button type="button" onClick={() => handleDelete(n.id)} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">Excluir</button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}

/** Calculadora de verbas rescisórias. */
function LaborCalculatorCard({ specialistId, caseId, onSavedToHistory }) {
  const [f, setF] = useState({ admissao: "", demissao: "", salario: "", tipoRescisao: "sem_justa_causa" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const handleCalc = () => {
    setSaved(false);
    const r = calcularVerbasRescisorias(f);
    if (!r.ok) {
      setError(r.error || "Verifique os dados.");
      setResult(null);
      return;
    }
    setError("");
    setResult(r);
  };

  const handleSaveHistory = async () => {
    if (!result) return;
    const linhas = result.itens
      .filter((it) => it.value > 0)
      .map((it) => `${it.label}: ${formatBRLUtil(it.value)}`)
      .join(" · ");
    await addHistoryEntry(
      specialistId,
      caseId,
      `Cálculo de verbas rescisórias — Total: ${formatBRLUtil(result.total)}. ${linhas}`,
      { kind: "calculo_verbas" }
    );
    setSaved(true);
    if (typeof onSavedToHistory === "function") onSavedToHistory();
  };

  const inputCls =
    "mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100";
  const labelCls =
    "text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
        🧮 Calculadora de Verbas Trabalhistas
      </h3>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Data de admissão</label>
          <input type="date" className={inputCls} value={f.admissao} onChange={set("admissao")} />
        </div>
        <div>
          <label className={labelCls}>Data de demissão</label>
          <input type="date" className={inputCls} value={f.demissao} onChange={set("demissao")} />
        </div>
        <div>
          <label className={labelCls}>Último salário (R$)</label>
          <input inputMode="decimal" className={inputCls} value={f.salario} onChange={set("salario")} placeholder="0,00" />
        </div>
        <div>
          <label className={labelCls}>Tipo de rescisão</label>
          <select className={inputCls} value={f.tipoRescisao} onChange={set("tipoRescisao")}>
            {TIPOS_RESCISAO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button type="button" onClick={handleCalc} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">
        Calcular
      </button>

      {result && (
        <div className="mt-4">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {result.itens.map((it) => (
              <li key={it.key} className="py-1.5 flex items-center justify-between gap-3">
                <span className="text-slate-600 dark:text-slate-300">{it.label}</span>
                <strong className="text-slate-800 dark:text-slate-100">{formatBRLUtil(it.value)}</strong>
              </li>
            ))}
            <li className="py-2 flex items-center justify-between gap-3">
              <span className="font-bold text-slate-800 dark:text-slate-100">Total estimado</span>
              <strong className="text-emerald-700 dark:text-emerald-300">{formatBRLUtil(result.total)}</strong>
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Estimativa simplificada. Confira conforme a CCT/ACT e verbas variáveis.
          </p>
          <button type="button" onClick={handleSaveHistory} disabled={saved} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60">
            {saved ? "Adicionado ✓" : "Adicionar ao histórico do caso"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Gerador de petição inicial (texto editável + copiar). */
function PeticaoGeneratorCard({ realCase, clientProfile }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const details = realCase?.processDetails || {};
    setText(
      gerarPeticaoInicial({
        autorNome: clientProfile?.fullName || realCase?.clientAlias || "",
        autorCpf: clientProfile?.cpf || "",
        autorEndereco: clientProfile?.address || "",
        reclamada: realCase?.companyName || "",
        vara: details.court || realCase?.court || "",
        valorCausa: details.processValue || "",
      })
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback silencioso */
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
        📝 Gerador de Petição Inicial
      </h3>
      <button type="button" onClick={handleGenerate} className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">
        Gerar rascunho
      </button>
      {text && (
        <>
          <textarea
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="mt-3 w-full p-3 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
          <button type="button" onClick={handleCopy} className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold">
            {copied ? "Copiado!" : "Copiar texto"}
          </button>
        </>
      )}
    </div>
  );
}

/** Checklist do processo com barra de progresso. */
function ChecklistCard({ specialistId, caseId, realCase }) {
  const [items, setItems] = useState(() => {
    const existing = realCase?.checklist;
    if (Array.isArray(existing) && existing.length) return existing;
    return DEFAULT_CHECKLIST_ITEMS.map((label, i) => ({ id: `chk_${i}`, label, done: false, custom: false }));
  });
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  const persist = async (next) => {
    setItems(next);
    setSaving(true);
    try {
      await saveChecklist(specialistId, caseId, next);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id) => persist(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  const remove = (id) => persist(items.filter((it) => it.id !== id));
  const add = () => {
    if (!newItem.trim()) return;
    persist([...items, { id: `chk_custom_${Date.now()}`, label: newItem.trim(), done: false, custom: true }]);
    setNewItem("");
  };

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">✅ Checklist do Processo</h3>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={it.done} onChange={() => toggle(it.id)} className="h-4 w-4" />
            <span className={"flex-1 " + (it.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200")}>{it.label}</span>
            {it.custom && (
              <button type="button" onClick={() => remove(it.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">remover</button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Adicionar item personalizado"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
        />
        <button type="button" onClick={add} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Adicionar</button>
      </div>
      {saving && <p className="mt-2 text-[11px] text-slate-400">Salvando…</p>}
    </div>
  );
}

/** Documentos do caso: upload ao Storage + controle de visibilidade. */
function CaseDocumentsCard({ specialistId, caseId }) {
  const [docs, setDocs] = useState([]);
  const [desc, setDesc] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = React.useRef(null);

  const reload = async () => {
    try {
      setDocs(await listCaseDocuments(specialistId, caseId));
    } catch {
      /* silencioso */
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialistId, caseId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await uploadCaseDocument(specialistId, caseId, file, { description: desc, visibleToWorker: visible });
      setDesc("");
      setVisible(false);
      if (fileRef.current) fileRef.current.value = "";
      await reload();
    } catch (err) {
      setError(err?.message || "Falha no upload.");
    } finally {
      setBusy(false);
    }
  };

  const toggleVisibility = async (d) => {
    await setDocumentVisibility(specialistId, caseId, d.id, !d.visibleToWorker);
    await reload();
  };
  const handleDelete = async (d) => {
    await deleteCaseDocument(specialistId, caseId, d);
    await reload();
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">📁 Documentos do Caso</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">PDF, DOC/DOCX ou imagem (até 25 MB).</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descrição do documento"
          className="text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Visível ao trabalhador
        </label>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
        onChange={handleUpload}
        disabled={busy}
        className="mt-3 block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-bold"
      />
      {busy && <p className="mt-2 text-[11px] text-slate-400">Enviando…</p>}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {docs.map((d) => (
          <li key={d.id} className="py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <a href={d.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline truncate block">
                {d.name}
              </a>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {d.description ? `${d.description} · ` : ""}{formatDateTime(d.createdAt)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => toggleVisibility(d)} className={"text-[11px] font-bold px-2 py-1 rounded-full " + (d.visibleToWorker ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>
                {d.visibleToWorker ? "Visível" : "Privado"}
              </button>
              <button type="button" onClick={() => handleDelete(d)} className="text-xs text-red-600 dark:text-red-400 hover:underline">excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Agenda de prazos com badge de alerta (≤ 3 dias). */
function DeadlinesCard({ specialistId, caseId }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ description: "", dueDate: "" });
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      setList(await listDeadlines(specialistId, caseId));
    } catch {
      /* silencioso */
    }
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialistId, caseId]);

  const add = async () => {
    if (!form.description.trim() || !form.dueDate) return;
    setBusy(true);
    try {
      await addDeadline(specialistId, caseId, form);
      setForm({ description: "", dueDate: "" });
      await reload();
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (d) => {
    await setDeadlineStatus(specialistId, caseId, d.id, d.status === "concluido" ? "pendente" : "concluido");
    await reload();
  };
  const remove = async (d) => {
    await deleteDeadline(specialistId, caseId, d.id);
    await reload();
  };

  const daysUntil = (dueDate) => {
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return null;
    return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  };

  const inputCls =
    "text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">📅 Agenda de Prazos</h3>
      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
        Um lembrete por e-mail é enviado ao advogado 3 dias antes de cada prazo.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição do prazo" className={inputCls} />
        <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
        <button type="button" onClick={add} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60">Adicionar</button>
      </div>
      <ul className="mt-4 space-y-2">
        {list.map((d) => {
          const days = daysUntil(d.dueDate);
          const urgent = d.status !== "concluido" && days !== null && days <= 3;
          return (
            <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <input type="checkbox" checked={d.status === "concluido"} onChange={() => toggle(d)} className="h-4 w-4" />
                <span className={d.status === "concluido" ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}>{d.description}</span>
                {urgent && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {days <= 0 ? "Vencido" : `${days}d`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(d.dueDate).toLocaleDateString("pt-BR")}</span>
                <button type="button" onClick={() => remove(d)} className="text-xs text-red-600 dark:text-red-400 hover:underline">excluir</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Seção "Ferramentas do Caso" — agrupa as ferramentas de produtividade. */
function CaseToolsCard({ specialistId, caseId, realCase, clientProfile }) {
  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">🛠️</span> Ferramentas do Caso
      </h2>
      <div className="mt-4 space-y-4">
        <LaborCalculatorCard specialistId={specialistId} caseId={caseId} />
        <PeticaoGeneratorCard realCase={realCase} clientProfile={clientProfile} />
        <ChecklistCard specialistId={specialistId} caseId={caseId} realCase={realCase} />
        <CaseDocumentsCard specialistId={specialistId} caseId={caseId} />
        <DeadlinesCard specialistId={specialistId} caseId={caseId} />
      </div>
    </InfoCard>
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

/** Popup (modal) que lista um conjunto de documentos. Usado pela página do
 *  caso para separar "Documentos do Cliente" e "Documentos do Processo" sem
 *  sobrecarregar a tela principal. */
function DocumentsModal({ open, onClose, title, items, emptyText }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span aria-hidden="true">📁</span> {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-2xl leading-none text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
          >
            ×
          </button>
        </div>
        {!items || items.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {emptyText || "Nenhum documento disponível ainda."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((d, idx) => (
              <li
                key={`${d.name}-${idx}`}
                className="py-2 flex items-center justify-between gap-3"
              >
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
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TimelineList({ title, items, labelKey = "event" }) {  if (!items || items.length === 0) return null;
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

/** Card com os dados pessoais do cliente, preenchidos pelo próprio
 *  trabalhador no seu perfil. Só aparece quando há dados disponíveis. */
function ClientPersonalDataCard({ client }) {
  if (!client) return null;
  const hasAny = [
    client.fullName,
    client.cpf,
    client.rg,
    client.birthDate,
    client.maritalStatus,
    client.profession,
    client.phone,
    client.address,
  ].some((v) => v && String(v).trim());
  if (!hasAny) return null;

  const fullAddress = [
    client.address,
    client.addressNumber && `nº ${client.addressNumber}`,
    client.addressComplement,
    client.neighborhood,
    client.city && client.state ? `${client.city}/${client.state}` : client.city || client.state,
    client.cep && `CEP ${client.cep}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">🪪</span> Dados pessoais do cliente
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Informações fornecidas pelo próprio trabalhador. Use-as apenas para o
        atendimento deste caso.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome completo" value={client.fullName} />
        <Field label="CPF" value={client.cpf} />
        <Field label="RG" value={client.rg} />
        <Field label="Data de nascimento" value={client.birthDate} />
        <Field label="Estado civil" value={client.maritalStatus} />
        <Field label="Profissão" value={client.profession} />
        <Field label="Telefone" value={client.phone} />
        <Field label="E-mail" value={client.email} />
        <div className="sm:col-span-2">
          <Field label="Endereço completo" value={fullAddress} />
        </div>
      </div>
    </InfoCard>
  );
}

/** Card que gera a Petição Inicial pré-preenchida com os dados do cliente.
 *  Usa o modelo /public/Petição Inicial.docx e insere automaticamente o
 *  nome, estado civil, profissão, RG, CPF e endereço do autor (cliente),
 *  poupando o advogado de redigitar a qualificação. */
function PeticaoCard({ client, clientAlias }) {
  // `busy` guarda qual documento está sendo gerado (ou "" quando ocioso), para
  // desabilitar apenas o botão clicado e exibir o rótulo "Gerando…".
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const hasData = Boolean(
    client && (client.fullName || client.cpf || client.address)
  );

  // Executa qualquer gerador de documento passando SEMPRE o mesmo objeto de
  // dados do cliente (mesma fonte usada pela procuração).
  const runDownload = async (key, fn) => {
    setError("");
    setBusy(key);
    try {
      await fn(client || {}, clientAlias);
    } catch (err) {
      setError(err?.message || "Não foi possível gerar o documento.");
    } finally {
      setBusy("");
    }
  };

  const documentos = [
    { key: "procuracao", label: "Baixar procuração (.docx)", fn: downloadProcuracao },
    { key: "contrato", label: "Baixar contrato (.docx)", fn: downloadContrato },
    { key: "declaracao", label: "Baixar declaração (.docx)", fn: downloadDeclaracao },
    { key: "termo", label: "Baixar termo de fatos (.docx)", fn: downloadTermoFatos },
  ];

  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">📄</span> Documentos jurídicos pré-preenchidos
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Gere procuração, contrato de honorários, declaração de hipossuficiência
        e termo de fatos já com a qualificação do cliente (nome, estado civil,
        profissão, RG, CPF, endereço, telefone e e-mail) preenchida
        automaticamente. Você só precisa completar as partes específicas do caso.
      </p>
      {!hasData && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          O cliente ainda não preencheu os dados pessoais no perfil. Os
          documentos serão gerados com os campos em branco para preenchimento
          manual.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {documentos.map(({ key, label, fn }) => (
          <button
            key={key}
            type="button"
            onClick={() => runDownload(key, fn)}
            disabled={Boolean(busy)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
          >
            {busy === key ? "Gerando…" : `⬇️ ${label}`}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>
      )}
    </InfoCard>
  );
}

/** Conteúdo específico por tipo de especialista. */
function CaseBody({ tipo, data, hideInlineDocs = false }) {
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
          {!hideInlineDocs && (
            <DocumentList title="Documentos do processo" items={data.documents} />
          )}
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
          {!hideInlineDocs && (
            <DocumentList title="Documentos do projeto" items={data.documents} />
          )}
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
          {!hideInlineDocs && (
            <DocumentList title="Documentos da vaga" items={data.documents} />
          )}
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
  const [apoiadorId, setApoiadorId] = useState("");
  const [specialistName, setSpecialistName] = useState("");
  // Caso real lido de /apoiadores/{apoiadorId}/cases/{caseId}. Quando existe,
  // tem prioridade sobre os dados mockados.
  const [realCase, setRealCase] = useState(null);
  // Dados pessoais do cliente (preenchidos pelo trabalhador no seu perfil).
  const [clientProfile, setClientProfile] = useState(null);
  // Documentos enviados pelo trabalhador para este caso. Ficam na subcoleção
  // /conversations/{conversationId}/documents (mesma conversa do caso), de
  // onde também são lidos no chat. Aqui aparecem como "Documentos do processo".
  const [caseDocuments, setCaseDocuments] = useState([]);
  useEffect(() => {
    let prof = {};
    try {
      prof = JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      prof = {};
    }
    const apoiadorId = prof?.apoiadorId || prof?.uid || prof?.id || "";
    setAuthorized(Boolean(apoiadorId));
    setApoiadorId(apoiadorId);
    setSpecialistName(
      prof?.nomeCompleto || prof?.name || prof?.displayName || prof?.nome || ""
    );

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

  // Busca o caso real do especialista. Quando existe, tem prioridade sobre
  // o mock (que segue servindo de demonstração quando não há caso real).
  //
  // IMPORTANTE: o caso é gravado em /apoiadores/{specialistId}/cases/{caseId},
  // onde {specialistId} é o id embutido no próprio caseId
  // (case_spec_<specialistId>__u_<workerId>). Derivamos esse id a partir do
  // caseId para ler SEMPRE do caminho correto — o `apoiadorId` do
  // localStorage pode divergir (ex.: ser o UID do Auth em vez do doc id).
  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    const convId = String(caseId).replace(/^case_/, "");
    const specialistIdFromCase =
      getSpecialistIdFromConversationId(convId) || apoiadorId;
    const workerUid = getWorkerIdFromConversationId(convId);
    (async () => {
      let found = null;
      if (specialistIdFromCase) {
        found = await getSpecialistCase(specialistIdFromCase, caseId);
        if (!cancelled) setRealCase(found);
        // Dados pessoais do cliente: preferimos o workerUid salvo no caso e,
        // como fallback, o id extraído do caseId.
        const clientUid = found?.workerUid || found?.userId || workerUid;
        if (clientUid) {
          try {
            const snap = await getDoc(doc(db, "clientProfiles", String(clientUid)));
            if (!cancelled) setClientProfile(snap.exists() ? snap.data() : null);
          } catch (err) {
            console.warn("Falha ao ler dados do cliente:", err);
          }
        }
      }
      // Documentos do trabalhador para este caso (mesma conversa do caso).
      const conversationId = found?.conversationId || convId;
      if (conversationId) {
        try {
          const docs = await listWorkerDocuments(conversationId);
          if (!cancelled) setCaseDocuments(Array.isArray(docs) ? docs : []);
        } catch (err) {
          console.warn("Falha ao ler documentos do caso:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId, caseId]);

  // `data` consumido pela interface: caso real (Firestore) tem prioridade;
  // na ausência dele, cai no mock por tipo/caseId.
  const data = useMemo(() => {
    // Documentos enviados pelo trabalhador (subcoleção da conversa),
    // normalizados para o formato { name, url } usado pela lista.
    const workerDocs = (caseDocuments || []).map((d) => ({
      name: d.name || "Documento",
      url: d.url || "#",
    }));
    if (realCase) {
      return {
        client: realCase.clientAlias || "Cliente",
        caseType: realCase.caseType || "Atendimento",
        status: realCase.status || "Ativo",
        nextAction: realCase.nextAction || "Analisar caso do cliente",
        nextActionDate: realCase.nextActionDate || "",
        processNumber: realCase.processNumber || "",
        court: realCase.court || "",
        documents: [...(realCase.documents || []), ...workerDocs],
        timeline: realCase.timeline || [],
        notes: realCase.notes || "",
        conversationId: realCase.conversationId || "",
        workerUid: realCase.workerUid || realCase.userId || "",
        workerEmail: realCase.workerEmail || "",
      };
    }
    const mock = getCaseDetails(tipo, caseId);
    if (mock && workerDocs.length) {
      return { ...mock, documents: [...(mock.documents || []), ...workerDocs] };
    }
    return mock;
  }, [realCase, tipo, caseId, caseDocuments]);
  // Caso real (Ad Exitum) habilita o conjunto completo de recursos
  // (videoconferência, documentos do processo, comissão), independentemente
  // do tipo de especialista derivado da URL.
  const isRealCase = Boolean(realCase);
  const tipoLabel = TIPO_LABELS[tipo] || TIPO_LABELS.outro;

  // Id do especialista dono do caso (derivado do caseId, igual ao effect de
  // carregamento) — usado para salvar a anamnese no caminho correto.
  const specialistIdForCase = useMemo(() => {
    const convId = String(caseId || "").replace(/^case_/, "");
    return getSpecialistIdFromConversationId(convId) || apoiadorId;
  }, [caseId, apoiadorId]);

  // Popup de documentos: "cliente" (documentos gerais do trabalhador) ou
  // "processo" (documentos específicos deste caso). null = fechado.
  const [docsModal, setDocsModal] = useState(null);

  // Documentos do Cliente: enviados pelo trabalhador marcados como gerais
  // (category === "cliente").
  const clientDocs = useMemo(
    () =>
      (caseDocuments || [])
        .filter((d) => String(d.category || "") === "cliente")
        .map((d) => ({ name: d.name || "Documento", url: d.url || "#" })),
    [caseDocuments]
  );
  // Documentos do Processo: documentos do caso (realCase) + documentos
  // enviados pelo trabalhador que não sejam "cliente".
  const processDocs = useMemo(() => {
    const worker = (caseDocuments || [])
      .filter((d) => String(d.category || "") !== "cliente")
      .map((d) => ({ name: d.name || "Documento", url: d.url || "#" }));
    return [...((realCase && realCase.documents) || []), ...worker];
  }, [caseDocuments, realCase]);

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
              {data?.client || `Caso ${caseId}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/apoiador/my-contacts")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
            >
              ← Voltar para o painel
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {data && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/chat/${encodeURIComponent(
                    data.conversationId || `case_${caseId}`
                  )}?peer=${encodeURIComponent(
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
            {isRealCase && (
              <>
                <button
                  type="button"
                  onClick={() => setDocsModal("cliente")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  🪪 Documentos do Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setDocsModal("processo")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  📁 Documentos do Processo
                </button>
              </>
            )}
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
            {(SPECIALIST_CONFIGS?.[tipo]?.canVideoConference || isRealCase) &&
              (isPremium ? (
                <VideoConferenceCard caseId={caseId} data={data} />
              ) : (
                <VideoEssencialCard caseId={caseId} navigate={navigate} />
              ))}
            <CaseBody tipo={tipo} data={data} hideInlineDocs={isRealCase} />
            {/* Em casos reais os documentos são acessados pelos popups
                "Documentos do Cliente" / "Documentos do Processo" (botões no
                topo), evitando sobrecarregar a tela principal. */}
            <ClientPersonalDataCard client={clientProfile} />
            {tipo === "psicologo" && (
              <AnamneseCard
                specialistId={specialistIdForCase}
                caseId={caseId}
                patientName={data.client}
                clientProfile={clientProfile}
                existingAnamnese={realCase?.anamnese || null}
              />
            )}
            {tipo === "advogado" && (
              <ProcessDetailsCard
                specialistId={specialistIdForCase}
                caseId={caseId}
                realCase={realCase}
                specialistName={specialistName}
              />
            )}
            {tipo === "advogado" && (
              <PrivateNotesCard
                specialistId={specialistIdForCase}
                caseId={caseId}
              />
            )}
            {tipo === "advogado" && (
              <CaseToolsCard
                specialistId={specialistIdForCase}
                caseId={caseId}
                realCase={realCase}
                clientProfile={clientProfile}
              />
            )}
            {tipo === "advogado" && (
              <PeticaoCard
                client={clientProfile}
                clientAlias={data.client}
              />
            )}
            {tipo === "advogado" && (
              <CommissionPaymentCard
                caseId={caseId}
                data={data}
                apoiadorId={apoiadorId}
                specialistId={specialistIdForCase}
              />
            )}
            <ReceiptUploadCard
              caseId={caseId}
              data={data}
              apoiadorId={apoiadorId}
              specialistName={specialistName}
            />
          </>
        )}
      </main>

      <DocumentsModal
        open={docsModal === "cliente"}
        onClose={() => setDocsModal(null)}
        title="Documentos do Cliente"
        items={clientDocs}
        emptyText="O trabalhador ainda não enviou documentos gerais do cliente."
      />
      <DocumentsModal
        open={docsModal === "processo"}
        onClose={() => setDocsModal(null)}
        title="Documentos do Processo"
        items={processDocs}
        emptyText="Nenhum documento do processo foi enviado ainda."
      />
    </div>
  );
}
