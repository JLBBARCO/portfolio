/**
 * Monta um "snapshot" completo dos dados do GitHub em UMA execucao.
 *
 * Usado por:
 *   - lib/site-snapshot.js (que e consumido por api/site-data.js e por
 *     scripts/build-site-snapshot.js)
 *
 * Objetivo: a Vercel consulta o GitHub no maximo uma vez por dia; os
 * visitantes leem sempre o JSON pronto, sem tocar na API do GitHub.
 */

import {
  detectTechnologiesFromRepository,
  selectTechnologyManifestPaths,
} from "./technology-detector.js";

const GITHUB_API = "https://api.github.com";

function normalizeToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return "";
  if (/your_token_here/i.test(token)) return "";
  return token;
}

function buildHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "portfolio-snapshot-builder",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Estado de execucao: conta requisicoes e para de enriquecer se o limite acabar. */
function createBudget(maxRequests) {
  return {
    used: 0,
    max: maxRequests,
    remaining: Infinity,
    exhausted: false,
    warnings: [],
  };
}

async function ghFetch(path, tokenOrCtx, budget) {
  // Aceita um contexto mutavel { token } para poder desativar um token invalido.
  const ctx =
    tokenOrCtx && typeof tokenOrCtx === "object"
      ? tokenOrCtx
      : { token: tokenOrCtx };
  const token = ctx.token;
  if (budget.exhausted || budget.used >= budget.max) {
    budget.exhausted = true;
    return { ok: false, status: 0, data: null };
  }

  budget.used += 1;

  let response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      headers: buildHeaders(token),
    });
  } catch (error) {
    budget.warnings.push(`Falha de rede em ${path}: ${error.message}`);
    return { ok: false, status: 0, data: null };
  }

  const remainingHeader = response.headers.get("x-ratelimit-remaining");
  if (remainingHeader !== null) {
    budget.remaining = Number(remainingHeader);
    // Reserva ao menos uma chamada abaixo do limite publico do GitHub.
    if (budget.remaining <= 1) {
      budget.exhausted = true;
      budget.warnings.push(
        "Reserva de seguranca do limite publico do GitHub atingida; chamadas adicionais foram interrompidas.",
      );
    }
  }

  if (response.status === 401) {
    // Token invalido/expirado: desativa e tenta novamente sem autenticacao,
    // para que o snapshot ainda seja gerado (limite publico de 60 req/h).
    if (ctx.token) {
      ctx.token = "";
      budget.exhausted = false;
      budget.remaining = Infinity;
      budget.warnings.push(
        "GITHUB_TOKEN invalido ou expirado (401). Continuando sem autenticacao " +
          "(limite de 60 requisicoes/hora). Gere um novo token em github.com/settings/tokens.",
      );
      if (Number.isFinite(budget.max)) budget.max = Math.min(budget.max, 59);
      return ghFetch(path, ctx, budget);
    }
    budget.exhausted = true;
    return { ok: false, status: 401, data: null };
  }

  if (response.status === 403 || response.status === 429) {
    budget.exhausted = true;
    budget.warnings.push(
      `Limite de requisicoes atingido (${response.status}) em ${path}.`,
    );
    return { ok: false, status: response.status, data: null };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, data: null };
  }

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    return { ok: false, status: response.status, data: null };
  }

  return { ok: true, status: response.status, data };
}

function pickRepoFields(repo) {
  if (!repo || typeof repo !== "object") return null;
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    owner: { login: (repo.owner && repo.owner.login) || "" },
    description: repo.description || "",
    html_url: repo.html_url || "",
    homepage: repo.homepage || "",
    language: repo.language || "",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    default_branch: repo.default_branch || "main",
    created_at: repo.created_at || "",
    updated_at: repo.updated_at || "",
    pushed_at: repo.pushed_at || "",
    stargazers_count: repo.stargazers_count || 0,
    forks_count: repo.forks_count || 0,
    open_issues_count: repo.open_issues_count || 0,
    watchers_count: repo.watchers_count || 0,
    size: repo.size || 0,
    license: repo.license ? { name: repo.license.name, spdx_id: repo.license.spdx_id } : null,
    parent: repo.parent ? { full_name: repo.parent.full_name } : null,
  };
}

