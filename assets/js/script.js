const windowWidth = 990;

// Helper para normalizar classes do Font Awesome
function faClass(style, icon, size) {
  let styleClass = style || "solid";
  if (styleClass && !styleClass.startsWith("fa-")) {
    styleClass = `fa-${styleClass}`;
  }
  let iconClass = icon || "";
  if (iconClass && !iconClass.startsWith("fa-")) {
    iconClass = `fa-${iconClass}`;
  }
  let sizeClass = size || "";
  if (sizeClass && !sizeClass.startsWith("fa-")) {
    sizeClass = `fa-${sizeClass}`;
  }
  return [styleClass, iconClass, sizeClass].filter(Boolean).join(" ");
}

// Variável global para controle de tamanho de fonte
let fontSize = 1;

document.addEventListener("DOMContentLoaded", () => {
  // Verifica se o usuário prefere modo escuro e escuta mudanças
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
    // Adiciona cache-buster para forçar atualização do favicon
    faviconLink.href = newHref + "?v=" + Date.now();
  }

  // Define favicon inicial
  updateFavicon(prefersDark.matches);

  // Ouve mudanças de preferência de cor
  if (typeof prefersDark.addEventListener === "function") {
    prefersDark.addEventListener("change", updateFavicon);
  } else if (typeof prefersDark.addListener === "function") {
    prefersDark.addListener(updateFavicon);
  }

  // Recupera o tamanho da fonte do cookie
  const savedFontSize = document.cookie
    .split("; ")
    .find((row) => row.startsWith("fontSize="))
    ?.split("=")[1];
  if (savedFontSize) {
    document.body.style.fontSize = savedFontSize;
    const parsed = parseFloat(savedFontSize);
    if (!isNaN(parsed)) {
      fontSize = parsed;
    }
  }

  // Estado inicial do menu
  resize();
  window.addEventListener("resize", resize);

  // Evento de clique no botão do menu
  const menuButton = document.getElementById("menu-button");
  if (menuButton) {
    const menuIcon = document.getElementById("menuIcon");
    if (menuIcon) {
      menuIcon.classList.remove("fa-xmark", "fa-close", "fa-menu");
      if (!menuIcon.classList.contains("fa-bars")) {
        menuIcon.classList.add("fa-bars");
      }
    }
    menuButton.addEventListener("click", toggleMenu);
  }

  // Eventos de acessibilidade
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

  // Fecha o menu de acessibilidade ao clicar fora
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

  // Função para carregar todo o conteúdo dinâmico
  function loadDynamicContent() {
    const containers = [
      "projectsContainer",
      "technologiesContainer",
      "programsContainer",
      "techsThisSite",
      "contactContainer",
      "formationsContainer",
    ];

    containers.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });

    // Limpa elementos auxiliares (filtros e botões de navegação)
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

    const pProjects = jsonCardsFetch(
      "assets/json/cards/projects.json",
      "projectsContainer",
      "2x",
      locale,
    );
    const pSkills = jsonCardsFetch(
      "assets/json/cards/programmingLanguages.json",
      "technologiesContainer",
      "3x",
      locale,
    );
    const pPrograms = jsonCardsFetch(
      "assets/json/cards/programs.json",
      "programsContainer",
      "3x",
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
    const pFormations = jsonCardsFetch(
      "assets/json/cards/formation.json",
      "formationsContainer",
      "3x",
      locale,
    );

    Promise.all([pProjects, pSkills, pPrograms, pIcons, pLinks, pFormations])
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
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
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

  const isVisible = navLinks.style.display === "grid";
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
  menu.setAttribute("aria-hidden", isVisible);
  if (btn) {
    btn.setAttribute("aria-expanded", !isVisible);
    if (isVisible) btn.focus();
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
  return fetch(fileURL)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container || !data.icons) return;
      data.icons.forEach((icon) => {
        const div = document.createElement("div");
        div.className = "icon-container";
        const classes = faClass(icon.style, icon.class || icon.name, iconSize);
        div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
        container.appendChild(div);
      });
    })
    .catch((err) => console.error("Erro ao carregar ícones:", err));
}

function jsonLinksFetch(fileURL, containerId, iconSize = "2x") {
  return fetch(fileURL)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(data.cards)) return;
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
        container.appendChild(a);
      });
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

