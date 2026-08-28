/**
 * SiteImages - catalogo unico das imagens fixas do site.
 *
 * Todos os links e textos alternativos das imagens fixas (foto de perfil,
 * favicons, bandeiras de idioma...) ficam em src/json/areas/images.json.
 * Para manter, basta editar esse arquivo.
 *
 * Regras de renderizacao (automaticas):
 *   - 1 fonte  -> <img src="..." alt="..." width height>
 *   - 2 ou mais -> <picture><source ...><img ...></picture>
 *
 * Largura, altura, `type` e `media` de cada fonte vem direto do JSON, evitando
 * deslocamento de layout (CLS) sem precisar medir a imagem no navegador.
 *
 * Uso:
 *   SiteImages.create("profilePicture", { id: "profile" }) -> elemento pronto
 *   SiteImages.src("faviconDark")   -> string com o link
 *   SiteImages.alt("flagPtBr")      -> texto alternativo no idioma atual
 *   <span data-image="logo"></span> -> substituido por SiteImages.render()
 */
(function initSiteImages(global) {
  "use strict";

  const CATALOG_PATHS = ["src/json/areas/images.json", "images.json"];

  function normalizeLocale(language) {
    const normalized = String(
      language ||
        (global.localStorage && localStorage.getItem("language")) ||
        document.documentElement.lang ||
        "pt-BR",
    ).toLowerCase();
    return normalized.startsWith("pt") ? "pt-BR" : "en-US";
  }

  function normalizeLocalizedValue(value) {
    if (!value) return { "pt-BR": "", "en-US": "" };
    if (typeof value === "string") return { "pt-BR": value, "en-US": value };
    const pt = value["pt-BR"] || value.pt || value["en-US"] || value.en || "";
    const en = value["en-US"] || value.en || value["pt-BR"] || value.pt || "";
    return { "pt-BR": pt, "en-US": en };
  }

  function normalizeSource(source) {
    if (!source) return null;
    if (typeof source === "string") return { src: source };
    const src = String(source.src || source.url || source.href || "").trim();
    if (!src) return null;
    const normalized = { src };
    if (source.type) normalized.type = String(source.type);
    if (source.media) normalized.media = String(source.media);
    if (Number.isFinite(Number(source.width))) {
      normalized.width = Number(source.width);
    }
    if (Number.isFinite(Number(source.height))) {
      normalized.height = Number(source.height);
    }
    if (source.density) normalized.density = String(source.density);
    return normalized;
  }

  /** Mesma normalizacao aplicada no servidor (lib/site-snapshot.js). */
  function normalizeCatalog(rawCatalog) {
    const images = {};
    if (!rawCatalog || typeof rawCatalog !== "object") return images;

    const rawImages =
      rawCatalog.images && typeof rawCatalog.images === "object"
        ? rawCatalog.images
        : rawCatalog;

    Object.entries(rawImages).forEach(([id, rawEntry]) => {
      if (!rawEntry || typeof rawEntry !== "object") return;
      if (id === "schema" || id === "images") return;

      const rawSources = Array.isArray(rawEntry.sources)
        ? rawEntry.sources
        : [rawEntry.src || rawEntry.url].filter(Boolean);
      const sources = rawSources.map(normalizeSource).filter(Boolean);
      if (!sources.length) return;

      const fallback = sources[sources.length - 1];
      images[id] = {
        id,
        alt: normalizeLocalizedValue(rawEntry.alt),
        sources,
        fallback,
        render: sources.length > 1 ? "picture" : "img",
        loading: rawEntry.loading || "",
        decoding: rawEntry.decoding || "",
        fetchPriority: rawEntry.fetchPriority || rawEntry.fetchpriority || "",
        className: rawEntry.class || rawEntry.className || "",
        country: String(rawEntry.country || "").toUpperCase(),
        crossOrigin: rawEntry.crossOrigin || rawEntry.crossorigin || "",
        width: Number.isFinite(fallback.width) ? fallback.width : undefined,
        height: Number.isFinite(fallback.height) ? fallback.height : undefined,
      };
    });

    return images;
  }

  async function fetchCatalogFile() {
    let lastError = null;
    for (const path of CATALOG_PATHS) {
      try {
        const response = await fetch(path, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} em ${path}`);
        return normalizeCatalog(await response.json());
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("images.json indisponivel");
  }

  let catalogPromise = null;
  let catalogCache = null;

  function load() {
    if (catalogPromise) return catalogPromise;

    const fromSnapshot =
      global.SiteData && typeof global.SiteData.images === "function"
        ? global.SiteData.images()
        : Promise.resolve(null);

    catalogPromise = fromSnapshot
      .then((images) => {
        if (images && Object.keys(images).length) return images;
        return fetchCatalogFile();
      })
      .catch(() => fetchCatalogFile())
      .catch((error) => {
        console.warn(`[site-images] Catalogo indisponivel: ${error.message}`);
        return {};
      })
      .then((images) => {
        catalogCache = images || {};
        return catalogCache;
      });

    return catalogPromise;
  }

  function getEntrySync(id) {
    return (catalogCache && catalogCache[id]) || null;
  }

  /**
   * Bandeiras: procura no catalogo a entrada com o campo `country`
   * correspondente. Se o idioma for novo e ainda nao estiver em images.json,
   * o link e derivado do padrao de uma bandeira existente.
   */
  function findFlagEntry(images, countryCode) {
    const code = String(countryCode || "").toUpperCase();
    if (!code) return null;
    return (
      Object.values(images || {}).find((entry) => entry.country === code) ||
      null
    );
  }

  function resolveFlagSrc(images, countryCode) {
    const entry = findFlagEntry(images, countryCode);
    if (entry) return entry.fallback.src;

    const template = (images && (images.flagEnUs || images.flagPtBr)) || null;
    if (!template) return "";
    return template.fallback.src.replace(
      /[^/]+\.svg(\?.*)?$/i,
      `${String(countryCode || "").toUpperCase()}.svg`,
    );
  }

  function applyCommonAttributes(img, entry, options) {
    const language = options.language;
    const alt =
      options.alt !== undefined
        ? options.alt
        : entry.alt[normalizeLocale(language)] || "";

    img.alt = alt;
    if (options.id) img.id = options.id;

    const className = options.className || entry.className;
    if (className) img.className = className;

    const loading = options.loading || entry.loading;
    if (loading) img.loading = loading;

    const decoding = options.decoding || entry.decoding;
    if (decoding) img.decoding = decoding;

    const fetchPriority = options.fetchPriority || entry.fetchPriority;
    if (fetchPriority) img.setAttribute("fetchpriority", fetchPriority);

    const crossOrigin = options.crossOrigin || entry.crossOrigin;
    if (crossOrigin) img.crossOrigin = crossOrigin;

    const fallback = entry.fallback || entry.sources[entry.sources.length - 1];
    if (Number.isFinite(fallback.width)) img.width = fallback.width;
    if (Number.isFinite(fallback.height)) img.height = fallback.height;

    img.src = fallback.src;
    img.dataset.imageId = entry.id;
  }

  /** Cria o elemento (<img> ou <picture>) a partir de uma entrada normalizada. */
  function buildElement(entry, options = {}) {
    const img = document.createElement("img");
    applyCommonAttributes(img, entry, options);

    if (entry.sources.length <= 1) {
      return img;
    }

    const picture = document.createElement("picture");
    if (options.pictureId) picture.id = options.pictureId;
    if (options.pictureClassName) picture.className = options.pictureClassName;

    // Todas as fontes, menos a ultima (que e o <img> de fallback), viram <source>.
    entry.sources.slice(0, -1).forEach((source) => {
      const sourceNode = document.createElement("source");
      sourceNode.setAttribute("srcset", source.src);
      if (source.type) sourceNode.setAttribute("type", source.type);
      if (source.media) sourceNode.setAttribute("media", source.media);
      if (Number.isFinite(source.width)) {
        sourceNode.setAttribute("width", String(source.width));
      }
      if (Number.isFinite(source.height)) {
        sourceNode.setAttribute("height", String(source.height));
      }
      picture.appendChild(sourceNode);
    });

    picture.appendChild(img);
    return picture;
  }

  const SiteImages = {
    load,

    /** Catalogo completo (Promise). */
    all: load,

    entry(id) {
      return load().then((images) => images[id] || null);
    },

    entrySync: getEntrySync,

    /** Elemento pronto para inserir no DOM (Promise). */
    create(id, options = {}) {
      return load().then((images) => {
        const entry = images[id];
        if (!entry) {
          console.warn(
            `[site-images] Imagem "${id}" nao existe em images.json.`,
          );
          return null;
        }
        return buildElement(entry, options);
      });
    },

    /** Versao sincrona, valida depois que o catalogo carregou. */
    createSync(id, options = {}) {
      const entry = getEntrySync(id);
      return entry ? buildElement(entry, options) : null;
    },

    src(id) {
      return load().then((images) => {
        const entry = images[id];
        return entry ? entry.fallback.src : "";
      });
    },

    srcSync(id) {
      const entry = getEntrySync(id);
      return entry ? entry.fallback.src : "";
    },

    alt(id, language) {
      return load().then((images) => {
        const entry = images[id];
        return entry ? entry.alt[normalizeLocale(language)] || "" : "";
      });
    },

    altSync(id, language) {
      const entry = getEntrySync(id);
      return entry ? entry.alt[normalizeLocale(language)] || "" : "";
    },

    /** Atualiza um <img> existente (usado nas bandeiras do seletor de idioma). */
    applyTo(imgElement, id, options = {}) {
      if (!imgElement) return Promise.resolve(null);
      return load().then((images) => {
        const entry = images[id];
        if (!entry) return null;
        applyCommonAttributes(imgElement, entry, options);
        return imgElement;
      });
    },

    applyToSync(imgElement, id, options = {}) {
      const entry = getEntrySync(id);
      if (!imgElement || !entry) return null;
      applyCommonAttributes(imgElement, entry, options);
      return imgElement;
    },

    /**
     * Substitui todo elemento com `data-image="<id>"` pelo <img>/<picture>
     * correspondente. Atributos opcionais: data-image-class, data-image-id,
     * data-image-loading, data-image-alt.
     */
    render(root, language) {
      const scope = root || document;
      const placeholders = Array.from(
        scope.querySelectorAll("[data-image]:not([data-image-rendered])"),
      );
      if (!placeholders.length) return Promise.resolve(0);

      return load().then((images) => {
        let rendered = 0;
        placeholders.forEach((placeholder) => {
          const id = placeholder.dataset.image;
          const entry = images[id];
          if (!entry) {
            console.warn(
              `[site-images] Imagem "${id}" nao existe em images.json.`,
            );
            return;
          }

          const element = buildElement(entry, {
            language,
            id: placeholder.dataset.imageId || placeholder.id || "",
            className:
              placeholder.dataset.imageClass || placeholder.className || "",
            loading: placeholder.dataset.imageLoading || "",
            alt: placeholder.dataset.imageAlt,
          });

          element.setAttribute("data-image-rendered", "true");
          element.setAttribute("data-image", id);
          placeholder.replaceWith(element);
          rendered += 1;
        });
        return rendered;
      });
    },

    /** Reaplica os textos alternativos apos uma troca de idioma. */
    refreshAlts(language, root) {
      const scope = root || document;
      const locale = normalizeLocale(language);
      return load().then((images) => {
        Array.from(scope.querySelectorAll("img[data-image-id]")).forEach(
          (img) => {
            const entry = images[img.dataset.imageId];
            if (!entry) return;
            img.alt = entry.alt[locale] || "";
          },
        );
      });
    },

    /** Link da bandeira de um pais (ex.: "BR", "US"). */
    flagSrc(countryCode) {
      return load().then((images) => resolveFlagSrc(images, countryCode));
    },

    flagSrcSync(countryCode) {
      return resolveFlagSrc(catalogCache || {}, countryCode);
    },

    flagAltSync(countryCode, language) {
      const entry = findFlagEntry(catalogCache || {}, countryCode);
      if (!entry) return String(countryCode || "").toUpperCase();
      return (
        entry.alt[normalizeLocale(language)] ||
        String(countryCode || "").toUpperCase()
      );
    },

    normalizeCatalog,
  };

  global.SiteImages = SiteImages;
})(window);
