import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { isPremium as checkUserIsPremium } from "../utils/rbac";
import { requestConsultation } from "../services/billing";
import { getConsultationPrice } from "../data/consultationPricing";

/**
 * Modal de consultas intermediadas.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - mode: "choose-tier" | "confirm" (default: detectado a partir de `apoiador`)
 *  - apoiador?: { id, nome, plano, tipo, precoConsulta, especialidade } — quando
 *    fornecido, o modal vai direto para a confirmação.
 *
 * Comportamento:
 *  - Trabalhador free → tela de upgrade (mesmo se passar apoiador).
 *  - Trabalhador premium sem apoiador → escolher tier (Essencial vs Premium).
 *  - Trabalhador premium com apoiador → confirmar e ir para o checkout.
 */
function BRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

export default function ConsultationModal({ open, onClose, apoiador = null }) {
  const navigate = useNavigate();
  const userIsPremium = useMemo(() => checkUserIsPremium(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const price = apoiador ? getConsultationPrice(apoiador) : null;
  const apoiadorTier = apoiador && String(apoiador.plano || "").toLowerCase() === "premium" ? "premium" : "essential";

  /* ── Estado 1: Free → Upgrade ── */
  if (!userIsPremium) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
            Recurso exclusivo Premium
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Solicitar consultas diretamente pela plataforma é um benefício do plano
            <strong> Premium Trabalhador</strong>. Com ele você fala com advogados,
            psicólogos e consultores parceiros com pagamento seguro e split automático.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate("/escolha-perfil?audience=worker&tier=premium");
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold"
            >
              Fazer upgrade para Premium
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Agora não
            </button>
          </div>
        </div>
      </Backdrop>
    );
  }

  /* ── Estado 2: Premium sem apoiador → Escolher tier ── */
  if (!apoiador) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-1">
            Qual tipo de Apoiador você prefere?
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Escolha o formato que combina mais com sua necessidade.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate("/apoiadores/lista?plano=essencial");
              }}
              className="text-left p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
            >
              <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                Apoiador Essencial
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Preço tabelado pela plataforma — você sabe exatamente o que vai pagar.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate("/apoiadores/lista?plano=premium");
              }}
              className="text-left p-4 rounded-xl border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
            >
              <p className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                Apoiador Premium
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Preço definido pelo profissional — mais flexibilidade e especialização.
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
      </Backdrop>
    );
  }

  /* ── Estado 3: Premium com apoiador → Confirmar ── */
  const handleConfirm = async () => {
    if (!price) {
      setError("Este apoiador não oferece consultas intermediadas.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const workerId = auth.currentUser?.uid || "";
      await requestConsultation({
        apoiadorId: apoiador.id,
        apoiadorNome: apoiador.nome || "",
        tier: apoiadorTier,
        amount: price,
        workerId,
        especialidade: apoiador.especialidade || apoiador.tipo || "",
      });
    } catch (err) {
      setError(err?.message || "Erro inesperado.");
      setSubmitting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
          Solicitar consulta
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Você está prestes a iniciar uma consulta com{" "}
          <strong>{apoiador.nome}</strong>
          {apoiador.especialidade ? <> ({apoiador.especialidade})</> : null}.
        </p>

        <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">Valor da consulta</span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
              {price ? BRL(price) : "Indisponível"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {apoiadorTier === "premium"
              ? "Preço definido pelo profissional. A plataforma retém 12,5%."
              : "Preço tabelado pela plataforma. A plataforma retém 10%."}
          </p>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !price}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {submitting ? "Abrindo checkout…" : "Confirmar e pagar"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}
