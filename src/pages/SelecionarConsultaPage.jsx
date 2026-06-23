// src/pages/SelecionarConsultaPage.jsx
//
// Tela de seleção do TIPO de consulta, acessada ao clicar em
// "Agendar Consulta Comum" no card de especialistas (FindSpecialistPage).
//
// Rota: /selecionar-consulta/:specialistId
//
// Apresenta as modalidades disponíveis ANTES do pagamento:
//   • Chat        — consulta por texto (preço pontual de chat)
//   • Videochamada — consulta por vídeo (preço pontual de vídeo)
//   • Consulta Premium (card dourado) — EXCLUSIVO de especialistas Premium,
//     usa o valor configurado pelo profissional no perfil.
//
// Ao escolher uma opção, encaminha para `/pagamento-consulta` com o tipo e o
// valor corretos no `location.state`.

import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { FREE_PLAN_CONSULTATION_PRICE } from "../data/consultationPricing";

function formatBRL(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export default function SelecionarConsultaPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { specialistId } = useParams();

  const state = location.state || {};
  const professionalId = state.professionalId || specialistId || "";
  const professionalName = state.professionalName || "Especialista";
  const specialtyId = state.specialtyId || "outro";
  const isPremium = state.planType === "Premium";

  // Preços das modalidades pontuais (chat/vídeo): valores fixos da plataforma,
  // iguais para todos os especialistas. A "Consulta Premium" usa o preço que o
  // profissional Premium configurou no perfil (`premiumPrice`).
  const chatPrice = FREE_PLAN_CONSULTATION_PRICE.chat;
  const videoPrice = FREE_PLAN_CONSULTATION_PRICE.video;
  const premiumPrice = Number(state.premiumPrice || 0);

  // Encaminha para o fluxo de pagamento com o tipo e o valor escolhidos.
  const goToPayment = ({ modalidade, amount, planoTipo }) => {
    navigate("/pagamento-consulta", {
      state: {
        professionalId,
        professionalName,
        specialtyId,
        consultationPrice: amount,
        originalAmount: amount,
        modalidade,
        planoTipo,
        fromScheduling: true,
      },
    });
  };

  const OptionCard = ({
    icon,
    title,
    description,
    price,
    onSchedule,
    highlight = false,
    disabled = false,
  }) => (
    <div
      className={[
        "rounded-2xl border p-5 flex flex-col shadow-sm",
        highlight
          ? "border-amber-300 dark:border-amber-500/60 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
        <h3
          className={[
            "font-bold",
            highlight
              ? "text-amber-800 dark:text-amber-200"
              : "text-slate-800 dark:text-slate-100",
          ].join(" ")}
        >
          {title}
        </h3>
        {highlight && (
          <span className="ml-auto inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400 text-amber-900">
            ✨ Premium
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>

      <p
        className={[
          "mt-3 text-2xl font-extrabold",
          highlight
            ? "text-amber-700 dark:text-amber-300"
            : "text-slate-900 dark:text-slate-100",
        ].join(" ")}
      >
        {price > 0 ? formatBRL(price) : "Sob consulta"}
      </p>

      <button
        type="button"
        onClick={onSchedule}
        disabled={disabled}
        className={[
          "mt-4 w-full px-4 py-2.5 rounded-xl text-white text-sm font-bold transition",
          disabled
            ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
            : highlight
            ? "bg-amber-500 hover:bg-amber-600"
            : "bg-blue-600 hover:bg-blue-700",
        ].join(" ")}
      >
        {highlight ? "Agendar Consulta Premium" : "Agendar"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Escolher tipo de consulta" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Como você quer ser atendido?
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Escolha a modalidade de consulta com{" "}
            <span className="font-semibold">{professionalName}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <OptionCard
            icon="💬"
            title="Chat"
            description="Atendimento por texto, com troca de mensagens."
            price={chatPrice}
            onSchedule={() =>
              goToPayment({
                modalidade: "chat",
                amount: chatPrice,
                planoTipo: "essential",
              })
            }
          />

          <OptionCard
            icon="🎥"
            title="Videochamada"
            description="Atendimento por vídeo, em tempo real."
            price={videoPrice}
            onSchedule={() =>
              goToPayment({
                modalidade: "video",
                amount: videoPrice,
                planoTipo: "essential",
              })
            }
          />

          {isPremium && (
            <OptionCard
              icon="⭐"
              title="Consulta Premium"
              description="Atendimento premium com o valor definido pelo especialista."
              price={premiumPrice}
              highlight
              disabled={premiumPrice <= 0}
              onSchedule={() =>
                goToPayment({
                  modalidade: "chat",
                  amount: premiumPrice,
                  planoTipo: "premium",
                })
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
