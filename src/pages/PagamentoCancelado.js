// src/pages/PagamentoCancelado.js
//
// Página exibida quando o pagamento no Mercado Pago não é concluído
// (cancelado ou falho). Não altera nenhum status no Firestore.

import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";

export default function PagamentoCancelado({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const caseId = params.get("caseId") || "";
  const specialistType = params.get("specialistType") || "advogado";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Pagamento" />
      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-700 p-6 text-center">
          <div className="text-4xl">🚫</div>
          <h1 className="mt-3 text-xl font-extrabold text-slate-800 dark:text-slate-100">
            Pagamento não concluído
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Seu pagamento foi cancelado ou não pôde ser processado. Nenhum valor
            foi cobrado. Você pode tentar novamente quando quiser.
          </p>
          <button
            type="button"
            onClick={() =>
              caseId
                ? navigate(`/especialista/${encodeURIComponent(specialistType)}/caso/${encodeURIComponent(caseId)}`)
                : navigate(-1)
            }
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold"
          >
            Voltar
          </button>
        </div>
      </main>
    </div>
  );
}
