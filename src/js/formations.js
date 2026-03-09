function setupFormations(fileURL, language, loadId) {
  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Formations";

  const title = document.createElement("h2");
  title.id = "formationsTitle";
  title.setAttribute("data-i18n", "section_formations_title");
  section.append(title);

  const container = document.createElement("article");
  container.id = "formationsContainer";
  container.className = "block";

  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  fetchJsonWithFallback(fileURL)
    .then((data) => {
      if (!container || !data.cards) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) {
        return;
      }
      const cards = data.cards;

      const typeCount = {};
      const typeNames = {};
      cards.forEach((card) => {
        if (card.type && card.type.id) {
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

      // sort by most recent end date first (knowledge preference)
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
        if (card.type && card.type.id) div.dataset.type = card.type.id;

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
            if (!tech.style || !tech.icon) return;
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

      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) => console.error(`Erro ao carregar ${container}:`, err));

  section.appendChild(container);
  main.appendChild(section);
}

function filterFormationsByType(type) {
  Array.from(document.querySelectorAll(".card.card-formation")).forEach(
    (card) => {
      card.style.display =
        type === "all" || card.dataset.type === type ? "block" : "none";
    },
  );
  updateFilterButtons(type);
}
