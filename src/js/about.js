function aboutMe() {
  const main = document.querySelector("main");
  if (!main) return;
  const section = document.createElement("section");
  section.id = "About_Me";
  // Marca a secao como dinamica para que o rebuild (troca de idioma) a remova
  // antes de recriar, em vez de acrescentar uma copia abaixo.
  section.dataset.dynamicSection = "true";

  const title = document.createElement("h2");
  title.id = "aboutMeTitle";
  title.setAttribute("data-i18n", "section_about_title");
  section.append(title);

  const container = document.createElement("article");
  container.className = "text-with-image";

  // A imagem de perfil (link + texto alternativo + dimensoes) vem de
  // src/json/areas/images.json, entregue pronta pelo snapshot da Vercel.
  // Um placeholder e inserido agora e substituido pelo <img>/<picture> assim
  // que o catalogo de imagens estiver disponivel.
  const profilePlaceholder = document.createElement("span");
  profilePlaceholder.className = "person";
  profilePlaceholder.dataset.imagePlaceholder = "profilePicture";
  container.append(profilePlaceholder);

  if (window.SiteImages && typeof window.SiteImages.create === "function") {
    window.SiteImages.create("profilePicture", {
      id: "profile",
      className: "person",
    })
      .then((element) => {
        if (!element || !profilePlaceholder.isConnected) return;
        profilePlaceholder.replaceWith(element);
        if (typeof initializeProfileImage === "function") {
          initializeProfileImage();
        }
      })
      .catch((error) =>
        console.warn("[about] Falha ao montar a imagem de perfil:", error),
      );
  }

  const containerText = document.createElement("div");
  containerText.className = "text";

  const text = document.createElement("p");
  text.id = "aboutMeText";
  text.setAttribute("data-i18n", "section_about_text");
  containerText.append(text);

  const containerLinks = document.createElement("div");
  containerLinks.className = "links";

  const downloadCV = document.createElement("a");
  downloadCV.type = "application/pdf";
  downloadCV.id = "linkDownloadCV";
  downloadCV.href = "#";
  downloadCV.ariaLabel = "Download CV";
  downloadCV.style.display = "none";

  const downloadTitle = document.createElement("h3");
  downloadTitle.id = "downloadCVTitle";
  downloadTitle.setAttribute("data-i18n", "action_download_cv");
  downloadCV.append(downloadTitle);
  containerLinks.append(downloadCV);
  containerText.appendChild(containerLinks);
  container.appendChild(containerText);

  section.appendChild(container);
  main.appendChild(section);
}
