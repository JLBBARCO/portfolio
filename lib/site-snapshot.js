/**
 * Monta o snapshot COMPLETO do site em UMA execucao no servidor (Vercel).
 *
 * O que e calculado aqui (e nao mais no navegador do visitante):
 *   - perfil do GitHub (nome, bio, avatar);
 *   - cor media da imagem de perfil -> paleta de tema (claro/escuro);
 *   - cards de projetos prontos (tecnologias, datas, links e imagem resolvida);
 *   - agrupamento de tecnologias por stack;
 *   - catalogo de imagens fixas (src/json/areas/images.json).
 *
 * Consumido por:
 *   - api/site-data.js              (rota da Vercel, cache de 1 hora na CDN)
 *   - scripts/build-site-snapshot.js (gera src/json/site-snapshot.json)
 *
 * Os textos da interface NAO entram aqui de proposito: ficam em
 * src/json/translate/strings.json e sao aplicados pelo proprio cliente
 * (src/js/translate.js), sem sobrecarregar a Vercel.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGitHubSnapshot } from "./github-snapshot.js";
import { computeThemeFromImageUrl } from "./image-color.js";

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(LIB_DIR, "..");

export const SITE_SNAPSHOT_SCHEMA = 2;

/* --------------------------------------------------------------------------
 * Leitura de arquivos locais
 * ------------------------------------------------------------------------ */

async function readJsonFile(relativePath) {
  const candidates = [
    path.join(PROJECT_ROOT, relativePath),
    path.join(process.cwd(), relativePath),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf8");
      return JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch (error) {
      if (error && error.code !== "ENOENT") {
        throw new Error(`Falha ao ler ${relativePath}: ${error.message}`);
      }
    }
  }

  return null;
}

/* --------------------------------------------------------------------------
 * Helpers compartilhados com o cliente (portados para o Node)
 * ------------------------------------------------------------------------ */

