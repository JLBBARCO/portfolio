#!/usr/bin/env node
/**
 * Gera o snapshot estatico src/json/github-snapshot.json.
 *
 * Uso:
 *   npm run snapshot            # usa GITHUB_TOKEN de .env / .env.local
 *   npm run snapshot -- --owner OUTRO_USUARIO
 *
 * Esse arquivo e a reserva do site: se /api/github-data nao existir (Live Server,
 * abrir o index.html direto) ou falhar, o front-end usa o snapshot e nao faz
 * nenhuma requisicao a API do GitHub.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGitHubSnapshot } from "../lib/github-snapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "src", "json", "github-snapshot.json");

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

const owner = readFlag("owner", process.env.GITHUB_USERNAME || "JLBBARCO");
const siteRepo = readFlag("site-repo", "portfolio");

try {
  const snapshot = await buildGitHubSnapshot({
    owner,
    siteRepo,
    token: process.env.GITHUB_TOKEN,
  });

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`Snapshot gravado em ${path.relative(ROOT, OUTPUT)}`);
  console.log(`  repositorios: ${snapshot.repos.length}`);
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
