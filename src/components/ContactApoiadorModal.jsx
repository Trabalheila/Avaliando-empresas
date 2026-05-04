import React, { useState, useCallback } from "react";
import {
  consumeCompanyContactCredit,
  createApoiadorContactRequest,
} from "../services/contactRequests";

/**
 * ContactApoiadorModal
 * --------------------------------------------------------------
 * Exibido quando uma empresa Premium clica em "Contactar Apoiador
 * Premium" / "Entrar em contato" com um Apoiador. Consome 1
 * crédito (companies/{id}.contactCredits) e persiste em
 * `contactRequestsApoiador`.
 *
 * Props:
 *   open               boolean
 *   onClose            () => void
 *   onSent             () => void
 *   companyId          string
 *   companyName        string
 *   fromUid            string  (uid do gestor da empresa)
 *   apoiadorId         string
 *   apoiadorName       string
 */
export default function ContactApoiadorModal({
  open,
  onClose,
  onSent,
  companyId,
  companyName,
  fromUid,
  apoiadorId,
  apoiadorName,
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsCredits, setNeedsCredits] = useState(false);

  const handleSend = useCallback(async () => {
    if (!message.trim()) {
      setError("Escreva uma mensagem para enviar.");
      return;
    }
    if (!companyId || !apoiadorId) {
      setError("Sessão inválida. Recarregue a página e tente novamente.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await consumeCompanyContactCredit(companyId);
      await createApoiadorContactRequest({
        fromCompanyId: companyId,
        fromCompanyName: companyName,
        fromUid,
        toApoiadorId: apoiadorId,
        toApoiadorName: apoiadorName,
        message: message.trim(),
      });
      setSuccess(true);
      if (typeof onSent === "function") onSent();
    } catch (err) {
      if (err?.code === "NO_CREDITS" || err?.message === "NO_CREDITS") {
        setNeedsCredits(true);
      } else {
        console.error("Falha ao enviar pedido de contato:", err);
        setError("Não foi possível enviar a mensagem. Tente novamente.");
      }
    } finally {
      setSending(false);
    }
  }, [message, companyId, companyName, fromUid, apoiadorId, apoiadorName, onSent]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Entrar em contato com apoiador"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 14,
          backgroundColor: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 24px 48px rgba(2, 6, 23, 0.28)",
          padding: "20px 22px",
        }}
        className="dark:!bg-slate-900 dark:!text-slate-100"
      >
        <h2
          style={{ margin: 0, fontSize: 18, fontWeight: 800 }}
          className="text-emerald-700 dark:text-emerald-300"
        >
          💬 Contactar {apoiadorName || "Apoiador Premium"}
        </h2>

        {success ? (
          <div className="mt-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg px-3 py-2">
              ✅ Mensagem enviada! O apoiador será notificado e poderá responder
              através da plataforma.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : needsCredits ? (
          <div className="mt-4">
            <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
              Sua empresa não possui mais créditos de contato no plano Premium.
              Adquira mais créditos para continuar contactando apoiadores.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold"
              >
                Cancelar
              </button>
              <a
                href="/apoiadores"
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold"
              >
                Comprar créditos
              </a>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              A plataforma intermedia o contato. Cada envio consome 1 crédito de
              contato do plano Premium da sua empresa.
            </p>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-4 mb-1">
              Mensagem inicial
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Apresente brevemente sua empresa, o motivo do contato e qual o apoio desejado."
              rows={6}
              maxLength={2000}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">{message.length}/2000</p>
            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
              >
                {sending ? "Enviando…" : "Enviar mensagem"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
