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
  const containers = document.querySelectorAll("main>section");

  const navI18nKeyBySectionId = {
    Home: "nav_home",
    Projects: "nav_projects",
    Technologies: "nav_technologies",
    AboutMe: "nav_about_me",
    Formations: "nav_formations",
    Contact: "nav_contact",
    More: "nav_more",
  };

  const navFallbackTextBySectionId = {
    Home: { pt: "Inicio", en: "Home" },
    Projects: { pt: "Projetos", en: "Projects" },
    Technologies: { pt: "Tecnologias", en: "Technologies" },
    AboutMe: { pt: "Sobre mim", en: "About me" },
    Formations: { pt: "Formacoes", en: "Formations" },
    Contact: { pt: "Contato", en: "Contact" },
    More: { pt: "Mais", en: "More" },
  };

  const docLang = (document.documentElement.lang || "pt-BR").toLowerCase();
  const locale = docLang.startsWith("pt") ? "pt" : "en";

  containers.forEach((container) => {
    const containerId = container.id;

    if (containerId) {
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
    }
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
  const currentLanguageCode = docLangForButton === "pt" ? "PT" : "EN";
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
  languageButton.setAttribute("aria-label", currentLanguageCode);

  const languageCurrentText = document.createElement("span");
  languageCurrentText.id = "languageCurrentText";
  languageCurrentText.className = "language-current-text";
  languageCurrentText.textContent = currentLanguageCode;

  const languageCurrentFlag = document.createElement("img");
  languageCurrentFlag.id = "languageCurrentFlag";
  languageCurrentFlag.className = "language-flag";
  languageCurrentFlag.src = `https://cdn.jsdelivr.net/npm/country-flag-icons@1.5.21/3x2/${currentLanguageCountry}.svg`;
  languageCurrentFlag.alt = currentLanguageCountry;
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
    languageCurrentText,
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
