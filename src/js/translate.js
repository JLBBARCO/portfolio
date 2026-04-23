// Sistema de tradução simples usando JSON
let currentLanguage = "pt-br";
let translations = {};
let supportedLanguages = {};
let supportedLanguageCodes = [];
let defaultLanguage = "pt-br";
// cache nodeLists for efficiency
let _i18nElements = null;
const FLAG_ICON_BASE_URL =
  "https://cdn.jsdelivr.net/npm/country-flag-icons@1.5.21/3x2";

function normalizeLanguageCode(language) {
  const fallbackLanguage =
    window.__deviceLanguagePreference ||
    defaultLanguage ||
    supportedLanguageCodes[0] ||
    "pt-br";
  if (!language) return fallbackLanguage;

  const normalized = String(language).toLowerCase();
  if (supportedLanguages[normalized]) return normalized;

  const base = normalized.split("-")[0];
  const matched = supportedLanguageCodes.find(
    (code) => code.split("-")[0] === base,
  );
  return matched || fallbackLanguage;
}

function resolveLanguageBySupported(language, fallbackLanguage) {
  const fallback =
    fallbackLanguage || defaultLanguage || supportedLanguageCodes[0] || "pt-br";
  if (!language) return fallback;

  const normalized = String(language).toLowerCase();
  if (supportedLanguages[normalized]) return normalized;

  const base = normalized.split("-")[0];
  const matched = supportedLanguageCodes.find(
    (code) => code.split("-")[0] === base,
  );
  return matched || fallback;
}

function getLanguageMeta(language) {
  const normalized = normalizeLanguageCode(language);
  return (
    supportedLanguages[normalized] || {
      code: normalized.split("-")[0].toUpperCase(),
      locale: normalized,
      country: normalized.startsWith("pt") ? "BR" : "US",
      countryName: normalized.startsWith("pt") ? "Brasil" : "United States",
      displayName: normalized.startsWith("pt") ? "Português" : "English",
    }
  );
}

function getLanguageBase(language) {
  return normalizeLanguageCode(language).split("-")[0];
}

function normalizeTranslationPayload(combined) {
  if (combined && combined.languages && combined.translations) {
    return {
      defaultLanguage:
        combined.defaultLanguage ||
        Object.keys(combined.languages)[0] ||
        "pt-br",
      languages: combined.languages,
      translations: combined.translations,
    };
  }

  if (combined && (combined.en || combined.pt)) {
    return {
      defaultLanguage: "pt-br",
      languages: {
        "pt-br": {
          code: "PT",
          locale: "pt-BR",
          country: "BR",
          countryName: "Brasil",
          displayName: "Português (Brasil)",
        },
        "en-us": {
          code: "EN",
          locale: "en-US",
          country: "US",
          countryName: "United States",
          displayName: "English (United States)",
        },
      },
      translations: {
        "pt-br": combined.pt || {},
        "en-us": combined.en || {},
      },
    };
  }

  return null;
}

function getDeviceLanguageRaw() {
  return String(
    navigator.language || navigator.userLanguage || "",
  ).toLowerCase();
}

// previously there were helper functions to read/write cookies; the
// language preference is now stored in localStorage instead, so those are
// no longer needed.

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

