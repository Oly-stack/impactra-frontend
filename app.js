/* IMPACTRA — Applications Dashboard */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
    );

  if (!window.API) {
    console.error("[app.js] API client not found.");
    return;
  }

  /* AUTH GUARD */
  if (!API.tokens.isAuthenticated) {
    window.location.href = "pages/login.html";
    return;
  }

  /* Cache */
  const applicationIndex = new Map(); // appId -> application object
  let allApplications = [];
  let allOpportunities = [];
  let activeFilter = "all";
  let sortMode = "newest";

  /* TOAST */
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
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity .25s ease, transform .25s ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 260);
    }, 2600);
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
        <h2 class="text-lg font-bold leading-7 tracking-[-0.2px]">${title}</h2>
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

  /* HEADER SEARCH */
  const searchInput = $('input[placeholder*="Search volunteers"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); searchInput?.focus(); searchInput?.select();
    }
  });

  /* LOGOUT */
  byText("aside button", "Log out")?.addEventListener("click", () => {
    openModal({
      title: "Log out?",
      body: `<p>You'll be signed out of IMPACTRA on this device.</p>`,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#E11D48] px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Log out</button>
      `,
    });
    $("[data-modal-confirm]")?.addEventListener("click", async (ev) => {
      withBusy(ev.currentTarget, "Logging out…", async () => {
        try { await API.auth.logout(); } catch (_) {}
        API.tokens.clear();
        sessionStorage.clear();
        window.location.href = "pages/login.html";
      });
    });
  });

  /* LOAD OPPORTUNITIES + APPLICATIONS */
  async function loadAll() {
    try {
      // 1. Get the NGO's opportunities
      const oppRes = await API.opportunities.myOrganizationList();
      allOpportunities = oppRes?.data || oppRes?.opportunities || oppRes || [];

      if (!allOpportunities.length) {
        renderEmpty("No opportunities yet. Create one to start receiving applications.");
        return;
      }

      // 2. Fetch applications for each opportunity (parallel)
      const results = await Promise.allSettled(
        allOpportunities.map((opp) =>
          API.applications.listForOpportunity(opp._id).then((res) => ({
            opportunity: opp,
            apps: res?.data || res?.applications || res || [],
          }))
        )
      );

      // 3. Flatten into a single array
      allApplications = [];
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const { opportunity, apps } = r.value;
        apps.forEach((app) => {
          const enriched = {
            ...app,
            _opportunity: opportunity,
            _status: (app.status || "pending").toLowerCase(),
            _submittedAt: app.submittedAt || app.createdAt || new Date().toISOString(),
            _name: app.name || app.volunteer?.name || "Unknown",
            _location: app.location || app.volunteer?.city || "—",
            _skills: app.skills || app.volunteer?.skills || [],
            _motivation: app.motivation || app.aboutYou || "",
          };
          applicationIndex.set(app._id, enriched);
          allApplications.push(enriched);
        });
      });

      renderApplications();
      updateCountersFromData();
      renderOpportunityFilterOptions();
    } catch (err) {
      console.error("[app.js] Load failed:", err);
      renderEmpty("Couldn't load applications. Please try again.");
      toast(err.message || "Failed to load data", "error");
    }
  }

  function updateCountersFromData() {
    const counts = {
      all: allApplications.length,
      pending: allApplications.filter((a) => a._status === "pending").length,
      approved: allApplications.filter((a) => a._status === "approved").length,
      rejected: allApplications.filter((a) => a._status === "rejected").length,
    };
    // Try to use real stats endpoint first, fall back to computed
    API.applications.stats()
      .then((res) => {
        const s = res?.data || res || {};
        applyCounts({
          all:      s.total    ?? counts.all,
          pending:  s.pending  ?? counts.pending,
          approved: s.approved ?? counts.approved,
          rejected: s.rejected ?? counts.rejected,
        });
      })
      .catch(() => applyCounts(counts));
  }

  function applyCounts(c) {
    setCounterNumber("Total", c.all);
    setCounterNumber("Pending", c.pending);
    setCounterNumber("Approved", c.approved);
    setCounterNumber("Rejected", c.rejected);
  }

  function setCounterNumber(labelText, value) {
    const labelEl = byText("p", labelText);
    if (!labelEl) return;
    const card = labelEl.closest("div")?.parentElement;
    const numEl = card ? $$("p", card).find((p) => /^\d+$/.test(p.textContent.trim())) : null;
    if (numEl) numEl.textContent = String(value);
  }

  function renderOpportunityFilterOptions() {
    const sel = $("[data-f-opp]");
    if (!sel) return;
    sel.innerHTML = `<option value="all">All opportunities</option>` +
      allOpportunities.map((o) =>
        `<option value="${escapeHtml(o.title)}">${escapeHtml(o.title)}</option>`
      ).join("");
  }

  /* RENDER CARDS */
  const grid = $("main section.grid");

  function renderEmpty(msg) {
    if (!grid) return;
    grid.innerHTML = `
      <div class="col-span-full rounded-xl border border-dashed border-[#E2E8F0] bg-white/60 p-10 text-center text-sm text-slate-500">
        ${msg}
      </div>`;
  }

  function renderApplications() {
    if (!grid) return;

    const q = (searchInput?.value || "").trim().toLowerCase();
    const opp = $("[data-f-opp]")?.value || "all";

    let visible = allApplications.filter((a) => {
      const statusOk = activeFilter === "all" || a._status === activeFilter;
      const qOk = !q || JSON.stringify(a).toLowerCase().includes(q);
      const oppOk = opp === "all" || a._opportunity.title === opp;
      return statusOk && qOk && oppOk;
    });

    // Sort
    visible.sort((a, b) => {
      if (sortMode === "newest") return new Date(b._submittedAt) - new Date(a._submittedAt);
      if (sortMode === "oldest") return new Date(a._submittedAt) - new Date(b._submittedAt);
      if (sortMode === "name-az") return a._name.localeCompare(b._name);
      if (sortMode === "name-za") return b._name.localeCompare(a._name);
      return 0;
    });

    if (!visible.length) {
      renderEmpty("No applications match your current filters.");
      updateFooterCount(0);
      return;
    }

    grid.innerHTML = visible.map(renderCard).join("");
    grid.querySelectorAll("article").forEach(wireCard);

    updateFooterCount(visible.length);
  }

  function renderCard(app) {
    const name = escapeHtml(app._name);
    const initial = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
    const avatar = app.volunteer?.profileImage || app.profileImage;
    const avatarMarkup = avatar
      ? `<img src="${escapeHtml(avatar)}" alt="${name}" class="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-[#E2E8F0] sm:h-14 sm:w-14" />`
      : `<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#DBEAFE] text-base font-bold text-[#1E40AF] sm:h-14 sm:w-14 sm:text-lg">${initial}</div>`;

    const badge = {
      pending:  `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FDE68A]/80 bg-[#FFFBEB] px-2.5 py-1 sm:px-3"><span class="h-1.5 w-1.5 rounded-full bg-[#F59E0B]"></span><span class="text-xs font-semibold text-[#92400E]">Review</span></span>`,
      approved: `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#A7F3D0]/80 bg-[#ECFDF5] px-2.5 py-1 sm:px-3"><span class="text-[#065F46]"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12l6 6L20 6"/></svg></span><span class="text-xs font-semibold text-[#065F46]">Approved</span></span>`,
      rejected: `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FECDD3]/80 bg-[#FFF1F2] px-2.5 py-1 sm:px-3"><span class="text-[#BE123C]">✕</span><span class="text-xs font-semibold text-[#BE123C]">Rejected</span></span>`,
    }[app._status] || "";

    const skills = (app._skills || []).slice(0, 3).map((s) =>
      `<span class="rounded-md bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-slate-500">${escapeHtml(s)}</span>`
    ).join("");

    const locationChip = app._location
      ? `<span class="rounded-md bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-slate-500">${escapeHtml(app._location)}</span>`
      : "";

    const relative = relativeFromNow(new Date(app._submittedAt));

    const actions = app._status === "pending"
      ? `
        <button data-action="view-profile" class="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-slate-50">View Profile</button>
        <button data-action="review" class="flex items-center gap-1 rounded-lg bg-[#0051b5] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0041a0]">Review Application →</button>`
      : `
        <button data-action="view-profile" class="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-slate-50">View Profile</button>
        <button data-action="view-app" class="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#E2E8F0]">View Application</button>`;

    return `
      <article data-app-id="${escapeHtml(app._id)}" class="flex flex-col justify-between rounded-xl border border-[#E2E8F0]/90 bg-white p-4 sm:p-5">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3.5">
              ${avatarMarkup}
              <div class="min-w-0">
                <h2 class="truncate text-base font-semibold leading-6 sm:text-lg">${name}</h2>
                <p class="mt-0.5 text-xs font-medium">Volunteer Applicant</p>
              </div>
            </div>
            ${badge}
          </div>

          <div class="inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded-md bg-[#EFF6FF] px-2.5 py-1 text-[#0051b5]">
            <span class="shrink-0">📋</span>
            <span class="truncate text-xs font-medium">Applied for: <b>${escapeHtml(app._opportunity.title)}</b></span>
          </div>

          <p class="text-xs italic leading-5 text-slate-500 line-clamp-2">
            "${escapeHtml((app._motivation || "").slice(0, 160))}${(app._motivation || "").length > 160 ? "..." : ""}"
          </p>

          <div class="flex flex-wrap gap-1.5 pt-0.5">
            ${skills}
            ${locationChip}
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3.5">
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-medium text-[#979798]">Applied ${relative}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${actions}
          </div>
        </div>
      </article>`;
  }

  function wireCard(card) {
  const appId = card.dataset.appId;
  const app = applicationIndex.get(appId);
  if (!app) return;

  card.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;

      if (action === "review") {
        openReviewModal(app);
      } else if (action === "view-profile") {
        window.location.href = `volunteer-profile.html?applicationId=${encodeURIComponent(app._id)}`;
      } else if (action === "view-app") {
        toast(`Application status: ${app._status}`, "info");
      }
    });
  });
}
  /* REVIEW MODAL */
  function openReviewModal(app) {
    const name = app._name;

    openModal({
      title: `Review — ${name}`,
      size: "max-w-xl",
      body: `
        <p class="text-[13px] leading-6">${escapeHtml(app._motivation || "No motivation provided.")}</p>
        <div class="mt-4 flex items-start gap-2 rounded-lg border border-[#0051b5]/20 bg-[#F8FAFC] p-3">
          <span class="mt-0.5 shrink-0 text-[#0051b5]">ℹ️</span>
          <p class="text-[13px] leading-[18px]">Approving will notify ${escapeHtml(name.split(" ")[0])} and confirm their shift assignment.</p>
        </div>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-action="reject" class="h-10 rounded-lg border border-[#FECDD3] bg-white px-4 text-sm font-semibold text-[#E11D48] transition hover:bg-rose-50">Reject</button>
        <button data-action="approve" class="h-10 rounded-lg bg-[#059669] px-4 text-sm font-semibold text-white transition hover:bg-[#047857]">Approve</button>
      `,
    });

    $("[data-action='approve']")?.addEventListener("click", (ev) => {
      withBusy(ev.currentTarget, "Approving…", async () => {
        try {
          await API.applications.approve(app._id, "Great profile. Welcome aboard!");
          updateAppStatus(app._id, "approved");
          closeModal();
          setTimeout(() => toast(`${name} approved`, "success"), 200);
        } catch (err) {
          toast(err.message || "Couldn't approve application", "error");
        }
      });
    });

    $("[data-action='reject']")?.addEventListener("click", (ev) => {
      withBusy(ev.currentTarget, "Rejecting…", async () => {
        try {
          await API.applications.reject(app._id, "Not a fit for this opportunity.");
          updateAppStatus(app._id, "rejected");
          closeModal();
          setTimeout(() => toast(`${name} rejected`, "info"), 200);
        } catch (err) {
          toast(err.message || "Couldn't reject application", "error");
        }
      });
    });
  }

  function updateAppStatus(appId, newStatus) {
    const app = applicationIndex.get(appId);
    if (!app) return;
    app._status = newStatus;
    renderApplications();
    updateCountersFromData();
  }

  /* FILTERS */
  byText("button", "Filter")?.addEventListener("click", () => {
    openModal({
      title: "Filter Applications",
      body: `
        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Status</span>
          <select data-f-status class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm focus:border-[#0051b5] focus:outline-none">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Opportunity</span>
          <select data-f-opp class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm">
            <option value="all">All opportunities</option>
            ${allOpportunities.map((o) => `<option value="${escapeHtml(o.title)}">${escapeHtml(o.title)}</option>`).join("")}
          </select>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold">Cancel</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#0051b5] px-4 text-sm font-semibold text-white">Apply filters</button>
      `,
    });
    if ($("[data-f-status]")) $("[data-f-status]").value = activeFilter;
    $("[data-modal-confirm]")?.addEventListener("click", () => {
      activeFilter = $("[data-f-status]")?.value || "all";
      renderApplications();
      closeModal();
      toast("Filters applied", "success");
    });
  });

  /* STATUS COUNTERS AS FILTERS */
  const counterBoxes = $$("section > div.grid > div").slice(0, 4);
  const COUNTER_MAP = ["all", "pending", "approved", "rejected"];
  counterBoxes.forEach((box, i) => {
    box.classList.add("cursor-pointer", "transition", "hover:border-[#0051b5]/40");
    box.addEventListener("click", () => {
      activeFilter = activeFilter === COUNTER_MAP[i] ? "all" : COUNTER_MAP[i];
      highlightCounters();
      renderApplications();
    });
  });

  function highlightCounters() {
    counterBoxes.forEach((box, i) => {
      const on = COUNTER_MAP[i] === activeFilter;
      box.classList.toggle("ring-2", on);
      box.classList.toggle("ring-[#0051b5]/40", on);
    });
  }

  /* SORT */
  byText("button", "Sort:")?.addEventListener("click", () => {
    const modes = ["newest", "oldest", "name-az", "name-za"];
    const labels = ["Newest First", "Oldest First", "Name (A–Z)", "Name (Z–A)"];
    const idx = (modes.indexOf(sortMode) + 1) % modes.length;
    sortMode = modes[idx];
    const btn = byText("button", "Sort:");
    if (btn) {
      const caret = btn.querySelector("span.text-\\[\\#979798\\]");
      [...btn.childNodes].forEach((n) => {
        if (n.nodeType === 3) n.remove();
        if (n.nodeType === 1 && !n.contains(caret)) n.remove();
      });
      btn.insertBefore(document.createTextNode(` Sort: ${labels[idx]} `), caret);
    }
    renderApplications();
  });

  /* SEARCH */
  let searchTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderApplications, 200);
  });

  function updateFooterCount(n) {
    const footer = byText("p", "Showing");
    if (footer) footer.textContent = n ? `Showing 1 – ${n} of ${n} applications` : "Showing 0 of 0 applications";
  }

  function relativeFromNow(date) {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.max(0, Math.round(diffMs / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  /* GLOBAL 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = "pages/login.html"), 900);
  });

  /* KICK OFF */
  loadAll();

})();