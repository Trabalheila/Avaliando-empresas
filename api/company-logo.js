function normalizeDomain(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function withTimeout(ms = 4500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function extractMetaContent(html, propertyName) {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const rx2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i"
  );

  return html.match(rx1)?.[1] || html.match(rx2)?.[1] || "";
}

function extractIconHref(html) {
  const rx = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i;
  return html.match(rx)?.[1] || "";
}

function toAbsoluteUrl(baseUrl, maybeRelativeUrl) {
  if (!maybeRelativeUrl) return "";
  try {
    return new URL(maybeRelativeUrl, baseUrl).toString();
  } catch {
    return "";
  }
}

function fallbackIconUrl(domain, size) {
  const safeDomain = encodeURIComponent(domain);
  return `https://www.google.com/s2/favicons?domain=${safeDomain}&sz=${size}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawDomain = req.query?.domain || req.query?.website || "";
  const domain = normalizeDomain(rawDomain);
  const parsedSize = Number.parseInt(String(req.query?.size || "128"), 10);
  const size = Number.isFinite(parsedSize) ? Math.min(Math.max(parsedSize, 32), 256) : 128;

  if (!domain) {
    return res.status(400).json({ error: "domain/website obrigatorio" });
  }

  const target = `https://${domain}`;
  const timer = withTimeout();

  try {
    const pageResponse = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: timer.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TrabalheiLaLogoBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    timer.clear();

    if (!pageResponse.ok) {
      return res.redirect(302, fallbackIconUrl(domain, size));
    }

    const html = await pageResponse.text();
    const finalPageUrl = pageResponse.url || target;

    const ogImage = extractMetaContent(html, "og:image");
    const twitterImage = extractMetaContent(html, "twitter:image");
    const iconHref = extractIconHref(html);

    const resolved =
      toAbsoluteUrl(finalPageUrl, ogImage) ||
      toAbsoluteUrl(finalPageUrl, twitterImage) ||
      toAbsoluteUrl(finalPageUrl, iconHref);

    if (resolved) {
      return res.redirect(302, resolved);
    }

    return res.redirect(302, fallbackIconUrl(domain, size));
  } catch (error) {
    timer.clear();
    return res.redirect(302, fallbackIconUrl(domain, size));
  }
}