function slugifyCardId(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** Mesma classificacao usada antes no cliente (script.js:determineStack). */
function determineStack(name) {
  const lower = String(name || "").toLowerCase();
  const front = [
    "html",
    "css",
    "javascript",
    "js",
    "react",
    "vue",
    "angular",
    "sass",
    "scss",
    "bootstrap",
    "tailwind",
  ];
  const back = [
    "python",
    "java",
    "node",
    "nodejs",
    "php",
    "ruby",
    "go",
    "c#",
    "c++",
    "c",
    "rust",
    "kotlin",
    "swift",
  ];

  if (front.some((word) => lower.includes(word))) {
    return { id: "frontEnd", "en-US": "Front-end", "pt-BR": "Front-end" };
  }
  if (back.some((word) => lower.includes(word))) {
    return { id: "backEnd", "en-US": "Back-end", "pt-BR": "Back-end" };
  }
  return { id: "other", "en-US": "Other", "pt-BR": "Outro" };
}

function normalizeLocalizedFieldValue(value) {
  if (!value) return null;
  if (typeof value === "string") {
    return { "pt-BR": value, "en-US": value };
  }
  if (typeof value === "object") {
    const pt = value["pt-BR"] || value.pt || value["en-US"] || value.en || "";
    const en = value["en-US"] || value.en || value["pt-BR"] || value.pt || "";
    if (!pt && !en) return null;
    return { "pt-BR": pt, "en-US": en };
  }
  return null;
}

function normalizeHomepageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function getScreenshotUrl(demoUrl) {
  return `https://api.microlink.io/?url=${encodeURIComponent(
    demoUrl,
  )}&screenshot=true&meta=false&embed=screenshot.url`;
}

function makeShortDate(iso) {
  if (!iso) return "";
  const parts = String(iso).substring(0, 7).split("-");
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
  return parts[0] || "";
}

async function mapWithConcurrency(items, limit, worker) {
  const queue = items.map((item, index) => ({ item, index }));
  const results = new Array(items.length);
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, queue.length)) },
    async () => {
      while (queue.length) {
        const job = queue.shift();
        results[job.index] = await worker(job.item, job.index);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

/* --------------------------------------------------------------------------
 * Imagens fixas (src/json/areas/images.json)
 * ------------------------------------------------------------------------ */

function normalizeImageSource(source) {
  if (!source) return null;
  if (typeof source === "string") return { src: source };
  if (typeof source !== "object") return null;

  const src = String(source.src || source.url || source.href || "").trim();
  if (!src) return null;

  const normalized = { src };
  if (source.type) normalized.type = String(source.type);
  if (source.media) normalized.media = String(source.media);
  if (Number.isFinite(Number(source.width))) {
    normalized.width = Number(source.width);
  }
  if (Number.isFinite(Number(source.height))) {
    normalized.height = Number(source.height);
  }
  if (source.density) normalized.density = String(source.density);
  return normalized;
}

/**
 * Normaliza cada entrada de images.json em uma estrutura previsivel:
 * `{ id, alt, sources: [...], render: "img" | "picture", ... }`.
 * Com uma unica fonte o cliente usa <img>; com duas ou mais usa <picture>.
 */
function normalizeImageCatalog(rawCatalog) {
  const entries = {};
  if (!rawCatalog || typeof rawCatalog !== "object") {
    return { schema: 1, images: entries };
  }

  const rawImages =
    rawCatalog.images && typeof rawCatalog.images === "object"
      ? rawCatalog.images
      : rawCatalog;

  Object.entries(rawImages).forEach(([id, rawEntry]) => {
    if (!rawEntry || typeof rawEntry !== "object") return;
    if (id === "schema" || id === "images") return;

    const rawSources = Array.isArray(rawEntry.sources)
      ? rawEntry.sources
      : [rawEntry.src || rawEntry.url].filter(Boolean);

    const sources = rawSources.map(normalizeImageSource).filter(Boolean);
    if (!sources.length) return;

    const alt = normalizeLocalizedFieldValue(rawEntry.alt) || {
      "pt-BR": "",
      "en-US": "",
    };

    const entry = {
      id,
      alt,
      sources,
      render: sources.length > 1 ? "picture" : "img",
      loading: rawEntry.loading || "",
      decoding: rawEntry.decoding || "",
      fetchPriority: rawEntry.fetchPriority || rawEntry.fetchpriority || "",
      className: rawEntry.class || rawEntry.className || "",
      crossOrigin: rawEntry.crossOrigin || rawEntry.crossorigin || "",
      target: rawEntry.target || "",
      role: rawEntry.role || "",
      dynamic: rawEntry.dynamic === true,
    };

    // Fallback do <picture> e a ultima fonte (a mais compativel).
    const fallback = sources[sources.length - 1];
    entry.fallback = fallback;
    if (Number.isFinite(fallback.width)) entry.width = fallback.width;
    if (Number.isFinite(fallback.height)) entry.height = fallback.height;

    entries[id] = entry;
  });

  return { schema: Number(rawCatalog.schema) || 1, images: entries };
}

/* --------------------------------------------------------------------------
 * Projetos
 * ------------------------------------------------------------------------ */

function isEligibleProjectRepo(repo, owner, excluded) {
  if (!repo || !repo.name) return false;
  const repoOwner = normalizeLogin(repo.owner && repo.owner.login);
  const requestedOwner = normalizeLogin(owner);
  if (!repoOwner || repoOwner !== requestedOwner) return false;

  const name = normalizeLogin(repo.name);
  if (name === requestedOwner) return false;
  if (name === `${requestedOwner}.github.io`) return false;
  if (excluded.has(name)) return false;
  return true;
}

async function urlExists(url) {
  if (!url) return false;
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "portfolio-site-snapshot" },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/** Resolve a imagem do card no servidor (JSON -> thumbnail do repo -> screenshot). */
async function resolveCardImage(repo, overrideUrl, ownerName) {
  const result = { image: "", imageMobile: "", imageType: "", imageSource: "" };

  if (overrideUrl && (await urlExists(overrideUrl))) {
    result.image = overrideUrl;
    result.imageMobile = overrideUrl;
    result.imageSource = "json";
    return result;
  }

  const branch = repo.default_branch || "main";
  const thumbnailUrl = `https://raw.githubusercontent.com/${ownerName}/${repo.name}/refs/heads/${branch}/src/assets/img/thumbnail.webp`;
  if (await urlExists(thumbnailUrl)) {
    result.image = thumbnailUrl;
    result.imageMobile = thumbnailUrl;
    result.imageType = "image/webp";
    result.imageSource = "repository";
    return result;
  }

  const demoUrl = normalizeHomepageUrl(repo.homepage);
  if (demoUrl) {
    const screenshot = getScreenshotUrl(demoUrl);
    result.image = screenshot;
    result.imageMobile = screenshot;
    result.imageSource = "screenshot";
  }

  return result;
}

function buildProjectCard(repo, owner, imageInfo) {
  const techNames = Array.from(
    new Set(
      [
        ...(Array.isArray(repo.topics) ? repo.topics : []),
        repo.language || "",
        ...Object.keys(repo.languages || {}),
      ].filter(Boolean),
    ),
  );

  const iconTechnologies = techNames.map((name) => ({
    name,
    stack: determineStack(name),
  }));

  const ownerLatestIso =
    repo.latestOwnerCommitAt || repo.pushed_at || repo.updated_at || "";
  const activityIso =
    repo.latestActivityAt || repo.pushed_at || repo.updated_at || "";
  const description =
    repo.fork && repo.parent
      ? `${repo.description || ""}${repo.description ? " " : ""}(fork of ${repo.parent.full_name})`
      : repo.description || "";

  const demoUrl = normalizeHomepageUrl(repo.homepage);

  const card = {
    id: slugifyCardId(repo.name),
    repoName: repo.name,
    title: { "pt-BR": repo.name, "en-US": repo.name },
    description,
    linkRepository: repo.html_url || "",
    dateInit: makeShortDate(repo.created_at),
    dateEnd: makeShortDate(repo.pushed_at),
    repoCreatedAtIso: repo.created_at || "",
    hasOwnerMainMasterCommit: Boolean(ownerLatestIso),
    latestOwnerMainMasterCommitAt: ownerLatestIso,
    hasMainMasterActivity: Boolean(activityIso),
    latestMainMasterActivityAt: activityIso,
    iconTechnologies,
    githubFallbackTranslations: {
      title: { "pt-BR": repo.name, "en-US": repo.name },
      description: { "pt-BR": description, "en-US": description },
    },
  };

  if (demoUrl) card.linkDemo = demoUrl;
  if (imageInfo.image) {
    card.image = imageInfo.image;
    card.imageMobile = imageInfo.imageMobile || imageInfo.image;
    if (imageInfo.imageType) card.imageType = imageInfo.imageType;
    card.imageSource = imageInfo.imageSource;
  }

  return card;
}

function compareCardsByMaintenance(a, b) {
  const aOwner = Date.parse(a.latestOwnerMainMasterCommitAt || "") || 0;
  const bOwner = Date.parse(b.latestOwnerMainMasterCommitAt || "") || 0;
  if (aOwner !== bOwner) return bOwner - aOwner;

  const aCreated = Date.parse(a.repoCreatedAtIso || "") || 0;
  const bCreated = Date.parse(b.repoCreatedAtIso || "") || 0;
  return bCreated - aCreated;
}

/* --------------------------------------------------------------------------
 * Tecnologias
 * ------------------------------------------------------------------------ */

function buildTechnologyGroups(cards, formationCards) {
  const stackMap = new Map();

  const collect = (card) => {
    const techs = Array.isArray(card && card.iconTechnologies)
      ? card.iconTechnologies
      : [];
    techs.forEach((tech) => {
      if (!tech || !tech.name) return;
      const stack = tech.stack || determineStack(tech.name);
      const stackId = stack.id || "other";
      if (!stackMap.has(stackId)) {
        stackMap.set(stackId, { stack, technologies: [], seen: new Set() });
      }
      const group = stackMap.get(stackId);
      const key = String(tech.name).toLowerCase();
      if (group.seen.has(key)) return;
      group.seen.add(key);
      group.technologies.push({
        name: tech.name,
        stack,
        ...(tech.style ? { style: tech.style } : {}),
        ...(tech.icon ? { icon: tech.icon } : {}),
      });
    });
  };

  cards.forEach(collect);
  (Array.isArray(formationCards) ? formationCards : []).forEach(collect);

  return Array.from(stackMap.values()).map((group) => ({
    stack: group.stack,
    technologies: group.technologies.sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    ),
  }));
}

/* --------------------------------------------------------------------------
 * Snapshot completo
 * ------------------------------------------------------------------------ */

/**
 * @param {object} options
 * @param {string} [options.owner] login do GitHub
 * @param {string} [options.token] GITHUB_TOKEN
 * @param {string} [options.siteRepo] repositorio do proprio site
 * @param {string[]} [options.excludeRepos] repositorios fora da secao de projetos
 * @param {number} [options.maxRequests]
 * @param {number} [options.concurrency]
 * @param {boolean} [options.resolveImages] verifica as imagens dos cards (HEAD)
 */
export async function buildSiteSnapshot(options = {}) {
  const owner = options.owner || "JLBBARCO";
  const siteRepoName = options.siteRepo || "portfolio";
  const excluded = new Set(
    (options.excludeRepos || [siteRepoName]).map(normalizeLogin),
  );
  const concurrency = Number.isFinite(options.concurrency)
    ? options.concurrency
    : 6;
  const resolveImages = options.resolveImages !== false;

  const warnings = [];

  const [rawImages, projectsOverrides, formationData] = await Promise.all([
    readJsonFile("src/json/areas/images.json").catch((error) => {
      warnings.push(error.message);
      return null;
    }),
    readJsonFile("src/json/areas/projects.json").catch((error) => {
      warnings.push(error.message);
      return null;
    }),
    readJsonFile("src/json/areas/formation.json").catch((error) => {
      warnings.push(error.message);
      return null;
    }),
  ]);

  const imageCatalog = normalizeImageCatalog(rawImages);

  // `githubSnapshot` permite reaproveitar um snapshot ja existente (testes
  // locais e regeneracao offline) sem tocar na API do GitHub.
  let github = options.githubSnapshot || null;
  if (!github) {
    try {
      github = await buildGitHubSnapshot({
        owner,
        token: options.token,
        siteRepo: siteRepoName,
        maxRequests: options.maxRequests,
        concurrency: options.concurrency,
      });
    } catch (error) {
      warnings.push(error.message);
      if (Array.isArray(error.warnings)) warnings.push(...error.warnings);
      github = {
        owner,
        generatedAt: new Date().toISOString(),
        authenticated: false,
        requestsUsed: 0,
        partial: true,
        warnings: [],
        profile: null,
        siteRepo: null,
        repos: [],
      };
    }
  }

  if (Array.isArray(github.warnings)) warnings.push(...github.warnings);

  // ---- Perfil e imagem de perfil ----
  const profileImageEntry =
    imageCatalog.images.profilePicture || imageCatalog.images.profile || null;
  const catalogAvatar =
    profileImageEntry && profileImageEntry.sources.length
      ? profileImageEntry.sources[profileImageEntry.sources.length - 1].src
      : "";
  const avatarUrl =
    (github.profile && github.profile.avatar_url) || catalogAvatar || "";

  const profile = {
    login: (github.profile && github.profile.login) || owner,
    name: (github.profile && github.profile.name) || owner,
    bio: (github.profile && github.profile.bio) || "",
    location: (github.profile && github.profile.location) || "",
    htmlUrl:
      (github.profile && github.profile.html_url) ||
      `https://github.com/${owner}`,
    avatarUrl,
    followers: (github.profile && github.profile.followers) || 0,
    publicRepos: (github.profile && github.profile.public_repos) || 0,
  };

  // Se o avatar do GitHub mudou, o catalogo de imagens acompanha.
  if (avatarUrl && profileImageEntry && profileImageEntry.dynamic !== false) {
    const dynamicSource = { src: avatarUrl, type: "image/png" };
    const width = profileImageEntry.width;
    const height = profileImageEntry.height;
    if (Number.isFinite(width)) dynamicSource.width = width;
    if (Number.isFinite(height)) dynamicSource.height = height;
    profileImageEntry.sources = [
      ...profileImageEntry.sources.filter(
        (source) => !/avatars\.githubusercontent\.com/.test(source.src),
      ),
      dynamicSource,
    ];
    profileImageEntry.render =
      profileImageEntry.sources.length > 1 ? "picture" : "img";
    profileImageEntry.fallback =
      profileImageEntry.sources[profileImageEntry.sources.length - 1];
  }

  // ---- Tema (cor media da imagem de perfil, calculada no servidor) ----
  const themeSourceUrl = avatarUrl
    ? avatarUrl.includes("?")
      ? `${avatarUrl}&s=200`
      : `${avatarUrl}?s=200`
    : "";
  const theme = await computeThemeFromImageUrl(themeSourceUrl);
  if (theme.warning) warnings.push(theme.warning);

  // ---- Projetos ----
  const imageOverrides = new Map();
  if (projectsOverrides && projectsOverrides.cards) {
    Object.entries(projectsOverrides.cards).forEach(([rawId, rawCard]) => {
      if (!rawCard || typeof rawCard !== "object") return;
      const override =
        (typeof rawCard.img === "string" && rawCard.img) ||
        (typeof rawCard.image === "string" && rawCard.image) ||
        "";
      if (override) imageOverrides.set(slugifyCardId(rawId), override);
    });
  }

  const eligibleRepos = (github.repos || []).filter((repo) =>
    isEligibleProjectRepo(repo, owner, excluded),
  );

  const cards = await mapWithConcurrency(
    eligibleRepos,
    concurrency,
    async (repo) => {
      const ownerName = (repo.owner && repo.owner.login) || owner;
      const overrideUrl = imageOverrides.get(slugifyCardId(repo.name)) || "";
      const imageInfo = resolveImages
        ? await resolveCardImage(repo, overrideUrl, ownerName)
        : { image: "", imageMobile: "", imageType: "", imageSource: "" };
      return buildProjectCard(repo, owner, imageInfo);
    },
  );

  cards.sort(compareCardsByMaintenance);

  // ---- Tecnologias ----
  const technologies = buildTechnologyGroups(
    cards,
    (formationData && formationData.cards) || [],
  );

  return {
    schema: SITE_SNAPSHOT_SCHEMA,
    owner,
    generatedAt: new Date().toISOString(),
    refreshIntervalSeconds: 3600,
    authenticated: Boolean(github.authenticated),
    requestsUsed: github.requestsUsed || 0,
    partial: Boolean(github.partial),
    warnings: warnings.filter(Boolean),
    profile,
    theme,
    images: imageCatalog,
    projects: {
      cards,
      count: cards.length,
      githubFetchStatus: { failed: cards.length === 0 },
    },
    technologies: {
      groups: technologies,
      count: technologies.reduce(
        (total, group) => total + group.technologies.length,
        0,
      ),
    },
    siteRepo: github.siteRepo || null,
    repos: github.repos || [],
  };
}

export default buildSiteSnapshot;
