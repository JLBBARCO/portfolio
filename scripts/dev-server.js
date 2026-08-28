#!/usr/bin/env node
/**
 * Servidor de desenvolvimento local (sem dependencias externas).
 *
 * Serve os arquivos estaticos do portfolio E as rotas de /api (as mesmas
 * funcoes usadas na Vercel), lendo o GITHUB_TOKEN de .env / .env.local.
 *
 * Uso:  npm run dev            (porta 5502 por padrao)
 *       PORT=3000 npm run dev
 *
 * Isso elimina os erros 404 em /api/github e 403 na API publica do GitHub,
 * porque as requisicoes passam a ser autenticadas pelo backend local.
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 5502);
const HOST = process.env.HOST || "127.0.0.1";

/* ------------------------------ .env loader ------------------------------ */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
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

/* ------------------------------ MIME types ------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".webmanifest": "application/manifest+json",
};

/* --------------------------- API route resolver -------------------------- */
const API_DIR = path.join(ROOT, "api");

async function resolveApiHandler(pathname) {
  // "/api/github" -> api/github.js | api/github/index.js
  const relative = pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  if (!relative) return null;
  if (relative.includes("..")) return null;

  const candidates = [
    path.join(API_DIR, `${relative}.js`),
    path.join(API_DIR, relative, "index.js"),
  ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(API_DIR)) continue;
    if (fs.existsSync(candidate)) {
      const mod = await import(
        `${pathToFileURL(candidate).href}?t=${Date.now()}`
      );
      const handler = mod.default || mod.handler;
      if (typeof handler === "function") return handler;
    }
  }
  return null;
}

function buildResponseShim(res) {
  let statusCode = 200;
  const shim = {
    statusCode,
    setHeader: (name, value) => res.setHeader(name, value),
    getHeader: (name) => res.getHeader(name),
    status(code) {
      statusCode = code;
      shim.statusCode = code;
      return shim;
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.writeHead(statusCode);
      }
      res.end(JSON.stringify(payload));
      return shim;
    },
    send(body) {
      if (!res.headersSent) res.writeHead(statusCode);
      res.end(typeof body === "string" ? body : JSON.stringify(body));
      return shim;
    },
    end(body) {
      if (!res.headersSent) res.writeHead(statusCode);
      res.end(body);
      return shim;
    },
  };
  return shim;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

/* ------------------------------ static files ----------------------------- */
async function serveStatic(req, res, pathname) {
  let relativePath = decodeURIComponent(pathname);
  if (relativePath.endsWith("/")) relativePath += "index.html";

  const filePath = path.join(ROOT, relativePath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      return serveStatic(req, res, `${pathname.replace(/\/$/, "")}/index.html`);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    // SPA-ish fallback: entrega o index.html para rotas desconhecidas sem extensao
    if (!path.extname(filePath)) {
      try {
        const html = await fsp.readFile(path.join(ROOT, "index.html"));
        res.writeHead(200, { "Content-Type": MIME[".html"] });
        res.end(html);
        return;
      } catch {
        /* ignora */
      }
    }
    res.writeHead(404, { "Content-Type": MIME[".txt"] });
    res.end("404 Not Found");
  }
}

/* -------------------------------- server -------------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    try {
      const handler = await resolveApiHandler(url.pathname);
      if (!handler) {
        res.writeHead(404, { "Content-Type": MIME[".json"] });
        res.end(
          JSON.stringify({
            error: "Not found",
            details: `Nenhuma rota de API para ${url.pathname}`,
          }),
        );
        return;
      }

      const query = Object.fromEntries(url.searchParams.entries());
      const body = req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await readBody(req);

      const reqShim = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query,
        body,
      };

      await handler(reqShim, buildResponseShim(res));
      if (!res.writableEnded) res.end();
    } catch (error) {
      console.error(`[dev-server] Erro em ${url.pathname}:`, error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": MIME[".json"] });
      }
      res.end(
        JSON.stringify({ error: "Internal error", details: String(error) }),
      );
    }
    return;
  }

  await serveStatic(req, res, url.pathname === "/" ? "/index.html" : url.pathname);
});

server.listen(PORT, HOST, () => {
  const token = process.env.GITHUB_TOKEN || "";
  const tokenOk = token && !/your_token_here/i.test(token);
  console.log(`\n  Portfolio rodando em http://${HOST}:${PORT}`);
  console.log(`  Rotas /api ativas a partir de ${path.relative(ROOT, API_DIR)}/`);
  console.log(
    tokenOk
      ? "  GITHUB_TOKEN carregado: chamadas autenticadas (5.000 req/h)"
      : "  GITHUB_TOKEN ausente: usando API publica do GitHub (60 req/h)\n  Dica: copie .env.example para .env e preencha GITHUB_TOKEN",
  );
  console.log("");
});
