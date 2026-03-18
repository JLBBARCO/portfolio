// unique identifier for the most recent dynamic-content load; used to
// ignore stale async results (e.g. user switched language mid-load).
let _currentLoadId = 0;

// Helper para normalizar classes do Font Awesome
function faClass(style, icon, size) {
  let styleClass = style || "fa-solid";
  if (styleClass && !styleClass.startsWith("fa-"))
    styleClass = `fa-${styleClass}`;
  let iconClass = icon || "";
  if (iconClass && !iconClass.startsWith("fa-")) iconClass = `fa-${iconClass}`;
  let sizeClass = size || "";
  if (sizeClass && !sizeClass.startsWith("fa-")) sizeClass = `fa-${sizeClass}`;
  return [styleClass, iconClass, sizeClass].filter(Boolean).join(" ");
}

// try to guess a FontAwesome icon based on a technology name.  returns
// an object { style, icon } or null if no matching icon could be found.
// caching the result avoids repeated DOM manipulations.
const _faGuessCache = {};
// some common technology names don't match the FontAwesome class.  e.g.
// "html" → "html5", "javascript" → "js".  when the direct lookup fails we
// consult this alias table and try again once more.
const _faAliasMap = {
  javascript: "js",
  html: "html5",
  css: "css3",
  "c#": "csharp",
  "c++": "cplusplus",
  node: "node-js",
  // handle the different ways people write "Node.js"
  nodejs: "node-js",
  typescript: "typescript",
  react: "react",
  vue: "vuejs",
  angular: "angular",
};
function guessFaIcon(name) {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (_faGuessCache[key] !== undefined) return _faGuessCache[key];

  // normalize to a candidate class name (drop spaces, punctuation)
  const candidate = key
    .replace(/\s+/g, "-")
    .replace(/[\+\.#]/g, "")
    .replace(/[^a-z0-9\-]/g, "");
  if (!candidate) {
    _faGuessCache[key] = null;
    return null;
  }

  const styles = ["fa-brands", "fa-solid", "fa-regular"];
  let found = null;
  for (const style of styles) {
    const className = `fa-${candidate}`;
    const i = document.createElement("i");
    i.className = `${style} ${className} fa-test-icon`;
    i.style.position = "absolute";
    i.style.visibility = "hidden";
    document.body.appendChild(i);
    // read computed content to see if FA knows the icon
    const content = window
      .getComputedStyle(i, ":before")
      .getPropertyValue("content");
    document.body.removeChild(i);
    if (content && content !== '""' && content !== "none") {
      found = { style, icon: className };
      break;
    }
  }
  _faGuessCache[key] = found;
  if (!found && _faAliasMap[key]) {
    // recursive call with alias (will hit cache if we've tried it before)
    found = guessFaIcon(_faAliasMap[key]);
    _faGuessCache[key] = found;
  }
  return found;
}

// choose a stack category based on common language/technology names.  the
// returned object has the same shape as the stack entries in projects.json.
function determineStack(name) {
  const lower = (name || "").toLowerCase();
  const front = [
    "html",
    "css",
    "javascript",
    "js",
    "react",
    "vue",
    "angular",
    "sass",
    "scss",
    "bootstrap",
    "tailwind",
  ];
  const back = [
    "python",
    "java",
    "node",
    "nodejs",
    "php",
    "ruby",
    "go",
    "c#",
    "c++",
    "c",
    "rust",
    "kotlin",
    "swift",
  ];
  if (front.some((w) => lower.includes(w)))
    return { id: "frontEnd", "en-US": "Front-end", "pt-BR": "Front-end" };
  if (back.some((w) => lower.includes(w)))
    return { id: "backEnd", "en-US": "Back-end", "pt-BR": "Back-end" };
  return { id: "other", "en-US": "Other", "pt-BR": "Outro" };
}

// Controle de tamanho de fonte
let fontSize = 1;

// fetch com fallback
function fetchAny(...paths) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function next() {
      if (i >= paths.length)
        return reject(new Error("All fetch attempts failed"));
      fetch(paths[i])
        .then((res) => {
          if (res.ok) resolve(res);
          else {
            i++;
            next();
          }
        })
        .catch(() => {
          i++;
          next();
        });
    }
    next();
  });
}

