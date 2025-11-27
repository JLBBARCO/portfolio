const windowWidth = 990;

document.addEventListener("DOMContentLoaded", () => {
  // Recupera o tamanho da fonte do cookie, se existir
  const fontSize = document.cookie
    .split("; ")
    .find((row) => row.startsWith("fontSize="))
    ?.split("=")[1];
  if (fontSize) {
    document.body.style.fontSize = fontSize;
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

  Promise.all([pProjects, pSkills, pPrograms, pIcons, pLinks])
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
  if (window.innerWidth > windowWidth) {
    navLinks.style.display = "flex";
  } else {
    navLinks.style.display = "none";
  }
}

function toggleMenu() {
  const navLinks = document.querySelector(".nav-links");
  const menuIcon = document.getElementById("menuIcon");

  if (navLinks.style.display === "grid") {
    navLinks.style.display = "none";
    if (menuIcon) {
      // trocar ícone para menu (fa-bars)
      menuIcon.classList.remove("fa-xmark", "fa-close");
      menuIcon.classList.add("fa-bars");
    }
  } else {
    navLinks.style.display = "grid";
    if (menuIcon) {
      // trocar ícone para fechar (fa-xmark)
      menuIcon.classList.remove("fa-bars");
      menuIcon.classList.add("fa-xmark");
    }
  }
}

function accessibilityToggle() {
  const accessibilityMenu = document.getElementById("accessibility-menu");
  if (accessibilityMenu) {
    if (accessibilityMenu.style.display === "flex") {
      accessibilityMenu.style.display = "none";
    } else {
      accessibilityMenu.style.display = "flex";
    }
  }
}

let fontSize = 1;
function increaseFont() {
  fontSize += 0.1;
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function decreaseFont() {
  fontSize -= 0.1;
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
        const style = icon.style || "brands";
        const cls = icon.class || icon.name || "";
        iconElement.innerHTML = `<i class="fa-${style} fa-${cls} fa-${iconSize} icon" title="${
          icon.name || cls
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
          .map(
            (tech) =>
              `<i class="fa-${tech.style || "brands"} fa-${
                tech.icon
              } fa-${iconSize} icon" title="${tech.name}"></i>`
          )
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
        techCard.innerHTML = `
          <i class="fa-${card.style || "brands"} fa-${
          card.icon
        } fa-${iconSize} icon" title="${card.name}"></i>
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
        linkCard.innerHTML = `<i class="fa-${card.style || "solid"} fa-${
          card.icon
        } fa-${iconSize} icon"></i><a href="${card.link}" ${targetLink}>${
          card.name
        }</a>`;
        container.appendChild(linkCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load links:", error);
    });
}
