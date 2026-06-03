// src/components/Worker/WorkerBenefitsPage.js
//
// Página de benefícios / planos para Trabalhadores.
// Rota: /trabalhador/beneficios

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../AppHeader";
import PaymentInfoModal from "../Specialist/PaymentInfoModal";
import { getMpPlanUrl } from "../../utils/mpSubscription";

const ESSENCIAL_BENEFITS = [
  "Busca e filtro de especialistas",
  "Chat limitado com especialistas (sem links/contatos diretos, até 5 mensagens por conversa)",
  "Acesso a recursos e ferramentas da plataforma",
];

const PREMIUM_BENEFITS = [
  "Todos os benefícios do Plano Essencial",
  "Chat ilimitado com especialistas",
  "Videoconferência integrada nos casos",
  "Acompanhamento de casos em andamento",
  "Compartilhamento seguro de documentos no chat",
];

function PlanCard({ title, badge, price, priceHint, benefits, financial, ctaLabel, onCta, highlight = false }) {
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
            <span aria-hidden="true" className={highlight ? "text-white" : "text-green-600"}>✓</span>
            <span className={highlight ? "text-blue-50" : "text-slate-700 dark:text-slate-200"}>{b}</span>
          </li>
        ))}
      </ul>

      {financial && (
        <p
          className={[
            "mt-4 text-xs font-semibold rounded-lg px-3 py-2",
            highlight
              ? "bg-white/10 text-blue-50 border border-white/20"
              : "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800",
          ].join(" ")}
        >
          💸 {financial}
        </p>
      )}

      <button
        type="button"
        onClick={onCta}
        className={[
          "mt-6 w-full px-4 py-3 rounded-xl font-bold text-sm transition",
          highlight ? "bg-white text-blue-700 hover:bg-blue-50" : "bg-blue-600 hover:bg-blue-700 text-white",
        ].join(" ")}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export default function WorkerBenefitsPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [payOpen, setPayOpen] = useState(false);

  const handleAssinarPremium = () => {
    const url = getMpPlanUrl("worker", "premium");
    if (url) {
      window.location.assign(url);
      return;
    }
    alert(
      "Assinatura Premium em breve! Em breve você poderá assinar diretamente por aqui. Por enquanto, fale com nosso time pelo suporte."
    );
  };

  const handleEssencial = () => {
    navigate("/trabalhador/encontrar-especialista");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Planos para Trabalhadores" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <header className="text-center mb-8">
          <p className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
            Planos
          </p>
          <h1 className="mt-1 text-2xl sm:text-4xl font-extrabold text-slate-800 dark:text-slate-100">
            Encontre o Suporte Ideal para Sua Jornada Profissional
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Comece grátis e evolua para o Premium quando quiser desbloquear
            videoconferência, chat ilimitado e créditos de consultas.
          </p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
            >
              Como funciona o pagamento?
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PlanCard
            title="Plano Essencial"
            badge="Grátis"
            price="R$ 0"
            priceHint="Ideal para uma orientação pontual"
            benefits={ESSENCIAL_BENEFITS}
            financial="Desconto exclusivo na primeira consulta com especialistas Essenciais."
            ctaLabel="Continuar no Essencial"
            onCta={handleEssencial}
          />
          <PlanCard
            title="Plano Premium"
            badge="Recomendado"
            price="R$ 29/mês"
            priceHint="Suporte contínuo e especializado"
            benefits={PREMIUM_BENEFITS}
            financial="Inclui 2 consultas gratuitas por mês com especialistas Premium (ou crédito equivalente)."
            ctaLabel="Assinar Plano Premium"
            onCta={handleAssinarPremium}
            highlight
          />
        </section>

        <section className="mt-8 bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            Como funciona a comunicação com o especialista?
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>
              <strong>Essencial:</strong> chat de texto com restrições de
              conteúdo (sem trocas de email/telefone/links) e limite de
              mensagens por conversa.
            </li>
            <li>
              <strong>Premium:</strong> chat ilimitado, videoconferência
              integrada e compartilhamento seguro de documentos no chat.
            </li>
          </ul>
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Ao assinar, você concorda com os{" "}
          <Link to="/termos" className="underline">Termos de Serviço</Link>, incluindo as regras anti-desintermediação.
        </p>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>
      </main>

      <PaymentInfoModal open={payOpen} onClose={() => setPayOpen(false)} audience="worker" />
    </div>
  );
}
