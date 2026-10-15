  /*TWO-STEP LOGIN LOGIC*/
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  const credentialsStep = document.getElementById("credentialsStep");
  const otpStep = document.getElementById("otpStep");
  const otpInputs = Array.from(document.querySelectorAll(".otp-box"));
  const otpEmailDisplay = document.getElementById("otpEmailDisplay");
  const submitBtnText = document.getElementById("submitBtnText");
  const submitBtnArrow = document.getElementById("submitBtnArrow");
  const backToLogin = document.getElementById("backToLogin");
  const resendOtpBtn = document.getElementById("resendOtpBtn");

  let currentEmail = "";
  let resendCooldown = 0;

  // Clear invalid state on input
  [emailInput, passwordInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => clearInvalid(el));
  });

  // OTP Auto-Tab Logic
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

  // Handle Step 1 -> Step 2 Transition
  function showOtpStep(email) {
    currentEmail = email;
    otpEmailDisplay.textContent = email;
    credentialsStep.classList.add("hidden");
    otpStep.classList.remove("hidden");
    submitBtnText.textContent = "Verify OTP";
    submitBtnArrow.classList.add("hidden");
    clearOtp();
    otpInputs[0]?.focus();
  }

  // Handle Back button
  backToLogin?.addEventListener("click", () => {
    otpStep.classList.add("hidden");
    credentialsStep.classList.remove("hidden");
    submitBtnText.textContent = "Log in";
    submitBtnArrow.classList.remove("hidden");
    clearInvalid(passwordInput);
  });

  // Handle Resend OTP
  resendOtpBtn?.addEventListener("click", async () => {
    if (resendCooldown > 0) return;
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

  // MAIN FORM SUBMISSION
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    const originalText = submitBtnText.textContent;

     
    // STEP 1: Login with Email + Password
  
    if (credentialsStep.classList.contains("hidden") === false) {
      const email = emailInput?.value.trim() || "";
      const password = passwordInput?.value || "";

      if (!email || !EMAIL_RE.test(email)) { markInvalid(emailInput, "Enter a valid email address"); return; }
      if (!password || password.length < 6) { markInvalid(passwordInput, "Enter your password"); return; }

      submitBtn.disabled = true;
      submitBtnText.textContent = "Signing in…";

      try {
        // Call Backend: POST /auth/login
        const res = await API.auth.login(email, password);
        
        // Remember me
        try {
          if (rememberBox?.checked) localStorage.setItem(REMEMBER_KEY, email);
          else localStorage.removeItem(REMEMBER_KEY);
        } catch (_) {}

        // Check if backend requires OTP
        if (res?.requiresOTP) {
          toast("OTP sent to your email", "info");
          showOtpStep(email);
        } else {
          // Fallback if backend doesn't require OTP (unlikely but possible)
          toast("Signed in — redirecting…", "success");
          window.location.href = "../Dashboard.html";
        }
      } catch (err) {
        const msg = err?.message || "Couldn't sign in — please try again";
        const lower = msg.toLowerCase();
        if (lower.includes("email")) markInvalid(emailInput, msg);
        else if (lower.includes("password")) markInvalid(passwordInput, msg);
        else toast(msg, "error");
      } finally {
        submitBtn.disabled = false;
        if (credentialsStep.classList.contains("hidden") === false) {
          submitBtnText.textContent = originalText;
        }
      }
      return;
    }

  
    // STEP 2: Verify OTP
    const code = getOtpCode();
    if (code.length !== 6) { toast("Please enter all 6 digits", "error"); return; }

    submitBtn.disabled = true;
    submitBtnText.textContent = "Verifying…";
    setOtpLoading(true);

    try {
      // Call Backend: POST /auth/verify-login
      const res = await API.auth.verifyLogin(currentEmail, code);
      
      // Save Token
      API.tokens.set({
        accessToken: res.token || res.accessToken,
        refreshToken: res.refreshToken,
      });

      // Store user for other pages
      try {
        const user = res?.user || res?.data?.user;
        if (user) sessionStorage.setItem("impactra_user", JSON.stringify(user));
      } catch (_) {}

      toast("Signed in — redirecting…", "success");

      // Role-Based Routing
      const userRole = res?.user?.role || res?.data?.user?.role;
      let destination = "../Dashboard.html"; // Default for NGO Admin
      
      if (userRole === "platform_admin") {
        destination = "admin-dashboard.html"; // We'll build this next
      }

      setTimeout(() => { window.location.href = destination; }, 600);

    } catch (err) {
      submitBtn.disabled = false;
      submitBtnText.textContent = "Verify OTP";
      setOtpLoading(false);
      clearOtp();
      toast(err?.message || "Invalid or expired code", "error");
    }
  });