/**
 * SiteData - cliente enxuto do snapshot do site.
 *
 * Todo o conteudo dinamico (perfil, tema, projetos, tecnologias e catalogo de
 * imagens) e calculado na Vercel e entregue pronto por /api/site-data, que fica
 * cacheado 1 hora na CDN. Aqui no navegador nao existe mais:
 *
 *   - cache em localStorage/sessionStorage;
 *   - limite/orcamento de requisicoes ou "modo lite";
 *   - circuit breaker / periodo de espera apos falhas;
 *   - qualquer chamada direta a api.github.com.
 *
 * O navegador faz UMA requisicao por carregamento de pagina e reaproveita a
 * mesma Promise em memoria durante a sessao da pagina. Em hospedagem estatica
 * (Live Server, abrir o index.html direto) a rota /api nao existe e o cliente
 * cai para o arquivo src/json/site-snapshot.json.
 */
(function initSiteData(global) {
  "use strict";

  const DEFAULT_OWNER = "JLBBARCO";
  const DEFAULT_ENDPOINT = "/api/site-data";
  const STATIC_SNAPSHOT_PATHS = [
    "src/json/site-snapshot.json",
    "/src/json/site-snapshot.json",
    "site-snapshot.json",
  ];

  const EMPTY_SNAPSHOT = {
    schema: 0,
    owner: DEFAULT_OWNER,
    generatedAt: "",
    source: "empty",
    profile: null,
    theme: null,
    images: { images: {} },
    projects: { cards: [], count: 0, githubFetchStatus: { failed: true } },
    technologies: { groups: [], count: 0 },
    siteRepo: null,
    repos: [],
    warnings: [],
  };

  function getBodyDataset() {
    return (document.body && document.body.dataset) || {};
  }

  function getOwner() {
    return getBodyDataset().githubOwner || DEFAULT_OWNER;
  }

  /**
   * Rota do snapshot. Pode ser trocada em index.html com
   * <body data-site-data-endpoint="...">. Use "off" (ou "") para nao chamar a
   * rota - util em hospedagem estatica/Live Server, onde /api nao existe e o
   * navegador registraria um 404 no console.
   */
  function getEndpoint() {
    const dataset = getBodyDataset();
    if (typeof dataset.siteDataEndpoint === "string") {
      const configured = dataset.siteDataEndpoint.trim();
      if (!configured || configured.toLowerCase() === "off") return "";
      return configured;
    }
    return DEFAULT_ENDPOINT;
  }

  function isValidSnapshot(data) {
    return Boolean(
      data &&
      typeof data === "object" &&
      !data.__siteDataError &&
      !data.__githubError &&
      data.projects &&
      Array.isArray(data.projects.cards),
    );
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${url}`);
    }
    return response.json();
  }

  async function loadFromApi() {
    const endpoint = getEndpoint();
    const url = `${endpoint}?owner=${encodeURIComponent(getOwner())}`;
    const data = await fetchJson(url);
    if (!isValidSnapshot(data)) {
      throw new Error(
        (data && (data.details || data.error)) ||
          "Resposta invalida de /api/site-data",
      );
    }
    data.source = "vercel";
    return data;
  }

  async function loadFromStaticFile() {
    let lastError = null;
    for (const path of STATIC_SNAPSHOT_PATHS) {
      try {
        const data = await fetchJson(path);
        if (isValidSnapshot(data)) {
          data.source = "static";
          return data;
        }
        lastError = new Error(`Snapshot estatico invalido em ${path}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Snapshot estatico indisponivel");
  }

  /** Um snapshot so e util se trouxer projetos. */
  function hasContent(snapshot) {
    return Boolean(
      snapshot &&
      snapshot.projects &&
      Array.isArray(snapshot.projects.cards) &&
      snapshot.projects.cards.length,
    );
  }

  async function resolveSnapshot() {
    const isFileProtocol =
      global.location && global.location.protocol === "file:";

    let apiSnapshot = null;
    if (!isFileProtocol && getEndpoint()) {
      try {
        apiSnapshot = await loadFromApi();
      } catch (apiError) {
        console.info(
          `[site-data] /api/site-data indisponivel (${apiError.message}); usando o snapshot versionado.`,
        );
      }
    }

    if (hasContent(apiSnapshot)) return apiSnapshot;

    // A rota respondeu, mas sem conteudo (ex.: limite do GitHub atingido na
    // geracao): usa o snapshot versionado em src/json/site-snapshot.json.
    try {
      const staticSnapshot = await loadFromStaticFile();
      if (!apiSnapshot) return staticSnapshot;
      if (hasContent(staticSnapshot)) {
        staticSnapshot.source = "static-fallback";
        staticSnapshot.warnings = [
          ...(apiSnapshot.warnings || []),
          ...(staticSnapshot.warnings || []),
        ];
        if (!staticSnapshot.theme && apiSnapshot.theme) {
          staticSnapshot.theme = apiSnapshot.theme;
        }
        return staticSnapshot;
      }
      return apiSnapshot;
    } catch (staticError) {
      if (apiSnapshot) return apiSnapshot;
      throw staticError;
    }
  }

  let snapshotPromise = null;

  function load() {
    if (snapshotPromise) return snapshotPromise;

    snapshotPromise = resolveSnapshot()
      .then((snapshot) => {
        if (Array.isArray(snapshot.warnings) && snapshot.warnings.length) {
          console.info("[site-data] avisos do servidor:", snapshot.warnings);
        }
        return snapshot;
      })
      .catch((error) => {
        console.warn(
          `[site-data] Nenhuma fonte de dados disponivel: ${error.message}`,
        );
        return { ...EMPTY_SNAPSHOT };
      });

    return snapshotPromise;
  }

  const SiteData = {
    /** Promise (unica por carregamento) com o snapshot completo. */
    get: load,
    load,

    profile() {
      return load().then((snapshot) => snapshot.profile || null);
    },

    theme() {
      return load().then((snapshot) => snapshot.theme || null);
    },

    projects() {
      return load().then(
        (snapshot) =>
          snapshot.projects || {
            cards: [],
            count: 0,
            githubFetchStatus: { failed: true },
          },
      );
    },

    technologies() {
      return load().then(
        (snapshot) => snapshot.technologies || { groups: [], count: 0 },
      );
    },

    images() {
      return load().then((snapshot) => {
        const catalog = snapshot.images || { images: {} };
        return catalog.images || {};
      });
    },

    image(id) {
      return SiteData.images().then((images) => images[id] || null);
    },

    siteRepo() {
      return load().then((snapshot) => snapshot.siteRepo || null);
    },

    repos() {
      return load().then((snapshot) =>
        Array.isArray(snapshot.repos) ? snapshot.repos : [],
      );
    },

    generatedAt() {
      return load().then((snapshot) => snapshot.generatedAt || "");
    },
  };

  global.SiteData = SiteData;
})(window);
