/* IMPACTRA — Register */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.API) {
    console.error("[register.js] API client not found. Did you load API.js first?");
  }

  /* Toast */
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
      error:   "bg-[#991B1B] text-white",
      info:    "bg-[#1D4ED8] text-white",
    };
    const el = document.createElement("div");
    el.className = `pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${palette[variant]}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s ease, transform .25s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 260);
    }, 2800);
  }

  /* Password toggles */
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput  = document.getElementById("password");
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
    });
  }

  const toggleConfirm = document.getElementById("toggleConfirmPassword");
  const confirmInput  = document.getElementById("confirmPassword");
  if (toggleConfirm && confirmInput) {
    toggleConfirm.addEventListener("click", () => {
      const show = confirmInput.type === "password";
      confirmInput.type = show ? "text" : "password";
    });
  }

  /* Validation */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function markInvalid(field, message) {
    if (!field) { toast(message, "error"); return; }
    field.classList.add("ring-2", "ring-red-400");
    field.classList.remove("bg-[#f0f2ff]");
    field.classList.add("bg-red-50");
    field.focus();
    toast(message, "error");
  }

  function clearInvalid(field) {
    if (!field) return;
    field.classList.remove("ring-2", "ring-red-400", "bg-red-50");
    field.classList.add("bg-[#f0f2ff]");
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

  /* Submit */
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;

  ["fullName", "email", "phone", "password", "confirmPassword"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => clearInvalid(el));
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullNameEl = document.getElementById("fullName");
    const emailEl    = document.getElementById("email");
    const phoneEl    = document.getElementById("phone");   // optional
    const password   = passwordInput?.value || "";
    const confirmPw  = confirmInput?.value || "";

    const fullName = fullNameEl?.value.trim() || "";
    const email    = emailEl?.value.trim() || "";

    /* Validate */
    if (!fullName)                        return markInvalid(fullNameEl, "Please enter your full name");
    if (!email || !EMAIL_RE.test(email))  return markInvalid(emailEl, "Please enter a valid email address");
    if (!password || password.length < 8) return markInvalid(passwordInput, "Password must be at least 8 characters");
    if (pwStrength(password) < 3)         return markInvalid(passwordInput, "Password is too weak — add uppercase, numbers or symbols");
    if (password !== confirmPw)           return markInvalid(confirmInput, "Passwords do not match");

    /* Payload — matches backend spec exactly:
       { name, email, password, accountType }                        */
    const payload = {
      name: fullName,
      email,
      password,
      accountType: "organization",  // this page only registers NGOs
    };

    /* Busy state */
    const submitBtn = document.getElementById("submitBtn") ||
                      registerForm.querySelector('button[type="submit"]');
    const original  = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-70", "cursor-not-allowed");
      submitBtn.textContent = "Creating account…";
    }

    try {
      if (!window.API) throw new Error("API client not loaded");

      await API.auth.register(payload);

      /* Stash the email so verify-email can show it */
      try {
        sessionStorage.setItem("pendingUser", JSON.stringify({
          name: fullName,
          email,
          phone: phoneEl?.value.trim() || "",
          accountType: "organization",
        }));
      } catch (_) { /* ignore */ }

      toast("Account created — check your email for a code", "success");
      setTimeout(() => {
        window.location.href =
          `verify-email.html?email=${encodeURIComponent(email)}&signup=1`;
      }, 700);

    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
        submitBtn.innerHTML = original;
      }

      const msg = err?.message || "Couldn't create account — please try again";
      const lower = msg.toLowerCase();

      if (lower.includes("email") && (lower.includes("exist") || lower.includes("taken") || lower.includes("already"))) {
        markInvalid(emailEl, "This email is already registered. Try logging in.");
      } else if (lower.includes("account type") || lower.includes("accounttype")) {
        toast("Invalid account type — please contact support", "error");
      } else if (lower.includes("password")) {
        markInvalid(passwordInput, msg);
      } else if (lower.includes("name")) {
        markInvalid(fullNameEl, msg);
      } else {
        toast(msg, "error");
      }
    }
  });
});