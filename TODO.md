# TODO — Redesign e automação do portfólio

- [ ] **Redesenhar o site sem descaracterizar sua identidade.** Analise o site atual e melhore seu design sem perder a essência; ele deve continuar reconhecível como o portfólio pessoal existente de Jose Luiz B. Barco, preservando identidade, conteúdo e essência atuais e tornando a apresentação e a navegação mais claras.
- [x] **Apresentar Jose Luiz B. Barco na página inicial.** A página inicial deve oferecer uma apresentação clara de Jose Luiz B. Barco e uma chamada principal para conhecer seus trabalhos.
- [ ] **Aprimorar o perfil e a apresentação profissional.** A seção de perfil ou “Sobre” deve apresentar trajetória, competências e posicionamento profissional, aproveitando o conteúdo existente e sem inventar informações biográficas.
- [x] **Destacar projetos com informação útil.** A galeria de projetos em destaque deve exibir imagens, descrições e links relevantes.
- [x] **Oferecer visualizações detalhadas dos projetos.** Cada projeto deve ter uma página ou visualização detalhada que apresente contexto, processo e resultados, usando informações disponíveis no site ou nas fontes do projeto.
- [ ] **Tornar a navegação responsiva e consistente.** A navegação deve ser simples e consistente entre as seções do portfólio e funcionar em dispositivos móveis, tablets e desktops.
- [x] **Facilitar o contato profissional.** A seção de contato deve apresentar meios diretos para iniciar uma conversa profissional.
- [x] **Completar o rodapé.** O rodapé deve reunir redes profissionais, informações essenciais e créditos.
- [ ] **Reforçar a hierarquia e o acabamento visual.** Revisar hierarquia visual, tipografia, espaçamentos e componentes preservando o conteúdo e a identidade reconhecível do site atual.
- [ ] **Cuidar de acessibilidade, desempenho e descoberta.** Manter boas práticas de acessibilidade e desempenho e aplicar SEO básico para facilitar o uso e a descoberta do site.
- [ ] **Adicionar media queries para cada viewport.** O site deve responder corretamente às telas de celulares, tablets e computadores; revisar os breakpoints e acrescentar ou ajustar regras `@media` para corrigir o layout em PC sem prejudicar o mobile.
  - As regras foram implementadas; a validação visual ficou pendente porque o preview local não aceitou a conexão (`EACCES`/timeout).
- [x] **Preservar a automação diária entre Vercel e GitHub.** A Vercel deve obter diariamente os dados pela API do GitHub, armazenar os dados na Vercel e o cliente deve consumir esses dados armazenados na Vercel. Manter o fluxo de automação existente e não transferir a consulta diária ao navegador do cliente.
- [x] **Analisar a conversa compartilhada do Google Gemini.** Analisar a conversa em https://share.gemini.google/9Kcn8A09WaaQ sobre o sistema que analisa arquivos dos repositórios e determina automaticamente as tecnologias usadas; aproveitar as decisões pertinentes e identificar incompatibilidades com o projeto atual.
- [x] **Implantar a detecção automática de tecnologias dos repositórios.** Analisar os arquivos dos repositórios e determinar automaticamente as tecnologias usadas, integrando os resultados ao fluxo de dados armazenados na Vercel para que o cliente os consuma sem análise manual.
