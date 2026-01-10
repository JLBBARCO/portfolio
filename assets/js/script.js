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
    if (/^[0-9]+x$/.test(sizeClass)) {
      sizeClass = `fa-${sizeClass}`;
    } else if (sizeClass) {
      sizeClass = `fa-${sizeClass}`;
    }
  }
  return [styleClass, iconClass, sizeClass].filter(Boolean).join(" ");
}

document.addEventListener("DOMContentLoaded", () => {
  // Verifica se o usuário prefere modo escuro e escuta mudanças
  const faviconLink = document.getElementById("favicon");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  function updateFavicon(eventOrBool) {
    const isDark =
      typeof eventOrBool === "boolean"
        ? eventOrBool
        : eventOrBool?.matches ?? prefersDark.matches;
    if (!faviconLink) return;
    const newHref = isDark
      ? "assets/favicon/code-light.svg"
      : "assets/favicon/code-dark.svg";
    // Adiciona cache-buster para forçar atualização do favicon
    faviconLink.href = newHref + "?v=" + Date.now();
  }

  // Define favicon inicial
  updateFavicon(prefersDark.matches);

  // Ouve mudanças de preferência de cor (compatível com addEventListener/addListener)
  if (typeof prefersDark.addEventListener === "function") {
    prefersDark.addEventListener("change", updateFavicon);
  } else if (typeof prefersDark.addListener === "function") {
    prefersDark.addListener(updateFavicon);
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
      accessibilityMenu.setAttribute("aria-hidden", "true");
      if (accessibilityButton)
        accessibilityButton.setAttribute("aria-expanded", "false");
    }
  });

  // Função para carregar todo o conteúdo dinâmico
  function loadDynamicContent() {
    // Limpa containers antes de recarregar (opcional, dependendo da implementação das funções de fetch)
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

    // Obtém o idioma atual
    const savedLang = document.cookie
      .split("; ")
      .find((row) => row.startsWith("language="))
      ?.split("=")[1];
    const currentLang =
      savedLang || (navigator.language.startsWith("pt") ? "pt" : "en");
    const locale = currentLang === "pt" ? "pt-BR" : "en-US";

    const pProjects = jsonCardProjectsFetch(
      "assets/json/cards/projects/projects.json",
      "projectsContainer",
      "2x",
      locale
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
      "assets/json/icons/techs-this-site.json",
      "techsThisSite",
      "3x"
    );
    const pLinks = jsonLinksFetch(
      "/assets/json/cards/links/contact.json",
      "contactContainer",
      "2x"
    );
    const pFormations = jsonCardFormationFetch(
      "assets/json/cards/skills/formation.json",
      "formationsContainer",
      "3x",
      locale
    );

    // Aguarda que os ícones padrão sejam carregados antes de aplicar SVGs personalizados
    Promise.all([pProjects, pSkills, pPrograms, pIcons, pLinks, pFormations])
      .then(() => {
        addNewIcons("assets/json/icons/svg.json", "3x");
        window.dispatchEvent(new Event("dynamicContentReady"));
      })
      .catch((err) => {
        console.warn("One or more dynamic loads failed:", err);
        window.dispatchEvent(new Event("dynamicContentReady"));
      });
  }

  // Carregamento inicial
  loadDynamicContent();

  // Ouve o evento de mudança de idioma para recarregar os cards sem reload da página
  window.addEventListener("languageChanged", () => {
    loadDynamicContent();
  });

  showLastUpdate("lastUpdate");
});

function calcularIdade() {
  // Data de nascimento:   24 de setembro de 2008
  const nascimento = new Date(2008, 8, 24); // Mês é 0-indexado (8 = setembro)
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();

  // Ajusta se ainda não fez aniversário este ano
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
    accessibilityMenu.setAttribute("aria-hidden", "true");
    if (accessibilityButton) {
      accessibilityButton.setAttribute("aria-expanded", "false");
      accessibilityButton.focus();
    }
  } else {
    accessibilityMenu.style.display = "flex";
    accessibilityMenu.setAttribute("aria-hidden", "false");
    if (accessibilityButton)
      accessibilityButton.setAttribute("aria-expanded", "true");
  }
}

