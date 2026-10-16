/* IMPACTRA — Register (NGO / Organization only) */
(() => {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);

  if (!window.API) {
    console.error("[register.js] API client not found.");
    return;
  }

  /*  TOAST  */
  function toast(message, variant = "default") {
    let host = $("#toast-host");
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

  /*  VALIDATION  */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function markInvalid(field, message) {
    if (!field) return;
    field.classList.add("ring-2", "ring-[#F43F5E]/60");
    field.focus();
    toast(message, "error");
  }
  function clearInvalid(field) {
    if (!field) return;
    field.classList.remove("ring-2", "ring-[#F43F5E]/60");
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
  const registerForm = $("#registerForm");
  if (!registerForm) { console.error("[register.js] #registerForm missing"); return; }

  const fullNameEl = $("#fullName");
  const emailEl    = $("#email");
  const phoneEl    = $("#phone");
  const passwordEl = $("#password");
  const confirmEl  = $("#confirmPassword");
  const submitBtn  = $("#submitBtn");

  /*  PASSWORD VISIBILITY  */
  $("#togglePassword")?.addEventListener("click", () => {
    const hidden = passwordEl.getAttribute("type") === "password";
    passwordEl.setAttribute("type", hidden ? "text" : "password");
  });
  $("#toggleConfirmPassword")?.addEventListener("click", () => {
    const hidden = confirmEl.getAttribute("type") === "password";
    confirmEl.setAttribute("type", hidden ? "text" : "password");
  });

  /*  CLEAR ERRORS ON INPUT  */
  [fullNameEl, emailEl, phoneEl, passwordEl, confirmEl].filter(Boolean).forEach((el) => {
    el.addEventListener("input", () => clearInvalid(el));
  });

  /*  SUBMIT  */
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = fullNameEl.value.trim();
    const email    = emailEl.value.trim();
    const password = passwordEl.value;
    const confirm  = confirmEl.value;

    if (!fullName) { markInvalid(fullNameEl, "Please enter your full name"); return; }
    if (!email || !EMAIL_RE.test(email)) { markInvalid(emailEl, "Please enter a valid email address"); return; }
    if (!password || password.length < 8) { markInvalid(passwordEl, "Password must be at least 8 characters"); return; }
    if (pwStrength(password) < 3) { markInvalid(passwordEl, "Password is too weak — add uppercase, numbers or symbols"); return; }
    if (password !== confirm) { markInvalid(confirmEl, "Passwords do not match"); return; }

    const payload = {
      name: fullName,
      email,
      password,
      accountType: "organization",
    };

    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account…";

    try {
      await API.auth.register(payload);

      // Persist what verify-email needs to know about this signup
      sessionStorage.setItem("pendingUser", JSON.stringify({
        fullName,
        email,
        accountType: "organization",
      }));
      sessionStorage.setItem("impactra_signup_email", email);

      toast("Account created — check your email to verify", "success");
      setTimeout(() => {
        const q = new URLSearchParams({ email, signup: "1" });
        window.location.href = `verify-email.html?${q.toString()}`;
      }, 700);
    } catch (err) {
      console.error("[register.js] Signup failed:", err);
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;

      const msg = err?.message || "Couldn't create account — please try again";
      const lower = msg.toLowerCase();
      if (lower.includes("email"))        markInvalid(emailEl, msg);
      else if (lower.includes("password")) markInvalid(passwordEl, msg);
      else toast(msg, "error");
    }
  });
})();