// ============================================================================
// GitHub API helpers
// ============================================================================

/**
 * Retrieve repository list for a user; uses localStorage caching to avoid
 * hammering the unauthenticated rate limit.  The cache expires after one hour.
 * Returns a promise that resolves to the raw array returned by the GitHub API.
 */

function fetchJsonWithFallback(path) {
  const basename = path.split("/").pop();
  return fetchAny(path, basename).then((res) =>
    res.ok
      ? res.json()
      : Promise.reject(new Error(`Fetch failed with status: ${res.status}`)),
  );
}

document.addEventListener("DOMContentLoaded", () => {
  function bindDynamicHeaderControls() {
    const menuButton = document.getElementById("menu-button");
    if (menuButton && !menuButton.dataset.boundToggle) {
      menuButton.addEventListener("click", toggleMenu);
      menuButton.dataset.boundToggle = "true";
    }

    const languageBtn = document.getElementById("languageBtn");
    if (languageBtn && !languageBtn.dataset.boundLanguage) {
      languageBtn.addEventListener("click", changeLanguage);
      languageBtn.dataset.boundLanguage = "true";
    }
  }

  const faviconLink = document.getElementById("favicon");
  const prefersDark =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function updateFavicon(eventOrBool) {
    const isDark =
      typeof eventOrBool === "boolean"
        ? eventOrBool
        : eventOrBool && typeof eventOrBool.matches !== "undefined"
          ? eventOrBool.matches
          : prefersDark
            ? prefersDark.matches
            : false;
    if (!faviconLink) return;
    const newHref = isDark
      ? "src/assets/favicon/code-dark.svg"
      : "src/assets/favicon/code-light.svg";
    faviconLink.href = newHref + "?v=" + Date.now();
  }

  updateFavicon(prefersDark ? prefersDark.matches : false);
  if (prefersDark) {
    if (typeof prefersDark.addEventListener === "function") {
      prefersDark.addEventListener("change", updateFavicon);
    } else if (typeof prefersDark.addListener === "function") {
      prefersDark.addListener(updateFavicon);
    }
  }

  let savedFontSize;
  try {
    savedFontSize = localStorage.getItem("fontSize");
  } catch (e) {
    console.warn("localStorage unavailable when reading fontSize:", e);
    savedFontSize = null;
  }
  if (savedFontSize) {
    document.body.style.fontSize = savedFontSize;
    const parsed = parseFloat(savedFontSize);
    if (!isNaN(parsed)) fontSize = parsed;
  }

  bindDynamicHeaderControls();

  const accessibilityButton = document.getElementById("accessibility-button");
  const increaseFontButton = document.getElementById("increase-font");
  const decreaseFontButton = document.getElementById("decrease-font");
  const resetFontButton = document.getElementById("reset-font");

  if (accessibilityButton)
    accessibilityButton.addEventListener("click", accessibilityToggle);
  if (increaseFontButton)
    increaseFontButton.addEventListener("click", increaseFont);
  if (decreaseFontButton)
    decreaseFontButton.addEventListener("click", decreaseFont);
  if (resetFontButton) resetFontButton.addEventListener("click", resetFont);

  document.addEventListener("click", (event) => {
    const accessibilityMenu = document.getElementById("accessibility-menu");
    if (accessibilityMenu && accessibilityMenu.style.display === "flex") {
      const isClickInsideMenu = accessibilityMenu.contains(event.target);
      const isClickOnButton =
        accessibilityButton && accessibilityButton.contains(event.target);
      if (!isClickInsideMenu && !isClickOnButton) {
        accessibilityMenu.style.display = "none";
        accessibilityMenu.setAttribute("aria-hidden", "true");
        if (accessibilityButton)
          accessibilityButton.setAttribute("aria-expanded", "false");
      }
    }
  });

  function loadDynamicContent() {
    // bump token for this run; any previous promises will become stale
    const myLoadId = ++_currentLoadId;

    // Remove only dynamic sections; keep static Home section intact.
    const dynamicSectionIds = new Set([
      "Projects",
      "Technologies",
      "AboutMe",
      "Formations",
      "Contact",
      "More",
    ]);
    Array.from(document.querySelectorAll("main > section")).forEach((el) => {
      if (dynamicSectionIds.has(el.id)) el.remove();
    });

    Array.from(
      document.querySelectorAll(".filter-container, .btn.prev, .btn.next"),
    ).forEach((el) => el.remove());

    let storedLang;
    try {
      storedLang = localStorage.getItem("language");
    } catch (e) {
      console.warn("localStorage unavailable when reading language:", e);
      storedLang = null;
    }
    const currentLang =
      storedLang || (navigator.language.startsWith("pt") ? "pt" : "en");
    const locale = currentLang === "pt" ? "pt-BR" : "en-US";

    // load projects from GitHub API instead of local json
    const githubOwner = document.body.dataset.githubOwner || "JLBBARCO";
    const pProjects = setupProjects("github", locale, githubOwner, myLoadId);
    const pTechnologies = loadAllTechnologies(locale, myLoadId);
    const pAbout =
      typeof aboutMe === "function"
        ? Promise.resolve(aboutMe())
        : Promise.resolve();
    const pFormations = setupFormations(
      "src/json/areas/formation.json",
      locale,
      myLoadId,
    );
    const pLinks = setIconsContact(
      "src/json/areas/contact.json",
      "contactContainer",
      myLoadId,
    );
    const pIcons = setIconsTechsSite(
      "src/json/areas/techs-this-site.json",
      "techsThisSite",
      myLoadId,
    );
    const pHeader = header();
    const pCardProjectTranslation = translationProjects(locale);

    Promise.all([
      pHeader,
      pProjects,
      pCardProjectTranslation,
      pTechnologies,
      pAbout,
      pFormations,
      pLinks,
      pIcons,
    ])
      .then(() => {
        bindDynamicHeaderControls();

        const menuIcon = document.getElementById("menuIcon");
        if (menuIcon) {
          menuIcon.classList.remove("fa-xmark", "fa-close", "fa-menu");
          if (!menuIcon.classList.contains("fa-bars")) {
            menuIcon.classList.add("fa-bars");
          }
        }

        setupCarouselButtons();
        addNewIcons("src/assets/icons/svg.json");
        initializeProfileImage();
        window.dispatchEvent(new Event("dynamicContentReady"));
      })
      .catch((err) => {
        console.warn("Erro no carregamento dinâmico:", err);
        window.dispatchEvent(new Event("dynamicContentReady"));
      });
  }

  function setupCarouselButtons() {
    const carrosselContainer = document.querySelector(".carrousel");
    if (!carrosselContainer) return;

    const parent = carrosselContainer.parentNode;
    Array.from(parent.querySelectorAll(".btn.prev, .btn.next")).forEach((el) =>
      el.remove(),
    );

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn prev";
    prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
    prevBtn.setAttribute("aria-label", "Previous projects");
    prevBtn.onclick = prevProjects;

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn next";
    nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
    nextBtn.setAttribute("aria-label", "Next projects");
    nextBtn.onclick = nextProjects;

    parent.insertBefore(prevBtn, carrosselContainer);
    parent.appendChild(nextBtn);

    carrosselContainer.addEventListener(
      "wheel",
      function (e) {
        const atStart = carrosselContainer.scrollLeft === 0;
        const atEnd =
          carrosselContainer.scrollLeft + carrosselContainer.clientWidth >=
          carrosselContainer.scrollWidth - 10;

        if ((!atEnd && e.deltaY > 0) || (!atStart && e.deltaY < 0)) {
          e.preventDefault();
          const scrollSpeed = 2;
          carrosselContainer.scrollLeft += e.deltaY * scrollSpeed;
        }
      },
      { passive: false },
    );
  }

  loadDynamicContent();
  window.addEventListener("languageChanged", loadDynamicContent);
});

