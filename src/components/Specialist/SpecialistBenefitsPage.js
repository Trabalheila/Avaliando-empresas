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
import { auth, db } from "../../firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getMpPlanUrl } from "../../utils/mpSubscription";
import { handleCheckout } from "../../services/billing";

const GRATUITO_BENEFITS = [
  { included: true, label: "Perfil público visível na plataforma" },
  { included: true, label: "Nome e especialidade exibidos" },
  { included: true, label: "Aparece na listagem geral de Especialistas" },
  {
    included: true,
    label:
      "Contato inicial exclusivo via Chat Interno da Plataforma (apenas para primeiras interações, sem troca de dados diretos ou gestão de casos)",
  },
  {
    included: true,
    label:
      "Visualização de tendências gerais de busca por especialistas na sua área (dados agregados e sem detalhes específicos)",
  },
  {
    included: true,
    label:
      "Acesso a indicadores básicos de demanda por sua especialidade e localização",
  },
  {
    included: true,
    label: "Dashboard com informações introdutórias sobre o mercado",
  },
  { included: false, label: "Seleção de nichos de atuação" },
  { included: false, label: "Destaque na listagem" },
  {
    included: false,
    label: "Gestão ativa de casos ou prospecção direta de clientes",
  },
];

const ESSENCIAL_BENEFITS = [
  { included: true, label: "Perfil profissional básico no diretório" },
  { included: true, label: "Gestão de até 5 casos ativos simultâneos" },
  {
    included: true,
    label:
      "Recebimento de oportunidades de clientes qualificadas (limitadas por volume ou tipo)",
  },
  {
    included: true,
    label:
      "Chat interno para gestão de até 5 casos ativos (com restrições de conteúdo e sem troca de dados diretos)",
  },
  {
    included: true,
    label:
      "Videoconferência com limite de tempo (até 30 min/sessão, 5 sessões/mês)",
  },
  { included: true, label: "Acesso a recursos e ferramentas da sua profissão" },
];

const PREMIUM_BENEFITS = [
  { included: true, label: "Todos os benefícios do Plano Essencial" },
  { included: true, label: "Gestão ilimitada de casos ativos" },
  { included: true, label: "Acesso total a oportunidades de clientes" },
  { included: true, label: "Maior visibilidade no diretório de especialistas" },
  { included: true, label: "Chat interno ilimitado e com anexos" },
  {
    included: true,
    label:
      "Contato direto via e-mail e WhatsApp liberado no perfil (exclusivo Premium)",
  },
  {
    included: true,
    label: "Videoconferência ilimitada e sem restrição de tempo",
  },
  {
    included: true,
    label: "Relatórios de desempenho e métricas de atendimento",
  },
  { included: true, label: "Suporte prioritário" },
];

// Valor médio de mercado por função (consulta/hora), com base em referências
// gerais do mercado brasileiro. Serve de orientação — cada especialista define
// livremente o próprio preço no perfil.
const MARKET_AVERAGES = [
  { profession: "Advogado(a) trabalhista", range: "R$ 150 – R$ 400 / consulta" },
  { profession: "Médico(a) do trabalho", range: "R$ 200 – R$ 500 / consulta" },
  { profession: "Psicólogo(a) organizacional", range: "R$ 120 – R$ 250 / sessão" },
  { profession: "Assistente Social", range: "R$ 100 – R$ 220 / atendimento" },
  { profession: "Consultor(a) de RH", range: "R$ 150 – R$ 350 / hora" },
  { profession: "Contador(a)", range: "R$ 120 – R$ 300 / consulta" },
  { profession: "Engenheiro(a) de Segurança do Trabalho", range: "R$ 180 – R$ 400 / hora" },
  { profession: "Fisioterapeuta Ocupacional", range: "R$ 120 – R$ 250 / sessão" },
];

