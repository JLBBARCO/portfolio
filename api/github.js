// /api/github.js
export default async function handler(req, res) {
  const owner = "JLBBARCO";
  const now = Date.now();

  // Opcional: Adicione um Token aqui nas variáveis da Vercel para limite de 5000/hora
  const headers = {
    Accept: "application/vnd.github.mercy-preview+json",
    "User-Agent": "Vercel-Serverless-Function",
  };

  try {
    const urls = [
      `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated&direction=desc&type=owner&t=${now}`,
      `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated&direction=desc&type=member&t=${now}`,
    ];

    const responses = await Promise.all(urls.map((u) => fetch(u, { headers })));
    const data = await Promise.all(
      responses.map((r) => (r.ok ? r.json() : [])),
    );

    // Une os arrays de repositórios
    const combined = [...data[0], ...data[1]];

    // Retorna para o seu site
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate"); // Cache na rede da Vercel por 1h
    return res.status(200).json(combined);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch GitHub data" });
  }
}
