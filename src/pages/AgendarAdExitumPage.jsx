// src/pages/AgendarAdExitumPage.jsx
//
// Tela informativa de agendamento "Ad Exitum". Diferente da consulta paga,
// o modelo Ad Exitum NÃO exige pagamento inicial: o especialista só recebe
// honorários se o caso for ganho. Esta página é o destino do botão
// "Agendar Ad Exitum" do card de especialistas (FindSpecialistPage).
//
// Rota: /agendar-ad-exitum/:specialistId
//
// O contato com o profissional acontece pelo chat da plataforma — sem
// fluxo de pagamento envolvido neste momento.

import React from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";

export default function AgendarAdExitumPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { specialistId } = useParams();

  const state = location.state || {};
  const professionalId = state.professionalId || specialistId || "";
  const professionalName = state.professionalName || "Especialista";
  const specialtyId = state.specialtyId || "outro";

  const chatHref = professionalId
    ? `/chat/spec_${encodeURIComponent(professionalId)}?peer=${encodeURIComponent(
        professionalName
      )}&peerRole=especialista&specialistType=${encodeURIComponent(
        specialtyId
      )}&adExitum=1`
    : "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Agendamento Ad Exitum" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 shadow p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            ⚖️ Ad Exitum · sem custo inicial
          </span>

          <h1 className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            Agendar com {professionalName}
          </h1>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Este especialista atende no modelo <strong>Ad Exitum</strong>: você
            <strong> não paga nada agora</strong> para iniciar o atendimento. Os
            honorários só são devidos se o caso for ganho, conforme o combinado
            diretamente com o profissional.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              R$ 0,00 — Pagamento Ad Exitum
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              Sem cobrança para agendar. Combine os detalhes dos honorários de
              êxito diretamente com o especialista pelo chat.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-2">
            {chatHref ? (
              <Link
                to={chatHref}
                className="text-center px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
              >
                💬 Iniciar conversa com o especialista
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-center px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200"
            >
              Voltar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
