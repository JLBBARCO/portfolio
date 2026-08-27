// Carregamento de dados computados no servidor (Vercel)
async function loadServerComputedData() {
  try {
    const response = await fetch('/api/github-data');
    const data = await response.json();
    
    if (data.profile) renderProfile(data.profile);
    if (data.projects) renderProjects(data.projects);
  } catch (err) {
    console.error("Erro ao carregar dados do servidor:", err);
  }
}

function renderProfile(profile) {
  // Exemplo de renderização do perfil
  const avatarEl = document.getElementById('avatar');
  if (avatarEl && profile.avatar_url) avatarEl.src = profile.avatar_url;
}

function renderProjects(projects) {
  // Exemplo de renderização de projetos
}

// Carregamento dos textos das áreas estáticas
async function loadAreaTexts() {
  try {
    const response = await fetch('/src/json/area/content.json');
    const areaData = await response.json();
    
    Object.keys(areaData).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        element.textContent = areaData[key];
      }
    });
  } catch (error) {
    console.error("Erro ao carregar arquivos da pasta src/json/area/:", error);
  }
}

// Gerenciador de imagens dinâmicas e suporte a <picture>
async function renderDynamicImages() {
  try {
    const response = await fetch('/src/json/areas/images.json');
    const imagesData = await response.json();

    Object.keys(imagesData).forEach(imageKey => {
      const container = document.getElementById(imageKey);
      if (!container) return;

      const imageData = imagesData[imageKey];
      container.innerHTML = ''; // Limpa o container anterior

      if (imageData.sources.length === 1) {
        // Regra 1: Apenas 1 link -> Renderiza <img> simples
        const img = document.createElement('img');
        const source = imageData.sources[0];
        
        img.src = source.src;
        img.alt = imageData.alt;
        if (source.width) img.setAttribute('width', source.width);
        if (source.height) img.setAttribute('height', source.height);
        
        container.appendChild(img);
      } else if (imageData.sources.length > 1) {
        // Regra 2: Múltiplos links -> Renderiza com <picture> e fontes dinâmicas
        const picture = document.createElement('picture');

        // Adiciona as tags <source> para as variações
        imageData.sources.slice(0, -1).forEach(source => {
          const sourceTag = document.createElement('source');
          sourceTag.srcset = source.src;
          if (source.media) sourceTag.media = source.media;
          if (source.width) sourceTag.setAttribute('width', source.width);
          if (source.height) sourceTag.setAttribute('height', source.height);
          picture.appendChild(sourceTag);
        });

        // Adiciona a imagem fallback final
        const fallbackSource = imageData.sources[imageData.sources.length - 1];
        const img = document.createElement('img');
        img.src = fallbackSource.src;
        img.alt = imageData.alt;
        if (fallbackSource.width) img.setAttribute('width', fallbackSource.width);
        if (fallbackSource.height) img.setAttribute('height', fallbackSource.height);

        picture.appendChild(img);
        container.appendChild(picture);
      }
    });
  } catch (error) {
    console.error("Erro ao carregar imagens:", error);
  }
}

// Correção do Bug de Troca de Idioma
function setupLanguageSwitcher() {
  const languageBtn = document.querySelector('#languageBtn');
  if (!languageBtn) return;

  let currentLang = 'pt'; // Idioma padrão

  languageBtn.addEventListener('click', async () => {
    currentLang = currentLang === 'pt' ? 'en' : 'pt';
    
    try {
      const response = await fetch(`/src/json/area/lang_${currentLang}.json`);
      const translations = await response.json();

      Object.keys(translations).forEach(selectorKey => {
        const targetElement = document.querySelector(selectorKey);
        
        if (targetElement) {
          // Substituição direta para evitar duplicação/concatenação
          targetElement.textContent = translations[selectorKey];
        }
      });

      languageBtn.setAttribute('data-current-lang', currentLang);
    } catch (error) {
      console.error("Erro ao alternar o idioma do site:", error);
    }
  });
}

// Inicialização das funções após o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
  loadAreaTexts();
  loadServerComputedData();
  renderDynamicImages();
  setupLanguageSwitcher();
});
