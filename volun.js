/* IMPACTRA — Volunteer Profile*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
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
      portal.className = "fixed inset-0 z-[80] hidden";
      portal.innerHTML = `
        <div data-modal-overlay class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative z-10 flex min-h-full items-center justify-center p-4">
          <div data-modal-card
               role="dialog" aria-modal="true"
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
    if (e.key === "Escape") {
      closeModal();
      closeDropdowns();
    }
  });

  // Simple focus trap
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

  /*3. HEADER: ⌘K SEARCH + NOTIFICATIONS*/
  const globalSearch = $('header input[type="text"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
      globalSearch?.select();
    }
  });

  const bell = $("header button");
  bell?.addEventListener("click", () => {
    bell.querySelector("span.bg-\\[\\#F43F5E\\]")?.remove();
    toast("You're all caught up", "success");
  });

  /*4. ACTIONS DROPDOWN*/
  const dropHost = document.createElement("div");
  dropHost.id = "actions-dropdown";
  dropHost.className =
    "fixed z-[85] hidden w-56 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl";
  dropHost.innerHTML = `
    <ul class="py-1 text-sm text-[#0F172A]">
      <li><button data-action="email"    class="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50">Send email</button></li>
      <li><button data-action="assign"   class="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50">Assign to reviewer</button></li>
      <li><button data-action="flag"     class="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50">Flag for follow-up</button></li>
      <li><button data-action="download" class="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-slate-50">Download profile (PDF)</button></li>
      <li class="my-1 h-px bg-[#F1F5F9]"></li>
      <li><button data-action="archive"  class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[#E11D48] transition hover:bg-rose-50">Archive volunteer</button></li>
    </ul>
  `;
  document.body.appendChild(dropHost);

  function closeDropdowns() {
    dropHost.classList.add("hidden");
  }

  const actionsBtn = byText("button", "Actions");
  actionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!dropHost.classList.contains("hidden")) {
      closeDropdowns();
      return;
    }
    const r = actionsBtn.getBoundingClientRect();
    dropHost.style.top  = `${r.bottom + 8}px`;
    dropHost.style.left = `${Math.min(r.left, window.innerWidth - 240)}px`;
    dropHost.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!dropHost.contains(e.target)) closeDropdowns();
  });
  window.addEventListener("scroll", closeDropdowns, { passive: true });
  window.addEventListener("resize", closeDropdowns);

  const ACTION_COPY = {
    email:    "Opening email composer…",
    assign:   "Choose a reviewer to assign",
    flag:     "Volunteer flagged for follow-up",
    download: "Preparing profile PDF…",
    archive:  "Are you sure you want to archive?",
  };
  dropHost.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    closeDropdowns();

    const action = btn.dataset.action;
    if (action === "archive") {
      openModal({
        title: "Archive Volunteer",
        body: `<p>Archiving will hide Mary Adeyemi from active volunteer lists. This action can be reversed by an admin.</p>`,
        footer: `
          <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
          <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Archive</button>
        `,
      });
      $("[data-modal-confirm]")?.addEventListener("click", () => {
        closeModal();
        setTimeout(() => toast("Volunteer archived", "success"), 200);
      });
      return;
    }
    toast(ACTION_COPY[action] || "Action triggered", "info");
  });

  /*5. EXPORT SUMMARY*/
  byText("button", "Export Summary")?.addEventListener("click", () => {
    toast("Generating summary…", "info");
    setTimeout(() => toast("Summary downloaded", "success"), 900);
  });

  /*6. BACK BUTTONS + NEXT VOLUNTEER*/
  byText("a", "Back")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Returning to Volunteers list…");
    // window.location.href = "volunteers.html";
  });

  byText("a", "Back to Volunteers")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Returning to Volunteers list…");
  });

  byText("a", "View Next Volunteer")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Loading Edward Chen's profile…");
    // window.location.href = "volunteer-profile.html?id=VOL-4031";
  });

  /*7. MESSAGE MARY*/
  byText("button", "Message Mary")?.addEventListener("click", () => {
    openModal({
      title: "Message Mary Adeyemi",
      body: `
        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Subject</span>
          <input data-subject type="text" placeholder="e.g. Community Cleanup application"
                 class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"/>
        </label>
        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Message</span>
          <textarea data-message rows="5" placeholder="Write your message…"
                    class="mt-1.5 w-full resize-none rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm leading-5 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"></textarea>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]">Send message</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      const msg = $("[data-message]")?.value.trim();
      if (!msg) { toast("Add a message before sending", "error"); $("[data-message]")?.focus(); return; }
      closeModal();
      setTimeout(() => toast("Message sent to Mary", "success"), 200);
    });
  });

  /*8. ASK A QUESTION*/
  byText("button", "Ask a Question")?.addEventListener("click", () => {
    openModal({
      title: "Ask Mary a Question",
      body: `
        <p class="text-[13px] leading-5">This will be sent as a message and Mary will be notified by email.</p>
        <textarea data-question rows="5" placeholder="Type your question…"
                  class="mt-3 w-full resize-none rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm leading-5 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"></textarea>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]">Send question</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      const q = $("[data-question]")?.value.trim();
      if (!q) { toast("Please type your question", "error"); $("[data-question]")?.focus(); return; }
      closeModal();
      setTimeout(() => toast("Question sent to Mary", "success"), 200);
    });
  });

  /*9. APPROVE APPLICATION*/
  function markApproved() {
    // Flip status pill (Pending Review → Approved)
    const pill = byText("span", "Pending Review");
    if (pill) {
      pill.innerHTML = `
        <span class="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>
        <span class="text-[11px] font-semibold text-[#047857]">Approved</span>`;
      pill.classList.remove("border-[#FDE68A]", "bg-[#FFFBEB]");
      pill.classList.add("border-[#A7F3D0]", "bg-[#ECFDF5]");
    }

    // Flip header badge
    const appliedBadge = byText("span", "Applied for Community Cleanup");
    if (appliedBadge) {
      appliedBadge.textContent = "Approved for Community Cleanup";
      appliedBadge.classList.remove("border-[#BFDBFE]", "bg-[#f0f3ff]", "text-[#1D4ED8]");
      appliedBadge.classList.add("border-[#A7F3D0]", "bg-[#ECFDF5]", "text-[#047857]");
    }

    // Disable both decision CTAs
    [approveBtn, rejectBtn, askBtn].forEach((b) => {
      if (!b) return;
      b.disabled = true;
      b.classList.add("opacity-60", "cursor-not-allowed");
      b.classList.remove("hover:bg-[#1D4ED8]", "hover:bg-rose-50", "hover:bg-[#E0E7FF]");
    });
    if (approveBtn) {
      approveBtn.innerHTML = `
        <span class="shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M16.0303 10.0303C16.3232 9.73744 16.3232 9.26256 16.0303 8.96967C15.7374 8.67678 15.2626 8.67678 14.9697 8.96967L10.5 13.4393L9.03033 11.9697C8.73744 11.6768 8.26256 11.6768 7.96967 11.9697C7.67678 12.2626 7.67678 12.7374 7.96967 13.0303L9.96967 15.0303C10.2626 15.3232 10.7374 15.3232 11.0303 15.0303L16.0303 10.0303Z" fill="currentColor"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
        </svg></span>
        Application Approved`;
      approveBtn.classList.add("bg-[#059669]", "text-white");
      approveBtn.classList.remove("bg-[#2563EB]", "hover:bg-[#1D4ED8]");
    }
  }

  const approveBtn = byText("button", "Approve Application");
  const rejectBtn  = byText("button", "Do Not Accept");
  const askBtn     = byText("button", "Ask a Question");

  approveBtn?.addEventListener("click", () => {
    openModal({
      title: "Approve Application",
      body: `
        <p>You're about to approve <strong>Mary Adeyemi</strong> for the
        <strong>Community Cleanup</strong> mission.</p>
        <div class="mt-4 flex items-start gap-2 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF]/70 p-3 text-[13px] leading-[18px]">
          <span class="mt-0.5 shrink-0 text-[#1D4ED8]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
            </svg>
          </span>
          Mary will be notified by email and can begin logging hours for this mission.
        </div>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#2563EB] px-4 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]">Yes, approve</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      closeModal();
      setTimeout(() => {
        markApproved();
        toast("Application approved", "success");
      }, 220);
    });
  });

  /*10. DO NOT ACCEPT*/
  rejectBtn?.addEventListener("click", () => {
    openModal({
      title: "Do Not Accept Application",
      body: `
        <p class="text-[13px] leading-5">Please choose a reason and add an optional note. Mary will be notified by email.</p>

        <label class="mt-4 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Reason</span>
          <select data-reason
                  class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20">
            <option value="capacity">Mission is at capacity</option>
            <option value="fit">Not a strong fit for this activity</option>
            <option value="availability">Availability mismatch</option>
            <option value="other">Other (explain below)</option>
          </select>
        </label>

        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Note to volunteer (optional)</span>
          <textarea data-note rows="3"
                    class="mt-1.5 w-full resize-none rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm leading-5 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"></textarea>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Do not accept</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      closeModal();
      setTimeout(() => {
        const pill = byText("span", "Pending Review");
        if (pill) {
          pill.innerHTML = `
            <span class="h-1.5 w-1.5 rounded-full bg-[#F43F5E]"></span>
            <span class="text-[11px] font-semibold text-[#9F1239]">Not Accepted</span>`;
          pill.classList.remove("border-[#FDE68A]", "bg-[#FFFBEB]");
          pill.classList.add("border-[#FECDD3]", "bg-[#FFF1F2]");
        }
        [approveBtn, rejectBtn, askBtn].forEach((b) => {
          if (!b) return;
          b.disabled = true;
          b.classList.add("opacity-60", "cursor-not-allowed");
          b.classList.remove("hover:bg-[#1D4ED8]", "hover:bg-rose-50", "hover:bg-[#E0E7FF]");
        });
        toast("Application not accepted", "success");
      }, 220);
    });
  });

  /*11. VIEW FULL ACTIVITY HISTORY*/
  byText("a", "View Full Activity History")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Loading full activity history…");
    // window.location.href = "volunteer-activities.html?id=VOL-4029";
  });

  /*12. SEARCH — lightweight in-page feedback*/
  globalSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && globalSearch.value.trim()) {
      toast(`Searching for "${globalSearch.value.trim()}"…`, "info");
    }
  });

})();