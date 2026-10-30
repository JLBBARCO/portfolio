// /api/github-data.js
//
// Endpoint UNICO que o site consome. Ele monta o snapshot completo do GitHub
// (perfil + repositorios + linguagens + datas de commit) e e cacheado pela CDN
// da Vercel por 24 horas:
//
//   Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800
//
// Consequencia pratica:
//   - A Vercel chama a API do GitHub no maximo ~1x por dia (a primeira visita
//     depois do cache expirar, ou o cron diario de aquecimento).
//   - Todos os visitantes leem a resposta pronta da CDN: requisicoes ilimitadas
//     sem consumir o rate limit do GitHub.
//   - Se o GitHub falhar, `stale-while-revalidate` mantem a ultima versao boa
//     servindo por ate 7 dias.
import { buildGitHubSnapshot } from "../lib/github-snapshot.js";

// 23h: um pouco menos que 24h para que o cron diario sempre encontre o cache
// expirado e dispare a revalidacao em background.
const ONE_DAY_SECONDS = 82800;
const ONE_WEEK_SECONDS = 604800;

export default async function handler(req, res) {
  const owner = req.query?.owner || process.env.GITHUB_USERNAME || "JLBBARCO";
  const siteRepo = req.query?.siteRepo || "portfolio";

  try {
    const snapshot = await buildGitHubSnapshot({
      owner,
      siteRepo,
      token: process.env.GITHUB_TOKEN,
    });

    // Cache na CDN por 24h; revalidacao em background por ate 7 dias.
    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${ONE_DAY_SECONDS}, stale-while-revalidate=${ONE_WEEK_SECONDS}`,
    );
    res.setHeader("CDN-Cache-Control", `public, s-maxage=${ONE_DAY_SECONDS}`);
    res.setHeader("X-Snapshot-Generated-At", snapshot.generatedAt);

    return res.status(200).json(snapshot);
  } catch (error) {
    // Responde 200 com erro estruturado para o navegador nao registrar
    // requisicoes vermelhas no console; o front-end usa o snapshot estatico.
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(200).json({
      __githubError: true,
      status: error?.status || 500,
      error: "Failed to build GitHub snapshot",
      details: error?.message || "Unexpected error",
      warnings: error?.warnings || [],
    });
  }
}
