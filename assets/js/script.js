const windowWidth = 990;

// Helper para normalizar classes do Font Awesome
function faClass(style, icon, size) {
  let styleClass = style || "brands";
  if (styleClass && !styleClass.startsWith("fa-")) {
    styleClass = `fa-${styleClass}`;
  }
  let iconClass = icon || "";
  if (iconClass && !iconClass.startsWith("fa-")) {
    iconClass = `fa-${iconClass}`;
  }
  let sizeClass = size || "";
  if (sizeClass && !sizeClass.startsWith("fa-")) {
    if (/^[0-9]+x$/.test(sizeClass)) {
      sizeClass = `fa-${sizeClass}`;
    } else if (sizeClass) {
      sizeClass = `fa-${sizeClass}`;
    }
  }
  return [styleClass, iconClass, sizeClass].filter(Boolean).join(" ");
}

document.addEventListener("DOMContentLoaded", () => {
  // Verifica se o usuário prefere modo escuro
  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const faviconLink = document.getElementById("favicon");

  if (faviconLink) {
    faviconLink.href = isDarkMode
      ? "assets/favicon/code-light.svg"
      : "assets/favicon/code-dark.svg";
  }

  // Recupera o tamanho da fonte do cookie, se existir
  const savedFontSize = document.cookie
    .split("; ")
    .find((row) => row.startsWith("fontSize="))
    ?.split("=")[1];
  if (savedFontSize) {
    document.body.style.fontSize = savedFontSize;
    const parsed = parseFloat(savedFontSize);
    if (!isNaN(parsed)) {
      fontSize = parsed; // atualiza a variável global para que increase/decrease usem o valor correto
    }
  }

  // Garante que o menu esteja no estado correto ao carregar
  resize();
  window.addEventListener("resize", resize);

  // Adiciona o evento de clique ao botão do menu
  const menuButton = document.getElementById("menu-button");
  if (menuButton) {
    const menuIcon = document.getElementById("menuIcon");
    if (menuIcon) {
      // Garante que o ícone inicial seja o menu (fa-bars)
      menuIcon.classList.remove("fa-xmark", "fa-close", "fa-menu");
      if (!menuIcon.classList.contains("fa-bars")) {
        menuIcon.classList.add("fa-bars");
      }
    }
    menuButton.addEventListener("click", toggleMenu);
  }

  // Adiciona eventos de acessibilidade
  const accessibilityButton = document.getElementById("accessibility-button");
  const increaseFontButton = document.getElementById("increase-font");
  const decreaseFontButton = document.getElementById("decrease-font");
  const resetFontButton = document.getElementById("reset-font");

  if (accessibilityButton) {
    accessibilityButton.addEventListener("click", accessibilityToggle);
  }
  if (increaseFontButton) {
    increaseFontButton.addEventListener("click", increaseFont);
  }
  if (decreaseFontButton) {
    decreaseFontButton.addEventListener("click", decreaseFont);
  }
  if (resetFontButton) {
    resetFontButton.addEventListener("click", resetFont);
  }

  // Fecha o menu de acessibilidade ao clicar fora dele
  document.addEventListener("click", (event) => {
    const accessibilityMenu = document.getElementById("accessibility-menu");
    const isClickInsideMenu = accessibilityMenu?.contains(event.target);
    const isClickOnButton = accessibilityButton?.contains(event.target);

    if (accessibilityMenu && !isClickInsideMenu && !isClickOnButton) {
      accessibilityMenu.style.display = "none";
    }
  });

  // start dynamic loads and wait for all to complete before firing translation
  const pProjects = jsonCardProjectsFetch(
    "assets/json/cards/projects/projects.json",
    "projectsContainer",
    "3x"
  );
  const pSkills = jsonCardSkillsFetch(
    "assets/json/cards/skills/programmingLanguages.json",
    "technologiesContainer",
    "3x"
  );
  const pPrograms = jsonCardSkillsFetch(
    "assets/json/cards/skills/programs.json",
    "programsContainer",
    "3x"
  );
  const pIcons = setIcons(
    "assets/json/icons/techs_this_site/techs_this_site.json",
    "techsThisSite",
    "3x"
  );
  const pLinks = jsonLinksFetch(
    "assets/json/cards/links/contact.json",
    "contactContainer",
    "2x"
  );
  const pFormations = jsonCardFormationFetch(
    "assets/json/cards/skills/formation.json",
    "formationsContainer",
    "3x"
  );

  Promise.all([pProjects, pSkills, pPrograms, pIcons, pLinks, pFormations])
    .then(() => {
      // notify that dynamic content is ready for translation
      window.dispatchEvent(new Event("dynamicContentReady"));
    })
    .catch((err) => {
      console.warn("One or more dynamic loads failed:", err);
      window.dispatchEvent(new Event("dynamicContentReady"));
    });
});