function toTimestamp(value) {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** Ultimo commit da branch padrao + ultimo commit do proprio dono. */
async function enrichWithCommits(repo, owner, ctx, budget) {
  const branch = repo.default_branch || "main";
  const path = `/repos/${encodeURIComponent(repo.owner.login || owner)}/${encodeURIComponent(
    repo.name,
  )}/commits?sha=${encodeURIComponent(branch)}&per_page=30`;

  const result = await ghFetch(path, ctx, budget);
  const commits = Array.isArray(result.data) ? result.data : [];

  if (!commits.length) {
    repo.latestActivityAt = repo.pushed_at || repo.updated_at || "";
    repo.latestOwnerCommitAt = repo.pushed_at || repo.updated_at || "";
    return result.ok;
  }

  const firstDate =
    (commits[0].commit &&
      ((commits[0].commit.committer && commits[0].commit.committer.date) ||
        (commits[0].commit.author && commits[0].commit.author.date))) ||
    "";

  const normalizedOwner = normalizeLogin(owner);
  const ownerCommit = commits.find((commit) => {
    const authorLogin = normalizeLogin(commit.author && commit.author.login);
    const committerLogin = normalizeLogin(
      commit.committer && commit.committer.login,
    );
    return (
      normalizedOwner &&
      (authorLogin === normalizedOwner || committerLogin === normalizedOwner)
    );
  });

  const ownerDate =
    (ownerCommit &&
      ownerCommit.commit &&
      ownerCommit.commit.author &&
      ownerCommit.commit.author.date) ||
    "";

  const activityCandidates = [firstDate, repo.pushed_at].filter(Boolean);
  activityCandidates.sort((a, b) => toTimestamp(b) - toTimestamp(a));

  repo.latestActivityAt = activityCandidates[0] || "";
  repo.latestOwnerCommitAt = ownerDate || repo.pushed_at || "";
  return result.ok;
}

async function enrichWithLanguages(repo, owner, ctx, budget) {
  const path = `/repos/${encodeURIComponent(repo.owner.login || owner)}/${encodeURIComponent(
    repo.name,
  )}/languages`;
  const result = await ghFetch(path, ctx, budget);
  repo.languages =
    result.ok && result.data && typeof result.data === "object"
      ? result.data
      : {};
  return result.ok;
}

const MAX_MANIFEST_BYTES = 128 * 1024;
const MANIFEST_TIMEOUT_MS = 2500;

async function readLimitedBody(response) {
  const reader = response.body && response.body.getReader
    ? response.body.getReader()
    : null;
  if (!reader) {
    const text = await response.text();
    return text.length <= MAX_MANIFEST_BYTES ? text : null;
  }

  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_MANIFEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchRawManifest(owner, repoName, branch, filePath) {
  const ref = encodeURIComponent(branch || "main");
  const encodedPath = String(filePath)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/${ref}/${encodedPath}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, text: "" };
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_MANIFEST_BYTES) {
      return { ok: false, text: "" };
    }
    const text = await readLimitedBody(response);
    return typeof text === "string"
      ? { ok: true, text }
      : { ok: false, text: "" };
  } catch {
    return { ok: false, text: "" };
  }
}

