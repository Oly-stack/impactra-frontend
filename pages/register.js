document.addEventListener("DOMContentLoaded", () => {
  // Password Visibility Toggles
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
    });
  }

  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener("click", () => {
      const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      confirmPasswordInput.setAttribute("type", type);
    });
  }

  // Account Type Selection
  let selectedAccountType = "ngo";
  const ngoCard = document.getElementById("ngoCard");
  const volunteerCard = document.getElementById("volunteerCard");
  const ngoSelectedBadge = document.getElementById("ngoSelected");

  if (ngoCard && volunteerCard) {
    ngoCard.addEventListener("click", () => {
      selectedAccountType = "ngo";
      ngoCard.className =
        "account-card text-left rounded-2xl border-2 border-[#0051d5] bg-[#f0f2ff] p-5 shadow-sm cursor-pointer transition-all";
      volunteerCard.className =
        "account-card text-left rounded-2xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer transition-all hover:border-gray-300";

      if (ngoSelectedBadge) {
        ngoSelectedBadge.style.display = "flex";
      }
    });

    volunteerCard.addEventListener("click", () => {
      selectedAccountType = "volunteer";
      volunteerCard.className =
        "account-card text-left rounded-2xl border-2 border-[#0051d5] bg-[#f0f2ff] p-5 shadow-sm cursor-pointer transition-all";
      ngoCard.className =
        "account-card text-left rounded-2xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer transition-all hover:border-gray-300";

      if (ngoSelectedBadge) {
        ngoSelectedBadge.style.display = "none";
      }
    });
  }

  // Form Submission
  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const fullName = document.getElementById("fullName").value.trim();
      const email = document.getElementById("email").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (password !== confirmPassword) {
        alert("Passwords do not match. Please check and try again.");
        return;
      }

      const pendingUser = {
        fullName,
        email,
        phone: `+234${phone}`,
        accountType: selectedAccountType,
      };

      sessionStorage.setItem("pendingUser", JSON.stringify(pendingUser));

      // Redirect to email verification page
      window.location.href = "verify-email.html";
    });
  }
});