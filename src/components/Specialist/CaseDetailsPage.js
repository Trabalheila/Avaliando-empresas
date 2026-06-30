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
import { downloadPeticao } from "../../utils/peticaoDocument";
import {
  getSpecialistIdFromConversationId,
  getWorkerIdFromConversationId,
} from "../../utils/chatId";
import {
  COMMISSION_RATE,
  computeCommission,
  registerAdExitumCommission,
} from "../../services/commissions";
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

/** Card de pagamento de comissão "Ad Exitum".
 *  Exclusivo de advogados: ao finalizar/entrar na fase de pagamento de um
 *  processo Ad Exitum, o especialista informa o valor total do processo e o
 *  valor recebido pelo trabalhador. A plataforma calcula a comissão de 10%
 *  sobre o valor recebido e registra a intenção de pagamento no Firestore. */
function CommissionPaymentCard({ caseId, data, apoiadorId }) {
  const [totalValue, setTotalValue] = useState("");
  const [receivedValue, setReceivedValue] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, msg }

  const total = parseAmount(totalValue);
  const received = parseAmount(receivedValue);
  const totalValid = Number.isFinite(total) && total > 0;
  const receivedValid = Number.isFinite(received) && received > 0;
  const commission = receivedValid ? computeCommission(received) : 0;

  const alreadyPaid = feedback?.ok === true;
  const canPay = totalValid && receivedValid && !submitting && !alreadyPaid;

  const workerId =
    data?.workerUid || data?.workerId || data?.clientUid || "";
  const processId = data?.processNumber || caseId || "";

  const handleConfirm = async () => {
    // Segurança: apenas o especialista autenticado associado ao processo pode
    // registrar a comissão. O uid vai no documento e é validado pelas rules.
    const specialistUid = auth.currentUser?.uid || "";
    if (!specialistUid) {
      setShowConfirm(false);
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
        receivedValue: received,
        requestId: data?.requestId || data?.contactRequestId || "",
      });
      setShowConfirm(false);
      setFeedback({
        ok: true,
        msg: `Comissão registrada com sucesso (${formatBRL(
          commission
        )}). Status: pendente de pagamento.`,
      });
    } catch (err) {
      setShowConfirm(false);
      setFeedback({
        ok: false,
        msg: err?.message || "Não foi possível registrar a comissão.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-amber-100 dark:border-slate-700 p-5">
      <h2 className="text-base md:text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
        <span aria-hidden="true">💰</span> Pagamento de comissão (Ad Exitum)
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
        Informe o valor total do processo e o valor recebido pelo trabalhador.
        A plataforma calcula automaticamente a comissão de{" "}
        {Math.round(COMMISSION_RATE * 100)}% sobre o valor recebido.
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`commission-total-${caseId}`}
            className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400"
          >
            Valor Total do Processo (R$)
          </label>
          <input
            id={`commission-total-${caseId}`}
            type="text"
            inputMode="decimal"
            required
            value={totalValue}
            onChange={(e) => {
              setTotalValue(e.target.value.replace(/[^\d.,]/g, ""));
              setFeedback(null);
            }}
            placeholder="0,00"
            className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
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
            inputMode="decimal"
            required
            value={receivedValue}
            onChange={(e) => {
              setReceivedValue(e.target.value.replace(/[^\d.,]/g, ""));
              setFeedback(null);
            }}
            placeholder="0,00"
            className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
          Comissão da Plataforma ({Math.round(COMMISSION_RATE * 100)}%)
        </label>
        <input
          type="text"
          readOnly
          value={formatBRL(commission)}
          className="mt-1 block w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 font-bold cursor-default"
        />
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
        onClick={() => setShowConfirm(true)}
        disabled={!canPay}
        className={
          "mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition " +
          (canPay
            ? "bg-amber-600 hover:bg-amber-700 text-white"
            : "bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400")
        }
      >
        Pagar Comissão à Plataforma
      </button>

      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:px-4"
          onClick={() => !submitting && setShowConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              Confirmar pagamento de comissão
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span>Valor recebido pelo trabalhador</span>
                <strong>{formatBRL(received)}</strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Comissão da Plataforma ({Math.round(COMMISSION_RATE * 100)}%)</span>
                <strong className="text-amber-700 dark:text-amber-300">
                  {formatBRL(commission)}
                </strong>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Ao confirmar, registramos a intenção de pagamento da comissão. O
              status ficará como <strong>pendente</strong> até a quitação.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {submitting ? "Registrando…" : "Confirmar pagamento"}
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

// Tipos cujo CaseBody já renderiza uma lista a partir de `data.documents`
// (evita duplicar a seção "Documentos do processo" em casos reais).
const CASEBODY_RENDERS_DOCS = new Set(["advogado", "consultor_rh", "recrutador"]);

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasData = Boolean(
    client && (client.fullName || client.cpf || client.address)
  );

  const handleDownload = async () => {
    setError("");
    setBusy(true);
    try {
      await downloadPeticao(client || {}, clientAlias);
    } catch (err) {
      setError(err?.message || "Não foi possível gerar a petição.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <InfoCard>
      <h2 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">📄</span> Petição inicial pré-preenchida
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Gere a petição já com a qualificação do autor (nome, estado civil,
        profissão, RG, CPF e endereço) preenchida automaticamente a partir dos
        dados do cliente. Você só precisa completar os fatos, o direito e os
        pedidos.
      </p>
      {!hasData && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          O cliente ainda não preencheu os dados pessoais no perfil. A petição
          será gerada com os campos em branco para preenchimento manual.
        </p>
      )}
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
      >
        {busy ? "Gerando…" : "⬇️ Baixar petição (.docx)"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>
      )}
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
            <CaseBody tipo={tipo} data={data} />
            {/* Em casos reais o CaseBody "default" não lista documentos;
                renderizamos aqui os documentos enviados pelo trabalhador. */}
            {isRealCase && !CASEBODY_RENDERS_DOCS.has(tipo) && (
              <DocumentList
                title="Documentos do processo"
                items={data.documents}
              />
            )}
            <ClientPersonalDataCard client={clientProfile} />
            {(tipo === "advogado" || isRealCase) && (
              <PeticaoCard
                client={clientProfile}
                clientAlias={data.client}
              />
            )}
            {(tipo === "advogado" || isRealCase) && (
              <CommissionPaymentCard
                caseId={caseId}
                data={data}
                apoiadorId={apoiadorId}
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
    </div>
  );
}
