/* IMPACTRA — Application / Volunteer Review */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
    );

  if (!window.API) {
    console.error("[volun.js] API client not found.");
    return;
  }

  /* AUTH GUARD */
  if (!API.tokens.isAuthenticated) {
    window.location.href = "pages/login.html";
    return;
  }

  /* Read applicationId from URL */
  const urlParams = new URLSearchParams(window.location.search);
  const APPLICATION_ID = urlParams.get("applicationId") || urlParams.get("id");

  if (!APPLICATION_ID) {
    console.warn("[volun.js] No applicationId in URL.");
  }

  let application = null;

  /* TOAST */
  function toast(message, variant = "default") {
    let host = $("#toast-host");
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

  /* SIDEBAR */
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebarToggle.checked) {
        sidebarToggle.checked = false; sync();
      }
    });
  }

  /* MODAL */
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

  /* HEADER: SEARCH + BELL */
  const globalSearch = $('header input[type="text"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
      globalSearch?.select();
    }
  });

  const bell = $("header button");
  bell?.addEventListener("click", async () => {
    bell.querySelector("span.bg-\\[\\#F43F5E\\]")?.remove();
    try {
      await API.patch("/notifications/read-all", {});
      toast("You're all caught up", "success");
    } catch (_) {
      toast("You're all caught up", "success");
    }
  });

  /* HYDRATE */
  async function loadApplication() {
    if (!APPLICATION_ID) {
      toast("No application specified", "error");
      return;
    }

    try {
      const res = await API.applications.get(APPLICATION_ID);
      application = res?.data || res || null;

      if (!application) {
        toast("Application not found", "error");
        return;
      }

      const volunteer = application.volunteer || {};
      const opportunity = application.opportunity || {};

      // Header — volunteer name
      const h1 = $("main h1");
      if (h1) h1.textContent = application.name || volunteer.name || "Applicant";

      // "Applied for X" badge
      const appliedBadge = byText("span", "Applied for");
      if (appliedBadge && opportunity.title) {
        appliedBadge.textContent = `Applied for ${opportunity.title}`;
      }

      // Breadcrumb name
      const breadcrumb = $("header nav span.font-semibold, header nav .truncate.font-semibold");
      if (breadcrumb) breadcrumb.textContent = application.name || volunteer.name || "Applicant";

      // Meta line
      const meta = byText("p", "Age:");
      if (meta) {
        const parts = [
          application.age ? `Age: ${application.age}` : null,
          application.gender ? `Gender: ${application.gender}` : null,
          application.location ? `Location: ${application.location}` : null,
          volunteer.occupation ? `Occupation: ${volunteer.occupation}` : null,
        ].filter(Boolean);
        if (parts.length) meta.textContent = parts.join(" · ");
      }

      // About
      const aboutText = $("section p.font-medium");
      if (aboutText && (application.aboutYou || volunteer.bio)) {
        aboutText.textContent = application.aboutYou || volunteer.bio;
      }

      // Motivation quote
      const quote = $("blockquote");
      if (quote && application.motivation) {
        quote.textContent = `"${application.motivation}"`;
      }

      // Skills chips
      const skillsWrap = $("section .mt-3.flex.flex-wrap");
      if (skillsWrap && Array.isArray(application.skills)) {
        skillsWrap.innerHTML = application.skills.map((s) =>
          `<span class="rounded-lg border border-[#E2E8F0]/60 bg-[#F0F3FF] px-2.5 py-1 text-xs font-medium text-[#334155]">${escapeHtml(s)}</span>`
        ).join("");
      }

      // Metrics — Verified Hours, Activities, Certificates (volunteer aggregate)
      const metricsRes = await API.get(`/organization/applications/stats`).catch(() => null);

      // Status pill
      updateStatusPill(application.status);

      // Document title
      document.title = `${application.name || volunteer.name || "Applicant"} · IMPACTRA`;

    } catch (err) {
      console.error("[volun.js] load failed:", err);
      toast(err.message || "Couldn't load application", "error");
    }
  }

  function updateStatusPill(status) {
    const pill = byText("span", "Pending Review") || byText("span", "Approved") || byText("span", "Not Accepted");
    if (!pill) return;
    const s = (status || "pending").toLowerCase();
    if (s === "approved") {
      pill.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span><span class="text-[11px] font-semibold text-[#047857]">Approved</span>`;
      pill.className = "inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1";
    } else if (s === "rejected") {
      pill.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-[#F43F5E]"></span><span class="text-[11px] font-semibold text-[#9F1239]">Not Accepted</span>`;
      pill.className = "inline-flex items-center gap-1.5 rounded-full border border-[#FECDD3] bg-[#FFF1F2] px-3 py-1";
    } else {
      pill.innerHTML = `<span class="h-1.5 w-1.5 rounded-full bg-[#F59E0B]"></span><span class="text-[11px] font-semibold text-[#92400E]">Pending Review</span>`;
    }
  }

  /* APPROVE / REJECT */
  const approveBtn = byText("button", "Approve Application");
  const rejectBtn  = byText("button", "Do Not Accept");
  const askBtn     = byText("button", "Ask a Question");

  approveBtn?.addEventListener("click", () => {
    openModal({
      title: "Approve Application",
      body: `
        <p>You're about to approve this volunteer. They'll be notified and can begin logging hours.</p>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#059669] px-4 text-sm font-semibold text-white transition hover:bg-[#047857]">Yes, approve</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", (ev) => {
      withBusy(ev.currentTarget, "Approving…", async () => {
        try {
          await API.applications.approve(APPLICATION_ID, "Approved from profile view.");
          closeModal();
          setTimeout(() => {
            updateStatusPill("approved");
            toast("Application approved", "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't approve", "error");
        }
      });
    });
  });

  rejectBtn?.addEventListener("click", () => {
    openModal({
      title: "Do Not Accept Application",
      body: `
        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Reason (optional)</span>
          <textarea data-reason rows="3"
                    class="mt-1.5 w-full resize-none rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm focus:border-[#2563EB] focus:outline-none"></textarea>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Do not accept</button>
      `,
    });

    $("[data-modal-confirm]")?.addEventListener("click", (ev) => {
      const note = $("[data-reason]")?.value.trim() || "Not a fit for this opportunity.";
      withBusy(ev.currentTarget, "Submitting…", async () => {
        try {
          await API.applications.reject(APPLICATION_ID, note);
          closeModal();
          setTimeout(() => {
            updateStatusPill("rejected");
            toast("Application not accepted", "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't submit", "error");
        }
      });
    });
  });

  /* BACK BUTTONS */
  byText("a", "Back")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "application.html";
  });

  byText("a", "Back to Volunteers")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "application.html";
  });

  /* EXPORT SUMMARY (uses existing /applications/:id) */
  byText("button", "Export Summary")?.addEventListener("click", (e) => {
    withBusy(e.currentTarget, "Generating…", async () => {
      try {
        if (!application) throw new Error("Nothing to export");
        const blob = new Blob([JSON.stringify(application, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `application-${APPLICATION_ID}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Summary downloaded", "success");
      } catch (err) {
        toast(err.message || "Export failed", "error");
      }
    });
  });

  /* LOG OUT */
  byText("aside button", "Log out")?.addEventListener("click", () => {
    openModal({
      title: "Log out?",
      body: `<p>You'll be signed out of IMPACTRA on this device.</p>`,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Log out</button>
      `,
    });
    $("[data-modal-confirm]")?.addEventListener("click", async () => {
      try { await API.auth.logout(); } catch (_) {}
      API.tokens.clear();
      sessionStorage.clear();
      window.location.href = "pages/login.html";
    });
  });

  /* GLOBAL 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = "pages/login.html"), 900);
  });

  /* KICK OFF */
  loadApplication();

})();