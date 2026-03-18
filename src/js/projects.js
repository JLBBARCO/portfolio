function getScreenshotUrl(demoUrl) {
  return `https://api.microlink.io/?url=${encodeURIComponent(
    demoUrl,
  )}&screenshot=true&meta=false&embed=screenshot.url`;
}

// Cache GitHub project loads to avoid duplicated network calls when multiple
// sections request the same data during one render cycle.
const _projectsDataCache = new Map();

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

function getProjectCardTranslation(card, field, language) {
  if (!card || !field) return "";
  const locale = normalizeLocale(language);
  const cardId = ensureProjectCardId(card);
  const byId = _projectCardTranslations[cardId];
  if (byId && byId[field]) {
    const fromMap = getLocalized(byId[field], locale);
    if (fromMap) return fromMap;
  }
  return getLocalized(card[field], locale);
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
  container.className = "carrousel";

  if (container && loadId !== undefined) {
    container.dataset.loadId = loadId;
  }

  // source may be a local path or the literal string 'github' to indicate using
  // the GitHub API for the given owner.
  loadProjectsData(source, owner)
    .then((data) => {
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
      const techCount = {};
      const techFilter = {};

      cards.forEach((card) => {
        if (card.iconTechnologies) {
          card.iconTechnologies.forEach((tech) => {
            if (!tech.name || !tech.style || !tech.icon) return;
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
        container.parentNode.insertBefore(filterContainer, container);
      }

      const fragment = document.createDocumentFragment();

      // Nova lógica de ordenação:
      // 1. Primeiro pela data de fim (dateEnd) mais recente.
      // 2. Se houver empate (ou se ambas forem nulas), pela data de início (dateInit) mais recente.
      const sortedCards = [...cards].sort((a, b) => {
        const endA = parseDate(a.dateEnd);
        const endB = parseDate(b.dateEnd);

        if (endA !== endB) {
          return endB - endA;
        }

        const initA = parseDate(a.dateInit);
        const initB = parseDate(b.dateInit);
        return initB - initA;
      });

      sortedCards.forEach((card) => {
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
            if (!tech.style || !tech.icon) return; // omit unknown icons
            html += `<i class="${faClass(tech.style, tech.icon)} icon" title="${tech.name || ""}"></i>`;
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

        if (card.dateInit) {
          html += `<div class="date"><p>${card.dateInit}`;
          if (card.dateEnd) {
            html += ` - ${card.dateEnd}`;
          }
          html += "</p></div>";
        }

        div.innerHTML = html;
        fragment.appendChild(div);
      });
      container.appendChild(fragment);
    })
    .catch((err) => console.error("[projects] Failed to load projects:", err));

  section.appendChild(container);
  main.appendChild(section);
}

function fetchGitHubRepos(owner) {
  // Prefer backend API route (supports token). If unavailable (e.g. Live Server),
  // fall back to direct GitHub API so localhost still works.
  const apiUrl = `/api/github?owner=${encodeURIComponent(owner)}`;
  const directUrl = `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=updated&direction=desc`;

  return fetch(apiUrl)
    .then((res) => {
      if (!res.ok) {
        if (res.status === 404 || res.status === 500) {
          // Silent fallback to direct API
          return fetch(directUrl).then((fallbackRes) => {
            if (!fallbackRes.ok) throw new Error("Erro ao obter repositórios");
            return fallbackRes.json();
          });
        }
        throw new Error("Erro ao obter repositórios");
      }
      return res.json();
    })
    .catch((err) => {
      console.error("[projects] Failed to fetch repositories:", err);
      return [];
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

    // load the list of repos, convert them into card objects, then
    // merge with whatever is defined locally (useful for collaborations or
    // projects that don't live under the user's account).  setupProjects
    // already deduplicates by link/title so we don't need to worry about
    // collisions here.
    const ghPromise = fetchGitHubRepos(owner).then((repos) => {
      // ignore a few special repositories that aren't really projects
      const filtered = repos.filter((repo) => {
        const name = repo.name.toLowerCase();
        const repoOwner = (
          repo.owner && repo.owner.login ? repo.owner.login : ""
        ).toLowerCase();
        return (
          // exclude the user's own profile repo(s)
          name !== owner.toLowerCase() &&
          // also ignore any repo whose name equals its owner's login (GitHub Pages
          // style repositories) regardless of whether the owner is the supplied
          // account or a collaborator.
          name !== repoOwner &&
          name !== "portfolio" &&
          name !== `${owner.toLowerCase()}.github.io`
        );
      });

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

        // makeCard returns a promise to keep the same flow for language lookup.
        const makeCard = (unique) => {
          const techObjects = unique
            .map(makeTechObject)
            .filter((t) => t !== null);

          const repoOwnerName = (repo.owner && repo.owner.login) || owner;

          const card = {
            id: slugifyCardId(repo.name),
            title: { "pt-BR": repo.name, "en-US": repo.name },
            description: repo.description || "",
            linkRepository: repo.html_url,
            dateInit: makeDate(repo.created_at),
            dateEnd: makeDate(repo.pushed_at),
            iconTechnologies: techObjects,
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

        if (idx < maxLangCalls) {
          return fetchRepoLanguages(owner, repo.name).then((langData) => {
            const techs = [...baseTechs, ...Object.keys(langData)];
            const unique = Array.from(new Set(techs)).filter(Boolean);
            return makeCard(unique);
          });
        } else {
          const unique = Array.from(new Set(baseTechs)).filter(Boolean);
          // makeCard returns a promise already
          return makeCard(unique);
        }
      });

      return Promise.all(cardsPromises).then((cards) => cards);
    });

    const resultPromise = Promise.all([ghPromise]).then(([ghCards, local]) => {
      return { cards: [...ghCards, ...(local.cards || [])] };
    });

    _projectsDataCache.set(cacheKey, resultPromise);
    resultPromise.catch(() => {
      _projectsDataCache.delete(cacheKey);
    });

    return resultPromise.then((result) => {
      return result;
    });
  }
  // default behaviour: local JSON file
  return fetchJsonWithFallback(source);
}

function translationProjects(language) {
  fetchJsonWithFallback("src/json/areas/projects.json")
    .then((data) => {
      data.cards.forEach((card) => {
        const projectCard = document.getElementById(card.id);

        if (projectCard) {
          const title = document.querySelector(`#${projectCard.id} h3.title`);
          title.innerHTML = card.title[language];

          const description = document.querySelector(
            `#${projectCard.id} p.description`,
          );
          description.innerHTML = card.description[language];
        }
      });
    })
    .catch((error) =>
      console.log("Error to load project translations:" + error),
    );
}
