function header() {
  const body = document.querySelector("body");
  if (!body) return;

  const existingHeader = body.querySelector("header");
  if (existingHeader) existingHeader.remove();

  const header = document.createElement("header");

  const navTitle = document.createElement("nav");
  const linkNavTitle = document.createElement("a");
  linkNavTitle.href = "#Home";
  const titleNavTitle = document.createElement("h1");
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

  const languageButton = document.createElement("button");
  languageButton.id = "languageBtn";
  languageButton.className = "language";
  languageButton.ariaLabel = "pt-br";
  const languageIcon = document.createElement("i");
  languageIcon.className = "fa-solid fa-globe icon";
  languageButton.append(languageIcon);
  navLanguage.appendChild(languageButton);

  header.appendChild(navLanguage);

  body.prepend(header);
}