// Carrega as traduções do arquivo unificado strings.json
function loadTranslations() {
  return fetchJsonWithFallback("src/json/translate/strings.json")
    .then((combined) => {
      const normalized = normalizeTranslationPayload(combined);
      if (!normalized) {
        throw new Error(
          "Invalid translation file format. Expected { languages: {...}, translations: {...} }",
        );
      }

      supportedLanguages = {};
      supportedLanguageCodes = [];
      Object.entries(normalized.languages || {}).forEach(([code, meta]) => {
        const normalizedCode = String(code).toLowerCase();
        const resolvedMeta = meta || {};
        supportedLanguages[normalizedCode] = {
          code: resolvedMeta.code || normalizedCode.split("-")[0].toUpperCase(),
          locale: resolvedMeta.locale || normalizedCode,
          country:
            resolvedMeta.country ||
            (normalizedCode.startsWith("pt") ? "BR" : "US"),
          countryName:
            resolvedMeta.countryName ||
            resolvedMeta.displayName ||
            (normalizedCode.startsWith("pt") ? "Brasil" : "United States"),
          displayName:
            resolvedMeta.displayName ||
            resolvedMeta.countryName ||
            normalizedCode,
        };
        supportedLanguageCodes.push(normalizedCode);
      });

      translations = {};
      Object.entries(normalized.translations || {}).forEach(([code, value]) => {
        translations[String(code).toLowerCase()] = value || {};
      });

      if (!supportedLanguageCodes.length) {
        throw new Error("No supported languages found in translation file.");
      }

      supportedLanguageCodes.forEach((languageCode) => {
        if (!translations[languageCode]) translations[languageCode] = {};
      });

      defaultLanguage = resolveLanguageBySupported(
        normalized.defaultLanguage || "pt-br",
        "pt-br",
      );

      const deviceLanguagePreference = resolveLanguageBySupported(
        getDeviceLanguageRaw(),
        defaultLanguage,
      );

      // sincroniza chaves (preenchendo com a outra língua quando faltar)
      const allKeys = new Set();
      supportedLanguageCodes.forEach((languageCode) => {
        Object.keys(translations[languageCode] || {}).forEach((key) =>
          allKeys.add(key),
        );
      });

      allKeys.forEach((key) => {
        let fallbackValue = "";
        for (const languageCode of supportedLanguageCodes) {
          if (translations[languageCode] && key in translations[languageCode]) {
            const value = translations[languageCode][key];
            if (typeof value === "string" && value) {
              fallbackValue = value;
              break;
            }
          }
        }
        supportedLanguageCodes.forEach((languageCode) => {
          if (!(key in translations[languageCode])) {
            translations[languageCode][key] = fallbackValue || "";
          }
        });
      });

      // Preserve templates with placeholders for dynamic replacement.
      window.__translationTemplates = {};
      supportedLanguageCodes.forEach((languageCode) => {
        const meta = getLanguageMeta(languageCode);
        window.__translationTemplates[languageCode] =
          translations[languageCode].meta_last_update ||
          (getLanguageBase(languageCode) === "pt"
            ? "Última atualização: {{date}}"
            : "Last Update: {{date}}");
        if (!meta.locale) {
          supportedLanguages[languageCode].locale =
            getLanguageBase(languageCode) === "pt" ? "pt-BR" : "en-US";
        }
      });

      window.__deviceLanguagePreference = deviceLanguagePreference;

      let savedLanguage;
      try {
        savedLanguage = localStorage.getItem("language");
      } catch (err) {
        console.warn("localStorage unavailable when reading language:", err);
        savedLanguage = null;
      }
      currentLanguage = normalizeLanguageCode(
        savedLanguage || deviceLanguagePreference,
      );

      applyTranslations(currentLanguage, { emitLanguageChanged: false });
      renderLanguageDropdown();
      bindLanguageDropdown();
      updateLanguageSelector();
      setCVLink(currentLanguage);

      if (window.__lastUpdateRawDate) {
        window.setTranslationDate(window.__lastUpdateRawDate);
      }

      window.dispatchEvent(new Event("translationsReady"));

      window.dumpTranslations = function () {
        console.log(
          "Translation template:\n",
          JSON.stringify(
            { languages: supportedLanguages, translations },
            null,
            2,
          ),
        );
      };
    })
    .catch((error) => {
      console.error("Erro ao carregar traduções:", error);
    });
}

