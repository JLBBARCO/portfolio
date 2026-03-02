#!/usr/bin/env node
// simple utility to extract i18n keys from HTML and build a combined
// translation file.  run from the repository root with `node scripts/extract-translations.js`

const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "index.html");
const ptPath = path.join(
  __dirname,
  "..",
  "src",
  "json",
  "translate",
  "pt-br.json",
);
const enPath = path.join(
  __dirname,
  "..",
  "src",
  "json",
  "translate",
  "en-us.json",
);
const combinedPath = path.join(
  __dirname,
  "..",
  "src",
  "json",
  "translate",
  "strings.json",
);

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

function extractKeys(html) {
  const re = /data-i18n=["']([^"']+)["']/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

function main() {
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
  const keys = extractKeys(html);

  const pt = readJSON(ptPath);
  const en = readJSON(enPath);
  const combinedExisting = readJSON(combinedPath);

  const result =
    combinedExisting.en && combinedExisting.pt
      ? combinedExisting
      : { en: {}, pt: {} };

  keys.forEach((k) => {
    if (!(k in result.en)) result.en[k] = en[k] || "";
    if (!(k in result.pt)) result.pt[k] = pt[k] || "";
  });

  // also copy any existing entries that may not appear in the HTML anymore
  Object.keys(result.en).forEach((k) => {
    if (!keys.has(k)) {
      // leave it there so translations don't disappear unexpectedly
    }
  });

  writeJSON(combinedPath, result);
  console.log(`wrote ${combinedPath} with ${keys.size} keys`);
}

main();
