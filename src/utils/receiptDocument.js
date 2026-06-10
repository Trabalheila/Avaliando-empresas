// src/utils/receiptDocument.js
//
// Geração de recibo / nota de atendimento no cliente, sem dependências
// externas. Monta um HTML formatado e abre a caixa de impressão do
// navegador, onde o usuário pode "Salvar como PDF".

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBRL(value) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const d =
      typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return String(value);
  }
}

/**
 * Monta o HTML do recibo de uma consulta.
 * @param {object} consulta dados da consulta/atendimento
 */
export function buildReceiptHtml(consulta = {}) {
  const numero =
    consulta.reciboNumero ||
    consulta.id ||
    `R-${Date.now().toString().slice(-8)}`;
  const especialista =
    consulta.apoiadorNome || consulta.especialistaNome || "Profissional";
  const especialidade = consulta.especialidade || consulta.tipo || "Atendimento";
  const cliente = consulta.workerNome || consulta.clienteNome || "Cliente";
  const valor = formatBRL(consulta.valor ?? consulta.amount ?? consulta.preco);
  const data = formatDate(
    consulta.scheduledFor || consulta.dataConsulta || consulta.createdAt
  );
  const documento =
    String(consulta.tipoDocumento || "recibo").toLowerCase() === "nota_fiscal"
      ? "Nota Fiscal de Serviço"
      : "Recibo de Atendimento";
  const formato =
    consulta.modalidade === "video" || consulta.formato === "video"
      ? "Videochamada"
      : consulta.modalidade === "chat" || consulta.formato === "chat"
      ? "Chat"
      : consulta.formato || "Atendimento";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(documento)} ${escapeHtml(numero)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
  .doc { max-width: 640px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; }
  h1 { color: #0f766e; font-size: 20px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
  td.label { color: #64748b; width: 45%; }
  td.value { color: #0f172a; font-weight: 600; text-align: right; }
  .total { margin-top: 16px; padding: 12px 16px; background: #f0fdfa; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
  .total .amount { font-size: 20px; font-weight: 800; color: #0f766e; }
  .foot { margin-top: 24px; font-size: 11px; color: #94a3b8; line-height: 1.5; }
  @media print { body { padding: 0; } .doc { border: none; } }
</style>
</head>
<body>
  <div class="doc">
    <h1>${escapeHtml(documento)}</h1>
    <p class="sub">Nº ${escapeHtml(numero)} · Emitido pela plataforma Trabalhei Lá</p>
    <table>
      <tr><td class="label">Profissional</td><td class="value">${escapeHtml(especialista)}</td></tr>
      <tr><td class="label">Especialidade</td><td class="value">${escapeHtml(especialidade)}</td></tr>
      <tr><td class="label">Cliente / Paciente</td><td class="value">${escapeHtml(cliente)}</td></tr>
      <tr><td class="label">Data do atendimento</td><td class="value">${escapeHtml(data)}</td></tr>
      <tr><td class="label">Formato</td><td class="value">${escapeHtml(formato)}</td></tr>
    </table>
    <div class="total">
      <span>Valor do atendimento</span>
      <span class="amount">${escapeHtml(valor)}</span>
    </div>
    <p class="foot">
      Documento gerado automaticamente para fins de comprovação. A responsabilidade
      pela emissão de nota fiscal do serviço prestado é do profissional. A plataforma
      Trabalhei Lá intermedeia o agendamento e o pagamento.
    </p>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`;
}

/**
 * Abre o recibo em uma nova aba e dispara a impressão (Salvar como PDF).
 * Retorna false se o pop-up foi bloqueado.
 */
export function openReceiptPdf(consulta = {}) {
  const html = buildReceiptHtml(consulta);
  const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
