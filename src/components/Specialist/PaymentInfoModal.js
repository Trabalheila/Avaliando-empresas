// src/components/Specialist/PaymentInfoModal.js
//
// Modal compartilhado de "Como funciona o pagamento?".
// Usado na SpecialistBenefitsPage, WorkerBenefitsPage e na página
// de cadastro do especialista (ApoiadorCadastro).
//
// `audience`:
//   - "specialist": detalha mensalidade + 100% do valor cobrado.
//   - "worker":     detalha desconto na primeira consulta (Essencial)
//                   e créditos no plano Premium do trabalhador.

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
  },
  worker: {
    title: "Como funciona o pagamento para Trabalhadores",
    paragraphs: [
      "No Plano Essencial (gratuito), você paga o valor da consulta diretamente ao especialista escolhido. Especialistas marcados com 'Desconto de Primeira Consulta' oferecem um valor reduzido na primeira contratação.",
      "No Plano Premium, sua assinatura mensal inclui créditos / consultas gratuitas com especialistas Premium. A plataforma se encarrega de remunerar o especialista por essas consultas — você não paga por fora.",
      "Em todos os planos, manter a comunicação e o pagamento dentro da plataforma é obrigatório (veja os Termos de Serviço).",
    ],
    termsHref: "/termos",
  },
};

export default function PaymentInfoModal({ open, onClose, audience = "specialist" }) {
  if (!open) return null;
  const data = COPY[audience] || COPY.specialist;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payinfo-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <h2 id="payinfo-title" className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100">
            {data.title}
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

        <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {data.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          Esta informação é um resumo. Consulte os{" "}
          <Link to={data.termsHref} className="underline">
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
