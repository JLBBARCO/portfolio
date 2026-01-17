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
      // Usa a variável global 'fontSize'
      fontSize = parsed;
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
    // Limpa containers antes de recarregar
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

    // Chamadas corrigidas para usar a função genérica jsonCardsFetch,
    // que foi refatorada para lidar com os diferentes tipos de dados.
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
  // Data de nascimento: 24 de setembro de 2008
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
      menuIcon.classList.remove("fa-xmark", "fa-close");
      menuIcon.classList.add("fa-bars");
    }
    if (menuButton) menuButton.setAttribute("aria-expanded", "false");
  } else {
    navLinks.style.display = "grid";
    if (menuIcon) {
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

function increaseFont() {
  fontSize = Math.min(3.0, Math.round((fontSize + 0.1) * 10) / 10);
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function decreaseFont() {
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
          icon.size || iconSize,
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
      if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error("Invalid data structure: expected data.cards array");
      }
      data.cards.forEach((card) => {
        const linkElement = document.createElement("a");
        linkElement.href = card.link || card.url;
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

/**
 * Helper para obter texto localizado de um campo que pode ser string ou objeto por idioma.
 * value: string | object
 * language: "pt-BR" | "en-US" (ou similar)
 */
function getLocalized(value, language) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // tenta chave exata primeiro, depois pt-BR/en-US e por fim qualquer valor disponível
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
  return String(value);
}

function jsonCardsFetch(
  fileURL,
  containerId,
  iconSize = "3x",
  language = "pt-BR",
) {
  return fetch(fileURL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Error fetching ${containerId}: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      // Se for a seção de formações, aplica a lógica de filtro
      if (containerId === "formationsContainer") {
        if (!data.cards || !Array.isArray(data.cards)) {
          throw new Error("Invalid data structure: expected data.cards array");
        }

        // Contabilizar tipos de cursos e armazenar o nome traduzido
        const typeCount = {};
        const typeNames = {};
        data.cards.forEach((card) => {
          if (card.type && card.type.id) {
            const typeId = card.type.id;
            typeCount[typeId] = (typeCount[typeId] || 0) + 1;
            // Armazena o nome traduzido
            typeNames[typeId] =
              card.type[language] || card.type["pt-BR"] || typeId;
          }
        });

        // Criar container para filtros
        const filterContainer = document.createElement("div");
        filterContainer.className = "filter-container";

        // Criar botão "Todos" se houver mais de um tipo
        if (Object.keys(typeCount).length > 1) {
          const buttonAll = document.createElement("button");
          buttonAll.className = "filter-button active";
          buttonAll.dataset.filter = "all";
          buttonAll.textContent = language === "pt-BR" ? "Todos" : "All";
          buttonAll.addEventListener("click", () =>
            filterFormationsByType("all"),
          );
          container.appendChild(filterContainer); // Adiciona o container de filtro antes dos cards
          filterContainer.appendChild(buttonAll);

          // Criar botões de filtro por tipo
          Object.entries(typeCount).forEach(([typeId, count]) => {
            const button = document.createElement("button");
            button.className = "filter-button";
            button.dataset.filter = typeId;
            // Usa o nome traduzido armazenado
            button.textContent = `${typeNames[typeId]} (${count})`;
            button.addEventListener("click", () =>
              filterFormationsByType(typeId),
            );
            filterContainer.appendChild(button);
          });
        }

        // Criação dos cards de formação
        data.cards.forEach((card) => {
          const formationCard = document.createElement("div");
          formationCard.className = "card card-formation";

          // Adicionar data-type para filtro
          if (card.type && card.type.id) {
            formationCard.dataset.type = card.type.id;
          }

          // Criar e adicionar título
          const title = document.createElement("h3");
          title.textContent = getLocalized(card.title, language) || "";
          formationCard.appendChild(title);

          // Criar e adicionar instituição
          const institution = document.createElement("p");
          institution.className = "institution";
          institution.textContent =
            getLocalized(card.institution, language) || "";
          formationCard.appendChild(institution);

          // Criar e adicionar tipo de curso
          const type = document.createElement("p");
          type.className = "formation-type";
          // Usa o nome traduzido para exibição
          type.textContent = card.type ? getLocalized(card.type, language) : "";
          formationCard.appendChild(type);

          // Criar e adicionar descrição
          const description = document.createElement("p");
          description.className = "description";
          description.textContent =
            getLocalized(card.description, language) || "";
          formationCard.appendChild(description);

          // Criar e adicionar período
          const year = document.createElement("p");
          year.className = "period";
          year.textContent =
            typeof card.dateText === "object"
              ? getLocalized(card.dateText, language)
              : card.dateText || "";
          formationCard.appendChild(year);

          container.appendChild(formationCard);
        });
      }
      // Se for a seção de projetos
      else if (containerId === "projectsContainer") {
        if (!data.cards || !Array.isArray(data.cards)) {
          throw new Error("Invalid data structure: expected data.cards array");
        }

        data.cards.forEach((card) => {
          const createdCard = document.createElement("div");
          createdCard.className = "card card-projects";

          // Criar imagem/responsive (se existir)
          if (card.image) {
            const picture = document.createElement("picture");
            picture.className = "img-card";
            if (card.imageMobile) {
              const source = document.createElement("source");
              source.media = "(max-width: 990px)";
              source.srcset = card.imageMobile;
              if (card.imageType) source.type = card.imageType;
              picture.appendChild(source);
            }
            const img = document.createElement("img");
            img.src = card.image;
            img.alt = getLocalized(card.descriptionImage, language) || "";
            img.loading = "lazy";
            picture.appendChild(img);
            createdCard.appendChild(picture);
          }

          if (card.title) {
            const h3 = document.createElement("h3");
            h3.innerHTML = getLocalized(card.title, language) || "";
            createdCard.appendChild(h3);
          }

          if (card.institution) {
            const institution = document.createElement("p");
            institution.className = "institution";
            institution.textContent =
              getLocalized(card.institution, language) || "";
            createdCard.appendChild(institution);
          }

          if (card.description) {
            const pDescription = document.createElement("p");
            pDescription.innerHTML =
              getLocalized(card.description, language) || "";
            createdCard.appendChild(pDescription);
          }

          if (card.titleTechnologies) {
            const h4Technologies = document.createElement("h4");
            h4Technologies.innerHTML =
              getLocalized(card.titleTechnologies, language) || "";
            createdCard.appendChild(h4Technologies);
          }

          if (card.iconTechnologies && Array.isArray(card.iconTechnologies)) {
            const divTechnologies = document.createElement("div");
            divTechnologies.className = "technologies-portfolio";

            // Usa cada ícone definido no card.iconTechnologies
            card.iconTechnologies.forEach((tech) => {
              const classes = faClass(tech.style, tech.icon, iconSize);
              const iconEl = document.createElement("i");
              iconEl.className = `${classes} icon`;
              iconEl.title = tech.name || "";
              divTechnologies.appendChild(iconEl);
            });

            createdCard.appendChild(divTechnologies);
          }

          if (card.titleLinks) {
            const h4Links = document.createElement("h4");
            h4Links.innerHTML =
              getLocalized(card.titleLinks, language) || "Links";
            createdCard.appendChild(h4Links);
          }

          const divLinks = document.createElement("div");
          divLinks.className = "links-portfolio";

          if (card.linkRepository) {
            const aRepo = document.createElement("a");
            aRepo.href = card.linkRepository;
            aRepo.setAttribute("target", "_blank");
            aRepo.setAttribute("rel", "noopener noreferrer");
            aRepo.innerHTML = `<i class="fa-brands fa-github fa-${iconSize} icon"></i>`;
            divLinks.appendChild(aRepo);
          }

          if (card.linkSite) {
            const aDemo = document.createElement("a");
            aDemo.href = card.linkSite;
            aDemo.setAttribute("target", "_blank");
            aDemo.setAttribute("rel", "noopener noreferrer");
            aDemo.innerHTML = `<i class="fa-solid fa-share-from-square fa-${iconSize} icon"></i>`;
            divLinks.appendChild(aDemo);
          }
          createdCard.appendChild(divLinks);
          container.appendChild(createdCard);
        });
      }
      // Se for a seção de skills/programs (cards simples de ícones)
      else if (
        containerId === "technologiesContainer" ||
        containerId === "programsContainer"
      ) {
        const cardsToProcess = data.cards || data.cardsIcons;

        if (!cardsToProcess || !Array.isArray(cardsToProcess)) {
          throw new Error(
            "Invalid data structure: expected data.cards or data.cardsIcons array",
          );
        }

        cardsToProcess.forEach((card) => {
          if (card.icon) {
            const skillCard = document.createElement("div");
            skillCard.className = "card card-skills";
            const classes = faClass(card.style, card.icon, iconSize);
            skillCard.innerHTML = `
              <i class="${classes} icon" title="${card.name}"></i>
              <p>${card.name}</p>
            `;
            container.appendChild(skillCard);
          }
        });
      }
    })
    .catch((error) => {
      console.error(`Failed to load ${containerId}:`, error);
    });
}

function filterFormationsByType(typeId) {
  const cards = document.querySelectorAll(".card.card-formation");

  cards.forEach((card) => {
    if (typeId === "all" || card.dataset.type === typeId) {
      card.style.display = "block";
    } else {
      card.style.display = "none";
    }
  });

  const buttons = document.querySelectorAll(".filter-button");
  buttons.forEach((btn) => {
    if (btn.dataset.filter === typeId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
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

        let svgMarkup = icon.svg
          .replace(/fill='#[^']*'/g, "")
          .replace(/fill="#[^"]*"/g, "")
          .replace(/stroke='#[^']*'/g, "")
          .replace(/stroke="#[^"]*"/g, "");

        if (!svgMarkup.includes('class="svg-icon"')) {
          svgMarkup = svgMarkup.replace(/<svg/, '<svg class="svg-icon"');
        }

        const selector = `i.${icon.class}`;
        const elements = document.querySelectorAll(selector);

        if (elements.length === 0) {
          return;
        }

        Array.from(elements).forEach((element) => {
          element.innerHTML = svgMarkup;

          const svgElement = element.querySelector("svg");
          if (!svgElement) return;

          svgElement.removeAttribute("width");
          svgElement.removeAttribute("height");

          if (!svgElement.getAttribute("viewBox")) {
            svgElement.setAttribute("viewBox", "0 0 24 24");
          }

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
  const owner = document.body.dataset.githubOwner || "JLBBARCO";
  const repo = document.body.dataset.githubRepo || "portfolio";

  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`;

  function replaceDateInDOM(dateStr) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
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

    const lastEl = document.getElementById(elementId);
    if (lastEl) {
      if (typeof window.t === "function") {
        try {
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

    const locale = document.documentElement.lang || "pt-BR";
    const formatted = commitDate.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    window.__lastUpdateRawDate = commitDate.toISOString();

    if (typeof window.setTranslationDate === "function") {
      window.setTranslationDate(window.__lastUpdateRawDate);
    }

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
      { once: true },
    );

    replaceDateInDOM(formatted);
  } catch (err) {
    console.error("Erro ao buscar commits:", err);
  }
}
