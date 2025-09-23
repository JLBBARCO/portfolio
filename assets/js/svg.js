document.addEventListener("DOMContentLoaded", function () {
  const icons = [
    // Normal Icons
    { className: "menu", src: "assets/icons/menu.svg", alt: "Menu Icon" },
    { className: "close", src: "assets/icons/close.svg", alt: "Close Icon" },
    // Tech Icons
    { className: "html5", src: "assets/icons/html5.svg", alt: "HTML5 Icon" },
    { className: "css3", src: "assets/icons/css3.svg", alt: "CSS3 Icon" },
    {
      className: "javascript",
      src: "assets/icons/javascript.svg",
      alt: "JavaScript Icon",
    },
    { className: "php", src: "assets/icons/php.svg", alt: "PHP Icon" },
    { className: "mysql", src: "assets/icons/mysql.svg", alt: "MySQL Icon" },
    { className: "python", src: "assets/icons/python.svg", alt: "Python Icon" },
    { className: "csharp", src: "assets/icons/csharp.svg", alt: "C# Icon" },
    { className: "java", src: "assets/icons/java.svg", alt: "Java Icon" },
    {
      className: "typescript",
      src: "assets/icons/typescript.svg",
      alt: "TypeScript Icon",
    },
    {
      className: "nodejs",
      src: "assets/icons/nodejs.svg",
      alt: "Node.js Icon",
    },
    {
      className: "arduino",
      src: "assets/icons/arduino.svg",
      alt: "Arduino Icon",
    },
    {
      className: "markdown",
      src: "assets/icons/markdown.svg",
      alt: "Markdown Icon",
    },
    // Platform/Tool Icons
    { className: "git", src: "assets/icons/git.svg", alt: "Git Icon" },
    {
      className: "github-tech",
      src: "assets/icons/github.svg",
      alt: "GitHub Icon",
    },
    {
      className: "vscode",
      src: "assets/icons/vscode.svg",
      alt: "VS Code Icon",
    },
    {
      className: "wordpress",
      src: "assets/icons/wordpress.svg",
      alt: "WordPress Icon",
    },
    // Social Media Icons
    {
      className: "mail",
      src: "assets/icons/mail.svg",
      alt: "Mail Icon",
    },
    {
      className: "linkedin",
      src: "assets/icons/linkedin.svg",
      alt: "LinkedIn Icon",
    },
    { className: "github", src: "assets/icons/github.svg", alt: "GitHub Icon" },
    {
      className: "facebook",
      src: "assets/icons/facebook.svg",
      alt: "Facebook Icon",
    },
    {
      className: "instagram",
      src: "assets/icons/instagram.svg",
      alt: "Instagram Icon",
    },
    {
      className: "youtube",
      src: "assets/icons/youtube.svg",
      alt: "YouTube Icon",
    },
    // Country Flags
    { className: "br", src: "assets/icons/br.svg", alt: "Brazil Flag" },
    { className: "uk", src: "assets/icons/uk.svg", alt: "UK Flag" },
    // Other Icons
    { className: "book", src: "assets/icons/book.svg", alt: "Book" },
  ];

  icons.forEach(({ className, src, alt }) => {
    const elements = document.querySelectorAll(`span.${className}`);
    elements.forEach((element) => {
      element.innerHTML = `<img src="${src}" alt="${alt}" class="icon" />`;
    });
  });
});
