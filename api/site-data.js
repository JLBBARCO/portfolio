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
//   Cache-Control: public, s-maxage=82800, stale-while-revalidate=604800
//
// Consequencia pratica:
//   - O cron diario aquece a CDN; o TTL de 23 horas permite a revalidacao diaria
//     mesmo sem visitantes e impede consultas a cada carregamento da pagina.
//   - Todos os visitantes leem a resposta pronta da CDN: requisicoes ilimitadas
//     sem consumir o rate limit do GitHub e sem calculos no navegador.
//   - Se o GitHub falhar, `stale-while-revalidate` mantem a ultima versao boa
//     servindo por ate 7 dias.
import { buildSiteSnapshot } from "../lib/site-snapshot.js";

// 23 horas: o cron Vercel roda diariamente à meia-noite UTC e encontra o cache
// expirado mesmo com pequenas diferencas no horario de geracao do snapshot.
const ONE_DAY_SECONDS = 23 * 60 * 60;
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
      __siteDataError: true,
      __githubError: true,
      status: error?.status || 500,
      error: "Failed to build site snapshot",
      details: error?.message || "Unexpected error",
      warnings: error?.warnings || [],
    });
  }
}