function jsonCardsFetch(
  fileURL,
  containerId,
  iconSize = "3x",
  language = "pt-BR",
) {
  return fetch(fileURL)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container || !Array.isArray(data.cards)) return;

      if (containerId === "projectsContainer") {
        setupProjects(container, data.cards, iconSize, language);
      } else if (containerId === "formationsContainer") {
        setupFormations(container, data.cards, language);
      } else if (
        containerId === "technologiesContainer" ||
        containerId === "programsContainer"
      ) {
        setupSkills(container, data.cards || data.cardsIcons, iconSize);
      }
    })
    .catch((err) => console.error(`Erro ao carregar ${containerId}:`, err));
}

function setupProjects(container, cards, iconSize, language) {
  const techCount = {};
  cards.forEach((card) => {
    if (card.iconTechnologies) {
      card.iconTechnologies.forEach((tech) => {
        if (tech.name) techCount[tech.name] = (techCount[tech.name] || 0) + 1;
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

    Object.entries(techCount).forEach(([name, count]) => {
      const btn = document.createElement("button");
      btn.className = "filter-button";
      btn.dataset.filter = name;
      btn.textContent = `${name} (${count})`;
      btn.onclick = () => filterProjectsByTechnology(name);
      filterContainer.appendChild(btn);
    });
    container.parentNode.insertBefore(filterContainer, container);
  }

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
    if (card.title) html += `<h3>${getLocalized(card.title, language)}</h3>`;
    if (card.institution)
      html += `<p class="institution">${getLocalized(card.institution, language)}</p>`;
    if (card.description)
      html += `<p>${getLocalized(card.description, language)}</p>`;

    if (card.iconTechnologies) {
      if (card.titleTechnologies)
        html += `<h4>${getLocalized(card.titleTechnologies, language)}</h4>`;
      html += `<div class="technologies-portfolio">`;
      card.iconTechnologies.forEach((tech) => {
        html += `<i class="${faClass(tech.style, tech.icon, iconSize)} icon" title="${tech.name || ""}"></i>`;
      });
      html += `</div>`;
    }

    html += `<h4>${getLocalized(card.titleLinks, language) || "Links"}</h4><div class="links-portfolio">`;
    if (card.linkRepository)
      html += `<a href="${card.linkRepository}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github fa-${iconSize} icon"></i></a>`;
    if (card.linkSite)
      html += `<a href="${card.linkSite}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-share-from-square fa-${iconSize} icon"></i></a>`;
    html += `</div>`;

    div.innerHTML = html;
    container.appendChild(div);
  });
}

function setupFormations(container, cards, language) {
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

    Object.entries(typeCount).forEach(([id, count]) => {
      const btn = document.createElement("button");
      btn.className = "filter-button";
      btn.dataset.filter = id;
      btn.textContent = `${typeNames[id]} (${count})`;
      btn.onclick = () => filterFormationsByType(id);
      filterContainer.appendChild(btn);
    });
    container.parentNode.insertBefore(filterContainer, container);
  }

  cards.forEach((card) => {
    const div = document.createElement("div");
    div.className = "card card-formation";
    if (card.type?.id) div.dataset.type = card.type.id;

    div.innerHTML = `
      <h3>${getLocalized(card.title, language)}</h3>
      <p class="institution">${getLocalized(card.institution, language)}</p>
      <p class="formation-type">${card.type ? getLocalized(card.type, language) : ""}</p>
      <p class="description">${getLocalized(card.description, language)}</p>
      <p class="period">${getLocalized(card.dateText, language)}</p>
    `;
    container.appendChild(div);
  });
}

function setupSkills(container, cards, iconSize) {
  if (!cards) return;
  cards.forEach((card) => {
    if (card.icon) {
      const div = document.createElement("div");
      div.className = "card tech-cards";
      div.innerHTML = `
        <i class="${faClass(card.style, card.icon, iconSize)} icon" title="${card.name}"></i>
        <p>${card.name}</p>
      `;
      container.appendChild(div);
    }
  });
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
    if (!commits.length) return;
    const date = new Date(commits[0].commit.author.date);
    const formatted = date.toLocaleDateString(
      document.documentElement.lang || "pt-BR",
      { year: "numeric", month: "long", day: "numeric" },
    );

    const updateText = (node) => {
      if (node.nodeValue?.includes("{{date}}"))
        node.nodeValue = node.nodeValue.replace(/\{\{date\}\}/g, formatted);
    };
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
    );
    while (walker.nextNode()) updateText(walker.currentNode);

    const el = document.getElementById(elementId);
    if (el) el.textContent = `Última atualização: ${formatted}`;
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
