/* IMPACTRA — Contribution Review*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const findByText = (sel, text, root = document) =>
    $$(sel, root).find((el) => el.textContent.trim().toLowerCase().includes(text.toLowerCase()));

  /* Read contribution id from URL */
  const urlParams      = new URLSearchParams(window.location.search);
  const CONTRIBUTION_ID = urlParams.get("id") || "CONTRIB-DEMO-001";

  /* Global API guard */
  if (!window.API) {
    console.error("[contri.js] API client not found. Did you load api.js before contri.js?");
  }

  /* Cached contribution data (populated on hydrate) */
  let contribution = null;

  /*0. TOAST*/
  function toast(message, variant = "default") {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className =
        "pointer-events-none fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2";
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

  /* Button busy helper */
  function withBusy(btn, label, fn) {
    if (!btn) return Promise.resolve();
    const original = btn.innerHTML;
    btn.disabled = true;
    if (label) btn.textContent = label;
    return Promise.resolve()
      .then(fn)
      .finally(() => {
        btn.disabled = false;
        btn.innerHTML = original;
      });
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
      if (e.matches) {
        sidebarToggle.checked = false;
        sync();
      }
    });
  }

  /*2. MODAL SYSTEM*/
  let activeModal = null;

  function ensureModalPortal() {
    let portal = $("#modal-portal");
    if (!portal) {
      portal = document.createElement("div");
      portal.id = "modal-portal";
      portal.className = "fixed inset-0 z-[70] hidden";
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
    const card   = $("[data-modal-card]", portal);

    card.className = card.className.replace(/max-w-\S+/, size);
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4 border-b border-[#F1F5F9] px-5 py-4">
        <h2 class="text-lg font-bold leading-7 tracking-[-0.2px]">${title}</h2>
        <button type="button" data-modal-close
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close dialog">
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
    card.querySelectorAll("[data-modal-cancel]").forEach((btn) =>
      btn.addEventListener("click", closeModal)
    );

    setTimeout(() => $("button, [href], input, select, textarea", card)?.focus(), 60);
  }

  function closeModal() {
    const portal = $("#modal-portal");
    if (!portal || portal.classList.contains("hidden")) return;
    const card = $("[data-modal-card]", portal);
    card.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      portal.classList.add("hidden");
      document.body.style.overflow = "";
      activeModal = null;
    }, 180);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  /*3. DRAWER (Audit Log)*/
  let activeDrawer = null;

  function ensureDrawerPortal() {
    let host = $("#drawer-portal");
    if (!host) {
      host = document.createElement("div");
      host.id = "drawer-portal";
      host.className = "fixed inset-0 z-[75] hidden";
      host.innerHTML = `
        <div data-drawer-overlay class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <aside data-drawer-panel role="dialog" aria-modal="true"
               class="absolute right-0 top-0 flex h-full w-full max-w-md translate-x-full
                      flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"></aside>`;
      document.body.appendChild(host);

      host.addEventListener("click", (e) => {
        if (e.target.matches("[data-drawer-overlay]")) closeDrawer();
      });
    }
    return host;
  }

  function openDrawer({ title, body }) {
    const host  = ensureDrawerPortal();
    const panel = $("[data-drawer-panel]", host);

    panel.innerHTML = `
      <header class="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#F1F5F9] px-5">
        <h2 class="text-base font-bold leading-6 tracking-[-0.08px]">${title}</h2>
        <button type="button" data-drawer-close
                class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close drawer">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">${body}</div>
    `;

    host.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panel.classList.remove("translate-x-full"));

    activeDrawer = panel;
    $("[data-drawer-close]", panel)?.addEventListener("click", closeDrawer);
  }

  function closeDrawer() {
    const host = $("#drawer-portal");
    if (!host || host.classList.contains("hidden")) return;
    $("[data-drawer-panel]", host).classList.add("translate-x-full");
    setTimeout(() => {
      host.classList.add("hidden");
      document.body.style.overflow = "";
      activeDrawer = null;
    }, 260);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  /*4. HEADER: ⌘K + NOTIFICATIONS*/
  const globalSearch = $('header input[type="text"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
      globalSearch?.select();
    }
  });

  const bellBtn = $$("header button").find((b) => b.querySelector("span.h-2.w-2"));
  bellBtn?.addEventListener("click", async () => {
    bellBtn.querySelector("span.h-2.w-2")?.remove();
    try {
      await API.notifications.markAllRead();
    } catch (_) {  }
    toast("You're all caught up", "success");
  });

  /*5. AUDIT LOG DRAWER*/
  const TONE = {
    blue:   "bg-[#0051b5]",
    green:  "bg-[#009842]",
    amber:  "bg-[#F59E0B]",
    red:    "bg-[#BA1A1A]",
  };

  /* Fallback events — replaced by API response when it arrives */
  let auditEvents = [
    { time: "—", title: "Loading audit log…", detail: "Fetching events from server.", tone: "blue" },
  ];

  function toneFor(eventType) {
    const t = (eventType || "").toLowerCase();
    if (t.includes("reject") || t.includes("error")) return "red";
    if (t.includes("verify") || t.includes("approve")) return "green";
    if (t.includes("route") || t.includes("pending"))  return "amber";
    return "blue";
  }

  function formatAuditTime(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  function renderAuditLog(events) {
    if (!events || !events.length) {
      return `<p class="text-sm text-slate-500">No events yet.</p>`;
    }
    return `
      <ol class="relative ml-3 border-l border-[#E5E7EB] pl-6">
        ${events.map((ev) => {
          const time  = ev.time || ev.timestamp ? formatAuditTime(ev.time || ev.timestamp) : "—";
          const title = ev.title || ev.event || "Event";
          const detail = ev.detail || ev.description || "";
          const tone = ev.tone || toneFor(ev.type || ev.event);
          return `
            <li class="relative pb-6 last:pb-0">
              <span class="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${TONE[tone] || TONE.blue}"></span>
              <p class="text-[11px] font-semibold uppercase leading-4 tracking-[0.55px] text-[#6B7280]">${time}</p>
              <p class="mt-0.5 text-sm font-semibold leading-5">${title}</p>
              <p class="mt-0.5 text-[13px] leading-[18px] text-[#4B5563]">${detail}</p>
            </li>`;
        }).join("")}
      </ol>
    `;
  }

  findByText("button", "Audit Log")?.addEventListener("click", async (e) => {
    // Show drawer with placeholder, then fetch and re-render
    openDrawer({ title: "Audit Log", body: renderAuditLog(auditEvents) });
    try {
      const res = await API.activities.contributions.auditLog(CONTRIBUTION_ID);
      const events = Array.isArray(res) ? res : (res?.events || res?.data || []);
      if (events.length) {
        auditEvents = events;
        const panel = $("[data-drawer-panel]");
        const bodyWrap = panel?.querySelector(".scroll-thin");
        if (bodyWrap) bodyWrap.innerHTML = renderAuditLog(events);
      }
    } catch (err) {
      const panel = $("[data-drawer-panel]");
      const bodyWrap = panel?.querySelector(".scroll-thin");
      if (bodyWrap) {
        bodyWrap.innerHTML = `
          <p class="text-sm text-[#991B1B]">
            Couldn't load audit log: ${err.message || "unknown error"}
          </p>`;
      }
    }
  });

  /*6. EVIDENCE — VIEW*/
  // Bind "View" buttons now; also re-bind after hydration if new ones appear
  function bindEvidenceButtons() {
    $$("button").forEach((btn) => {
      if (btn.dataset.evidenceBound) return;
      if (btn.textContent.trim() !== "View") return;
      btn.dataset.evidenceBound = "1";
      btn.addEventListener("click", () => {
        const img = btn.closest("div")?.parentElement?.querySelector("img");
        const src = img?.src || "";
        const alt = img?.alt || "Evidence";
        openModal({
          title: "Evidence Preview",
          size: "max-w-3xl",
          body: `
            <div class="flex items-center justify-center rounded-lg bg-[#F9FAFB] p-3">
              <img src="${src}" alt="${alt}" class="max-h-[60vh] w-auto rounded-md object-contain" />
            </div>
            <p class="mt-3 text-[13px] leading-[18px] text-[#4B5563]">${alt}</p>
          `,
          footer: `
            <button type="button" data-modal-cancel
                    class="h-10 rounded-lg bg-[#F3F4F6] px-4 text-sm font-semibold transition hover:bg-slate-200">
              Close
            </button>
          `,
        });
      });
    });
  }
  bindEvidenceButtons();

  /*7. DOWNLOAD SIGNED SHEET*/
  findByText("a", "Download PDF")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const link = e.currentTarget;
    withBusy(link, "Preparing…", async () => {
      try {
        // Try to fetch evidence metadata and find the signed sheet's URL
        const res = await API.activities.contributions.evidence(CONTRIBUTION_ID);
        const files = Array.isArray(res) ? res : (res?.files || res?.data || []);
        const sheet = files.find((f) =>
          /signed|attendance|sheet/i.test(f.name || f.type || f.label || "")
        );
        const url = sheet?.url || sheet?.downloadUrl || sheet?.href;

        if (url) {
          window.open(url, "_blank", "noopener");
          toast("Download ready", "success");
          return;
        }
        // No URL found — fall back to a friendly message
        toast("Signed sheet not attached", "info");
      } catch (err) {
        toast(err.message || "Couldn't prepare download", "error");
      }
    });
  });

  /*8. VIEW FULL VOLUNTEER PROFILE*/
  findByText("a", "View Full Volunteer Profile")?.addEventListener("click", (e) => {
    e.preventDefault();
    const volunteerId = contribution?.volunteerId || contribution?.volunteer?.id;
    if (volunteerId) {
      window.location.href = `volunteer-profile.html?id=${encodeURIComponent(volunteerId)}`;
    } else {
      toast("Volunteer ID not available", "error");
    }
  });

  /*9. VERIFY / REQUEST CHANGES*/
  const verifyBtn  = findByText("button", "Verify Contribution");
  const requestBtn = findByText("button", "Request Changes");

  function markVerified() {
    // Header badge
    const badge = findByText("span", "Pending Verification");
    if (badge) {
      badge.innerHTML = `
        <span class="h-1.5 w-1.5 rounded-full bg-[#009842]"></span>
        <span class="text-[11px] font-semibold tracking-[0.55px] text-[#065F46]">Verified</span>`;
      badge.classList.remove("bg-[#FFFBEB]");
      badge.classList.add("bg-[#ECFDF5]");
    }

    // Decision card state
    const card = verifyBtn?.closest("section");
    card?.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      b.classList.add("opacity-50", "cursor-not-allowed");
      b.classList.remove("hover:bg-[#0046b8]", "hover:bg-slate-200");
    });

    const heading = card?.querySelector("h3");
    if (heading) heading.textContent = "Contribution Verified";

    const note = card?.querySelector(".mt-4.flex.items-start.gap-2 p");
    if (note) {
      const hours = contribution?.hours ?? "4.0";
      const name  = contribution?.volunteerName || contribution?.volunteer?.name || "the volunteer";
      note.innerHTML = `<strong>${hours} hours</strong> have been added to ${name}'s verified record.`;
    }
  }

  function markChangesRequested() {
    const badge = findByText("span", "Pending Verification");
    if (badge) {
      badge.innerHTML = `
        <span class="h-1.5 w-1.5 rounded-full bg-[#F43F5E]"></span>
        <span class="text-[11px] font-semibold tracking-[0.55px] text-[#9F1239]">Changes Requested</span>`;
      badge.classList.remove("bg-[#FFFBEB]");
      badge.classList.add("bg-[#FFF1F2]");
    }

    const card = verifyBtn?.closest("section");
    card?.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      b.classList.add("opacity-50", "cursor-not-allowed");
      b.classList.remove("hover:bg-[#0046b8]", "hover:bg-slate-200");
    });
  }

  verifyBtn?.addEventListener("click", () => {
    const hours = contribution?.hours ?? "4.0";
    const name  = contribution?.volunteerName || contribution?.volunteer?.name || "the volunteer";
    const activity = contribution?.activity?.title || contribution?.activityName || "this activity";

    openModal({
      title: "Confirm Verification",
      body: `
        <p class="text-[13px] leading-5 text-[#4B5563]">
          You're about to verify <strong>${hours} hours</strong> for
          <strong>${name}</strong> on <strong>${activity}</strong>.
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
        <button type="button" data-modal-cancel
                class="h-10 rounded-lg bg-[#F3F4F6] px-4 text-sm font-semibold transition hover:bg-slate-200">
          Cancel
        </button>
        <button type="button" data-modal-confirm
                class="h-10 rounded-lg bg-[#0051b5] px-4 text-sm font-semibold text-white transition hover:bg-[#0046b8]">
          Yes, Verify
        </button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", (ev) => {
      withBusy(ev.currentTarget, "Verifying…", async () => {
        try {
          await API.activities.contributions.verify(CONTRIBUTION_ID);
          closeModal();
          setTimeout(() => {
            markVerified();
            toast(`Contribution verified — ${hours} hours added`, "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't verify contribution", "error");
        }
      });
    });
  });

  requestBtn?.addEventListener("click", () => {
    openModal({
      title: "Request Changes",
      body: `
        <p class="text-[13px] leading-5 text-[#4B5563]">
          Tell the volunteer what needs to be updated. They'll be notified and can resubmit.
        </p>

        <label class="mt-4 block">
          <span class="text-[11px] font-semibold uppercase leading-4 tracking-[0.55px] text-[#6B7280]">Reason</span>
          <select data-reason
                  class="mt-1.5 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0051b5]/30">
            <option value="evidence">Evidence is unclear or missing</option>
            <option value="hours">Reported hours don't match schedule</option>
            <option value="details">Activity details need correction</option>
            <option value="other">Other (explain below)</option>
          </select>
        </label>

        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase leading-4 tracking-[0.55px] text-[#6B7280]">Message to volunteer</span>
          <textarea data-message rows="4"
                    placeholder="Describe what needs to change..."
                    class="mt-1.5 w-full resize-none rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-[#0051b5]/30"></textarea>
        </label>
      `,
      footer: `
        <button type="button" data-modal-cancel
                class="h-10 rounded-lg bg-[#F3F4F6] px-4 text-sm font-semibold transition hover:bg-slate-200">
          Cancel
        </button>
        <button type="button" data-modal-confirm
                class="h-10 rounded-lg bg-[#0051b5] px-4 text-sm font-semibold text-white transition hover:bg-[#0046b8]">
          Send Request
        </button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", (ev) => {
      const reason = $("[data-reason]")?.value || "other";
      const msg    = $("[data-message]")?.value.trim();

      if (!msg) {
        toast("Please add a message for the volunteer", "error");
        $("[data-message]")?.focus();
        return;
      }

      withBusy(ev.currentTarget, "Sending…", async () => {
        try {
          await API.activities.contributions.reject(CONTRIBUTION_ID, reason, msg);
          closeModal();
          setTimeout(() => {
            markChangesRequested();
            toast("Change request sent", "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't send request", "error");
        }
      });
    });
  });

  /*10. KEYBOARD: focus trap*/
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
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /*11. UX: hover shadow on primary action*/
  verifyBtn?.addEventListener("mouseenter", () => verifyBtn.classList.add("shadow-md"));
  verifyBtn?.addEventListener("mouseleave", () => verifyBtn.classList.remove("shadow-md"));

  /*12. SIDEBAR LOG OUT*/
  $$("aside nav a, aside button").forEach((el) => {
    const text = el.textContent.trim().toLowerCase();
    if (text !== "log out") return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openModal({
        title: "Log out?",
        body: `<p>You'll be signed out of IMPACTRA on this device.</p>`,
        footer: `
          <button data-modal-cancel class="h-10 rounded-lg bg-[#F3F4F6] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
          <button data-modal-confirm class="h-10 rounded-lg bg-[#BA1A1A] px-4 text-sm font-semibold text-white transition hover:bg-rose-800">Log out</button>
        `,
      });
      $("[data-modal-confirm]")?.addEventListener("click", async () => {
        try { await API.auth.logout(); } catch (_) { /* ignore */ }
        window.location.href = "login.html";
      });
    });
  });

  /*13. GLOBAL 401 HANDLER*/
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

  /*14. HYDRATE FROM API ON LOAD*/
  (async function loadContribution() {
    if (!window.API) return;

    try {
      const res = await API.activities.contributions.get(CONTRIBUTION_ID);
      contribution = res?.data || res || null;

      if (!contribution) {
        console.warn("[contri.js] Contribution not found:", CONTRIBUTION_ID);
        return;
      }

      const c = contribution;

      //  Header: volunteer name 
      const nameEl = byText("p", "Mary Adeyemi");
      const displayName = c.volunteerName || c.volunteer?.name || c.volunteer?.fullName;
      if (nameEl && displayName) nameEl.textContent = displayName;

      //  Header: VOL id 
      const volIdEl = byText("span", "#VOL-");
      const volId   = c.volunteerId || c.volunteer?.id;
      if (volIdEl && volId) volIdEl.textContent = `#${volId}`;

      //  Header: submitted date 
      const submittedEl = byText("span", "Submitted ");
      if (submittedEl && (c.submittedAt || c.createdAt)) {
        const d = new Date(c.submittedAt || c.createdAt);
        submittedEl.textContent = `Submitted ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
      }

      //  Activity card title 
      const titleEl = $("main h2");
      if (titleEl && (c.activity?.title || c.activityName)) {
        titleEl.textContent = c.activity?.title || c.activityName;
      }

      //  Organization 
      const orgEl = byText("p", "Green Future Initiative");
      if (orgEl && (c.organization?.name || c.organizationName)) {
        orgEl.textContent = c.organization?.name || c.organizationName;
      }

      //  Metadata grid 
      const metaMap = {
        Date:     c.date ? new Date(c.date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null,
        Time:     c.startTime && c.endTime ? `${c.startTime} – ${c.endTime}` : null,
        Location: c.location || c.activity?.location,
        Role:     c.role || c.activity?.role,
      };
      Object.entries(metaMap).forEach(([label, value]) => {
        if (!value) return;
        const labelEl = byText("p", label);
        const valueEl = labelEl?.parentElement?.querySelector("p.font-semibold");
        if (valueEl) valueEl.textContent = value;
      });

      //  Volunteer statement 
      const quote = byText("blockquote", "I helped");
      if (quote && (c.statement || c.volunteerStatement)) {
        quote.textContent = `“${c.statement || c.volunteerStatement}”`;
      }

      //  Hours comparison 
      const expectedBadge = byText("span", "Expected:");
      const submittedBadge = byText("span", "Submitted:");
      if (c.expectedHours != null && expectedBadge?.parentElement) {
        const strong = expectedBadge.parentElement.querySelector(".font-semibold");
        if (strong) strong.textContent = `${c.expectedHours} hrs`;
      }
      if (c.hours != null && submittedBadge?.parentElement) {
        const strong = submittedBadge.parentElement.querySelector(".font-semibold");
        if (strong) strong.textContent = `${c.hours} hrs`;
      }

      //  Volunteer snapshot (right column) 
      const snapshotName = byText("h2", "Mary Adeyemi");
      if (snapshotName && displayName) snapshotName.textContent = displayName;

      const snapshotMeta = byText("p", "VOL-");
      if (snapshotMeta) {
        const parts = [];
        if (volId) parts.push(volId);
        if (c.volunteer?.occupation) parts.push(c.volunteer.occupation);
        if (c.volunteer?.location)   parts.push(c.volunteer.location);
        if (parts.length) snapshotMeta.innerHTML = parts.join(" · ") + (snapshotMeta.querySelector("br") ? "<br/>" : "");
      }

      //  Avatar in snapshot 
      const snapshotImg = $$("img[alt]").find((img) => /mary|volunteer|avatar/i.test(img.alt || ""));
      if (snapshotImg && c.volunteer?.avatarUrl) {
        snapshotImg.src = c.volunteer.avatarUrl;
      }

      //  Verified hours note in snapshot 
      const verifiedNote = byText("p", "pending verification");
      if (verifiedNote && c.hours != null) {
        verifiedNote.textContent = `+${c.hours} pending verification`;
      }

      //  If already verified, reflect that 
      const status = (c.status || "").toLowerCase();
      if (status === "verified" || status === "approved") markVerified();
      else if (status === "rejected" || status === "changes_requested") markChangesRequested();

    } catch (err) {
      console.warn("[contri.js] Failed to hydrate contribution:", err);
      // Page keeps its static sample data — no toast needed
    }
  })();

})();