function calcularIdade() {
  const nascimento = new Date("2008-09-24"); // exemplo
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
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

  if (navLinks.style.display === "grid") {
    navLinks.style.display = "none";
    if (menuIcon) {
      // trocar ícone para menu (fa-bars)
      menuIcon.classList.remove("fa-xmark", "fa-close");
      menuIcon.classList.add("fa-bars");
    }
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
  } else {
    navLinks.style.display = "grid";
    if (menuIcon) {
      // trocar ícone para fechar (fa-xmark)
      menuIcon.classList.remove("fa-bars");
      menuIcon.classList.add("fa-xmark");
    }
    if (menuButton) menuButton.setAttribute("aria-expanded", "true");
  }
}

function accessibilityToggle() {
  const accessibilityMenu = document.getElementById("accessibility-menu");
  const accessibilityButton = document.getElementById("accessibility-button");
  if (!accessibilityMenu) return;

  if (accessibilityMenu.style.display === "flex") {
    accessibilityMenu.style.display = "none";
    if (accessibilityButton)
      accessibilityButton.setAttribute("aria-expanded", "false");
  } else {
    accessibilityMenu.style.display = "flex";
    if (accessibilityButton)
      accessibilityButton.setAttribute("aria-expanded", "true");
  }
}

let fontSize = 1;
function increaseFont() {
  // limita tamanho entre 0.6em e 3.0em para evitar valores extremos
  fontSize = Math.min(3.0, Math.round((fontSize + 0.1) * 10) / 10);
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function decreaseFont() {
  // limita tamanho entre 0.6em e 3.0em
  fontSize = Math.max(0.6, Math.round((fontSize - 0.1) * 10) / 10);
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function resetFont() {
  fontSize = 1;
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function setIcons(fileURL, containerID, iconSize = "3x") {
  return fetch(fileURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching icons: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container) return;
      data.icons.forEach((icon) => {
        const iconElement = document.createElement("div");
        iconElement.className = "icon-container";
        const classes = faClass(
          icon.style,
          icon.class || icon.name,
          icon.size || iconSize
        );
        iconElement.innerHTML = `<i class="${classes} icon" title="${
          icon.name || icon.class || ""
        }"></i>`;
        container.appendChild(iconElement);
      });
    })
    .catch((error) => {
      console.error("Failed to load icons:", error);
    });
}

function jsonCardProjectsFetch(fileURL, containerId, iconSize = "3x") {
  return fetch(fileURL)
    .then((responsive) => {
      if (!responsive.ok) {
        throw new Error(`Error fetching projects: ${responsive.status}`);
      }
      return responsive.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      data.cards.forEach((card) => {
        const projectCard = document.createElement("div");
        projectCard.className = "card card-projects";

        // Obter tecnologias do projeto (project1, project2, project3)
        const projectKey = card.projectTitle;
        const projectTechs = data[projectKey] || [];
        const techsHTML = projectTechs
          .map((tech) => {
            const classes = faClass(tech.style, tech.icon, iconSize);
            return `<i class="${classes} icon" title="${tech.name}"></i>`;
          })
          .join(" ");

        projectCard.innerHTML = `
          <article class="article-card">
            <picture class="img-card">
              <source
                media="(max-width: 990px)"
                srcset="${card.imageMobile}"
                type="${card.imageType}"
              />
              <img
                src="${card.image}"
                alt="${card.descriptionImage}"
              />
            </picture>
          </article>
          <article class="article-card">
            <h3 id="${card.titleID}"></h3>
            <p id="${card.descriptionID}"></p>
            <h4 id="${card.titleTechnologiesID}"></h4>
            <div class="technologies-portfolio">${techsHTML}</div>
          </article>
          <article class="article-card">
            <div class="button button-link">
              <a
                href="${card.linkProjectRepositoryURL}"
                ${card.linkProjectRepositoryTarget || ""}
                id="${card.linkProjectRepositoryID}"
              ></a>
              ${
                card.linkProjectDemoURL
                  ? `<a
                href="${card.linkProjectDemoURL}"
                ${card.linkProjectDemoTarget || ""}
                id="${card.linkProjectDemoID}"
              ></a>`
                  : ""
              }
            </div>
          </article>
        `;
        container.appendChild(projectCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load projects:", error);
    });
}

function jsonCardSkillsFetch(url, containerId, iconSize = "3x") {
  return fetch(url)
    .then((responsive) => {
      if (!responsive.ok) {
        throw new Error(
          `Error fetching programming languages: ${responsive.status}`
        );
      }
      return responsive.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      data.cards.forEach((card) => {
        const techCard = document.createElement("div");
        techCard.className = "tech-cards card";
        const classes = faClass(card.style, card.icon, iconSize);
        techCard.innerHTML = `
          <i class="${classes} icon" title="${card.name}"></i>
          <p>${card.name}</p>
        `;
        container.appendChild(techCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load programming languages:", error);
    });
}

function jsonLinksFetch(fileUrl, containerID, iconSize = "2x") {
  return fetch(fileUrl)
    .then((responsive) => {
      if (!responsive.ok) {
        throw new Error(`Error fetching links: ${responsive.status}`);
      }
      return responsive.json();
    })
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container) return;
      data.cards.forEach((card) => {
        const linkCard = document.createElement("div");
        linkCard.className = "link-cards card";
        const targetLink = card.target || "";
        const classes = faClass(card.style || "solid", card.icon, iconSize);
        linkCard.innerHTML = `<i class="${classes} icon"></i><a href="${card.link}" ${targetLink}>${card.name}</a>`;
        container.appendChild(linkCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load links:", error);
    });
}

function jsonCardFormationFetch(fileURL, containerId, iconSize = "3x") {
  return fetch(fileURL)
    .then((responsive) => {
      if (!responsive.ok) {
        throw new Error(`Error fetching formations: ${responsive.status}`);
      }
      return responsive.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      data.cards.forEach((card) => {
        const formationCard = document.createElement("div");
        formationCard.className = "formation-cards card";
        const classes = faClass(card.style, card.icon, iconSize);
        const imageHTML = card.image
          ? `<picture class="img-card">
              <source
                media="(max-width: 990px)"
                srcset="${card.imageMobile}"
                type="${card.imageType}"
              />
              <img
                src="${card.image}"
                alt="${card.descriptionImage}"
              />
            </picture>`
          : "";
        formationCard.innerHTML = `
          ${imageHTML}
          <h3 id="${card.titleID}"></h3>
          <p id="${card.institutionID}"></p>
          <p id="${card.descriptionID}"></p>
          ${
            card.dateText
              ? `<p>${card.dateText}</p>`
              : `<p id="${card.dateID}"></p>`
          }
          <div class="button button-link">
            <a
              href="${card.linkFormationURL}"
              ${card.linkFormationTarget || ""}
              id="${card.linkFormationTitleID}"
            ></a>
          </div>
        `;
        container.appendChild(formationCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load formations:", error);
    });
}
