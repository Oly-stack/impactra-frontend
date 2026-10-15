  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullNameEl = document.getElementById("fullName");
    const emailEl = document.getElementById("email");
    const password = passwordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    const fullName = fullNameEl?.value.trim() || "";
    const email = emailEl?.value.trim() || "";

    // Validate full name
    if (!fullName) {
      markInvalid(fullNameEl, "Please enter your full name");
      return;
    }

    // Validate email
    if (!email || !EMAIL_RE.test(email)) {
      markInvalid(emailEl, "Please enter a valid email address");
      return;
    }

    // Validate password
    if (!password || password.length < 8) {
      markInvalid(passwordInput, "Password must be at least 8 characters");
      return;
    }
    if (pwStrength(password) < 3) {
      markInvalid(passwordInput, "Password is too weak — add uppercase, numbers or symbols");
      return;
    }

    // Confirm password
    if (password !== confirmPassword) {
      markInvalid(confirmPasswordInput, "Passwords do not match");
      return;
    }

    // Build payload for the API (EXACTLY matching Postman 1.2)
    const payload = {
      name: fullName,
      email,
      password,
      accountType: "organization", // Hardcoded for NGO-only scope
    };

    // Submit
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const original = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account…";
    }

    try {
      if (!window.API) {
        console.error("API client not found");
        throw new Error("System error. Please refresh the page.");
      }

      // 1. Call the backend
      await window.API.auth.register(payload);

      // 2. Store pending user for the verify-email page
      sessionStorage.setItem(
        "pendingUser",
        JSON.stringify({
          fullName,
          email,
          accountType: "organization",
        }),
      );

      // 3. Redirect to email verification
      toast("Account created — check your email to verify", "success");
      setTimeout(() => {
        window.location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
      }, 700);

    } catch (err) {
      // Roll back the button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      }

      const msg = err?.message || "Couldn't create account — please try again";
      const lower = msg.toLowerCase();

      // Highlight the relevant field
      if (lower.includes("email")) {
        markInvalid(emailEl, msg);
      } else if (lower.includes("password")) {
        markInvalid(passwordInput, msg);
      } else {
        toast(msg, "error");
      }
    }
  });