// src/components/Specialist/SpecialistBenefitsPage.js
//
// Página de benefícios / comparação de planos para especialistas
// (Apoiadores). Rota: /especialista/beneficios
//
// Modelo freemium:
//   - Essencial (grátis): porta de entrada na plataforma.
//   - Premium (assinatura): solução completa, com videoconferência integrada.

import React from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../AppHeader";

const ESSENCIAL_BENEFITS = [
  "Criação de perfil básico no diretório",
  "Acesso a recursos e ferramentas (biblioteca de links da sua profissão)",
  "Gestão de até 3 casos ativos simultâneos",
  "Visualização de oportunidades de clientes (sem contato direto)",
  "Comunicação via chat de texto com clientes",
  "Histórico de casos e reputação pública",
];

const PREMIUM_BENEFITS = [
  "Todos os benefícios do Plano Essencial",
  "Gestão ilimitada de casos ativos",
  "Acesso total às oportunidades de clientes, com contato direto",
  "Maior visibilidade no diretório de especialistas",
  "Videoconferência integrada para atendimentos (sem limites)",
  "Relatórios de desempenho e métricas de atendimento",
  "Suporte prioritário",
];

function PlanCard({
  title,
  badge,
  price,
  priceHint,
  benefits,
  ctaLabel,
  onCta,
  highlight = false,
}) {
  return (
    <div
      className={[
        "flex flex-col rounded-2xl shadow-lg border p-6 sm:p-7",
        highlight
          ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-700"
          : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-blue-100 dark:border-slate-700",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-extrabold">{title}</h2>
        {badge && (
          <span
            className={[
              "text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full",
              highlight ? "bg-white text-blue-700" : "bg-blue-100 text-blue-700",
            ].join(" ")}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className={highlight ? "text-3xl font-extrabold" : "text-3xl font-extrabold text-blue-700 dark:text-blue-300"}>
          {price}
        </p>
        {priceHint && (
          <p className={highlight ? "text-xs text-blue-100 mt-1" : "text-xs text-slate-500 dark:text-slate-400 mt-1"}>
            {priceHint}
          </p>
        )}
      </div>

      <ul className="mt-5 space-y-2 text-sm flex-1">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span aria-hidden="true" className={highlight ? "text-white" : "text-green-600"}>
              ✓
            </span>
            <span className={highlight ? "text-blue-50" : "text-slate-700 dark:text-slate-200"}>
              {b}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCta}
        className={[
          "mt-6 w-full px-4 py-3 rounded-xl font-bold text-sm transition",
          highlight
            ? "bg-white text-blue-700 hover:bg-blue-50"
            : "bg-blue-600 hover:bg-blue-700 text-white",
        ].join(" ")}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default function SpecialistBenefitsPage({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const handleAssinarPremium = () => {
    // Stub: futura integração com checkout (Stripe / pagamento).
    alert(
      "Assinatura Premium em breve! Em breve você poderá assinar diretamente por aqui. Por enquanto, fale com nosso time pelo suporte."
    );
  };

  const handleEssencial = () => {
    navigate("/apoiador/my-contacts");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Planos para Especialistas" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <header className="text-center mb-8">
          <p className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
            Planos
          </p>
          <h1 className="mt-1 text-2xl sm:text-4xl font-extrabold text-slate-800 dark:text-slate-100">
            Escolha o plano ideal para você
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Comece grátis no plano Essencial e evolua para o Premium quando
            quiser desbloquear videoconferência, contato direto com clientes e
            mais visibilidade no diretório.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PlanCard
            title="Plano Essencial"
            badge="Grátis"
            price="R$ 0"
            priceHint="Sem cartão de crédito"
            benefits={ESSENCIAL_BENEFITS}
            ctaLabel="Continuar no Essencial"
            onCta={handleEssencial}
          />
          <PlanCard
            title="Plano Premium"
            badge="Recomendado"
            price="R$ 49/mês"
            priceHint="Cancele quando quiser"
            benefits={PREMIUM_BENEFITS}
            ctaLabel="Assinar Plano Premium"
            onCta={handleAssinarPremium}
            highlight
          />
        </section>

        <section className="mt-8 bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            Como funciona a comunicação com o cliente?
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>
              <strong>Essencial:</strong> chat de texto integrado para alinhar
              expectativas com clientes ou pacientes.
            </li>
            <li>
              <strong>Premium:</strong> chat + videoconferência integrada (Jitsi
              Meet) disponível em cada caso, com link único e seguro.
            </li>
          </ul>
        </section>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>
      </main>
    </div>
  );
}
