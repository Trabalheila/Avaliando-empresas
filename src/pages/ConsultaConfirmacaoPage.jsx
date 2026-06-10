// src/pages/ConsultaConfirmacaoPage.jsx
//
// Tela de confirmação dedicada do pagamento de Consulta Avulsa.
// É o destino das `back_urls` do Checkout Pro do Mercado Pago. O Mercado
// Pago redireciona o navegador para cá após o pagamento e anexa parâmetros
// próprios (status, collection_status, payment_id, external_reference, ...).
//
// IMPORTANTE: esta tela é apenas informativa. A confirmação financeira
// definitiva e o registro da consulta acontecem no webhook do servidor
// (api/webhook.js) após a aprovação real — nunca aqui no cliente.

import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";

/* Normaliza o status vindo da query (nosso `status` + os do Mercado Pago). */
function resolveStatus(searchParams) {
  const raw = (
    searchParams.get("status") ||
    searchParams.get("collection_status") ||
    ""
  )
    .toString()
    .toLowerCase()
    .trim();

  if (["success", "approved"].includes(raw)) return "success";
  if (["failure", "rejected", "cancelled", "null"].includes(raw)) return "failure";
  if (["pending", "in_process", "in_mediation"].includes(raw)) return "pending";
  // Sem status reconhecível: trata como pendente (aguardando webhook).
  return "pending";
}

const STATUS_CONFIG = {
  success: {
    badge: "Pagamento aprovado",
    emoji: "✅",
    title: "Pagamento confirmado",
    accent: "emerald",
    description:
      "Seu pagamento foi aprovado e sua solicitação de consulta foi enviada ao profissional. Você será avisado assim que ele aceitar ou recusar.",
  },
  pending: {
    badge: "Pagamento em processamento",
    emoji: "⏳",
    title: "Pagamento em análise",
    accent: "amber",
    description:
      "Seu pagamento está sendo processado pelo Mercado Pago. Assim que for aprovado, sua solicitação será enviada automaticamente ao profissional. Isso pode levar alguns instantes.",
  },
  failure: {
    badge: "Pagamento não concluído",
    emoji: "❌",
    title: "Não foi possível concluir o pagamento",
    accent: "red",
    description:
      "O pagamento não foi aprovado e nenhuma cobrança foi efetuada. Você pode tentar novamente ou escolher outra forma de pagamento.",
  },
};

const ACCENT_CLASSES = {
  emerald: {
    badge: "text-emerald-700 dark:text-emerald-300",
    title: "text-emerald-700 dark:text-emerald-300",
    ring: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
  },
  amber: {
    badge: "text-amber-700 dark:text-amber-300",
    title: "text-amber-700 dark:text-amber-300",
    ring: "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
  },
  red: {
    badge: "text-red-700 dark:text-red-300",
    title: "text-red-700 dark:text-red-300",
    ring: "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800",
  },
};

export default function ConsultaConfirmacaoPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const status = useMemo(() => resolveStatus(searchParams), [searchParams]);
  const config = STATUS_CONFIG[status];
  const accent = ACCENT_CLASSES[config.accent];

  // Identificador do pagamento informado pelo Mercado Pago (apenas exibição).
  const paymentId =
    searchParams.get("payment_id") || searchParams.get("collection_id") || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Confirmação da consulta" />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-6 sm:p-8 text-center">
          <span className="text-5xl" aria-hidden="true">
            {config.emoji}
          </span>

          <p
            className={`mt-4 text-[11px] uppercase tracking-widest font-bold ${accent.badge}`}
          >
            {config.badge}
          </p>
          <h1 className={`mt-1 text-2xl sm:text-3xl font-extrabold ${accent.title}`}>
            {config.title}
          </h1>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
            {config.description}
          </p>

          {status !== "failure" && (
            <div
              className={`mt-5 flex items-start gap-2 rounded-xl border p-3 text-left ${accent.ring}`}
            >
              <span aria-hidden="true">🔒</span>
              <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                A confirmação final é feita automaticamente pelo Mercado Pago. O
                valor só é liberado ao profissional após a conclusão do
                atendimento.
              </p>
            </div>
          )}

          {paymentId && (
            <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
              Código do pagamento: <span className="font-mono">{paymentId}</span>
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-center">
            {status === "failure" ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/my-contacts")}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Ir para minhas consultas
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/consulta-avulsa")}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Tentar novamente
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/consulta-avulsa")}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Nova consulta
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/my-contacts")}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Ver minhas consultas
                </button>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
