function getScreenshotUrl(demoUrl) {
  return `https://api.microlink.io/?url=${encodeURIComponent(
    demoUrl,
  )}&screenshot=true&meta=false&embed=screenshot.url`;
}

// Cache GitHub project loads to avoid duplicated network calls when multiple
// sections request the same data during one render cycle.
const _projectsDataCache = new Map();
const _projectCardTranslations = Object.create(null);
let _projectTranslationsLoadPromise = null;
const _repoOwnerMainMasterCommitCache = new Map();
const _repoMainMasterActivityCache = new Map();

// Translation dictionary for project cards, keyed by card id.
// Each entry can define title/description/institution/descriptionImage.
// If a field is missing, the renderer falls back to the card payload.
function normalizeLocale(language) {
  return language === "pt" || language === "pt-BR" ? "pt-BR" : "en-US";
}

function slugifyCardId(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeGitHubLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isOwnedRepositoryByOwner(repo, owner) {
  if (!repo || typeof repo !== "object") return false;
  const requestedOwner = normalizeGitHubLogin(owner);
  const repoOwner = normalizeGitHubLogin(repo.owner && repo.owner.login);

  if (!requestedOwner || !repoOwner || repoOwner !== requestedOwner) {
    return false;
  }

  return Boolean(repo.name);
}

function isEligibleGitHubProjectRepo(repo, owner) {
  if (!isOwnedRepositoryByOwner(repo, owner)) return false;

  const requestedOwner = normalizeGitHubLogin(owner);
  const name = normalizeGitHubLogin(repo.name);

  if (!name) return false;
  // Exclude special profile/pages repositories.
  if (name === requestedOwner) return false;
  if (name === `${requestedOwner}.github.io`) return false;

  // Any repository owned by the requested user is valid here, including forks.
  return true;
}

function ensureProjectCardId(card) {
  if (card && card.id) return card.id;
  const idSource =
    (card &&
      (card.linkRepository ||
        card.linkDemo ||
        (typeof getLocalized === "function"
          ? getLocalized(card.title, "en-US")
          : card.title))) ||
    "project";

  const id = slugifyCardId(idSource) || "project";
  if (card) card.id = id;
  return id;
}

function loadProjectCardTranslations() {
  if (_projectTranslationsLoadPromise) {
    return _projectTranslationsLoadPromise;
  }

  _projectTranslationsLoadPromise = fetchJsonWithFallback(
    "src/json/areas/projects.json",
  )
    .then((data) => {
      if (!data || !data.cards || typeof data.cards !== "object") return;

      Object.entries(data.cards).forEach(([rawId, rawCard]) => {
        if (!rawCard || typeof rawCard !== "object") return;
        const cardId = slugifyCardId(rawId || rawCard.id) || "project";
        if (!_projectCardTranslations[cardId]) {
          _projectCardTranslations[cardId] = {};
        }

        const entry = _projectCardTranslations[cardId];
        ["title", "description", "institution", "descriptionImage"].forEach(
          (field) => {
            const normalized = normalizeLocalizedFieldValue(rawCard[field]);
            if (normalized) entry[field] = normalized;
          },
        );
      });
    })
    .catch((err) => {
      console.warn("[projects] Failed to preload card translations:", err);
    });

  return _projectTranslationsLoadPromise;
}

function translationProjects() {
  return loadProjectCardTranslations();
}

function getLocalizedCardFieldValue(value, locale) {
  const normalized = normalizeLocalizedFieldValue(value);
  if (!normalized) return "";
  return normalized[locale] || normalized["en-US"] || normalized["pt-BR"] || "";
}

function getProjectCardTranslation(card, field, language) {
  if (!card || !field) return "";
  const locale = normalizeLocale(language);
  const cardId = ensureProjectCardId(card);

  const dictionaryEntry = _projectCardTranslations[cardId];
  if (dictionaryEntry && dictionaryEntry[field]) {
    const value =
      dictionaryEntry[field][locale] ||
      dictionaryEntry[field]["en-US"] ||
      dictionaryEntry[field]["pt-BR"] ||
      "";
    if (value) return value;
  }

  if (
    card.githubFallbackTranslations &&
    card.githubFallbackTranslations[field]
  ) {
    const value = getLocalizedCardFieldValue(
      card.githubFallbackTranslations[field],
      locale,
    );
    if (value) return value;
  }

  return getLocalizedCardFieldValue(card[field], locale);
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

function isLikelyVercelProjectMetadata(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    ("projectId" in value || "orgId" in value || "projectName" in value),
  );
}

function isValidProjectCard(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return false;
  if (isLikelyVercelProjectMetadata(card)) return false;

  const hasIdentity = Boolean(card.id || card.title || card.linkRepository);
  const hasContent = Boolean(
    card.description ||
    card.institution ||
    card.linkDemo ||
    card.iconTechnologies ||
    card.image ||
    card.dateInit ||
    card.dateEnd,
  );
  return hasIdentity || hasContent;
}

function registerProjectCardTranslations(card) {
  if (!isValidProjectCard(card)) return;
  const cardId = ensureProjectCardId(card);
  if (!cardId) return;

  if (!_projectCardTranslations[cardId]) {
    _projectCardTranslations[cardId] = {};
  }

  const entry = _projectCardTranslations[cardId];
  ["title", "description", "institution", "descriptionImage"].forEach(
    (field) => {
      if (entry[field]) return;
      const normalized = normalizeLocalizedFieldValue(card[field]);
      if (normalized) entry[field] = normalized;
    },
  );
}

function parseDateToTimestamp(value) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatMonthYear(value) {
  const timestamp = parseDateToTimestamp(value);
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}/${year}`;
}

function getLatestOwnerMainMasterCommitTimestamp(card) {
  if (!card) return 0;
  return parseDateToTimestamp(card.latestOwnerMainMasterCommitAt);
}

function getLatestMainMasterActivityTimestamp(card) {
  if (!card) return 0;
  return parseDateToTimestamp(card.latestMainMasterActivityAt);
}

function getRepositoryCreationTimestamp(card) {
  if (!card) return 0;
  const fromIso = parseDateToTimestamp(card.repoCreatedAtIso);
  if (fromIso) return fromIso;
  return parseDate(card.dateInit);
}

function hasOwnerMainMasterCommit(card) {
  return Boolean(card && card.hasOwnerMainMasterCommit);
}

function hasMainMasterActivity(card) {
  return Boolean(card && card.hasMainMasterActivity);
}

function getProjectCreationDisplayDate(card) {
  if (!card) return "";
  if (card.repoCreatedAtIso) {
    const formatted = formatMonthYear(card.repoCreatedAtIso);
    if (formatted) return formatted;
  }
  return card.dateInit || "";
}

function getProjectLatestOwnerUpdateDisplayDate(card) {
  if (!card) return "";
  const latestOwnerUpdate = formatMonthYear(card.latestOwnerMainMasterCommitAt);
  if (latestOwnerUpdate) return latestOwnerUpdate;

  if (card.repoCreatedAtIso) {
    return getProjectCreationDisplayDate(card);
  }

  // Fallback for local/manual cards that may not carry GitHub metadata.
  return card.dateEnd || getProjectCreationDisplayDate(card) || "";
}

function compareProjectCardsByMaintenance(a, b) {
  const aMaintenanceTimestamp = getLatestOwnerMainMasterCommitTimestamp(a);
  const bMaintenanceTimestamp = getLatestOwnerMainMasterCommitTimestamp(b);

  if (aMaintenanceTimestamp !== bMaintenanceTimestamp) {
    return bMaintenanceTimestamp - aMaintenanceTimestamp;
  }

  const aCreatedAt = getRepositoryCreationTimestamp(a);
  const bCreatedAt = getRepositoryCreationTimestamp(b);
  if (aCreatedAt !== bCreatedAt) {
    return bCreatedAt - aCreatedAt;
  }

  return 0;
}

function setupProjects(source, language, owner, loadId) {
  // when we start working with a container we tag it with the load id so
  // stale async results know to bail out.  loadId is produced by
  // loadDynamicContent and incremented on each invocation.
  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Projects";
  section.className = "portfolio";

  const title = document.createElement("h2");
  title.id = "projectsTitle";
  title.setAttribute("data-i18n", "section_projects_title");
  title.innerHTML = "Projects";
  section.append(title);

  const container = document.createElement("article");
  container.id = "projectsContainer";
  container.className = "block semi-hidden";

  if (container && loadId !== undefined) {
    container.dataset.loadId = loadId;
  }

  function renderProjectsMessage(message, variant) {
    if (!container) return;
    container.innerHTML = "";
    const feedback = document.createElement("p");
    feedback.className =
      variant === "error" ? "projects-feedback error" : "projects-feedback";
    feedback.textContent = message;
    container.appendChild(feedback);
  }

  // source may be a local path or the literal string 'github' to indicate using
  // the GitHub API for the given owner.
  Promise.all([loadProjectCardTranslations(), loadProjectsData(source, owner)])
    .then(([, data]) => {
      if (!container || !data.cards) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) {
        // load was superseded by a newer one, nothing to do
        return;
      }
      // deduplicate by repository link or title (covers mixed JSON/github sources)
      let cards = Array.isArray(data.cards) ? data.cards : [];
      cards = cards.filter(isValidProjectCard);

      // ensure demo links have screenshot images when no explicit image
      // is supplied (local JSON cards may already provide their own).
      cards.forEach((card) => {
        ensureProjectCardId(card);
        registerProjectCardTranslations(card);
        if (card.linkDemo && !card.image) {
          card.image = getScreenshotUrl(card.linkDemo);
        }
      });
      const seen = new Set();
      cards = cards.filter((c) => {
        const key =
          c.linkRepository ||
          c.id ||
          getLocalized(c.title, language) ||
          JSON.stringify(c);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!cards.length && source === "github") {
        const failed = Boolean(
          data.githubFetchStatus && data.githubFetchStatus.failed,
        );
        renderProjectsMessage(
          failed
            ? language === "pt-BR"
              ? "Nao foi possivel carregar os projetos do GitHub agora."
              : "Unable to load GitHub projects right now."
            : language === "pt-BR"
              ? "Nenhum projeto encontrado para este perfil."
              : "No projects found for this profile.",
          failed ? "error" : "info",
        );
        return;
      }
      const techCount = {};
      const techFilter = {};

      cards.forEach((card) => {
        if (card.iconTechnologies) {
          card.iconTechnologies.forEach((tech) => {
            if (!tech.name) return;
            techCount[tech.name] = (techCount[tech.name] || 0) + 1;
            if (tech.filter === "no") {
              techFilter[tech.name] = true;
            }
          });
        }
      });

      if (Object.keys(techCount).length > 1) {
        const filterContainer = document.createElement("div");
        filterContainer.className = "filter-container";
        const btnAll = document.createElement("button");
        btnAll.className = "filter-button active";
        btnAll.dataset.filter = "all";
        btnAll.textContent = language === "pt-BR" ? "Todos" : "All";
        btnAll.onclick = () => filterProjectsByTechnology("all");
        filterContainer.appendChild(btnAll);

        const sortedTechs = Object.entries(techCount).sort(([nameA], [nameB]) =>
          nameA.localeCompare(nameB),
        );

        sortedTechs.forEach(([name, count]) => {
          if (techFilter[name]) return;
          const btn = document.createElement("button");
          btn.className = "filter-button";
          btn.dataset.filter = name;
          btn.textContent = `${name} (${count})`;
          btn.onclick = () => filterProjectsByTechnology(name);
          filterContainer.appendChild(btn);
        });
        const parent = container.parentNode || section;
        if (parent) parent.insertBefore(filterContainer, container);
      }

      const fragment = document.createDocumentFragment();

      // Ordenação com ênfase em manutenção:
      // 1) Repositórios com commit seu em main/master primeiro.
      // 2) Entre eles, commit autoral mais recente.
      // 3) Se não houver commit seu em main/master, usar criação do repositório.
      // 4) Empate: criação do repositório e depois datas exibidas no card.
      const sortedCards = [...cards].sort(compareProjectCardsByMaintenance);

      let cardCounter = 0;

      sortedCards.forEach((card) => {
        cardCounter++;
        // ignore stale loads that finished after a later one started
        if (
          loadId !== undefined &&
          container &&
          container.dataset.loadId != loadId
        ) {
          return;
        }

        const div = document.createElement("div");
        div.className = "card card-projects";
        div.dataset.index = cardCounter; // for testing purposes
        if (card.iconTechnologies) {
          div.dataset.technologies = card.iconTechnologies
            .map((t) => t.name)
            .filter(Boolean)
            .join(",");
        }

        let html = "";
        const translatedImageAlt =
          getProjectCardTranslation(card, "descriptionImage", language) || "";
        const translatedTitle =
          getProjectCardTranslation(card, "title", language) || "";
        const translatedInstitution =
          getProjectCardTranslation(card, "institution", language) || "";
        const translatedDescription =
          getProjectCardTranslation(card, "description", language) || "";

        if (card.image) {
          html += `<picture>`;
          if (card.imageMobile)
            html += `<source media="(max-width: 990px)" srcset="${card.imageMobile}" ${card.imageType ? `type="${card.imageType}"` : ""}>`;
          html += `<img src="${card.image}" alt="${escapeHTML(translatedImageAlt)}" loading="lazy" onerror="var p=this.closest('picture'); if(p) p.remove();"></picture>`;
        }
        if (translatedTitle)
          html += `<h3 class="title">${escapeHTML(translatedTitle)}</h3>`;
        if (translatedInstitution)
          html += `<p class="institution">${escapeHTML(translatedInstitution)}</p>`;
        if (translatedDescription)
          html += `<p class="description">${escapeHTML(translatedDescription)}</p>`;

        if (card.iconTechnologies) {
          const techTitle =
            language === "pt-BR" ? "Tecnologias" : "Technologies";
          html += `<h4 class="title-technologies">${techTitle}</h4>`;
          html += `<div class="technologies">`;
          const sortedTechs = [...card.iconTechnologies].sort((a, b) =>
            (a.name || "").localeCompare(b.name || ""),
          );
          sortedTechs.forEach((tech) => {
            const resolved = resolveIconSpec(tech, tech.name || "");
            html += `<i class="${faClass(resolved.style, resolved.icon)} icon" title="${tech.name || ""}"></i>`;
          });
          html += `</div>`;
        }

        if (card.linkRepository || card.linkDemo) {
          const linkTitle = language === "pt-BR" ? "Links" : "Links";
          html += `<h4 class="title-links">${linkTitle}</h4><div class="links">`;
          if (card.linkRepository)
            html += `<a href="${card.linkRepository}" target="_blank" rel="noopener noreferrer" aria-label="Repository"><i class="fa-brands fa-github icon"></i></a>`;
          if (card.linkDemo)
            html += `<a href="${card.linkDemo}" target="_blank" rel="noopener noreferrer" aria-label="Demo"><i class="fa-solid fa-share-from-square icon"></i></a>`;
          html += `</div>`;
        }

        const createdDateLabel = getProjectCreationDisplayDate(card);
        const latestOwnerUpdateLabel =
          getProjectLatestOwnerUpdateDisplayDate(card);
        if (createdDateLabel) {
          html += `<div class="date"><p>${createdDateLabel}`;
          if (latestOwnerUpdateLabel) {
            html += ` - ${latestOwnerUpdateLabel}`;
          }
          html += "</p></div>";
        }

        div.innerHTML = html;
        fragment.appendChild(div);
      });
      container.appendChild(fragment);
    })
    .catch((err) => {
      console.error("[projects] Failed to load projects:", err);
      if (
        loadId !== undefined &&
        container &&
        container.dataset.loadId != loadId
      ) {
        return;
      }
      renderProjectsMessage(
        language === "pt-BR"
          ? "Erro ao montar a secao de projetos. Tente novamente."
          : "Error rendering projects section. Please try again.",
        "error",
      );
    });

  section.appendChild(container);
  main.appendChild(section);
}

function fetchGitHubRepos(owner) {
  // Prefer backend API route (supports token). If unavailable (e.g. Live Server),
  // fall back to direct GitHub API, then finally to local JSON fallback.
  const apiUrl = `/api/github?owner=${encodeURIComponent(owner)}`;
  const directUrl = `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&direction=desc&type=owner`;

  function fetchDirectRepos() {
    return fetch(directUrl).then((fallbackRes) => {
      if (!fallbackRes.ok) throw new Error("Erro ao obter repositórios");
      return fallbackRes.json();
    });
  }

  return fetch(apiUrl)
    .then((res) => {
      if (!res.ok) {
        if (
          res.status === 401 ||
          res.status === 403 ||
          res.status === 404 ||
          res.status === 429 ||
          res.status === 500
        ) {
          // Silent fallback to direct GitHub API
          return fetchDirectRepos().then((repos) => ({
            repos,
            failed: false,
          }));
        }
        throw new Error("Erro ao obter repositórios");
      }
      return res.json().then((repos) => ({ repos, failed: false }));
    })
    .catch((err) => {
      console.error(
        "[projects] Failed to fetch from API route, trying direct GitHub API",
        err,
      );
      return fetchDirectRepos()
        .then((repos) => ({ repos, failed: false }))
        .catch((fallbackErr) => {
          console.error(
            "[projects] Failed to fetch from direct GitHub API as well",
            fallbackErr,
          );
          return { repos: [], failed: true };
        });
    });
}

/**
 * Generic loader for project 'data' used by setupProjects.  It currently supports
 * two modes:
 *   * fetch from a local JSON file (maintains backward compatibility)
 *   * fetch from GitHub API for a given username
 * When loading from GitHub the returned object has the same shape as the JSON
 * file ({ cards: [...] }) so the remainder of the rendering logic can stay
 * unchanged.
 */
// fetch per-repo language breakdown with caching to avoid excess API calls
function fetchRepoLanguages(owner, repoName) {
  const key = `githubLang_${owner}_${repoName}`;
  let cached;
  try {
    cached = localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage unavailable when reading lang cache:", e);
    cached = null;
  }
  if (cached) {
    try {
      return Promise.resolve(JSON.parse(cached));
    } catch (e) {
      console.warn("Bad cached languages for", repoName, e);
    }
  }
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const languagesUrl = isLocalhost
    ? `/api/github-languages?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repoName)}`
    : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/languages`;
  const directLanguagesUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/languages`;

  return fetch(languagesUrl)
    .then((res) => {
      if (res.ok) return res.json();
      if (isLocalhost && (res.status === 404 || res.status === 500)) {
        console.info(
          `[projects] /api/github-languages unavailable for ${repoName}, using direct GitHub API fallback.`,
        );
        return fetch(directLanguagesUrl).then((fallbackRes) =>
          fallbackRes.ok ? fallbackRes.json() : {},
        );
      }
      return {};
    })
    .then((data) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.warn("Unable to cache repo languages:", e);
      }
      return data;
    })
    .catch((err) => {
      console.warn("Error fetching languages for", repoName, err);
      return {};
    });
}

function fetchLatestOwnerCommitOnBranch(owner, repoName, author, branch) {
  const commitUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/commits?sha=${encodeURIComponent(branch)}&per_page=30`;
  const normalizedAuthor = normalizeGitHubLogin(author);

  return fetch(commitUrl)
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((commits) => {
      if (!Array.isArray(commits) || !commits.length) return null;

      const latest = commits.find((commit) => {
        const authorLogin = normalizeGitHubLogin(
          commit && commit.author && commit.author.login,
        );
        const committerLogin = normalizeGitHubLogin(
          commit && commit.committer && commit.committer.login,
        );

        return (
          normalizedAuthor &&
          (authorLogin === normalizedAuthor ||
            committerLogin === normalizedAuthor)
        );
      });

      if (!latest) return null;

      const date =
        (latest &&
          latest.commit &&
          latest.commit.author &&
          latest.commit.author.date) ||
        "";
      if (!date) return null;
      const ts = parseDateToTimestamp(date);
      if (!ts) return null;
      return { iso: date, ts };
    })
    .catch(() => null);
}

