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

  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Technologies";

  const title = document.createElement("h2");
  title.id = "technologiesTitle";
  title.setAttribute("data-i18n", "section_technologies_title");
  title.innerHTML = "Technologies";
  section.append(title);

  const container = document.createElement("article");
  container.id = "technologiesContainer";
  container.className = "block";

  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  Promise.all([
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

  section.appendChild(container);
  main.appendChild(section);
}

function filterProjectsByTechnology(tech) {
  Array.from(document.querySelectorAll(".card.card-projects")).forEach(
    (card) => {
      const techs = card.dataset.technologies
        ? card.dataset.technologies.split(",").map((t) => t.trim())
        : [];
      card.style.display =
        tech === "all" || techs.includes(tech) ? "flex" : "none";
    },
  );
  updateFilterButtons(tech);
}
