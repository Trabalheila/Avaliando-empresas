// src/pages/IndiqueGanhe.jsx
//
// Página do programa "Indique e Ganhe". Apresenta o benefício, regras
// resumidas e um CTA para o usuário começar a indicar amigos.

import React from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";

export default function IndiqueGanhe({ theme = "dark", toggleTheme }) {
  const isDark = theme === "dark";
  const bg = isDark ? "#0b1220" : "#f8fafc";
  const card = isDark ? "#0f172a" : "#ffffff";
  const text = isDark ? "#e2e8f0" : "#0f172a";
  const muted = isDark ? "#94a3b8" : "#475569";
  const border = isDark ? "1px solid rgba(148,163,184,0.18)" : "1px solid #e2e8f0";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text }}>
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "24px 16px 80px",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #4f46e5 100%)",
            color: "#ffffff",
            borderRadius: 16,
            padding: "28px 22px",
            boxShadow: "0 18px 40px rgba(2, 6, 23, 0.28)",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">
            🎁
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
            Indique e Ganhe 30 Dias de Trabalhador Essencial!
          </h1>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 15, lineHeight: 1.5, opacity: 0.95 }}>
            Convide 5 amigos para se cadastrarem no Trabalhei Lá e ganhe 1 mês gratuito do plano
            Trabalhador Essencial — com acesso exclusivo a recursos premium da plataforma.
          </p>
        </div>

        <section
          style={{
            background: card,
            border,
            borderRadius: 14,
            padding: "20px 18px",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Como funciona</h2>
          <ol style={{ marginTop: 12, marginBottom: 0, paddingLeft: 22, lineHeight: 1.6, fontSize: 14, color: muted }}>
            <li>Compartilhe seu link de indicação com amigos e colegas.</li>
            <li>Quando 5 deles concluírem o cadastro, você recebe o benefício.</li>
            <li>O plano Trabalhador Essencial é ativado automaticamente por 30 dias.</li>
          </ol>
        </section>

        <section
          style={{
            background: card,
            border,
            borderRadius: 14,
            padding: "20px 18px",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Regras rápidas</h2>
          <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 22, lineHeight: 1.6, fontSize: 14, color: muted }}>
            <li>Cada amigo só conta uma vez (cadastros duplicados são desconsiderados).</li>
            <li>Os indicados devem confirmar o e-mail/perfil para serem validados.</li>
            <li>O benefício é limitado a uma ativação por usuário por período.</li>
          </ul>
        </section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 20 }}>
          <Link
            to="/minha-conta"
            style={{
              background: "#1d4ed8",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              boxShadow: "0 8px 18px rgba(29,78,216,0.35)",
            }}
          >
            Acessar minha conta
          </Link>
          <Link
            to="/"
            style={{
              background: "transparent",
              color: text,
              padding: "12px 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              border,
            }}
          >
            Voltar para a página inicial
          </Link>
        </div>
      </main>
    </div>
  );
}
