// src/components/ReferralBanner.jsx
//
// Banner discreto, fixo na parte inferior da tela, que divulga o programa
// "Indique e Ganhe". Usa localStorage para não reaparecer depois que o
// usuário fecha. Aparece apenas para visitantes que ainda não participaram.
//
// Props:
//   - hasReferred (boolean, opcional): se true, esconde o banner (para usuários
//     que já participaram do programa).

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "referral_banner_dismissed_v1";

export default function ReferralBanner({ hasReferred = false }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasReferred) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // localStorage indisponível — exibe o banner mesmo assim.
    }
    if (!dismissed) {
      // Pequeno atraso para não competir com o carregamento inicial.
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [hasReferred]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const goToProgram = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    navigate("/indique-e-ganhe");
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Programa Indique e Ganhe"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 70,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 720,
          width: "100%",
          background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #4f46e5 100%)",
          color: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 18px 40px rgba(2, 6, 23, 0.28)",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          border: "1px solid rgba(255,255,255,0.18)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            fontSize: 28,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          🎁
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              lineHeight: 1.25,
              marginBottom: 2,
            }}
          >
            Indique e Ganhe 30 Dias de Trabalhador Essencial!
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.35,
              opacity: 0.95,
            }}
          >
            Convide 5 amigos para o Trabalhei Lá e ganhe acesso exclusivo ao plano
            Trabalhador Essencial por um mês.
          </div>
        </div>

        <button
          type="button"
          onClick={goToProgram}
          style={{
            flexShrink: 0,
            background: "#ffffff",
            color: "#1d4ed8",
            border: "none",
            borderRadius: 10,
            padding: "9px 14px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
          }}
        >
          Participar
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar banner"
          title="Fechar"
          style={{
            flexShrink: 0,
            background: "rgba(255,255,255,0.15)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 8,
            width: 30,
            height: 30,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
