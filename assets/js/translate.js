// Sistema de tradução simples usando JSON
let currentLanguage = "pt";
let translations = {};

// Função para obter cookie por nome
function getCookie(name) {
  const nameEQ = name + "=";
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length);
    }
  }
  return null;
}

// Função para definir cookie
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// fetch com fallback: tenta múltiplos caminhos até obter sucesso
function fetchAny(...paths) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function next() {
      if (i >= paths.length) return reject(new Error("No path found"));
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

function fetchJsonWithFallback(path) {
  const basename = path.split("/").pop();
  return fetchAny(path, basename).then((res) =>
    res.ok ? res.json() : Promise.reject(res.status),
  );
}

// Sanitizador simples — permite apenas <span class="emphasis"> e texto.
// Remove outros elementos/atributos para evitar injeção.
function sanitizeTranslationHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html;

  const all = template.content.querySelectorAll("*");
  all.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "span") {
      if (!el.classList.contains("emphasis")) {
        const textNode = document.createTextNode(el.textContent);
        el.replaceWith(textNode);
      } else {
        el.className = "emphasis";
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name !== "class") el.removeAttribute(attr.name);
        });
      }
    } else {
      const textNode = document.createTextNode(el.textContent);
      el.replaceWith(textNode);
    }
  });

  return template.innerHTML;
}

// Carrega as traduções (com fallback)
async function loadTranslations() {
  try {
    const [en, pt] = await Promise.all([
      fetchJsonWithFallback("assets/json/translate/en-us.json"),
      fetchJsonWithFallback("assets/json/translate/pt-br.json"),
    ]);

    translations.en = en;
    translations.pt = pt;

    // Preserve templates para reformatar {{date}}
    window.__translationTemplates = {
      en: translations.en?.lastUpdate || "Last Update: {{date}}",
      pt: translations.pt?.lastUpdate || "Última atualização: {{date}}",
    };

    const savedLanguage = getCookie("language");
    if (savedLanguage && (savedLanguage === "pt" || savedLanguage === "en")) {
      currentLanguage = savedLanguage;
    } else {
      const navLang = (
        navigator.language ||
        navigator.userLanguage ||
        ""
      ).toLowerCase();
      currentLanguage = navLang.startsWith("pt") ? "pt" : "en";
    }

    applyTranslations(currentLanguage);
    updateLanguageSelector();
    setCVLink(currentLanguage);

    if (window.__lastUpdateRawDate) {
      window.setTranslationDate?.(window.__lastUpdateRawDate);
    }

    window.dispatchEvent(new Event("translationsReady"));
  } catch (error) {
    console.error("Erro ao carregar traduções:", error);
  }
}

function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

// Aplica texto/HTML com preservação controlada de spans internos.
// Evita duplicar <span class="emphasis"> se a tradução já tiver essa tag.
function setTextPreserveSpans(element, text) {
  // Substitui placeholders de idade: aceita {{age}} e {{year}}
  const age = typeof calcularIdade === "function" ? calcularIdade() : "";
  if (typeof text === "string") {
    text = text.replace(/\{\{age\}\}/g, age).replace(/\{\{year\}\}/g, age);
  }

  const childElements = Array.from(element.children || []);
  const onlySpans =
    childElements.length > 0 &&
    childElements.every((c) => c.tagName.toLowerCase() === "span");

  const hasHTML = typeof text === "string" && /<[^>]+>/.test(text);

  if (hasHTML) {
    const safeHTML = sanitizeTranslationHTML(text);
    const translationHasEmphasis =
      /<span[^>]*class=['"]?emphasis['"]?[^>]*>/i.test(text);

    if (onlySpans && !translationHasEmphasis) {
      const preservedHTML = childElements.map((s) => s.outerHTML).join(" ");
      element.innerHTML = safeHTML + (preservedHTML ? " " + preservedHTML : "");
    } else {
      element.innerHTML = safeHTML;
    }
  } else {
    if (onlySpans) {
      const spans = childElements;
      if (spans.length > 0) {
        const spansHTML = spans.map((s) => s.outerHTML).join(" ");
        element.innerHTML = text + (spansHTML ? " " + spansHTML : "");
      } else {
        element.textContent = text;
      }
    } else {
      let textNode = Array.from(element.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE,
      );
      if (textNode) {
        textNode.nodeValue = text;
      } else {
        element.insertBefore(document.createTextNode(text), element.firstChild);
      }
    }
  }
}

function applyTranslations(language) {
  currentLanguage = language.startsWith("pt") ? "pt" : "en";
  document.documentElement.lang = currentLanguage === "pt" ? "pt-BR" : "en-US";
  setCookie("language", currentLanguage);
  updateLanguageSelector();

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translation = t(key);
    const tag = element.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      element.value = translation;
      element.placeholder = translation;
    } else {
      setTextPreserveSpans(element, translation);
    }
  });

  if (translations[currentLanguage]) {
    Object.keys(translations[currentLanguage]).forEach((key) => {
      const element = document.getElementById(key);
      if (element) {
        if (key === "webTitle") document.title = t(key);
        setTextPreserveSpans(element, t(key));
        if (element.tagName === "A") element.setAttribute("aria-label", t(key));
      }
    });
  }

  fillReusableTitles();

  window.dispatchEvent(
    new CustomEvent("languageChanged", {
      detail: { language: document.documentElement.lang },
    }),
  );
}

