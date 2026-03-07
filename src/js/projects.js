function getScreenshotUrl(demoUrl) {
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (isLocalhost) {
    return `https://api.microlink.io/?url=${encodeURIComponent(
      demoUrl,
    )}&screenshot=true&meta=false&embed=screenshot.url`;
  } else {
    return `/api/screenshot?url=${encodeURIComponent(demoUrl)}`;
  }
}

function setupProjects(source, containerId, language, owner, loadId) {
  // when we start working with a container we tag it with the load id so
  // stale async results know to bail out.  loadId is produced by
  // loadDynamicContent and incremented on each invocation.
  const container = document.getElementById(containerId);
  if (container && loadId !== undefined) {
    container.dataset.loadId = loadId;
  }

  // source may be a local path or the literal string 'github' to indicate using
  // the GitHub API for the given owner.
  return loadProjectsData(source, owner)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !data.cards) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) {
        // load was superseded by a newer one, nothing to do
        return;
      }
      // deduplicate by repository link or title (covers mixed JSON/github sources)
      let cards = data.cards || [];

      // ensure demo links have screenshot images when no explicit image
      // is supplied (local JSON cards may already provide their own).
      cards.forEach((card) => {
        if (card.linkDemo && !card.image) {
          card.image = getScreenshotUrl(card.linkDemo);
        }
      });
      const seen = new Set();
      cards = cards.filter((c) => {
        const key =
          c.linkRepository ||
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
        if (card.image) {
          html += `<picture>`;
          if (card.imageMobile)
            html += `<source media="(max-width: 990px)" srcset="${card.imageMobile}" ${card.imageType ? `type="${card.imageType}"` : ""}>`;
          html += `<img src="${card.image}" alt="${getLocalized(card.descriptionImage, language)}" loading="lazy" onerror="var p=this.closest('picture'); if(p) p.remove();"></picture>`;
        }
        if (card.title)
          html += `<h3>${getLocalized(card.title, language)}</h3>`;
        if (card.institution)
          html += `<p class="institution">${getLocalized(card.institution, language)}</p>`;
        if (card.description)
          html += `<p>${getLocalized(card.description, language)}</p>`;

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
    .catch((err) => console.error(`Erro ao carregar ${containerId}:`, err));
}

function fetchGitHubRepos(owner) {
  // Detecta se está rodando no localhost
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Se for localhost e você NÃO estiver usando 'vercel dev',
  // ele chama o GitHub diretamente para não travar o desenvolvimento.
  // Se estiver na Vercel, usa a rota segura.
  const apiUrl = isLocalhost
    ? `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated`
    : "/api/github";

  return fetch(apiUrl)
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao obter repositórios");
      return res.json();
    })
    .catch((err) => {
      console.error("Erro na API:", err);
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
  return fetch(`https://api.github.com/repos/${owner}/${repoName}/languages`)
    .then((res) => (res.ok ? res.json() : {}))
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

        // makeCard returns a promise because we may need to probe GitHub for
        // an existing thumbnail file when no homepage is provided.
        const makeCard = (unique) => {
          const techObjects = unique
            .map(makeTechObject)
            .filter((t) => t !== null);

          const repoOwnerName = (repo.owner && repo.owner.login) || owner;

          const card = {
            title: { "pt-BR": repo.name, "en-US": repo.name },
            description: repo.description || "",
            linkRepository: repo.html_url,
            linkRepositoryTarget: "target='_blank' rel='noopener noreferrer'",
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
            card.linkDemoTarget = "target='_blank' rel='noopener noreferrer'";
            const screenshot = getScreenshotUrl(url);
            card.image = screenshot;
            card.imageMobile = screenshot;
            return Promise.resolve(card);
          }

          const rawThumb = `https://raw.githubusercontent.com/${repoOwnerName}/${repo.name}/main/src/assets/img/thumbnail.webp`;
          return fetch(rawThumb, { method: "HEAD" })
            .then((resp) => {
              if (!resp.ok) {
                return fetch(rawThumb);
              }
              return resp;
            })
            .then((resp) => {
              if (resp.ok) {
                card.image = rawThumb;
                card.imageMobile = rawThumb;
              }
            })
            .catch(() => {
              // any failure treated as missing file
            })
            .then(() => {
              if (!card.image) {
                delete card.image;
                delete card.imageMobile;
                delete card.imageType;
              }

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

    const localPromise = fetchJsonWithFallback(
      "src/json/areas/projects.json",
    ).catch(() => ({ cards: [] }));

    return Promise.all([ghPromise, localPromise]).then(([ghCards, local]) => {
      return { cards: [...ghCards, ...(local.cards || [])] };
    });
  }
  // default behaviour: local JSON file
  return fetchJsonWithFallback(source);
}