function fetchLatestBranchCommitOnBranch(owner, repoName, branch) {
  const commitUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/commits?sha=${encodeURIComponent(branch)}&per_page=1`;

  return fetch(commitUrl)
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((commits) => {
      if (!Array.isArray(commits) || !commits.length) return null;
      const latest = commits[0];
      const date =
        (latest &&
          latest.commit &&
          latest.commit.author &&
          latest.commit.author.date) ||
        "";
      if (!date) return null;
      const ts = parseDateToTimestamp(date);
      if (!ts) return null;
      return { iso: date, ts };
    })
    .catch(() => null);
}

function extractPullRequestActivityTimestamp(pr) {
  if (!pr || typeof pr !== "object") return 0;
  const candidates = [pr.merged_at, pr.updated_at, pr.closed_at, pr.created_at]
    .map(parseDateToTimestamp)
    .filter((ts) => ts > 0);

  if (!candidates.length) return 0;
  return Math.max(...candidates);
}

function fetchLatestPullRequestActivityOnBase(owner, repoName, baseBranch) {
  const pullsUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/pulls?state=all&base=${encodeURIComponent(baseBranch)}&sort=updated&direction=desc&per_page=20`;

  return fetch(pullsUrl)
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((pulls) => {
      if (!Array.isArray(pulls) || !pulls.length) return null;
      let latestTs = 0;
      pulls.forEach((pr) => {
        const ts = extractPullRequestActivityTimestamp(pr);
        if (ts > latestTs) latestTs = ts;
      });
      if (!latestTs) return null;
      return { iso: new Date(latestTs).toISOString(), ts: latestTs };
    })
    .catch(() => null);
}

