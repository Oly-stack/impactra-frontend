const signUpLink = document.querySelector("#signUpLink");

signUpLink.addEventListener("click", function (event) {
  event.preventDefault();

  document.body.classList.add("opacity-0");

  setTimeout(function () {
    window.location.href = "register.html";
  }, 200);
});
