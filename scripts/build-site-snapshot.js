#!/usr/bin/env node
/**
 * Gera o snapshot estatico src/json/site-snapshot.json.
 *
 * Uso:
 *   npm run snapshot                      # usa GITHUB_TOKEN de .env / .env.local
 *   npm run snapshot -- --owner OUTRO_USER
 *   npm run snapshot -- --from-github-snapshot   # reaproveita src/json/github-snapshot.json
 *
 * Esse arquivo e a reserva do site: se /api/site-data nao existir (Live Server,
 * abrir o index.html direto) ou falhar, o front-end usa o snapshot e nao faz
 * nenhuma requisicao a API do GitHub.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSiteSnapshot } from "../lib/site-snapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "src", "json", "site-snapshot.json");
const GITHUB_SNAPSHOT = path.join(ROOT, "src", "json", "github-snapshot.json");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

[".env", ".env.local"].forEach((name) => loadEnvFile(path.join(ROOT, name)));

function readFlag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const owner = readFlag("owner", process.env.GITHUB_USERNAME || "JLBBARCO");
const siteRepo = readFlag("site-repo", "portfolio");

let githubSnapshot = null;
if (hasFlag("from-github-snapshot") && fs.existsSync(GITHUB_SNAPSHOT)) {
  githubSnapshot = JSON.parse(fs.readFileSync(GITHUB_SNAPSHOT, "utf8"));
  console.log("Reaproveitando src/json/github-snapshot.json (sem chamar o GitHub).");
}

try {
  const snapshot = await buildSiteSnapshot({
    owner,
    siteRepo,
    token: process.env.GITHUB_TOKEN,
    githubSnapshot,
  });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`Snapshot gravado em ${path.relative(ROOT, OUTPUT)}`);
  console.log(`  repositorios: ${snapshot.repos.length}`);
  console.log(`  cards de projeto: ${snapshot.projects.count}`);
  console.log(`  tecnologias: ${snapshot.technologies.count}`);
  console.log(
    `  tema calculado no servidor: ${snapshot.theme.computed ? "sim" : "nao"} (${snapshot.theme.dark.accent})`,
  );
  console.log(`  requisicoes ao GitHub: ${snapshot.requestsUsed}`);
  console.log(`  autenticado: ${snapshot.authenticated ? "sim" : "nao"}`);
  if (snapshot.partial) {
    console.warn("  ATENCAO: snapshot parcial (limite de requisicoes).");
  }
  snapshot.warnings.forEach((warning) => console.warn(`  - ${warning}`));
} catch (error) {
  console.error(`Falha ao gerar o snapshot: ${error.message}`);
  (error.warnings || []).forEach((warning) => console.error(`  - ${warning}`));
  process.exitCode = 1;
}
