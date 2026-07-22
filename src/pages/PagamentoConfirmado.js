// src/pages/PagamentoConfirmado.js
//
// Página de retorno do Mercado Pago após o pagamento (Etapa 1 comissão ou
// Etapa 2 repasse). Confirma o pagamento no BACKEND, que consulta o status
// real no Mercado Pago antes de marcar como "pago" no Firestore.

import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { buildApiUrl } from "../utils/apiBase";

export default function PagamentoConfirmado({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, status: "", error: "" });

  const tipo = params.get("tipo") || "";
  const caseId = params.get("caseId") || "";
  const specialistId = params.get("specialistId") || "";
  // O Mercado Pago acrescenta payment_id / status na URL de retorno.
  const paymentId = params.get("payment_id") || params.get("collection_id") || "";
  const specialistType = params.get("specialistType") || "advogado";

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tipo || !caseId || !specialistId) {
        setState({ loading: false, status: "", error: "Parâmetros de retorno ausentes." });
        return;
      }
      try {
        const resp = await fetch(buildApiUrl("/api/confirmar-pagamento"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, specialistId, tipo, paymentId }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!active) return;
        if (!resp.ok) {
          setState({ loading: false, status: "", error: data?.error || "Falha ao confirmar o pagamento." });
          return;
        }
        setState({ loading: false, status: data?.status || "pendente", error: "" });
      } catch (err) {
        if (active) setState({ loading: false, status: "", error: err?.message || "Erro de rede." });
      }
    })();
    return () => {
      active = false;
    };
  }, [tipo, caseId, specialistId, paymentId]);

  const isPago = state.status === "pago";
  const voltarCaso = () =>
    navigate(`/especialista/${encodeURIComponent(specialistType)}/caso/${encodeURIComponent(caseId)}`);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Pagamento" />
      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-700 p-6 text-center">
          {state.loading ? (
            <>
              <div className="mx-auto h-10 w-10 rounded-full border-4 border-slate-200 border-t-amber-500 animate-spin" />
              <p className="mt-4 text-slate-600 dark:text-slate-300">Confirmando seu pagamento…</p>
            </>
          ) : state.error ? (
            <>
              <div className="text-4xl">⚠️</div>
              <h1 className="mt-3 text-xl font-extrabold text-slate-800 dark:text-slate-100">
                Não foi possível confirmar
              </h1>
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
            </>
          ) : isPago ? (
            <>
              <div className="text-4xl">✅</div>
              <h1 className="mt-3 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                Pagamento confirmado!
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {tipo === "comissao"
                  ? "A comissão da plataforma foi paga. A Etapa 2 (repasse ao trabalhador) já está liberada."
                  : "O repasse ao trabalhador foi registrado."}
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl">⏳</div>
              <h1 className="mt-3 text-xl font-extrabold text-slate-800 dark:text-slate-100">
                Pagamento em processamento
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Assim que o Mercado Pago confirmar, o status será atualizado no caso.
              </p>
            </>
          )}

          {!state.loading && (
            <button
              type="button"
              onClick={voltarCaso}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold"
            >
              Voltar ao caso
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