async function enrichWithTechnologyDetection(repo, owner, ctx, budget) {
  const branch = repo.default_branch || "main";
  const account = (repo.owner && repo.owner.login) || owner;
  const treePath = `/repos/${encodeURIComponent(account)}/${encodeURIComponent(
    repo.name,
  )}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const analyzedAt = new Date().toISOString();

  if (budget.exhausted || budget.used >= budget.max) {
    repo.technologyDetection = {
      status: "budget-limited",
      branch,
      analyzedAt,
      technologies: [],
    };
    return false;
  }

  const treeResult = await ghFetch(treePath, ctx, budget);
  if (!treeResult.ok || !treeResult.data || !Array.isArray(treeResult.data.tree)) {
    repo.technologyDetection = {
      status: budget.exhausted ? "budget-limited" : "unavailable",
      branch,
      analyzedAt,
      technologies: [],
    };
    return false;
  }

  if (treeResult.data.truncated) {
    repo.technologyDetection = {
      status: "tree-truncated",
      branch,
      analyzedAt,
      technologies: [],
    };
    budget.warnings.push(
      `Análise de tecnologias ignorada em ${repo.full_name || repo.name}: a árvore de arquivos do GitHub foi truncada.`,
    );
    return false;
  }

  const treePaths = treeResult.data.tree
    .filter((entry) => entry && entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => entry.path);
  const manifestPaths = selectTechnologyManifestPaths(treePaths, 3);
  const manifestResults = await Promise.all(
    manifestPaths.map(async (filePath) => ({
      path: filePath,
      ...(await fetchRawManifest(account, repo.name, branch, filePath)),
    })),
  );
  const manifests = manifestResults
    .filter((entry) => entry.ok)
    .map(({ path, text }) => ({ path, text }));
  const technologies = detectTechnologiesFromRepository(treePaths, manifests);
  const manifestFailures = manifestResults.filter((entry) => !entry.ok).length;
  const status = manifestFailures ? "partial" : "complete";

  repo.technologyDetection = {
    status,
    branch,
    analyzedAt,
    filesAnalyzed: manifestResults.length,
    technologies: technologies.map((item) => item.name),
    evidence: technologies,
  };

  if (manifestFailures) {
    budget.warnings.push(
      `Análise de tecnologias parcial em ${repo.full_name || repo.name}: ${manifestFailures} manifesto(s) não puderam ser lidos.`,
    );
  }
  return status === "complete";
}

async function mapWithConcurrency(items, limit, worker) {
  const queue = items.slice();
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/**
 * @param {object} options
 * @param {string} options.owner login do GitHub
 * @param {string} [options.token] GITHUB_TOKEN
 * @param {string} [options.siteRepo] repositorio do proprio site (usado no footer)
 * @param {number} [options.maxRequests] teto de requisicoes por execucao
 * @param {number} [options.concurrency]
 */
export async function buildGitHubSnapshot(options = {}) {
  const owner = options.owner || "JLBBARCO";
  const token = normalizeToken(options.token);
  const siteRepoName = options.siteRepo || "portfolio";
  const budget = createBudget(
    Number.isFinite(options.maxRequests)
      ? options.maxRequests
      : token
        ? 400
        : 59, // sem token deixa uma chamada de margem abaixo do limite publico de 60/h
  );
  const concurrency = Number.isFinite(options.concurrency)
    ? options.concurrency
    : 4;

  const ctx = { token };

  const profileResult = await ghFetch(
    `/users/${encodeURIComponent(owner)}`,
    ctx,
    budget,
  );

  const reposResult = await ghFetch(
    `/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&direction=desc&type=owner`,
    ctx,
    budget,
  );

  if (!reposResult.ok || !Array.isArray(reposResult.data)) {
    const error = new Error(
      `Nao foi possivel listar os repositorios de ${owner} (status ${reposResult.status}).`,
    );
    error.status = reposResult.status;
    error.warnings = budget.warnings;
    throw error;
  }

  const repos = reposResult.data.map(pickRepoFields).filter(Boolean);

  const repositoryEnrichment = new Map();
  await mapWithConcurrency(repos, concurrency, async (repo) => {
    const languagesOk = await enrichWithLanguages(repo, owner, ctx, budget);
    const commitsOk = await enrichWithCommits(repo, owner, ctx, budget);
    repositoryEnrichment.set(repo.full_name || repo.name, languagesOk && commitsOk);
  });

  // Repositorio do proprio site (usado pelo rodape) — pode estar filtrado da lista.
  let siteRepo = repos.find(
    (repo) => normalizeLogin(repo.name) === normalizeLogin(siteRepoName),
  );

  if (!siteRepo) {
    const siteResult = await ghFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(siteRepoName)}`,
      ctx,
      budget,
    );
    if (siteResult.ok) {
      siteRepo = pickRepoFields(siteResult.data);
      if (siteRepo) {
        const languagesOk = await enrichWithLanguages(siteRepo, owner, ctx, budget);
        const commitsOk = await enrichWithCommits(siteRepo, owner, ctx, budget);
        repositoryEnrichment.set(
          siteRepo.full_name || siteRepo.name,
          languagesOk && commitsOk,
        );
      }
    }
  }

  // Analisa os mesmos projetos exibidos no portfólio, sem varrer o perfil ou
  // o próprio site. A árvore usa o branch padrão real; manifestos são lidos
  // como texto limitado e nunca executados.
  const technologyRepos = repos.filter((repo) => {
    const name = normalizeLogin(repo.name);
    return name !== normalizeLogin(owner) && name !== normalizeLogin(siteRepoName);
  });
  repos.forEach((repo) => {
    repo.technologyDetection = {
      status: "not-scanned",
      technologies: [],
    };
  });
  await mapWithConcurrency(technologyRepos, Math.min(concurrency, 3), async (repo) => {
    await enrichWithTechnologyDetection(repo, owner, ctx, budget);
  });

  const repositoryDataComplete = Array.from(repositoryEnrichment.values()).every(Boolean);
  const technologyDataComplete = technologyRepos.every(
    (repo) => repo.technologyDetection?.status === "complete",
  );
  const partial =
    !profileResult.ok || !repositoryDataComplete || !technologyDataComplete;

  const profile = profileResult.ok && profileResult.data ? profileResult.data : null;

  return {
    schema: 2,
    owner,
    generatedAt: new Date().toISOString(),
    authenticated: Boolean(ctx.token),
    requestsUsed: budget.used,
    partial,
    warnings: budget.warnings,
    profile: profile
      ? {
          login: profile.login,
          name: profile.name,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          html_url: profile.html_url,
          location: profile.location,
          followers: profile.followers,
          following: profile.following,
          public_repos: profile.public_repos,
        }
      : null,
    siteRepo: siteRepo || null,
    repos,
  };
}

export default buildGitHubSnapshot;