function calcularIdade() {
  const nascimento = new Date(2008, 8, 24);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

function toggleMenu() {
  const navLinks = document.querySelector(".nav-links");
  const menuIcon = document.getElementById("menuIcon");
  const menuButton = document.getElementById("menu-button");
  if (!navLinks) return;

  const isVisible = window.getComputedStyle(navLinks).display !== "none";
  navLinks.style.display = isVisible ? "none" : "flex";

  if (menuIcon) {
    menuIcon.classList.toggle("fa-bars", isVisible);
    menuIcon.classList.toggle("fa-xmark", !isVisible);
  }
  if (menuButton) menuButton.setAttribute("aria-expanded", !isVisible);
}

function accessibilityToggle() {
  const menu = document.getElementById("accessibility-menu");
  const btn = document.getElementById("accessibility-button");
  if (!menu) return;

  const isVisible = menu.style.display === "flex";
  menu.style.display = isVisible ? "none" : "flex";
  menu.setAttribute("aria-hidden", !isVisible);
  if (btn) {
    btn.setAttribute("aria-expanded", !isVisible);
    if (!isVisible) menu.focus();
  }
}

function updateFontSize(newSize) {
  fontSize = Math.max(0.6, Math.min(3.0, Math.round(newSize * 10) / 10));
  document.body.style.fontSize = fontSize + "em";
  // persist in localStorage instead of cookie
  try {
    localStorage.setItem("fontSize", `${fontSize}em`);
  } catch (e) {
    console.warn("Unable to save fontSize:", e);
  }
}

function increaseFont() {
  updateFontSize(fontSize + 0.1);
}

function decreaseFont() {
  updateFontSize(fontSize - 0.1);
}

function resetFont() {
  updateFontSize(1);
}

function getLocalized(value, language) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    value[language] ||
    value["pt-BR"] ||
    value["en-US"] ||
    value.pt ||
    value.en ||
    Object.values(value)[0] ||
    ""
  );
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converte string de data (MM/AAAA ou AAAA) em timestamp.
 * retorna 0 se a data for inválida ou ausente, facilitando comparações
 * de ordenação.
 * @param {string} dateStr
 * @returns {number}
 */
