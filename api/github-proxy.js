function getGitHubToken() {
  const rawToken = process.env.GITHUB_TOKEN || "";
  const hasPlaceholder = /your_token_here/i.test(rawToken);
  return hasPlaceholder ? "" : rawToken;
}

function buildHeaders(useToken, token) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "Vercel-Serverless-Function",
    ...(useToken && token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeGitHubPath(rawPath) {
  if (!rawPath || typeof rawPath !== "string") return "";
  const value = rawPath.trim();
  if (!value) return "";

  // Only allow relative API paths so callers cannot turn this into an open proxy.
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//")) return "";
  if (/^\/https?:/i.test(value)) return "";
  return value;
}

function getCacheHeaderForPath(pathname) {
  if (/\/languages(\?|$)/.test(pathname)) {
    return "s-maxage=1800, stale-while-revalidate";
  }

  if (/\/commits(\?|$)|\/pulls(\?|$)/.test(pathname)) {
    return "s-maxage=900, stale-while-revalidate";
  }

  return "s-maxage=600, stale-while-revalidate";
}

export default async function handler(req, res) {
  const path = normalizeGitHubPath(req.query?.path);
  if (!path) {
    return res.status(400).json({
      error: "Invalid path",
      details: "Use a relative GitHub API path, for example /repos/owner/repo",
    });
  }

  const githubToken = getGitHubToken();
  const targetUrl = `https://api.github.com${path}`;

  try {
    let response = await fetch(targetUrl, {
      headers: buildHeaders(Boolean(githubToken), githubToken),
    });

    if ((response.status === 401 || response.status === 403) && githubToken) {
      response = await fetch(targetUrl, {
        headers: buildHeaders(false, githubToken),
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch GitHub data",
        details:
          response.status === 401 || response.status === 403
            ? "GitHub token invalid/without permission, or rate limit reached."
            : "GitHub API request failed.",
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", getCacheHeaderForPath(path));
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch GitHub data",
      details: "Unexpected server error while calling GitHub API.",
    });
  }
}
