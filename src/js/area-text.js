/**
 * AreaText - textos editaveis da pasta src/json/area/.
 *
 * Esses textos sao aplicados NO CLIENTE, ao carregar o site (e novamente a cada
 * troca de idioma). Sao arquivos estaticos servidos junto com o HTML, entao nao
 * geram nenhum trabalho extra para a funcao da Vercel.
 *
 * Arquivos usados:
 *   src/json/area/content.json  -> textos padrao (chave = id do elemento)
 *   src/json/area/lang_pt.json  -> textos em portugues (chave = seletor CSS)
 *   src/json/area/lang_en.json  -> textos em ingles   (chave = seletor CSS)
 *
 * Para adicionar um texto novo basta criar a chave nos arquivos de idioma. Se o
 * seletor nao existir no HTML, a chave e ignorada silenciosamente (apenas um
 * aviso em modo detalhado), sem quebrar o carregamento.
 */
(function initAreaText(global) {
  "use strict";

  const CONTENT_FILE = "src/json/area/content.json";
  const LANGUAGE_FILES = {
    "pt-BR": "src/json/area/lang_pt.json",
    "en-US": "src/json/area/lang_en.json",
  };

  // Apelidos: permitem que uma chave do JSON aponte para ids que ja existem no
  // HTML do site, sem precisar renomear nada.
  const SELECTOR_ALIASES = {
    "hero-title": ["#hero-title", "#welcome_title"],
    "hero-subtitle": ["#hero-subtitle", "#welcome_message"],
    "about-text": ["#about-text", "#aboutMeText"],
  };

  function normalizeLocale(language) {
    const normalized = String(
      language ||
        (global.localStorage && localStorage.getItem("language")) ||
        document.documentElement.lang ||
        "pt-BR",
    ).toLowerCase();
    return normalized.startsWith("pt") ? "pt-BR" : "en-US";
  }

  function candidateSelectors(key) {
    const raw = String(key || "").trim();
    if (!raw) return [];

    const aliases = SELECTOR_ALIASES[raw.replace(/^#/, "")] || [];
    const direct = /^[#.\[]/.test(raw) ? [raw] : [`#${raw}`];
    return Array.from(new Set([...direct, ...aliases]));
  }

  async function fetchJson(path) {
    const response = await fetch(path, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} em ${path}`);
    return response.json();
  }

  const fileCache = new Map();

  function loadJsonOnce(path) {
    if (!fileCache.has(path)) {
      fileCache.set(
        path,
        fetchJson(path).catch((error) => {
          console.info(`[area-text] ${error.message}`);
          return {};
        }),
      );
    }
    return fileCache.get(path);
  }

  /** Junta os textos padrao com os do idioma atual (idioma tem prioridade). */
  function loadTexts(language) {
    const locale = normalizeLocale(language);
    return Promise.all([
      loadJsonOnce(CONTENT_FILE),
      loadJsonOnce(LANGUAGE_FILES[locale] || LANGUAGE_FILES["pt-BR"]),
    ]).then(([defaults, translated]) => {
      const merged = new Map();
      const add = (source) => {
        if (!source || typeof source !== "object") return;
        Object.entries(source).forEach(([key, value]) => {
          if (typeof value !== "string") return;
          merged.set(String(key).replace(/^#/, ""), value);
        });
      };
      add(defaults);
      add(translated);
      return merged;
    });
  }

  /**
   * Aplica os textos. Substitui o conteudo do elemento (nunca acrescenta), por
   * isso trocar de idioma varias vezes nao duplica nada.
   */
  function apply(language, root) {
    const scope = root || document;
    return loadTexts(language)
      .then((texts) => {
        let applied = 0;

        texts.forEach((text, key) => {
          const selectors = candidateSelectors(key);
          for (const selector of selectors) {
            let elements = [];
            try {
              elements = Array.from(scope.querySelectorAll(selector));
            } catch (error) {
              continue; // seletor invalido no JSON: ignora
            }
            if (!elements.length) continue;

            elements.forEach((element) => {
              element.textContent = text;
              element.dataset.areaTextKey = key;
              // Impede que o dicionario de traducao sobrescreva depois.
              if (element.hasAttribute("data-i18n")) {
                element.dataset.i18nOverriddenBy = "area-text";
              }
              applied += 1;
            });
            break; // usa o primeiro seletor que existir
          }
        });

        return applied;
      })
      .catch((error) => {
        console.warn(`[area-text] Falha ao aplicar textos: ${error.message}`);
        return 0;
      });
  }

  const AreaText = { apply, loadTexts, normalizeLocale, SELECTOR_ALIASES };
  global.AreaText = AreaText;

  function applyForCurrentLanguage(event) {
    const language =
      (event && event.detail && event.detail.language) || normalizeLocale();
    apply(language);
    if (
      global.SiteImages &&
      typeof global.SiteImages.refreshAlts === "function"
    ) {
      global.SiteImages.refreshAlts(language);
    }
  }

  // Aplica no carregamento, quando o conteudo dinamico termina e a cada idioma.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      applyForCurrentLanguage(),
    );
  } else {
    applyForCurrentLanguage();
  }
  // Os dois eventos sao disparados em `window` (script.js e translate.js).
  global.addEventListener("dynamicContentReady", applyForCurrentLanguage);
  global.addEventListener("languageChanged", applyForCurrentLanguage);
  global.addEventListener("translationsReady", applyForCurrentLanguage);
})(window);
