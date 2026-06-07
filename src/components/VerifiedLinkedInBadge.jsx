// src/components/VerifiedLinkedInBadge.jsx
//
// Selo discreto exibido ao lado de avaliações cujo autor confirmou
// ter trabalhado na empresa avaliada via histórico LinkedIn.
//
// IMPORTANTE: Este selo não expõe nome, foto ou link do perfil
// LinkedIn do usuário. Atesta apenas a autenticidade do vínculo.

import React from "react";
import { FaLinkedin } from "react-icons/fa";

export default function VerifiedLinkedInBadge({ className = "" }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold " +
        "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 " +
        "border border-emerald-200 dark:border-emerald-700 " +
        className
      }
      title="Conta verificada como ex/atual funcionário desta empresa via LinkedIn. O perfil LinkedIn em si permanece privado."
      aria-label="Profissional verificado via LinkedIn"
    >
      <FaLinkedin aria-hidden="true" className="text-[#0A66C2] text-[12px]" />
      ✓ Profissional Verificado via LinkedIn
    </span>
  );
}
