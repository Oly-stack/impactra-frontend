/*IMPACTRA — Contribution Review*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const findByText = (sel, text, root = document) =>
    $$(sel, root).find((el) => el.textContent.trim().toLowerCase().includes(text.toLowerCase()));

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
      if (e.matches) {
        sidebarToggle.checked = false;
        sync();
      }
    });
  }

  /*2. MODAL SYSTEM (created on demand)*/
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
          <div data-modal-card
               role="dialog"
               aria-modal="true"
               class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl
                      opacity-0 scale-95 transition duration-200 ease-out">
          </div>
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
    requestAnimationFrame(() => {
      card.classList.remove("opacity-0", "scale-95");
    });

    activeModal = card;

    $("[data-modal-close]", card)?.addEventListener("click", closeModal);
    card.querySelectorAll("[data-modal-cancel]").forEach((btn) =>
      btn.addEventListener("click", closeModal)
    );

    // Focus first focusable
    setTimeout(() => {
      $("button, [href], input, select, textarea", card)?.focus();
    }, 60);
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

  /*3. DRAWER (used for the Audit Log)*/
  let activeDrawer = null;

  function ensureDrawerPortal() {
    let host = $("#drawer-portal");
    if (!host) {
      host = document.createElement("div");
      host.id = "drawer-portal";
      host.className = "fixed inset-0 z-[75] hidden";
      host.innerHTML = `
        <div data-drawer-overlay class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <aside data-drawer-panel
               role="dialog"
               aria-modal="true"
               class="absolute right-0 top-0 flex h-full w-full max-w-md translate-x-full
                      flex-col bg-white shadow-2xl transition-transform duration-300 ease-out">
        </aside>`;
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

  const bell = findByText("header button", "") // fallback
    || $('header button[type="button"]');
  const bellBtn = $$("header button").find((b) => b.querySelector('span.h-2.w-2'));
  bellBtn?.addEventListener("click", () => {
    bellBtn.querySelector("span.h-2.w-2")?.remove();
    toast("You're all caught up", "success");
  });

  /*5. AUDIT LOG DRAWER*/
  const AUDIT_EVENTS = [
    { time: "Oct 4, 2026 · 2:15 PM", title: "Contribution submitted",
      detail: "Mary Adeyemi submitted 4.0 hrs for Food Relief Distribution.",
      tone: "blue" },
    { time: "Oct 4, 2026 · 2:16 PM", title: "Evidence uploaded",
      detail: "2 files attached — group photo and signed attendance sheet.",
      tone: "blue" },
    { time: "Oct 4, 2026 · 2:18 PM", title: "Auto-check passed",
      detail: "Hours match scheduled shift (4.0 hrs). No anomalies detected.",
      tone: "green" },
    { time: "Oct 5, 2026 · 9:02 AM", title: "Routed for verification",
      detail: "Assigned to NGO reviewer queue (Toyin).",
      tone: "amber" },
  ];

  const TONE = {
    blue:  "bg-[#0051b5]",
    green: "bg-[#009842]",
    amber: "bg-[#F59E0B]",
  };

  function renderAuditLog() {
    return `
      <ol class="relative ml-3 border-l border-[#E5E7EB] pl-6">
        ${AUDIT_EVENTS.map((ev) => `
          <li class="relative pb-6 last:pb-0">
            <span class="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white ${TONE[ev.tone]}"></span>
            <p class="text-[11px] font-semibold uppercase leading-4 tracking-[0.55px] text-[#6B7280]">${ev.time}</p>
            <p class="mt-0.5 text-sm font-semibold leading-5">${ev.title}</p>
            <p class="mt-0.5 text-[13px] leading-[18px] text-[#4B5563]">${ev.detail}</p>
          </li>
        `).join("")}
      </ol>
    `;
  }

  findByText("button", "Audit Log")?.addEventListener("click", () => {
    openDrawer({ title: "Audit Log", body: renderAuditLog() });
  });

  /*6. EVIDENCE — VIEW + DOWNLOAD*/
  $$("button").forEach((btn) => {
    if (btn.textContent.trim() === "View") {
      btn.addEventListener("click", () => {
        const img = btn.closest("div")?.parentElement?.querySelector("img");
        const src = img?.src || "";
        const alt = img?.alt || "Evidence";
        openModal({
          title: "Evidence Preview",
          size: "max-w-3xl",
          body: `
            <div class="flex items-center justify-center rounded-lg bg-[#F9FAFB] p-3">
              <img src="${src}" alt="${alt}"
                   class="max-h-[60vh] w-auto rounded-md object-contain" />
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
    }
  });

  findByText("a", "Download PDF")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Preparing signed sheet download…", "default");
    setTimeout(() => toast("Download ready", "success"), 900);
  });

  /*7. VIEW FULL VOLUNTEER PROFILE*/
  findByText("a", "View Full Volunteer Profile")?.addEventListener("click", (e) => {
    e.preventDefault();
    // TODO: replace with real navigation
    // window.location.href = "volunteer-profile.html?id=VOL-4029";
    toast("Opening Mary Adeyemi's profile…");
  });

  /*8. VERIFY CONTRIBUTION*/
  const verifyBtn = findByText("button", "Verify Contribution");
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

    // Swap heading
    const heading = card?.querySelector("h3");
    if (heading) heading.textContent = "Contribution Verified";

    // Replace note
    const note = card?.querySelector(".mt-4.flex.items-start.gap-2 p");
    if (note) {
      note.innerHTML = `<strong>4.0 hours</strong> have been added to Mary Adeyemi's verified record.`;
    }
  }

  verifyBtn?.addEventListener("click", () => {
    openModal({
      title: "Confirm Verification",
      body: `
        <p class="text-[13px] leading-5 text-[#4B5563]">
          You're about to verify <strong>4.0 hours</strong> for
          <strong>Mary Adeyemi</strong> on the <strong>Food Relief Distribution</strong> activity.
          This will be added to her verified record and IMPACTRA's organizational impact data.
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

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      closeModal();
      setTimeout(() => {
        markVerified();
        toast("Contribution verified — 4.0 hours added", "success");
      }, 220);
    });
  });

  /*9. REQUEST CHANGES*/
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

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      const msg = $("[data-message]")?.value.trim();
      if (!msg) {
        toast("Please add a message for the volunteer", "error");
        $("[data-message]")?.focus();
        return;
      }
      closeModal();
      setTimeout(() => {
        toast("Change request sent to Mary Adeyemi", "success");
      }, 220);
    });
  });

  /*10. KEYBOARD: focus trap light (Escape already handled)*/
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

  /*11. SMALL UX: highlight the note box on hover for decision*/
  verifyBtn?.addEventListener("mouseenter", () => verifyBtn.classList.add("shadow-md"));
  verifyBtn?.addEventListener("mouseleave", () => verifyBtn.classList.remove("shadow-md"));

})();