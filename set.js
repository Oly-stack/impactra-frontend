/*IMPACTRA — Settings*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase()
        .includes(text.toLowerCase())
    );

  /*0. TOAST*/
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

  /*1. MOBILE SIDEBAR*/
  const sidebarToggle = $("#sidebar-toggle");
  if (sidebarToggle) {
    const sync = () => {
      document.body.style.overflow = sidebarToggle.checked ? "hidden" : "";
    };
    sidebarToggle.addEventListener("change", sync);

    $("aside")?.addEventListener("click", (e) => {
      if (!e.target.closest("a")) return;
      if (window.matchMedia("(max-width: 1023px)").matches) {
        sidebarToggle.checked = false;
        sync();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebarToggle.checked) {
        sidebarToggle.checked = false;
        sync();
      }
    });

    window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => {
      if (e.matches) { sidebarToggle.checked = false; sync(); }
    });
  }

  /*2. MODAL SYSTEM*/
  let activeModal = null;

  function ensureModalPortal() {
    let portal = $("#modal-portal");
    if (!portal) {
      portal = document.createElement("div");
      portal.id = "modal-portal";
      portal.className = "fixed inset-0 z-[80] hidden";
      portal.innerHTML = `
        <div data-modal-overlay class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative z-10 flex min-h-full items-center justify-center p-4">
          <div data-modal-card role="dialog" aria-modal="true"
               class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl
                      opacity-0 scale-95 transition duration-200 ease-out"></div>
        </div>`;
      document.body.appendChild(portal);
      portal.addEventListener("click", (e) => {
        if (e.target.matches("[data-modal-overlay]")) closeModal();
      });
    }
    return portal;
  }

  function openModal({ title, body, footer, size = "max-w-lg" }) {
    const portal = ensureModalPortal();
    const card = $("[data-modal-card]", portal);
    card.className = card.className.replace(/max-w-\S+/, size);

    card.innerHTML = `
      <div class="flex items-start justify-between gap-4 border-b border-[#F1F5F9] px-5 py-4">
        <h2 class="text-lg font-bold leading-7 tracking-[-0.2px] text-[#0F172A]">${title}</h2>
        <button type="button" data-modal-close aria-label="Close dialog"
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm leading-6 text-[#334155]">${body}</div>
      ${footer ? `<div class="flex flex-col-reverse gap-2 border-t border-[#F1F5F9] px-5 py-4 sm:flex-row sm:justify-end">${footer}</div>` : ""}
    `;

    portal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => card.classList.remove("opacity-0", "scale-95"));
    activeModal = card;

    $("[data-modal-close]", card)?.addEventListener("click", closeModal);
    card.querySelectorAll("[data-modal-cancel]").forEach((b) =>
      b.addEventListener("click", closeModal)
    );

    setTimeout(() => $("button, [href], input, select, textarea", card)?.focus(), 60);
  }

  function closeModal() {
    const portal = $("#modal-portal");
    if (!portal || portal.classList.contains("hidden")) return;
    $("[data-modal-card]", portal).classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      portal.classList.add("hidden");
      document.body.style.overflow = "";
      activeModal = null;
    }, 180);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Focus trap
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !activeModal) return;
    const focusables = $$(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      activeModal
    ).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  /*3. HEADER: SEARCH + BELL*/
  const searchInput = $('input[placeholder*="Search settings"]');
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      toast(`Searching for "${searchInput.value.trim()}"…`, "info");
    }
  });

  const bell = $$("header button").find((b) =>
    b.querySelector('span.bg-\\[\\#F43F5E\\]')
  );
  bell?.addEventListener("click", () => {
    bell.querySelector('span.bg-\\[\\#F43F5E\\]')?.remove();
    toast("No new notifications", "success");
  });

  /*4. FORM FIELDS + DIRTY STATE*/
  const FIELD_IDS = [
    "first-name", "last-name", "email", "phone",
    "bio", "role", "location",
  ];
  const fields = FIELD_IDS.map((id) => document.getElementById(id)).filter(Boolean);

  // Snapshot original values
  const initial = new Map();
  fields.forEach((f) => initial.set(f, f.value));

  const saveBtn    = byText("button", "Save Changes");
  const discardBtn = byText("button", "Discard");

  function isDirty() {
    return fields.some((f) => f.value !== initial.get(f));
  }

  function updateSaveState() {
    if (!saveBtn) return;
    const dirty = isDirty();
    saveBtn.disabled = !dirty;
    saveBtn.classList.toggle("opacity-50", !dirty);
    saveBtn.classList.toggle("cursor-not-allowed", !dirty);
    saveBtn.classList.toggle("hover:bg-[#1D4ED8]", dirty);
  }

  fields.forEach((f) => f.addEventListener("input", updateSaveState));
  updateSaveState();

  /*5. VALIDATION HELPERS*/
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function markInvalid(field, message) {
    field.classList.add("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.remove("border-[#E2E8F0]");
    field.focus();
    toast(message, "error");
  }

  function clearInvalid(field) {
    field.classList.remove("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.add("border-[#E2E8F0]");
  }

  fields.forEach((f) => {
    f.addEventListener("input", () => clearInvalid(f));
  });

  function validateProfile() {
    const [first, last, email, phone, bio, role, location] = fields;

    if (!first.value.trim())  { markInvalid(first,  "First name is required"); return false; }
    if (!last.value.trim())   { markInvalid(last,   "Last name is required");  return false; }
    if (!email.value.trim() || !EMAIL_RE.test(email.value)) {
      markInvalid(email, "Enter a valid email address");
      return false;
    }
    if (phone && phone.value.trim() && phone.value.replace(/\D/g, "").length < 7) {
      markInvalid(phone, "Enter a valid phone number");
      return false;
    }
    return true;
  }

  /*6. SAVE / DISCARD*/
  saveBtn?.addEventListener("click", () => {
    if (!isDirty()) return;
    if (!validateProfile()) return;

    // TODO: replace with real API call
    saveBtn.disabled = true;
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving…";

    setTimeout(() => {
      // Commit snapshot
      fields.forEach((f) => initial.set(f, f.value));
      saveBtn.textContent = originalText;
      updateSaveState();
      toast("Settings saved", "success");
    }, 700);
  });

  discardBtn?.addEventListener("click", () => {
    if (!isDirty()) {
      toast("No changes to discard", "info");
      return;
    }
    openModal({
      title: "Discard changes?",
      body: `<p>Your unsaved edits will be lost. This can't be undone.</p>`,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Keep editing</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Discard</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      fields.forEach((f) => { f.value = initial.get(f); clearInvalid(f); });
      updateSaveState();
      closeModal();
      setTimeout(() => toast("Changes discarded", "info"), 200);
    });
  });

  // Warn on unload if dirty
  window.addEventListener("beforeunload", (e) => {
    if (isDirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /*7. AVATAR — UPLOAD / REMOVE*/
  const avatarImg = $("#profile img, main img") || $$("main img")[0];
  const uploadBtn = byText("button", "Upload new");
  const removeBtn = byText("button", "Remove");

  // Create a hidden file input
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp";
  fileInput.className = "hidden";
  document.body.appendChild(fileInput);

  uploadBtn?.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast("Please choose a JPG, PNG or WEBP file", "error");
      fileInput.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Image must be under 2 MB", "error");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      $$("img[alt='Mary Adeyemi']").forEach((img) => {
        if (img.closest("main")) img.src = e.target.result;
      });
      toast("Avatar updated — click Save to persist", "success");
    };
    reader.readAsDataURL(file);
    fileInput.value = "";
  });

  removeBtn?.addEventListener("click", () => {
    openModal({
      title: "Remove profile photo?",
      body: `<p>Your profile photo will be replaced with a placeholder. You can upload a new one anytime.</p>`,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Remove</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      $$("img[alt='Mary Adeyemi']").forEach((img) => {
        if (img.closest("main")) {
          img.src =
            "data:image/svg+xml;utf8," +
            encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='#E2E8F0'/><circle cx='50' cy='40' r='18' fill='#94A3B8'/><path d='M20 90c0-18 15-30 30-30s30 12 30 30z' fill='#94A3B8'/></svg>`
            );
        }
      });
      closeModal();
      setTimeout(() => toast("Profile photo removed", "info"), 200);
    });
  });

  /*8. NOTIFICATION TOGGLES*/
  const notifSection = document.getElementById("notifications");
  if (notifSection) {
    const toggles = $$('input[type="checkbox"].peer', notifSection);
    toggles.forEach((toggle) => {
      toggle.addEventListener("change", () => {
        const label = toggle
          .closest("div.flex")
          ?.querySelector("p.text-sm.font-semibold")
          ?.textContent.trim();
        if (label) {
          toast(
            `${label}: ${toggle.checked ? "enabled" : "disabled"}`,
            toggle.checked ? "success" : "info"
          );
        }
      });
    });
  }

  /*9. SECURITY — PASSWORD VALIDATION*/
  const currentPw = document.getElementById("current-password");
  const newPw     = document.getElementById("new-password");
  const confirmPw = document.getElementById("confirm-password");

  function pwStrength(pw) {
    let s = 0;
    if (pw.length >= 8)          s++;
    if (/[A-Z]/.test(pw))        s++;
    if (/[a-z]/.test(pw))        s++;
    if (/\d/.test(pw))           s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  function validatePasswordChange() {
    if (!currentPw || !newPw || !confirmPw) return false;

    const has = (v) => v && v.trim().length > 0;
    const allEmpty = !has(currentPw.value) && !has(newPw.value) && !has(confirmPw.value);
    if (allEmpty) return true; // no change requested

    if (!has(currentPw.value)) {
      markInvalid(currentPw, "Enter your current password");
      return false;
    }
    if (!has(newPw.value) || newPw.value.length < 8) {
      markInvalid(newPw, "New password must be at least 8 characters");
      return false;
    }
    if (pwStrength(newPw.value) < 3) {
      markInvalid(newPw, "Password is too weak — add uppercase, numbers or symbols");
      return false;
    }
    if (newPw.value !== confirmPw.value) {
      markInvalid(confirmPw, "Passwords do not match");
      return false;
    }
    return true;
  }

  [currentPw, newPw, confirmPw].forEach((f) => {
    if (!f) return;
    f.addEventListener("input", () => clearInvalid(f));
  });

  // Hook password validation into save — extend the existing listener chain
  if (saveBtn) {
    saveBtn.addEventListener("click", (e) => {
      // Only block if passwords are being changed AND invalid
      const hasAnyPw = [currentPw, newPw, confirmPw].some((f) => f && f.value.trim());
      if (hasAnyPw && !validatePasswordChange()) {
        e.stopImmediatePropagation();
        return;
      }
    }, { capture: true });
  }

  /*10. TWO-FACTOR AUTHENTICATION*/
  const tfaBtn = byText("button", "Enable 2FA");
  tfaBtn?.addEventListener("click", () => {
    openModal({
      title: "Enable Two-Factor Authentication",
      body: `
        <p>Scan the QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code to confirm.</p>
        <div class="mt-4 flex items-center justify-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
          <div class="flex h-40 w-40 items-center justify-center rounded-lg bg-white text-[11px] font-mono text-[#94A3B8] shadow-sm">
            [ QR CODE ]
          </div>
        </div>
        <label class="mt-4 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Verification code</span>
          <input data-tfa-code type="text" inputmode="numeric" maxlength="6" placeholder="000000"
                 class="mt-1.5 h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-center text-lg font-mono tracking-[0.5em] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"/>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]">Verify & Enable</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      const code = $("[data-tfa-code]")?.value.trim();
      if (!/^\d{6}$/.test(code)) {
        toast("Enter the 6-digit code from your app", "error");
        $("[data-tfa-code]")?.focus();
        return;
      }
      closeModal();
      setTimeout(() => {
        // Flip the button to a "Manage 2FA" state
        if (tfaBtn) {
          tfaBtn.textContent = "Manage 2FA";
          tfaBtn.classList.remove("bg-[#2563EB]", "hover:bg-[#1D4ED8]");
          tfaBtn.classList.add("bg-[#059669]", "hover:bg-[#047857]");
        }
        toast("Two-factor authentication enabled", "success");
      }, 220);
    });
  });

  /*11. DELETE ACCOUNT*/
  const deleteBtn = byText("button", "Delete account");
  deleteBtn?.addEventListener("click", () => {
    openModal({
      title: "Delete your account?",
      body: `
        <p class="text-[13px] leading-5">
          This will permanently delete <strong>Mary Adeyemi</strong> and all associated data
          — volunteers, opportunities, verified hours, and certificates. This action cannot be undone.
        </p>
        <label class="mt-4 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">
            Type <code class="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-mono text-[#0F172A]">delete my account</code> to confirm
          </span>
          <input data-confirm-delete type="text" autocomplete="off"
                 class="mt-1.5 h-10 w-full rounded-lg border border-[#FECDD3] bg-white px-3 text-sm focus:border-[#E11D48] focus:outline-none focus:ring-2 focus:ring-[#E11D48]/20"/>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 cursor-not-allowed rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white opacity-50" disabled>Delete account</button>
      `,
    });

    const confirmInput = $("[data-confirm-delete]");
    const confirmBtn   = $("[data-modal-confirm]");

    confirmInput?.addEventListener("input", () => {
      const ok = confirmInput.value.trim().toLowerCase() === "delete my account";
      if (confirmBtn) {
        confirmBtn.disabled = !ok;
        confirmBtn.classList.toggle("opacity-50", !ok);
        confirmBtn.classList.toggle("cursor-not-allowed", !ok);
        confirmBtn.classList.toggle("hover:bg-rose-700", ok);
      }
    });

    confirmBtn?.addEventListener("click", () => {
      if (confirmBtn.disabled) return;
      // TODO: replace with real API call
      closeModal();
      setTimeout(() => {
        toast("Account scheduled for deletion", "error");
        // window.location.href = "goodbye.html";
      }, 250);
    });
  });

  /*12. SIDEBAR NAV — placeholder for internal anchors*/
  $$("aside nav a").forEach((a) => {
    const text = a.textContent.trim().toLowerCase();
    if (text === "log out") {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openModal({
          title: "Log out?",
          body: `<p>You'll be signed out of IMPACTRA on this device.</p>`,
          footer: `
            <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
            <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Log out</button>
          `,
        });
        $("[data-modal-confirm]")?.addEventListener("click", () => {
          closeModal();
          setTimeout(() => toast("Logging out…", "info"), 200);
        });
      });
    }
  });

})();