function aboutMe() {
  const main = document.querySelector("main");
  if (!main) return;
  const section = document.createElement("section");
  section.id = "AboutMe";

  const title = document.createElement("h2");
  title.id = "aboutMeTitle";
  title.setAttribute("data-i18n", "section_about_title");
  section.append(title);

  const container = document.createElement("article");
  container.className = "text-with-image";

  const profileImage = document.createElement("img");
  profileImage.src = "https://avatars.githubusercontent.com/u/159829462?v=4";
  profileImage.alt = "Profile Image";
  profileImage.id = "profile";
  profileImage.setAttribute("data-i18n", "aria_profile_alt");
  profileImage.setAttribute("data-i18n-attr", "alt");
  profileImage.crossOrigin = "anonymous";
  profileImage.className = "person";
  profileImage.loading = "lazy";
  container.append(profileImage);

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
