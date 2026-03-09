# Portfolio

A portfolio showcasing my projects and the technologies I use daily.

This project contains the main projects I've developed and a brief summary of the technologies I use.

[Web site](https://portfolio-jlbbarco.vercel.app)

## Local GitHub Token (.env) 🔐

When running locally, GitHub requests can use your personal token via serverless
API routes, avoiding public rate limits.

1. Copy `.env.example` to `.env.local` (or `.env`).
2. Set `GITHUB_TOKEN` with your personal access token.
3. Run using `vercel dev` so `/api/*` routes are available locally.

The frontend calls:

- `/api/github?owner=...` for repository listing
- `/api/github-languages?owner=...&repo=...` for language breakdown

Both routes read `process.env.GITHUB_TOKEN` server-side, so the token is not
exposed in browser code.

### Troubleshooting token issues

- Ensure the value is a real token, not `ghp_your_token_here`.
- Restart `vercel dev` after changing `.env`/`.env.local`.
- Fine-grained token: grant read access to the target repositories.
- Classic token: include at least `public_repo` for public repositories.
- Test locally in browser:
  - `/api/github?owner=JLBBARCO`
  - `/api/github-languages?owner=JLBBARCO&repo=portfolio`

If auth fails, the API now retries once without token and returns a descriptive
error payload for easier diagnosis.

## Translation workflow

The project now features **automatic translation powered by MyMemory API**.

### 🚀 Quick Start

```bash
# 1. Add translation keys to your HTML/JS
<h1 data-i18n="section_new_title">Title</h1>

# 2. Run auto-translator
npm run i18n:translate-missing

# 3. Done! Translations added automatically
```

### Documentation

- **[Translation System Guide](docs/TRANSLATION.md)** - Complete workflow and features
- **[Documentation Index](docs/README.md)** - Translation documentation hub

### Key Features

- **MyMemory API Integration** - Automatic translations with no API key
- **Smart Key Detection** - Scans HTML/JS for translation keys
- **Intelligent Inference** - Generates English text from key names
- **Single Source of Truth** - Only `strings.json` needed
- **Multi-language Ready** - Supports many language pairs
- **Free Usage** - No paid setup required for common portfolio usage

### Available Commands

```bash
npm run i18n:sync                # Sync keys without translating
npm run i18n:translate-missing   # Auto-translate new keys only (recommended)
npm run i18n:translate           # Force translate all empty keys
```

### Legacy Information

To make localization easier you no longer have to edit two separate JSON
files (`en-us.json` and `pt-br.json`). All strings are now stored in
`src/json/translate/strings.json`, which has the structure:

```json
{
  "en": { "key": "English text" },
  "pt": { "key": "Texto em português" }
}
```

### Accessibility and dynamic labels

The translation system now recognizes `data-i18n-attr` attributes, allowing
aria‑labels and other attributes to be translated. Default labels for the
navigation toggle, font-size controls, profile image alt text and CV download
link are all automatically switched when the language changes.

```json
{
  "en": { "key": "English text", ... },
  "pt": { "key": "Texto em português", ... }
}
```

A small Node script is provided to regenerate the skeleton based on the keys
present in the HTML. Run:

```bash
npm run extract-translations
```

and the script will merge any existing translations and write the combined
file. You can also call `window.dumpTranslations()` from the browser console
when the page has loaded; it will log the current translation object to aid
in editing.

The loader will still fall back to the two-file format if the combined file is
missing, so old workflows continue to work, but new projects should use the
single file.

## Image selection logic 📸

Cards now choose project thumbnails according to the following precedence:

1. **Website link** – if the GitHub repo has a `homepage`/"website" field, a
   screenshot is generated via the Microlink API and used for both desktop and
   mobile images.
2. **Repository thumbnail file** – lacking a homepage, the code checks
   `src/assets/img/thumbnail.webp` in the repository (via the raw.githubusercontent
   path). If that file exists the raw URL is used.
3. **No image** – if neither of the above yields a result the card is rendered
   without an image element, preventing empty placeholders. (Open‑graph
   fallbacks are no longer injected.)

Local JSON entries and manually‑specified cards are unaffected; they can still
provide their own `image`, `imageMobile` or `imageType` values and the
existing logic will fall back to using a screenshot for any `linkDemo`.

## Icon handling and FontAwesome lookup 🔍

When building cards from GitHub data the script no longer relies on hard‑coded
`fa‑xxx` classes. It attempts to guess the correct FontAwesome icon by
creating a temporary `<i>` element and checking the computed `:before` content.
If the name doesn’t match a class (e.g. "JavaScript" → `fa-js` and
"HTML" → `fa-html5`) an alias table is consulted and the search retried.
Additional variants such as `nodejs`/`node` are recognised automatically; the
result is cached to avoid rechecking the same value twice.

## Adding projects and collaborations ✅

The site now merges GitHub repositories with an optional local list of cards.
The API fetch is smarter than before: it requests both `type=owner` and
`type=member` from GitHub so public repositories where you are a collaborator
will also be displayed automatically. When building each card we now look up
`repo.owner.login` (the host username) and use that value for image paths and
filtering.

Repositories whose **name matches their owner login** (i.e. typical
`username/username` GitHub Pages repos) are ignored entirely, regardless of
which account they belong to, along with the special `portfolio`, `study` and
`${owner}.github.io` entries. This removes the need for manual placeholders
and keeps the carousel focused on real projects.

Duplicates are additionally filtered by repository ID, so you no longer need
a placeholder "Various" card – the combined list will always reflect your
current public contributions. If a repository doesn’t appear for any reason
you may still add a manual entry to `src/json/areas/projects.json`.

The loader automatically combines both sources and removes duplicates, so you
can mix API-driven and hand‑crafted cards.
