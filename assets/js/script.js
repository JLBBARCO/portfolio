const windowWidth = 990;

// Helper para normalizar classes do Font Awesome
function faClass(style, icon, size) {
  let styleClass = style || "solid";
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

// fetch com fallback (reaproveitado)
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
    res.ok ? res.json() : Promise.reject(res.status),
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
      ? "assets/favicon/code-light.svg"
      : "assets/favicon/code-dark.svg";
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
      "frontEndContainer",
      "backEndContainer",
      "databasesContainer",
      "programsContainer",
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
      "assets/json/cards/projects.json",
      "projectsContainer",
      "2x",
      locale,
    );
    const pIcons = setIcons(
      "assets/json/icons/techs-this-site.json",
      "techsThisSite",
      "3x",
    );
    const pLinks = jsonLinksFetch(
      "assets/json/cards/contact.json",
      "contactContainer",
      "2x",
    );
    const pFormations = setupFormations(
      "assets/json/cards/formation.json",
      "formationsContainer",
      "2x",
      locale,
    );

    const pTechnologies = loadAllTechnologies(locale);

    Promise.all([pProjects, pIcons, pLinks, pFormations, pTechnologies])
      .then(() => {
        addNewIcons("assets/json/icons/svg.json", "3x");
        window.dispatchEvent(new Event("dynamicContentReady"));
      })
      .catch((err) => {
        console.warn("Erro no carregamento dinâmico:", err);
        window.dispatchEvent(new Event("dynamicContentReady"));
      });
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
  navLinks.style.display = isVisible ? "none" : "grid";

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
  document.cookie = `fontSize=${fontSize}em; path=/; max-age=31536000`;
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

function setIcons(fileURL, containerID, iconSize = "3x") {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container || !data.icons) return;
      const fragment = document.createDocumentFragment();
      data.icons.forEach((icon) => {
        const div = document.createElement("div");
        div.className = "icon-container";
        const classes = faClass(icon.style, icon.class || icon.name, iconSize);
        div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
        fragment.appendChild(div);
      });
      container.appendChild(fragment);
    })
    .catch((err) => console.error("Erro ao carregar ícones:", err));
}

function jsonLinksFetch(fileURL, containerId, iconSize = "2x") {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(data.cards)) return;
      const fragment = document.createDocumentFragment();
      data.cards.forEach((card) => {
        const a = document.createElement("a");
        a.href = card.link || card.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "link-item";
        const classes = faClass(card.style, card.icon, iconSize);
        a.innerHTML = `<i class="${classes} icon"></i>`;
        a.setAttribute("aria-label", card.name);
        a.title = card.name;
        fragment.appendChild(a);
      });
      container.appendChild(fragment);
    })
    .catch((err) => console.error("Erro ao carregar links:", err));
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

function setupProjects(fileURL, containerId, iconSize, language) {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !data.cards) return;
      const cards = data.cards;
      const techCount = {};
      const techId = {};
      const techName = {};
      cards.forEach((card) => {
        if (card.iconTechnologies) {
          card.iconTechnologies.forEach((tech) => {
            if (tech.name) {
              techCount[tech.name] = (techCount[tech.name] || 0) + 1;
              if (tech.stack && tech.stack.id && !techId[tech.name]) {
                techId[tech.name] = tech.stack.id;
                techName[tech.name] = getLocalized(tech.stack, language);
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
          const btn = document.createElement("button");
          btn.className = "filter-button";
          btn.dataset.filter = name;
          btn.textContent = `${name} (${count})`;
          btn.onclick = () => filterProjectsByTechnology(name);
          filterContainer.appendChild(btn);
        });
        container.parentNode.insertBefore(filterContainer, container);
      }

      // remove prev/next duplicados antes de inserir (caso loadDynamicContent já tenha rodado)
      container.parentNode
        .querySelectorAll(".btn.prev, .btn.next")
        .forEach((el) => el.remove());

      const prevBtn = document.createElement("button");
      prevBtn.className = "btn prev";
      prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
      prevBtn.onclick = prevProjects;

      const nextBtn = document.createElement("button");
      nextBtn.className = "btn next";
      nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
      nextBtn.onclick = nextProjects;

      container.parentNode.insertBefore(prevBtn, container);
      container.parentNode.appendChild(nextBtn);

      const fragment = document.createDocumentFragment();
      cards.forEach((card) => {
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
          html += `<picture class="img-card">`;
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
          html += `<h4 id="technologiesTitle" class="title-technologies"></h4>`;
          html += `<div class="technologies-portfolio">`;
          const sortedTechs = [...card.iconTechnologies].sort((a, b) =>
            (a.name || "").localeCompare(b.name || ""),
          );
          sortedTechs.forEach((tech) => {
            html += `<i class="${faClass(tech.style, tech.icon, iconSize)} icon" title="${tech.name || ""}"></i>`;
          });
          html += `</div>`;
        }

        if (card.linkRepository || card.linkDemo) {
          html += `<h4 id="linksTitle" class="title-links"></h4><div class="links-portfolio">`;
          if (card.linkRepository)
            html += `<a href="${card.linkRepository}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github fa-${iconSize} icon"></i></a>`;
          if (card.linkDemo)
            html += `<a href="${card.linkDemo}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-share-from-square fa-${iconSize} icon"></i></a>`;
          html += `</div>`;
        }

        div.innerHTML = html;
        fragment.appendChild(div);
      });
      container.appendChild(fragment);
    })
    .catch((err) => console.error(`Erro ao carregar ${containerId}:`, err));
}

