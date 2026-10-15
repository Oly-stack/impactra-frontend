/* IMPACTRA — Activities / Contributions List */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
    );

  if (!window.API) { console.error("[act.js] API client not found."); return; }
  if (!API.tokens.isAuthenticated) { window.location.href = "pages/login.html"; return; }

  let allContributions = [];
  let currentTab = "pending";  // "active" | "pending" | "completed"
  let searchQuery = "";
  let opportunityFilter = "all";
  let dateFilter = "all";

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

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function relativeFromNow(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.max(0, Math.round(diff / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
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
  }

  /* LOGOUT */
  byText("aside button", "Log out")?.addEventListener("click", async () => {
    if (!confirm("You'll be signed out of IMPACTRA. Continue?")) return;
    try { await API.auth.logout(); } catch (_) {}
    API.tokens.clear();
    sessionStorage.clear();
    window.location.href = "pages/login.html";
  });

  /* TABS — rebind to real filtering */
  const TAB_MAP = {
    0: "active",
    1: "pending",
    2: "completed",
  };
  const tabWrap = $(".table-x-scroll");
  const tabButtons = tabWrap ? $$("button", tabWrap) : [];

  tabButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      currentTab = TAB_MAP[i] || "pending";
      highlightTab(i);
      renderTable();
    });
  });

  function highlightTab(activeIndex) {
    tabButtons.forEach((btn, i) => {
      const on = i === activeIndex;
      btn.classList.toggle("bg-white", on);
      btn.classList.toggle("shadow-[0_1px_2px_rgba(0,0,0,0.05)]", on);
    });
  }

  /* SEARCH & FILTERS */
  const searchInput = $('input[placeholder*="Search by volunteer"]');
  const globalSearch = $('input[placeholder*="Search contributions"]');
  const oppSelect = (() => {
    const opt = byText("option", "All Opportunities");
    return opt ? opt.closest("select") : null;
  })();
  const dateSelect = (() => {
    const opt = byText("option", "This Week");
    return opt ? opt.closest("select") : null;
  })();

  searchInput?.addEventListener("input", () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderTable();
  });

  oppSelect?.addEventListener("change", () => {
    opportunityFilter = oppSelect.value;
    renderTable();
  });

  dateSelect?.addEventListener("change", () => {
    dateFilter = dateSelect.value;
    renderTable();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
    }
  });

  /* LOAD DATA */
  async function loadContributions() {
    const tbody = $("#contributionsBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">Loading contributions…</td></tr>`;

    try {
      const res = await API.activities.contributions.listForOrganization();
      allContributions = res?.data || res?.contributions || res || [];

      if (!Array.isArray(allContributions)) allContributions = [];

      renderTable();
      populateOpportunityFilter();
    } catch (err) {
      console.error("[act.js] load failed:", err);
      tbody.innerHTML = `
        <tr><td colspan="8" class="px-4 py-10 text-center text-sm text-red-500">
          Couldn't load contributions: ${escapeHtml(err.message || "Unknown error")}
        </td></tr>`;
    }
  }

  async function loadStats() {
    try {
      const res = await API.activities.contributions.orgStats();
      const s = res?.data || res || {};

      setMetric("pending", s.pending ?? 0);
      setMetric("completed", s.verified ?? 0);
      setMetric("total", s.total ?? 0);
    } catch (err) {
      console.warn("[act.js] stats failed:", err);
    }
  }

  function setMetric(key, value) {
    const el = $(`[data-metric="${key}"]`);
    if (el) el.textContent = value;
  }

  /* RENDER TABLE */
  function renderTable() {
    const tbody = $("#contributionsBody");
    if (!tbody) return;

    const filtered = allContributions.filter((c) => {
      const status = (c.status || "pending").toLowerCase();

      // Tab filter
      if (currentTab === "pending" && status !== "pending") return false;
      if (currentTab === "completed" && status !== "verified" && status !== "approved") return false;
      if (currentTab === "active" && (status === "pending" || status === "verified" || status === "approved")) return false;

      // Search
      if (searchQuery) {
        const haystack = JSON.stringify(c).toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }

      // Opportunity filter
      if (opportunityFilter !== "all") {
        const oppTitle = c.activity?.title || c.opportunity?.title || c.opportunityTitle || "";
        if (oppTitle !== opportunityFilter) return false;
      }

      // Date filter (basic)
      if (dateFilter !== "all" && dateFilter !== "All time") {
        const ts = c.submittedAt || c.createdAt;
        if (ts) {
          const days = { "This Week": 7, "Last 30 days": 30, "This quarter": 90 }[dateFilter];
          if (days) {
            const diff = (Date.now() - new Date(ts).getTime()) / 86400000;
            if (diff > days) return false;
          }
        }
      }

      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">
          No contributions match your filters.
        </td></tr>`;
      updateFooter(0);
      return;
    }

    tbody.innerHTML = filtered.map(renderRow).join("");
    tbody.querySelectorAll("[data-review-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.reviewId;
        window.location.href = `contributionreview.html?id=${encodeURIComponent(id)}`;
      });
    });
    updateFooter(filtered.length);
  }

  function renderRow(c) {
    const volunteer = c.volunteer || {};
    const activity = c.activity || c.opportunity || {};
    const name = c.volunteerName || volunteer.name || "Volunteer";
    const volId = c.volunteerId || volunteer._id || c.volunteerReference || "";
    const avatar = volunteer.profileImage || volunteer.avatarUrl;
    const initial = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

    const avatarMarkup = avatar
      ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" class="h-10 w-10 rounded-full object-cover" />`
      : `<div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-bold text-[#1E40AF]">${initial}</div>`;

    const hours = c.hoursCompleted ?? c.hours ?? 0;
    const expected = c.expectedHours ?? hours;
    const submittedAt = c.submittedAt || c.createdAt;
    const submittedDate = submittedAt ? new Date(submittedAt) : null;

    const status = (c.status || "pending").toLowerCase();
    const statusPill = status === "pending"
      ? `<span class="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-3 py-1"><span class="h-1.5 w-1.5 rounded-full bg-[#F59E0B]"></span><span class="text-[11px] font-semibold text-[#92400E]">Pending Verification</span></span>`
      : status === "verified" || status === "approved"
        ? `<span class="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-3 py-1"><span class="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span><span class="text-[11px] font-semibold text-[#065F46]">Verified</span></span>`
        : `<span class="inline-flex items-center gap-1 rounded-full bg-[#FFF1F2] px-3 py-1"><span class="h-1.5 w-1.5 rounded-full bg-[#F43F5E]"></span><span class="text-[11px] font-semibold text-[#9F1239]">Changes Requested</span></span>`;

    const evidenceCount = Array.isArray(c.evidence) ? c.evidence.length : (c.evidenceCount ?? 0);

    return `
      <tr class="border-t bg-white transition hover:bg-[#f0f3ff]/40">
        <td class="px-4 py-6 align-middle">
          <input type="checkbox" class="h-4 w-4 cursor-pointer rounded-sm border border-[#767676]" />
        </td>
        <td class="px-4 py-4">
          <div class="flex items-center gap-2">
            ${avatarMarkup}
            <div>
              <p class="text-sm font-semibold leading-5">${escapeHtml(name)}</p>
              ${volId ? `<p class="font-mono text-xs font-medium leading-4 tracking-[0.12px]">#${escapeHtml(String(volId).slice(-6))}</p>` : ""}
            </div>
          </div>
        </td>
        <td class="px-4 py-4">
          <p class="text-sm font-semibold leading-5">${escapeHtml(activity.title || "Activity")}</p>
          <p class="mt-0.5 text-[13px] leading-[18px]">${escapeHtml(activity.location?.hubRegion || activity.location || "")}</p>
        </td>
        <td class="px-4 py-4">
          <p class="text-sm font-bold leading-5">${hours} hrs</p>
          <p class="mt-1 text-[11px] font-semibold leading-4 tracking-[0.55px]">Expected: ${expected} hrs</p>
        </td>
        <td class="px-4 py-4">
          ${submittedDate ? `
            <p class="text-sm font-semibold leading-5">${submittedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            <p class="mt-0.5 text-[13px] leading-[18px]">${submittedDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</p>
          ` : `<p class="text-sm text-slate-400">—</p>`}
        </td>
        <td class="px-4 py-4">
          ${evidenceCount ? `
            <span class="inline-flex items-center gap-1 rounded-md bg-[#E8EEFF] px-2 py-0.5 text-[#0051b5]">
              <span class="text-[11px] font-semibold tracking-[0.55px]">${evidenceCount} file${evidenceCount > 1 ? "s" : ""}</span>
            </span>
          ` : `<span class="text-slate-400 text-xs">—</span>`}
        </td>
        <td class="px-4 py-4">${statusPill}</td>
        <td class="px-4 py-4 text-right">
          <button type="button" data-review-id="${escapeHtml(c._id || c.id)}"
                  class="inline-flex items-center gap-1 rounded-lg bg-[#0051b5] px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-[#0046b8]">
            Review
          </button>
        </td>
      </tr>`;
  }

  function populateOpportunityFilter() {
    if (!oppSelect) return;
    const titles = new Set();
    allContributions.forEach((c) => {
      const t = c.activity?.title || c.opportunity?.title || c.opportunityTitle;
      if (t) titles.add(t);
    });
    oppSelect.innerHTML = `<option value="all">All Opportunities (${titles.size})</option>` +
      [...titles].map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  }

  function updateFooter(count) {
    const footer = byText("p", "Showing");
    if (footer) {
      footer.innerHTML = `Showing <span class="font-semibold">${count ? 1 : 0}</span> to <span class="font-semibold">${count}</span> of <span class="font-semibold">${count}</span> contributions`;
    }
  }

  /* BANNER REVIEW BUTTON — navigate to first pending */
  byText("button", "Review Contributions")?.addEventListener("click", () => {
    const pending = allContributions.filter((c) => (c.status || "pending").toLowerCase() === "pending");
    if (!pending.length) {
      toast("No pending contributions", "info");
      return;
    }
    window.location.href = `contributionreview.html?id=${encodeURIComponent(pending[0]._id || pending[0].id)}`;
  });

  /* BELL */
  const bell = $$("header button").find((b) => b.querySelector('span.bg-\\[\\#BA1A1A\\]'));
  bell?.addEventListener("click", async () => {
    bell.querySelector('span.bg-\\[\\#BA1A1A\\]')?.remove();
    try { await API.patch("/notifications/read-all", {}); } catch (_) {}
    toast("No new notifications", "success");
  });

  /* GLOBAL 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = "pages/login.html"), 900);
  });

  /* KICK OFF */
  loadContributions();
  loadStats();

})();