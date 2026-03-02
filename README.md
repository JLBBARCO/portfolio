# Portfolio

A portfolio showcasing my projects and the technologies I use daily.

This project contains the main projects I've developed and a brief summary of the technologies I use.

[Web site](https://portfolio-jlbbarco.vercel.app)

## Translation workflow 🈯

To make localization easier you no longer have to edit two separate JSON
files (`en-us.json` and `pt-br.json`). All strings are now stored in
`src/json/translate/strings.json`, which has the structure:

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
   `src/assets/img/tumbnail.webp` in the repository (via the raw.githubusercontent
   path). If that file exists the raw URL is used.
3. **No image** – if neither of the above yields a result the card is rendered
   without an image element, preventing empty placeholders.

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
