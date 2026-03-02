// Sistema de tradução simples usando JSON
let currentLanguage = "pt";
let translations = {};
// cache nodeLists for efficiency
let _i18nElements = null;
let _idElements = null;

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

// Carrega as traduções (com fallback)
async function loadTranslations() {
  try {
    // primeiro tente carregar um único arquivo com ambas as línguas.
    // o formato esperado é:
    // { "en": { ... }, "pt": { ... } }
    let en, pt;
    try {
      const combined = await fetchJsonWithFallback(
        "src/json/translate/strings.json",
      );
      if (combined && combined.en && combined.pt) {
        en = combined.en;
        pt = combined.pt;
      } else {
        throw new Error("combined file missing expected keys");
      }
    } catch (e) {
      // se não existir ou estiver malformado, recorra aos arquivos separados
      [en, pt] = await Promise.all([
        fetchJsonWithFallback("src/json/translate/en-us.json"),
        fetchJsonWithFallback("src/json/translate/pt-br.json"),
      ]);
    }

    translations.en = en;
    translations.pt = pt;

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

    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage === "pt" || savedLanguage === "en") {
      currentLanguage = savedLanguage;
    } else {
      const navLang = (
        navigator.language ||
        navigator.userLanguage ||
        ""
      ).toLowerCase();
      currentLanguage = navLang.startsWith("pt") ? "pt" : "en";
    }

    // set initial aria-label for language button
    const languageBtn = document.getElementById("languageBtn");
    if (languageBtn) {
      const newAria = currentLanguage === "pt" ? "pt-br" : "en-us";
      languageBtn.setAttribute("aria-label", newAria);
    }

    applyTranslations(currentLanguage);
    updateLanguageSelector();
    setCVLink(currentLanguage);

    window.dispatchEvent(new Event("translationsReady"));

    // When developing, it's handy to be able to dump the current translation
    // object so you can paste it back into the source file and keep things in
    // sync.
    window.dumpTranslations = function () {
      console.log(
        "Translation template:\n",
        JSON.stringify({ en: translations.en, pt: translations.pt }, null, 2),
      );
    };
  } catch (error) {
    console.error("Erro ao carregar traduções:", error);
  }
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
    window.__translationTemplates?.en ||
    translations.en?.lastUpdate ||
    "Last Update: {{date}}";
  const templatePt =
    window.__translationTemplates?.pt ||
    translations.pt?.lastUpdate ||
    "Última atualização: {{date}}";

  if (!translations.en) translations.en = {};
  if (!translations.pt) translations.pt = {};

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
  try {
    localStorage.setItem("language", currentLanguage);
  } catch (e) {
    console.warn("Unable to persist language selection:", e);
  }
  updateLanguageSelector();

  if (!_i18nElements) {
    _i18nElements = document.querySelectorAll("[data-i18n]");
  }
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
    if (tag === "INPUT" || tag === "TEXTAREA") {
      element.value = translation;
      element.placeholder = translation;
    } else {
      setTextPreserveSpans(element, translation);
    }
  });

  if (translations[currentLanguage]) {
    if (!_idElements) {
      _idElements = {};
      Object.keys(translations[currentLanguage]).forEach((k) => {
        const el = document.getElementById(k);
        if (el) _idElements[k] = el;
      });
    }
    Object.entries(_idElements).forEach(([key, element]) => {
      if (key === "webTitle") document.title = t(key);
      setTextPreserveSpans(element, t(key));
      if (element.tagName === "A") element.setAttribute("aria-label", t(key));
    });
  }

  fillReusableTitles();

  // also update known aria-labels that are not captured by data-i18n
  const ariaMap = {
    "menu-button": "toggle_menu",
    "increase-font": "increase_font",
    "decrease-font": "decrease_font",
    "reset-font": "reset_font",
    linkDownloadCV: "downloadCVTitle",
  };
  Object.entries(ariaMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("aria-label", t(key));
  });

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
      ? "src/assets/documents/Curriculo_Jose_Luiz_Bruiani_Barco_pt-BR.pdf"
      : "src/assets/documents/Resume_Jose_Luiz_Bruiani_Barco_en-US.pdf";
  // update aria-label in case language changed outside of applyTranslations
  downloadCV.setAttribute("aria-label", t("downloadCVTitle"));

  // usa fetchAny (definida em script.js)
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
