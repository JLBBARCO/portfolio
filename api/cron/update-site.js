// /api/cron/update-site.js
//
// Cron da Vercel (configurado em vercel.json).
//
// Funcao: "aquecer" o cache da CDN chamando /api/site-data. O TTL de 23 horas
// deixa o cache expirado antes da agenda diaria; a Vercel regenera o snapshot e
// os visitantes recebem o JSON pronto, sem consultar o GitHub no navegador.
//
// O agendamento diario existente tambem atualiza o snapshot quando nao ha
// visitantes; stale-while-revalidate mantem a versao anterior disponivel durante
// a regeneracao.
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
