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

  // Esta página é usada pelo fluxo de "Consulta Comum" de especialistas
  // NÃO-Premium: Chat e Videochamada sempre com os preços FIXOS da plataforma.
  // (Especialistas Premium são direcionados à página de detalhes da Consulta
  // Especializada, não passam por aqui.)
  const chatPrice = FREE_PLAN_CONSULTATION_PRICE.chat;
  const videoPrice = FREE_PLAN_CONSULTATION_PRICE.video;
  const planoTipo = "essential";

  // Encaminha para o fluxo de pagamento com o tipo e o valor escolhidos.
  const goToPayment = ({ modalidade, amount }) => {
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
    disabled = false,
  }) => (
    <div className="rounded-2xl border p-5 flex flex-col shadow-sm border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          {icon}
        </span>
        <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      </div>

      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>

      <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
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
            : "bg-blue-600 hover:bg-blue-700",
        ].join(" ")}
      >
        Agendar
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
            disabled={chatPrice <= 0}
            onSchedule={() =>
              goToPayment({ modalidade: "chat", amount: chatPrice })
            }
          />

          <OptionCard
            icon="🎥"
            title="Videochamada"
            description="Atendimento por vídeo, em tempo real."
            price={videoPrice}
            disabled={videoPrice <= 0}
            onSchedule={() =>
              goToPayment({ modalidade: "video", amount: videoPrice })
            }
          />

          {/* Consulta Especializada — exclusiva de especialistas Premium.
              Aqui (fluxo não-Premium) aparece sempre bloqueada. */}
          <div className="rounded-2xl border p-5 flex flex-col shadow-sm border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">🔒</span>
              <h3 className="font-bold text-amber-800 dark:text-amber-200">
                Consulta Especializada
              </h3>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Atendimento premium diferenciado, disponível para especialistas
              do plano Premium.
            </p>
            <p className="mt-3 text-base font-bold text-amber-700 dark:text-amber-300">
              Exclusivo Premium
            </p>
            <button
              type="button"
              onClick={() => navigate("/escolha-perfil?planos=1")}
              className="mt-4 w-full px-4 py-2.5 rounded-xl text-white text-sm font-bold transition bg-amber-500 hover:bg-amber-600"
            >
              Torne-se Premium e dê o seu valor
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
