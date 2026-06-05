// src/components/StripePaymentForm.jsx
//
// PLACEHOLDER de pagamento na plataforma — UI-only.
//
// Esta é uma simulação de coleta de dados de cartão no padrão Stripe Elements.
// Substitua o conteúdo deste componente pela integração real do Stripe quando
// o backend de pagamentos estiver pronto:
//
//   import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
//   import { loadStripe } from "@stripe/stripe-js";
//
//   const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);
//
//   function RealForm({ clientSecret, onPaymentSuccess }) {
//     const stripe = useStripe();
//     const elements = useElements();
//     async function handleSubmit(e) {
//       e.preventDefault();
//       const result = await stripe.confirmCardPayment(clientSecret, {
//         payment_method: { card: elements.getElement(CardElement) },
//       });
//       if (result.error) { ... } else { onPaymentSuccess(result.paymentIntent); }
//     }
//     return (<form onSubmit={handleSubmit}><CardElement /><button>Pagar</button></form>);
//   }
//
// Por ora, mantemos um formulário falso que valida o formato dos campos
// localmente e dispara `onPaymentSuccess` com um id sintético após um pequeno
// delay — suficiente para o fluxo de UI funcionar de ponta a ponta.

import React, { useMemo, useState } from "react";

function formatCardNumber(v) {
  const digits = String(v || "").replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v) {
  const digits = String(v || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectBrand(numberDigits) {
  if (/^4/.test(numberDigits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(numberDigits)) return "mastercard";
  if (/^3[47]/.test(numberDigits)) return "amex";
  if (/^(6011|65|64[4-9])/.test(numberDigits)) return "discover";
  if (/^(50|5[6-9]|6)/.test(numberDigits)) return "elo";
  return "card";
}

/**
 * @param {object} props
 * @param {number} props.amount  Valor a cobrar em reais (ex.: 100.0).
 * @param {string} props.currencyLabel Texto exibido (ex.: "R$ 100,00").
 * @param {(payment: { paymentMethodId: string, last4: string, brand: string }) => void} props.onPaymentSuccess
 * @param {() => void} [props.onCancel]
 * @param {boolean} [props.disabled]
 */
export default function StripePaymentForm({
  amount,
  currencyLabel,
  onPaymentSuccess,
  onCancel,
  disabled = false,
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const numberDigits = useMemo(
    () => number.replace(/\D/g, ""),
    [number]
  );
  const brand = useMemo(() => detectBrand(numberDigits), [numberDigits]);

  const isValid =
    name.trim().length >= 3 &&
    numberDigits.length >= 13 &&
    /^\d{2}\/\d{2}$/.test(expiry) &&
    /^\d{3,4}$/.test(cvc);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid || submitting || disabled) return;
    setError("");
    setSubmitting(true);
    try {
      // Simulação: aguarda 800ms e devolve um id sintético.
      // Substitua por: stripe.confirmCardPayment(clientSecret, ...).
      await new Promise((resolve) => setTimeout(resolve, 800));
      const last4 = numberDigits.slice(-4);
      const paymentMethodId = `pm_simulated_${Date.now()}_${last4}`;
      onPaymentSuccess({ paymentMethodId, last4, brand });
    } catch (err) {
      setError(err?.message || "Não foi possível processar o pagamento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
        <strong>Ambiente de teste:</strong> nenhum cartão é cobrado neste
        momento. Esta é uma simulação do checkout (Stripe Elements). Use qualquer
        número de teste como <code>4242 4242 4242 4242</code>.
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
          Nome impresso no cartão
        </label>
        <input
          type="text"
          autoComplete="cc-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="Como aparece no cartão"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
          disabled={submitting || disabled}
        />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
          Número do cartão
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            className="mt-1 w-full px-3 py-2 pr-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm tracking-widest"
            disabled={submitting || disabled}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase font-extrabold text-slate-500 dark:text-slate-400">
            {brand}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Validade (MM/AA)
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/AA"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            disabled={submitting || disabled}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            CVC
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="123"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            disabled={submitting || disabled}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Voltar
          </button>
        )}
        <button
          type="submit"
          disabled={!isValid || submitting || disabled}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
        >
          {submitting
            ? "Processando…"
            : `Pagar ${currencyLabel || `R$ ${Number(amount || 0).toFixed(2).replace(".", ",")}`}`}
        </button>
      </div>
    </form>
  );
}
