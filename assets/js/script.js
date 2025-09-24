const windowWidth = 990;

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
    menuIcon.innerHTML = `<img src="assets/icons/menu.svg" alt="Menu Icon" class="icon" />`;
  } else {
    navLinks.style.display = "grid";
    menuIcon.innerHTML = `<img src="assets/icons/close.svg" alt="Close Icon" class="icon" />`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Calcula a idade do desenvolvedor
  const date = new Date();
  const year = date.getFullYear();
  const devYear = 2008;
  const age = document.getElementById("age");

  if (age) {
    age.innerHTML = `${year - devYear}`;
  }

  // Garante que o menu esteja no estado correto ao carregar
  resize();
  window.addEventListener("resize", resize);

  // Define o ícone inicial do menu
  const menuIcon = document.getElementById("menu-icon");
  menuIcon.innerHTML = `<img src="assets/icons/menu.svg" alt="Menu Icon" class="icon" />`;
});
