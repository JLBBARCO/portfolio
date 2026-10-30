/**
 * Modulo de pontuacao e filtragem de projetos por tecnologias do stack.
 *
 * Avalia cada tecnologia do projeto em comparacao com o catalogo
 * definido em src/json/stack-technologies.json.
 * Cada tecnologia correspondente concede 1 ponto ao projeto.
 */

/**
 * Normaliza um identificador de tecnologia para comparacao flexivel e consistente.
 */
export function normalizeTechName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  // Remove espacos e pontuacoes genericas, preservando +, # e . (.net, c#, c++, node.js)
  const cleaned = raw.replace(/[^\w#+.]+/g, "");

  // Mapeamentos comuns para garantir equivalencia
  if (cleaned === "js") return "javascript";
  if (cleaned === "ts") return "typescript";
  if (cleaned === "py") return "python";
  if (cleaned === "golang") return "go";
  if (cleaned === "postgres") return "postgresql";
  if (cleaned === "reactjs") return "react";
  if (cleaned === "vuejs") return "vue";
  if (cleaned === "nextjs") return "next.js";
  if (cleaned === "nuxtjs") return "nuxt.js";
  if (cleaned === "nodejs") return "node.js";

  return cleaned;
}

/**
 * Extrai todos os termos de tecnologia presentes em stack-technologies.json,
 * incluindo nomes principais, componentes de ecossistemas, ferramentas e stacks.
 *
 * @param {object} stackJson Conteudo de stack-technologies.json
 * @returns {Set<string>} Conjunto de tecnologias normalizadas
 */
export function extractKnownStackTechnologies(stackJson) {
  const set = new Set();
  if (!stackJson || typeof stackJson !== "object") return set;

  function addTerm(raw) {
    if (!raw || typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    const normalized = normalizeTechName(trimmed);
    if (normalized) set.add(normalized);

    // Trata termos compostos como "Node.js (Express / NestJS)", "Django / FastAPI",
    // "MySQL / MariaDB", "PostgreSQL / Prisma / Drizzle", "Google Cloud (GCP)"
    const subTerms = trimmed
      .split(/[\/\(\)&,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sub of subTerms) {
      const subNorm = normalizeTechName(sub);
      if (subNorm) {
        set.add(subNorm);
        if (sub.toLowerCase().endsWith(".js")) {
          const withoutJs = normalizeTechName(sub.slice(0, -3));
          if (withoutJs) set.add(withoutJs);
        }
      }
    }
  }

  function walk(node) {
    if (!node) return;
    if (typeof node === "string") {
      addTerm(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      if (typeof node.name === "string") addTerm(node.name);
      if (Array.isArray(node.ecosystem)) node.ecosystem.forEach(addTerm);
      if (Array.isArray(node.tools)) node.tools.forEach(addTerm);
      if (Array.isArray(node.components)) node.components.forEach(addTerm);

      for (const [key, val] of Object.entries(node)) {
        // Ignora campos descritivos que nao representam nomes de tecnologia
        if (
          [
            "usage_share",
            "primary_use",
            "category",
            "type",
            "language",
          ].includes(key)
        ) {
          continue;
        }
        walk(val);
      }
    }
  }

  walk(stackJson);
  return set;
}

/**
 * Calcula a pontuacao de um conjunto de tecnologias em relacao ao catalogo da stack.
 * Cada tecnologia correspondente (sem duplicidade) adiciona 1 ponto.
 *
 * @param {string[]} techNames Lista de nomes de tecnologias do projeto
 * @param {Set<string>} stackTechSet Conjunto de tecnologias normalizadas
 * @returns {{ points: number, matched: string[] }}
 */
export function scoreProjectTechnologies(techNames, stackTechSet) {
  if (!Array.isArray(techNames) || !stackTechSet || !(stackTechSet instanceof Set)) {
    return { points: 0, matched: [] };
  }

  const seen = new Set();
  const matched = [];

  for (const rawName of techNames) {
    if (!rawName) continue;
    const normalized = normalizeTechName(rawName);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    if (stackTechSet.has(normalized)) {
      matched.push(rawName);
    }
  }

  return {
    points: matched.length,
    matched,
  };
}

/**
 * Extrai o timestamp da data de ultima modificacao do card ou repositorio.
 */
export function getProjectLastModifiedTimestamp(cardOrRepo) {
  if (!cardOrRepo) return 0;
  const iso =
    cardOrRepo.latestOwnerMainMasterCommitAt ||
    cardOrRepo.latestOwnerCommitAt ||
    cardOrRepo.latestMainMasterActivityAt ||
    cardOrRepo.latestActivityAt ||
    cardOrRepo.pushedAtIso ||
    cardOrRepo.pushed_at ||
    cardOrRepo.updatedAtIso ||
    cardOrRepo.updated_at ||
    "";

  if (iso) {
    const ts = Date.parse(iso);
    if (Number.isFinite(ts) && ts > 0) return ts;
  }

  if (cardOrRepo.dateEnd) {
    const parts = String(cardOrRepo.dateEnd).split("/");
    if (parts.length === 2) {
      const ts = Date.parse(`${parts[1]}-${parts[0]}-01`);
      if (Number.isFinite(ts) && ts > 0) return ts;
    }
  }

  if (cardOrRepo.dateInit) {
    const parts = String(cardOrRepo.dateInit).split("/");
    if (parts.length === 2) {
      const ts = Date.parse(`${parts[1]}-${parts[0]}-01`);
      if (Number.isFinite(ts) && ts > 0) return ts;
    }
  }

  return 0;
}

/**
 * Ordenacao dos projetos conforme solicitado:
 * 1) Data da última modificação (decrescente);
 * 2) Estrelas (crescente);
 * 3) Nome (crescente).
 */
export function compareProjectsByModificationStarsAndName(a, b) {
  // 1. Data da última modificação (decrescente)
  const modA = getProjectLastModifiedTimestamp(a);
  const modB = getProjectLastModifiedTimestamp(b);
  if (modB !== modA) {
    return modB - modA;
  }

  // 2. Estrelas (crescente)
  const starsA = Number(a && (a.stars ?? a.stargazers_count ?? 0)) || 0;
  const starsB = Number(b && (b.stars ?? b.stargazers_count ?? 0)) || 0;
  if (starsA !== starsB) {
    return starsA - starsB;
  }

  // 3. Nome (crescente)
  const nameA = String(
    (a &&
      (a.repoName ||
        (typeof a.title === "object"
          ? a.title["pt-BR"] || a.title["en-US"]
          : a.title) ||
        a.name ||
        a.id)) ||
      "",
  ).toLowerCase();
  const nameB = String(
    (b &&
      (b.repoName ||
        (typeof b.title === "object"
          ? b.title["pt-BR"] || b.title["en-US"]
          : b.title) ||
        b.name ||
        b.id)) ||
      "",
  ).toLowerCase();

  return nameA.localeCompare(nameB);
}

/**
 * Pontua, seleciona os projetos com mais pontos e ordena conforme a regra solicitada.
 *
 * @param {Array<object>} cards Lista de cards de projetos
 * @param {Set<string>} stackTechSet Catalogo de tecnologias normalizadas
 * @param {number} [maxCount=6] Quantidade maxima de projetos a retornar
 * @returns {Array<object>}
 */
export function rankAndFilterProjectCards(cards, stackTechSet, maxCount = 6) {
  if (!Array.isArray(cards)) return [];

  const scoredCards = cards.map((card) => {
    const rawTechs = Array.isArray(card.iconTechnologies)
      ? card.iconTechnologies.map((t) => (t && t.name) || "")
      : [];

    const { points, matched } = scoreProjectTechnologies(rawTechs, stackTechSet);

    return {
      ...card,
      points,
      matchedTechnologies: matched,
    };
  });

  // Para selecionar os top N projetos por pontuação, usamos os pontos primeiro
  // e os critérios de ordenação como desempate
  scoredCards.sort((a, b) => {
    const pointsA = Number(a && a.points) || 0;
    const pointsB = Number(b && b.points) || 0;
    if (pointsB !== pointsA) {
      return pointsB - pointsA;
    }
    return compareProjectsByModificationStarsAndName(a, b);
  });

  const limit = Number.isFinite(maxCount) && maxCount > 0 ? maxCount : 6;
  const topCards = scoredCards.slice(0, limit);

  // Ordenação final dos projetos selecionados conforme solicitado:
  // 1. Data da última modificação (decrescente)
  // 2. Estrelas (crescente)
  // 3. Nome (crescente)
  topCards.sort(compareProjectsByModificationStarsAndName);

  return topCards;
}
