/* IMPACTRA — Activities Dashboard */
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

  /* TABS */
  const tabWrap = $(".table-x-scroll");
  const tabs = tabWrap ? $$("button", tabWrap) : [];
  const TAB_MODES = ["active", "verify", "completed"];
  const ACTIVE_CLASSES = ["bg-white", "shadow-[0_1px_2px_rgba(0,0,0,0.05)]"];

  let currentMode = "verify";

  function setTab(mode) {
    currentMode = mode;
    tabs.forEach((tab, i) => {
      const on = TAB_MODES[i] === mode;
      ACTIVE_CLASSES.forEach((c) => tab.classList.toggle(c, on));
    });
    applyAllFilters();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => setTab(TAB_MODES[i]));
  });

  /* TABLE */
  const table = $("table");
  const tbody = table ? $("tbody", table) : null;
  const allRows = tbody ? $$("tr", tbody) : [];
  const selectAll = table ? $('thead input[type="checkbox"]', table) : null;

  // Pre-cache searchable text on each row
  allRows.forEach((row) => {
    row.dataset.searchText = row.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    row.dataset.opportunity = /food relief/i.test(row.textContent)
      ? "food"
      : /school literacy/i.test(row.textContent) ? "literacy" : "";
    row.dataset.status = /pending verification/i.test(row.textContent)
      ? "pending"
      : /verified|complete/i.test(row.textContent) ? "completed" : "";
  });

  // Empty state row (created once, toggled by filters)
  let emptyRow = null;
  if (tbody) {
    emptyRow = document.createElement("tr");
    emptyRow.hidden = true;
    emptyRow.innerHTML = `
      <td colspan="8" class="px-4 py-10 text-center text-sm text-[#475569]">
        No contributions match your filters.
      </td>`;
    tbody.appendChild(emptyRow);
  }

  /* FILTER CONTROLS */
  const searchInput  = $('input[placeholder*="Search by volunteer"]');
  const globalSearch = $('input[placeholder*="Search contributions"]');
  const oppSelect  = (() => {
    const opt = byText("option", "All Opportunities");
    return opt ? opt.closest("select") : null;
  })();
  const dateSelect = (() => {
    const opt = byText("option", "This Week");
    return opt ? opt.closest("select") : null;
  })();

  const summaryRange = (() => {
    const p = byText("p", "Showing");
    return p ? $("span", p) : null;
  })();
  const summaryTotal = (() => {
    const p = byText("p", "Showing");
    return p ? $$("span", p)[1] : null;
  })();

  /* FILTER LOGIC */
  const RANGE_DAYS = {
    "This Week": 7,
    "Last 30 days": 30,
    "This quarter": 90,
    "All time": Infinity,
  };

  const MONTHS = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };

  function rowDate(row) {
    const m = row.textContent.match(/\b([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})\b/);
    if (!m) return null;
    const [, mon, day, year] = m;
    const mi = MONTHS[mon];
    if (mi === undefined) return null;
    return new Date(Number(year), mi, Number(day));
  }

  function inRange(row, label) {
    const days = RANGE_DAYS[label];
    if (!days || days === Infinity) return true;
    const d = rowDate(row);
    if (!d || isNaN(d.getTime())) return true;
    const diff = (Date.now() - d.getTime()) / 86400000;
    return diff >= 0 && diff <= days;
  }

  // Date filter is ignored until the user actually changes the select.
  let dateFilterTouched = false;
  dateSelect?.addEventListener("change", () => { dateFilterTouched = true; });

  /* THE MAIN FILTER FUNCTION */
  function applyAllFilters() {
    if (!tbody) return;

    const q     = (searchInput?.value || "").trim().toLowerCase();
    const opp   = oppSelect?.value || "all";
    const range = dateFilterTouched ? (dateSelect?.value || "All time") : "All time";

    let visible = 0;

    allRows.forEach((row) => {
      const status = row.dataset.status;

      // Tab mode
      let modeOk = true;
      if (currentMode === "verify")         modeOk = status === "pending";
      else if (currentMode === "completed") modeOk = status === "completed";
      else if (currentMode === "active")    modeOk = status !== "pending" && status !== "completed";

      // Search
      const qOk = !q || row.dataset.searchText.includes(q);

      // Opportunity
      let oppOk = true;
      if (opp === "food")          oppOk = row.dataset.opportunity === "food";
      else if (opp === "literacy") oppOk = row.dataset.opportunity === "literacy";

      // Date range
      const rangeOk = inRange(row, range);

      const show = modeOk && qOk && oppOk && rangeOk;
      row.hidden = !show;

      if (!show) {
        const box = $('input[type="checkbox"]', row);
        if (box) box.checked = false;
      } else {
        visible++;
      }
    });

    // Empty state
    if (emptyRow) emptyRow.hidden = visible !== 0;

    // Summary
    if (summaryRange) summaryRange.textContent = visible ? `1 to ${visible}` : "0";
    if (summaryTotal) summaryTotal.textContent = String(visible);

    syncSelection();
  }

  /* SELECTION */
  const rowBoxes = () => allRows.map((r) => $('input[type="checkbox"]', r)).filter(Boolean);

  const bulkBar = $(".pt-6 > div.rounded-xl.border");
  const bulkReviewBtn = byText("button", "Review Contributions", bulkBar || document);
  const bannerReviewBtn = byText("button", "Review Contributions");

  function syncSelection() {
    const boxes = rowBoxes().filter((b) => !b.closest("tr")?.hidden);
    const checked = boxes.filter((b) => b.checked);

    if (selectAll) {
      selectAll.checked = boxes.length > 0 && checked.length === boxes.length;
      selectAll.indeterminate = checked.length > 0 && checked.length < boxes.length;
    }

    boxes.forEach((box) => {
      box.closest("tr")?.classList.toggle("bg-[#f0f3ff]/60", box.checked);
    });

    if (bulkBar) bulkBar.hidden = checked.length === 0;

    const heading = bulkBar ? $("h3", bulkBar) : null;
    if (heading) {
      heading.textContent = checked.length
        ? `Review ${checked.length} Contribution${checked.length > 1 ? "s" : ""}`
        : "Review Contributions";
    }
  }

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      allRows.forEach((row) => {
        if (row.hidden) return;
        const box = $('input[type="checkbox"]', row);
        if (box) box.checked = selectAll.checked;
      });
      syncSelection();
    });
  }

  tbody?.addEventListener("change", (e) => {
    if (e.target.matches('input[type="checkbox"]')) syncSelection();
  });

  /* REVIEW ACTIONS */
  allRows.forEach((row) => {
    const btn = byText("button", "Review", row);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const name = $("td:nth-child(2) p", row)?.textContent.trim() || "volunteer";
      const id   = $("td:nth-child(2) .font-mono", row)?.textContent.trim() || "";
      toast(`Opening review — ${name} ${id}`, "info");
    });
  });

  bulkReviewBtn?.addEventListener("click", () => {
    const count = rowBoxes().filter((b) => b.checked).length;
    if (!count) { toast("Select at least one contribution", "error"); return; }
    toast(`Reviewing ${count} contribution${count > 1 ? "s" : ""}…`, "info");
  });

  if (bannerReviewBtn && bannerReviewBtn !== bulkReviewBtn) {
    bannerReviewBtn.addEventListener("click", () => {
      setTab("verify");
      toast("Showing contributions awaiting verification", "info");
    });
  }

  /* HEADER: ⌘K + BELL */
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
      globalSearch?.select();
    }
  });

  globalSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && globalSearch.value.trim()) {
      toast(`Searching for "${globalSearch.value.trim()}"…`, "info");
    }
  });

  const bell = $$("header button").find((b) => b.querySelector('span.bg-\\[\\#BA1A1A\\]'));
  bell?.addEventListener("click", () => {
    bell.querySelector('span.bg-\\[\\#BA1A1A\\]')?.remove();
    toast("No new notifications", "success");
  });

  /* WIRE FILTER EVENTS */
  let timer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(applyAllFilters, 150);
  });
  oppSelect?.addEventListener("change", applyAllFilters);

  /* KICK-OFF */
  setTab("verify");
})();