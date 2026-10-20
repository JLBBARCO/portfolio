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
      const resolved = resolveIconSpec(tech, tech.name || "");
      const classes = faClass(resolved.style, resolved.icon);
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

/**
 * Renderiza os grupos de tecnologias JA agrupados pelo servidor
 * (snapshot.technologies.groups). O navegador so ordena pelo idioma atual e
 * monta os icones - nenhum calculo ou requisicao extra.
 */
function renderTechnologyGroups(container, groups, language = "pt-BR") {
  if (!container || !Array.isArray(groups)) return 0;

  const fragment = document.createDocumentFragment();
  const sortedGroups = [...groups].sort((a, b) => {
    const titleA = getLocalized(a.stack, language) || a.stack.id;
    const titleB = getLocalized(b.stack, language) || b.stack.id;
    return titleA.localeCompare(titleB);
  });

  let rendered = 0;
  sortedGroups.forEach((group) => {
    const technologies = Array.isArray(group.technologies)
      ? group.technologies
      : [];
    if (!technologies.length) return;

    const stackDiv = document.createElement("div");
    stackDiv.className = "tech-stack-group";

    const h3 = document.createElement("h3");
    h3.textContent = getLocalized(group.stack, language) || group.stack.id;
    stackDiv.appendChild(h3);

    const iconsContainer = document.createElement("div");
    iconsContainer.className = "block";

    [...technologies]
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .forEach((tech) => {
        const div = document.createElement("div");
        div.className = "card tech-cards";
        const resolved = resolveIconSpec(tech, tech.name || "");
        div.innerHTML = `<i class="${faClass(resolved.style, resolved.icon)} icon" title="${tech.name || ""}"></i>`;
        const p = document.createElement("p");
        p.textContent = tech.name || "";
        div.appendChild(p);
        iconsContainer.appendChild(div);
        rendered += 1;
      });

    stackDiv.appendChild(iconsContainer);
    fragment.appendChild(stackDiv);
  });

  container.appendChild(fragment);
  return rendered;
}

function loadAllTechnologies(language = "pt-BR", loadId) {
  const githubOwner = document.body.dataset.githubOwner || "JLBBARCO";
  const projectsSource = "github";

  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Technologies";
  section.dataset.dynamicSection = "true";

  const title = document.createElement("h2");
  title.id = "technologiesTitle";
  title.setAttribute("data-i18n", "section_technologies_title");
  title.innerHTML = "Technologies";
  section.append(title);

  const container = document.createElement("article");
  container.id = "technologiesContainer";
  container.className = "block";

  section.appendChild(container);
  main.appendChild(section);

  if (container && loadId !== undefined) container.dataset.loadId = loadId;

  // Caminho principal: grupos prontos do snapshot da Vercel.
  const groupsPromise =
    window.SiteData && typeof window.SiteData.technologies === "function"
      ? window.SiteData.technologies()
      : Promise.resolve(null);

  return groupsPromise
    .then((technologies) => {
      const target = document.getElementById("technologiesContainer");
      if (!target) return;
      if (loadId !== undefined && target.dataset.loadId != loadId) return;

      const groups =
        technologies && Array.isArray(technologies.groups)
          ? technologies.groups
          : [];
      if (groups.length) {
        renderTechnologyGroups(target, groups, language);
        return;
      }

      // Reserva: agrupa no cliente a partir dos cards (sem requisicoes novas).
      return Promise.all([
        loadProjectsData(projectsSource, githubOwner),
        fetchJsonWithFallback("src/json/areas/formation.json").catch(
          () => ({}),
        ),
      ]).then(([projectsData, formationsData]) => {
        if (loadId !== undefined && target.dataset.loadId != loadId) return;
        const allCards = [];
        if (projectsData && projectsData.cards) {
          allCards.push(...projectsData.cards);
        }
        if (formationsData && formationsData.cards) {
          allCards.push(...formationsData.cards);
        }
        setupTechnologies(target, allCards, language);
      });
    })
    .catch((err) => console.error("Erro ao carregar tecnologias:", err));
}

function filterProjectsByTechnology(tech) {
  Array.from(document.querySelectorAll(".card.card-projects")).forEach(
    (card) => {
      const cardIndex = Number(card.dataset.index || 0);
      const techs = card.dataset.technologies
        ? card.dataset.technologies.split(",").map((t) => t.trim())
        : [];

      if (tech === "all") {
        card.style.display = cardIndex > 6 ? "none" : "flex";
        return;
      }

      card.style.display = techs.includes(tech) ? "flex" : "none";
    },
  );
  updateFilterButtons(tech);
  toggleShowAllButtonVisibility("Projects", tech === "all");
}
