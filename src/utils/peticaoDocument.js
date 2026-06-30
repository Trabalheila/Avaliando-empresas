// src/utils/peticaoDocument.js
//
// Gera uma "Petição Inicial" pré-preenchida a partir do modelo salvo em
// /public/Petição Inicial.docx, inserindo automaticamente os dados pessoais
// do cliente (autor da ação) informados no perfil do trabalhador.
//
// O modelo tem o bloco do AUTOR em runs contíguos no document.xml, o que
// permite substituição textual confiável (sem depender de bibliotecas de
// template). Substituímos apenas a PRIMEIRA ocorrência de cada trecho — que
// corresponde ao autor; o bloco do réu (segunda ocorrência) é preservado.

import PizZip from "pizzip";

// O arquivo está em /public; o nome tem espaço e acento, então codificamos
// a URL para garantir o fetch correto em qualquer navegador/host.
const TEMPLATE_URL = encodeURI("/Petição Inicial.docx");

// Trecho exato do bloco do autor no modelo (uma única run de texto).
const AUTHOR_DESCRIPTOR =
  "nacionalidade, estado civil, profissão, portador do documento de identificação n.º __________, inscrito no CPF/NIF n.º __________, residente em __________";

/** Escapa caracteres especiais de XML para inserção segura no document.xml. */
function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Monta o endereço completo a partir dos campos do perfil. */
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
 * Carrega o modelo, preenche os dados do autor e devolve um Blob (.docx).
 *
 * @param {object} client  dados pessoais do cliente (clientProfiles/{uid}).
 * @param {string} [fallbackName]  nome a usar caso o perfil não tenha fullName.
 * @returns {Promise<Blob>}
 */
export async function generatePeticaoBlob(client, fallbackName = "") {
  const data = client || {};

  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) {
    throw new Error("Não foi possível carregar o modelo da petição.");
  }
  const arrayBuffer = await res.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  const docPath = "word/document.xml";
  let xml = zip.file(docPath).asText();

  // 1) Nome do autor.
  const fullName = (data.fullName || fallbackName || "").trim();
  if (fullName) {
    xml = xml.replace("NOME DO AUTOR", escapeXml(fullName.toUpperCase()));
  }

  // 2) Qualificação do autor (nacionalidade, estado civil, profissão, RG, CPF,
  //    endereço). Substitui apenas a primeira ocorrência (= autor).
  const maritalStatus = (data.maritalStatus || "estado civil").trim();
  const profession = (data.profession || "profissão").trim();
  const rg = (data.rg || "__________").trim();
  const cpf = (data.cpf || "__________").trim();
  const address = buildFullAddress(data) || "__________";

  const filledDescriptor =
    `brasileiro(a), ${maritalStatus}, ${profession}, ` +
    `portador do documento de identificação n.º ${rg}, ` +
    `inscrito no CPF/NIF n.º ${cpf}, residente em ${address}`;

  xml = xml.replace(AUTHOR_DESCRIPTOR, escapeXml(filledDescriptor));

  zip.file(docPath, xml);

  return zip.generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Gera e dispara o download da petição pré-preenchida.
 *
 * @param {object} client  dados pessoais do cliente.
 * @param {string} [fallbackName]  nome alternativo (alias do caso).
 */
export async function downloadPeticao(client, fallbackName = "") {
  const blob = await generatePeticaoBlob(client, fallbackName);
  const url = URL.createObjectURL(blob);
  const safeName = (client?.fullName || fallbackName || "cliente")
    .toString()
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Peticao_Inicial_${safeName || "cliente"}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
