const windowWidth = 990;

// unique identifier for the most recent dynamic-content load; used to
// ignore stale async results (e.g. user switched language mid-load).
let _currentLoadId = 0;

// Helper para normalizar classes do Font Awesome
function faClass(style, icon, size) {
  let styleClass = style || "fa-solid";
  if (styleClass && !styleClass.startsWith("fa-"))
    styleClass = `fa-${styleClass}`;
  let iconClass = icon || "";
  if (iconClass && !iconClass.startsWith("fa-")) iconClass = `fa-${iconClass}`;
  let sizeClass = size || "";
  if (sizeClass && !sizeClass.startsWith("fa-")) sizeClass = `fa-${sizeClass}`;
  return [styleClass, iconClass, sizeClass].filter(Boolean).join(" ");
}

// try to guess a FontAwesome icon based on a technology name.  returns
// an object { style, icon } or null if no matching icon could be found.
// caching the result avoids repeated DOM manipulations.
const _faGuessCache = {};
// some common technology names don't match the FontAwesome class.  e.g.
// "html" → "html5", "javascript" → "js".  when the direct lookup fails we
// consult this alias table and try again once more.
const _faAliasMap = {
  javascript: "js",
  html: "html5",
  css: "css3",
  "c#": "csharp",
  "c++": "cplusplus",
  node: "node-js",
  // handle the different ways people write "Node.js"
  nodejs: "node-js",
  typescript: "typescript",
  react: "react",
  vue: "vuejs",
  angular: "angular",
};
function guessFaIcon(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (_faGuessCache[key] !== undefined) return _faGuessCache[key];

  // normalize to a candidate class name (drop spaces, punctuation)
  const candidate = key
    .replace(/\s+/g, "-")
    .replace(/[\+\.#]/g, "")
    .replace(/[^a-z0-9\-]/g, "");
  if (!candidate) {
    _faGuessCache[key] = null;
    return null;
  }

  const styles = ["fa-brands", "fa-solid", "fa-regular"];
  let found = null;
  for (const style of styles) {
    const className = `fa-${candidate}`;
    const i = document.createElement("i");
    i.className = `${style} ${className} fa-test-icon`;
    i.style.position = "absolute";
    i.style.visibility = "hidden";
    document.body.appendChild(i);
    // read computed content to see if FA knows the icon
    const content = window
      .getComputedStyle(i, ":before")
      .getPropertyValue("content");
    document.body.removeChild(i);
    if (content && content !== '""' && content !== "none") {
      found = { style, icon: className };
      break;
    }
  }
  _faGuessCache[key] = found;
  if (!found && _faAliasMap[key]) {
    // recursive call with alias (will hit cache if we've tried it before)
    found = guessFaIcon(_faAliasMap[key]);
    _faGuessCache[key] = found;
  }
  return found;
}

// choose a stack category based on common language/technology names.  the
// returned object has the same shape as the stack entries in projects.json.
function determineStack(name) {
  const lower = (name || "").toLowerCase();
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
  if (front.some((w) => lower.includes(w)))
    return { id: "frontEnd", "en-US": "Front-end", "pt-BR": "Front-end" };
  if (back.some((w) => lower.includes(w)))
    return { id: "backEnd", "en-US": "Back-end", "pt-BR": "Back-end" };
  return { id: "other", "en-US": "Other", "pt-BR": "Outro" };
}

// Controle de tamanho de fonte
let fontSize = 1;

// fetch com fallback
function fetchAny(...paths) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function next() {
      if (i >= paths.length)
        return reject(new Error("All fetch attempts failed"));
      fetch(paths[i])
        .then((res) => {
          if (res.ok) resolve(res);
          else {
            i++;
            next();
          }
        })
        .catch(() => {
          i++;
          next();
        });
    }
    next();
  });
}

// ============================================================================
// GitHub API helpers
// ============================================================================

/**
 * Retrieve repository list for a user; uses localStorage caching to avoid
 * hammering the unauthenticated rate limit.  The cache expires after one hour.
 * Returns a promise that resolves to the raw array returned by the GitHub API.
 */
