#!/usr/bin/env node
/**
 * Automatic Translation Key Extractor with MyMemory Translation API
 *
 * Scans HTML and JS files for i18n keys and syncs with strings.json
 * Run: npm run i18n:extract or node scripts/extract-translations.js
 *
 * Features:
 * - Auto-discovers keys from data-i18n, setAttribute("data-i18n", ...), t("key")
 * - Detects missing translations
 * - Reports unused keys
 * - Validates key naming conventions
 * - MyMemory API automatic translation (FREE - 10,000 words/day, no API key needed!)
 *
 * Usage:
 *   npm run i18n:sync              # Sync keys without translation
 *   npm run i18n:translate         # Auto-translate ALL missing translations
 *   npm run i18n:translate-missing # Translate only new keys (safer)
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const https = require("https");

const rootDir = path.join(__dirname, "..");
const combinedPath = path.join(
  rootDir,
  "src",
  "json",
  "translate",
  "strings.json",
);

// Legacy files - kept for backward compatibility but not actively used
const ptPath = path.join(rootDir, "src", "json", "translate", "pt-br.json");
const enPath = path.join(rootDir, "src", "json", "translate", "en-us.json");

// CLI arguments
const args = process.argv.slice(2);
const AUTO_TRANSLATE = args.includes("--auto-translate");
const TRANSLATE_MISSING = args.includes("--translate-missing");
const TRANSLATION_ENABLED = AUTO_TRANSLATE || TRANSLATE_MISSING;

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return {};
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

const DEFAULT_LANGUAGES = {
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
};

function normalizeTranslationStore(existing) {
  if (existing && existing.languages && existing.translations) {
    return {
      defaultLanguage: existing.defaultLanguage || "pt-br",
      languages: existing.languages,
      translations: existing.translations,
    };
  }

  if (
    existing &&
    (existing["pt-br"] || existing["en-us"] || existing.pt || existing.en)
  ) {
    return {
      defaultLanguage: "pt-br",
      languages: DEFAULT_LANGUAGES,
      translations: {
        "pt-br": existing["pt-br"] || existing.pt || {},
        "en-us": existing["en-us"] || existing.en || {},
      },
    };
  }

  return {
    defaultLanguage: "pt-br",
    languages: DEFAULT_LANGUAGES,
    translations: {
      "pt-br": {},
      "en-us": {},
    },
  };
}

/**
 * Extract i18n keys from multiple sources:
 * - data-i18n="key"
 * - setAttribute("data-i18n", "key")
 * - t("key")
 * - String literals starting with valid prefixes (nav_, section_, etc)
 */
