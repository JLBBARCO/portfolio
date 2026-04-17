// Integrated footer function that combines "More" and "Contact" sections side by side
function footer(contactFileURL, contactContainerID, loadId) {
  function fetchRepositoryMetadata(owner, repo) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    return fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .catch((err) => {
        console.warn("[footer] Failed to fetch repository metadata:", err);
        return null;
      });
  }

  function fetchMainBranchLastUpdate(owner, repo) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=main&per_page=1`;
    return fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((commits) => {
        const first = Array.isArray(commits) ? commits[0] : null;
        return (
          (first &&
            first.commit &&
            first.commit.committer &&
            first.commit.committer.date) ||
          null
        );
      })
      .catch((err) => {
        console.warn("[footer] Failed to fetch latest commit date:", err);
        return null;
      });
  }

  function fetchRepositoryLanguages(owner, repo) {
    if (typeof fetchRepoLanguages === "function") {
      return fetchRepoLanguages(owner, repo);
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;
    return fetch(url)
      .then((res) => (res.ok ? res.json() : {}))
      .catch((err) => {
        console.warn("[footer] Failed to fetch repository languages:", err);
        return {};
      });
  }

  function buildIconsFromRepositoryData(repoData, languagesData) {
    const names = new Set();

    if (languagesData && typeof languagesData === "object") {
      Object.keys(languagesData).forEach((name) => names.add(name));
    }

    if (repoData && repoData.language) names.add(repoData.language);
    if (repoData && Array.isArray(repoData.topics)) {
      repoData.topics.forEach((topic) => names.add(topic));
    }

    return Array.from(names)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => {
        const guess =
          typeof guessFaIcon === "function" ? guessFaIcon(name) : null;
        return {
          name,
          style: guess ? guess.style : "fa-solid",
          class: guess ? guess.icon : "fa-code",
        };
      });
  }

  const footerElement = document.querySelector("footer");

  // Create left section: "More about this site"
  const moreSection = document.createElement("article");
  moreSection.id = "More";
  moreSection.className = "footer-section";

  const moreTitle = document.createElement("h3");
  moreTitle.id = "moreTitle";
  moreTitle.setAttribute("data-i18n", "section_more_title");
  moreSection.append(moreTitle);

  const techsContainer = document.createElement("article");
  techsContainer.id = "techsThisSite";
  techsContainer.className = "block";

  moreSection.appendChild(techsContainer);

  const updateInfo = document.createElement("p");
  updateInfo.id = "lastUpdate";
  updateInfo.setAttribute("data-i18n", "meta_last_update");
  moreSection.appendChild(updateInfo);

  // Create right section: "Contact"
  const contactSection = document.createElement("article");
  contactSection.id = "Contact";
  contactSection.className = "footer-section";

  const contactTitle = document.createElement("h3");
  contactTitle.id = "contactTitle";
  contactTitle.setAttribute("data-i18n", "section_contact_title");
  contactSection.append(contactTitle);

  const contactContainer = document.createElement("article");
  contactContainer.id = contactContainerID;
  contactContainer.className = "block";

  contactSection.appendChild(contactContainer);

  // Create wrapper for side-by-side layout
  const footerWrapper = document.createElement("div");
  footerWrapper.id = "footerContent";
  footerWrapper.className = "footer-content-wrapper";
  footerWrapper.appendChild(moreSection);
  footerWrapper.appendChild(contactSection);

  footerElement.appendChild(footerWrapper);

  if (techsContainer && loadId !== undefined)
    techsContainer.dataset.loadId = loadId;
  if (contactContainer && loadId !== undefined)
    contactContainer.dataset.loadId = loadId;

  const owner =
    (document.body &&
      document.body.dataset &&
      document.body.dataset.githubOwner) ||
    "JLBBARCO";
  const repo =
    (document.body &&
      document.body.dataset &&
      document.body.dataset.githubRepo) ||
    "portfolio";

  // Load both sections in parallel
  const pTechs = Promise.all([
    fetchRepositoryMetadata(owner, repo),
    fetchRepositoryLanguages(owner, repo),
    fetchMainBranchLastUpdate(owner, repo),
  ]).then(([repoData, languagesData, lastCommitDate]) => {
    const container = document.getElementById("techsThisSite");
    if (!container) return;
    if (loadId !== undefined && container.dataset.loadId != loadId) return;

    if (lastCommitDate) {
      window.__lastUpdateRawDate = lastCommitDate;
      if (typeof window.setTranslationDate === "function") {
        window.setTranslationDate(lastCommitDate);
      }
    }

    const icons = buildIconsFromRepositoryData(repoData, languagesData);
    if (!icons.length) {
      return fetchJsonWithFallback("src/assets/icons/svg.json")
        .then((data) => {
          if (!data || !Array.isArray(data.icons)) return;
          const fragment = document.createDocumentFragment();
          data.icons.forEach((icon) => {
            const div = document.createElement("div");
            div.className = "icon-container";
            const classes = faClass(icon.style, icon.class);
            div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
            fragment.appendChild(div);
          });
          if (loadId !== undefined && container.dataset.loadId != loadId)
            return;
          container.appendChild(fragment);
        })
        .catch((err) =>
          console.warn("[footer] Could not load fallback icons file:", err),
        );
    }

    const fragment = document.createDocumentFragment();
    icons.forEach((icon) => {
      const div = document.createElement("div");
      div.className = "icon-container";
      const classes = faClass(icon.style, icon.class);
      div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
      fragment.appendChild(div);
    });
    if (loadId !== undefined && container.dataset.loadId != loadId) return;
    container.appendChild(fragment);
  });

  // Load contact section
  const pContacts = fetchJsonWithFallback(contactFileURL)
    .then((data) => {
      const container = document.getElementById(contactContainerID);
      if (!container || !Array.isArray(data.cards)) return;
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      const fragment = document.createDocumentFragment();

      data.cards.forEach((card) => {
        const a = document.createElement("a");
        a.href = card.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "link-item";

        const resolved = resolveIconSpec(card, card.name || "");
        const iconClasses = faClass(resolved.style, resolved.icon);
        a.innerHTML = `<i class="${iconClasses} icon"></i>`;
        a.setAttribute("aria-label", card.name);
        a.title = card.name;

        fragment.appendChild(a);
      });
      if (loadId !== undefined && container.dataset.loadId != loadId) return;
      container.appendChild(fragment);
    })
    .catch((err) => console.error("[footer] Error loading contacts:", err));

  return Promise.all([pTechs, pContacts]);
}