function fetchGitHubRepos(owner) {
  const cacheKey = `githubRepos_${owner}`;
  const now = Date.now();
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached);
      // 1‑hour freshness window
      if (now - timestamp < 1000 * 60 * 60) {
        return Promise.resolve(data);
      }
    } catch (e) {
      console.warn("Failed to parse cached repos:", e);
    }
  }

  // try fetching both owned repos and, if available, memberships
  const baseHeaders = {
    // topic support, harmless if ignored
    Accept: "application/vnd.github.mercy-preview+json",
  };
  const urls = [
    `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated&direction=desc&type=owner`,
    `https://api.github.com/users/${owner}/repos?per_page=100&sort=updated&direction=desc&type=member`,
  ];

  return Promise.all(
    urls.map((u) =>
      fetch(u, { headers: baseHeaders })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
    ),
  )
    .then((arrays) => {
      // merge and dedupe by repo id
      const combined = [];
      const seen = new Set();
      arrays.flat().forEach((repo) => {
        if (repo && repo.id && !seen.has(repo.id)) {
          seen.add(repo.id);
          combined.push(repo);
        }
      });
      // sort by updated_at descending
      combined.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: now, data: combined }),
        );
      } catch (e) {
        console.warn("Unable to cache repos in localStorage:", e);
      }
      return combined;
    })
    .catch((err) => {
      console.warn("GitHub fetch failed, attempting cached data:", err);
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          return data;
        } catch (e) {
          console.warn("Cached repos malformed:", e);
        }
      }
      // rethrow so caller can handle
      throw err;
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
  const cached = localStorage.getItem(key);
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
        const repoOwner = (repo.owner?.login || "").toLowerCase();
        return (
          // exclude the user's own profile repo(s)
          name !== owner.toLowerCase() &&
          // also ignore any repo whose name equals its owner's login (GitHub Pages
          // style repositories) regardless of whether the owner is the supplied
          // account or a collaborator.
          name !== repoOwner &&
          name !== "portfolio" &&
          name !== "study" &&
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
        const makeCard = async (unique) => {
          const techObjects = unique
            .map(makeTechObject)
            .filter((t) => t !== null);

          const repoOwnerName = repo.owner?.login || owner;

          const card = {
            title: { "pt-BR": repo.name, "en-US": repo.name },
            description: repo.description || "",
            linkRepository: repo.html_url,
            linkRepositoryTarget: "target='_blank' rel='noopener noreferrer'",
            dateInit: makeDate(repo.created_at),
            dateEnd: makeDate(repo.pushed_at),
            iconTechnologies: techObjects,
          };

          // image determination follows the order requested by the user.
          if (repo.homepage) {
            // use screenshot API when a website is specified in the GitHub
            // repo "about" section.
            let url = repo.homepage;
            if (!url.match(/^https?:\/\//)) {
              url = `https://${url}`;
            }
            card.linkDemo = url;
            card.linkDemoTarget = "target='_blank' rel='noopener noreferrer'";
            const screenshot = `https://api.microlink.io/?url=${encodeURIComponent(
              url,
            )}&screenshot=true&meta=false&embed=screenshot.url`;
            card.image = screenshot;
            card.imageMobile = screenshot;
          } else {
            // no homepage; attempt to use a repository thumbnail at a
            // well-known path.  Use HEAD first but fall back to GET if the
            // method is blocked by CORS or not allowed (GitHub sometimes
            // responds 405).
            const rawThumb = `https://raw.githubusercontent.com/${repoOwnerName}/${repo.name}/main/src/assets/img/tumbnail.webp`;
            try {
              let resp = await fetch(rawThumb, { method: "HEAD" });
              if (!resp.ok) {
                // some servers reject HEAD; try GET to be certain
                resp = await fetch(rawThumb);
              }
              if (resp.ok) {
                card.image = rawThumb;
                card.imageMobile = rawThumb;
              }
            } catch (e) {
              // any failure treated as missing file
            }
          }

          // remove image fields if we never found anything (or they
          // weren't set above).  if no image exists, provide a sensible
          // default open-graph preview so that GitHub cards and the projects
          // carousel don't look empty.
          if (!card.image) {
            delete card.image;
            delete card.imageMobile;
            delete card.imageType;
          }
          if (!card.image) {
            const og = `https://opengraph.githubassets.com/1/${repoOwnerName}/${repo.name}`;
            card.image = og;
            card.imageMobile = og;
          }

          if (repo.fork && repo.parent) {
            card.description =
              (card.description ? card.description + " " : "") +
              `(fork of ${repo.parent.full_name})`;
          }
          return card;
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

function fetchJsonWithFallback(path) {
  const basename = path.split("/").pop();
  return fetchAny(path, basename).then((res) =>
    res.ok
      ? res.json()
      : Promise.reject(new Error(`Fetch failed with status: ${res.status}`)),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const faviconLink = document.getElementById("favicon");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  function updateFavicon(eventOrBool) {
    const isDark =
      typeof eventOrBool === "boolean"
        ? eventOrBool
        : (eventOrBool?.matches ?? prefersDark.matches);
    if (!faviconLink) return;
    const newHref = isDark
      ? "src/assets/favicon/code-dark.svg"
      : "src/assets/favicon/code-light.svg";
    faviconLink.href = newHref + "?v=" + Date.now();
  }

  updateFavicon(prefersDark.matches);
  if (typeof prefersDark.addEventListener === "function") {
    prefersDark.addEventListener("change", updateFavicon);
  } else if (typeof prefersDark.addListener === "function") {
    prefersDark.addListener(updateFavicon);
  }

  const savedFontSize = localStorage.getItem("fontSize");
  if (savedFontSize) {
    document.body.style.fontSize = savedFontSize;
    const parsed = parseFloat(savedFontSize);
    if (!isNaN(parsed)) fontSize = parsed;
  }

  resize();
  window.addEventListener("resize", resize);

  const menuButton = document.getElementById("menu-button");
  if (menuButton) {
    const menuIcon = document.getElementById("menuIcon");
    if (menuIcon) {
      menuIcon.classList.remove("fa-xmark", "fa-close", "fa-menu");
      if (!menuIcon.classList.contains("fa-bars"))
        menuIcon.classList.add("fa-bars");
    }
    menuButton.addEventListener("click", toggleMenu);
  }

  const languageBtn = document.getElementById("languageBtn");
  if (languageBtn) {
    languageBtn.addEventListener("click", changeLanguage);
  }

  const accessibilityButton = document.getElementById("accessibility-button");
  const increaseFontButton = document.getElementById("increase-font");
  const decreaseFontButton = document.getElementById("decrease-font");
  const resetFontButton = document.getElementById("reset-font");

  if (accessibilityButton)
    accessibilityButton.addEventListener("click", accessibilityToggle);
  if (increaseFontButton)
    increaseFontButton.addEventListener("click", increaseFont);
  if (decreaseFontButton)
    decreaseFontButton.addEventListener("click", decreaseFont);
  if (resetFontButton) resetFontButton.addEventListener("click", resetFont);

  document.addEventListener("click", (event) => {
    const accessibilityMenu = document.getElementById("accessibility-menu");
    if (accessibilityMenu && accessibilityMenu.style.display === "flex") {
      const isClickInsideMenu = accessibilityMenu.contains(event.target);
      const isClickOnButton = accessibilityButton?.contains(event.target);
      if (!isClickInsideMenu && !isClickOnButton) {
        accessibilityMenu.style.display = "none";
        accessibilityMenu.setAttribute("aria-hidden", "true");
        if (accessibilityButton)
          accessibilityButton.setAttribute("aria-expanded", "false");
      }
    }
  });

  function loadDynamicContent() {
    // bump token for this run; any previous promises will become stale
    const myLoadId = ++_currentLoadId;

    const containers = [
      "projectsContainer",
      "technologiesContainer",
      "techsThisSite",
      "contactContainer",
      "formationsContainer",
    ];

    containers.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });

    document
      .querySelectorAll(".filter-container, .btn.prev, .btn.next")
      .forEach((el) => el.remove());

    const storedLang = localStorage.getItem("language");
    const currentLang =
      storedLang || (navigator.language.startsWith("pt") ? "pt" : "en");
    const locale = currentLang === "pt" ? "pt-BR" : "en-US";

    // load projects from GitHub API instead of local json
    const githubOwner = document.body.dataset.githubOwner || "JLBBARCO";
    const pProjects = setupProjects(
      "github",
      "projectsContainer",
      locale,
      githubOwner,
      myLoadId,
    );
    const pFormations = setupFormations(
      "src/json/areas/formation.json",
      "formationsContainer",
      locale,
      myLoadId,
    );
    const pIcons = setIconsTechsSite(
      "src/json/areas/techs-this-site.json",
      "techsThisSite",
      myLoadId,
    );
    const pLinks = setIconsContact(
      "src/json/areas/contact.json",
      "contactContainer",
      myLoadId,
    );

    const pTechnologies = loadAllTechnologies(locale, myLoadId);

    Promise.all([pProjects, pIcons, pLinks, pFormations, pTechnologies])
      .then(() => {
        setupCarouselButtons();
        addNewIcons("src/assets/icons/svg.json");
        window.dispatchEvent(new Event("dynamicContentReady"));
      })
      .catch((err) => {
        console.warn("Erro no carregamento dinâmico:", err);
        window.dispatchEvent(new Event("dynamicContentReady"));
      });
  }

  function setupCarouselButtons() {
    const carrosselContainer = document.querySelector(".carrousel");
    if (!carrosselContainer) return;

    const parent = carrosselContainer.parentNode;
    parent
      .querySelectorAll(".btn.prev, .btn.next")
      .forEach((el) => el.remove());

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn prev";
    prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
    prevBtn.setAttribute("aria-label", "Previous projects");
    prevBtn.onclick = prevProjects;

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn next";
    nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
    nextBtn.setAttribute("aria-label", "Next projects");
    nextBtn.onclick = nextProjects;

    parent.insertBefore(prevBtn, carrosselContainer);
    parent.appendChild(nextBtn);

    carrosselContainer.addEventListener(
      "wheel",
      function (e) {
        const atStart = carrosselContainer.scrollLeft === 0;
        const atEnd =
          carrosselContainer.scrollLeft + carrosselContainer.clientWidth >=
          carrosselContainer.scrollWidth - 10;

        if ((!atEnd && e.deltaY > 0) || (!atStart && e.deltaY < 0)) {
          e.preventDefault();
          const scrollSpeed = 2;
          carrosselContainer.scrollLeft += e.deltaY * scrollSpeed;
        }
      },
      { passive: false },
    );
  }

  loadDynamicContent();
  window.addEventListener("languageChanged", loadDynamicContent);
});

function calcularIdade() {
  const nascimento = new Date(2008, 8, 24);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

function resize() {
  const navLinks = document.querySelector(".nav-links");
  const menuButton = document.getElementById("menu-button");
  if (!navLinks) return;
  if (window.innerWidth > windowWidth) {
    navLinks.style.display = "flex";
    if (menuButton) menuButton.setAttribute("aria-expanded", "true");
  } else {
    navLinks.style.display = "none";
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
  }
}

function toggleMenu() {
  const navLinks = document.querySelector(".nav-links");
  const menuIcon = document.getElementById("menuIcon");
  const menuButton = document.getElementById("menu-button");
  if (!navLinks) return;

  const isVisible = window.getComputedStyle(navLinks).display !== "none";
  navLinks.style.display = isVisible ? "none" : "flex";

  if (menuIcon) {
    menuIcon.classList.toggle("fa-bars", isVisible);
    menuIcon.classList.toggle("fa-xmark", !isVisible);
  }
  if (menuButton) menuButton.setAttribute("aria-expanded", !isVisible);
}

function accessibilityToggle() {
  const menu = document.getElementById("accessibility-menu");
  const btn = document.getElementById("accessibility-button");
  if (!menu) return;

  const isVisible = menu.style.display === "flex";
  menu.style.display = isVisible ? "none" : "flex";
  menu.setAttribute("aria-hidden", !isVisible);
  if (btn) {
    btn.setAttribute("aria-expanded", !isVisible);
    if (!isVisible) menu.focus();
  }
}

function updateFontSize(newSize) {
  fontSize = Math.max(0.6, Math.min(3.0, Math.round(newSize * 10) / 10));
  document.body.style.fontSize = fontSize + "em";
  // persist in localStorage instead of cookie
  try {
    localStorage.setItem("fontSize", `${fontSize}em`);
  } catch (e) {
    console.warn("Unable to save fontSize:", e);
  }
}

function increaseFont() {
  updateFontSize(fontSize + 0.1);
}

function decreaseFont() {
  updateFontSize(fontSize - 0.1);
}

function resetFont() {
  updateFontSize(1);
}

function setIconsTechsSite(fileURL, containerID, loadId) {
  const container = document.getElementById(containerID);
  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container || !data.icons) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      const fragment = document.createDocumentFragment();
      data.icons.forEach((icon) => {
        const div = document.createElement("div");
        div.className = "icon-container";
        const classes = faClass(icon.style, icon.class);
        div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
        fragment.appendChild(div);
      });
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) =>
      console.error("Erro ao carregar ícones techs-this-site:", err),
    );
}

