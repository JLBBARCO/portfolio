function header() {
  const body = document.querySelector("body");
  if (!body) return;

  const existingHeader = body.querySelector("header");
  if (existingHeader) existingHeader.remove();

  const header = document.createElement("header");

  const navTitle = document.createElement("nav");
  const linkNavTitle = document.createElement("a");
  linkNavTitle.href = "#Home";
  const titleNavTitle = document.createElement("h3");
  titleNavTitle.innerHTML = "JLBBARCO";
  linkNavTitle.append(titleNavTitle);
  navTitle.append(linkNavTitle);
  header.appendChild(navTitle);

  const navMenu = document.createElement("nav");
  navMenu.className = "nav-menu";

  const menuButton = document.createElement("button");
  menuButton.id = "menu-button";
  menuButton.setAttribute("data-i18n", "aria_toggle_menu");
  menuButton.setAttribute("data-i18n-attr", "aria-label");
  menuButton.ariaExpanded = false;
  menuButton.ariaControls = "nav-links";

  const menuIcon = document.createElement("i");
  menuIcon.id = "menuIcon";
  menuIcon.className = "fa-solid fa-bars icon";
  menuIcon.style.color = "#fff";

  menuButton.append(menuIcon);
  navMenu.appendChild(menuButton);

  const navLinks = document.createElement("div");
  navLinks.id = "nav-links";
  navLinks.className = "nav-links";
  const sectionIds = Array.from(document.querySelectorAll("main>section"))
    .map((section) => section.id)
    .filter(Boolean);
  if (!sectionIds.includes("Contact")) sectionIds.push("Contact");
  const sectionOrder = [
    "Home",
    "Projects",
    "Technologies",
    "About_Me",
    "Formation",
    "Curses",
    "Contact",
  ];
  sectionIds.sort((a, b) => {
    const indexA = sectionOrder.indexOf(a);
    const indexB = sectionOrder.indexOf(b);
    return (
      (indexA < 0 ? sectionOrder.length : indexA) -
      (indexB < 0 ? sectionOrder.length : indexB)
    );
  });

  const navI18nKeyBySectionId = {
    Home: "nav_home",
    Projects: "nav_projects",
    Technologies: "nav_technologies",
    AboutMe: "nav_about_me",
    About_Me: "nav_about_me",
    Formation: "nav_formation",
    Formations: "nav_formation",
    Curses: "nav_curses",
    Courses: "nav_curses",
    Contact: "nav_contact",
    More: "nav_more",
  };

  const navFallbackTextBySectionId = {
    Home: { pt: "Início", en: "Home" },
    Projects: { pt: "Projetos", en: "Projects" },
    Technologies: { pt: "Tecnologias", en: "Technologies" },
    AboutMe: { pt: "Sobre mim", en: "About me" },
    About_Me: { pt: "Sobre mim", en: "About me" },
    Formation: { pt: "Formação", en: "Education" },
    Formations: { pt: "Formação", en: "Education" },
    Curses: { pt: "Cursos", en: "Courses" },
    Courses: { pt: "Cursos", en: "Courses" },
    Contact: { pt: "Contato", en: "Contact" },
    More: { pt: "Mais", en: "More" },
  };

  const docLang = (document.documentElement.lang || "pt-BR").toLowerCase();
  const locale = docLang.startsWith("pt") ? "pt" : "en";

  sectionIds.forEach((containerId) => {
    const link = document.createElement("a");
    link.href = `#${containerId}`;
    link.className = "links";
    const i18nKey = navI18nKeyBySectionId[containerId];
    if (i18nKey) {
      link.setAttribute("data-i18n", i18nKey);
      const fallback = navFallbackTextBySectionId[containerId];
      link.textContent = fallback ? fallback[locale] : containerId;
    } else {
      link.textContent = containerId;
    }

    navLinks.appendChild(link);
  });

  navLinks.addEventListener("click", (event) => {
    if (
      !event.target.closest("a") ||
      menuButton.getAttribute("aria-expanded") !== "true"
    ) {
      return;
    }

    navLinks.style.display = "none";
    menuButton.setAttribute("aria-expanded", "false");
    menuIcon.classList.remove("fa-xmark", "fa-close", "fa-menu");
    menuIcon.classList.add("fa-bars");
  });

  navMenu.appendChild(navLinks);
  header.appendChild(navMenu);

  const navLanguage = document.createElement("nav");
  navLanguage.className = "nav-language";

  const docLangForButton = (document.documentElement.lang || "pt-BR")
    .toLowerCase()
    .startsWith("pt")
    ? "pt"
    : "en";
  const currentLanguageCountry = docLangForButton === "pt" ? "BR" : "US";
  const currentLanguageCountryName =
    docLangForButton === "pt" ? "Brasil" : "United States";

  function handleFlagFallback(flagImage, fallbackText) {
    if (!flagImage || !fallbackText) return;

    flagImage.addEventListener("error", () => {
      flagImage.classList.add("is-hidden");
      fallbackText.classList.add("is-visible");
    });
  }

  const languageButton = document.createElement("button");
  languageButton.id = "languageBtn";
  languageButton.className = "language";
  languageButton.type = "button";
  languageButton.setAttribute("aria-haspopup", "menu");
  languageButton.setAttribute("aria-expanded", "false");
  languageButton.setAttribute("aria-controls", "languageDropdown");

  const languageCurrentFlag = document.createElement("img");
  languageCurrentFlag.id = "languageCurrentFlag";
  languageCurrentFlag.className = "language-flag";
  // Link e texto alternativo vem de src/json/areas/images.json.
  if (typeof applyFlagIcon === "function") {
    applyFlagIcon(languageCurrentFlag, currentLanguageCountry);
  }
  languageCurrentFlag.alt =
    window.SiteImages && typeof window.SiteImages.flagAltSync === "function"
      ? window.SiteImages.flagAltSync(currentLanguageCountry)
      : currentLanguageCountry;
  languageCurrentFlag.width = 24;
  languageCurrentFlag.height = 16;

  const languageCurrentFallback = document.createElement("span");
  languageCurrentFallback.id = "languageCurrentFallback";
  languageCurrentFallback.className = "language-flag-fallback";
  languageCurrentFallback.textContent = currentLanguageCountryName;

  handleFlagFallback(languageCurrentFlag, languageCurrentFallback);

  const languageCaret = document.createElement("i");
  languageCaret.className = "fa-solid fa-chevron-down language-caret";
  languageCaret.setAttribute("aria-hidden", "true");

  languageButton.append(
    languageCurrentFlag,
    languageCurrentFallback,
    languageCaret,
  );

  const languageDropdown = document.createElement("div");
  languageDropdown.id = "languageDropdown";
  languageDropdown.className = "language-dropdown";
  languageDropdown.setAttribute("role", "menu");
  languageDropdown.setAttribute("aria-label", "Language options");

  navLanguage.append(languageButton, languageDropdown);

  header.appendChild(navLanguage);

  body.prepend(header);
}