window.setTranslationDate = function (rawDate) {
  if (!rawDate && window.__lastUpdateRawDate)
    rawDate = window.__lastUpdateRawDate;
  if (!rawDate) return;

  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);

  // ✅ CORRIGIDO - Validação adequada de data
  if (isNaN(date.getTime())) {
    console.warn("Data inválida fornecida:", rawDate);
    return;
  }

  const formattedByLanguage = {};
  supportedLanguageCodes.forEach((languageCode) => {
    const meta = getLanguageMeta(languageCode);
    const locale =
      meta.locale ||
      (getLanguageBase(languageCode) === "pt" ? "pt-BR" : "en-US");
    formattedByLanguage[languageCode] = date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  supportedLanguageCodes.forEach((languageCode) => {
    if (!translations[languageCode]) translations[languageCode] = {};
    const template =
      (window.__translationTemplates &&
        window.__translationTemplates[languageCode]) ||
      translations[languageCode].meta_last_update ||
      (getLanguageBase(languageCode) === "pt"
        ? "Última atualização: {{date}}"
        : "Last Update: {{date}}");

    translations[languageCode].meta_last_update = template.replace(
      /\{\{date\}\}/g,
      formattedByLanguage[languageCode],
    );
  });

  const el = document.getElementById("lastUpdate");
  if (el) {
    el.textContent =
      (translations[currentLanguage] &&
        translations[currentLanguage].meta_last_update) ||
      "";
  }

  const currentFormatted =
    formattedByLanguage[currentLanguage] ||
    formattedByLanguage[defaultLanguage] ||
    "";
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
  );
  const nodes = [];
  while (walker.nextNode()) {
    if (
      walker.currentNode.nodeValue &&
      walker.currentNode.nodeValue.includes("{{date}}")
    )
      nodes.push(walker.currentNode);
  }
  nodes.forEach((n) => {
    n.nodeValue = n.nodeValue.replace(/\{\{date\}\}/g, currentFormatted);
  });
};

function t(key) {
  if (translations[currentLanguage] && key in translations[currentLanguage]) {
    return translations[currentLanguage][key];
  }
  if (translations[defaultLanguage] && key in translations[defaultLanguage]) {
    return translations[defaultLanguage][key];
  }
  return key;
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

function applyTranslations(language, options) {
  const emitLanguageChanged = !(
    options && options.emitLanguageChanged === false
  );
  currentLanguage = normalizeLanguageCode(language);
  const currentMeta = getLanguageMeta(currentLanguage);
  document.documentElement.lang = currentMeta.locale || currentLanguage;
  try {
    try {
      localStorage.setItem("language", currentLanguage);
    } catch (e) {
      console.warn("localStorage unavailable when saving language:", e);
    }
  } catch (e) {
    console.warn("Unable to persist language selection:", e);
  }
  updateLanguageSelector();

  // Always refresh i18n elements to include dynamically created content
  _i18nElements = document.querySelectorAll("[data-i18n]");
  _i18nElements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translation = t(key);
    // if caller specified a particular attribute to update (e.g. aria-label)
    const attr = element.getAttribute("data-i18n-attr");
    if (attr) {
      element.setAttribute(attr, translation);
      return;
    }

    const tag = element.tagName;
    if (tag === "TITLE") {
      document.title = translation;
      element.textContent = translation;
      return;
    }
    if (tag === "INPUT" || tag === "TEXTAREA") {
      element.value = translation;
      element.placeholder = translation;
    } else {
      setTextPreserveSpans(element, translation);
    }
  });

  fillReusableTitles();

  // also update known aria-labels that are not captured by data-i18n
  const ariaMap = {
    "menu-button": "aria_toggle_menu",
    "increase-font": "aria_increase_font",
    "decrease-font": "aria_decrease_font",
    "reset-font": "aria_reset_font",
    "back-to-top": "aria_back_to_top",
    linkDownloadCV: "action_download_cv",
  };
  Object.entries(ariaMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      const label = t(key);
      el.setAttribute("aria-label", label);
      if (el.hasAttribute("title")) {
        el.setAttribute("title", label);
      }
    }
  });

  if (emitLanguageChanged) {
    window.dispatchEvent(
      new CustomEvent("languageChanged", {
        detail: { language: document.documentElement.lang },
      }),
    );
  }
}

