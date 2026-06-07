import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import StripePaymentForm from "../components/StripePaymentForm";
import { auth, db } from "../firebase";
import { buildApiUrl } from "../utils/apiBase";
import { registerConsultationTransaction } from "../services/consultaTransactions";

const PLATFORM_COMMISSION_PCT = 0.2;

function formatBRL(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

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
    professionalUid,
    professionalName,
    especialidadeId,
    consultationPrice,
    originalAmount,
    discountAmount,
    userDoubt,
  } = location.state || {};

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const finalAmount = useMemo(() => Number(consultationPrice || 0), [consultationPrice]);
  const normalizedOriginalAmount = useMemo(
    () => Number(originalAmount || consultationPrice || 0),
    [originalAmount, consultationPrice]
  );
  const normalizedDiscount = useMemo(() => Number(discountAmount || 0), [discountAmount]);

  async function persistConsultationAndTransaction(paymentMeta) {
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
    if (!userDoubt || !String(userDoubt).trim()) {
      setError("Descricao da duvida nao encontrada.");
      return;
    }

    const platformCommission = finalAmount * PLATFORM_COMMISSION_PCT;
    const amountDueToSpecialist = finalAmount - platformCommission;

    setSubmitting(true);
    try {
      const payload = {
        workerId,
        workerNome: workerSnapshot.nome,
        apoiadorId: professionalId,
        apoiadorUid: professionalUid || "",
        apoiadorNome: professionalName,
        especialidade: especialidadeId || "outro",
        tipo: "avulsa",
        type: "avulsa",
        message: String(userDoubt).trim().slice(0, 2000),
        status: "pending",
        readByApoiador: false,
        amount: finalAmount,
        originalAmount: normalizedOriginalAmount,
        discountApplied: normalizedDiscount,
        platformCommission,
        amountDueToSpecialist,
        paymentStatus: "paid",
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, "consultas"), payload);

      try {
        await registerConsultationTransaction({
          userId: workerId,
          specialistId: professionalId,
          consultationId: ref.id,
          originalAmount: normalizedOriginalAmount,
          discountApplied: normalizedDiscount,
          finalAmountPaid: finalAmount,
          platformCommission,
          amountDueToSpecialist,
          paymentMeta,
        });
      } catch (err) {
        console.warn("PagamentoConsulta: falha ao registrar transacao", err);
      }

      try {
        await fetch(buildApiUrl("/api/send-contact-request"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: ref.id,
            kind: "consulta_avulsa",
            fromUid: workerId,
            fromCompanyName: workerSnapshot.nome,
            toUid: professionalUid || professionalId,
            toPseudonym: professionalName,
            message: payload.message,
            especialidade: payload.especialidade,
          }),
        });
      } catch {
        // Melhor esforco: a consulta principal ja foi registrada.
      }

      setSuccess(true);
    } catch (err) {
      console.warn("PagamentoConsulta:", err);
      setError(err?.message || "Nao foi possivel finalizar o pagamento.");
    } finally {
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
              </p>

              <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600 dark:text-slate-300">Valor</span>
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
              </div>

              <div className="mt-4">
                <StripePaymentForm
                  amount={finalAmount}
                  currencyLabel={formatBRL(finalAmount)}
                  onPaymentSuccess={persistConsultationAndTransaction}
                  onCancel={() => navigate(-1)}
                  disabled={submitting}
                />
              </div>

              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
