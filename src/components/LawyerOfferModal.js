import React from "react";

/**
 * Popup exibido ao trabalhador logo após submeter uma avaliação com nota
 * geral abaixo de 3.0. Oferece encaminhamento para a busca de profissionais
 * especializados (página "encontrar especialista").
 *
 * Props:
 *  - open: boolean — controla a visibilidade.
 *  - onAccept: () => void — usuário clicou "Quero buscar ajuda".
 *  - onDecline: () => void — usuário clicou "Não, obrigado".
 */
export default function LawyerOfferModal({ open, onAccept, onDecline }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Oferta de ajuda jurídica"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
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
        <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">
          ⚖️
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1e3a8a" }}>
          Precisa de ajuda?
        </h2>

        <p style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.5, fontSize: 14, color: "#334155" }}>
          Você sabia que pode contar com profissionais especializados em direitos
          trabalhistas e saúde ocupacional? Se precisar de orientação, estamos aqui
          para te ajudar a dar o próximo passo.
        </p>

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            onClick={onAccept}
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
            Quero buscar ajuda
          </button>
          <button
            type="button"
            onClick={onDecline}
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
            Não, obrigado
          </button>
        </div>
      </div>
    </div>
  );
}
