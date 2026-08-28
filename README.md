# Portfólio - Jose Luiz B. Barco

## Arquitetura de dados

Perfil, projetos, tecnologias e a cor do tema (calculada a partir da imagem de
perfil) são computados na Vercel e atualizados de hora em hora. O navegador faz
apenas uma leitura de JSON pronto por carregamento.

Detalhes completos: **[ARQUITETURA.md](ARQUITETURA.md)**.

| Script                     | Descrição                                                  |
| -------------------------- | ---------------------------------------------------------- |
| `npm run dev`              | Servidor local com as rotas `/api` ativas                  |
| `npm run snapshot`         | Regenera `src/json/site-snapshot.json` (consulta o GitHub) |
| `npm run snapshot:offline` | Regenera o snapshot sem rede                               |

---

# Translation System Documentation

## Overview

Automatic translation system powered by **MyMemory Translation API** (100% free, no setup required).

## Available Documents

- **[TRANSLATION.md](TRANSLATION.md)** - Detailed usage and workflow guide

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add translation keys to your code
<h1 data-i18n="section_title">Title</h1>

# 3. Auto-translate missing keys
npm run i18n:translate-missing
```

**That's it.** No API keys, account signup, or extra configuration required.

## Main Features

- **Zero Setup** - Works immediately
- **100% Free** - No commercial limits for basic usage
- **Automatic Translation** - MyMemory API (10k words/day)
- **Smart Inference** - Converts key names into readable text
- **Single Source File** - Keep only `strings.json`

## NPM Scripts

| Script                           | Description                                     |
| -------------------------------- | ----------------------------------------------- |
| `npm run i18n:sync`              | Sync keys without translating                   |
| `npm run i18n:translate-missing` | **Recommended** Translate only newly found keys |
| `npm run i18n:translate`         | Force translation of all empty keys             |

## Support

For issues or questions, see the complete guide in [TRANSLATION.md](TRANSLATION.md).