function fetchLatestMainMasterActivity(owner, repoName) {
  const key = `githubMainMasterActivity_${owner}_${repoName}`;
  if (_repoMainMasterActivityCache.has(key)) {
    return _repoMainMasterActivityCache.get(key);
  }

  const activityPromise = Promise.all([
    fetchLatestBranchCommitOnBranch(owner, repoName, "main"),
    fetchLatestBranchCommitOnBranch(owner, repoName, "master"),
    fetchLatestPullRequestActivityOnBase(owner, repoName, "main"),
    fetchLatestPullRequestActivityOnBase(owner, repoName, "master"),
  ])
    .then((signals) => {
      const candidates = signals.filter(Boolean);
      if (!candidates.length) {
        return { hasActivity: false, iso: "", ts: 0 };
      }

      const latest = candidates.reduce((best, current) => {
        if (!best) return current;
        return current.ts > best.ts ? current : best;
      }, null);

      if (!latest || !latest.ts) {
        return { hasActivity: false, iso: "", ts: 0 };
      }

      return {
        hasActivity: true,
        iso: latest.iso,
        ts: latest.ts,
      };
    })
    .catch(() => ({ hasActivity: false, iso: "", ts: 0 }));

  _repoMainMasterActivityCache.set(key, activityPromise);
  return activityPromise;
}

