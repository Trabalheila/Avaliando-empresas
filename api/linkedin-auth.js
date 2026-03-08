// /api/linkedin-auth.js (Exemplo de como deve estar)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, redirectUri } = req.body;

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Variáveis de ambiente do LinkedIn não configuradas." });
  }

  try {
    // 🔑 Troca o code por access_token
    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );
const tokenData = await tokenRes.json();

if (tokenData.error) {
  console.error("Erro ao gerar token LinkedIn:", tokenData.error_description || tokenData.error);
  return res.status(400).json({
    error: tokenData.error_description || "Erro ao gerar token",
    detail: tokenData.error,
  });
}

// 👤 Buscar dados do usuário (OpenID)
const userRes = await fetch(
  "https://api.linkedin.com/v2/userinfo",
  {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  }
);

const userInfo = await userRes.json();

if (userInfo.error) {
  console.error("Erro ao buscar dados do usuário LinkedIn:", userInfo.error_description || userInfo.error);
  return res.status(400).json({
    error: userInfo.error_description || "Erro ao buscar dados do usuário",
    detail: userInfo.error,
  });
}

return res.status(200).json({
  id: userInfo.sub,
  name: userInfo.name,
  email: userInfo.email,
  picture: userInfo.picture,
  loginProvider: "linkedin",
  linkedInUrl: userInfo.profile || userInfo.profile_url || null,
  linkedinExperiences: Array.isArray(userInfo.experiences)
    ? userInfo.experiences
    : Array.isArray(userInfo.positions)
      ? userInfo.positions
      : [],
  // Observação: para a maioria das apps, o userinfo não retorna experiências.
  // Se o LinkedIn disponibilizar esse dado para sua aplicação, o campo acima será importado automaticamente.
});
  } catch (err) {
    console.error("Erro interno no backend LinkedIn:", err);
    return res.status(500).json({
      error: "Erro interno do servidor",
      detail: err.message,
    });
  }
}