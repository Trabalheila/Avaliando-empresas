export default async function handler(req, res) {
  const { cnpj } = req.query;
  const digits = cnpj.replace(/\D/g, '');

  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);

  if (!response.ok) return res.status(response.status).json({ error: 'CNPJ não encontrado' });

  const data = await response.json();
  return res.status(200).json(data);
}