let fontSize = 1;
function increaseFont() {
  // limita tamanho entre 0. 6em e 3. 0em para evitar valores extremos
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

function jsonCardProjectsFetch(
  fileURL,
  containerId,
  iconSize = "3x",
  language = "pt-BR"
) {
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

        // Obter tecnologias dos projetos
        const projectKey = card.projectTitle;
        const projectTechs = data[projectKey] || [];
        const techsHTML = projectTechs
          .map((tech) => {
            const classes = faClass(tech.style, tech.icon, iconSize);
            return `<i class="${classes} icon" title="${tech.name}"></i>`;
          })
          .join(" ");

        const articleCardImage = document.createElement("article");
        articleCardImage.className = "article-card-image";
        const picture = document.createElement("picture");
        picture.className = "img-card";
        const source = document.createElement("source");
        source.media = "(max-width: 990px)";
        source.srcset = card.imageMobile;
        source.type = card.imageType;
        const img = document.createElement("img");
        img.src = card.image;
        img.alt = card.descriptionImage[language];
        img.loading = "lazy";
        picture.appendChild(source);
        picture.appendChild(img);
        articleCardImage.appendChild(picture);

        const articleCardDescription = document.createElement("article");
        articleCardDescription.className = "article-card-description";
        const h3 = document.createElement("h3");
        h3.innerHTML = card.title[language];
        const pDescription = document.createElement("p");
        pDescription.innerHTML = card.description[language];
        const h4Technologies = document.createElement("h4");
        h4Technologies.innerHTML = card.titleTechnologies[language];
        const divTechnologies = document.createElement("div");
        divTechnologies.className = "technologies-portfolio";
        divTechnologies.innerHTML = techsHTML;

        const divLinks = document.createElement("div");
        divLinks.className = "links-portfolio";
        const h4Links = document.createElement("h4");
        h4Links.innerHTML = card.titleLinks
          ? card.titleLinks[language]
          : "Links";
        const aRepo = document.createElement("a");
        aRepo.href = card.linkRepository;
        aRepo.setAttribute("target", "_blank");
        aRepo.setAttribute("rel", "noopener noreferrer");
        aRepo.innerHTML = `<i class="fa-brands fa-github fa-${iconSize} icon"></i>`;
        divLinks.appendChild(aRepo);
        if (card.linkSite) {
          const aDemo = document.createElement("a");
          aDemo.href = card.linkSite;
          aDemo.setAttribute("target", "_blank");
          aDemo.setAttribute("rel", "noopener noreferrer");
          aDemo.innerHTML = `<i class="fa-solid fa-share-from-square fa-${iconSize} icon"></i>`;
          divLinks.appendChild(aDemo);
        }

        articleCardDescription.appendChild(h3);
        articleCardDescription.appendChild(pDescription);
        articleCardDescription.appendChild(h4Technologies);
        articleCardDescription.appendChild(divTechnologies);
        articleCardDescription.appendChild(h4Links);
        articleCardDescription.appendChild(divLinks);

        projectCard.appendChild(articleCardImage);
        projectCard.appendChild(articleCardDescription);
        container.appendChild(projectCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load projects:", error);
    });
}

function jsonCardSkillsFetch(fileURL, containerId, iconSize = "3x") {
  return fetch(fileURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching skills: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      data.cards.forEach((card) => {
        const skillCard = document.createElement("div");
        skillCard.className = "card card-skills";
        const classes = faClass(card.style, card.icon, iconSize);
        skillCard.innerHTML = `
          <i class="${classes} icon" title="${card.name}"></i>
          <p>${card.name}</p>
        `;
        container.appendChild(skillCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load skills:", error);
    });
}

function jsonLinksFetch(fileURL, containerId, iconSize = "2x") {
  return fetch(fileURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching links: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      // Corrige:  contact.json usa "cards", não "links"
      if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error("Invalid data structure:  expected data.cards array");
      }
      data.cards.forEach((card) => {
        const linkElement = document.createElement("a");
        linkElement.href = card.link || card.url; // Aceita tanto 'link' quanto 'url'
        linkElement.setAttribute("target", "_blank");
        linkElement.setAttribute("rel", "noopener noreferrer");
        const classes = faClass(card.style, card.icon, iconSize);
        linkElement.innerHTML = `<i class="${classes} icon"></i>`;
        linkElement.setAttribute("aria-label", card.name);
        linkElement.setAttribute("title", card.name);
        container.appendChild(linkElement);
      });
    })
    .catch((error) => {
      console.error("Failed to load links:", error);
    });
}

function jsonCardFormationFetch(
  fileURL,
  containerId,
  iconSize = "3x",
  language = "pt-BR"
) {
  return fetch(fileURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching formations: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error("Invalid data structure: expected data.cards array");
      }
      data.cards.forEach((card) => {
        const formationCard = document.createElement("div");
        formationCard.className = "card card-formation";

        const title = document.createElement("h3");
        title.textContent = card.title[language] || card.title;

        const institution = document.createElement("p");
        institution.textContent =
          card.institution[language] || card.institution;

        const description = document.createElement("p");
        description.textContent =
          card.description[language] || card.description;

        const type = document.createElement("p");
        type.textContent = card.type ? card.type[language] || card.type.id : "";

        const year = document.createElement("p");
        year.textContent =
          typeof card.dateText === "object"
            ? card.dateText[language] || card.dateText
            : card.dateText;

        formationCard.appendChild(title);
        formationCard.appendChild(institution);
        formationCard.appendChild(type);
        formationCard.appendChild(description);
        formationCard.appendChild(year);
        container.appendChild(formationCard);
      });
    })
    .catch((error) => {
      console.error("Failed to load formations:", error);
    });
}

