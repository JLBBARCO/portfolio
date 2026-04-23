// /api/github.js
export default async function handler(req, res) {
  const owner = req.query?.owner || "JLBBARCO";
  const now = Date.now();

  // Use token from environment when available (local .env or Vercel env vars).
  const rawToken = process.env.GITHUB_TOKEN || "";
  const hasPlaceholder = /your_token_here/i.test(rawToken);
  const githubToken = hasPlaceholder ? "" : rawToken;

  function buildHeaders(useToken) {
    return {
      Accept: "application/vnd.github+json",
      "User-Agent": "Vercel-Serverless-Function",
      ...(useToken && githubToken
        ? { Authorization: `Bearer ${githubToken}` }
        : {}),
    };
  }

  async function fetchReposWithHeaders(headers) {
    const urls = [
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&direction=desc&type=owner&t=${now}`,
    ];

    const responses = await Promise.all(urls.map((u) => fetch(u, { headers })));
    return responses;
  }

  try {
    let usedToken = Boolean(githubToken);
    let responses = await fetchReposWithHeaders(buildHeaders(usedToken));

    // If token is invalid/expired, retry once without auth so local dev keeps working.
    const authFailed = responses.some(
      (r) => r.status === 401 || r.status === 403,
    );
    if (usedToken && authFailed) {
      usedToken = false;
      responses = await fetchReposWithHeaders(buildHeaders(false));
    }

    const allFailed = responses.every((r) => !r.ok);
    if (allFailed) {
      const status = responses[0]?.status || 500;
      return res.status(status).json({
        error: "Failed to fetch GitHub data",
        details:
          status === 401 || status === 403
            ? "GitHub token invalid/without permission, or rate limit reached."
            : "GitHub API request failed.",
      });
    }

    const data = await Promise.all(
      responses.map((r) => (r.ok ? r.json() : [])),
    );

    // Owner-only list: projects created by the user and forks created by the user.
    const combined = [...data[0]];

    // Retorna para o seu site
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // Cache na rede da Vercel por 1h
    return res.status(200).json(combined);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch GitHub data",
      details: "Unexpected server error while calling GitHub API.",
    });
  }
}
