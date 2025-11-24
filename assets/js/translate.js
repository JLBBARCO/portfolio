// Sistema de tradução simples usando JSON
let currentLanguage = "pt";
let translations = {};

// Função para obter cookie por nome
function getCookie(name) {
  const nameEQ = name + "=";
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length);
    }
  }
  return null;
}

// Função para definir cookie
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// Função para carregar os arquivos de tradução
async function loadTranslations() {
  try {
    const enResponse = await fetch("assets/json/translate/en/translation.json");
    const ptResponse = await fetch("assets/json/translate/pt/translation.json");

    translations.en = await enResponse.json();
    translations.pt = await ptResponse.json();

    // Verifica se há linguagem salva em cookie
    const savedLanguage = getCookie("language");
    if (savedLanguage && (savedLanguage === "pt" || savedLanguage === "en")) {
      currentLanguage = savedLanguage;
    }

    // Aplica a tradução padrão
    applyTranslations(currentLanguage);

    // Atualiza o seletor de idioma com a linguagem salva
    updateLanguageSelector();
  } catch (error) {
    console.error("Erro ao carregar traduções:", error);
  }
}

// Função para obter a tradução de uma chave
function t(key) {
  return translations[currentLanguage]?.[key] || key;
}

// Função para aplicar traduções ao DOM
function applyTranslations(language) {
  currentLanguage = language;

  // Salva a linguagem em cookie
  setCookie("language", language);

  // Helper: atualiza texto preservando spans (ex: bandeiras dentro de opções)
  function setTextPreserveSpans(element, text) {
    // substitui placeholder de idade se existir
    const age = calcularIdade();
    if (typeof text === "string") {
      text = text.replace(/\{\{age\}\}/g, age);
    }
    const childElements = Array.from(element.children || []);
    const onlySpans =
      childElements.length === 0 ||
      childElements.every((c) => c.tagName.toLowerCase() === "span");

    if (onlySpans) {
      const spans = childElements; // either empty or array of spans
      if (spans.length > 0) {
        const spansHTML = spans.map((s) => s.outerHTML).join(" ");
        element.innerHTML = text + (spansHTML ? " " + spansHTML : "");
      } else {
        element.textContent = text;
      }
    } else {
      // elemento possui filhos além de <span> — não sobrescrever a estrutura, apenas
      // atualizar texto direto (remove nós de texto anteriores)
      // procura primeiro nó de texto ou cria um
      let textNode = Array.from(element.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE
      );
      if (textNode) {
        textNode.nodeValue = text;
      } else {
        // insere no início
        element.insertBefore(document.createTextNode(text), element.firstChild);
      }
    }
  }

  // Atualiza elementos com data-i18n
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const translation = t(key);
    const tag = element.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") {
      element.value = translation;
      element.placeholder = translation;
    } else if (tag === "BUTTON") {
      setTextPreserveSpans(element, translation);
    } else {
      setTextPreserveSpans(element, translation);
    }
  });

  // Atualiza elementos com ID de tradução (welcome_title, welcome_message, etc)
  Object.keys(translations[currentLanguage]).forEach((key) => {
    const element = document.getElementById(key);
    if (element) {
      // Se for o título da página, atualiza também document.title
      if (key === "webTitle") {
        document.title = t(key);
      }
      setTextPreserveSpans(element, t(key));
    }
  });
}

// Função para atualizar o seletor de idioma
function updateLanguageSelector() {
  const languageMenu = document.getElementById("language-menu");
  if (languageMenu) {
    if (currentLanguage === "pt") {
      languageMenu.value = "pt-BR";
    } else if (currentLanguage === "en") {
      languageMenu.value = "en-US";
    }
  }
}

// Calcula idade (mesma lógica usada em `script.js`)
function calcularIdade() {
  const nascimento = new Date("2008-09-24");
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// Função para mudar de idioma
function language() {
  const languageMenu = document.getElementById("language-menu");
  const selectedLanguage = languageMenu.value;
  const downloadCV = document.getElementById("linkDownloadCV");

  if (selectedLanguage === "pt-BR") {
    applyTranslations("pt");

    const linkToCV = "assets/Curriculo_Jose_Luiz_Bruiani_Barco_pt-BR.pdf";
    if (downloadCV) {
      downloadCV.href = linkToCV;
      downloadCV.setAttribute("download", linkToCV.split("/").pop());
    }
  } else if (selectedLanguage === "en-US") {
    applyTranslations("en");

    const linkToCV = "assets/Resume_Jose_Luiz_Bruiani_Barco_en-US.pdf";
    if (downloadCV) {
      downloadCV.href = linkToCV;
      downloadCV.setAttribute("download", linkToCV.split("/").pop());
    }
  }
}

// Carrega as traduções quando o DOM está pronto
document.addEventListener("DOMContentLoaded", loadTranslations);