function updateLanguageSelector() {
  const option = getLanguageMeta(currentLanguage);
  const languageBtn = document.getElementById("languageBtn");
  const currentText = document.getElementById("languageCurrentText");
  const currentFlag = document.getElementById("languageCurrentFlag");
  const languageDropdown = document.getElementById("languageDropdown");

  if (languageBtn) {
    languageBtn.setAttribute(
      "aria-label",
      option.displayName || option.locale || currentLanguage,
    );
  }

  if (currentText) {
    currentText.textContent = option.code;
  }

  if (currentFlag) {
    currentFlag.src = `${FLAG_ICON_BASE_URL}/${option.country}.svg`;
    currentFlag.alt = option.country;
    currentFlag.classList.remove("is-hidden");
  }

  const currentFallback = document.getElementById("languageCurrentFallback");
  if (currentFallback) {
    currentFallback.textContent =
      option.countryName || option.displayName || option.locale;
    currentFallback.classList.remove("is-visible");
  }

  const menuOptions = document.querySelectorAll(
    ".language-option[data-language]",
  );
  menuOptions.forEach((menuOption) => {
    const isSelected =
      normalizeLanguageCode(menuOption.dataset.language) === currentLanguage;
    menuOption.classList.toggle("is-active", isSelected);
    menuOption.setAttribute("aria-checked", isSelected ? "true" : "false");

    const optionFlag = menuOption.querySelector(".language-flag");
    const optionFallback = menuOption.querySelector(".language-flag-fallback");
    if (optionFlag) {
      optionFlag.classList.remove("is-hidden");
    }
    if (optionFallback) {
      optionFallback.classList.remove("is-visible");
    }
  });

  if (languageDropdown) {
    languageDropdown.classList.remove("is-open");
  }

  if (languageBtn) {
    languageBtn.setAttribute("aria-expanded", "false");
  }
}

