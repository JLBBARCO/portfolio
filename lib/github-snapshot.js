/**
 * Monta um "snapshot" completo dos dados do GitHub em UMA execucao.
 *
 * Usado por:
 *   - lib/site-snapshot.js (que e consumido por api/site-data.js e por
 *     scripts/build-site-snapshot.js)
 *
 * Objetivo: a Vercel consulta o GitHub no maximo uma vez por hora; os
 * visitantes leem sempre o JSON pronto, sem tocar na API do GitHub.
 */

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
    // Deixa uma folga para nao bloquear outras chamadas.
    if (budget.remaining <= 3) {
      budget.exhausted = true;
      budget.warnings.push(
        "Limite de requisicoes do GitHub quase esgotado; snapshot gerado parcialmente.",
      );
    }
  }

  if (response.status === 401) {
    // Token invalido/expirado: desativa e tenta novamente sem autenticacao,
    // para que o snapshot ainda seja gerado (limite publico de 60 req/h).
    if (ctx.token) {
      ctx.token = "";
      budget.warnings.push(
        "GITHUB_TOKEN invalido ou expirado (401). Continuando sem autenticacao " +
          "(limite de 60 requisicoes/hora). Gere um novo token em github.com/settings/tokens.",
      );
      if (Number.isFinite(budget.max)) budget.max = Math.min(budget.max, 50);
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
    return;
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
        : 50, // sem token o limite publico e 60/h
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

  await mapWithConcurrency(repos, concurrency, async (repo) => {
    await enrichWithLanguages(repo, owner, ctx, budget);
    await enrichWithCommits(repo, owner, ctx, budget);
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
        await enrichWithLanguages(siteRepo, owner, ctx, budget);
        await enrichWithCommits(siteRepo, owner, ctx, budget);
      }
    }
  }

  const profile = profileResult.ok && profileResult.data ? profileResult.data : null;

  return {
    schema: 1,
    owner,
    generatedAt: new Date().toISOString(),
    authenticated: Boolean(ctx.token),
    requestsUsed: budget.used,
    partial: budget.exhausted,
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
