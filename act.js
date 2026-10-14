/* IMPACTRA — Activities Dashboard*/
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
    console.error("[activities] API client not found. Did you load api.js first?");
  }

  /* Cache of API contributions keyed by volunteer name (lowercased) */
  const contribIndex = new Map();

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

  /* LOG OUT */
  byText("aside button", "Log out")?.addEventListener("click", () => {
    openConfirmLogout();
  });

  function openConfirmLogout() {
    const ok = window.confirm("You'll be signed out of IMPACTRA on this device. Continue?");
    if (!ok) return;
    (async () => {
      try { await API.auth.logout(); } catch (_) { /* ignore */ }
      window.location.href = "login.html";
    })();
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

  // Pre-cache searchable text + tags on each row
  allRows.forEach((row) => {
    row.dataset.searchText = row.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    row.dataset.opportunity = /food relief/i.test(row.textContent)
      ? "food"
      : /school literacy/i.test(row.textContent) ? "literacy" : "";
    row.dataset.status = /pending verification/i.test(row.textContent)
      ? "pending"
      : /verified|complete/i.test(row.textContent) ? "completed" : "";
  });

  // Empty state row
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

      let modeOk = true;
      if (currentMode === "verify")         modeOk = status === "pending";
      else if (currentMode === "completed") modeOk = status === "completed";
      else if (currentMode === "active")    modeOk = status !== "pending" && status !== "completed";

      const qOk = !q || row.dataset.searchText.includes(q);

      let oppOk = true;
      if (opp === "food")          oppOk = row.dataset.opportunity === "food";
      else if (opp === "literacy") oppOk = row.dataset.opportunity === "literacy";

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

    if (emptyRow) emptyRow.hidden = visible !== 0;
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

  /* Resolve a contribution ID for a row (from data-id or the name index) */
  function contribIdFor(row) {
    if (row.dataset.contribId) return row.dataset.contribId;
    const name = $("td:nth-child(2) p", row)?.textContent.trim().toLowerCase();
    if (name && contribIndex.has(name)) {
      const id = contribIndex.get(name).id;
      row.dataset.contribId = id;
      return id;
    }
    return null;
  }

  /* REVIEW ACTIONS */
  allRows.forEach((row) => {
    const btn = byText("button", "Review", row);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const id = contribIdFor(row);
      const name = $("td:nth-child(2) p", row)?.textContent.trim() || "volunteer";
      const ref  = $("td:nth-child(2) .font-mono", row)?.textContent.trim() || "";

      if (id) {
        // Navigate to the contribution review page
        window.location.href = `contribution.html?id=${encodeURIComponent(id)}`;
      } else {
        // Fallback while the API hasn't resolved an ID yet
        toast(`Opening review — ${name} ${ref}`, "info");
      }
    });
  });

  bulkReviewBtn?.addEventListener("click", async (e) => {
    const selectedRows = allRows.filter((r) => !r.hidden && $('input[type="checkbox"]', r)?.checked);
    if (!selectedRows.length) {
      toast("Select at least one contribution", "error");
      return;
    }

    const ids = selectedRows.map(contribIdFor).filter(Boolean);
    if (!ids.length) {
      toast("Selected rows have no API ID yet", "error");
      return;
    }

    // Confirm
    const ok = window.confirm(
      `Verify ${ids.length} contribution${ids.length > 1 ? "s" : ""}? This will add hours to each volunteer's verified record.`
    );
    if (!ok) return;

    await withBusy(e.currentTarget, "Verifying…", async () => {
      try {
        await API.activities.contributions.bulkVerify(ids);
        toast(`Verified ${ids.length} contribution${ids.length > 1 ? "s" : ""}`, "success");
        // Best-effort refresh from server
        await hydrateContributions();
      } catch (err) {
        toast(err.message || "Bulk verify failed", "error");
      }
    });
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
  bell?.addEventListener("click", async () => {
    bell.querySelector('span.bg-\\[\\#BA1A1A\\]')?.remove();
    try {
      await API.notifications.markAllRead();
    } catch (_) { /* non-blocking */ }
    toast("No new notifications", "success");
  });

  /* WIRE FILTER EVENTS */
  let timer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(applyAllFilters, 150);
  });
  oppSelect?.addEventListener("change", applyAllFilters);

  /* GLOBAL 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

  /* HYDRATE METRICS STRIP */
  async function hydrateMetrics() {
    if (!window.API) return;
    try {
      const res = await API.activities.metrics();
      const m = res?.data || res || {};

      const setCard = (label, value) => {
        const labelEl = byText("p", label);
        if (!labelEl) return;
        const card = labelEl.closest("div")?.parentElement;
        const valueEl = card ? $$("p", card).find((p) => /^\d+$/.test(p.textContent.trim())) : null;
        if (valueEl && value != null) valueEl.textContent = String(value);
      };

      // Match the four bento cards by their label text
      if (m.active       != null) setCard("active activities",  m.active);
      if (m.upcoming     != null) setCard("upcoming activities", m.upcoming);
      if (m.awaiting     != null || m.pending != null) {
        const awaiting = m.awaiting ?? m.pending;
        const labelEl = byText("span", "awaiting");
        if (labelEl) {
          const card = labelEl.closest("div")?.parentElement?.parentElement;
          const valueEl = card ? $$("span", card).find((s) => /^\d+$/.test(s.textContent.trim())) : null;
          if (valueEl) valueEl.textContent = String(awaiting);
        }
      }
      if (m.completed    != null) setCard("completed activities", m.completed);
    } catch (err) {
      console.warn("[activities] metrics hydrate failed:", err);
    }
  }

  /* HYDRATE CONTRIBUTIONS (attach IDs, refresh submitted-at, recompute tags) */
  async function hydrateContributions() {
    if (!window.API) return;
    try {
      const res = await API.activities.contributions.list({ limit: 50 });
      const list = Array.isArray(res) ? res : (res?.data || res?.contributions || []);

      list.forEach((c) => {
        const key = (c.volunteerName || c.volunteer?.name || "")
          .toString().trim().toLowerCase();
        if (key) contribIndex.set(key, c);
      });

      // Attach IDs and refresh row metadata
      allRows.forEach((row) => {
        const name = $("td:nth-child(2) p", row)?.textContent.trim().toLowerCase();
        if (!name) return;
        const c = contribIndex.get(name);
        if (!c) return;

        row.dataset.contribId = c.id;
        if (c.status) row.dataset.status =
          /verified|approved/i.test(c.status) ? "completed"
          : /pending/i.test(c.status)         ? "pending"
          : "pending";

        // Rewrite the "Submitted" cell's date/time if the server sent one
        const ts = c.submittedAt || c.createdAt;
        if (ts) {
          const d = new Date(ts);
          if (!isNaN(d.getTime())) {
            const dateEl = $("td:nth-child(5) p", row);
            const timeEl = $("td:nth-child(5) p:nth-child(2)", row);
            if (dateEl) {
              dateEl.textContent = d.toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric",
              });
            }
            if (timeEl) {
              timeEl.textContent = d.toLocaleTimeString(undefined, {
                hour: "numeric", minute: "2-digit",
              });
            }
          }
        }
      });

      // Recompute searchable text now that labels may have changed
      allRows.forEach((row) => {
        row.dataset.searchText = row.textContent.replace(/\s+/g, " ").trim().toLowerCase();
      });

      applyAllFilters();
    } catch (err) {
      console.warn("[activities] contributions hydrate failed:", err);
    }
  }

  /* KICK-OFF */
  setTab("verify");
  hydrateMetrics();
  hydrateContributions();

})();