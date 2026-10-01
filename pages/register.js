lucide.createIcons();

const loginLink = document.querySelector("#loginLink");

loginLink.addEventListener("click", function (event) {
  event.preventDefault();

  document.body.classList.add("opacity-0");

  setTimeout(function () {
    window.location.href = "login.html";
  }, 200);
});

window.addEventListener("load", function () {
  document.body.classList.remove("opacity-0");
});
