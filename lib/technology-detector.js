const MANIFEST_NAMES = new Set([
  "package.json",
  "pyproject.toml",
  "pipfile",
  "composer.json",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const MANIFEST_PRIORITY = new Map([
  ["package.json", 0],
  ["pyproject.toml", 1],
  ["requirements.txt", 2],
  ["composer.json", 3],
  ["go.mod", 4],
  ["cargo.toml", 5],
  ["pom.xml", 6],
  ["build.gradle", 7],
  ["build.gradle.kts", 7],
  ["pipfile", 8],
]);

const PACKAGE_RULES = [
  [["react", "react-dom"], "React"],
  [["next"], "Next.js"],
  [["vue", "@vitejs/plugin-vue"], "Vue.js"],
  [["svelte", "@sveltejs/kit"], "Svelte"],
  [["tailwindcss", "@tailwindcss/postcss", "@tailwindcss/vite"], "Tailwind CSS"],
  [["typescript"], "TypeScript"],
  [["express"], "Express"],
  [["fastify"], "Fastify"],
  [["@nestjs/core"], "NestJS"],
  [["prisma", "@prisma/client"], "Prisma"],
  [["vite"], "Vite"],
  [["astro", "@astrojs/renderer-react", "@astrojs/renderer-vue"], "Astro"],
  [["@remix-run/react", "@remix-run/node"], "Remix"],
  [["sass"], "Sass"],
  [["bootstrap"], "Bootstrap"],
  [["three"], "Three.js"],
  [["framer-motion"], "Framer Motion"],
];

function normalizePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function basename(value) {
  const path = normalizePath(value);
  return path.slice(path.lastIndexOf("/") + 1).toLowerCase();
}

function isManifestPath(value) {
  const name = basename(value);
  return MANIFEST_NAMES.has(name) || /^requirements(?:[-_.][^/]*)?\.txt$/i.test(name);
}

/** Select a bounded, root-first sample of dependency manifests in monorepos. */
export function selectTechnologyManifestPaths(treePaths, limit = 3) {
  const unique = Array.from(
    new Set((Array.isArray(treePaths) ? treePaths : []).map(normalizePath)),
  ).filter(isManifestPath);

  unique.sort((a, b) => {
    const aRoot = !a.includes("/");
    const bRoot = !b.includes("/");
    if (aRoot !== bRoot) return aRoot ? -1 : 1;

    const aName = basename(a);
    const bName = basename(b);
    const aPriority = MANIFEST_PRIORITY.get(aName) ?? 9;
    const bPriority = MANIFEST_PRIORITY.get(bName) ?? 9;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.localeCompare(b);
  });

  return unique.slice(0, Math.max(0, limit));
}

/**
 * Infer technologies from repository paths and already-read manifests.
 * Filename extensions alone never imply React; dependency declarations or
 * framework-specific file signatures are used to limit false positives.
 */
export function detectTechnologiesFromRepository(treePaths, manifests = []) {
  const detected = new Map();
  const add = (name, evidence) => {
    if (!detected.has(name)) detected.set(name, new Set());
    if (evidence) detected.get(name).add(evidence);
  };

  const paths = Array.isArray(treePaths) ? treePaths.map(normalizePath) : [];
  for (const path of paths) {
    const name = basename(path);
    const lowerPath = path.toLowerCase();

    if (/^next\.config\.(?:js|cjs|mjs|ts|mts)$/.test(name)) {
      add("Next.js", `file:${path}`);
      add("React", `framework:Next.js (${path})`);
    }
    if (/^tailwind\.config\.(?:js|cjs|mjs|ts|mts)$/.test(name)) {
      add("Tailwind CSS", `file:${path}`);
    }
    if (name === "tsconfig.json" || /\.(?:ts|tsx|mts|cts)$/.test(name)) {
      add("TypeScript", `file:${path}`);
    }
    if (/\.vue$/.test(name)) add("Vue.js", `file:${path}`);
    if (/\.svelte$/.test(name)) add("Svelte", `file:${path}`);
    if (name === "schema.prisma" || /(?:^|\/)prisma\/schema\.prisma$/.test(lowerPath)) {
      add("Prisma", `file:${path}`);
    }
    if (name === "dockerfile" || /^docker-compose(?:\.[^.]+)?\.ya?ml$/.test(name)) {
      add("Docker", `file:${path}`);
    }
    if (/^\.github\/workflows\/.+/.test(lowerPath)) {
      add("GitHub Actions", `file:${path}`);
    }
  }

  for (const manifest of Array.isArray(manifests) ? manifests : []) {
    if (!manifest || typeof manifest.text !== "string") continue;
    const path = normalizePath(manifest.path);
    const name = basename(path);
    const text = manifest.text;

    if (name === "package.json") {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }
      const dependencies = {
        ...(data.dependencies || {}),
        ...(data.devDependencies || {}),
        ...(data.peerDependencies || {}),
        ...(data.optionalDependencies || {}),
      };
      const dependencyNames = new Set(Object.keys(dependencies).map((key) => key.toLowerCase()));
      for (const [packages, technology] of PACKAGE_RULES) {
        const match = packages.find((packageName) => dependencyNames.has(packageName));
        if (match) add(technology, `dependency:${match} (${path})`);
      }
      continue;
    }

    if (/^requirements(?:[-_.][^/]*)?\.txt$/i.test(name) || name === "pyproject.toml" || name === "pipfile") {
      const pythonRules = [
        [/\bfastapi\b/i, "FastAPI"],
        [/\bflask\b/i, "Flask"],
        [/\bdjango\b/i, "Django"],
        [/\bcustomtkinter\b/i, "CustomTkinter"],
        [/\b(?:mysql-connector-python|pymysql|mysqlclient)\b/i, "MySQL"],
        [/\bsqlalchemy\b/i, "SQLAlchemy"],
      ];
      for (const [pattern, technology] of pythonRules) {
        if (pattern.test(text)) add(technology, `dependency:${technology} (${path})`);
      }
      continue;
    }

    if (name === "composer.json") {
      if (/"laravel\/framework"\s*:/i.test(text)) add("Laravel", `dependency:laravel/framework (${path})`);
      if (/"symfony\/framework-bundle"\s*:/i.test(text)) add("Symfony", `dependency:symfony/framework-bundle (${path})`);
      continue;
    }

    if (name === "go.mod") {
      if (/github\.com\/gin-gonic\/gin/i.test(text)) add("Gin", `dependency:gin (${path})`);
      if (/github\.com\/labstack\/echo/i.test(text)) add("Echo", `dependency:echo (${path})`);
      if (/github\.com\/gofiber\/fiber/i.test(text)) add("Fiber", `dependency:fiber (${path})`);
      continue;
    }

    if (name === "cargo.toml") {
      if (/\bactix-web\b/i.test(text)) add("Actix Web", `dependency:actix-web (${path})`);
      if (/\baxum\b/i.test(text)) add("Axum", `dependency:axum (${path})`);
      continue;
    }

    if (name === "pom.xml" || name === "build.gradle" || name === "build.gradle.kts") {
      if (/spring-boot-starter|org\.springframework\.boot/i.test(text)) {
        add("Spring Boot", `dependency:spring-boot (${path})`);
      }
    }
  }

  return Array.from(detected, ([name, evidence]) => ({
    name,
    evidence: Array.from(evidence).sort(),
  })).sort((a, b) => a.name.localeCompare(b.name));
}
