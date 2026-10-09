/*IMPACTRA — Applications Dashboard*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase()
        .includes(text.toLowerCase())
    );

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
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });

  const bell = $$("header button").find((b) =>
    b.querySelector('span.bg-\\[\\#F43F5E\\]')
  );
  bell?.addEventListener("click", () => {
    bell.querySelector('span.bg-\\[\\#F43F5E\\]')?.remove();
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
    $("[data-modal-confirm]")?.addEventListener("click", () => {
      closeModal();
      setTimeout(() => toast("Logging out…", "info"), 200);
    });
  });

  /*APPLICATIONS GRID — status detection & filtering*/
  const grid = $("main section.grid");
  const cards = grid ? $$(":scope > article", grid) : [];

  // Detect the status of each card from its badge text
  cards.forEach((card) => {
    const t = card.textContent.toLowerCase();
    if (/\brejected\b/.test(t))       card.dataset.status = "rejected";
    else if (/\bapproved\b/.test(t))  card.dataset.status = "approved";
    else if (/\breview\b/.test(t))    card.dataset.status = "pending";
    else                              card.dataset.status = "pending";

    // Cache a searchable text blob
    card.dataset.searchText = card.textContent.replace(/\s+/g, " ").trim().toLowerCase();
  });

  // Empty-state message (hidden by default)
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
  // The counters live in the grid just above the cards: grid-cols-2 ... xl:grid-cols-4
  const counterRow = $$("section > div.grid").find((d) =>
    d.querySelector(":scope > div p") &&
    /total/i.test(d.textContent)
  );
  const counterBoxes = counterRow ? $$(":scope > div", counterRow) : [];

  // Map each counter to a status
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
    // make it interactive
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

  /* SORT */
  // The "Sort: Newest First" button in the page header
  const sortBtn = byText("button", "Sort:");
  const SORTS = ["Newest First", "Oldest First", "Name (A–Z)", "Name (Z–A)"];
  let sortIndex = 0;

  // Build a rank from the "Applied X ago" text so we can sort
  function appliedRank(card) {
    const t = card.textContent.toLowerCase();
    if (/applied\s+\d+\s+hour/.test(t)) {
      const h = t.match(/applied\s+(\d+)\s+hour/)?.[1];
      return Number(h) * 60; // minutes
    }
    if (/applied\s+yesterday/.test(t)) return 24 * 60;
    if (/verified\s+/.test(t))          return -1;      // verified = newest
    if (/closed\s+/.test(t))            return 999999;  // rejected/closed = oldest
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
    // Swap label "Sort: X" while preserving the caret icon
    const caret = sortBtn.querySelector("span.text-\\[\\#979798\\]");
    // Clear text nodes between start and the icon span
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

    // prefill from current state
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

    // Update footer count
    const footer = byText("p", "Showing");
    if (footer) {
      footer.textContent = visible
        ? `Showing 1 – ${visible} of ${visible} applications`
        : "Showing 0 of 0 applications";
    }
  }

  // Search typing
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

  /*CARD ACTIONS */

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

    $("[data-action='approve']")?.addEventListener("click", () => {
      setCardStatus(card, "approved");
      closeModal();
      setTimeout(() => toast(`${name} approved`, "success"), 200);
    });

    $("[data-action='reject']")?.addEventListener("click", () => {
      setCardStatus(card, "rejected");
      closeModal();
      setTimeout(() => toast(`${name} rejected`, "info"), 200);
    });
  }

  /* Update card visuals when status changes */
  function setCardStatus(card, status) {
    card.dataset.status = status;

    // Rebuild the badge (it's the first span with rounded-full border in the card header)
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

    // update footer buttons (remove "Review Application" if handled)
    const reviewBtn = byText("button", "Review Application", card);
    if (reviewBtn) {
      reviewBtn.outerHTML = `
        <button type="button" class="rounded-lg border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#E2E8F0]">
          View Application
        </button>`;
    }
    // Re-bind any new View Application button
    wireCardButtons(card);
    applyFilters();
  }

  /* Wire all card action buttons */
  function wireCardButtons(card) {
    const name = $("h2", card)?.textContent.trim() || "applicant";

    card.querySelectorAll("button").forEach((btn) => {
      const label = btn.textContent.replace(/\s+/g, " ").trim();

      if (label.startsWith("Review Application")) {
        btn.addEventListener("click", () => openReview(card));
      } else if (label.startsWith("View Profile")) {
        btn.addEventListener("click", () => {
          // TODO: window.location.href = `volunteer-profile.html?name=${encodeURIComponent(name)}`;
          toast(`Opening ${name}'s profile…`, "info");
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
  const paginationNav = $("footer nav");
  paginationNav?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;

    // "Previous" / "Next"
    const t = btn.textContent.trim();
    if (t === "Previous") { toast("Already on page 1", "info"); return; }
    if (t === "Next")     { toast("Loading page 2…", "info"); return; }

    // Page number buttons
    if (/^\d+$/.test(t)) {
      // visual swap of active page number
      $$("span, button", paginationNav).forEach((el) => {
        if (el.tagName === "SPAN") {
          // old active -> convert to button
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
      btn.outerHTML = `<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0051b5] text-xs font-semibold text-white">${t}</span>`;
      toast(`Page ${t} loaded`, "success");
    }
  });

  /* KICK-OFF */
  applySort();
  applyFilters();
  highlightActiveCounter();

})();