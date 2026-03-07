// /api/cnpj.js
// Proxy simples para consulta de CNPJ usando a API pública Receitaws.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cnpj } = req.body;

  if (!cnpj) {
    return res.status(400).json({ error: "CNPJ não informado." });
  }

  const cleaned = String(cnpj).replace(/\D/g, "");

  if (cleaned.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Deve ter 14 dígitos." });
  }

  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cleaned}`);
    const data = await response.json();

    if (data.status && data.status.toLowerCase() === "ERROR") {
      return res.status(400).json({ error: data.message || "CNPJ não encontrado." });
    }

    // Retorna o resultado completo para que o front possa exibir o nome e avaliar.
    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro ao consultar CNPJ:", err);
    return res.status(500).json({ error: "Falha ao consultar CNPJ." });
  }
}
