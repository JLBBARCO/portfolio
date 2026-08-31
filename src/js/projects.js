// Cache GitHub project loads to avoid duplicated network calls when multiple
// sections request the same data during one render cycle.
const _projectsDataCache = new Map();
const _projectCardTranslations = Object.create(null);
const _projectCardImageOverrides = Object.create(null);
let _projectTranslationsLoadPromise = null;

// Translation dictionary for project cards, keyed by card id.
// Each entry can define title/description/institution/descriptionImage.
// If a field is missing, the renderer falls back to the card payload.
function normalizeLocale(language) {
  const normalized = String(language || "").toLowerCase();
  return normalized.startsWith("pt") ? "pt-BR" : "en-US";
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

        const imageOverride =
          typeof rawCard.img === "string"
            ? rawCard.img
            : typeof rawCard.image === "string"
              ? rawCard.image
              : "";
        if (imageOverride) {
          _projectCardImageOverrides[cardId] = imageOverride;
        }
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

/**
 * Monta o elemento DOM de um card de projeto (usado tanto pelos destaques em
 * #highlightsContainer quanto pela listagem completa em #projectsContainer),
 * garantindo que os dois usem exatamente o mesmo layout/estilo.
 *
 * options:
 *   - cardCounter: numero usado em data-index (fins de teste)
 *   - extraClassName: classe adicional (ex.: "card-highlight")
 *   - starCount: se numerico, exibe um selo com a quantidade de estrelas
 */
function buildProjectCardElement(card, language, options) {
  const opts = options || {};
  const div = document.createElement("div");
  div.className = "card card-projects";
  if (opts.extraClassName) div.classList.add(opts.extraClassName);
  if (opts.cardCounter !== undefined) {
    div.dataset.index = opts.cardCounter; // for testing purposes
  }
  if (card.iconTechnologies) {
    div.dataset.technologies = card.iconTechnologies
      .map((t) => t.name)
      .filter(Boolean)
      .join(",");
  }

  let html = "";

  if (typeof opts.starCount === "number" && Number.isFinite(opts.starCount)) {
    html += `<div class="highlight-stars"><i class="fa-solid fa-star icon"></i><span>${opts.starCount}</span></div>`;
  }

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
    const techTitle = language === "pt-BR" ? "Tecnologias" : "Technologies";
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
  const latestOwnerUpdateLabel = getProjectLatestOwnerUpdateDisplayDate(card);
  if (createdDateLabel) {
    html += `<div class="date"><p>${createdDateLabel}`;
    if (latestOwnerUpdateLabel) {
      html += ` - ${latestOwnerUpdateLabel}`;
    }
    html += "</p></div>";
  }

  div.innerHTML = html;
  return div;
}

/**
 * Seleciona, entre os cards de projetos ja carregados (mesma fonte usada por
 * #projectsContainer), os `limit` repositorios do `owner` com mais estrelas
 * no GitHub. Roda inteiramente no navegador: consome `SiteData.repos()` (o
 * mesmo snapshot client-side que alimenta #projectsContainer) so para saber
 * a contagem de estrelas, sem repetir nenhuma chamada a api.github.com.
 */
function pickTopStarredProjectCards(cards, repos, owner, limit) {
  if (!Array.isArray(cards) || !cards.length) return [];
  if (!Array.isArray(repos) || !repos.length) return [];

  const starsByRepoName = new Map();
  repos.forEach((repo) => {
    if (!isEligibleGitHubProjectRepo(repo, owner)) return;
    starsByRepoName.set(
      normalizeGitHubLogin(repo.name),
      Number(repo.stargazers_count) || 0,
    );
  });

  return cards
    .map((card) => {
      const repoKey = normalizeGitHubLogin(card.repoName || card.id);
      if (!starsByRepoName.has(repoKey)) return null;
      return { card, stars: starsByRepoName.get(repoKey) };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars;
      return compareProjectCardsByMaintenance(a.card, b.card);
    })
    .slice(0, limit);
}

/**
 * Carrega, no navegador, a lista de repositorios do owner com a contagem de
 * estrelas (SiteData.repos()). Mesma arquitetura client-side de
 * loadProjectsData("github", owner): consome o snapshot ja resolvido pelo
 * SiteData, sem falar diretamente com api.github.com.
 */
function loadRepositoryStars(source, owner) {
  if (source !== "github") return Promise.resolve([]);

  const siteData = window.SiteData || null;
  if (!siteData || typeof siteData.repos !== "function") {
    return Promise.resolve([]);
  }

  return siteData.repos().catch((error) => {
    console.warn("[projects] Falha ao ler estrelas dos repositorios:", error);
    return [];
  });
}

function setupProjects(source, language, owner, loadId) {
  // when we start working with a container we tag it with the load id so
  // stale async results know to bail out.  loadId is produced by
  // loadDynamicContent and incremented on each invocation.
  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Projects";
  section.dataset.dynamicSection = "true";
  section.className = "portfolio";

  const title = document.createElement("h2");
  title.id = "projectsTitle";
  title.setAttribute("data-i18n", "section_projects_title");
  title.innerHTML = "Projects";
  section.append(title);

  const highlights = document.createElement("div");
  highlights.id = "projectsHighlights";
  highlights.className = "projects";
  section.appendChild(highlights);

  const highlightsTitle = document.createElement("h3");
  highlightsTitle.id = "projectsHighlightsTitle";
  highlightsTitle.setAttribute(
    "data-i18n",
    "section_projects_highlights_title",
  );
  highlightsTitle.innerHTML = "Highlights";
  highlights.append(highlightsTitle);

  const highlightsContainer = document.createElement("article");
  highlightsContainer.id = "highlightsContainer";
  highlightsContainer.className = "block semi-hidden";

  if (highlightsContainer && loadId !== undefined) {
    highlightsContainer.dataset.loadId = loadId;
  }

  highlights.appendChild(highlightsContainer);
  // Sem destaques ainda: evita mostrar o titulo "Highlights" com uma area vazia
  // ate sabermos se ha estrelas suficientes para preenche-la.
  highlights.style.display = "none";

  const allProjects = document.createElement("div");
  allProjects.id = "allProjects";
  allProjects.className = "projects";
  section.appendChild(allProjects);

  const allProjectsTitle = document.createElement("h3");
  allProjectsTitle.id = "allProjectsTitle";
  allProjectsTitle.setAttribute("data-i18n", "section_projects_all_title");
  allProjectsTitle.innerHTML = "All Projects";
  allProjects.append(allProjectsTitle);

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
  Promise.all([
    loadProjectCardTranslations(),
    loadProjectsData(source, owner),
    loadRepositoryStars(source, owner),
  ])
    .then(([, data, repos]) => {
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

        const div = buildProjectCardElement(card, language, {
          cardCounter,
        });
        fragment.appendChild(div);
      });
      container.appendChild(fragment);

      // Destaques: os 2 repositorios do owner com mais estrelas no GitHub,
      // renderizados com o mesmo layout de #projectsContainer. Roda no
      // cliente, a partir dos mesmos cards + snapshot de repositorios ja
      // carregados acima.
      if (
        highlightsContainer &&
        !(loadId !== undefined && highlightsContainer.dataset.loadId != loadId)
      ) {
        highlightsContainer.innerHTML = "";
        const topStarred = pickTopStarredProjectCards(cards, repos, owner, 2);

        if (topStarred.length) {
          const highlightsFragment = document.createDocumentFragment();
          topStarred.forEach((entry, idx) => {
            const highlightDiv = buildProjectCardElement(entry.card, language, {
              cardCounter: idx + 1,
              extraClassName: "card-highlight",
              starCount: entry.stars,
            });
            highlightsFragment.appendChild(highlightDiv);
          });
          highlightsContainer.appendChild(highlightsFragment);
          if (highlights) highlights.style.display = "";
        } else if (highlights) {
          highlights.style.display = "none";
        }
      }
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

  allProjects.appendChild(container);
  main.appendChild(section);
}

/**
 * Loader dos dados dos projetos.
 *
 *   * source === "github": consome os cards JA PRONTOS do snapshot gerado no
 *     servidor (/api/site-data), atualizado de hora em hora. O navegador NAO
 *     fala com api.github.com, nao resolve imagens e nao guarda cache proprio.
 *   * qualquer outro valor: arquivo JSON local (compatibilidade).
 */
function loadProjectsData(source, owner) {
  if (source === "github") {
    const cacheKey = `${source}:${owner || ""}`;
    if (_projectsDataCache.has(cacheKey)) {
      return _projectsDataCache.get(cacheKey);
    }

    const siteData = window.SiteData || null;
    if (!siteData || typeof siteData.projects !== "function") {
      console.info(
        "[projects] SiteData indisponivel; nenhum projeto carregado do snapshot.",
      );
      return Promise.resolve({
        cards: [],
        githubFetchStatus: { failed: true },
      });
    }

    const resultPromise = siteData
      .projects()
      .then((projects) => {
        const cards = Array.isArray(projects && projects.cards)
          ? projects.cards
          : [];
        const status = (projects && projects.githubFetchStatus) || {
          failed: cards.length === 0,
        };
        return { cards, githubFetchStatus: status };
      })
      .catch((error) => {
        console.warn("[projects] Falha ao ler o snapshot do site:", error);
        return { cards: [], githubFetchStatus: { failed: true } };
      });

    _projectsDataCache.set(cacheKey, resultPromise);
    return resultPromise;
  }

  // arquivo JSON local
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
              image: rawCard.image || rawCard.img || "",
              ...rawCard,
            };
          })
          .filter(Boolean),
      };
    }
    return { cards: [] };
  });
}
