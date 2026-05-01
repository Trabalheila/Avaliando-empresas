import React, { useState } from "react";
import { isPremiumSupporter } from "../utils/rbac";

/**
 * SupporterContactButton
 * ------------------------------------------------------------------
 * Botão "Solicitar contato" exibido apenas para Apoiadores Premium.
 * Permite ao Apoiador Premium enviar uma solicitação de contato
 * profissional para o avaliador (que pode ter autorizado isso em
 * "Ser Contatado por Profissionais Especializados", recurso premium
 * do trabalhador).
 *
 * Para usuários que não são Apoiadores Premium, retorna `null` —
 * o botão fica completamente invisível.
 *
 * O fluxo concreto de contato é intermediado pela plataforma
 * (preserva o anonimato do avaliador): clicar abre um popup com
 * instruções para enviar a solicitação via e-mail oficial,
 * referenciando pseudônimo e empresa.
 */
export default function SupporterContactButton({
  reviewId,
  pseudonym,
  companyName,
  authorProfileId,
  className = "",
}) {
  const [open, setOpen] = useState(false);

  if (!isPremiumSupporter()) return null;

  const subject = encodeURIComponent(
    `Solicitação de contato profissional - Avaliação ${pseudonym || "anônima"} (${companyName || "empresa"})`
  );
  const body = encodeURIComponent(
    [
      "Olá, equipe Trabalhei Lá!",
      "",
      "Sou Apoiador Premium e gostaria de solicitar contato com o(a) avaliador(a) abaixo,",
      "caso ele(a) tenha autorizado contato profissional em seu perfil:",
      "",
      `• Pseudônimo: ${pseudonym || "—"}`,
      `• Empresa avaliada: ${companyName || "—"}`,
      `• ID da avaliação: ${reviewId || "—"}`,
      `• ID do perfil do avaliador: ${authorProfileId || "—"}`,
      "",
      "Aguardo retorno. Obrigado!",
    ].join("\n")
  );
  const mailto = `mailto:contato@trabalheila.com.br?subject=${subject}&body=${body}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Solicitar contato profissional com este avaliador (recurso exclusivo Apoiador Premium)"
        className={
          "inline-flex items-center gap-1 text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-full px-3 py-1 transition shadow-sm " +
          className
        }
      >
        <span aria-hidden="true">📩</span>
        Solicitar contato
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Solicitar contato com avaliador"
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
              maxWidth: 540,
              borderRadius: 14,
              backgroundColor: "#ffffff",
              color: "#0f172a",
              boxShadow: "0 24px 48px rgba(2, 6, 23, 0.28)",
              padding: "20px 22px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#6b21a8" }}>
              📩 Solicitar contato com avaliador
            </h2>
            <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
              Como recurso exclusivo de <strong>Apoiador Premium</strong>, você pode solicitar
              contato profissional com este(a) avaliador(a). A intermediação é feita pela
              equipe Trabalhei Lá, que verifica se o(a) avaliador(a) autorizou contato
              em seu perfil — preservando o anonimato.
            </p>
            <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 13, color: "#475569" }}>
              <li>Pseudônimo: <strong>{pseudonym || "—"}</strong></li>
              <li>Empresa: <strong>{companyName || "—"}</strong></li>
            </ul>
            <p style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>
              Clique no botão abaixo para abrir um e-mail pré-preenchido. Sua solicitação
              será encaminhada apenas se o(a) avaliador(a) consentiu previamente.
            </p>

            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "1px solid #94a3b8",
                  borderRadius: 10,
                  padding: "8px 14px",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <a
                href={mailto}
                onClick={() => setOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 14px",
                  backgroundColor: "#7e22ce",
                  color: "#ffffff",
                  fontWeight: 700,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                Enviar solicitação por e-mail
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
