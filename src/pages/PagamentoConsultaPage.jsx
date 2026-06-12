import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { auth } from "../firebase";
import { requestConsultation } from "../services/billing";

function formatBRL(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

// Rótulos amigáveis por tipo de especialidade (alinhado ao diretório de
// especialistas). Usado apenas para exibição na página de pagamento.
const SPECIALTY_LABELS = {
  advogado: "Advogado(a) trabalhista",
  consultor_rh: "Consultor(a) de RH",
  recrutador: "Recrutador(a)",
  psicologo: "Psicólogo(a) organizacional",
  medico: "Médico(a) do trabalho",
  contador: "Contador(a)",
  engenheiro_seguranca: "Engenheiro(a) de segurança",
  fisioterapeuta_ocupacional: "Fisioterapeuta ocupacional",
  outro: "Especialista",
};

function getWorkerSnapshot() {
  try {
    const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
    return {
      id: profile?.uid || profile?.id || profile?.profileId || "",
      nome: profile?.pseudonimo || profile?.nome || profile?.displayName || "Trabalhador",
    };
  } catch {
    return { id: "", nome: "Trabalhador" };
  }
}

export default function PagamentoConsultaPage({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    professionalId,
    professionalName,
    especialidadeId,
    specialtyId,
    consultationPrice,
    originalAmount,
    originalPrice,
    discountAmount,
    userDoubt,
    modalidade: modalidadeFromState,
    planoTipo,
    fromScheduling,
  } = location.state || {};

  const modalidade = modalidadeFromState === "video" ? "video" : "chat";
  const especialidade = specialtyId || especialidadeId || "";
  const especialidadeLabel =
    SPECIALTY_LABELS[String(especialidade).toLowerCase()] || "";
  // Mensagem enviada ao especialista. No fluxo de agendamento (a partir do
  // card do diretório) não há "dúvida" digitada; usamos uma mensagem padrão.
  const consultationMessage =
    (userDoubt && String(userDoubt).trim()) ||
    (fromScheduling
      ? `Solicitação de consulta agendada com ${professionalName || "o especialista"}.`
      : "");

  const [submitting, setSubmitting] = useState(false);
  const [success] = useState(false);
  const [error, setError] = useState("");

  const finalAmount = useMemo(() => Number(consultationPrice || 0), [consultationPrice]);
  const normalizedOriginalAmount = useMemo(
    () => Number(originalAmount || originalPrice || consultationPrice || 0),
    [originalAmount, originalPrice, consultationPrice]
  );
  const normalizedDiscount = useMemo(() => Number(discountAmount || 0), [discountAmount]);

  /* Pagamento via Mercado Pago (Checkout Pro). Redireciona para o ambiente
     seguro do Mercado Pago; a consulta so e registrada na colecao `consultas`
     pelo webhook apos a aprovacao real do pagamento. */
  async function handlePayWithMercadoPago() {
    setError("");

    const workerSnapshot = getWorkerSnapshot();
    const workerId = auth.currentUser?.uid || workerSnapshot.id;

    if (!workerId) {
      setError("Faca login para continuar.");
      return;
    }
    if (!professionalId || !professionalName) {
      setError("Dados da consulta nao encontrados.");
      return;
    }
    if (!consultationMessage || !String(consultationMessage).trim()) {
      setError("Descricao da duvida nao encontrada.");
      return;
    }

    setSubmitting(true);
    try {
      await requestConsultation({
        apoiadorId: professionalId,
        apoiadorNome: professionalName,
        tier: planoTipo === "premium" ? "premium" : "essential",
        amount: finalAmount,
        workerId,
        especialidade: especialidade || "outro",
        audience: "worker",
        modalidade,
        message: String(consultationMessage).trim(),
        workerNome: workerSnapshot.nome,
        originalAmount: normalizedOriginalAmount,
        discountAmount: normalizedDiscount,
      });
      // requestConsultation redireciona o navegador para o Mercado Pago.
      // Mantemos `submitting` ativo durante o redirecionamento.
    } catch (err) {
      console.warn("PagamentoConsulta:", err);
      setError(err?.message || "Nao foi possivel iniciar o pagamento.");
      setSubmitting(false);
    }
  }

  if (!professionalName || !finalAmount) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} title="Pagamento da consulta" />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-6 text-center">
            <p className="text-slate-600 dark:text-slate-300">Erro: dados da consulta nao encontrados.</p>
            <button
              type="button"
              onClick={() => navigate("/consulta-avulsa")}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Voltar para consulta avulsa
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Pagamento da consulta" />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5 sm:p-6">
          {success ? (
            <>
              <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
                Pagamento confirmado
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Sua solicitacao foi enviada para <strong>{professionalName}</strong>. Voce sera avisado quando o especialista aceitar ou recusar a consulta.
              </p>
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Valor pago</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{formatBRL(finalAmount)}</span>
                </div>
                {normalizedDiscount > 0 && (
                  <div className="mt-1 flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                    <span>Desconto Premium aplicado</span>
                    <span>- {formatBRL(normalizedDiscount)}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/consulta-avulsa")}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Nova consulta
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/my-contacts")}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Ver minhas consultas
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
                Pagamento da consulta
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Profissional: <strong>{professionalName}</strong>
                {especialidadeLabel && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {especialidadeLabel}
                  </span>
                )}
              </p>

              {fromScheduling && (
                <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    Você está contratando uma consulta com{" "}
                    <strong>{professionalName}</strong>. Ao confirmar o pagamento,
                    receberá os dados de contato do especialista por e-mail e em{" "}
                    <strong>Minha Conta</strong>.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600 dark:text-slate-300">
                    Valor
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                      ({modalidade === "video" ? "Vídeo" : "Chat"})
                    </span>
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {normalizedDiscount > 0 ? (
                      <>
                        <span className="line-through text-slate-400 dark:text-slate-500 mr-2 font-normal">
                          {formatBRL(normalizedOriginalAmount)}
                        </span>
                        {formatBRL(finalAmount)}
                      </>
                    ) : (
                      formatBRL(finalAmount)
                    )}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Pagamento 100% seguro processado via Mercado Pago. O valor só é liberado ao profissional após a conclusão do atendimento.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300">
                  <span aria-hidden="true">🔒</span> Pagamento seguro via Mercado Pago
                </p>
                <p className="mt-1">
                  Você será redirecionado ao ambiente do Mercado Pago para concluir
                  o pagamento (cartão, PIX ou boleto). Após a confirmação, sua
                  solicitação é enviada automaticamente ao profissional.
                </p>
              </div>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handlePayWithMercadoPago}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
                >
                  {submitting
                    ? "Redirecionando…"
                    : `Pagar ${formatBRL(finalAmount)} com Mercado Pago`}
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