function setCVLink(language) {
  const downloadCV = document.getElementById("linkDownloadCV");
  if (!downloadCV) return;
  const linkToCV =
    getLanguageBase(language) === "pt"
      ? "https://docs.google.com/document/d/155TwYXH4HsTpv7LjGJDIkfX_zpsXXFUc/export?format=pdf"
      : "https://docs.google.com/document/d/1cCq1NBFGyd4UfvSOWplguJuYAvBQHdt5/export?format=pdf";
  // update aria-label in case language changed outside of applyTranslations
  downloadCV.setAttribute("aria-label", t("action_download_cv"));

  // usa fetchAny (definida em script.js)
  fetchAny(linkToCV)
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

function renderLanguageDropdown() {
  const languageDropdown = document.getElementById("languageDropdown");
  if (!languageDropdown || !supportedLanguageCodes.length) return;

  languageDropdown.innerHTML = "";
  languageDropdown.dataset.renderedLanguages = supportedLanguageCodes.join(",");

  supportedLanguageCodes.forEach((languageCode) => {
    const meta = getLanguageMeta(languageCode);
    const option = document.createElement("button");
    option.type = "button";
    option.className = "language-option";
    option.setAttribute("role", "menuitemradio");
    option.dataset.language = languageCode;
    option.setAttribute(
      "aria-checked",
      normalizeLanguageCode(languageCode) === currentLanguage
        ? "true"
        : "false",
    );
    option.setAttribute(
      "aria-label",
      meta.displayName || meta.locale || languageCode,
    );

    const optionText = document.createElement("span");
    optionText.className = "language-option-text";
    optionText.textContent = `${(meta.code || languageCode.split("-")[0]).toUpperCase()}`;

    const optionDash = document.createElement("span");
    optionDash.textContent = " - ";
    optionDash.className = "language-option-dash";

    const optionFlag = document.createElement("img");
    optionFlag.className = "language-flag";
    optionFlag.src = `${FLAG_ICON_BASE_URL}/${meta.country || "US"}.svg`;
    optionFlag.alt = meta.country || languageCode;
    optionFlag.width = 24;
    optionFlag.height = 16;

    const optionFallback = document.createElement("span");
    optionFallback.className = "language-flag-fallback";
    optionFallback.textContent =
      meta.countryName || meta.displayName || languageCode;

    optionFlag.addEventListener("error", () => {
      optionFlag.classList.add("is-hidden");
      optionFallback.classList.add("is-visible");
    });

    option.append(optionText, optionDash, optionFlag, optionFallback);
    languageDropdown.appendChild(option);
  });
}

function bindLanguageDropdown() {
  const languageButton = document.getElementById("languageBtn");
  const languageDropdown = document.getElementById("languageDropdown");
  if (!languageButton || !languageDropdown) {
    return;
  }

  if (
    supportedLanguageCodes.length &&
    languageDropdown.dataset.renderedLanguages !==
      supportedLanguageCodes.join(",")
  ) {
    renderLanguageDropdown();
  }

  const languageOptions = document.querySelectorAll(
    ".language-option[data-language]",
  );

  if (!languageButton || !languageDropdown || languageOptions.length === 0) {
    return;
  }

  if (!languageButton.dataset.boundDropdown) {
    languageButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = languageDropdown.classList.toggle("is-open");
      languageButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    languageButton.dataset.boundDropdown = "true";
  }

  languageOptions.forEach((option) => {
    if (option.dataset.boundLanguageOption) return;
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      const selectedLanguage = option.dataset.language;
      if (selectedLanguage) {
        changeLanguage(selectedLanguage);
      }
      languageDropdown.classList.remove("is-open");
      languageButton.setAttribute("aria-expanded", "false");
    });
    option.dataset.boundLanguageOption = "true";
  });

  if (!document.body.dataset.boundLanguageOutsideClick) {
    document.addEventListener("click", (event) => {
      const navLanguage = document.querySelector(".nav-language");
      if (!navLanguage || navLanguage.contains(event.target)) return;
      const dropdown = document.getElementById("languageDropdown");
      const button = document.getElementById("languageBtn");
      if (dropdown) dropdown.classList.remove("is-open");
      if (button) button.setAttribute("aria-expanded", "false");
    });
    document.body.dataset.boundLanguageOutsideClick = "true";
  }

  if (!document.body.dataset.boundLanguageEscape) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const dropdown = document.getElementById("languageDropdown");
      const button = document.getElementById("languageBtn");
      if (!dropdown || !button) return;
      dropdown.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      button.focus();
    });
    document.body.dataset.boundLanguageEscape = "true";
  }
}

function changeLanguage(language) {
  let normalizedLanguage;

  if (typeof language === "string" && language) {
    normalizedLanguage = normalizeLanguageCode(language);
  } else if (supportedLanguageCodes.length > 1) {
    const currentIndex = supportedLanguageCodes.indexOf(currentLanguage);
    normalizedLanguage =
      supportedLanguageCodes[
        (currentIndex + 1) % supportedLanguageCodes.length
      ] || defaultLanguage;
  } else {
    normalizedLanguage = defaultLanguage;
  }

  applyTranslations(normalizedLanguage);
  setCVLink(normalizedLanguage);

  if (window.__lastUpdateRawDate) {
    window.setTranslationDate(window.__lastUpdateRawDate);
  }
}

function fillReusableTitles() {
  const titleMap = {
    "title-technologies": "section_technologies_title",
    "title-links": "block_links_title",
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

window.addEventListener("dynamicContentReady", () => {
  fillReusableTitles();

  // Dynamic sections are created after initial page load.
  // Re-apply i18n without firing languageChanged to avoid render loops.
  if (supportedLanguageCodes.length && translations[currentLanguage]) {
    applyTranslations(currentLanguage, { emitLanguageChanged: false });
    renderLanguageDropdown();
    setCVLink(currentLanguage);
    if (window.__lastUpdateRawDate) {
      window.setTranslationDate(window.__lastUpdateRawDate);
    }
  }
});
