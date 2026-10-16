/* IMPACTRA — Login (Two-step OTP flow) */
console.log("[login.js] Script loaded");

document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  console.log("[login.js] DOM ready");

  if (!window.API) {
    console.error("[login.js] API client not found. Load ../API.js first.");
  }

  /* ---------- TOAST ---------- */
  function toast(message, variant = "default") {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "pointer-events-none fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2";
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

  /* ---------- VALIDATION HELPERS ---------- */
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

  /* ---------- ELEMENTS ---------- */
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) {
    console.error("[login.js] #loginForm not found");
    return;
  }

  const credentialsStep = document.getElementById("credentialsStep");
  const otpStep         = document.getElementById("otpStep");
  const otpInputs       = Array.from(document.querySelectorAll(".otp-box"));
  const otpEmailDisplay = document.getElementById("otpEmailDisplay");
  const submitBtn       = document.getElementById("submitBtn");
  const submitBtnText   = document.getElementById("submitBtnText");
  const submitBtnArrow  = document.getElementById("submitBtnArrow");
  const backToLogin     = document.getElementById("backToLogin");
  const resendOtpBtn    = document.getElementById("resendOtpBtn");
  const emailInput      = document.getElementById("email");
  const passwordInput   = document.getElementById("password");
  const rememberBox     = document.getElementById("remember");
  const togglePassword  = document.getElementById("togglePassword");

  const REMEMBER_KEY = "impactra_remember_email";
  let currentEmail = "";
  let resendCooldown = 0;

  /* ---------- TOGGLE PASSWORD ---------- */
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const isHidden = passwordInput.getAttribute("type") === "password";
      passwordInput.setAttribute("type", isHidden ? "text" : "password");
      togglePassword.textContent = isHidden ? "Hide" : "Show";
    });
  }

  /* ---------- REMEMBER ME ---------- */
  if (emailInput && rememberBox) {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        emailInput.value = saved;
        rememberBox.checked = true;
      }
    } catch (_) {}
  }

  /* ---------- CLEAR INVALID ON INPUT ---------- */
  [emailInput, passwordInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => clearInvalid(el));
  });

  /* ---------- OTP INPUT AUTO-TAB ---------- */
  otpInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "");
      if (input.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) otpInputs[index - 1].focus();
      if (e.key === "ArrowLeft" && index > 0) otpInputs[index - 1].focus();
      if (e.key === "ArrowRight" && index < otpInputs.length - 1) otpInputs[index + 1].focus();
    });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").trim();
      if (pasted.length === 6) {
        pasted.split("").forEach((char, i) => { if (otpInputs[i]) otpInputs[i].value = char; });
        otpInputs[otpInputs.length - 1].focus();
      }
    });
  });

  function getOtpCode() {
    return otpInputs.map((i) => i.value.trim()).join("");
  }

  function setOtpLoading(loading) {
    otpInputs.forEach((i) => (i.disabled = loading));
  }

  function clearOtp() {
    otpInputs.forEach((i) => (i.value = ""));
    otpInputs[0]?.focus();
  }

  /* ---------- STEP TRANSITIONS ---------- */
  function showOtpStep(email) {
    currentEmail = email;
    otpEmailDisplay.textContent = email;
    credentialsStep.classList.add("hidden");
    otpStep.classList.remove("hidden");
    submitBtnText.textContent = "Verify OTP";
    submitBtnArrow.classList.add("hidden");
    clearOtp();
    setTimeout(() => otpInputs[0]?.focus(), 100);
  }

  function showCredentialsStep() {
    otpStep.classList.add("hidden");
    credentialsStep.classList.remove("hidden");
    submitBtnText.textContent = "Log in";
    submitBtnArrow.classList.remove("hidden");
    clearInvalid(passwordInput);
    clearOtp();
  }

  backToLogin?.addEventListener("click", showCredentialsStep);

  /* ---------- RESEND OTP ---------- */
  resendOtpBtn?.addEventListener("click", async () => {
    if (resendCooldown > 0) return;
    if (!currentEmail) {
      toast("No email on file", "error");
      return;
    }

    const originalText = resendOtpBtn.textContent;
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = "Sending…";

    try {
      if (window.API) {
        await API.auth.resendEmail(currentEmail, "login");
      }
      toast("A new login code is on its way", "success");

      resendCooldown = 60;
      const tick = () => {
        if (resendCooldown <= 0) {
          resendOtpBtn.disabled = false;
          resendOtpBtn.textContent = originalText;
          return;
        }
        resendOtpBtn.textContent = `Resend in ${resendCooldown}s`;
        resendCooldown--;
        setTimeout(tick, 1000);
      };
      tick();
    } catch (err) {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = originalText;
      toast(err.message || "Couldn't resend code", "error");
    }
  });

  /* ---------- SUBMIT (Two-step) ---------- */
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("[login.js] Form submitted");

    /* =============== STEP 1: Email + Password =============== */
    if (!credentialsStep.classList.contains("hidden")) {
      const email = emailInput?.value.trim() || "";
      const password = passwordInput?.value || "";

      if (!email || !EMAIL_RE.test(email)) {
        markInvalid(emailInput, "Enter a valid email address");
        return;
      }
      if (!password || password.length < 6) {
        markInvalid(passwordInput, "Enter your password");
        return;
      }

      const originalText = submitBtnText.textContent;
      submitBtn.disabled = true;
      submitBtnText.textContent = "Signing in…";

      try {
        if (!window.API) throw new Error("API not loaded");

        console.log("[login.js] Step 1: calling /auth/login");
        const res = await API.auth.login(email, password);
        console.log("[login.js] Login step 1 response:", res);

        /* Remember me */
        try {
          if (rememberBox?.checked) localStorage.setItem(REMEMBER_KEY, email);
          else localStorage.removeItem(REMEMBER_KEY);
        } catch (_) {}

        /* If backend requires OTP */
        if (res?.requiresOTP) {
          toast("OTP sent to your email", "info");
          showOtpStep(email);
        } else if (res?.token) {
          // Fallback — some backends return a token directly
          API.tokens.set({ accessToken: res.token, refreshToken: res.refreshToken });
          sessionStorage.setItem("impactra_user", JSON.stringify(res.user || {}));
          toast("Signed in — redirecting…", "success");
          const dest = res?.user?.role === "platform_admin"
            ? "admin-dashboard.html"
            : "../Dashboard.html";
          setTimeout(() => (window.location.href = dest), 600);
        } else {
          toast("Unexpected response from server", "error");
        }
      } catch (err) {
        console.error("[login.js] Step 1 error:", err);
        const msg = err?.message || "Couldn't sign in — please try again";
        const lower = msg.toLowerCase();
        if (lower.includes("email")) markInvalid(emailInput, msg);
        else if (lower.includes("password")) markInvalid(passwordInput, msg);
        else toast(msg, "error");
      } finally {
        submitBtn.disabled = false;
        if (!credentialsStep.classList.contains("hidden")) {
          submitBtnText.textContent = originalText;
        }
      }
      return;
    }

    /* =============== STEP 2: Verify OTP =============== */
    const code = getOtpCode();
    if (code.length !== 6) {
      toast("Please enter all 6 digits", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtnText.textContent = "Verifying…";
    setOtpLoading(true);

    try {
      console.log("[login.js] Step 2: calling /auth/verify-login with", { email: currentEmail, code: "***" });
      const res = await API.auth.verifyLogin(currentEmail, code);
      console.log("[login.js] Verify-login response:", res);

      /* Token saving is handled inside API.auth.verifyLogin now,
         but keep this as a belt-and-braces fallback. */
      const token = res?.token || res?.accessToken;
      if (token && !API.tokens.access) {
        API.tokens.set({
          accessToken: token,
          refreshToken: res.refreshToken,
        });
      }

      /* Store user */
      try {
        const user = res?.user || res?.data?.user;
        if (user) sessionStorage.setItem("impactra_user", JSON.stringify(user));
      } catch (_) {}

      toast("Signed in — redirecting…", "success");

      /* Role-based routing */
      const userRole = res?.user?.role || res?.data?.user?.role;
      let destination = "../Dashboard.html";
      if (userRole === "platform_admin") destination = "admin-dashboard.html";

      setTimeout(() => (window.location.href = destination), 600);
    } catch (err) {
      console.error("[login.js] Step 2 error:", err);
      submitBtn.disabled = false;
      submitBtnText.textContent = "Verify OTP";
      setOtpLoading(false);
      clearOtp();
      toast(err?.message || "Invalid or expired code", "error");
    }
  });

  console.log("[login.js] Submit listener attached ✓");
});