function setupFormations(fileURL, containerId, iconSize = "3x", language) {
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !data.cards) return;
      const cards = data.cards;
      if (typeof iconSize === "string" && !language) {
        language = iconSize;
        iconSize = "3x";
      }

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

      const fragment = document.createDocumentFragment();
      cards.forEach((card) => {
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
        if (card.iconTechnologies) {
          html += `<h4 id="technologiesTitle" class="title-technologies"></h4>`;
          let techsDiv = `<div class="technologies-portfolio">`;
          const sortedTechs = [...card.iconTechnologies].sort((a, b) =>
            (a.name || "").localeCompare(b.name || ""),
          );
          sortedTechs.forEach((tech) => {
            techsDiv += `<i class="${faClass(tech.style, tech.icon, iconSize)} icon" title="${tech.name || ""}"></i>`;
          });
          html += techsDiv + `</div>`;
        }
        if (card.certificates && Array.isArray(card.certificates)) {
          html += `<details class="certificates"><summary>${language === "pt-BR" ? "Certificados" : "Certificates"}</summary><ul>`;
          card.certificates.forEach((cert) => {
            html += `<li>`;
            if (cert.url)
              html += `<a href="${cert.url}" target="_blank" rel="noopener noreferrer" class="certificate-link">`;
            html += `${getLocalized(cert.name, language)}`;
            if (cert.url) html += `</a>`;
            html += `</li>`;
          });
          html += `</ul></details>`;
        }
        if (card.dateText)
          html += `<p class="period">${getLocalized(card.dateText, language)}</p>`;

        div.innerHTML = html;
        fragment.appendChild(div);
      });
      container.appendChild(fragment);
    })
    .catch((err) => console.error(`Erro ao carregar ${containerId}:`, err));
}

function setupTechnologies(container, cards, iconSize, language = "pt-BR") {
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
    iconsContainer.className = "technologies-portfolio";

    const sortedTechs = [...stackGroup.technologies].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
    const renderedTechs = new Set();
    sortedTechs.forEach((tech) => {
      if (renderedTechs.has(tech.name)) return;
      renderedTechs.add(tech.name);
      const div = document.createElement("div");
      div.className = "card tech-cards";
      const classes = faClass(tech.style, tech.icon, iconSize);
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
    fetchJsonWithFallback("assets/json/cards/projects.json"),
    fetchJsonWithFallback("assets/json/cards/formation.json"),
  ])
    .then(([projectsData, formationsData]) => {
      const container = document.getElementById("technologiesContainer");
      if (!container) return;
      const allCards = [];
      if (projectsData.cards) allCards.push(...projectsData.cards);
      if (formationsData.cards) allCards.push(...formationsData.cards);
      setupTechnologies(container, allCards, "3x", language);
    })
    .catch((err) => console.error("Erro ao carregar tecnologias:", err));
}

function filterProjectsByTechnology(tech) {
  document.querySelectorAll(".card.card-projects").forEach((card) => {
    const techs = card.dataset.technologies?.split(",") || [];
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

function addNewIcons(linkFile, size = "3x") {
  fetch(linkFile)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
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
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
    );
    if (!res.ok) return;
    const commits = await res.json();
    if (!Array.isArray(commits) || !commits.length) return;
    const date = new Date(commits[0].commit.author.date);
    window.__lastUpdateRawDate = date;

    const formatted = date.toLocaleDateString(
      document.documentElement.lang || "pt-BR",
      { year: "numeric", month: "long", day: "numeric" },
    );

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
    );
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes("{{date}}")) {
        walker.currentNode.nodeValue = walker.currentNode.nodeValue.replace(
          /\{\{date\}\}/g,
          formatted,
        );
      }
    }

    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = `${document.documentElement.lang === "en-US" ? "Last Update: " : "Última atualização: "}${formatted}`;
    }
    window.dispatchEvent(new Event("lastUpdateReady"));
  } catch (err) {
    console.error("Erro GitHub API:", err);
  }
}

function prevProjects() {
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
  if (
    !imgElement ||
    imgElement.naturalWidth === 0 ||
    imgElement.naturalHeight === 0
  ) {
    console.warn("Imagem não carregada corretamente");
    return { r: 124, g: 77, b: 255 };
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { r: 124, g: 77, b: 255 };
  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;
  try {
    context.drawImage(imgElement, 0, 0);
  } catch (e) {
    console.warn("Erro ao desenhar imagem no canvas:", e);
    return { r: 124, g: 77, b: 255 };
  }
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let r = 0,
    g = 0,
    b = 0;
  const totalPixels = data.length / 4;
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
  if (img.complete && img.naturalHeight !== 0) applyAverageColor();
  else {
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

const container = document.querySelector(".container-portfolio");
if (container) {
  container.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      const atStart = container.scrollLeft === 0;
      const atEnd =
        container.scrollLeft + container.clientWidth >= container.scrollWidth;
      if ((!atEnd && e.deltaY > 0) || (!atStart && e.deltaY < 0)) {
        const scrollSpeed = 2;
        container.scrollLeft += e.deltaY * scrollSpeed;
      } else {
        window.scrollBy({ top: e.deltaY, left: 0, behavior: "auto" });
      }
    },
    { passive: false },
  );
}
