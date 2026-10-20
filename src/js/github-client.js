/**
 * GitHub client compartilhado (front-end).
 *
 * ARQUITETURA (1 requisicao por dia no GitHub, infinitas para os visitantes):
 *
 *   GitHub API  --(1x por dia)-->  /api/github-data  --(CDN 23h)-->  visitantes
 *
 *   1. `/api/github-data` monta o snapshot completo (perfil + repositorios +
 *      linguagens + datas de commit) e e cacheado na CDN da Vercel por 23h.
 *      O cron diario aquece esse cache, entao normalmente nenhum visitante
 *      espera pela API do GitHub.
 *   2. O navegador guarda o snapshot em `localStorage` por 6h: dar F5 nao gera
 *      nenhuma requisicao.
 *   3. Sem backend (Live Server, `file://`) ou se a rota falhar, usa o arquivo
 *      estatico `src/json/github-snapshot.json` (gerado por `npm run snapshot`).
 *   4. Somente se nada disso existir e que ha chamada direta a API publica do
 *      GitHub, com disjuntor e cache para nunca inundar o console de erros.
 */
(function () {
  "use strict";

  var CACHE_PREFIX = "gh:v2:";
  var SNAPSHOT_KEY = "snapshot";
  var SNAPSHOT_FRESH_MS = 6 * 60 * 60 * 1000; // 6 horas
  var FRESH_TTL_MS = 30 * 60 * 1000; // chamadas avulsas (modo legado)
  var STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // reserva de emergencia
  var API_STATE_KEY = "gh:apiRouteState";
  var COOLDOWN_KEY = "gh:cooldownUntil";
  var MAX_FAILURES = 3;
  var COOLDOWN_MS = 15 * 60 * 1000;
  var STATIC_SNAPSHOT_PATH = "src/json/github-snapshot.json";

  var warned = {};
  var inflight = {};
  var failureCount = 0;
  var snapshotPromise = null;

  /* ------------------------------ utilidades ------------------------------ */

  function warnOnce(key, message) {
    if (warned[key]) return;
    warned[key] = true;
    console.info(message);
  }

  function safeSession(action, key, value) {
    try {
      if (action === "get") return window.sessionStorage.getItem(key);
      window.sessionStorage.setItem(key, value);
    } catch (e) {
      /* storage indisponivel */
    }
    return null;
  }

  function readCache(cacheKey) {
    try {
      var raw = window.localStorage.getItem(CACHE_PREFIX + cacheKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.t !== "number") return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(cacheKey, data) {
    try {
      window.localStorage.setItem(
        CACHE_PREFIX + cacheKey,
        JSON.stringify({ t: Date.now(), data: data }),
      );
    } catch (e) {
      /* cota cheia: segue sem cache */
    }
  }

  function isFresh(entry, ttlMs) {
    if (!entry) return false;
    return Date.now() - entry.t < (typeof ttlMs === "number" ? ttlMs : FRESH_TTL_MS);
  }

  function isUsableStale(entry) {
    return !!entry && Date.now() - entry.t < STALE_TTL_MS;
  }

  function defaultOwner() {
    var fromBody =
      document.body && document.body.dataset
        ? document.body.dataset.githubOwner
        : "";
    return fromBody || "JLBBARCO";
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function parseJsonSafely(res) {
    return res.json().catch(function () {
      return null;
    });
  }

  function isStructuredError(data) {
    return !!data && typeof data === "object" && data.__githubError === true;
  }

  /* ------------------------- disjuntor (rede/limite) ---------------------- */

  function isCoolingDown() {
    return Number(safeSession("get", COOLDOWN_KEY) || 0) > Date.now();
  }

  function registerFailure(reason) {
    failureCount += 1;
    if (failureCount < MAX_FAILURES) return;
    safeSession("set", COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
    warnOnce(
      "cooldown",
      "[github] Requisicoes diretas ao GitHub pausadas por 15 minutos (" +
        reason +
        "). O site continua usando os dados em cache.",
    );
  }

  function registerSuccess() {
    failureCount = 0;
  }

  /* --------------------------- snapshot (principal) ----------------------- */

  function isValidSnapshot(data) {
    return (
      !!data &&
      typeof data === "object" &&
      !isStructuredError(data) &&
      Array.isArray(data.repos)
    );
  }

  function staticSnapshotUrl() {
    try {
      return new URL(STATIC_SNAPSHOT_PATH, document.baseURI).href;
    } catch (e) {
      return STATIC_SNAPSHOT_PATH;
    }
  }

  function fetchApiSnapshot(owner) {
    if (safeSession("get", API_STATE_KEY) === "unavailable") {
      return Promise.resolve(null);
    }

    return fetch("/api/github-data?owner=" + encodeURIComponent(owner), {
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        if (res.status === 404) {
          safeSession("set", API_STATE_KEY, "unavailable");
          warnOnce(
            "no-api",
            "[github] Rota /api/github-data indisponivel (servidor estatico). " +
              "Usando o snapshot local. Para o fluxo completo, rode: npm run dev",
          );
          return null;
        }
        safeSession("set", API_STATE_KEY, "available");
        if (!res.ok) return null;
        return parseJsonSafely(res).then(function (data) {
          if (isStructuredError(data)) {
            warnOnce(
              "api-error",
              "[github] /api/github-data respondeu com erro (" +
                (data.status || "?") +
                "): " +
                (data.details || "sem detalhes") +
                ". Usando o snapshot local.",
            );
            return null;
          }
          return isValidSnapshot(data) ? data : null;
        });
      })
      .catch(function () {
        safeSession("set", API_STATE_KEY, "unavailable");
        return null;
      });
  }

  function fetchStaticSnapshot() {
    return fetch(staticSnapshotUrl(), { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) return null;
        return parseJsonSafely(res);
      })
      .then(function (data) {
        return isValidSnapshot(data) ? data : null;
      })
      .catch(function () {
        return null;
      });
  }

  /**
   * Carrega o snapshot uma unica vez por pagina.
   * Ordem: cache local (6h) -> /api/github-data -> arquivo estatico -> cache antigo.
   */
  function snapshot(ownerArg) {
    if (snapshotPromise) return snapshotPromise;

    var owner = ownerArg || defaultOwner();
    var cached = readCache(SNAPSHOT_KEY);
    if (isFresh(cached, SNAPSHOT_FRESH_MS) && isValidSnapshot(cached.data)) {
      snapshotPromise = Promise.resolve(cached.data);
      return snapshotPromise;
    }

    snapshotPromise = fetchApiSnapshot(owner)
      .then(function (data) {
        if (data) return data;
        return fetchStaticSnapshot();
      })
      .then(function (data) {
        if (data) {
          writeCache(SNAPSHOT_KEY, data);
          return data;
        }
        if (isUsableStale(cached) && isValidSnapshot(cached.data)) {
          warnOnce(
            "snapshot-stale",
            "[github] Usando snapshot em cache (a origem esta indisponivel).",
          );
          return cached.data;
        }
        warnOnce(
          "snapshot-missing",
          "[github] Nenhum snapshot disponivel. Gere um com `npm run snapshot` " +
            "ou rode `npm run dev` para habilitar /api/github-data.",
        );
        return null;
      })
      .catch(function () {
        return isValidSnapshot(cached && cached.data) ? cached.data : null;
      });

    return snapshotPromise;
  }

  function snapshotRepos(owner) {
    return snapshot(owner).then(function (data) {
      return data && Array.isArray(data.repos) ? data.repos : null;
    });
  }

  function snapshotRepo(owner, repoName) {
    var target = normalizeName(repoName);
    return snapshot(owner).then(function (data) {
      if (!data) return null;
      var found = (data.repos || []).find(function (repo) {
        return normalizeName(repo && repo.name) === target;
      });
      if (found) return found;
      if (data.siteRepo && normalizeName(data.siteRepo.name) === target) {
        return data.siteRepo;
      }
      return null;
    });
  }

  function snapshotLanguages(owner, repoName) {
    return snapshotRepo(owner, repoName).then(function (repo) {
      if (!repo) return null;
      return repo.languages && typeof repo.languages === "object"
        ? repo.languages
        : {};
    });
  }

  /* ----------------------- modo legado (ultimo recurso) ------------------- */

  function fetchDirect(path, cacheKey, fallback) {
    return fetch("https://api.github.com" + path, {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then(function (res) {
        if (res.ok) return parseJsonSafely(res);
        if (res.status === 403 || res.status === 429) {
          registerFailure("limite de requisicoes");
          warnOnce(
            "rate-limit",
            "[github] Limite da API publica do GitHub atingido (60/h). " +
              "Gere o snapshot com `npm run snapshot` para nao depender dela.",
          );
        } else if (res.status >= 500) {
          registerFailure("erro no servidor do GitHub");
        }
        return null;
      })
      .catch(function () {
        registerFailure("falha de rede");
        return null;
      })
      .then(function (data) {
        if (data !== null && data !== undefined) {
          registerSuccess();
          writeCache(cacheKey, data);
          return data;
        }
        var stale = readCache(cacheKey);
        if (isUsableStale(stale)) return stale.data;
        return fallback;
      });
  }

  /**
   * Chamada avulsa a API do GitHub. Usada apenas quando o snapshot nao cobre o
   * dado pedido. Passa por cache, disjuntor e nunca lanca excecao.
   */
  function get(path, options) {
    var opts = options || {};
    var fallback = Object.prototype.hasOwnProperty.call(opts, "fallback")
      ? opts.fallback
      : null;
    var cacheKey = opts.cacheKey || path;

    var cached = readCache(cacheKey);
    if (isFresh(cached, opts.ttlMs)) return Promise.resolve(cached.data);

    if (isCoolingDown()) {
      if (isUsableStale(cached)) return Promise.resolve(cached.data);
      return Promise.resolve(fallback);
    }

    if (inflight[cacheKey]) return inflight[cacheKey];

    var promise = fetchDirect(path, cacheKey, fallback)
      .then(function (data) {
        delete inflight[cacheKey];
        return data === undefined ? fallback : data;
      })
      .catch(function () {
        delete inflight[cacheKey];
        return isUsableStale(cached) ? cached.data : fallback;
      });

    inflight[cacheKey] = promise;
    return promise;
  }

  function repos(owner) {
    var login = owner || defaultOwner();
    return snapshotRepos(login).then(function (list) {
      if (list) return list;
      var path =
        "/users/" +
        encodeURIComponent(login) +
        "/repos?per_page=100&sort=updated&direction=desc&type=owner";
      return get(path, { cacheKey: "repos:" + login, fallback: [] }).then(
        function (data) {
          return Array.isArray(data) ? data : [];
        },
      );
    });
  }

  function languages(owner, repo) {
    return snapshotLanguages(owner, repo).then(function (data) {
      if (data) return data;
      var path =
        "/repos/" +
        encodeURIComponent(owner) +
        "/" +
        encodeURIComponent(repo) +
        "/languages";
      return get(path, {
        cacheKey: "languages:" + owner + "/" + repo,
        fallback: {},
      }).then(function (result) {
        return result && typeof result === "object" ? result : {};
      });
    });
  }

  function hasSnapshot() {
    return snapshot().then(function (data) {
      return !!data;
    });
  }

  /**
   * "Modo leve": o site nunca deve disparar chamadas por repositorio.
   * Com snapshot elas sao desnecessarias; sem snapshot elas estourariam o
   * limite de 60 requisicoes/hora da API publica do GitHub.
   */
  function isLite() {
    return Promise.resolve(true);
  }

  function clearCache() {
    try {
      Object.keys(window.localStorage)
        .filter(function (key) {
          return key.indexOf(CACHE_PREFIX) === 0 || key.indexOf("imgCheck:") === 0;
        })
        .forEach(function (key) {
          window.localStorage.removeItem(key);
        });
      window.sessionStorage.removeItem(API_STATE_KEY);
      window.sessionStorage.removeItem(COOLDOWN_KEY);
    } catch (e) {
      /* ignora */
    }
    snapshotPromise = null;
  }

  window.GitHubClient = {
    snapshot: snapshot,
    snapshotRepos: snapshotRepos,
    snapshotRepo: snapshotRepo,
    snapshotLanguages: snapshotLanguages,
    repos: repos,
    languages: languages,
    get: get,
    hasSnapshot: hasSnapshot,
    isLite: isLite,
    clearCache: clearCache,
  };
})();
