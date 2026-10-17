/* IMPACTRA — Login (2-step: credentials + OTP) */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  if (!window.API) {
    console.error("[login.js] API client not found. Did you load API.js first?");
  }

  /* Destinations  */
  const PATHS = {
    dashboard:    "../Dashboard.html",
    orgSetup:     "step1-profile.html",
    adminHome:    "../welcome-back.html",
  };

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

  /* Refs */
  const form            = document.getElementById("loginForm");
  const credentialsStep = document.getElementById("credentialsStep");
  const otpStep         = document.getElementById("otpStep");
  const otpEmailDisplay = document.getElementById("otpEmailDisplay");
  const emailInput      = document.getElementById("email");
  const passwordInput   = document.getElementById("password");
  const submitBtn       = document.getElementById("submitBtn");
  const submitBtnText   = document.getElementById("submitBtnText");
  const backToLoginBtn  = document.getElementById("backToLogin");
  const resendOtpBtn    = document.getElementById("resendOtpBtn");
  const rememberBox     = document.getElementById("remember");
  const otpInputs       = Array.from(document.querySelectorAll(".otp-box"));

  if (!form) return;

  /* State */
  let currentStep = "credentials";
  let pendingEmail = "";
  let resendCooldown = 0;

  /* Validation */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function markInvalid(field, message) {
    if (!field) { toast(message, "error"); return; }
    field.classList.add("ring-2", "ring-red-300", "border-red-400");
    field.focus();
    toast(message, "error");
  }

  function clearInvalid(field) {
    if (!field) return;
    field.classList.remove("ring-2", "ring-red-300", "border-red-400");
  }

  [emailInput, passwordInput].forEach((el) => {
    if (el) el.addEventListener("input", () => clearInvalid(el));
  });

  /* Password toggle */
  const togglePassword = document.getElementById("togglePassword");
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
      togglePassword.textContent = show ? "Hide" : "Show";
    });
  }

  /* Remembered email */
  const REMEMBER_KEY = "impactra_remember_email";
  try {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved && emailInput && rememberBox) {
      emailInput.value = saved;
      rememberBox.checked = true;
    }
  } catch (_) { /* ignore */ }

  /* OTP input behavior */
  otpInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "");
      if (input.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) otpInputs[index - 1].focus();
      else if (e.key === "ArrowLeft" && index > 0) otpInputs[index - 1].focus();
      else if (e.key === "ArrowRight" && index < otpInputs.length - 1) otpInputs[index + 1].focus();
      else if (e.key === "Enter") { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = ((e.clipboardData || window.clipboardData).getData("text") || "")
        .replace(/[^0-9]/g, "").trim();
      if (pasted.length === 6) {
        pasted.split("").forEach((c, i) => { if (otpInputs[i]) otpInputs[i].value = c; });
        otpInputs[otpInputs.length - 1].focus();
      }
    });
  });

  function getCode() { return otpInputs.map((i) => i.value.trim()).join(""); }
  function clearOtp() { otpInputs.forEach((i) => (i.value = "")); otpInputs[0]?.focus(); }

  /* Step transitions */
  function showOtpStep(email) {
  currentStep = "otp";
  pendingEmail = email;

  credentialsStep?.classList.add("hidden");
  otpStep?.classList.remove("hidden");
  if (otpEmailDisplay) otpEmailDisplay.textContent = email;

  /* re-enable the submit button that step 1 disabled */
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
  }

  if (submitBtnText) submitBtnText.textContent = "Verify code";
  otpInputs[0]?.focus();
}
function showCredentialsStep() {
  currentStep = "credentials";
  pendingEmail = "";

  otpStep?.classList.add("hidden");
  credentialsStep?.classList.remove("hidden");

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
  }

  if (submitBtnText) submitBtnText.textContent = "Log in";
  clearOtp();
}
  /* Destination by role */
   
  async function redirectAfterLogin(user) {
    const role = user?.role || user?.accountType || "";
    console.log("[login] role:", role, "user:", user);

    /* Platform admin */
    if (role === "platform_admin" || role === "admin") {
      window.location.href = PATHS.adminHome;
      return;
    }

    /* NGO admin — needs to check for an existing organization */
    if (role === "ngo_admin" || role === "organization") {
      let hasOrg = false;
      try {
        const res = await API.organization.getProfile();
        const org = res?.organization || res?.data?.organization || res?.data;
        hasOrg = Boolean(org?._id || org?.id);
      } catch (err) {
        const status = err?.status;
        const msg    = (err?.message || "").toLowerCase();
        hasOrg = !(status === 404 || /not found/i.test(msg));
      }
      window.location.href = hasOrg ? PATHS.dashboard : PATHS.orgSetup;
      return;
    }

    /* volunteer / fallback */
    window.location.href = PATHS.dashboard;
  }
  /* STEP 1 — credentials */
  async function submitCredentials() {
    const email    = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    if (!email || !EMAIL_RE.test(email)) return markInvalid(emailInput, "Enter a valid email address");
    if (!password)                      return markInvalid(passwordInput, "Enter your password");

    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-70", "cursor-not-allowed");
    if (submitBtnText) submitBtnText.textContent = "Signing in…";

    try {
      if (!window.API) throw new Error("API client not loaded");

      const res = await API.auth.login(email, password);

      /* Remember me */
      try {
        if (rememberBox?.checked) localStorage.setItem(REMEMBER_KEY, email);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch (_) { /* ignore */ }

      /* Backend variants:*/
      if (res?.token || res?.accessToken) {
        API.tokens.set({
          accessToken:  res.token || res.accessToken,
          refreshToken: res.refreshToken,
        });
        toast("Signed in — redirecting…", "success");
        return setTimeout(() => redirectAfterLogin(res.user), 500);
      }

      showOtpStep(email);
      toast("Code sent to your email", "success");

    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
        submitBtn.innerHTML = original;
        if (submitBtnText) submitBtnText.textContent = "Log in";
      }

      const msg = err?.message || "Couldn't sign in";
      const lower = msg.toLowerCase();

      if (lower.includes("password"))      markInvalid(passwordInput, msg);
      else if (lower.includes("email"))    markInvalid(emailInput, msg);
      else                                 toast(msg, "error");
    } finally {
      if (currentStep === "credentials" && submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
        if (submitBtnText) submitBtnText.textContent = "Log in";
      }
    }
  }

  /* STEP 2 — OTP */
  async function submitOtp() {
  const code = getCode();
  if (code.length !== 6) {
    toast("Please enter all 6 digits", "error");
    otpInputs.find((i) => !i.value)?.focus();
    return;
  }

  const original = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.classList.add("opacity-70", "cursor-not-allowed");
  if (submitBtnText) submitBtnText.textContent = "Verifying…";

  let otpOk = false;

  try {
    const res = await API.auth.verifyLogin(pendingEmail, code);
    otpOk = true;
    console.log("[login] verify-login response:", res);

    toast("Signed in — redirecting…", "success");

    const user = res?.user || res?.data?.user || {};
    await redirectAfterLogin(user);

  } catch (err) {
    console.error("[login] submitOtp error:", err);

    if (!otpOk) {
      /* The OTP itself was rejected — retryable */
      clearOtp();
      const msg = err?.message || "Invalid or expired code";
      if (/expired/i.test(msg)) {
        toast("Code expired — click 'Resend code' for a new one", "error");
      } else if (/invalid|incorrect|wrong/i.test(msg)) {
        toast("Wrong code — use the code from the newest login email", "error");
      } else {
        toast(msg, "error");
      }
      otpInputs.forEach((i) => {
        i.classList.add("border-red-400", "ring-2", "ring-red-200");
        setTimeout(() => i.classList.remove("border-red-400", "ring-2", "ring-red-200"), 2000);
      });
    } else {
      /* OTP succeeded but redirect failed — user is signed in, just not navigated */
      toast("Signed in, but couldn't reach the next page. Please refresh.", "error");
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-70", "cursor-not-allowed");
    submitBtn.innerHTML = original;
    if (submitBtnText) submitBtnText.textContent = "Verify code";
  }
}

async function redirectAfterLogin(user) {
  const role = (user?.role || user?.accountType || "")
    .toLowerCase()
    .replace(/[\s-]/g, "_");

  console.log("[login] redirect — role:", role, "user:", user);

  if (role === "platform_admin" || role === "admin") {
    window.location.replace(PATHS.adminHome);
    return;
  }

  if (role === "ngo_admin" || role === "organization" || role === "ngo") {
    let hasOrg = false;
    try {
      const res = await API.organization.getProfile();
      const org = res?.organization || res?.data?.organization || res?.data;
      hasOrg = Boolean(org?._id || org?.id);
      console.log("[login] getProfile — hasOrg:", hasOrg);
    } catch (err) {
      console.warn("[login] getProfile failed — assuming new user:", err?.status, err?.message);
      /* If we can't confirm an org exists, treat as new user */
      hasOrg = false;
    }
    const dest = hasOrg ? PATHS.dashboard : PATHS.orgSetup;
    console.log("[login] →", dest);
    window.location.replace(dest);
    return;
  }

  console.log("[login] unknown role → dashboard");
  window.location.replace(PATHS.dashboard);
}

  /* Form submit */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (currentStep === "credentials") submitCredentials();
    else                                submitOtp();
  });

  /* Back button */
  backToLoginBtn?.addEventListener("click", () => {
    showCredentialsStep();
  });

  /* Resend OTP */
  resendOtpBtn?.addEventListener("click", async () => {
    if (resendCooldown > 0 || !pendingEmail) return;

    const original = resendOtpBtn.textContent;
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = "Sending…";

    try {
      await API.auth.resendEmail(pendingEmail, "login");
      toast("New code sent", "success");
      resendCooldown = 30;
      const tick = () => {
        if (resendCooldown <= 0) {
          resendOtpBtn.disabled = false;
          resendOtpBtn.textContent = original;
          return;
        }
        resendOtpBtn.textContent = `Resend in ${resendCooldown}s`;
        resendCooldown--;
        setTimeout(tick, 1000);
      };
      tick();
    } catch (err) {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = original;
      toast(err?.message || "Couldn't resend code", "error");
    }
  });

  /* Forgot password — send reset code (simplest form) */
  const forgotLink = Array.from(document.querySelectorAll("a")).find((a) =>
    /forgot\s*password/i.test(a.textContent || "")
  );
  forgotLink?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = emailInput?.value.trim() || "";
    if (!email || !EMAIL_RE.test(email)) {
      return markInvalid(emailInput, "Enter your email first, then click Forgot password");
    }
    try {
      await API.auth.forgotPassword(email);
      toast("If that email exists, a reset code is on its way", "success");
    } catch (err) {
      toast(err?.message || "Couldn't send reset code", "error");
    }
  });

  /* If we arrived from verify-email (?verified=1), show a hint */
  const params = new URLSearchParams(window.location.search);
  if (params.get("verified") === "1") {
    const emailFromUrl = params.get("email");
    if (emailFromUrl && emailInput) emailInput.value = emailFromUrl;
    toast("Email verified — please log in", "success");
  }

  /* Global 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });
});