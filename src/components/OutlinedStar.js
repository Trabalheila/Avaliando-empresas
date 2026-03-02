// src/components/OutlinedStar.js
import React from "react";
import { FaStar } from "react-icons/fa";

function OutlinedStar({ active, onClick, size = 18, label }) {
  const outlineScale = 1.24; // Fator de escala para a estrela de contorno
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ padding: 0, margin: 0, border: 0, background: "transparent", cursor: "pointer", lineHeight: 0 }}>
      <span style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle" }}>
        {/* Estrela de contorno (preta, um pouco maior) */}
        <span style={{ position: "absolute", left: 0, top: 0, transform: `scale(${outlineScale})`, transformOrigin: "center" }}>
          <FaStar size={size} color="#000" />
        </span>
        {/* Estrela principal (amarela ou cinza) */}
        <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
      </span>
    </button>
  );
}

export default OutlinedStar;