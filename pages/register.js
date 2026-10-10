/* IMPACTRA — Register*/
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.API) {
    console.error("[register.js] API client not found. Did you load api.js first?");
  }

  /* Small toast helper */
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

  /* 1. Password Visibility Toggles*/
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput  = document.getElementById("password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      togglePassword.setAttribute("aria-pressed", String(type === "text"));
      togglePassword.setAttribute(
        "aria-label",
        type === "text" ? "Hide password" : "Show password"
      );
    });
  }

  const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
  const confirmPasswordInput  = document.getElementById("confirmPassword");

  if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener("click", () => {
      const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
      confirmPasswordInput.setAttribute("type", type);
      toggleConfirmPassword.setAttribute("aria-pressed", String(type === "text"));
      toggleConfirmPassword.setAttribute(
        "aria-label",
        type === "text" ? "Hide password" : "Show password"
      );
    });
  }

  /* 2. Account Type Selection*/
  let selectedAccountType = "ngo";
  const ngoCard         = document.getElementById("ngoCard");
  const volunteerCard   = document.getElementById("volunteerCard");
  const ngoSelectedBadge = document.getElementById("ngoSelected");

  const ACTIVE_CARD_CLASSES =
    "account-card text-left rounded-2xl border-2 border-[#0051d5] bg-[#f0f2ff] p-5 shadow-sm cursor-pointer transition-all";
  const INACTIVE_CARD_CLASSES =
    "account-card text-left rounded-2xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer transition-all hover:border-gray-300";

  if (ngoCard && volunteerCard) {
    ngoCard.addEventListener("click", () => {
      selectedAccountType = "ngo";
      ngoCard.className = ACTIVE_CARD_CLASSES;
      volunteerCard.className = INACTIVE_CARD_CLASSES;
      if (ngoSelectedBadge) ngoSelectedBadge.style.display = "flex";
      ngoCard.setAttribute("aria-pressed", "true");
      volunteerCard.setAttribute("aria-pressed", "false");
    });

    volunteerCard.addEventListener("click", () => {
      selectedAccountType = "volunteer";
      volunteerCard.className = ACTIVE_CARD_CLASSES;
      ngoCard.className = INACTIVE_CARD_CLASSES;
      if (ngoSelectedBadge) ngoSelectedBadge.style.display = "none";
      volunteerCard.setAttribute("aria-pressed", "true");
      ngoCard.setAttribute("aria-pressed", "false");
    });
  }

  /* 3. Validation helpers*/
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function markInvalid(field, message) {
    field.classList.add("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.remove("border-gray-200");
    field.focus();
    toast(message, "error");
  }

  function clearInvalid(field) {
    field.classList.remove("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.add("border-gray-200");
  }

  function pwStrength(pw) {
    let s = 0;
    if (pw.length >= 8)          s++;
    if (/[A-Z]/.test(pw))        s++;
    if (/[a-z]/.test(pw))        s++;
    if (/\d/.test(pw))           s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  /* 4. Form Submission*/
  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    // Clear error styling on input
    ["fullName", "email", "phone", "password", "confirmPassword"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => clearInvalid(el));
    });

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const fullNameEl = document.getElementById("fullName");
      const emailEl    = document.getElementById("email");
      const phoneEl    = document.getElementById("phone");

      const fullName        = fullNameEl?.value.trim() || "";
      const email           = emailEl?.value.trim() || "";
      const phone           = phoneEl?.value.trim() || "";
      const password        = passwordInput?.value || "";
      const confirmPassword = confirmPasswordInput?.value || "";

      //  Validate full name 
      if (!fullName) {
        markInvalid(fullNameEl, "Please enter your full name");
        return;
      }

      //  Validate email 
      if (!email || !EMAIL_RE.test(email)) {
        markInvalid(emailEl, "Please enter a valid email address");
        return;
      }

      //  Validate phone (digits only, min 10) 
      const digits = phone.replace(/\D/g, "");
      if (!digits || digits.length < 10) {
        markInvalid(phoneEl, "Please enter a valid phone number");
        return;
      }

      //  Validate password 
      if (!password || password.length < 8) {
        markInvalid(passwordInput, "Password must be at least 8 characters");
        return;
      }
      if (pwStrength(password) < 3) {
        markInvalid(passwordInput, "Password is too weak — add uppercase, numbers or symbols");
        return;
      }

      //  Confirm password 
      if (password !== confirmPassword) {
        markInvalid(confirmPasswordInput, "Passwords do not match");
        return;
      }

      //  Build payload for the API 
      const payload = {
        fullName,
        email,
        phone: `+234${digits}`,
        password,
        accountType: selectedAccountType, // "ngo" | "volunteer"
      };

      //  Submit 
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const original  = submitBtn ? submitBtn.innerHTML : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating account…";
      }

      try {
        // If the API client is missing, fall back to the old behavior
        if (!window.API) {
          sessionStorage.setItem("pendingUser", JSON.stringify({
            fullName,
            email,
            phone: payload.phone,
            accountType: selectedAccountType,
          }));
          window.location.href = "verify-email.html";
          return;
        }

        const res = await API.auth.register(payload);

        // We store whatever we get (if anything) but always route to verify-email
        try {
          if (res?.accessToken || res?.token) {
            API.tokens.set({
              accessToken: res.accessToken || res.token,
              refreshToken: res.refreshToken,
            });
          }
        } catch (_) { /* ignore token shape differences */ }

        // Persist just enough for the verify-email page to show the address
        sessionStorage.setItem("pendingUser", JSON.stringify({
          fullName,
          email,
          phone: payload.phone,
          accountType: selectedAccountType,
        }));

        toast("Account created — check your email to verify", "success");
        setTimeout(() => {
          window.location.href =
            `verify-email.html?email=${encodeURIComponent(email)}`;
        }, 700);
      } catch (err) {
        // Roll back the button and show the server's message
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
        }

        const msg = err?.message || "Couldn't create account — please try again";

        // Highlight the relevant field if the backend hints at the cause
        const lower = msg.toLowerCase();
        if (lower.includes("email")) {
          markInvalid(emailEl, msg);
        } else if (lower.includes("phone")) {
          markInvalid(phoneEl, msg);
        } else if (lower.includes("password")) {
          markInvalid(passwordInput, msg);
        } else {
          toast(msg, "error");
        }
      }
    });
  }
});