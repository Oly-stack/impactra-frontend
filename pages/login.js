/* IMPACTRA — Login*/
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.API) {
    console.error("[login.js] API client not found. Did you load API.js first?");
  }

  /* Toast*/
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

  /* Validation helpers*/
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

  /* Password visibility toggle*/
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput  = document.getElementById("password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const isHidden = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isHidden ? "text" : "password");
      togglePassword.setAttribute("aria-pressed", String(isHidden));
      togglePassword.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
      );
    });
  }

  /* Load remembered email*/
  const emailInput = document.getElementById("email");
  const rememberBox = document.getElementById("remember");

  const REMEMBER_KEY = "impactra_remember_email";

  if (emailInput && rememberBox) {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        emailInput.value = saved;
        rememberBox.checked = true;
      }
    } catch (_) { /* ignore storage access errors */ }
  }

  /* Forgot password*/
  const forgotLink = Array.from(document.querySelectorAll("a")).find((a) =>
    /forgot\s*password/i.test(a.textContent || "")
  );

  forgotLink?.addEventListener("click", async (e) => {
    e.preventDefault();

    const email = emailInput?.value.trim() || "";
    if (!email || !EMAIL_RE.test(email)) {
      markInvalid(emailInput, "Enter your email first, then tap Forgot password");
      return;
    }

    const original = forgotLink.textContent;
    forgotLink.textContent = "Sending…";
    forgotLink.classList.add("pointer-events-none", "opacity-60");

    try {
      if (window.API) {
        await API.auth.forgotPassword(email);
      }
      toast("Password reset link sent — check your inbox", "success");
    } catch (err) {
      toast(err?.message || "Couldn't send reset link", "error");
    } finally {
      forgotLink.textContent = original;
      forgotLink.classList.remove("pointer-events-none", "opacity-60");
    }
  });

  /* Login form submission*/
  const loginForm = document.getElementById("loginForm");

  if (!loginForm) return;

  // Clear invalid state on input
  [emailInput, passwordInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => clearInvalid(el));
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email    = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    //  Validate 
    if (!email || !EMAIL_RE.test(email)) {
      markInvalid(emailInput, "Enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      markInvalid(passwordInput, "Enter your password");
      return;
    }

    //  Busy state 
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const original  = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add("opacity-80", "cursor-not-allowed");
      submitBtn.innerHTML = "Signing in…";
    }

    try {
      //  Call API 
      let res = null;
      if (window.API) {
        res = await API.auth.login(email, password);
      } else {
        // Offline fallback so the page still feels responsive during dev
        await new Promise((r) => setTimeout(r, 400));
      }

      //  Remember me 
      try {
        if (rememberBox?.checked) {
          localStorage.setItem(REMEMBER_KEY, email);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch (_) { /* ignore storage errors */ }

      // store user object for other pages 
      try {
        const user = res?.user || res?.data?.user;
        if (user) sessionStorage.setItem("impactra_user", JSON.stringify(user));
      } catch (_) { /* ignore */ }

      toast("Signed in — redirecting…", "success");

      
      // Adjust the destination to match your app's landing page
      const destination = "Dashboard.html";
      setTimeout(() => {
        window.location.href = destination;
      }, 600);

    } catch (err) {
      // Roll back button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-80", "cursor-not-allowed");
        submitBtn.innerHTML = original;
      }

      const msg = err?.message || "Couldn't sign in — please try again";
      const lower = msg.toLowerCase();

      if (lower.includes("email") && !lower.includes("password")) {
        markInvalid(emailInput, msg);
      } else if (lower.includes("password")) {
        markInvalid(passwordInput, msg);
      } else {
        toast(msg, "error");
      }

      // If credentials are simply wrong, focus the password field
      if (/invalid|incorrect|wrong/i.test(msg)) {
        passwordInput?.focus();
        passwordInput?.select();
      }
    }
  });

  /* Continue with Google (placeholder)*/
  const googleBtn = Array.from(document.querySelectorAll("button")).find((b) =>
    /continue with google/i.test(b.textContent || "")
  );

  googleBtn?.addEventListener("click", () => {
    //   window.location.href = `${API.BASE_URL}/auth/google`;
    toast("Google sign-in isn't wired up yet", "info");
  });
});