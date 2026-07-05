// src/utils/legalDocuments.js
//
// Gera documentos jurídicos pré-preenchidos (Contrato de Honorários,
// Declaração de Hipossuficiência e Termo de Declaração de Fatos) a partir
// dos modelos .docx salvos em /public, inserindo automaticamente os dados
// pessoais do cliente (clientProfiles/{uid}).
//
// Mesma abordagem client-side usada na Procuração/Petição
// (src/utils/peticaoDocument.js): fazemos o fetch do modelo, substituímos os
// marcadores {{TOKEN}} no word/document.xml e disparamos o download — sem
// depender de rota de backend. Os modelos são criados por
// src/gerar-templates.js (que usa marcadores {{...}} em runs contíguos, o que
// torna a substituição textual confiável).

import PizZip from "pizzip";

/** Escapa caracteres especiais de XML para inserção segura no document.xml. */
function escapeXml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Escapa caracteres especiais de regex (ex.: parênteses em CASADO(A)). */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Monta o endereço completo a partir dos campos do perfil do cliente. */
function buildFullAddress(client) {
  return [
    client.address,
    client.addressNumber && `nº ${client.addressNumber}`,
    client.addressComplement,
    client.neighborhood,
    client.city && client.state
      ? `${client.city}/${client.state}`
      : client.city || client.state,
    client.cep && `CEP ${client.cep}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Monta o objeto de dados do cliente com as mesmas chaves esperadas pelos
 * modelos (NOME_COMPLETO, CPF, RG, ESTADO_CIVIL, PROFISSAO,
 * ENDERECO_COMPLETO, TELEFONE e E-MAIL, entre outros).
 */
export function buildClientTemplateData(client, fallbackName = "") {
  const data = client || {};
  const fullName = (data.fullName || fallbackName || "").trim();
  const maritalStatus = (data.maritalStatus || "").trim();
  return {
    NOME_COMPLETO: fullName,
    CPF: (data.cpf || "").trim(),
    RG: (data.rg || "").trim(),
    ESTADO_CIVIL: maritalStatus,
    "CASADO(A)": maritalStatus,
    PROFISSAO: (data.profession || "").trim(),
    ENDERECO_COMPLETO: buildFullAddress(data),
    TELEFONE: (data.phone || "").trim(),
    "E-MAIL": (data.email || "").trim(),
    CIDADE_CLIENTE: (data.city || "").trim(),
    DATA_DE_NASCIMENTO: (data.birthDate || "").trim(),
  };
}

/**
 * Carrega o modelo .docx indicado, substitui os marcadores {{TOKEN}} pelos
 * valores em `fields` e devolve um Blob pronto para download.
 *
 * @param {string} templateFile  nome do arquivo em /public (ex.: "contrato_honorarios.docx").
 * @param {object} fields        mapa TOKEN -> valor (sem as chaves {{ }}).
 * @returns {Promise<Blob>}
 */
async function fillTemplateBlob(templateFile, fields) {
  const res = await fetch(encodeURI(`/${templateFile}`));
  if (!res.ok) {
    throw new Error("Não foi possível carregar o modelo do documento.");
  }
  const arrayBuffer = await res.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const docPath = "word/document.xml";
  let xml = zip.file(docPath).asText();

  // Substitui cada marcador conhecido (todas as ocorrências). Valores vazios
  // viram um traço de preenchimento para manter o documento editável.
  Object.entries(fields).forEach(([token, value]) => {
    const re = new RegExp(escapeRegExp(`{{${token}}}`), "g");
    const safe = escapeXml(value) || "__________";
    xml = xml.replace(re, safe);
  });

  // Qualquer marcador remanescente (não mapeado) vira traço de preenchimento.
  xml = xml.replace(/\{\{[^}]+\}\}/g, "__________");

  zip.file(docPath, xml);

  return zip.generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/** Dispara o download de um Blob com o nome informado. */
function triggerDownload(blob, downloadName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome de arquivo seguro a partir do nome do cliente. */
function safeClientName(client, fallbackName) {
  return (client?.fullName || fallbackName || "Cliente")
    .toString()
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim()
    .slice(0, 80) || "Cliente";
}

/**
 * Gera e baixa um documento jurídico pré-preenchido.
 *
 * @param {object}  opts
 * @param {string}  opts.templateFile  arquivo do modelo em /public.
 * @param {string}  opts.docLabel      rótulo usado no nome do arquivo baixado.
 * @param {object}  opts.client        dados pessoais do cliente.
 * @param {string} [opts.fallbackName] nome alternativo (alias do caso).
 */
export async function downloadLegalDocument({
  templateFile,
  docLabel,
  client,
  fallbackName = "",
}) {
  const fields = buildClientTemplateData(client, fallbackName);
  const blob = await fillTemplateBlob(templateFile, fields);
  triggerDownload(blob, `${docLabel} de ${safeClientName(client, fallbackName)}.docx`);
}

/** Contrato de Prestação de Serviços Jurídicos e Honorários (Ad Exitum). */
export function downloadContrato(client, fallbackName = "") {
  return downloadLegalDocument({
    templateFile: "contrato_honorarios.docx",
    docLabel: "Contrato de Honorários",
    client,
    fallbackName,
  });
}

/** Procuração Ad Judicia et Extra (poderes gerais para o foro). */
export function downloadProcuracao(client, fallbackName = "") {
  return downloadLegalDocument({
    templateFile: "procuracao.docx",
    docLabel: "Procuração",
    client,
    fallbackName,
  });
}

/** Declaração de Hipossuficiência Econômica. */
export function downloadDeclaracao(client, fallbackName = "") {
  return downloadLegalDocument({
    templateFile: "declaracao_hipossuficiencia.docx",
    docLabel: "Declaração de Hipossuficiência",
    client,
    fallbackName,
  });
}

/** Ficha de Entrevista e Termo de Declaração de Fatos. */
export function downloadTermoFatos(client, fallbackName = "") {
  return downloadLegalDocument({
    templateFile: "termo_fatos.docx",
    docLabel: "Termo de Fatos",
    client,
    fallbackName,
  });
}
