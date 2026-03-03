const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  }),
});

if (!tokenRes.ok) {
  const errorText = await tokenRes.text();
  return res.status(400).json({ error: "Erro ao obter token", detail: errorText });
}

const tokenData = await tokenRes.json();