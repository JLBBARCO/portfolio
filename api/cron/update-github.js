// /api/cron/update-github.js
//
// Cron diario da Vercel (configurado em vercel.json).
//
// Funcao: "aquecer" o cache da CDN chamando /api/github-data uma vez por dia.
// Como o endpoint usa `s-maxage=82800` (23h), quando o cron roda o cache ja
// esta expirado, entao esta chamada e que consome a API do GitHub - e todos os
// visitantes do dia leem a resposta ja pronta da CDN.
export default async function handler(req, res) {
  // A Vercel envia "Authorization: Bearer $CRON_SECRET" quando a variavel existe.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Nao autorizado" });
  }

  const owner = process.env.GITHUB_USERNAME || "JLBBARCO";
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    req.headers.host;
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(
    String(host || ""),
  );
  const protocol = isLocalHost ? "http" : "https";
  const target = `${protocol}://${host}/api/github-data?owner=${encodeURIComponent(owner)}`;

  try {
    const started = Date.now();
    const response = await fetch(target, {
      headers: { Accept: "application/json" },
    });
    const data = await response.json().catch(() => null);

    return res.status(200).json({
      success: response.ok && !(data && data.__githubError),
      target,
      status: response.status,
      durationMs: Date.now() - started,
      generatedAt: data?.generatedAt || null,
      repos: Array.isArray(data?.repos) ? data.repos.length : 0,
      partial: Boolean(data?.partial),
      warnings: data?.warnings || [],
      cache: response.headers.get("x-vercel-cache") || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      target,
      error: error?.message || "Erro inesperado ao aquecer o cache",
    });
  }
}
