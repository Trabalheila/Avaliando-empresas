import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { FREE_PLAN_CONSULTATION_PRICE } from "../../data/consultationPricing";

// Funções auxiliares (assumindo que estão definidas no escopo superior ou importadas)
function normalizeTipo(v) {
  return String(v || "").toLowerCase().trim().replace(/-/g, "_");
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

// SPECIALTY_OPTIONS (assumindo que está definida no escopo superior ou importada)
const SPECIALTY_OPTIONS = [
  { value: "", label: "Todas as especialidades" },
  { value: "advogado", label: "Advogado(a) trabalhista" },
  { value: "consultor_rh", label: "Consultor(a) de RH" },
  { value: "recrutador", label: "Recrutador(a)" },
  { value: "psicologo", label: "Psicólogo(a) organizacional" },
  { value: "medico", label: "Médico(a) do trabalho" },
  { value: "contador", label: "Contador(a)" },
  { value: "engenheiro_seguranca", label: "Engenheiro(a) de segurança" },
  { value: "fisioterapeuta_ocupacional", label: "Fisioterapeuta ocupacional" },
  { value: "outro", label: "Outros" },
];

function StarRow({ rating }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <span className="inline-flex gap-0.5" aria-label={`Avaliação ${rating || 0} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= r ? "text-yellow-400" : "text-slate-300 dark:text-slate-600"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
        </svg>
      ))}
    </span>
  );
}

function SpecialistCard({ specialist, workerIsPremium, onPontualClick }) {
  const navigate = useNavigate();
  const tipoLabel =
    SPECIALTY_OPTIONS.find((o) => o.value === normalizeTipo(specialist.tipo))?.label ||
    "Especialista";
  const initials =
    (specialist.nome || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  const planType = specialist.planType === "Premium" ? "Premium" : "Essencial";
  // avgPrice não será mais usado para Premium, mas mantido para compatibilidade se necessário em outros lugares
  const avgPrice = Number(
    specialist.averageConsultationPrice || specialist.precoConsulta || 0
  );
  // Valor da "Consulta Especializada" (atendimento premium diferenciado). Para
  // especialistas Premium, é o ÚNICO preço configurável e o que aparece no card.
  const especializadaPrice = Number(specialist.precoConsultaEspecializada || 0);
  // Modelo "Ad Exitum": o especialista só recebe honorários se ganhar o caso —
  // não há cobrança inicial. Quando ativo, o card mostra "R$ 0,00 (Ad Exitum)"
  // e o agendamento segue um fluxo sem pagamento imediato.
  // IMPORTANTE: Ad Exitum é exclusivo de ADVOGADOS — mesmo que a flag esteja
  // true no banco para outra especialidade, não exibimos no card.
  const isAdvogadoCard = normalizeTipo(specialist.tipo) === "advogado";
  const isAdExitum = isAdvogadoCard && specialist.adExitum === true;

  // Conta de demonstração: não pode receber pagamentos reais — botões ficam
  // desabilitados.
  const isTestAccount = specialist.isTestAccount === true;
  // Disponibilidade exibida no card (controlada manualmente no Firestore).
  const isAvailable = specialist.available === true;

  // hasPontualPrice e isAdExitumComPontual não serão mais usados da mesma forma
  // para Premium, pois o preço será o da Consulta Especializada.
  // Mantidos para não quebrar outras lógicas, mas sua relevância diminui.
  const pontualAmount =
    planType === "Essencial" ? FREE_PLAN_CONSULTATION_PRICE.chat : avgPrice;
  const hasPontualPrice = pontualAmount > 0;
  const isAdExitumComPontual = isAdExitum && hasPontualPrice; // Esta flag pode precisar de revisão dependendo do fluxo final

  // Advogado Premium que aceita Ad Exitum: oferece DUAS frentes de agendamento
  // (Consulta Comum E Ad Exitum), mesmo que ainda não tenha definido o preço da
  // consulta. Nesse caso o card exibe dois botões distintos — sem redundância.
  const isAdExitumDual = isAdExitum && (planType === "Premium" || hasPontualPrice);
  // Agendamento Ad Exitum: não passa pelo fluxo de pagamento — encaminha para
  // a rota dedicada de agendamento sem custo inicial.
  const goToAdExitum = () => {
    navigate(`/agendar-ad-exitum/${specialist.id}`, {
      state: {
        professionalId: specialist.id,
        professionalName: specialist.nome,
        specialtyId: normalizeTipo(specialist.tipo) || "outro",
      },
    });
  };

  // Consulta comum: o destino depende do plano do especialista.
  //   • Premium: vai para a página de detalhes da Consulta Especializada.
  //   • Não-Premium: vai para a seleção de tipo de consulta (chat/vídeo).
  const goToEspecializadaDetalhes = () => {
    navigate(`/consulta-especializada-detalhes/${specialist.id}`, {
      state: {
        professionalId: specialist.id,
        professionalName: specialist.nome,
        professionalPhoto: specialist.foto || "",
        specialtyId: normalizeTipo(specialist.tipo) || "outro",
        precoConsultaEspecializada: especializadaPrice,
      },
    });
  };

  const goToConsultaSelection = () => {
    navigate(`/selecionar-consulta/${specialist.id}`, {
      state: {
        professionalId: specialist.id,
        professionalName: specialist.nome,
        specialtyId: normalizeTipo(specialist.tipo) || "outro",
        planType,
        // Para não-Premium, precoConsultaEspecializada não é relevante aqui, mas pode ser passado
        precoConsultaEspecializada: especializadaPrice,
      },
    });
  };

  // Direciona o fluxo de "Agendar Consulta Comum" conforme o plano.
  const goToConsultaComum = () => {
    if (planType === "Premium") {
      goToEspecializadaDetalhes();
    } else {
      goToConsultaSelection();
    }
  };

  let scheduleHint = "";
  if (planType === "Essencial") {
    // Essencial: a consulta pontual tem preço fixo da plataforma — esse valor
    // tem PRIORIDADE sobre qualquer outro preço configurado pelo profissional.
    scheduleHint = `Consulta pontual: R$ ${FREE_PLAN_CONSULTATION_PRICE.chat} (chat) ou R$ ${FREE_PLAN_CONSULTATION_PRICE.video} (videochamada).`;
  } else if (workerIsPremium) {
    scheduleHint =
      planType === "Premium"
        ? "Usa seus créditos / consultas gratuitas Premium."
        : "Pague normalmente ao especialista (sem crédito Premium).";
  } else {
    scheduleHint = "Preço integral; assine o Premium do trabalhador para ganhar créditos.";
  }

  return (
    <article className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 flex flex-col">
      <header className="flex items-start gap-3">
        {specialist.foto ? (
          <img
            src={specialist.foto}
            alt={specialist.nome}
            className="w-14 h-14 rounded-full object-cover bg-slate-100"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">
              {specialist.nome}
            </h3>
            {specialist.isVerified && (
              <span
                title="Especialista verificado"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                ✓ Verificado
              </span>
            )}
            <span
              title={`Especialista ${planType}`}
              className={[
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full",
                planType === "Premium"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
              ].join(" ")}
            >
              {planType === "Premium" ? "✨ Premium" : "Essencial"}
            </span>
          </div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
            {tipoLabel}
          </p>
          {isAvailable && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Disponível agora
            </p>
          )}
          {isTestAccount && (
            <p className="mt-1 inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Conta de demonstração
            </p>
          )}
          {planType === "Essencial" && (
            <p className="mt-1 inline-flex items-center text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              ✉️ Consulta pontual: R$ {FREE_PLAN_CONSULTATION_PRICE.chat} chat · R$ {FREE_PLAN_CONSULTATION_PRICE.video} vídeo
            </p>
          )}
        </div>
      </header>

      {specialist.bio && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
          {specialist.bio}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
          <StarRow rating={specialist.rating} />
          <span className="font-semibold">
            {Number(specialist.rating || 0).toFixed(1)}
          </span>
          <span className="text-slate-400">({specialist.totalAvaliacoes || 0})</span>
        </div>
        {/* INÍCIO DA ALTERAÇÃO DO BLOCO DE PREÇO */}
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {planType === "Premium" ? "Consulta" : "Consulta pontual"}
          </p>
          {planType === "Premium" ? (
            // Lógica para Especialistas Premium
            especializadaPrice > 0 ? (
              <>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                  {formatBRL(especializadaPrice)} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">especializada</span>
                </p>
                {isAdExitum && ( // Se também for Ad Exitum, mostra a opção abaixo do preço
                  <p
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight cursor-help"
                    title="Ad Exitum: O pagamento dos honorários do advogado só ocorre se o caso for ganho. Não há custo inicial para o trabalhador."
                  >
                    ou Ad Exitum <span className="underline decoration-dotted">(sem custo inicial)</span>
                  </p>
                )}
              </>
            ) : isAdExitum ? (
              // Premium, Ad Exitum, mas sem preço especializado definido
              <p
                className="text-sm font-bold text-emerald-600 dark:text-emerald-400 leading-tight cursor-help"
                title="Ad Exitum: O pagamento dos honorários do advogado só ocorre se o caso for ganho. Não há custo inicial para o trabalhador."
              >
                R$ 0,00 <span className="text-[11px] font-semibold underline decoration-dotted">(Ad Exitum)</span>
              </p>
            ) : (
              // Premium, sem Ad Exitum, sem preço especializado
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                Sob consulta
              </p>
            )
          ) : (
            // Lógica para Especialistas Essenciais (não-Premium)
            <>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                R$ {FREE_PLAN_CONSULTATION_PRICE.chat} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">chat</span>
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
                R$ {FREE_PLAN_CONSULTATION_PRICE.video} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">vídeo</span>
              </p>
            </>
          )}
        </div>
        {/* FIM DA ALTERAÇÃO DO BLOCO DE PREÇO */}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to={`/apoiadores/perfil/${specialist.id}`}
          className="text-center px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          Ver perfil
        </Link>
        {isTestAccount ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Conta de demonstração — consultas indisponíveis"
            className="text-center px-3 py-2 rounded-lg bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed"
          >
            Indisponível para consulta
          </button>
        ) : workerIsPremium ? (
          <Link
            to={`/chat/spec_${encodeURIComponent(specialist.id)}?peer=${encodeURIComponent(
              specialist.nome || "Especialista"
            )}&peerRole=especialista&specialistType=${encodeURIComponent(
              normalizeTipo(specialist.tipo) || "outro"
            )}`}
            className="text-center px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            title="Consulta com acompanhamento contínuo (Premium)"
          >
            💬 Consulta com acompanhamento
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Advogado com Ad Exitum + consulta comum/Premium: este botão é a
              // CONSULTA COMUM, que abre a seleção de tipo de consulta antes do
              // pagamento (o agendamento Ad Exitum fica no botão inferior, sem
              // redundância).
              if (isAdExitumDual) { // isAdExitumDual é true para Premium + Ad Exitum
                goToConsultaComum(); // Isso agora vai para goToEspecializadaDetalhes() para Premium
                return;
              }
              // Ad Exitum puro: sem custo inicial — segue o fluxo de agendamento
              // dedicado, sem pagamento imediato.
              if (isAdExitum) {
                goToAdExitum();
                return;
              }
              // Consulta comum: abre a seleção de tipo de consulta. Sem preço
              // ("Sob consulta"), abrimos o modal de contato/pergunta.
              // Para Premium, isso não deve acontecer mais aqui, pois goToConsultaComum já foi chamado.
              // Para Essencial, continua indo para a seleção de chat/vídeo.
              if (hasPontualPrice || planType === "Essencial") { // Adicionado planType === "Essencial" para clareza
                goToConsultaComum();
              } else {
                onPontualClick?.(specialist);
              }
            }}
            className={[
              "text-center px-3 py-2 rounded-lg text-white text-sm font-bold",
              isAdExitum && !isAdExitumDual
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-blue-600 hover:bg-blue-700",
            ].join(" ")}
            title={
              isAdExitumDual
                ? "Consulta especializada — veja detalhes e pague o valor definido pelo especialista" // Título atualizado
                : isAdExitum
                ? "Agendamento Ad Exitum — sem custo inicial"
                : hasPontualPrice || planType === "Essencial" // Adicionado planType === "Essencial"
                ? "Consulta pontual — pagamento da consulta"
                : "Pergunta única, sem histórico nem follow-up"
            }
          >
            {isAdExitumDual
              ? "✉️ Agendar Consulta Comum" // Mantém o texto do botão, mas o fluxo é para Especializada
              : isAdExitum
              ? "⚖️ Agendar Ad Exitum"
              : "✉️ Consulta pontual"}
          </button>
        )}
      </div>

      {isTestAccount ? (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
          Conta de demonstração — não disponível para consultas pagas.
        </p>
      ) : isAdExitum && !isAdExitumDual ? (
        // Ad Exitum puro: o botão Ad Exitum já está no grid acima — aqui só a
        // nota explicativa, sem repetir o botão (evita redundância).
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 text-center">
          Pagamento Ad Exitum: você só paga honorários se o caso for ganho.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              // Caso dual (advogado Premium + Ad Exitum): o botão inferior é
              // sempre o agendamento Ad Exitum — sem pagamento imediato.
              if (isAdExitum) {
                goToAdExitum();
                return;
              }
              // Consulta comum: abre a seleção de tipo de consulta (chat, vídeo
              // e, para Premium, Consulta Especializada) antes do pagamento.
              // Este bloco não deve ser mais acessado para Premium, pois o botão superior já direciona.
              // Para Essencial, continua indo para a seleção de chat/vídeo.
              goToConsultaComum();
            }}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
          >
            {isAdExitum
              ? "📅 Agendar Ad Exitum (sem custo inicial)"
              : "📅 Agendar consulta"}
          </button>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            {isAdExitum
              ? "Pagamento Ad Exitum: você só paga honorários se o caso for ganho."
              : scheduleHint}
          </p>
        </>
      )}
    </article>
  );
}

// O restante do FindSpecialistPage.js permanece inalterado.
export default function FindSpecialistPage({ theme, toggleTheme }) {
  // ... (código restante da página FindSpecialistPage)
}