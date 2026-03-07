function setIconsContact(fileURL, containerId, loadId) {
  const container = document.getElementById(containerId);
  if (container && loadId !== undefined) container.dataset.loadId = loadId;
  return fetchJsonWithFallback(fileURL)
    .then((data) => {
      const container = document.getElementById(containerId);
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
}