function setIconsContact(fileURL, containerId, loadId) {
  const container = document.getElementById(containerId);
  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(data.cards)) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      const fragment = document.createDocumentFragment();

      data.cards.forEach((card) => {
        const a = document.createElement("a");
        a.href = card.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "link-item";

        const iconClasses = faClass(card.style, card.icon);
        a.innerHTML = `<i class="${iconClasses} icon"></i>`;
        a.setAttribute("aria-label", card.name);
        a.title = card.name;

        fragment.appendChild(a);
      });
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) => console.error("Erro ao carregar contatos:", err));
}

function getLocalized(value, language) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    value[language] ||
    value["pt-BR"] ||
    value["en-US"] ||
    value.pt ||
    value.en ||
    Object.values(value)[0] ||
    ""
  );
}

/**
 * Converte string de data (MM/AAAA ou AAAA) em timestamp.
 * retorna 0 se a data for inválida ou ausente, facilitando comparações
 * de ordenação.
 * @param {string} dateStr
 * @returns {number}
 */
function parseDate(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split("/");
  if (parts.length === 2) {
    const [month, year] = parts;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1).getTime();
  } else if (parts.length === 1) {
    return new Date(parseInt(parts[0], 10), 0).getTime();
  }
  return 0;
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

      // ensure demo links have screenshot images even for local JSON entries
      cards.forEach((card) => {
        if (card.linkDemo) {
          const screenshot =
            `https://api.microlink.io/?url=${encodeURIComponent(
              card.linkDemo,
            )}&screenshot=true&meta=false&embed=screenshot.url` || ``;
          card.image = screenshot;
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

      // sort by most recent start date first; if starts are equal (or missing),
      // then sort by most recent end date.  This puts cards that began in a given
      // year ahead of cards that only ended in that year.
      const sortedCards = [...cards].sort((a, b) => {
        const initA = parseDate(a.dateInit);
        const initB = parseDate(b.dateInit);
        if (initA !== initB) {
          return initB - initA;
        }
        const endA = parseDate(a.dateEnd);
        const endB = parseDate(b.dateEnd);
        return endB - endA;
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
          html += `<img src="${card.image}" alt="${getLocalized(card.descriptionImage, language)}" loading="lazy" onerror="this.closest('picture')?.remove()"></picture>`;
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

function setupFormations(fileURL, containerId, language, loadId) {
  const container = document.getElementById(containerId);
  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !data.cards) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) {
        return;
      }
      const cards = data.cards;

      const typeCount = {};
      const typeNames = {};
      cards.forEach((card) => {
        if (card.type?.id) {
          typeCount[card.type.id] = (typeCount[card.type.id] || 0) + 1;
          typeNames[card.type.id] = getLocalized(card.type, language);
        }
      });

      if (Object.keys(typeCount).length > 1) {
        const filterContainer = document.createElement("div");
        filterContainer.className = "filter-container";

        const btnAll = document.createElement("button");
        btnAll.className = "filter-button active";
        btnAll.dataset.filter = "all";
        btnAll.textContent = language === "pt-BR" ? "Todos" : "All";
        btnAll.onclick = () => filterFormationsByType("all");
        filterContainer.appendChild(btnAll);

        Object.entries(typeCount)
          .sort(([idA], [idB]) => typeNames[idA].localeCompare(typeNames[idB]))
          .forEach(([id, count]) => {
            const btn = document.createElement("button");
            btn.className = "filter-button";
            btn.dataset.filter = id;
            btn.textContent = `${typeNames[id]} (${count})`;
            btn.onclick = () => filterFormationsByType(id);
            filterContainer.appendChild(btn);
          });

        container.parentNode.insertBefore(filterContainer, container);
      }

      // sort formation entries the same way as projects: recent starts first
      // then recent ends.
      const sortedCards = [...cards].sort((a, b) => {
        const initA = parseDate(a.dateInit);
        const initB = parseDate(b.dateInit);
        if (initA !== initB) {
          return initB - initA;
        }
        const endA = parseDate(a.dateEnd);
        const endB = parseDate(b.dateEnd);
        return endB - endA;
      });

      const fragment = document.createDocumentFragment();
      sortedCards.forEach((card) => {
        const div = document.createElement("div");
        div.className = "card card-formation";
        if (card.type?.id) div.dataset.type = card.type.id;

        let html = "";
        if (card.title)
          html += `<h3>${getLocalized(card.title, language)}</h3>`;
        if (card.institution)
          html += `<p class="institution">${getLocalized(card.institution, language)}</p>`;
        if (card.type)
          html += `<p class="formation-type">${getLocalized(card.type, language)}</p>`;
        if (card.description)
          html += `<p class="description">${getLocalized(card.description, language)}</p>`;

        if (card.iconTechnologies && Array.isArray(card.iconTechnologies)) {
          const techTitle =
            language === "pt-BR" ? "Tecnologias" : "Technologies";
          html += `<h4 class="title-technologies">${techTitle}</h4>`;

          let techsDiv = `<div class="technologies">`;
          const sortedTechs = [...card.iconTechnologies].sort((a, b) =>
            (a.name || "").localeCompare(b.name || ""),
          );
          sortedTechs.forEach((tech) => {
            if (!tech.style || !tech.icon) return;
            const iconClass = faClass(tech.style, tech.icon);
            techsDiv += `<i class="${iconClass} icon" title="${tech.name || ""}"></i>`;
          });
          html += techsDiv + `</div>`;
        }

        if (card.certificates && Array.isArray(card.certificates)) {
          html += `<details class="certificates"><summary>${language === "pt-BR" ? "Certificados" : "Certificates"}</summary><ul>`;
          card.certificates.forEach((cert) => {
            html += `<li>`;
            if (cert.url)
              html += `<a href="${cert.url}" target="_blank" rel="noopener noreferrer" class="certificate-link external">`;
            html += `${getLocalized(cert.name, language)}`;
            if (cert.url) html += `</a>`;
            html += `</li>`;
          });
          html += `</ul></details>`;
        }

        if (card.dateInit) {
          html += `<div class="period">${card.dateInit}`;
          if (card.dateEnd) {
            html += ` - ${card.dateEnd}`;
          }
          html += "</div>";
        }

        div.innerHTML = html;
        fragment.appendChild(div);
      });

      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) => console.error(`Erro ao carregar ${containerId}:`, err));
}

function setupTechnologies(container, cards, language = "pt-BR") {
  if (!container || !Array.isArray(cards)) return;
  const stackMap = {};

  cards.forEach((card) => {
    if (card.iconTechnologies && Array.isArray(card.iconTechnologies)) {
      card.iconTechnologies.forEach((tech) => {
        if (!tech.stack) return;
        const stackId = tech.stack.id;
        if (!stackMap[stackId])
          stackMap[stackId] = { stack: tech.stack, technologies: [] };
        const exists = stackMap[stackId].technologies.some(
          (t) => t.name === tech.name,
        );
        if (!exists) stackMap[stackId].technologies.push(tech);
      });
    }
  });

  const fragment = document.createDocumentFragment();
  const sortedStacks = Object.values(stackMap).sort((a, b) => {
    const titleA = getLocalized(a.stack, language) || a.stack.id;
    const titleB = getLocalized(b.stack, language) || b.stack.id;
    return titleA.localeCompare(titleB);
  });

  sortedStacks.forEach((stackGroup) => {
    const stackDiv = document.createElement("div");
    stackDiv.className = "tech-stack-group";
    const stackTitle =
      getLocalized(stackGroup.stack, language) || stackGroup.stack.id;
    const h3 = document.createElement("h3");
    h3.textContent = stackTitle;
    stackDiv.appendChild(h3);

    const iconsContainer = document.createElement("div");
    iconsContainer.className = "block";

    const sortedTechs = [...stackGroup.technologies].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
    const renderedTechs = new Set();

    sortedTechs.forEach((tech) => {
      if (renderedTechs.has(tech.name)) return;
      if (!tech.style || !tech.icon) return;
      renderedTechs.add(tech.name);
      const div = document.createElement("div");
      div.className = "card tech-cards";
      const classes = faClass(tech.style, tech.icon);
      div.innerHTML = `<i class="${classes} icon" title="${tech.name || ""}"></i>`;
      const p = document.createElement("p");
      p.textContent = tech.name || "";
      div.appendChild(p);
      iconsContainer.appendChild(div);
    });

    stackDiv.appendChild(iconsContainer);
    fragment.appendChild(stackDiv);
  });

  container.appendChild(fragment);
}

function loadAllTechnologies(language = "pt-BR", loadId) {
  const githubOwner = document.body.dataset.githubOwner || "JLBBARCO";
  const container = document.getElementById("technologiesContainer");
  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return Promise.all([
    // when the projects source was switched we still want the cards shape
    loadProjectsData("github", githubOwner),
    fetchJsonWithFallback("src/json/areas/formation.json"),
  ])
    .then(([projectsData, formationsData]) => {
      const container = document.getElementById("technologiesContainer");
      if (!container) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      const allCards = [];
      if (projectsData.cards) allCards.push(...projectsData.cards);
      if (formationsData.cards) allCards.push(...formationsData.cards);
      setupTechnologies(container, allCards, language);
    })
    .catch((err) => console.error("Erro ao carregar tecnologias:", err));
}

function filterProjectsByTechnology(tech) {
  document.querySelectorAll(".card.card-projects").forEach((card) => {
    const techs =
      card.dataset.technologies?.split(",")?.map((t) => t.trim()) || [];
    card.style.display =
      tech === "all" || techs.includes(tech) ? "flex" : "none";
  });
  updateFilterButtons(tech);
}

function filterFormationsByType(type) {
  document.querySelectorAll(".card.card-formation").forEach((card) => {
    card.style.display =
      type === "all" || card.dataset.type === type ? "block" : "none";
  });
  updateFilterButtons(type);
}

function updateFilterButtons(activeFilter) {
  document.querySelectorAll(".filter-button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === activeFilter);
  });
}

