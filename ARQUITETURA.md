# Arquitetura de dados do portfólio

Tudo que é dinâmico é calculado **no servidor (Vercel)** durante a atualização
diária. O endpoint guarda o snapshot na CDN da Vercel; o navegador só lê o JSON
pronto e não chama `api.github.com` nem analisa os repositórios.

## Fluxo

```
Vercel Cron ──diário──> /api/cron/update-site ──> /api/site-data (CDN, 23h)
                                                        │
GitHub API ──perfil/repos/tree──> lib/github-snapshot.js │
raw.githubusercontent.com ─manifestos──> detector ──────┤
                                                        ├──> navegador (1 fetch por carregamento)
                                                        └──> src/json/site-snapshot.json (reserva versionada)
```

## O que o servidor calcula

| Dado                    | Onde                                       | Observação                                                         |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| Perfil (avatar, bio)    | `lib/site-snapshot.js`                     | Avatar entra em `images.profilePicture` quando `dynamic: true`     |
| Cards de projetos       | `lib/site-snapshot.js`                     | Filtro, dedupe, stack, datas e ordenação por manutenção            |
| Imagem de cada projeto  | `lib/site-snapshot.js`                     | `HEAD` no servidor: `images.json` → thumbnail do repo → screenshot |
| Tecnologias agrupadas   | `buildTechnologyGroups`                    | Junta projetos + formações e agrupa por stack                      |
| Tecnologias por projeto | `lib/technology-detector.js`               | Árvore recursiva e manifestos limitados, sem executar arquivos      |
| Cor de destaque do tema | `lib/image-color.js`                       | Decodificador PNG puro em Node; média ponderada por alfa           |
| Catálogo de imagens     | `src/json/areas/images.json` (normalizado) | Define `render: "img" \| "picture"` conforme o número de fontes    |

## Atualização diária

- `vercel.json` mantém `/api/cron/update-site` em `0 0 * * *` (meia-noite UTC).
  O cron chama `/api/site-data` para aquecer a CDN; essa automação permanece no
  servidor e não move a consulta do GitHub para o navegador.
- `/api/site-data` envia `Cache-Control: public, s-maxage=82800,
  stale-while-revalidate=604800` e `CDN-Cache-Control` com TTL de 23 horas. A
  CDN armazena o JSON; `stale-while-revalidate` mantém a última versão pronta
  enquanto a seguinte é regenerada.
- O navegador continua fazendo um único `fetch` do endpoint da Vercel por
  carregamento. O snapshot versionado em `src/json/site-snapshot.json` é a
  reserva para preview estático e para erros na montagem do snapshot.
- Se GitHub, a árvore de um repositório ou algum manifesto não puder ser lido,
  o snapshot registra a cobertura parcial e os avisos sem interromper a exibição
  dos dados que já foram obtidos.

## Detecção automática de tecnologias

- `lib/github-snapshot.js` consulta a árvore recursiva do branch padrão apenas
  para os repositórios usados como projetos. Se o GitHub marca a árvore como
  truncada, o detector informa `tree-truncated` em vez de inventar conclusões.
- `lib/technology-detector.js` combina nomes/caminhos de arquivos com até três
  manifestos selecionados (por exemplo, `package.json`, `pyproject.toml`,
  `requirements.txt`, `go.mod` e `Cargo.toml`). Os manifestos são buscados como
  texto limitado e **nunca executados**.
- O snapshot inclui `technologyDetection.status`, a lista `technologies` e as
  evidências usadas. `lib/site-snapshot.js` une os nomes confirmados às
  linguagens, tópicos e tecnologias existentes; os mesmos dados chegam ao
  cliente pelo JSON cacheado na Vercel.
- Uma árvore truncada, limite de requisições ou falha de leitura aparece como
  cobertura parcial. A reserva local versionada e os rótulos manuais não são
  removidos.

## Regeneração do snapshot versionado

```bash
npm run snapshot            # consulta o GitHub e grava src/json/site-snapshot.json
npm run snapshot:offline    # reaproveita src/json/github-snapshot.json (sem rede)
```

## Cliente

| Arquivo                 | Papel                                                                     |
| ----------------------- | ------------------------------------------------------------------------- |
| `src/js/site-data.js`   | Um único `fetch` de `/api/site-data` por carregamento, memoizado          |
| `src/js/site-images.js` | Monta `<img>`/`<picture>` a partir de `src/json/areas/images.json`        |
| `src/js/translate.js`   | Único sistema de textos: `src/json/translate/strings.json` (`data-i18n`)   |

O que foi **removido** do navegador: `github-client.js`, cache em
`localStorage`/`sessionStorage` dos dados do GitHub, orçamento/limite de
requisições, circuit breaker, verificação de imagem via `HEAD` e as rotas
proxy `api/github*.js`.

Em hospedagem estática (Live Server, `file://`) a rota `/api` não existe e o
cliente cai automaticamente para `src/json/site-snapshot.json`. Para evitar o
`404` no console nesse cenário, use:

```html
<body data-site-data-endpoint="off"></body>
```

## Imagens fixas (`src/json/areas/images.json`)

```json
{
  "images": {
    "logo": {
      "alt": { "pt-BR": "Logotipo", "en-US": "Logo" },
      "class": "logo",
      "loading": "lazy",
      "sources": [
        {
          "src": "src/assets/img/logo.avif",
          "type": "image/avif",
          "width": 240,
          "height": 80
        },
        {
          "src": "src/assets/img/logo.webp",
          "type": "image/webp",
          "width": 240,
          "height": 80
        },
        {
          "src": "src/assets/img/logo.png",
          "type": "image/png",
          "width": 240,
          "height": 80
        }
      ]
    }
  }
}
```

- **1 fonte** → gera `<img src alt width height>`.
- **2 ou mais** → gera `<picture>` com um `<source srcset type media width
height>` por fonte e a última como `<img>` de reserva.
- `width`/`height` vêm do JSON, evitando deslocamento de layout.
- `alt` aceita texto simples ou `{ "pt-BR": ..., "en-US": ... }` e é reaplicado
  na troca de idioma.
- Campos opcionais: `class`, `loading`, `decoding`, `fetchPriority`,
  `crossOrigin`, `country` (bandeiras), `dynamic` (recebe o avatar do GitHub).

Formas de uso:

```html
<!-- placeholder no HTML -->
<span data-image="logo" data-image-class="logo"></span>
```

```js
SiteImages.create("profilePicture", { id: "profile" }); // elemento pronto
SiteImages.src("faviconDark"); // apenas o link
SiteImages.flagSrc("BR"); // bandeira por código de país
```

## Correção da troca de idioma

Dois defeitos causavam **conteúdo acrescentado em vez de substituído** ao
clicar em `#languageBtn`:

1. `script.js` removia as seções dinâmicas por uma lista fixa de ids
   (`"Formations"`, `"AboutMe"`) que não correspondia aos ids reais
   (`"Formation"`, `"About_Me"`). Agora cada seção dinâmica é marcada com
   `data-dynamic-section="true"` e todas são removidas antes de recriar.
2. `translate.js` (`setTextPreserveSpans`) concatenava a tradução com o
   `innerHTML` existente. Agora os filhos originais de cada elemento são
   memorizados uma única vez (`WeakMap`), o conteúdo é reescrito do zero e só
   os filhos originais voltam.

Todos os textos continuam vindo de `src/json/translate/strings.json` através de
`src/js/translate.js`, incluindo o marcador `{{date}}`. Não existe nenhum
outro sistema de tradução no cliente.
