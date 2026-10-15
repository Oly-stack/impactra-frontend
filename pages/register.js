/* IMPACTRA — Register (NGO account creation) */
console.log("[register.js] Script loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[register.js] DOM ready");

  /*  API GUARD  */
  if (!window.API) {
    console.error(
      "[register.js] API client not found. Did you load ../API.js first?",
    );
  }

  /*  TOAST  */
  function toast(message, variant = "default") {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className =
        "pointer-events-none fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2";
      document.body.appendChild(host);
    }
    const palette = {
      default: "bg-[#0F172A] text-white",
      success: "bg-[#065F46] text-white",
      error: "bg-[#991B1B] text-white",
      info: "bg-[#1D4ED8] text-white",
    };
    const el = document.createElement("div");
    el.className = `pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${palette[variant]}`;
    el.setAttribute("role", "status");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s ease, transform .25s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 260);
    }, 2800);
  }

  /*  VALIDATION HELPERS  */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function markInvalid(field, message) {
    if (!field) return;
    field.classList.add("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.remove("border-gray-200");
    field.focus();
    toast(message, "error");
  }

  function clearInvalid(field) {
    if (!field) return;
    field.classList.remove("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.add("border-gray-200");
  }

  function pwStrength(pw) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  /*  ELEMENTS  */
  const registerForm = document.getElementById("registerForm");
  const fullNameEl = document.getElementById("fullName");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phone");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const togglePassword = document.getElementById("togglePassword");
  const toggleConfirmPassword = document.getElementById(
    "toggleConfirmPassword",
  );

  if (!registerForm) {
    console.error("[register.js] #registerForm not found in DOM!");
    return;
  }
  if (!fullNameEl || !emailEl || !passwordInput || !confirmPasswordInput) {
    console.error("[register.js] Missing required input fields", {
      fullNameEl,
      emailEl,
      passwordInput,
      confirmPasswordInput,
    });
    return;
  }

  console.log("[register.js] All fields found, attaching listeners");

  /*  PASSWORD VISIBILITY TOGGLES  */
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const isHidden = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isHidden ? "text" : "password");
    });
  }
  if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener("click", () => {
      const isHidden = confirmPasswordInput.getAttribute("type") === "password";
      confirmPasswordInput.setAttribute("type", isHidden ? "text" : "password");
    });
  }

  /*  CLEAR ERRORS ON INPUT  */
  [fullNameEl, emailEl, phoneEl, passwordInput, confirmPasswordInput]
    .filter(Boolean)
    .forEach((el) => {
      el.addEventListener("input", () => clearInvalid(el));
    });

  /*  SUBMIT  */
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("[register.js] Form submitted");

    const fullName = fullNameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    /* Validate full name */
    if (!fullName) {
      markInvalid(fullNameEl, "Please enter your full name");
      return;
    }

    /* Validate email */
    if (!email || !EMAIL_RE.test(email)) {
      markInvalid(emailEl, "Please enter a valid email address");
      return;
    }

    /* Validate password */
    if (!password || password.length < 8) {
      markInvalid(passwordInput, "Password must be at least 8 characters");
      return;
    }
    if (pwStrength(password) < 3) {
      markInvalid(
        passwordInput,
        "Password is too weak — add uppercase, numbers or symbols",
      );
      return;
    }

    /* Confirm password */
    if (password !== confirmPassword) {
      markInvalid(confirmPasswordInput, "Passwords do not match");
      return;
    }

    /* Build payload */
    const payload = {
      name: fullName,
      email,
      password,
      accountType: "organization",
    };

    /* Busy state */
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const original = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account…";
    }

    try {
      if (!window.API) {
        throw new Error("System error. Please refresh the page.");
      }

      console.log("[register.js] Calling API.auth.register with", {
        ...payload,
        password: "***",
      });
      await window.API.auth.register(payload);
      console.log("[register.js] Signup success");

      sessionStorage.setItem(
        "pendingUser",
        JSON.stringify({ fullName, email, accountType: "organization" }),
      );

      toast("Account created — check your email to verify", "success");
      setTimeout(() => {
        window.location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
      }, 700);
    } catch (err) {
      console.error("[register.js] Signup failed:", err);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      }

      const msg = err?.message || "Couldn't create account — please try again";
      const lower = msg.toLowerCase();

      if (lower.includes("email")) {
        markInvalid(emailEl, msg);
      } else if (lower.includes("password")) {
        markInvalid(passwordInput, msg);
      } else {
        toast(msg, "error");
      }
    }
  });

  console.log("[register.js] Submit listener attached ✓");
});
