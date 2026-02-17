import React from "react";

export default function App() {
  return (
    <div style={{ padding: 24 }}>
      <h1>App carregou</h1>

      {/* Debug temporário (pode remover depois) */}
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          background: "#111",
          color: "#fff",
          padding: 8,
          fontSize: 12,
          zIndex: 99999,
        }}
      >
        LINKEDIN_ID: {String(!!process.env.REACT_APP_LINKEDIN_CLIENT_ID)}
      </div>
    </div>
  );
}
