// src/pages/ConsultaEspecializadaDetalhesPage.jsx
//
// Página de detalhes da "Consulta Especializada" (atendimento premium
// diferenciado), acessada ao clicar em "Agendar Consulta Comum" no card de um
// especialista Premium (FindSpecialistPage).
//
// Rota: /consulta-especializada-detalhes/:specialistId
//
// Mostra o profissional, o valor da consulta especializada e o que está
// incluído, e encaminha para o fluxo de pagamento (`/pagamento-consulta`).
//
// Pós-pagamento: a confirmação real do pagamento acontece no backend
// (webhook do Mercado Pago). É lá que ocorrem (a) o split de pagamento —
// retenção da taxa da plataforma e repasse ao Mercado Pago do especialista —
// e (b) o envio do e-mail ao profissional com os dados de acesso. Esta página
// apenas inicia o fluxo enviando `consultationType: "especializada"` no estado.

import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";

function formatBRL(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

const INCLUDED_FEATURES = [
  "Atendimento individual e aprofundado com o especialista.",
  "Análise detalhada do seu caso, com orientações personalizadas.",
  "Acesso ao histórico da conversa e aos documentos compartilhados.",
  "Acompanhamento por chat após a consulta para dúvidas pontuais.",
  "Suporte prioritário da plataforma durante todo o atendimento.",
];

export default function ConsultaEspecializadaDetalhesPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { specialistId } = useParams();

  const state = location.state || {};
  const professionalId = state.professionalId || specialistId || "";
  const professionalName = state.professionalName || "Especialista";
  const professionalPhoto = state.professionalPhoto || "";
  const specialtyId = state.specialtyId || "outro";
  const price = Number(state.precoConsultaEspecializada || 0);

  const initials =
    (professionalName || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const handlePay = () => {
    navigate("/pagamento-consulta", {
      state: {
        professionalId,
        professionalName,
        specialtyId,
        consultationPrice: price,
        originalAmount: price,
        modalidade: "chat",
        planoTipo: "premium",
        consultationType: "especializada",
        fromScheduling: true,
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Consulta Especializada" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
        >
          ← Voltar
        </button>

        <div className="mt-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 shadow p-6">
          {/* Cabeçalho do especialista */}
          <div className="flex items-center gap-4">
            {professionalPhoto ? (
              <img
                src={professionalPhoto}
                alt={professionalName}
                className="w-16 h-16 rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xl font-bold">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <span className="inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                🌟 Consulta Especializada
              </span>
              <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {professionalName}
              </h1>
            </div>
          </div>

          {/* Valor */}
          <div className="mt-6 rounded-xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Valor da consulta
            </p>
            <p className="mt-1 text-3xl font-extrabold text-amber-700 dark:text-amber-300">
              {price > 0 ? formatBRL(price) : "Sob consulta"}
            </p>
          </div>

          {/* Como funciona */}
          <div className="mt-6">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Como funciona este atendimento
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              A Consulta Especializada é um atendimento premium diferenciado, em
              que o especialista dedica tempo e atenção exclusivos ao seu caso.
              Veja tudo o que está incluído:
            </p>
            <ul className="mt-3 space-y-2">
              {INCLUDED_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <span className="mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                    ✓
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pagar */}
          <button
            type="button"
            onClick={handlePay}
            disabled={price <= 0}
            className={[
              "mt-8 w-full px-4 py-3 rounded-xl text-white text-sm font-bold transition",
              price <= 0
                ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-amber-500 hover:bg-amber-600",
            ].join(" ")}
          >
            {price > 0 ? `Agendar e pagar ${formatBRL(price)}` : "Valor não definido pelo especialista"}
          </button>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            O pagamento é processado com segurança pelo Mercado Pago. A
            plataforma retém uma taxa operacional e o restante é repassado ao
            especialista.
          </p>
        </div>
      </main>
    </div>
  );
}