// Percentual de comissão retido pela plataforma sobre consultas intermediadas
// e pagas pelo checkout (split). Espelha a lógica de `create-checkout-session`.
const COMMISSION_BY_TIER = [
  { tier: "Gratuito / Essencial", pct: "10%" },
  { tier: "Premium", pct: "12,5%" },
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
        {benefits.map((b) => {
          const item = typeof b === "string" ? { included: true, label: b } : b;
          const included = item.included !== false;
          const iconClass = included
            ? highlight
              ? "text-white"
              : "text-green-600"
            : "text-red-500";
          const textClass = included
            ? highlight
              ? "text-blue-50"
              : "text-slate-700 dark:text-slate-200"
            : highlight
            ? "text-blue-100 line-through opacity-80"
            : "text-slate-500 dark:text-slate-400 line-through";
          return (
            <li key={item.label} className="flex items-start gap-2">
              <span aria-hidden="true" className={`font-bold ${iconClass}`}>
                {included ? "✓" : "✗"}
              </span>
              <span className={textClass}>{item.label}</span>
            </li>
          );
        })}
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
  const [loadingTier, setLoadingTier] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  const startCheckout = async (tier) => {
    setCheckoutError("");
    setLoadingTier(tier);
    try {
      // 1) PRIORIDADE MAXIMA: link direto do Mercado Pago configurado via env.
      //    Funciona para qualquer usuario (logado ou nao). A associacao do
      //    pagamento ao apoiador eh feita pelo webhook do MP.
      //    Excecao: para o tier "premium" pulamos o link direto porque ele
      //    vinha retornando "Ocorreu um problema" (SUB17-*) do MP. Usamos
      //    o backend, que monta uma preapproval nominal com back_url HTTPS
      //    sempre valida e tem fallback dinamico em caso de falha.
      const directMpUrl = tier === "premium" ? "" : getMpPlanUrl("supporter", tier);
      if (directMpUrl) {
        window.location.assign(directMpUrl);
        return;
      }

      // 2) Sem URL direta no env: tenta criar uma preapproval dinamica pelo
      //    backend. Para isso precisamos do apoiadorId.
      let apoiadorId = "";
      try {
        const profile = JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
        apoiadorId = profile?.apoiadorId || profile?.id || "";
      } catch {
        apoiadorId = "";
      }

      if (!apoiadorId) {
        if (!auth.currentUser) await signInAnonymously(auth);
        const uid = auth.currentUser?.uid;
        if (uid) {
          const snap = await getDocs(
            query(collection(db, "apoiadores"), where("uid", "==", uid))
          );
          if (!snap.empty) apoiadorId = snap.docs[0].id;
        }
      }

      if (!apoiadorId) {
        // Nao redireciona mais para /apoiadores/cadastro automaticamente: o
        // usuario pode estar logado e essa redirecao confunde. So mostramos a
        // mensagem e deixamos ele decidir.
        setCheckoutError(
          "Nao foi possivel iniciar o checkout no momento. Tente novamente em instantes ou entre em contato com o suporte."
        );
        return;
      }

      await handleCheckout({
        cnpj: "",
        companySlug: "trabalhei-la",
        companyName: "Trabalheila",
        audience: "supporter",
        tier,
        apoiadorId,
      });
    } catch (err) {
      setCheckoutError(
        err?.message || "Erro ao iniciar checkout. Tente novamente."
      );
    } finally {
      setLoadingTier("");
    }
  };

  const handleAssinarPremium = () => startCheckout("premium");
  const handleAssinarEssencial = () => startCheckout("essential");

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
            Você define quanto cobra por cada consulta. Para usar a plataforma
            você paga uma mensalidade fixa do seu plano e, nas consultas
            intermediadas e pagas aqui dentro, incide um percentual de comissão
            conforme o seu plano. O valor líquido cai direto na sua conta
            Mercado Pago.
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
            price="R$ 49/mês"
            priceHint="Ideal para quem está começando na plataforma"
            benefits={ESSENCIAL_BENEFITS}
            ctaLabel={
              loadingTier === "essential"
                ? "Abrindo checkout…"
                : "Assinar Plano Essencial"
            }
            onCta={handleAssinarEssencial}
          />
          <PlanCard
            title="Plano Premium"
            price="R$ 89,90/mês"
            priceHint="Solução completa para escalar sua atuação"
            benefits={PREMIUM_BENEFITS}
            ctaLabel={
              loadingTier === "premium"
                ? "Abrindo checkout…"
                : "Assinar Plano Premium"
            }
            onCta={handleAssinarPremium}
            highlight
          />
        </section>

        {checkoutError && (
          <p className="mt-4 text-center text-sm font-semibold text-red-600 dark:text-red-400">
            {checkoutError}
          </p>
        )}

        <section className="mt-8 bg-amber-50 dark:bg-amber-900/20 rounded-2xl shadow border border-amber-200 dark:border-amber-800 p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <span aria-hidden="true">💳</span> Como você recebe pelos atendimentos
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>
              <strong>É obrigatório ter uma conta no Mercado Pago.</strong> Para
              receber suas consultas, crie (ou use) uma conta Mercado Pago e
              informe o <strong>e-mail dela no seu perfil</strong> em{" "}
              <Link to="/apoiador/perfil" className="text-blue-700 dark:text-blue-300 underline">
                Gerenciar Perfil
              </Link>
              . Sem esse dado não conseguimos repassar seus valores.
            </li>
            <li>
              <strong>Split automático:</strong> quando o cliente paga uma
              consulta pela plataforma, o valor é dividido automaticamente — a
              comissão fica com a Trabalhei Lá e o <strong>valor líquido é
              depositado direto na sua conta Mercado Pago</strong>.
            </li>
            <li>
              <strong>Percentuais debitados conforme o seu plano:</strong> sobre
              cada consulta intermediada incide um percentual de comissão
              definido pelo plano que você configurou:
            </li>
          </ul>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1.5 pr-4 font-semibold">Plano</th>
                  <th className="py-1.5 font-semibold">Comissão da plataforma</th>
                </tr>
              </thead>
              <tbody>
                {COMMISSION_BY_TIER.map((c) => (
                  <tr key={c.tier} className="border-t border-amber-200/60 dark:border-amber-800/60">
                    <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-200">{c.tier}</td>
                    <td className="py-1.5 font-bold text-amber-700 dark:text-amber-300">{c.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            A mensalidade do plano é cobrada à parte e dá acesso aos recursos da
            plataforma. A comissão acima aplica-se apenas às consultas pagas pelo
            checkout interno.
          </p>
        </section>

        <section className="mt-6 bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
            Valor médio de mercado por função
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            Use a tabela abaixo como referência do que cada função costuma cobrar
            no mercado de trabalho. Você define livremente o seu preço no perfil —
            estes valores são apenas uma orientação.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1.5 pr-4 font-semibold">Função</th>
                  <th className="py-1.5 font-semibold">Faixa média de mercado</th>
                </tr>
              </thead>
              <tbody>
                {MARKET_AVERAGES.map((m) => (
                  <tr key={m.profession} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-200">{m.profession}</td>
                    <td className="py-1.5 font-semibold text-emerald-700 dark:text-emerald-300">{m.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
