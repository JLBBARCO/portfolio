const windowWidth = 990;

document.addEventListener("DOMContentLoaded", () => {
  // Recupera o tamanho da fonte do cookie, se existir
  const fontSize = document.cookie
    .split("; ")
    .find((row) => row.startsWith("fontSize="))
    ?.split("=")[1];
  if (fontSize) {
    document.body.style.fontSize = fontSize;
  }

  // Garante que o menu esteja no estado correto ao carregar
  resize();
  window.addEventListener("resize", resize);

  // Adiciona o evento de clique ao botão do menu
  const menuButton = document.getElementById("menu-button");
  if (menuButton) {
    const menuIcon = document.getElementById("menu-icon");
    if (menuIcon) {
      menuIcon.classList.add("menu"); // Define o ícone inicial como "menu"
    }
    menuButton.addEventListener("click", toggleMenu);
  }

  // Adiciona eventos de acessibilidade
  const accessibilityButton = document.getElementById("accessibility-button");
  const increaseFontButton = document.getElementById("increase-font");
  const decreaseFontButton = document.getElementById("decrease-font");
  const resetFontButton = document.getElementById("reset-font");

  if (accessibilityButton) {
    accessibilityButton.addEventListener("click", accessibilityToggle);
  }
  if (increaseFontButton) {
    increaseFontButton.addEventListener("click", increaseFont);
  }
  if (decreaseFontButton) {
    decreaseFontButton.addEventListener("click", decreaseFont);
  }
  if (resetFontButton) {
    resetFontButton.addEventListener("click", resetFont);
  }

  // Fecha o menu de acessibilidade ao clicar fora dele
  document.addEventListener("click", (event) => {
    const accessibilityMenu = document.getElementById("accessibility-menu");
    const isClickInsideMenu = accessibilityMenu?.contains(event.target);
    const isClickOnButton = accessibilityButton?.contains(event.target);

    if (accessibilityMenu && !isClickInsideMenu && !isClickOnButton) {
      accessibilityMenu.style.display = "none";
    }
  });
});

function calcularIdade() {
  const nascimento = new Date("2008-09-24"); // exemplo
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

// Removido fetch incorreto para 'translations.json' — traduções
// são carregadas e aplicadas por `assets/js/translate.js`.

function resize() {
  const navLinks = document.querySelector(".nav-links");
  if (window.innerWidth > windowWidth) {
    navLinks.style.display = "flex";
  } else {
    navLinks.style.display = "none";
  }
}

function toggleMenu() {
  const navLinks = document.querySelector(".nav-links");
  const menuIcon = document.getElementById("menu-icon");

  if (navLinks.style.display === "grid") {
    navLinks.style.display = "none";
    menuIcon.classList.remove("close");
    menuIcon.classList.add("menu");
  } else {
    navLinks.style.display = "grid";
    menuIcon.classList.remove("menu");
    menuIcon.classList.add("close");
  }
}

function accessibilityToggle() {
  const accessibilityMenu = document.getElementById("accessibility-menu");
  if (accessibilityMenu) {
    if (accessibilityMenu.style.display === "flex") {
      accessibilityMenu.style.display = "none";
    } else {
      accessibilityMenu.style.display = "flex";
    }
  }
}

let fontSize = 1;
function increaseFont() {
  fontSize += 0.1;
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function decreaseFont() {
  fontSize -= 0.1;
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}

function resetFont() {
  fontSize = 1;
  document.body.style.fontSize = fontSize + "em";
  document.cookie = "fontSize=" + document.body.style.fontSize + "; path=/";
}
