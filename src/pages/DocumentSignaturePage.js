// src/pages/DocumentSignaturePage.js
//
// Página pública (sem exigir login) acessada pelo cliente através do
// `clientAccessLink` enviado por e-mail/notificação quando um especialista
// envia um documento para assinatura. Fluxo:
//   1) A rota carrega o token a partir da URL (/assinatura/:token) e busca
//      os dados do documento via services/documentSignature.js.
//   2) Cliente visualiza o documento original (embutido quando for PDF).
//   3) Cliente clica em "Assinar via Gov.br" -> redireciona para o Gov.br.
//   4) Gov.br redireciona de volta para api/documents/govbr-callback, que
//      atualiza o status e redireciona para esta mesma página com
//      ?status=signed.

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { getDocumentByAccessToken, startGovBrSignature } from "../services/documentSignature";

const STATUS_LABELS = {
  pending: "Pendente de assinatura",
  awaiting_signature: "Aguardando confirmação do Gov.br",
  signed: "Assinado",
  rejected: "Recusado",
};

/** Heurística simples: a URL do documento (Storage) termina em .pdf antes da query string. */
function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(String(url || ""));
}

export default function DocumentSignaturePage({ theme, toggleTheme }) {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const callbackStatus = searchParams.get("status");

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const document = await getDocumentByAccessToken(token);
        if (!cancelled) setDoc(document);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Não foi possível carregar o documento. Tente novamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSignWithGovBr = async () => {
    setSigning(true);
    setError("");
    try {
      const redirectUrl = await startGovBrSignature(token);
      // Redireciona o cliente para o fluxo de assinatura do Gov.br.
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err?.message || "Não foi possível iniciar a assinatura via Gov.br. Tente novamente.");
      setSigning(false);
    }
  };

  const effectiveStatus = callbackStatus === "signed" ? "signed" : doc?.status;
  const isSigned = effectiveStatus === "signed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Assinatura de Documento" />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow p-6">
          {loading && (
            <p className="text-sm text-slate-600 dark:text-slate-300">Carregando documento…</p>
          )}

          {!loading && error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {!loading && !error && doc && (
            <>
              <h1 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                {doc.documentTitle}
              </h1>
              <p className="mt-1 text-sm font-semibold text-blue-700 dark:text-blue-300">
                Status: {STATUS_LABELS[effectiveStatus] || effectiveStatus}
              </p>

              {isPdfUrl(doc.originalUrl) ? (
                <iframe
                  src={doc.originalUrl}
                  title={doc.documentTitle}
                  className="mt-4 w-full h-[60vh] rounded-lg border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <a
                  href={doc.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  📄 Visualizar documento
                </a>
              )}

              {isSigned ? (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                    ✅ Documento assinado com sucesso!
                  </p>
                  {doc.signedUrl && (
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                    >
                      ⬇️ Baixar Documento Assinado
                    </a>
                  )}
                </div>
              ) : (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleSignWithGovBr}
                    disabled={signing}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold"
                  >
                    {signing ? "Redirecionando…" : "🔏 Assinar via Gov.br"}
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Você será redirecionado ao Gov.br para concluir a assinatura eletrônica.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
