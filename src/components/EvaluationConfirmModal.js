import React from "react";

/**
 * Modal de confirmação exibido logo após o trabalhador clicar em "Enviar
 * Avaliação" (com todos os critérios já preenchidos) e antes de a avaliação
 * ser efetivamente submetida.
 *
 * Props:
 *  - open: boolean — controla a visibilidade.
 *  - onConfirm: () => void — usuário clicou "Confirmar envio".
 *  - onReview: () => void — usuário clicou "Revisar avaliação".
 */
export default function EvaluationConfirmModal({ open, onConfirm, onReview }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirmação de envio da avaliação"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 16,
          backgroundColor: "#ffffff",
          color: "#0f172a",
          boxShadow: "0 24px 48px rgba(2, 6, 23, 0.28)",
          padding: "22px 22px 18px 22px",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1e3a8a" }}>
          Confirmar envio da avaliação
        </h2>

        <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.5, fontSize: 14, color: "#334155" }}>
          Sua avaliação será registrada. A nota desta empresa só será
          contabilizada publicamente caso seu perfil seja verificado, garantindo
          que as avaliações sejam justas e confiáveis.
        </p>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              border: "none",
              borderRadius: 12,
              padding: "12px 16px",
              backgroundColor: "#1d4ed8",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Confirmar envio
          </button>
          <button
            type="button"
            onClick={onReview}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "12px 16px",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Revisar avaliação
          </button>
        </div>
      </div>
    </div>
  );
}
