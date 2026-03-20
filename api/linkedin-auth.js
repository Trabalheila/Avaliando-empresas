export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) {
    return res.status(400).json({ error: "Parâmetros obrigatórios ausentes: code e redirectUri." });
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Variáveis de ambiente do LinkedIn não configuradas." });
  }

  try {
    const tokenEndpoint = "https://www.linkedin.com/oauth/v2/accessToken";
    const baseParams = {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    };

    const requestToken = async ({ useBasicAuth }) => {
      const params = new URLSearchParams(baseParams);
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
      };

      if (useBasicAuth) {
        const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        headers.Authorization = `Basic ${basic}`;
      } else {
        params.set("client_id", clientId);
        params.set("client_secret", clientSecret);
      }

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers,
        body: params,
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || `Erro HTTP ${response.status}` };
      }

      return { response, data };
    };

    let { response: tokenRes, data: tokenData } = await requestToken({ useBasicAuth: false });

    const tokenError = String(tokenData?.error || "").toLowerCase();
    const tokenErrorDescription = String(tokenData?.error_description || tokenData?.message || "").toLowerCase();
    const isClientAuthFailure =
      tokenError.includes("invalid_client") || tokenErrorDescription.includes("client authentication failed");

    if ((!tokenRes.ok || tokenData?.error) && isClientAuthFailure) {
      const secondAttempt = await requestToken({ useBasicAuth: true });
      tokenRes = secondAttempt.response;
      tokenData = secondAttempt.data;
    }

    if (!tokenRes.ok || tokenData?.error || !tokenData?.access_token) {
      const rawError = tokenData?.error_description || tokenData?.error || `Erro HTTP ${tokenRes.status}`;
      const normalizedError = String(rawError || "").toLowerCase();
      const isInvalidClient =
        normalizedError.includes("client authentication failed") ||
        normalizedError.includes("invalid_client");

      console.error("Erro ao gerar token LinkedIn:", {
        status: tokenRes.status,
        error: tokenData?.error,
        error_description: tokenData?.error_description,
      });

      return res.status(400).json({
        error: isInvalidClient
          ? "Credenciais LinkedIn inválidas no backend (LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET)."
          : rawError || "Erro ao gerar token",
        detail: tokenData?.error || null,
      });
    }

    const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

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
    });
  } catch (err) {
    console.error("Erro interno no backend LinkedIn:", err);
    return res.status(500).json({
      error: "Erro interno do servidor",
      detail: err.message,
    });
  }
}