function extractKeysFromContent(content) {
  const keys = new Set();

  // Pattern 1: data-i18n="key" in HTML
  const htmlPattern = /data-i18n=["']([^"']+)["']/g;
  let match;
  while ((match = htmlPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Pattern 2: setAttribute("data-i18n", "key") in JS
  const setAttrPattern =
    /setAttribute\s*\(\s*["']data-i18n["']\s*,\s*["']([^"']+)["']\s*\)/g;
  while ((match = setAttrPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Pattern 3: t("key") function calls
  const tFunctionPattern = /\bt\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = tFunctionPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  // Pattern 4: String literals that look like i18n keys (nav_*, section_*, etc)
  const i18nKeyPattern =
    /["']((?:page|section|nav|aria|action|link|block|meta)_[a-z0-9_]+)["']/gi;
  while ((match = i18nKeyPattern.exec(content)) !== null) {
    keys.add(match[1]);
  }

  return keys;
}

function scanFiles() {
  const allKeys = new Set();

  // Scan HTML files
  const htmlFiles = glob.sync("**/*.html", {
    cwd: rootDir,
    ignore: "node_modules/**",
  });
  htmlFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(rootDir, file), "utf8");
    const keys = extractKeysFromContent(content);
    keys.forEach((k) => allKeys.add(k));
  });

  // Scan JS files
  const jsFiles = glob.sync("src/js/**/*.js", { cwd: rootDir });
  jsFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(rootDir, file), "utf8");
    const keys = extractKeysFromContent(content);
    keys.forEach((k) => allKeys.add(k));
  });

  return allKeys;
}

function validateKeyNaming(key) {
  const validPrefixes = [
    "page_",
    "section_",
    "nav_",
    "aria_",
    "action_",
    "link_",
    "block_",
    "meta_",
  ];
  const hasValidPrefix = validPrefixes.some((prefix) => key.startsWith(prefix));

  if (!hasValidPrefix && key !== "meta_translation_key_pattern") {
    console.warn(
      `⚠️  Key "${key}" doesn't follow naming convention (use: ${validPrefixes.join(", ")})`,
    );
  }
}

/**
 * Translate text using MyMemory Translation API (FREE - no API key needed!)
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code ('pt-BR', 'en-US')
 * @param {string} sourceLang - Source language code ('en', 'pt')
 * @returns {Promise<string>}
 */
async function translateText(text, targetLang, sourceLang = "en") {
  return new Promise((resolve, reject) => {
    // MyMemory API expects langpair format: 'en|pt-BR'
    const langPair = `${sourceLang}|${targetLang}`;
    const encodedText = encodeURIComponent(text);
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${langPair}`;

    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data);

            if (response.responseStatus === 200 && response.responseData) {
              resolve(response.responseData.translatedText);
            } else {
              console.error(
                `   ⚠️  Translation warning: ${response.responseDetails || "Unknown error"}`,
              );
              resolve(text); // Return original on error
            }
          } catch (error) {
            console.error(
              `   ❌ Translation failed for "${text}": ${error.message}`,
            );
            resolve(text); // Return original on error
          }
        });
      })
      .on("error", (error) => {
        console.error(`   ❌ Network error: ${error.message}`);
        resolve(text); // Return original on error
      });
  });
}

/**
 * Intelligently translate based on key naming
 * Uses the key itself to infer likely English text
 */
function inferEnglishFromKey(key) {
  // Remove prefix (nav_, section_, etc)
  const withoutPrefix = key.replace(/^[a-z]+_/, "");

  // Replace underscores with spaces
  const words = withoutPrefix.split("_");

  // Capitalize first letter of each word for titles
  if (
    key.startsWith("nav_") ||
    key.startsWith("section_") ||
    key.startsWith("page_")
  ) {
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }

  // Sentence case for actions
  if (key.startsWith("action_")) {
    return words[0].charAt(0).toUpperCase() + words.slice(0).join(" ").slice(1);
  }

  // Default: capitalize first letter only
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Auto-translate missing keys using MyMemory Translation API
 */
async function autoTranslateMissing(
  result,
  missingTranslations,
  onlyNew = false,
) {
  if (missingTranslations.length === 0) {
    return { translated: 0, skipped: 0 };
  }

  console.log(
    `\n🤖 Using MyMemory Translation API (FREE - no setup required!)...`,
  );

  // Group by key to translate both languages
  const keysToTranslate = new Map();
  missingTranslations.forEach(({ key, lang }) => {
    if (!keysToTranslate.has(key)) {
      keysToTranslate.set(key, { "en-us": false, "pt-br": false });
    }
    keysToTranslate.get(key)[lang] = true;
  });

  let translated = 0;
  let skipped = 0;
  const total = keysToTranslate.size;
  let current = 0;

  console.log(`🔄 Translating ${total} keys...\n`);

  for (const [key, langs] of keysToTranslate) {
    current++;

    // Skip if only translating new keys and this key already has a translation
    if (onlyNew && (result.en[key] || result.pt[key])) {
      skipped++;
      continue;
    }

    process.stdout.write(`   [${current}/${total}] ${key}... `);

    try {
      // If EN is missing, infer from key name
      if (langs["en-us"] && !result["en-us"][key]) {
        result["en-us"][key] = inferEnglishFromKey(key);
        process.stdout.write(`📝 EN (inferred) `);
      }

      // If PT is missing, translate from EN
      if (langs["pt-br"] && !result["pt-br"][key]) {
        const sourceText = result["en-us"][key] || inferEnglishFromKey(key);
        result["pt-br"][key] = await translateText(sourceText, "pt-BR", "en");
        console.log(`✅ PT translated`);
        translated++;

        // Rate limiting: be nice to the free API (500ms delay)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else if (!langs.pt) {
        console.log(`✅`);
      }
    } catch (error) {
      console.log(`❌ ${error.message}`);
      skipped++;
    }
  }

  return { translated, skipped };
}

async function main() {
  console.log("🔍 Scanning files for i18n keys...\n");

  const discoveredKeys = scanFiles();
  console.log(`✅ Found ${discoveredKeys.size} unique keys in codebase\n`);

  // Load existing translations
  const existing = readJSON(combinedPath);
  const result = normalizeTranslationStore(existing);
  const languageCodes = Object.keys(result.languages || DEFAULT_LANGUAGES);

  // Load legacy files for migration
  const legacyPt = readJSON(ptPath);
  const legacyEn = readJSON(enPath);

  let newKeysCount = 0;
  let missingTranslations = [];

  // Add newly discovered keys
  discoveredKeys.forEach((key) => {
    validateKeyNaming(key);

    if (!(key in result.translations["en-us"])) {
      result.translations["en-us"][key] = legacyEn[key] || "";
      newKeysCount++;
      if (!result.translations["en-us"][key]) {
        missingTranslations.push({ key, lang: "en-us" });
      }
    }

    if (!(key in result.translations["pt-br"])) {
      result.translations["pt-br"][key] = legacyPt[key] || "";
      if (!result.translations["pt-br"][key]) {
        missingTranslations.push({ key, lang: "pt-br" });
      }
    }
  });

  // Auto-translate missing keys if requested
  if (TRANSLATION_ENABLED && missingTranslations.length > 0) {
    const stats = await autoTranslateMissing(
      result.translations,
      missingTranslations,
      TRANSLATE_MISSING,
    );

    // Update missing translations list
    missingTranslations = missingTranslations.filter(
      ({ key, lang }) => !result.translations[lang][key],
    );

    console.log(`\n🎉 Translation complete!`);
    console.log(`   ✅ ${stats.translated} translations added`);
    if (stats.skipped > 0) {
      console.log(`   ⏭️  ${stats.skipped} skipped`);
    }
  }

  // Detect unused keys (keys in strings.json but not in code)
  const unusedKeys = [];
  Object.keys(result.translations["pt-br"]).forEach((key) => {
    if (!discoveredKeys.has(key) && key !== "meta_translation_key_pattern") {
      unusedKeys.push(key);
    }
  });

  // Write updated translations
  writeJSON(combinedPath, {
    defaultLanguage: result.defaultLanguage,
    languages: result.languages || DEFAULT_LANGUAGES,
    translations: result.translations,
  });

  // Report
  console.log(`\n📝 Updated ${combinedPath}`);
  console.log(
    `   Total keys: ${Object.keys(result.translations["pt-br"]).length}`,
  );

  if (newKeysCount > 0) {
    console.log(`\n🆕 ${newKeysCount} new keys added`);
  }

  if (missingTranslations.length > 0) {
    console.log(`\n⚠️  ${missingTranslations.length} missing translations:`);
    missingTranslations.slice(0, 10).forEach(({ key, lang }) => {
      console.log(`   - ${key} [${lang}]`);
    });
    if (missingTranslations.length > 10) {
      console.log(`   ... and ${missingTranslations.length - 10} more`);
    }

    if (!TRANSLATION_ENABLED) {
      console.log(
        `\n   💡 Run 'npm run i18n:translate-missing' to auto-translate with MyMemory (FREE!)`,
      );
    }
  }

  if (unusedKeys.length > 0) {
    console.log(`\n🗑️  ${unusedKeys.length} unused keys (not found in code):`);
    unusedKeys.slice(0, 5).forEach((key) => {
      console.log(`   - ${key}`);
    });
    if (unusedKeys.length > 5) {
      console.log(`   ... and ${unusedKeys.length - 5} more`);
    }
    console.log(
      "\n   💡 Consider removing these keys or they may be used dynamically",
    );
  }

  console.log("\n✨ Sync complete!");
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});
