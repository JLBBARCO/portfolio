function setIconsTechsSite(fileURL, containerID, loadId) {
  const container = document.getElementById(containerID);
  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return fetchJsonWithFallback(fileURL)
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
}
