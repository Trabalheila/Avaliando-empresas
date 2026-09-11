// src/components/Worker/WorkerDocumentCard.js
//
// Card exibido para o TRABALHADOR com um documento enviado pelo especialista
// para assinatura via Gov.br. Permite abrir a tela de assinatura
// (DocumentSignaturePage, via clientAccessLink) e, após assinar no Gov.br,
// enviar o arquivo assinado de volta para o especialista.

import React, { useState } from "react";
import { auth } from "../../firebase";
import { buildClientAccessLink, uploadSignedDocument, friendlyStorageErrorMessage } from "../../services/documentSignature";

const STATUS_LABELS = {
  pending: "Pendente de Assinatura",
  awaiting_signature: "Aguardando Gov.br",
  signed: "Assinado",
  rejected: "Recusado",
};

function StatusBadge({ status }) {
  const isSigned = status === "signed";
  const cls = isSigned
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {STATUS_LABELS[status] || status || "Pendente"}
    </span>
  );
}

/**
 * @param {object} props
 * @param {object} props.document Documento vindo do Firestore (com id, specialistId, caseId,
 *   documentTitle, status, clientAccessToken/clientAccessLink, signedUrl).
 * @param {() => void} [props.onUploaded] Chamado após o upload do documento assinado ser concluído.
 */
export default function WorkerDocumentCard({ document, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!document) return null;

  const accessLink = document.clientAccessLink || buildClientAccessLink(document.clientAccessToken);
  const isSigned = document.status === "signed";

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione o arquivo assinado (PDF ou DOCX) para enviar.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      await uploadSignedDocument(document.specialistId, document.caseId, document.id, {
        file,
        workerUid: auth.currentUser?.uid,
      });
      setSuccess(true);
      setFile(null);
      onUploaded?.();
    } catch (err) {
      setError(friendlyStorageErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span aria-hidden="true">🔏</span> {document.documentTitle}
        </h3>
        <StatusBadge status={document.status} />
      </div>

      {accessLink && (
        <a
          href={accessLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
        >
          Visualizar e Assinar
        </a>
      )}

      {!isSigned && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Enviar Documento Assinado
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Após assinar no Gov.br, baixe o arquivo e envie aqui para concluir.
          </p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setSuccess(false); }}
            className="mt-2 w-full text-sm text-slate-700 dark:text-slate-200"
          />
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          {success && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              Documento assinado enviado com sucesso!
            </p>
          )}
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold"
          >
            {uploading ? "Enviando…" : "Enviar"}
          </button>
        </div>
      )}

      {isSigned && document.signedUrl && (
        <a
          href={document.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
        >
          Baixar documento assinado
        </a>
      )}
    </div>
  );
}
