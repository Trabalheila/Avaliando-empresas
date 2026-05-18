import React, { useState, useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * WelcomeModal
 * --------------------------------------------------------------
 * Modal de boas-vindas exibido logo após a conclusão do cadastro
 * de um Apoiador. Aparece apenas uma vez: ao fechar, grava
 * `welcomeModalShown: true` no documento de `apoiadores/{id}`.
 *
 * Props:
 *   open        boolean      Controla visibilidade do modal.
 *   apoiadorId  string       Id do documento em `apoiadores`.
 *   onClose     () => void   Callback executado ao fechar.
 */

const TIPOS_APOIADOR = [
  {
    titulo: "Advogado",
    descricao:
      "orientação sobre direitos trabalhistas e situações de assédio ou demissão irregular.",
    icone: "⚖️",
  },
  {
    titulo: "Médico",
    descricao: "suporte sobre saúde ocupacional e condições de trabalho.",
    icone: "🩺",
  },
  {
    titulo: "Psicólogo",
    descricao:
      "apoio emocional a trabalhadores em situações de pressão e burnout.",
    icone: "🧠",
  },
  {
    titulo: "Consultor de RH",
    descricao: "análise de cultura organizacional e boas práticas.",
    icone: "👥",
  },
  {
    titulo: "Recrutador",
    descricao: "orientação sobre mercado de trabalho e recolocação.",
    icone: "🎯",
  },
  {
    titulo: "Contador",
    descricao: "esclarecimentos sobre holerite, benefícios e tributação.",
    icone: "📊",
  },
  {
    titulo: "Engenheiro de Segurança do Trabalho",
    descricao: "avaliação de condições e riscos no ambiente de trabalho.",
    icone: "🦺",
  },
  {
    titulo: "Fisioterapeuta Ocupacional",
    descricao:
      "orientação sobre ergonomia e lesões relacionadas ao trabalho.",
    icone: "💪",
  },
];

export default function WelcomeModal({ open, apoiadorId, onClose }) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      if (apoiadorId) {
        await updateDoc(doc(db, "apoiadores", apoiadorId), {
          welcomeModalShown: true,
        });
      }
    } catch (err) {
      console.warn("Falha ao registrar welcomeModalShown:", err);
    } finally {
      setClosing(false);
      if (typeof onClose === "function") onClose();
    }
  }, [apoiadorId, closing, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-blue-100 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-blue-100 dark:border-slate-700 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 rounded-t-2xl">
          <div className="text-4xl mb-2">🎉</div>
          <h2
            id="welcome-modal-title"
            className="text-2xl font-extrabold text-slate-800 dark:text-white"
          >
            Bem-vindo ao Trabalhei Lá, Apoiador!
          </h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
            Apoiadores são profissionais especializados que contribuem com sua
            expertise para ajudar trabalhadores a entenderem melhor seus
            direitos, saúde, carreira e finanças. Sua presença torna a
            plataforma mais completa e confiável.
          </p>

          <div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-200 mb-3">
              Como você pode contribuir:
            </h3>
            <ul className="space-y-2">
              {TIPOS_APOIADOR.map((tipo) => (
                <li
                  key={tipo.titulo}
                  className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700"
                >
                  <span className="text-xl shrink-0" aria-hidden="true">
                    {tipo.icone}
                  </span>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
                    <strong className="text-slate-800 dark:text-slate-100">
                      {tipo.titulo}:
                    </strong>{" "}
                    {tipo.descricao}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 italic border-l-4 border-blue-500 pl-3 bg-blue-50 dark:bg-slate-900/50 py-2 rounded-r">
            Seu perfil verificado dará mais credibilidade às suas contribuições
            na plataforma.
          </p>
        </div>

        <div className="px-6 pb-6 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold transition shadow-md"
          >
            {closing ? "Salvando..." : "Entendi, vamos começar!"}
          </button>
        </div>
      </div>
    </div>
  );
}
