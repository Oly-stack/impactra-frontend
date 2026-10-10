/* IMPACTRA — Applications Dashboard*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase()
        .includes(text.toLowerCase())
    );

  /* Global API guard */
  if (!window.API) {
    console.error("[app.js] API client not found. Did you load api.js before app.js?");
  }

  /* Cache of API applications keyed by lowercase name for fast lookup */
  const appIndex = new Map();

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

  /* SIDEBAR */
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

  /* HEADER: SEARCH + BELL */
  const searchInput = $('input[placeholder*="Search volunteers"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); searchInput?.focus();
      searchInput?.select();
    }
  });

  const bell = $$("header button").find((b) =>
    b.querySelector('span.bg-\\[\\#F43F5E\\]')
  );
  bell?.addEventListener("click", async () => {
    bell.querySelector('span.bg-\\[\\#F43F5E\\]')?.remove();
    try {
      await API.notifications.markAllRead();
    } catch (_) { /* non-blocking */ }
    toast("No new notifications", "success");
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
    $("[data-modal-confirm]")?.addEventListener("click", async (ev) => {
      withBusy(ev.currentTarget, "Logging out…", async () => {
        try { await API.auth.logout(); } catch (_) { /* ignore */ }
        window.location.href = "login.html";
      });
    });
  });

  /* APPLICATIONS GRID — status detection & filtering */
  const grid = $("main section.grid");
  const cards = grid ? $$(":scope > article", grid) : [];

  // Detect the status of each card from its badge text
  cards.forEach((card) => {
    const t = card.textContent.toLowerCase();
    if (/\brejected\b/.test(t))       card.dataset.status = "rejected";
    else if (/\bapproved\b/.test(t))  card.dataset.status = "approved";
    else if (/\breview\b/.test(t))    card.dataset.status = "pending";
    else                              card.dataset.status = "pending";

    card.dataset.searchText = card.textContent.replace(/\s+/g, " ").trim().toLowerCase();
  });

  // Empty-state message
  let emptyState = null;
  if (grid) {
    emptyState = document.createElement("div");
    emptyState.hidden = true;
    emptyState.className =
      "col-span-full rounded-xl border border-dashed border-[#E2E8F0] bg-white/60 p-10 text-center text-sm text-slate-500";
    emptyState.textContent = "No applications match your current filters.";
    grid.appendChild(emptyState);
  }

  /* STATUS COUNTERS as filters */
  const counterRow = $$("section > div.grid").find((d) =>
    d.querySelector(":scope > div p") &&
    /total/i.test(d.textContent)
  );
  const counterBoxes = counterRow ? $$(":scope > div", counterRow) : [];

  const COUNTER_MAP = counterBoxes.map((box) => {
    const t = box.textContent.toLowerCase();
    if (/\btotal\b/.test(t))    return "all";
    if (/\bpending\b/.test(t))  return "pending";
    if (/\bapproved\b/.test(t)) return "approved";
    if (/\brejected\b/.test(t)) return "rejected";
    return null;
  });

  let activeFilter = "all";

  counterBoxes.forEach((box, i) => {
    box.classList.add(
      "cursor-pointer", "transition",
      "hover:border-[#0051b5]/40", "hover:shadow-sm"
    );
    box.setAttribute("role", "button");
    box.setAttribute("tabindex", "0");
    box.addEventListener("click", () => toggleFilter(COUNTER_MAP[i]));
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleFilter(COUNTER_MAP[i]);
      }
    });
  });

  function highlightActiveCounter() {
    counterBoxes.forEach((box, i) => {
      const on = COUNTER_MAP[i] === activeFilter;
      box.classList.toggle("ring-2", on);
      box.classList.toggle("ring-[#0051b5]/40", on);
    });
  }

  function toggleFilter(status) {
    activeFilter = (activeFilter === status) ? "all" : status;
    highlightActiveCounter();
    applyFilters();
    if (activeFilter === "all") {
      toast("Showing all applications", "info");
    } else {
      toast(`Filtered: ${activeFilter}`, "info");
    }
  }

  /* Update counter numbers from API stats */
  function applyStatsToCounters(stats) {
    if (!stats || !counterBoxes.length) return;
    const pick = {
      all:      stats.total ?? stats.all,
      pending:  stats.pending,
      approved: stats.approved,
      rejected: stats.rejected,
    };
    counterBoxes.forEach((box, i) => {
      const key = COUNTER_MAP[i];
      if (key == null || pick[key] == null) return;
      // Find the number paragraph (the one that isn't the label)
      const numEl = $$("p", box).find((p) => /^\d+$/.test(p.textContent.trim()));
      if (numEl) numEl.textContent = String(pick[key]);
    });
  }

  /* Adjust one counter by a delta (used after approve/reject) */
  function bumpCounter(key, delta) {
    const idx = COUNTER_MAP.indexOf(key);
    if (idx === -1) return;
    const box = counterBoxes[idx];
    const numEl = $$("p", box).find((p) => /^\d+$/.test(p.textContent.trim()));
    if (!numEl) return;
    const current = Number(numEl.textContent) || 0;
    numEl.textContent = String(Math.max(0, current + delta));
  }

  /* SORT */
  const sortBtn = byText("button", "Sort:");
  const SORTS = ["Newest First", "Oldest First", "Name (A–Z)", "Name (Z–A)"];
  let sortIndex = 0;

  function appliedRank(card) {
    const t = card.textContent.toLowerCase();
    if (/applied\s+\d+\s+hour/.test(t)) {
      const h = t.match(/applied\s+(\d+)\s+hour/)?.[1];
      return Number(h) * 60;
    }
    if (/applied\s+yesterday/.test(t)) return 24 * 60;
    if (/verified\s+/.test(t))          return -1;
    if (/closed\s+/.test(t))            return 999999;
    return 500;
  }

  function personName(card) {
    return ($("h2", card)?.textContent || "").trim();
  }

  function applySort() {
    if (!grid || !cards.length) return;
    const mode = SORTS[sortIndex];

    const sorted = [...cards].sort((a, b) => {
      if (mode === "Newest First") return appliedRank(a) - appliedRank(b);
      if (mode === "Oldest First") return appliedRank(b) - appliedRank(a);
      if (mode === "Name (A–Z)")   return personName(a).localeCompare(personName(b));
      if (mode === "Name (Z–A)")   return personName(b).localeCompare(personName(a));
      return 0;
    });

    sorted.forEach((card) => grid.insertBefore(card, emptyState));
  }

  sortBtn?.addEventListener("click", () => {
    sortIndex = (sortIndex + 1) % SORTS.length;
    const caret = sortBtn.querySelector("span.text-\\[\\#979798\\]");
    [...sortBtn.childNodes].forEach((n) => {
      if (n.nodeType === 3) n.remove();
      if (n.nodeType === 1 && !n.contains(caret)) n.remove();
    });
    const newLabel = document.createTextNode(` Sort: ${SORTS[sortIndex]} `);
    sortBtn.insertBefore(newLabel, caret);

    applySort();
    toast(`Sorted: ${SORTS[sortIndex]}`, "info");
  });

  /* FILTER (name/opportunity search) */
  const filterBtn = byText("button", "Filter");
  filterBtn?.addEventListener("click", () => {
    openModal({
      title: "Filter Applications",
      body: `
        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Status</span>
          <select data-f-status class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm focus:border-[#0051b5] focus:outline-none focus:ring-2 focus:ring-[#0051b5]/20">
            <option value="all">All statuses</option>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Opportunity</span>
          <select data-f-opp class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm focus:border-[#0051b5] focus:outline-none focus:ring-2 focus:ring-[#0051b5]/20">
            <option value="all">All opportunities</option>
            <option value="Community Cleanup">Community Cleanup</option>
            <option value="Food Relief Distribution">Food Relief Distribution</option>
            <option value="Shop Displacement Support">Shop Displacement Support</option>
            <option value="Community Health Screening">Community Health Screening</option>
            <option value="School Literacy Support">School Literacy Support</option>
          </select>
        </label>

        <label class="mt-3 block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.55px] text-[#64748B]">Location</span>
          <input data-f-loc type="text" placeholder="e.g. Lagos, Yaba, Surulere"
                 class="mt-1.5 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm focus:border-[#0051b5] focus:outline-none focus:ring-2 focus:ring-[#0051b5]/20"/>
        </label>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-f-reset class="h-10 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-slate-50">Reset</button>
        <button data-modal-confirm class="h-10 rounded-lg bg-[#0051b5] px-4 text-sm font-semibold text-white transition hover:bg-[#0041a0]">Apply filters</button>
      `,
    });

    if ($("[data-f-status]")) $("[data-f-status]").value = activeFilter;

    $("[data-f-reset]")?.addEventListener("click", () => {
      activeFilter = "all";
      highlightActiveCounter();
      if ($("[data-f-status]")) $("[data-f-status]").value = "all";
      if ($("[data-f-opp]"))    $("[data-f-opp]").value = "all";
      if ($("[data-f-loc]"))    $("[data-f-loc]").value = "";
      applyFilters();
      toast("Filters reset", "info");
      closeModal();
    });

    $("[data-modal-confirm]")?.addEventListener("click", () => {
      activeFilter = $("[data-f-status]")?.value || "all";
      const opp = $("[data-f-opp]")?.value || "all";
      const loc = $("[data-f-loc]")?.value.trim().toLowerCase() || "";
      highlightActiveCounter();
      applyFilters({ opp, loc });
      toast("Filters applied", "success");
      closeModal();
    });
  });

  /* FILTERING LOGIC */
  let extraOpp = "all";
  let extraLoc = "";

  function applyFilters(opts = {}) {
    if (opts.opp !== undefined) extraOpp = opts.opp;
    if (opts.loc !== undefined) extraLoc = opts.loc;

    const q = (searchInput?.value || "").trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const status = card.dataset.status;
      const statusOk = activeFilter === "all" || status === activeFilter;

      const text = card.dataset.searchText;
      const qOk = !q || text.includes(q);
      const oppOk = extraOpp === "all" || text.includes(extraOpp.toLowerCase());
      const locOk = !extraLoc || text.includes(extraLoc);

      const show = statusOk && qOk && oppOk && locOk;
      card.hidden = !show;
      if (show) visible++;
    });

    if (emptyState) emptyState.hidden = visible !== 0;

    const footer = byText("p", "Showing");
    if (footer) {
      footer.textContent = visible
        ? `Showing 1 – ${visible} of ${visible} applications`
        : "Showing 0 of 0 applications";
    }
  }

  let searchTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 150);
  });

  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchInput.value.trim()) {
      toast(`Searching for "${searchInput.value.trim()}"…`, "info");
    }
  });

  /* CARD ACTIONS */

  /* Find the API application ID for a card (if we have one) */
  function appIdFor(card) {
    if (card.dataset.appId) return card.dataset.appId;
    const name = $("h2", card)?.textContent.trim().toLowerCase();
    if (name && appIndex.has(name)) {
      const id = appIndex.get(name).id;
      card.dataset.appId = id;
      return id;
    }
    return null;
  }

  /* REVIEW APPLICATION */
  function openReview(card) {
    const name = $("h2", card)?.textContent.trim() || "this applicant";
    const applied = $("span.text-\\[\\#979798\\]", card)?.textContent.trim() || "";
    const opportunity = (() => {
      const t = card.textContent.match(/Applied for:\s*([^"“]+?)(?="|$)/i);
      return t ? t[1].trim() : "the opportunity";
    })();

    openModal({
      title: `Review — ${name}`,
      size: "max-w-xl",
      body: `
        <div class="flex items-center gap-3">
          <img src="${$("img", card)?.src || ""}" alt="${name}"
               class="h-12 w-12 rounded-full object-cover ring-1 ring-[#E2E8F0]"/>
          <div>
            <p class="text-sm font-semibold">${name}</p>
            <p class="text-xs text-slate-500">${opportunity} · ${applied}</p>
          </div>
        </div>

        <p class="mt-4 text-[13px] leading-6">${$("p.italic", card)?.textContent.trim() || ""}</p>

        <div class="mt-4 flex items-start gap-2 rounded-lg border border-[#0051b5]/20 bg-[#F8FAFC] p-3">
          <span class="mt-0.5 shrink-0 text-[#0051b5]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
            </svg>
          </span>
          <p class="text-[13px] leading-[18px]">Approving will notify ${name.split(" ")[0]} and confirm their shift assignment.</p>
        </div>
      `,
      footer: `
        <button data-modal-cancel class="h-10 rounded-lg bg-[#F1F5F9] px-4 text-sm font-semibold transition hover:bg-slate-200">Cancel</button>
        <button data-action="reject" class="h-10 rounded-lg border border-[#FECDD3] bg-white px-4 text-sm font-semibold text-[#E11D48] transition hover:bg-rose-50">Reject</button>
        <button data-action="approve" class="h-10 rounded-lg bg-[#059669] px-4 text-sm font-semibold text-white transition hover:bg-[#047857]">Approve</button>
      `,
    });

    $("[data-action='approve']")?.addEventListener("click", (ev) => {
      const id = appIdFor(card);
      withBusy(ev.currentTarget, "Approving…", async () => {
        try {
          if (id) await API.applications.approve(id);
          setCardStatus(card, "approved");
          closeModal();
          setTimeout(() => {
            toast(`${name} approved`, "success");
            bumpCounter("approved", +1);
            bumpCounter("pending", -1);
          }, 200);
        } catch (err) {
          toast(err.message || "Couldn't approve application", "error");
        }
      });
    });

    $("[data-action='reject']")?.addEventListener("click", (ev) => {
      const id = appIdFor(card);
      withBusy(ev.currentTarget, "Rejecting…", async () => {
        try {
          if (id) await API.applications.reject(id, "other", "");
          setCardStatus(card, "rejected");
          closeModal();
          setTimeout(() => {
            toast(`${name} rejected`, "info");
            bumpCounter("rejected", +1);
            bumpCounter("pending", -1);
          }, 200);
        } catch (err) {
          toast(err.message || "Couldn't reject application", "error");
        }
      });
    });
  }

  /* Update card visuals when status changes */
  function setCardStatus(card, status) {
    card.dataset.status = status;

    const badge = $$("span.inline-flex", card).find((s) =>
      /review|approved|rejected/i.test(s.textContent)
    );
    if (!badge) return;

    if (status === "approved") {
      badge.className =
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#A7F3D0]/80 bg-[#ECFDF5] px-2.5 py-1 sm:px-3";
      badge.innerHTML = `
        <span class="text-[#065F46]"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12l6 6L20 6"/></svg></span>
        <span class="text-xs font-semibold text-[#065F46]">Approved</span>`;
    } else if (status === "rejected") {
      badge.className =
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#FECDD3]/80 bg-[#FFF1F2] px-2.5 py-1 sm:px-3";
      badge.innerHTML = `
        <span class="text-[#BE123C]"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 2048 2048" fill="none"><path fill="currentColor" d="m1115 1024l690 691l-90 90l-691-690l-691 690l-90-90l690-691l-690-691l90-90l691 690l691-690l90 90z"/></svg></span>
        <span class="text-xs font-semibold text-[#BE123C]">Rejected</span>`;
    }

    // Update footer buttons: replace "Review Application" with "View Application"
    const reviewBtn = byText("button", "Review Application", card);
    if (reviewBtn) {
      reviewBtn.outerHTML = `
        <button type="button" class="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#E2E8F0]">
          View Application
        </button>`;
    }
    wireCardButtons(card);
    applyFilters();
  }

  /* Wire card action buttons */
  function wireCardButtons(card) {
    const name = $("h2", card)?.textContent.trim() || "applicant";

    card.querySelectorAll("button").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";
      const label = btn.textContent.replace(/\s+/g, " ").trim();

      if (label.startsWith("Review Application")) {
        btn.addEventListener("click", () => openReview(card));
      } else if (label.startsWith("View Profile")) {
        btn.addEventListener("click", () => {
          // Prefer API volunteer id; fall back to name-based query
          const rec = appIndex.get(name.toLowerCase());
          const vid = rec?.volunteerId || rec?.volunteer?.id;
          if (vid) {
            window.location.href = `volunteer-profile.html?id=${encodeURIComponent(vid)}`;
          } else {
            // window.location.href = `volunteer-profile.html?name=${encodeURIComponent(name)}`;
            toast(`Opening ${name}'s profile…`, "info");
          }
        });
      } else if (label.startsWith("View Application")) {
        btn.addEventListener("click", () => {
          toast(`Opening ${name}'s application…`, "info");
        });
      } else if (label.startsWith("View Details")) {
        btn.addEventListener("click", () => {
          toast(`Loading details for ${name}…`, "info");
        });
      }
    });
  }

  cards.forEach(wireCardButtons);

  /* PAGINATION */
  let currentPage = 1;
  const paginationNav = $("footer nav");

  async function goToPage(page) {
    currentPage = page;

    // Visual swap of active page number
    $$("span, button", paginationNav).forEach((el) => {
      if (el.tagName === "SPAN") {
        const n = el.textContent.trim();
        if (/^\d+$/.test(n)) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = n;
          b.className = "flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-xs font-medium text-[#334155] transition hover:bg-slate-50";
          el.replaceWith(b);
        }
      }
    });
    const active = $$("button", paginationNav).find((b) => b.textContent.trim() === String(page));
    if (active) {
      active.outerHTML = `<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0051b5] text-xs font-semibold text-white">${page}</span>`;
    }

    try {
      await API.applications.list({ page, limit: 20 });
      // NOTE : The API response is not used to update the DOM here, because the current implementation uses static cards. 
      toast(`Page ${page} loaded`, "success");
    } catch (err) {
      toast(err.message || "Couldn't load page", "error");
    }
  }

  paginationNav?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;

    const t = btn.textContent.trim();
    if (t === "Previous") {
      if (currentPage <= 1) { toast("Already on page 1", "info"); return; }
      goToPage(currentPage - 1);
      return;
    }
    if (t === "Next") {
      goToPage(currentPage + 1);
      return;
    }
    if (/^\d+$/.test(t)) {
      goToPage(Number(t));
    }
  });

  /* GLOBAL 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

  /* HYDRATE FROM API ON LOAD */
  (async function loadApplications() {
    if (!window.API) return;

    try {
      // 1. Stats — update the counter strip numbers
      try {
        const stats = await API.applications.stats();
        applyStatsToCounters(stats?.data || stats);
      } catch (err) {
        console.warn("[app.js] Failed to load stats:", err);
      }

      // 2. Applications — index by name so card actions can find real IDs
      try {
        const res = await API.applications.list({ page: 1, limit: 50 });
        const list = Array.isArray(res) ? res : (res?.data || res?.applications || []);

        list.forEach((app) => {
          const key = (app.volunteerName || app.volunteer?.name || app.name || "")
            .toString()
            .trim()
            .toLowerCase();
          if (key) appIndex.set(key, app);
        });

        // Attach IDs to matching static cards, and refresh the "Applied X ago"
        cards.forEach((card) => {
          const name = $("h2", card)?.textContent.trim().toLowerCase();
          if (!name) return;
          const rec = appIndex.get(name);
          if (!rec) return;

          card.dataset.appId = rec.id;

          // Update submitted-at text if the server gives us a timestamp
          const appliedEl = $("span.text-\\[\\#979798\\]", card);
          const ts = rec.submittedAt || rec.createdAt;
          if (appliedEl && ts) {
            const d = new Date(ts);
            if (!isNaN(d.getTime())) {
              const rel = relativeFromNow(d);
              appliedEl.textContent = `Applied ${rel}`;
            }
          }
        });

        // Recompute searchable text 
        cards.forEach((card) => {
          card.dataset.searchText = card.textContent.replace(/\s+/g, " ").trim().toLowerCase();
        });
      } catch (err) {
        console.warn("[app.js] Failed to load applications:", err);
      }

      applyFilters();
      highlightActiveCounter();
    } catch (err) {
      console.warn("[app.js] Hydrate failed:", err);
    }
  })();

  /* Small helper: "2 hours ago" style string */
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

  /* KICK-OFF */
  applySort();
  applyFilters();
  highlightActiveCounter();

})();