// /api/site-data.js
//
// Endpoint UNICO que o site consome. A Vercel monta aqui TODO o conteudo
// dinamico do portfolio em uma execucao:
//
//   - perfil do GitHub (nome, bio, avatar);
//   - cor media da imagem de perfil -> paleta de tema (claro/escuro);
//   - cards de projetos prontos (tecnologias, datas, links, imagem resolvida);
//   - tecnologias agrupadas por stack;
//   - catalogo de imagens fixas (src/json/areas/images.json).
//
// Cache na CDN da Vercel:
//
//   Cache-Control: public, s-maxage=3600, stale-while-revalidate=604800
//
// Consequencia pratica:
//   - A Vercel consulta a API do GitHub no maximo 1x por hora (a primeira visita
//     depois do cache expirar, ou o cron de aquecimento).
//   - Todos os visitantes leem a resposta pronta da CDN: requisicoes ilimitadas
//     sem consumir o rate limit do GitHub e sem calculos no navegador.
//   - Se o GitHub falhar, `stale-while-revalidate` mantem a ultima versao boa
//     servindo por ate 7 dias.
import { buildSiteSnapshot } from "../lib/site-snapshot.js";

// 55 minutos: um pouco menos que 1 hora para que o cron horario sempre encontre
// o cache expirado e dispare a revalidacao.
const ONE_HOUR_SECONDS = 3300;
const ONE_WEEK_SECONDS = 604800;

export default async function handler(req, res) {
  const owner = req.query?.owner || process.env.GITHUB_USERNAME || "JLBBARCO";
  const siteRepo = req.query?.siteRepo || "portfolio";

  try {
    const snapshot = await buildSiteSnapshot({
      owner,
      siteRepo,
      token: process.env.GITHUB_TOKEN,
    });

    res.setHeader(
      "Cache-Control",
      `public, s-maxage=${ONE_HOUR_SECONDS}, stale-while-revalidate=${ONE_WEEK_SECONDS}`,
    );
    res.setHeader("CDN-Cache-Control", `public, s-maxage=${ONE_HOUR_SECONDS}`);
    res.setHeader("X-Snapshot-Generated-At", snapshot.generatedAt);

    return res.status(200).json(snapshot);
  } catch (error) {
    // Responde 200 com erro estruturado para o navegador nao registrar
    // requisicoes vermelhas no console; o front-end usa o snapshot estatico.
    res.setHeader("Cache-Control", "public, s-maxage=60");
    return res.status(200).json({
      __siteDataError: true,
      __githubError: true,
      status: error?.status || 500,
      error: "Failed to build site snapshot",
      details: error?.message || "Unexpected error",
      warnings: error?.warnings || [],
    });
  }
}
