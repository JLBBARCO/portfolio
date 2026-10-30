function curses(fileURL, language, loadId) {
  function getCurrentYearLabel() {
    return String(new Date().getFullYear());
  }

  function getLocalizedField(value, languageKey) {
    if (!value || typeof value !== "object") return "";

    const normalizedLanguage = String(languageKey || "").toLowerCase();
    return (
      value[languageKey] ||
      value[normalizedLanguage] ||
      value["pt-BR"] ||
      value["pt-br"] ||
      value["en-US"] ||
      value["en-us"] ||
      value.pt ||
      value.en ||
      Object.values(value).find(
        (entry) => typeof entry === "string" && entry.trim(),
      ) ||
      ""
    );
  }

  function getCardTimestamp(date) {
    if (!date || typeof date !== "object") return 0;

    const yearValue = Number(
      date.year ?? date["year"] ?? getCurrentYearLabel(),
    );
    const monthValue = Number(date.month ?? date["month"] ?? 1);

    if (!Number.isFinite(yearValue)) return 0;

    const safeMonth =
      Number.isFinite(monthValue) && monthValue >= 1 && monthValue <= 12
        ? monthValue
        : 1;

    return new Date(yearValue, safeMonth - 1).getTime();
  }

  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Curses";
  section.dataset.dynamicSection = "true";

  const title = document.createElement("h2");
  title.id = "cursesTitle";
  title.setAttribute("data-i18n", "section_curses_title");
  section.append(title);

  const container = document.createElement("article");
  container.id = "cursesContainer";
  container.className = "block semi-hidden";
  section.appendChild(container);

  main.appendChild(section);

  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      if (!container || !data.cards) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) {
        return;
      }
      const cards = data.cards;

      const typeCount = {};
      const typeNames = {};
      cards.forEach((card) => {
        const typeLabel = getLocalizedField(card.type, language);
        if (typeLabel) {
          typeCount[typeLabel] = (typeCount[typeLabel] || 0) + 1;
          typeNames[typeLabel] = typeLabel;
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

        const parent = container.parentNode || section;
        if (parent) parent.insertBefore(filterContainer, container);
      }

      // sort by most recent end date first (knowledge preference)
      const sortedCards = [...cards].sort((a, b) => {
        const endA = getCardTimestamp(a.date);
        const endB = getCardTimestamp(b.date);
        if (endA !== endB) {
          return endB - endA;
        }
        const initA = Number(a.date?.month ?? a.date?.["month"] ?? 0);
        const initB = Number(b.date?.month ?? b.date?.["month"] ?? 0);
        return initB - initA;
      });

      let cardCounter = 0;

      const fragment = document.createDocumentFragment();
      sortedCards.forEach((card) => {
        cardCounter++;
        const div = document.createElement("div");
        div.className = "card card-formation";
        div.dataset.index = cardCounter; // for testing purposes
        const typeLabel = getLocalizedField(card.type, language);
        if (typeLabel) div.dataset.type = typeLabel;

        let html = "";
        if (card.title)
          html += `<h3>${getLocalizedField(card.title, language)}</h3>`;
        if (card.institution)
          html += `<p class="institution">${getLocalizedField(card.institution, language)}</p>`;
        if (card.type)
          html += `<p class="formation-type">${getLocalizedField(card.type, language)}</p>`;
        if (card.description)
          html += `<p class="description">${getLocalizedField(card.description, language)}</p>`;

        if (card.iconTechnologies && Array.isArray(card.iconTechnologies)) {
          const techTitle =
            language === "pt-BR" ? "Tecnologias" : "Technologies";
          html += `<h4 class="title-technologies">${techTitle}</h4>`;

          let techsDiv = `<div class="technologies">`;
          const sortedTechs = [...card.iconTechnologies].sort((a, b) =>
            (a.name || "").localeCompare(b.name || ""),
          );
          sortedTechs.forEach((tech) => {
            const resolved = resolveIconSpec(tech, tech.name || "");
            const iconClass = faClass(resolved.style, resolved.icon);
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
            html += `${getLocalizedField(cert.name, language)}`;
            if (cert.url) html += `</a>`;
            html += `</li>`;
          });
          html += `</ul></details>`;
        }

        if (card.links) {
          html += ``;
        }

        if (card.date) {
          html += `<div class="period">`;
          if (card.date["month"]) {
            html += card.date["month"];
          }
          if (card.date["month"] && card.date["year"]) {
            html += ` - `;
          }
          if (card.date["year"]) {
            html += card.date["year"];
          }
          html += `</div>`;
        }

        div.innerHTML = html;
        fragment.appendChild(div);
      });

      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) => console.error(`Erro ao carregar ${fileURL}:`, err));
}
