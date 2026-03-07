const { createElement } = require("react");

function header() {
  const body = document.querySelector("body");
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
  menuButton["data-i18n"] = "toggle_menu";
  menuButton["data-i18n-attr"] = "aria-label";
  menuButton.ariaExpanded = false;
  menuButton.ariaControls = "nav-links";

  const menuIcon = document.createElement("i");
  menuIcon.id = "menuIcon";
  menuIcon.classList = "fa-solid fa-bars icon";
  menuIcon.style.color = "#fff";

  menuButton.append(menuIcon);
  navMenu.appendChild(menuButton);

  const navLinks = document.createElement("div");
  navLinks.id = "nav-links";
  navLinks.className = "nav-links";
  const containers = document.querySelectorAll("main>section");
  let counter = 0;

  containers.forEach((container) => {
    const containerId = container.id;

    if (containerId) {
      const link = document.createElement("a");
      link.href = `#${containerId}`;
      link.className = "links";
      link.id = `link${counter}`;
      link["data-i18n"] = `link${counter}`;
      link.innerHTML = containerId;

      navLinks.appendChild(link);
      counter += 1;
    }
  });
  navMenu.appendChild(navLinks);
  header.appendChild(navMenu);

  const navLanguage = document.createElement("nav");

  const googleTranslateElement = document.createElement("div");
  googleTranslateElement.id = "google_translate_element";
  googleTranslateElement.style.display = "none";
  navLanguage.append(googleTranslateElement);

  const languageButton = document.createElement("button");
  languageButton.id = "languageBtn";
  languageButton.className = "language";
  languageButton.ariaLabel = "pt-br";
  const languageIcon = document.createElement("i");
  languageIcon.classList = "fa-solid fa-globe icon";
  languageButton.append(languageIcon);
  navLanguage.appendChild(languageButton);

  header.appendChild(navLanguage);

  body.prepend(header);
}