function updateLanguageSelector() {
  const languageMenu = document.getElementById("language-menu");
  if (!languageMenu) return;
  languageMenu.value = currentLanguage === "pt" ? "pt-BR" : "en-US";
}

function setCVLink(language) {
  const downloadCV = document.getElementById("linkDownloadCV");
  if (!downloadCV) return;
  const linkToCV =
    language === "pt"
      ? "assets/documents/Curriculo_Jose_Luiz_Bruiani_Barco_pt-BR.pdf"
      : "assets/documents/Resume_Jose_Luiz_Bruiani_Barco_en-US.pdf";

  fetchAny(linkToCV, linkToCV.split("/").pop())
    .then((resp) => {
      if (resp.ok) {
        downloadCV.style.display = "";
        downloadCV.href = linkToCV;
        downloadCV.setAttribute("download", linkToCV.split("/").pop());
      } else {
        downloadCV.style.display = "none";
      }
    })
    .catch(() => {
      downloadCV.style.display = "none";
    });
}

window.setTranslationDate = function (rawDate) {
  if (!rawDate && window.__lastUpdateRawDate)
    rawDate = window.__lastUpdateRawDate;
  if (!rawDate) return;

  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (isNaN(date)) return;

  const formatted = {
    en: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    pt: date.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };

  const templateEn =
    window.__translationTemplates?.en ||
    translations.en?.lastUpdate ||
    "Last Update: {{date}}";
  const templatePt =
    window.__translationTemplates?.pt ||
    translations.pt?.lastUpdate ||
    "Última atualização: {{date}}";

  translations.en = translations.en || {};
  translations.pt = translations.pt || {};
  translations.en.lastUpdate = templateEn.replace(
    /\{\{date\}\}/g,
    formatted.en,
  );
  translations.pt.lastUpdate = templatePt.replace(
    /\{\{date\}\}/g,
    formatted.pt,
  );

  const el = document.getElementById("lastUpdate");
  if (el) el.textContent = translations[currentLanguage]?.lastUpdate || "";

  const currentFormatted =
    currentLanguage === "pt" ? formatted.pt : formatted.en;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
  );
  const nodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeValue?.includes("{{date}}"))
      nodes.push(walker.currentNode);
  }
  nodes.forEach((n) => {
    n.nodeValue = n.nodeValue.replace(/\{\{date\}\}/g, currentFormatted);
  });
};

function changeLanguage() {
  const languageMenu = document.getElementById("language-menu");
  if (!languageMenu) return;
  const selectedLanguage = languageMenu.value;
  applyTranslations(selectedLanguage);
  setCVLink(currentLanguage);
  if (window.__lastUpdateRawDate)
    window.setTranslationDate(window.__lastUpdateRawDate);
}

function fillReusableTitles() {
  const titleMap = {
    "title-technologies": "technologiesTitle",
    "title-links": "linksTitle",
  };
  Object.entries(titleMap).forEach(([className, translationKey]) => {
    const elements = document.querySelectorAll(`.${className}`);
    const translation = t(translationKey);
    elements.forEach((el) => (el.textContent = translation));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  let loaded = false;
  function onceLoad() {
    if (loaded) return;
    loaded = true;
    loadTranslations();
  }
  window.addEventListener("dynamicContentReady", onceLoad, { once: true });
  setTimeout(onceLoad, 500);
});

window.addEventListener("dynamicContentReady", fillReusableTitles);
