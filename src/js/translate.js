// Sistema de tradução simples usando JSON
let currentLanguage = "pt";
let translations = {};
// cache nodeLists for efficiency
let _i18nElements = null;

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
      if (!combined || !combined.en || !combined.pt) {
        throw new Error(
          "Invalid translation file format. Expected { en: {...}, pt: {...} }",
        );
      }

      translations.en = combined.en;
      translations.pt = combined.pt;

      // sincroniza chaves (preenchendo com a outra língua quando faltar)
      const allKeys = new Set([
        ...Object.keys(translations.en || {}),
        ...Object.keys(translations.pt || {}),
      ]);
      allKeys.forEach((k) => {
        if (!(k in translations.en))
          translations.en[k] = translations.pt[k] || "";
        if (!(k in translations.pt))
          translations.pt[k] = translations.en[k] || "";
      });

      // Preserve templates with placeholders for dynamic replacement.
      window.__translationTemplates = {
        en: translations.en.meta_last_update || "Last Update: {{date}}",
        pt: translations.pt.meta_last_update || "Última atualização: {{date}}",
      };

      let savedLanguage;
      try {
        savedLanguage = localStorage.getItem("language");
      } catch (err) {
        console.warn("localStorage unavailable when reading language:", err);
        savedLanguage = null;
      }
      if (savedLanguage === "pt" || savedLanguage === "en") {
        currentLanguage = savedLanguage;
      } else {
        const navLang = (navigator.language || "").toLowerCase();
        currentLanguage = navLang.startsWith("pt") ? "pt" : "en";
      }

      const languageBtn = document.getElementById("languageBtn");
      if (languageBtn) {
        const newAria = currentLanguage === "pt" ? "pt-br" : "en-us";
        languageBtn.setAttribute("aria-label", newAria);
      }

      applyTranslations(currentLanguage, { emitLanguageChanged: false });
      updateLanguageSelector();
      setCVLink(currentLanguage);

      if (window.__lastUpdateRawDate) {
        window.setTranslationDate(window.__lastUpdateRawDate);
      }

      window.dispatchEvent(new Event("translationsReady"));

      window.dumpTranslations = function () {
        console.log(
          "Translation template:\n",
          JSON.stringify({ en: translations.en, pt: translations.pt }, null, 2),
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
    (window.__translationTemplates && window.__translationTemplates.en) ||
    (translations.en && translations.en.meta_last_update) ||
    "Last Update: {{date}}";
  const templatePt =
    (window.__translationTemplates && window.__translationTemplates.pt) ||
    (translations.pt && translations.pt.meta_last_update) ||
    "Última atualização: {{date}}";

  if (!translations.en) translations.en = {};
  if (!translations.pt) translations.pt = {};

  translations.en.meta_last_update = templateEn.replace(
    /\{\{date\}\}/g,
    formatted.en,
  );
  translations.pt.meta_last_update = templatePt.replace(
    /\{\{date\}\}/g,
    formatted.pt,
  );

  const el = document.getElementById("lastUpdate");
  if (el) {
    el.textContent =
      (translations[currentLanguage] &&
        translations[currentLanguage].meta_last_update) ||
      "";
  }

  const currentFormatted =
    currentLanguage === "pt" ? formatted.pt : formatted.en;
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
  currentLanguage = language.startsWith("pt") ? "pt" : "en";
  document.documentElement.lang = currentLanguage === "pt" ? "pt-BR" : "en-US";
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
  const languageMenu = document.getElementById("language-menu");
  if (!languageMenu) return;
  languageMenu.value = currentLanguage === "pt" ? "pt-BR" : "en-US";
}

function setCVLink(language) {
  const downloadCV = document.getElementById("linkDownloadCV");
  if (!downloadCV) return;
  const linkToCV =
    language === "pt"
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

// 🔧 CORREÇÃO: Função changeLanguage totalmente reescrita
function changeLanguage() {
  const languageBtn = document.getElementById("languageBtn");
  if (!languageBtn) return;

  // Alternar entre pt e en baseado no idioma atual
  const newLanguage = currentLanguage === "pt" ? "en" : "pt";
  const newAriaLabel = newLanguage === "pt" ? "pt-br" : "en-us";

  // Atualizar o atributo aria-label do botão
  languageBtn.setAttribute("aria-label", newAriaLabel);

  // Aplicar as novas traduções
  applyTranslations(newLanguage);

  // Atualizar o link do CV
  setCVLink(newLanguage);

  // Se a data foi carregada, atualizar a data também
  if (window.__lastUpdateRawDate) {
    window.setTranslationDate(window.__lastUpdateRawDate);
  }

  console.log(
    `Idioma alterado para: ${newLanguage === "pt" ? "Português" : "English"}`,
  );
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
  if (translations.en && translations.pt) {
    applyTranslations(currentLanguage, { emitLanguageChanged: false });
    setCVLink(currentLanguage);
    if (window.__lastUpdateRawDate) {
      window.setTranslationDate(window.__lastUpdateRawDate);
    }
  }
});
