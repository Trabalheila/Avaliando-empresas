// src/components/Specialist/PaymentInfoModal.js
//
// Modal compartilhado de "Como funciona o pagamento?".
// Usado na SpecialistBenefitsPage, WorkerBenefitsPage, na página
// de cadastro do especialista (ApoiadorCadastro) e em onboardings.
//
// `audience`:
//   - "specialist": detalha mensalidade + 100% do valor cobrado.
//   - "worker":     detalha desconto na primeira consulta (Essencial)
//                   e créditos no plano Premium do trabalhador.
//   - "both":       resumo dos dois lados com links "Saiba Mais"
//                   para as páginas de benefícios de cada papel.

import React from "react";
import { Link } from "react-router-dom";

const COPY = {
  specialist: {
    title: "Como funciona o pagamento para Especialistas",
    paragraphs: [
      "Na Trabalhei Lá, especialistas pagam apenas uma assinatura mensal fixa para usar a plataforma (planos Essencial e Premium).",
      "Em troca, você recebe 100% do valor que cobra de seus clientes. A Trabalhei Lá não retém percentual sobre suas consultas.",
      "A emissão de nota fiscal/recibo para o cliente final é de sua responsabilidade.",
      "Você define o preço da sua consulta. Como referência, o valor médio cobrado por consulta hoje na plataforma fica entre R$ 100 e R$ 300, variando por especialidade e experiência.",
    ],
    termsHref: "/termos",
    learnMore: { href: "/especialista/beneficios", label: "Saiba mais sobre os planos do Especialista" },
  },
  worker: {
    title: "Como funciona o pagamento para Trabalhadores",
    paragraphs: [
      "No Plano Essencial (gratuito), você paga o valor da consulta diretamente ao especialista escolhido. Especialistas marcados com 'Desconto de Primeira Consulta' oferecem um valor reduzido na primeira contratação.",
      "No Plano Premium, sua assinatura mensal inclui créditos / consultas gratuitas com especialistas Premium. A plataforma se encarrega de remunerar o especialista por essas consultas — você não paga por fora.",
      "Em todos os planos, manter a comunicação e o pagamento dentro da plataforma é obrigatório (veja os Termos de Serviço).",
    ],
    termsHref: "/termos",
    learnMore: { href: "/trabalhador/beneficios", label: "Saiba mais sobre os planos do Trabalhador" },
  },
};

function SideBlock({ heading, paragraphs, learnMore }) {
  return (
    <div className="rounded-xl border border-blue-100 dark:border-slate-700 bg-blue-50/40 dark:bg-slate-800/40 p-4">
      <h3 className="text-sm font-extrabold text-blue-800 dark:text-blue-300">
        {heading}
      </h3>
      <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {learnMore && (
        <Link
          to={learnMore.href}
          className="mt-3 inline-block text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
        >
          {learnMore.label} →
        </Link>
      )}
    </div>
  );
}

export default function PaymentInfoModal({ open, onClose, audience = "specialist" }) {
  if (!open) return null;
  const isBoth = audience === "both";
  const data = isBoth ? null : COPY[audience] || COPY.specialist;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payinfo-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={
          "w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-6 max-h-[90vh] overflow-y-auto " +
          (isBoth ? "max-w-2xl" : "max-w-lg")
        }
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <h2 id="payinfo-title" className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100">
            {isBoth ? "Como funciona o pagamento na Trabalhei Lá" : data.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xl leading-none"
          >
            ×
          </button>
        </header>

        {isBoth ? (
          <div className="mt-4 space-y-4">
            <SideBlock
              heading="Para Especialistas"
              paragraphs={[
                "Você paga uma assinatura mensal ao Trabalhei Lá (Essencial ou Premium) e recebe 100% do valor que cobra dos seus clientes. A plataforma não retém percentual sobre as consultas.",
              ]}
              learnMore={COPY.specialist.learnMore}
            />
            <SideBlock
              heading="Para Trabalhadores"
              paragraphs={[
                "No Plano Essencial você paga a consulta diretamente ao especialista, com desconto na primeira consulta. No Plano Premium, sua assinatura inclui créditos ou consultas gratuitas com especialistas Premium.",
              ]}
              learnMore={COPY.worker.learnMore}
            />
          </div>
        ) : (
          <>
            <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              {data.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {data.learnMore && (
              <Link
                to={data.learnMore.href}
                className="mt-3 inline-block text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
              >
                {data.learnMore.label} →
              </Link>
            )}
          </>
        )}

        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          Esta informação é um resumo. Consulte os{" "}
          <Link to="/termos" className="underline">
            Termos de Serviço
          </Link>{" "}
          para a política completa, incluindo as regras anti-desintermediação.
        </p>

        <div className="mt-5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
