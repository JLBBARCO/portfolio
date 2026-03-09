// /api/github-languages.js
export default async function handler(req, res) {
  const owner = req.query?.owner;
  const repo = req.query?.repo;

  if (!owner || !repo) {
    return res.status(400).json({ error: "owner and repo are required" });
  }

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

  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
    let response = await fetch(url, { headers: buildHeaders(true) });

    if ((response.status === 401 || response.status === 403) && githubToken) {
      response = await fetch(url, { headers: buildHeaders(false) });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch languages",
        details:
          response.status === 401 || response.status === 403
            ? "GitHub token invalid/without permission, or rate limit reached."
            : "GitHub API request failed.",
      });
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch languages",
      details: "Unexpected server error while calling GitHub API.",
    });
  }
}
