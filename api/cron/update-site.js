// /api/cron/update-site.js
//
// Cron da Vercel (configurado em vercel.json).
//
// Funcao: "aquecer" o cache da CDN chamando /api/site-data. Como o endpoint usa
// `s-maxage=3300` (55 min), quando o cron roda o cache ja esta expirado, entao
// esta chamada e que consome a API do GitHub - e todos os visitantes da hora
// leem a resposta ja pronta da CDN.
//
// Observacao sobre planos: o plano Hobby da Vercel executa crons no maximo uma
// vez por dia. Isso NAO impede a atualizacao horaria: o cache expira a cada 55
// minutos e a primeira visita seguinte regenera o snapshot (com
// stale-while-revalidate, sem espera para o visitante). O cron apenas garante
// que o site fique atualizado mesmo sem visitas.
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
  const target = `${protocol}://${host}/api/site-data?owner=${encodeURIComponent(owner)}`;

  try {
    const started = Date.now();
    const response = await fetch(target, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    return res.status(200).json({
      success: response.ok && !(data && data.__siteDataError),
      target,
      status: response.status,
      durationMs: Date.now() - started,
      generatedAt: data?.generatedAt || null,
      repos: Array.isArray(data?.repos) ? data.repos.length : 0,
      projects: data?.projects?.count || 0,
      technologies: data?.technologies?.count || 0,
      themeComputed: Boolean(data?.theme?.computed),
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
