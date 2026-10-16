/* IMPACTRA — Contribution Review */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  if (!window.API) { console.error("[contri.js] API client not found."); return; }
  if (!API.tokens.isAuthenticated) { window.location.href = "pages/login.html"; return; }

  /* Read contributionId from URL */
  const urlParams = new URLSearchParams(window.location.search);
  const CONTRIBUTION_ID = urlParams.get("id");

  let contribution = null;

  /*  TOAST  */
  function toast(message, variant = "default") {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "pointer-events-none fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2";
      document.body.appendChild(host);
    }
    const palette = {
      default: "bg-[#00174B] text-white",
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

  function withBusy(btn, label, fn) {
    if (!btn) return Promise.resolve();
    const original = btn.innerHTML;
    btn.disabled = true;
    if (label) btn.textContent = label;
    return Promise.resolve().then(fn).finally(() => {
      btn.disabled = false;
      btn.innerHTML = original;
    });
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "—";
  }

  /*  SIDEBAR  */
  const sidebarToggle = $("#sidebar-toggle");
  if (sidebarToggle) {
    const sync = () => { document.body.style.overflow = sidebarToggle.checked ? "hidden" : ""; };
    sidebarToggle.addEventListener("change", sync);
    $("aside")?.addEventListener("click", (e) => {
      if (!e.target.closest("a")) return;
      if (window.matchMedia("(max-width: 1023px)").matches) {
        sidebarToggle.checked = false; sync();
      }
    });
  }

  /*  MODAL  */
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
               class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl opacity-0 scale-95 transition duration-200 ease-out"></div>
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
        <h2 class="text-lg font-bold leading-7 tracking-[-0.2px]">${title}</h2>
        <button type="button" data-modal-close class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm leading-6">${body}</div>
      ${footer ? `<div class="flex flex-col-reverse gap-2 border-t border-[#F1F5F9] px-5 py-4 sm:flex-row sm:justify-end">${footer}</div>` : ""}
    `;
    portal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => card.classList.remove("opacity-0", "scale-95"));
    activeModal = card;
    $("[data-modal-close]", card)?.addEventListener("click", closeModal);
    card.querySelectorAll("[data-modal-cancel]").forEach((b) => b.addEventListener("click", closeModal));
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /*  SUCCESS CARD  */
  function showSuccessCard({ hours = "4.0", volunteerName = "the volunteer" } = {}) {
    let host = document.getElementById("success-portal");
    if (!host) {
      host = document.createElement("div");
      host.id = "success-portal";
      host.className = "fixed inset-0 z-[95] flex items-center justify-center p-4";
      document.body.appendChild(host);
    }
    host.innerHTML = `
      <div data-success-overlay class="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-200"></div>
      <div data-success-card role="dialog" aria-modal="true"
           class="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl opacity-0 scale-95 transition duration-200 ease-out">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFDF5]">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#009842"/>
            <path d="M7.8 12.5L10.6 15.3L16.2 9.7" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
        <h3 class="mt-5 text-lg font-bold leading-7 tracking-[-0.2px] text-[#0F172A]">Contribution verified successfully</h3>
        <p class="mt-2 text-sm leading-5 text-[#4B5563]"><strong>${hours} hours</strong> have been added to ${volunteerName}'s verified volunteer record.</p>
      </div>
    `;
    const card = host.querySelector("[data-success-card]");
    const overlay = host.querySelector("[data-success-overlay]");
    host.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    void card.offsetWidth;
    requestAnimationFrame(() => {
      overlay.classList.remove("opacity-0");
      card.classList.remove("opacity-0", "scale-95");
    });
    host.addEventListener("click", (e) => {
      if (e.target.matches("[data-success-overlay]")) hideSuccessCard();
    });
  }

  function hideSuccessCard() {
    const host = document.getElementById("success-portal");
    if (!host || host.classList.contains("hidden")) return;
    const card = host.querySelector("[data-success-card]");
    const overlay = host.querySelector("[data-success-overlay]");
    if (overlay) overlay.classList.add("opacity-0");
    if (card) card.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      host.classList.add("hidden");
      document.body.style.overflow = "";
    }, 200);
  }

  /*  HEADER: ⌘K + BELL  */
  const globalSearch = $('header input[type="text"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
      globalSearch?.select();
    }
  });

  const bellBtn = $$("header button").find((b) => b.querySelector("span.bg-\\[\\#BA1A1A\\]"));
  bellBtn?.addEventListener("click", async () => {
    bellBtn.querySelector("span.bg-\\[\\#BA1A1A\\]")?.remove();
    try { await API.patch("/notifications/read-all", {}); } catch (_) {}
    toast("You're all caught up", "success");
  });

  /*  LOAD CONTRIBUTION  */
  async function loadContribution() {
    if (!CONTRIBUTION_ID) {
      toast("No contribution specified", "error");
      return;
    }

    try {
      // No per-ID endpoint exists — fetch the list and find by ID
      const res = await API.activities.contributions.listForOrganization();
      const list = res?.data || res?.contributions || res || [];

      contribution = list.find((c) => (c._id || c.id) === CONTRIBUTION_ID);

      if (!contribution) {
        toast("Contribution not found", "error");
        return;
      }

      hydrateUI(contribution);
    } catch (err) {
      console.error("[contri.js] load failed:", err);
      toast(err.message || "Couldn't load contribution", "error");
    }
  }

  function hydrateUI(c) {
    const volunteer = c.volunteer || c.application?.volunteer || {};
    const activity = c.activity || c.application?.opportunity || {};
    const application = c.application || {};
    const organization = c.organization || activity.organization || {};

    const name = c.volunteerName || volunteer.name || "Volunteer";
    const volId = c.volunteerId || volunteer._id || c.volunteerReference || "";
    const hours = c.hoursCompleted ?? c.hours ?? 0;
    const expected = c.expectedHours ?? hours;

    /* Header */
    setText("headerVolunteerName", name);
    if (volId) setText("headerVolId", `#${String(volId).slice(-6)}`);
    updateStatusPill(c.status || "pending");
    if (c.submittedAt || c.createdAt) {
      const d = new Date(c.submittedAt || c.createdAt);
      setText("headerSubmittedDate", `Submitted ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`);
    }

    /* Activity card */
    setText("cardActivityTitle", activity.title || c.activityTitle || "Contribution");
    setText("cardOrganization", organization.name || c.organizationName || "Organization");

    // Metadata
    const d = c.date || activity.date;
    setText("metaDate", d ? new Date(d).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "—");
    setText("metaTime", (c.startTime && c.endTime) ? `${c.startTime} – ${c.endTime}` : "—");
    setText("metaLocation", c.location || activity.location?.venueAddress || activity.location || "—");
    setText("metaRole", c.role || activity.role || "Volunteer");

    /* Statement */
    setText("volunteerQuote", c.statement || c.description || application.motivation || "No statement provided.");

    /* Hours */
    setText("expectedHours", `${expected} hrs`);
    setText("submittedHours", `${hours} hrs`);

    /* Snapshot */
    setText("snapshotName", name);
    const snapshotParts = [
      volId ? `#${String(volId).slice(-6)}` : null,
      volunteer.occupation,
      volunteer.location || application.location,
    ].filter(Boolean);
    setText("snapshotMeta", snapshotParts.join(" · ") || "—");

    const avatar = volunteer.profileImage || volunteer.avatarUrl || application.profileImage;
    const avatarEl = document.getElementById("snapshotAvatar");
    if (avatarEl && avatar) avatarEl.src = avatar;

    setText("snapshotVerifiedHours", volunteer.verifiedHours != null ? `${volunteer.verifiedHours} hrs` : "—");
    setText("snapshotPendingNote", `+${hours} pending verification`);
    setText("snapshotMissions", volunteer.completedMissions ?? "—");
    setText("snapshotAttendance", volunteer.attendanceRate != null ? `${volunteer.attendanceRate}% attendance` : "—");

    /* Verify note box */
    setText("verifyNoteHours", `${hours} hours`);
    setText("verifyNoteName", name.split(" ")[0]);

    /* Wire the "View Full Volunteer Profile" link */
    const profileLink = $$("a").find((a) => /View Full Volunteer Profile/i.test(a.textContent));
    if (profileLink) {
      profileLink.addEventListener("click", (e) => {
        e.preventDefault();
        const appId = application._id || c.applicationId || c.application?._id;
        if (appId) {
          window.location.href = `volunteer-profile.html?applicationId=${encodeURIComponent(appId)}`;
        } else {
          toast("Application link not available", "info");
        }
      });
    }
  }

  function updateStatusPill(status) {
    const pill = document.getElementById("headerStatusPill");
    if (!pill) return;
    const s = (status || "pending").toLowerCase();
    if (s === "verified" || s === "approved") {
      pill.className = "inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-0.5";
      pill.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-[#009842]"></span><span class="text-[11px] font-semibold tracking-[0.55px] text-[#065F46]">Verified</span>`;
    } else if (s === "rejected" || s === "changes_requested") {
      pill.className = "inline-flex items-center gap-1.5 rounded-full bg-[#FFF1F2] px-3 py-0.5";
      pill.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-[#F43F5E]"></span><span class="text-[11px] font-semibold tracking-[0.55px] text-[#9F1239]">Changes Requested</span>`;
    } else {
      pill.className = "inline-flex items-center gap-1.5 rounded-full bg-[#FFFBEB] px-3 py-0.5";
      pill.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-[#F59E0B]"></span><span class="text-[11px] font-semibold tracking-[0.55px] text-[#92400E]">Pending Verification</span>`;
    }
  }

  /*  VERIFY  */
  const verifyBtn = $$("button").find((b) => /Verify Contribution/i.test(b.textContent));
  const requestBtn = $$("button").find((b) => /Request Changes/i.test(b.textContent));

  verifyBtn?.addEventListener("click", () => {
    const hours = contribution?.hoursCompleted ?? contribution?.hours ?? 0;
    const name = contribution?.volunteerName || contribution?.volunteer?.name || "the volunteer";
    const activity = contribution?.activity?.title || contribution?.activityName || "this activity";

    openModal({
      title: "Confirm Verification",
      body: `
        <p class="text-[13px] leading-5 text-[#4B5563]">
          You're about to verify <strong>${hours} hours</strong> for <strong>${escapeHtml(name)}</strong> on <strong>${escapeHtml(activity)}</strong>.
          This will be added to their verified record and IMPACTRA's organizational impact data.
        </p>
        <div class="mt-4 flex items-start gap-2 rounded-lg border border-[#0051b5]/20 bg-[#F3F4F6] p-3">
          <span class="shrink-0 text-[#0051b5]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
            </svg>
          </span>
          <p class="text-[13px] leading-[18px]">This action is logged in the audit trail and cannot be undone.</p>
        </div>
      `,
      footer: `
        <button type="button" data-modal-cancel class="h-10 rounded-lg bg-[#F3F4F6] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button type="button" data-modal-confirm class="h-10 rounded-lg bg-[#0051b5] px-4 text-sm font-semibold text-white transition hover:bg-[#0046b8]">Yes, Verify</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", (ev) => {
      withBusy(ev.currentTarget, "Verifying…", async () => {
        try {
          await API.activities.contributions.verify(CONTRIBUTION_ID, "Verified against attendance sheet.");
          closeModal();
          setTimeout(() => {
            updateStatusPill("verified");
            const name1 = (contribution?.volunteerName || contribution?.volunteer?.name || "Volunteer").split(" ")[0];
            const h = Number(contribution?.hoursCompleted ?? contribution?.hours ?? 4).toFixed(1);
            showSuccessCard({ hours: h, volunteerName: name1 });
          }, 240);
        } catch (err) {
          console.error("[contri] verify failed:", err);
          toast(err.message || "Couldn't verify", "error");
        }
      });
    });
  });

  /*  REQUEST CHANGES  */
  requestBtn?.addEventListener("click", () => {
    openModal({
      title: "Request Changes",
      body: `
        <p class="text-[13px] leading-5 text-[#4B5563]">Tell the volunteer what needs to be updated. They'll be notified and can resubmit.</p>
        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#6B7280]">Reason</span>
          <textarea data-message rows="4" placeholder="Describe what needs to change…"
                    class="mt-1.5 w-full resize-none rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-[#0051b5]/30"></textarea>
        </label>
      `,
      footer: `
        <button type="button" data-modal-cancel class="h-10 rounded-lg bg-[#F3F4F6] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button type="button" data-modal-confirm class="h-10 rounded-lg bg-[#0051b5] px-4 text-sm font-semibold text-white transition hover:bg-[#0046b8]">Send Request</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", (ev) => {
      const msg = $("[data-message]")?.value.trim();
      if (!msg) { toast("Please add a message", "error"); $("[data-message]")?.focus(); return; }

      withBusy(ev.currentTarget, "Sending…", async () => {
        try {
          await API.activities.contributions.reject(CONTRIBUTION_ID, msg);
          closeModal();
          setTimeout(() => {
            updateStatusPill("changes_requested");
            toast("Change request sent", "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't send request", "error");
        }
      });
    });
  });

  /*  LOG OUT  */
  $$("aside button").forEach((el) => {
    if (!/log out/i.test(el.textContent)) return;
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!confirm("You'll be signed out of IMPACTRA. Continue?")) return;
      try { await API.auth.logout(); } catch (_) {}
      API.tokens.clear();
      sessionStorage.clear();
      window.location.href = "pages/login.html";
    });
  });

  /*  GLOBAL 401  */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = "pages/login.html"), 900);
  });

  /*  KICK OFF  */
  loadContribution();

})();