const windowWidth = 990;

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

function fetchJsonWithFallback(path) {
  const basename = path.split("/").pop();
  return fetchAny(path, basename).then((res) =>
    res.ok
      ? res.json()
      : Promise.reject(new Error(`Fetch failed with status: ${res.status}`)),
  );
}

// Função para trocar o idioma
function changeLanguage() {
  const savedLang = document.cookie
    .split("; ")
    .find((row) => row.startsWith("language="))
    ?.split("=")[1];
  const newLang = savedLang === "pt" ? "en" : "pt";
  document.cookie = `language=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = newLang === "pt" ? "pt-BR" : "en-US";
  window.dispatchEvent(new Event("languageChanged"));
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

  const savedFontSize = document.cookie
    .split("; ")
    .find((row) => row.startsWith("fontSize="))
    ?.split("=")[1];
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

    const savedLang = document.cookie
      .split("; ")
      .find((row) => row.startsWith("language="))
      ?.split("=")[1];
    const currentLang =
      savedLang || (navigator.language.startsWith("pt") ? "pt" : "en");
    const locale = currentLang === "pt" ? "pt-BR" : "en-US";

    const pProjects = setupProjects(
      "src/json/areas/projects.json",
      "projectsContainer",
      locale,
    );
    const pFormations = setupFormations(
      "src/json/areas/formation.json",
      "formationsContainer",
      locale,
    );
    const pIcons = setIconsTechsSite(
      "src/json/areas/techs-this-site.json",
      "techsThisSite",
    );
    const pLinks = setIconsContact(
      "src/json/areas/contact.json",
      "contactContainer",
    );

    const pTechnologies = loadAllTechnologies(locale);

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
  showLastUpdate("lastUpdate");
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
  document.cookie = `fontSize=${fontSize}em; path=/; max-age=31536000; SameSite=Lax`;
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

function setIconsTechsSite(fileURL, containerID) {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container || !data.icons) return;
      const fragment = document.createDocumentFragment();
      data.icons.forEach((icon) => {
        const div = document.createElement("div");
        div.className = "icon-container";
        const classes = faClass(icon.style, icon.class);
        div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
        fragment.appendChild(div);
      });
      container.appendChild(fragment);
    })
    .catch((err) =>
      console.error("Erro ao carregar ícones techs-this-site:", err),
    );
}

function setIconsContact(fileURL, containerId) {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(data.cards)) return;
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

function setupProjects(fileURL, containerId, language) {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !data.cards) return;
      const cards = data.cards;
      const techCount = {};
      const techFilter = {};

      cards.forEach((card) => {
        if (card.iconTechnologies) {
          card.iconTechnologies.forEach((tech) => {
            if (tech.name) {
              techCount[tech.name] = (techCount[tech.name] || 0) + 1;
              if (tech.filter === "no") {
                techFilter[tech.name] = true;
              }
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
          html += `<img src="${card.image}" alt="${getLocalized(card.descriptionImage, language)}" loading="lazy"></picture>`;
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

function setupFormations(fileURL, containerId, language) {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !data.cards) return;
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

function loadAllTechnologies(language = "pt-BR") {
  return Promise.all([
    fetchJsonWithFallback("src/json/areas/projects.json"),
    fetchJsonWithFallback("src/json/areas/formation.json"),
  ])
    .then(([projectsData, formationsData]) => {
      const container = document.getElementById("technologiesContainer");
      if (!container) return;
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
  fetch(linkFile)
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

async function showLastUpdate(elementId) {
  const owner = document.body.dataset.githubOwner || "JLBBARCO";
  const repo = document.body.dataset.githubRepo || "portfolio";

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      console.warn(`GitHub API retornou status ${res.status}`);
      return;
    }

    const commits = await res.json();

    if (!Array.isArray(commits) || commits.length === 0) {
      console.warn("Nenhum commit encontrado");
      return;
    }

    const commitDate = commits[0].commit?.author?.date;
    if (!commitDate) {
      console.warn("Data do commit não encontrada");
      return;
    }

    const date = new Date(commitDate);

    if (isNaN(date.getTime())) {
      console.warn("Data inválida:", commitDate);
      return;
    }

    window.__lastUpdateRawDate = date;

    const lang = document.documentElement.lang || "pt-BR";
    const formatted = date.toLocaleDateString(lang, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const el = document.getElementById(elementId);
    if (el) {
      const prefix =
        lang === "en-US" ? "Last Update: " : "Última atualização: ";
      el.textContent = `${prefix}${formatted}`;
    }

    if (window.setTranslationDate) {
      window.setTranslationDate(date);
    }

    window.dispatchEvent(new Event("lastUpdateReady"));
  } catch (err) {
    console.error("Erro ao buscar dados do GitHub:", err);
  }
}

function prevProjects() {
  let widthCard = document.querySelector;

  document
    .getElementById("projectsContainer")
    ?.scrollBy({ left: -300, behavior: "smooth" });
}

function nextProjects() {
  document
    .getElementById("projectsContainer")
    ?.scrollBy({ left: 300, behavior: "smooth" });
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
