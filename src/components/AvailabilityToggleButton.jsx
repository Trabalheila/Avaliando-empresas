import React, { useEffect, useState, useCallback } from "react";
import {
  setWorkerAvailability,
  getWorkerAvailability,
} from "../services/contactRequests";

/**
 * AvailabilityToggleButton
 * --------------------------------------------------------------
 * Botão "Disponível para Contato" para o próprio Trabalhador
 * Premium ativar/desativar a possibilidade de ser contatado por
 * Apoiadores Premium. Salva em users/{uid}.isAvailableForContact.
 *
 * Renderiza `null` se o trabalhador não for Premium ou não for o
 * dono do perfil.
 */
export default function AvailabilityToggleButton({
  profileId,
  isOwner,
  isPremium,
  className = "",
}) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOwner || !isPremium || !profileId) return;
    let cancelled = false;
    setLoading(true);
    getWorkerAvailability(profileId)
      .then((v) => !cancelled && setAvailable(Boolean(v)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [profileId, isOwner, isPremium]);

  const handleToggle = useCallback(async () => {
    if (!profileId || saving) return;
    const next = !available;
    setSaving(true);
    try {
      await setWorkerAvailability(profileId, next);
      setAvailable(next);
    } catch (err) {
      console.warn("Falha ao atualizar disponibilidade:", err);
      alert("Não foi possível atualizar sua disponibilidade. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [profileId, available, saving]);

  if (!isOwner || !isPremium) return null;

  const baseClasses =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 border ";
  const onClasses = "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600";
  const offClasses =
    "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600";

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || saving}
      title={
        available
          ? "Você está disponível para receber contatos de Apoiadores Premium. Clique para desativar."
          : "Ative para permitir que Apoiadores Premium entrem em contato com você."
      }
      className={
        baseClasses +
        (available ? onClasses : offClasses) +
        (loading || saving ? " opacity-60 cursor-wait" : "") +
        " " +
        className
      }
    >
      <span aria-hidden="true">{available ? "🔔" : "🔕"}</span>
      {available ? "Disponível para Contato" : "Indisponível para Contato"}
    </button>
  );
}

/**
 * AvailabilityIndicator
 * --------------------------------------------------------------
 * Pequeno selo a ser exibido ao lado do pseudônimo / Índice de
 * Credibilidade quando um trabalhador Premium está com
 * isAvailableForContact === true.
 */
export function AvailabilityIndicator({ visible, className = "" }) {
  if (!visible) return null;
  return (
    <span
      title="Disponível para Contato por Apoiadores Premium"
      aria-label="Disponível para Contato"
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold " +
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 " +
        "border border-emerald-200 dark:border-emerald-700 " +
        className
      }
    >
      <span aria-hidden="true">🔔</span>
      Disponível
    </span>
  );
}