function fetchLatestOwnerMainMasterCommit(
  owner,
  repoName,
  author,
  defaultBranch,
) {
  const normalizedDefaultBranch = String(defaultBranch || "")
    .trim()
    .toLowerCase();
  const key = `githubOwnerMainMasterCommit_${owner}_${repoName}_${author}_${normalizedDefaultBranch || "none"}`;
  if (_repoOwnerMainMasterCommitCache.has(key)) {
    return _repoOwnerMainMasterCommitCache.get(key);
  }

  const branches = Array.from(
    new Set(
      [normalizedDefaultBranch, "main", "master"].filter(
        (branch) => typeof branch === "string" && branch.length,
      ),
    ),
  );

  const commitPromise = Promise.all(
    branches.map((branch) =>
      fetchLatestOwnerCommitOnBranch(owner, repoName, author, branch),
    ),
  )
    .then((branchCommits) => {
      const candidates = branchCommits.filter(Boolean);
      if (!candidates.length) {
        return { hasCommit: false, iso: "", ts: 0 };
      }

      const latest = candidates.reduce((best, current) => {
        if (!best) return current;
        return current.ts > best.ts ? current : best;
      }, null);

      if (!latest) {
        return { hasCommit: false, iso: "", ts: 0 };
      }

      return {
        hasCommit: true,
        iso: latest.iso,
        ts: latest.ts,
      };
    })
    .catch(() => ({ hasCommit: false, iso: "", ts: 0 }));

  _repoOwnerMainMasterCommitCache.set(key, commitPromise);
  return commitPromise;
}

