function setIconsTechsSite(fileURL, containerID, loadId) {
  const main = document.querySelector("main");
  const section = document.createElement("section");
  section.id = "More";

  const title = document.createElement("h2");
  title.id = "moreTitle";
  title.setAttribute("data-i18n", "section_more_title");
  section.append(title);

  const container = document.createElement("article");
  container.id = "techsThisSite";
  container.className = "block";

  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerID);
      if (!container || !data.icons) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      const fragment = document.createDocumentFragment();
      data.icons.forEach((icon) => {
        const div = document.createElement("div");
        div.className = "icon-container";
        const classes = faClass(icon.style, icon.class);
        div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
        fragment.appendChild(div);
      });
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) =>
      console.error("Erro ao carregar ícones techs-this-site:", err),
    );

  section.appendChild(container);
  main.appendChild(section);
}
