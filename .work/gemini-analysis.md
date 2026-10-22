# Análise da conversa compartilhada do Gemini

Fonte: https://share.gemini.google/9Kcn8A09WaaQ

A conversa recomenda uma detecção híbrida de tecnologias: usar a API `languages` do GitHub como sinal de linguagens, a árvore recursiva de arquivos para localizar assinaturas e manifestos, e dependências declaradas em `package.json`, `requirements.txt` ou `pyproject.toml` para reconhecer frameworks que não aparecem como linguagens. Ela sugere executar a coleta no servidor/cron da Vercel e entregar ao navegador os dados já armazenados, evitando chamadas GitHub por visitante. As regras exemplificadas incluem React, Next.js, Vue, Svelte, Tailwind CSS, TypeScript, FastAPI, Flask, Prisma, Docker e GitHub Actions.

A amostra da conversa usa `main` como branch padrão e URLs `raw.githubusercontent.com`; não se deve copiá-las literalmente. A implementação precisa usar o branch padrão real de cada repositório, lidar com manifestos ausentes e subpastas/monorepos e não classificar React apenas por `.jsx`/`.tsx`, pois extensões e nomes de arquivos são sinais, não prova. A árvore GitHub pode indicar truncamento e deve ser tratada sem produzir resultados parciais como se fossem completos. O endpoint `languages` identifica bytes de linguagens, não frameworks. Um token, se já configurado, deve permanecer exclusivamente no backend. Os dados do detector devem integrar o snapshot diário existente, sem consulta de GitHub no navegador.

## Verificação em documentação oficial e código atual

- A documentação da [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) diz que o cron faz GET ao caminho declarado em `vercel.json` e que a agenda usa UTC. No repositório, `/api/cron/update-site` está declarado como `0 0 * * *`, portanto a agenda diária existente deve ser preservada.
- A documentação do [GitHub Git Trees](https://docs.github.com/rest/git/trees) informa que a resposta recursiva pode ser truncada e limita a árvore a 100.000 entradas/7 MB; se `truncated` vier `true`, a implementação deve tratar o resultado como incompleto.
- O endpoint oficial [List repository languages](https://docs.github.com/rest/repos/repos#list-repository-languages) retorna bytes por linguagem, não frameworks. Assim, linguagens e frameworks devem permanecer dimensões distintas.
- A documentação do [Vercel Blob](https://vercel.com/docs/vercel-blob) confirma que é armazenamento de objetos durável, com leitura pública ou privada e autenticação de gravação. Porém, o projeto já usa o cache/CDN da Vercel e o cron diário; não se adicionou Blob nem outro serviço sem necessidade.
- Verificação final do código: `src/js/site-data.js` usa `/api/site-data` como endpoint padrão e faz uma única leitura por carregamento; `api/cron/update-site.js` continua chamando essa API. `api/site-data.js` agora mantém o JSON por 23 horas na CDN, com `stale-while-revalidate`; `vercel.json` não foi alterado.
