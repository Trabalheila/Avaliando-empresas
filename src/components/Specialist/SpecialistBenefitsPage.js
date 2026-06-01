// src/components/Specialist/SpecialistBenefitsPage.js
//
// Página de benefícios / comparação de planos para especialistas
// (Apoiadores). Rota: /especialista/beneficios
//
// Modelo freemium:
//   - Essencial (grátis): porta de entrada na plataforma.
//   - Premium (assinatura): solução completa, com videoconferência integrada.

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppHeader from "../AppHeader";
import PaymentInfoModal from "./PaymentInfoModal";

const GRATUITO_BENEFITS = [
  "Perfil público visível na plataforma",
  "Nome e especialidade exibidos",
  "Aparece na listagem geral de Especialistas",
  "Contato inicial exclusivo via Chat Interno da Plataforma (com restrições de conteúdo e sem troca de dados diretos)",
  "✖ Seleção de nichos de atuação",
  "✖ Destaque na listagem",
];

const ESSENCIAL_BENEFITS = [
  "Perfil profissional básico no diretório",
  "Gestão de até 5 casos ativos simultâneos",
  "Oportunidades de clientes limitadas",
  "Chat interno com restrições de conteúdo (sem links/contatos diretos)",
  "Videoconferência com limite de tempo (até 30 min/sessão, 5 sessões/mês)",
  "Acesso a recursos e ferramentas da sua profissão",
];

const PREMIUM_BENEFITS = [
  "Todos os benefícios do Plano Essencial",
  "Gestão ilimitada de casos ativos",
  "Acesso total a oportunidades de clientes",
  "Maior visibilidade no diretório de especialistas",
  "Chat interno ilimitado e com anexos",
  "Contato direto via e-mail e WhatsApp liberado no perfil (exclusivo Premium)",
  "Videoconferência ilimitada e sem restrição de tempo",
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
  const [payOpen, setPayOpen] = useState(false);

  const handleAssinarPremium = () => {
    alert(
      "Assinatura Premium em breve! Em breve você poderá assinar diretamente por aqui. Por enquanto, fale com nosso time pelo suporte."
    );
  };

  const handleAssinarEssencial = () => {
    alert(
      "Assinatura Essencial em breve! Em breve você poderá assinar diretamente por aqui. Por enquanto, fale com nosso time pelo suporte."
    );
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
            Escolha o Plano Ideal para Sua Carreira Profissional
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Você recebe 100% do valor que cobra dos seus clientes. A Trabalhei
            Lá cobra apenas uma mensalidade fixa pelo uso da plataforma.
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

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          <PlanCard
            title="Plano Gratuito"
            badge="R$ 0"
            price="R$ 0"
            priceHint="Comece a aparecer na plataforma sem custo"
            benefits={GRATUITO_BENEFITS}
            ctaLabel="Continuar no Gratuito"
            onCta={() => navigate("/apoiadores/cadastro")}
          />
          <PlanCard
            title="Plano Essencial"
            badge="🎉 Preço de Lançamento"
            price="R$ 19/mês"
            priceHint="🎉 Preço de Lançamento! Ideal para quem está começando na plataforma"
            benefits={ESSENCIAL_BENEFITS}
            ctaLabel="Assinar Plano Essencial"
            onCta={handleAssinarEssencial}
          />
          <PlanCard
            title="Plano Premium"
            badge="🎉 Preço de Lançamento"
            price="R$ 49/mês"
            priceHint="🎉 Preço de Lançamento! Solução completa para escalar sua atuação"
            benefits={PREMIUM_BENEFITS}
            ctaLabel="Assinar Plano Premium"
            onCta={handleAssinarPremium}
            highlight
          />
        </section>

        <section className="mt-8 bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            Valor médio cobrado por profissional
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            Na plataforma Trabalhei Lá, o valor médio cobrado por consulta varia
            entre <strong>R$ 100 e R$ 300</strong>, dependendo da especialidade e
            experiência do profissional. Você define seu próprio preço e recebe
            <strong> 100%</strong> desse valor — a plataforma só cobra a
            mensalidade do seu plano.
          </p>
        </section>

        <section className="mt-6 bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            Como funciona a comunicação com o cliente?
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>
              <strong>Essencial:</strong> chat interno com restrições de
              conteúdo e videoconferência até 30 min por sessão (5 sessões/mês).
            </li>
            <li>
              <strong>Premium:</strong> chat ilimitado com anexos e
              videoconferência integrada (Jitsi Meet) sem limite de tempo.
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

      <PaymentInfoModal open={payOpen} onClose={() => setPayOpen(false)} audience="specialist" />
    </div>
  );
}