function parseDate(dateStr) {
  if (!dateStr) return 0;
  const parts = dateStr.split("/");
  if (parts.length === 2) {
    const [month, year] = parts;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1).getTime();
  } else if (parts.length === 1) {
    return new Date(parseInt(parts[0], 10), 0).getTime();
  }
  return 0;
}

function updateFilterButtons(activeFilter) {
  Array.from(document.querySelectorAll(".filter-button")).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === activeFilter);
  });
}

function addNewIcons(linkFile) {
  const basename = String(linkFile || "")
    .split("/")
    .pop();
  const absoluteUrl = linkFile.match(/^https?:\/\//)
    ? linkFile
    : new URL(linkFile, document.baseURI).href;

  // Try absolute path first, then basename fallback for local/dev servers.
  fetchAny(absoluteUrl, linkFile, basename)
    .then((res) =>
      res.ok
        ? res.json()
        : Promise.reject(new Error(`Fetch failed with status: ${res.status}`)),
    )
    .then((data) => {
      if (!data || !Array.isArray(data.icons)) {
        throw new Error("Invalid svg.json format: missing icons array.");
      }
      data.icons.forEach((icon) => {
        if (!icon.class || !icon.svg) return;
        const svg = icon.svg
          .replace(/fill=['"]#[^'"]*['"]/g, "")
          .replace(/stroke=['"]#[^'"]*['"]/g, "");
        Array.from(document.querySelectorAll(`i.${icon.class}`)).forEach(
          (el) => {
            if (el.dataset.svgReplaced === "true") return;

            const wrapper = document.createElement("span");
            wrapper.className = el.className
              .split(/\s+/)
              .filter((c) => c && !c.startsWith("fa-"))
              .join(" ");
            if (!wrapper.className.includes("icon")) {
              wrapper.className = `${wrapper.className} icon`.trim();
            }
            if (el.getAttribute("title")) {
              wrapper.setAttribute("title", el.getAttribute("title"));
            }

            wrapper.innerHTML = svg;
            const s = wrapper.querySelector("svg");
            if (s) {
              s.classList.add("svg-icon");
              s.removeAttribute("width");
              s.removeAttribute("height");
              if (!s.getAttribute("viewBox")) {
                s.setAttribute("viewBox", "0 0 24 24");
              }
              Array.from(
                s.querySelectorAll(
                  "path, circle, rect, line, polygon, ellipse",
                ),
              ).forEach((shape) => {
                if (shape.getAttribute("fill") !== "none") {
                  shape.setAttribute("fill", "currentColor");
                }
                if (shape.getAttribute("stroke")) {
                  shape.setAttribute("stroke", "currentColor");
                }
              });
            }

            wrapper.dataset.svgReplaced = "true";
            el.replaceWith(wrapper);
          },
        );
      });
    })
    .catch((err) => console.error("Erro ao carregar SVGs:", err));
}

function prevProjects() {
  // dynamically compute scroll distance based on the width of a card
  // (plus a little margin) so the carousel stays snappy on different layouts.
  const prevEl = document.getElementById("projectsContainer");
  if (prevEl) prevEl.scrollBy({ left: -300, behavior: "smooth" });
}

function nextProjects() {
  const container = document.getElementById("projectsContainer");
  if (!container) return;
  const card = container.querySelector(".card");
  const delta = card ? card.getBoundingClientRect().width + 16 : 300;
  container.scrollBy({ left: delta, behavior: "smooth" });
}

function getAverageColor(imgElement) {
  if (!imgElement) {
    console.warn("Elemento de imagem não fornecido");
    return { r: 124, g: 77, b: 255 };
  }

  if (imgElement.naturalWidth === 0 || imgElement.naturalHeight === 0) {
    console.warn("Imagem não carregada corretamente");
    return { r: 124, g: 77, b: 255 };
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    console.warn("Contexto canvas não disponível");
    return { r: 124, g: 77, b: 255 };
  }

  canvas.width = imgElement.naturalWidth;
  canvas.height = imgElement.naturalHeight;

  try {
    context.drawImage(imgElement, 0, 0);
  } catch (e) {
    console.warn("Erro ao desenhar imagem no canvas:", e);
    return { r: 124, g: 77, b: 255 };
  }

  try {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let r = 0,
      g = 0,
      b = 0;
    const totalPixels = data.length / 4;

    if (totalPixels === 0) {
      console.warn("Imagem vazia ou inválida");
      return { r: 124, g: 77, b: 255 };
    }

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    return {
      r: Math.round(r / totalPixels),
      g: Math.round(g / totalPixels),
      b: Math.round(b / totalPixels),
    };
  } catch (e) {
    console.warn("Erro ao processar dados da imagem:", e);
    return { r: 124, g: 77, b: 255 };
  }
}

function setCSSVariables(color) {
  const root = document.documentElement;
  root.style.setProperty("--accent", `rgb(${color.r}, ${color.g}, ${color.b})`);
  root.style.setProperty(
    "--accent-transparent",
    `rgba(${color.r}, ${color.g}, ${color.b}, 0.67)`,
  );
  const hoverR = Math.max(0, color.r - 30),
    hoverG = Math.max(0, color.g - 30),
    hoverB = Math.max(0, color.b - 30);
  root.style.setProperty(
    "--hover-accent",
    `rgb(${hoverR}, ${hoverG}, ${hoverB})`,
  );
}

function initializeProfileImage() {
  const img = document.getElementById("profile");
  if (!img) return;

  function applyAverageColor() {
    const avgColor = getAverageColor(img);
    setCSSVariables(avgColor);
  }

  if (img.complete && img.naturalHeight !== 0) {
    applyAverageColor();
  } else {
    img.addEventListener("load", applyAverageColor);
    img.addEventListener("error", () => {
      console.warn("Erro ao carregar a imagem do perfil");
      setCSSVariables({ r: 124, g: 77, b: 255 });
    });
  }
}
