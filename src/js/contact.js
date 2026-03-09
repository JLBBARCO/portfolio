function setIconsContact(fileURL, containerID, loadId) {
  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "Contact";

  const title = document.createElement("h2");
  title.id = "contactTitle";
  title.setAttribute("data-i18n", "section_contact_title");
  section.append(title);

  const container = document.createElement("article");
  container.id = containerID;
  container.className = "block";

  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  fetchJsonWithFallback(fileURL)
    .then((data) => {
      if (!container || !Array.isArray(data.cards)) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      const fragment = document.createDocumentFragment();

      data.cards.forEach((card) => {
        const a = document.createElement("a");
        a.href = card.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "link-item";

        const iconClasses = faClass(card.style, card.icon);
        a.innerHTML = `<i class="${iconClasses} icon"></i>`;
        a.setAttribute("aria-label", card.name);
        a.title = card.name;

        fragment.appendChild(a);
      });
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) => console.error("Erro ao carregar contatos:", err));

  section.appendChild(container);
  main.appendChild(section);
}