function addNewIcons(linkFile, size = "3x") {
  if (!linkFile) return;

  fetch(linkFile)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching SVG icons: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("SVG Icons loaded:", data);

      if (!Array.isArray(data.icons) || data.icons.length === 0) {
        console.warn("No icons found in file:", linkFile);
        return;
      }

      const icons = data.icons;
      icons.forEach((icon) => {
        if (!icon.class || !icon.svg) {
          console.warn("Invalid icon data, missing class or svg:", icon);
          return;
        }

        // Limpa fills/strokes hardcoded
        let svgMarkup = icon.svg
          .replace(/fill='#[^']*'/g, "")
          .replace(/fill="#[^"]*"/g, "")
          .replace(/stroke='#[^']*'/g, "")
          .replace(/stroke="#[^"]*"/g, "");

        // Adiciona classe svg-icon se não houver
        if (!svgMarkup.includes('class="svg-icon"')) {
          svgMarkup = svgMarkup.replace(/<svg/, '<svg class="svg-icon"');
        }

        // CORRETO: sem espaço após o ponto
        const selector = `i.${icon.class}`;
        const elements = document.querySelectorAll(selector);

        console.log(`Searching for: ${selector}, found:  ${elements.length}`);

        if (elements.length === 0) {
          console.warn(`No elements found with selector: ${selector}`);
          return;
        }

        Array.from(elements).forEach((element) => {
          element.innerHTML = svgMarkup;

          const svgElement = element.querySelector("svg");
          if (!svgElement) return;

          // Remove width e height fixos
          svgElement.removeAttribute("width");
          svgElement.removeAttribute("height");

          // Garante viewBox
          if (!svgElement.getAttribute("viewBox")) {
            svgElement.setAttribute("viewBox", "0 0 24 24");
          }

          // Força paths a usar currentColor
          svgElement
            .querySelectorAll("path, circle, rect, line, polygon, ellipse")
            .forEach((el) => {
              if (el.getAttribute("fill") !== "none") {
                el.setAttribute("fill", "currentColor");
              }
              if (el.getAttribute("stroke")) {
                el.setAttribute("stroke", "currentColor");
              }
            });
        });
      });
    })
    .catch((error) => {
      console.error("Error loading SVG icons:", error);
    });
}

async function showLastUpdate(elementId) {
  // Obtém owner/repo a partir de data-attributes no <body>, com fallback
  const owner = document.body.dataset.githubOwner || "JLBBARCO";
  const repo = document.body.dataset.githubRepo || "portfolio";

  const url = `https://api.github.com/repos/${owner}/${repo}/commits? per_page=1`;

  function replaceDateInDOM(dateStr) {
    // Substitui ocorrências de {{date}} em nós de texto de forma segura
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    const nodesToUpdate = [];
    while (walker.nextNode()) {
      if (
        walker.currentNode.nodeValue &&
        walker.currentNode.nodeValue.includes("{{date}}")
      ) {
        nodesToUpdate.push(walker.currentNode);
      }
    }
    nodesToUpdate.forEach((textNode) => {
      textNode.nodeValue = textNode.nodeValue.replace(/\{\{date\}\}/g, dateStr);
    });

    // Também atualiza explicitamente o elemento de última atualização, se existir
    const lastEl = document.getElementById(elementId);
    if (lastEl) {
      // Use a tradução se disponível (translate. js expõe translations via t)
      if (typeof window.t === "function") {
        // Caso t tenha sido carregada, aplica a tradução atualizada
        try {
          // Garantir que, se o texto tiver {{date}}, ele seja substituído
          const trans = window.t("lastUpdate");
          lastEl.textContent = trans.includes("{{date}}")
            ? trans.replace(/\{\{date\}\}/g, dateStr)
            : trans;
        } catch (e) {
          lastEl.textContent = `Última atualização: ${dateStr}`;
        }
      } else {
        lastEl.textContent = `Última atualização: ${dateStr}`;
      }
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
    const commits = await response.json();
    if (!Array.isArray(commits) || commits.length === 0)
      throw new Error("No commits found");

    const commitDate = new Date(commits[0].commit.author.date);

    // Formata a data usando a linguagem atual do documento (se disponível)
    const locale = document.documentElement.lang || "pt-BR";
    const formatted = commitDate.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Guarda a data bruta (ISO) para que possamos reformatá-la por idioma
    window.__lastUpdateRawDate = commitDate.toISOString();

    // Se a função setTranslationDate já existir, chame-a imediatamente com a data bruta
    if (typeof window.setTranslationDate === "function") {
      window.setTranslationDate(window.__lastUpdateRawDate);
    }

    // Reaplica a data quando o conteúdo dinâmico estiver pronto (formações, etc.)
    window.addEventListener(
      "dynamicContentReady",
      () => {
        if (
          window.__lastUpdateRawDate &&
          typeof window.setTranslationDate === "function"
        ) {
          window.setTranslationDate(window.__lastUpdateRawDate);
        }
      },
      { once: true }
    );
  } catch (err) {
    console.error("Erro ao buscar commits:", err);
  }
}