function loadProjectsData(source, owner) {
  // when building cards from github results, we convert simple strings into
  // full technology objects; this helper does that so the logic stays clean.
  function makeTechObject(name) {
    const tech = { name };
    const guess = guessFaIcon(name);
    if (guess) {
      tech.style = guess.style;
      tech.icon = guess.icon;
    } else {
      // If the Font Awesome stylesheet didn't load or the specific icon
      // isn't available, fall back to a generic code icon instead of
      // dropping the technology entirely.  This prevents "all icons broken"
      // situations when the CDN is unreachable.
      tech.style = "fa-solid";
      tech.icon = "fa-code";
    }
    tech.stack = determineStack(name);
    return tech;
  }

  if (source === "github") {
    const cacheKey = `${source}:${owner || ""}`;
    if (_projectsDataCache.has(cacheKey)) {
      return _projectsDataCache.get(cacheKey);
    }

    // Load repositories and keep only projects owned by the requested user
    // (both original repos and forks created by that same user).
    const ghPromise = fetchGitHubRepos(owner).then((githubResult) => {
      const repos = Array.isArray(githubResult && githubResult.repos)
        ? githubResult.repos
        : [];
      const githubFetchStatus = {
        failed: Boolean(githubResult && githubResult.failed),
      };
      const uniqueRepos = [];
      const seenRepoKeys = new Set();
      repos.forEach((repo) => {
        const key = String(
          (repo &&
            (repo.id ||
              repo.node_id ||
              repo.full_name ||
              repo.html_url ||
              repo.name)) ||
            "",
        );
        if (!key || seenRepoKeys.has(key)) return;
        seenRepoKeys.add(key);
        uniqueRepos.push(repo);
      });

      const filtered = uniqueRepos
        .filter((repo) => isEligibleGitHubProjectRepo(repo, owner))
        .filter((repo) => normalizeGitHubLogin(repo.name) !== "portfolio");

      const maxLangCalls = 59; // keep us safely under the rate limit
      const cardsPromises = filtered.map((repo, idx) => {
        const baseTechs = [];
        if (Array.isArray(repo.topics) && repo.topics.length) {
          baseTechs.push(...repo.topics);
        }
        if (repo.language) baseTechs.push(repo.language);

        const makeDate = (iso) => {
          if (!iso) return "";
          const parts = iso.substring(0, 7).split("-");
          if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
          return parts[0];
        };

        // makeCard returns a promise to keep the same flow for metadata lookup.
        const makeCard = (unique, ownerCommitInfo, mainMasterActivityInfo) => {
          const techObjects = unique
            .map(makeTechObject)
            .filter((t) => t !== null);

          const repoOwnerName = (repo.owner && repo.owner.login) || owner;
          const repoPushedAtIso = repo.pushed_at || "";
          const ownerLatestIso =
            (ownerCommitInfo && ownerCommitInfo.iso) || repoPushedAtIso;
          const ownerLatestTs = parseDateToTimestamp(ownerLatestIso);
          const hasOwnerLatestUpdate = Boolean(ownerLatestTs);

          const card = {
            id: slugifyCardId(repo.name),
            title: { "pt-BR": repo.name, "en-US": repo.name },
            description: repo.description || "",
            linkRepository: repo.html_url,
            dateInit: makeDate(repo.created_at),
            dateEnd: makeDate(repo.pushed_at),
            repoCreatedAtIso: repo.created_at || "",
            hasOwnerMainMasterCommit: hasOwnerLatestUpdate,
            latestOwnerMainMasterCommitAt: ownerLatestIso,
            hasMainMasterActivity: Boolean(
              (mainMasterActivityInfo && mainMasterActivityInfo.hasActivity) ||
              hasOwnerLatestUpdate,
            ),
            latestMainMasterActivityAt:
              (mainMasterActivityInfo && mainMasterActivityInfo.iso) ||
              ownerLatestIso ||
              "",
            iconTechnologies: techObjects,
            githubFallbackTranslations: {
              title: { "pt-BR": repo.name, "en-US": repo.name },
              description: {
                "pt-BR": repo.description || "",
                "en-US": repo.description || "",
              },
            },
          };

          if (repo.homepage) {
            let url = repo.homepage;
            if (!url.match(/^https?:\/\//)) {
              url = `https://${url}`;
            }
            card.linkDemo = url;
            const screenshot = getScreenshotUrl(url);
            card.image = screenshot;
            card.imageMobile = screenshot;
            return Promise.resolve(card);
          }

          // Try to fetch thumbnail.webp from repository
          const thumbnailUrl = `https://raw.githubusercontent.com/${repoOwnerName}/${repo.name}/${repo.default_branch || "main"}/src/assets/img/thumbnail.webp`;

          return fetch(thumbnailUrl, { method: "HEAD" })
            .then((response) => {
              if (response.ok) {
                card.image = thumbnailUrl;
                card.imageMobile = thumbnailUrl;
                card.imageType = "image/webp";
              }
              if (repo.fork && repo.parent) {
                card.description =
                  (card.description ? card.description + " " : "") +
                  `(fork of ${repo.parent.full_name})`;
              }
              return card;
            })
            .catch(() => {
              // If thumbnail doesn't exist, continue without image
              if (repo.fork && repo.parent) {
                card.description =
                  (card.description ? card.description + " " : "") +
                  `(fork of ${repo.parent.full_name})`;
              }
              return card;
            });
        };

        const repoOwnerName = (repo.owner && repo.owner.login) || owner;
        const languagePromise =
          idx < maxLangCalls
            ? fetchRepoLanguages(owner, repo.name)
            : Promise.resolve({});
        const ownerCommitPromise = fetchLatestOwnerMainMasterCommit(
          repoOwnerName,
          repo.name,
          owner,
          repo.default_branch,
        );
        const mainMasterActivityPromise = fetchLatestMainMasterActivity(
          repoOwnerName,
          repo.name,
        );

        return Promise.all([
          languagePromise,
          ownerCommitPromise,
          mainMasterActivityPromise,
        ]).then(([langData, ownerCommitInfo, mainMasterActivityInfo]) => {
          const techs = [...baseTechs, ...Object.keys(langData || {})];
          const unique = Array.from(new Set(techs)).filter(Boolean);
          return makeCard(unique, ownerCommitInfo, mainMasterActivityInfo);
        });
      });

      return Promise.all(cardsPromises).then((cards) => ({
        cards,
        githubFetchStatus,
      }));
    });

    const resultPromise = ghPromise.then((result) => ({
      cards: result.cards,
      githubFetchStatus: result.githubFetchStatus,
    }));

    _projectsDataCache.set(cacheKey, resultPromise);
    resultPromise.catch(() => {
      _projectsDataCache.delete(cacheKey);
    });

    return resultPromise.then((result) => {
      return result;
    });
  }
  // default behaviour: local JSON file
  return fetchJsonWithFallback(source).then((data) => {
    if (!data || !data.cards) return { cards: [] };
    if (Array.isArray(data.cards)) return data;
    if (typeof data.cards === "object") {
      return {
        cards: Object.entries(data.cards)
          .map(([rawId, rawCard]) => {
            if (!rawCard || typeof rawCard !== "object") return null;
            return {
              id: slugifyCardId(rawCard.id || rawId),
              ...rawCard,
            };
          })
          .filter(Boolean),
      };
    }
    return { cards: [] };
  });
}
