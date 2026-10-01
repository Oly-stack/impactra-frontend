const menuToggle = document.querySelector(".iconOpen");
const mobileMenu = document.querySelector(".mobile-menu");
const iconOpen = document.querySelector(".icon-open");
const iconClose = document.querySelector(".icon-close");

menuToggle.addEventListener("click", () => {
  mobileMenu.classList.remove("translate-x-full");

  iconOpen.classList.add("hidden");
  iconClose.classList.remove("hidden");
});

iconClose.addEventListener("click", () => {
  mobileMenu.classList.add("translate-x-full");

  iconOpen.classList.remove("hidden");
  iconClose.classList.add("hidden");
});