function addNewIcons(linkFile) {
  // make sure we build an absolute URL so the fetch works regardless of the
  // base path the site is served from (GitHub Pages, subfolder, etc).
  const url = linkFile.match(/^https?:\/\//)
    ? linkFile
    : new URL(linkFile, document.baseURI).href;

  fetch(url)
    .then((res) =>
      res.ok
        ? res.json()
        : Promise.reject(new Error(`Fetch failed with status: ${res.status}`)),
    )
    .then((data) => {
      if (!data.icons) return;
      data.icons.forEach((icon) => {
        if (!icon.class || !icon.svg) return;
        const svg = icon.svg
          .replace(/fill=['"]#[^'"]*['"]/g, "")
          .replace(/stroke=['"]#[^'"]*['"]/g, "");
        document.querySelectorAll(`i.${icon.class}`).forEach((el) => {
          el.innerHTML = svg;
          const s = el.querySelector("svg");
          if (s) {
            s.classList.add("svg-icon");
            s.removeAttribute("width");
            s.removeAttribute("height");
            if (!s.getAttribute("viewBox"))
              s.setAttribute("viewBox", "0 0 24 24");
            s.querySelectorAll(
              "path, circle, rect, line, polygon, ellipse",
            ).forEach((shape) => {
              if (shape.getAttribute("fill") !== "none")
                shape.setAttribute("fill", "currentColor");
              if (shape.getAttribute("stroke"))
                shape.setAttribute("stroke", "currentColor");
            });
          }
        });
      });
    })
    .catch((err) => console.error("Erro ao carregar SVGs:", err));
}

function prevProjects() {
  // dynamically compute scroll distance based on the width of a card
  // (plus a little margin) so the carousel stays snappy on different layouts.
  document
    .getElementById("projectsContainer")
    ?.scrollBy({ left: -300, behavior: "smooth" });
}

function nextProjects() {
  const container = document.getElementById("projectsContainer");
  if (!container) return;
  const card = container.querySelector(".card");
  const delta = card ? card.getBoundingClientRect().width + 16 : 300;
  container.scrollBy({ left: delta, behavior: "smooth" });
}

function getAverageColor(imgElement) {
  if (!imgElement) {
    console.warn("Elemento de imagem não fornecido");
    return { r: 124, g: 77, b: 255 };
  }

  if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
    console.warn("Imagem não carregada corretamente");
    return { r: 124, g: 77, b: 255 };
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    console.warn("Contexto canvas não disponível");
    return { r: 124, g: 77, b: 255 };
  }

  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;

  try {
    context.drawImage(imgElement, 0, 0);
  } catch (e) {
    console.warn("Erro ao desenhar imagem no canvas:", e);
    return { r: 124, g: 77, b: 255 };
  }

  try {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let r = 0,
      g = 0,
      b = 0;
    const totalPixels = data.length / 4;

    if (totalPixels === 0) {
      console.warn("Imagem vazia ou inválida");
      return { r: 124, g: 77, b: 255 };
    }

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    return {
      r: Math.round(r / totalPixels),
      g: Math.round(g / totalPixels),
      b: Math.round(b / totalPixels),
    };
  } catch (e) {
    console.warn("Erro ao processar dados da imagem:", e);
    return { r: 124, g: 77, b: 255 };
  }
}

function setCSSVariables(color) {
  const root = document.documentElement;
  root.style.setProperty("--accent", `rgb(${color.r}, ${color.g}, ${color.b})`);
  root.style.setProperty(
    "--accent-transparent",
    `rgba(${color.r}, ${color.g}, ${color.b}, 0.67)`,
  );
  const hoverR = Math.max(0, color.r - 30),
    hoverG = Math.max(0, color.g - 30),
    hoverB = Math.max(0, color.b - 30);
  root.style.setProperty(
    "--hover-accent",
    `rgb(${hoverR}, ${hoverG}, ${hoverB})`,
  );
}

function initializeProfileImage() {
  const img = document.getElementById("profile");
  if (!img) return;

  function applyAverageColor() {
    const avgColor = getAverageColor(img);
    setCSSVariables(avgColor);
  }

  if (img.complete && img.naturalHeight !== 0) {
    applyAverageColor();
  } else {
    img.addEventListener("load", applyAverageColor);
    img.addEventListener("error", () => {
      console.warn("Erro ao carregar a imagem do perfil");
      setCSSVariables({ r: 124, g: 77, b: 255 });
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeProfileImage);
} else {
  initializeProfileImage();
}
