function setIconsTechsSite(fileURL, containerID, loadId) {
  function fetchRepositoryMetadata(owner, repo) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    return fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .catch((err) => {
        console.warn("[more] Failed to fetch repository metadata:", err);
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
        console.warn("[more] Failed to fetch latest commit date:", err);
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
        console.warn("[more] Failed to fetch repository languages:", err);
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

  section.appendChild(container);

  const update = document.createElement("p");
  update.id = "lastUpdate";
  update.setAttribute("data-i18n", "meta_last_update");
  section.appendChild(update);

  main.appendChild(section);

  if (container && loadId !== undefined) container.dataset.loadId = loadId;
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

  function renderIconsFromData(data) {
    const container = document.getElementById(containerID);
    if (!container || !data || !Array.isArray(data.icons)) return;
    if (loadId !== undefined && container.dataset.loadId != loadId) return;

    const fragment = document.createDocumentFragment();
    data.icons.forEach((icon) => {
      const div = document.createElement("div");
      div.className = "icon-container";
      const classes = faClass(icon.style, icon.class);
      div.innerHTML = `<i class="${classes} icon" title="${icon.name || icon.class || ""}"></i>`;
      fragment.appendChild(div);
    });

    container.appendChild(fragment);
  }

  return Promise.all([
    fetchRepositoryMetadata(owner, repo),
    fetchRepositoryLanguages(owner, repo),
    fetchMainBranchLastUpdate(owner, repo),
  ])
    .then(([repoData, languagesData, lastCommitDate]) => {
      const container = document.getElementById(containerID);
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
        return fetchJsonWithFallback(fileURL)
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
            console.warn("[more] Could not load fallback icons file:", err),
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
    })
    .catch((err) =>
      console.error(
        "Erro ao carregar dados do repositório para a seção More:",
        err,
      ),
    );
}
