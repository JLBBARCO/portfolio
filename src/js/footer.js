const FOOTER_DEFAULT_OWNER = "JLBBARCO";
const FOOTER_DEFAULT_REPO = "portfolio";
const FOOTER_DYNAMIC_WRAPPER_ID = "footerContent";

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

function createFooterSection(id, titleId, titleI18nKey) {
  const section = document.createElement("article");
  section.id = id;
  section.className = "footer-section";

  const title = document.createElement("h3");
  title.id = titleId;
  title.setAttribute("data-i18n", titleI18nKey);
  section.appendChild(title);

  return section;
}

function createIconElement(style, iconClass, title) {
  const wrapper = document.createElement("div");
  wrapper.className = "icon-container";

  const iconNode = document.createElement("i");
  iconNode.className = `${faClass(style, iconClass)} icon`;
  if (title) iconNode.setAttribute("title", title);

  wrapper.appendChild(iconNode);
  return wrapper;
}

function appendTechIcons(container, icons) {
  const fragment = document.createDocumentFragment();
  icons.forEach((icon) => {
    fragment.appendChild(
      createIconElement(
        icon.style || "fa-solid",
        icon.class || "fa-code",
        icon.name || icon.class || "",
      ),
    );
  });
  container.appendChild(fragment);
}

function isStaleFooterState(state) {
  if (!state.footerWrapper.isConnected) return true;
  if (state.loadId === undefined) return false;
  return state.footerWrapper.dataset.loadId !== String(state.loadId);
}

function getRepoConfigFromBody() {
  const bodyDataset = (document.body && document.body.dataset) || {};
  return {
    owner: bodyDataset.githubOwner || FOOTER_DEFAULT_OWNER,
    repo: bodyDataset.githubRepo || FOOTER_DEFAULT_REPO,
  };
}

function createFooterLayout(footerElement, contactContainerID, loadId) {
  Array.from(
    footerElement.querySelectorAll(`#${FOOTER_DYNAMIC_WRAPPER_ID}`),
  ).forEach((el) => el.remove());

  const footerWrapper = document.createElement("div");
  footerWrapper.id = FOOTER_DYNAMIC_WRAPPER_ID;
  footerWrapper.className = "footer-content-wrapper";
  if (loadId !== undefined) {
    footerWrapper.dataset.loadId = String(loadId);
  }

  const moreSection = createFooterSection(
    "More",
    "moreTitle",
    "section_more_title",
  );
  const techsContainer = document.createElement("article");
  techsContainer.id = "techsThisSite";
  techsContainer.className = "block";
  moreSection.appendChild(techsContainer);

  const updateInfo = document.createElement("p");
  updateInfo.id = "lastUpdate";
  updateInfo.setAttribute("data-i18n", "meta_last_update");
  moreSection.appendChild(updateInfo);

  const contactSection = createFooterSection(
    "Contact",
    "contactTitle",
    "section_contact_title",
  );
  const contactContainer = document.createElement("article");
  contactContainer.id = contactContainerID;
  contactContainer.className = "block";
  contactSection.appendChild(contactContainer);

  footerWrapper.appendChild(moreSection);
  footerWrapper.appendChild(contactSection);
  footerElement.appendChild(footerWrapper);

  return {
    loadId,
    footerWrapper,
    techsContainer,
    contactContainer,
  };
}

function loadMoreSection(state, owner, repo) {
  return Promise.all([
    fetchRepositoryMetadata(owner, repo),
    fetchRepositoryLanguages(owner, repo),
    fetchMainBranchLastUpdate(owner, repo),
  ]).then(([repoData, languagesData, lastCommitDate]) => {
    if (isStaleFooterState(state)) return;

    if (lastCommitDate) {
      window.__lastUpdateRawDate = lastCommitDate;
      if (typeof window.setTranslationDate === "function") {
        window.setTranslationDate(lastCommitDate);
      }
    }

    const icons = buildIconsFromRepositoryData(repoData, languagesData);
    if (icons.length) {
      appendTechIcons(state.techsContainer, icons);
      return;
    }

    return fetchJsonWithFallback("src/assets/icons/svg.json")
      .then((data) => {
        if (isStaleFooterState(state)) return;
        if (!data || !Array.isArray(data.icons)) return;
        appendTechIcons(state.techsContainer, data.icons);
      })
      .catch((err) =>
        console.warn("[footer] Could not load fallback icons file:", err),
      );
  });
}

function loadContactSection(state, contactFileURL) {
  return fetchJsonWithFallback(contactFileURL)
    .then((data) => {
      if (isStaleFooterState(state)) return;
      if (!data || !Array.isArray(data.cards)) return;

      const fragment = document.createDocumentFragment();
      data.cards.forEach((card) => {
        if (!card || !card.url) return;

        const link = document.createElement("a");
        link.href = card.url;
        const isMailto = String(card.url).startsWith("mailto:");
        if (!isMailto) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        link.className = "link-item";
        link.setAttribute("aria-label", card.name || "Contact link");
        if (card.name) link.title = card.name;

        const normalizedCard = {
          ...card,
          icon: card.icon || card.iconName || "",
        };
        const resolved = resolveIconSpec(normalizedCard, card.name || "");
        link.dataset.iconName = resolved.iconName || "";
        const iconNode = document.createElement("i");
        iconNode.className = `${faClass(resolved.style, resolved.icon)} icon`;

        link.appendChild(iconNode);
        fragment.appendChild(link);
      });

      if (isStaleFooterState(state)) return;
      state.contactContainer.appendChild(fragment);
    })
    .catch((err) => console.error("[footer] Error loading contacts:", err));
}

// Integrated footer function that combines "More" and "Contact" sections side by side.
function footer(contactFileURL, contactContainerID, loadId) {
  const footerElement = document.querySelector("footer");
  if (!footerElement) return Promise.resolve();

  const state = createFooterLayout(footerElement, contactContainerID, loadId);
  const { owner, repo } = getRepoConfigFromBody();

  return Promise.all([
    loadMoreSection(state, owner, repo),
    loadContactSection(state, contactFileURL),
  ]);
}
