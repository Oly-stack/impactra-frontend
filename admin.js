/* IMPACTRA — Unified Platform Admin Controller*/
(() => {
  "use strict";

  /* 0. UTILITIES*/
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
    );

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const initialsOf = (name) =>
    String(name || "??").split(/\s+/).filter(Boolean)
      .map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const setTextAll = (selector, value) => {
    $$(selector).forEach((el) => { el.textContent = value ?? "—"; });
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

  const formatDateTime = (d) =>
    d
      ? new Date(d).toLocaleString(undefined, {
          day: "numeric", month: "short", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })
      : "—";

  const relativeFromNow = (d) => {
    if (!d) return "just now";
    const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return new Date(d).toLocaleDateString();
  };

  const withBusy = (btn, label, fn) => {
    if (!btn) return Promise.resolve();
    const original = btn.innerHTML;
    btn.disabled = true;
    if (label) btn.textContent = label;
    return Promise.resolve().then(fn).finally(() => {
      btn.disabled = false;
      btn.innerHTML = original;
    });
  };

  // Any admin page inside /pages/ uses relative paths different from root.
  const IN_PAGES = /\/pages\//.test(location.pathname);
  const LOGIN_URL = IN_PAGES ? "login.html" : "pages/login.html";
  const NGO_DASHBOARD_URL = IN_PAGES ? "../Dashboard.html" : "Dashboard.html";

  /* 1. AUTH + ROLE GUARD*/
  if (!window.API) {
    console.error("[admin.js] API.js not loaded — include it before admin.js.");
    return;
  }
  if (!API.tokens.isAuthenticated) {
    window.location.href = LOGIN_URL;
    return;
  }

  let currentUser = null;
  try { currentUser = JSON.parse(sessionStorage.getItem("impactra_user") || "null"); } catch (_) {}

  // Only redirect on a CONFIRMED non-admin role. Missing user → allow (avoid loops).
  if (currentUser && currentUser.role !== "platform_admin") {
    window.location.href = NGO_DASHBOARD_URL;
    return;
  }

  /*  2. TOAST */
  function toast(message, variant = "default") {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className =
        "pointer-events-none fixed bottom-6 left-1/2 z-[95] flex -translate-x-1/2 flex-col items-center gap-2";
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

  /* 3. MODAL SYSTEM*/
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    el.classList.remove("hidden");
    el.classList.add("flex", "open");
    document.body.style.overflow = "hidden";
    return el;
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("hidden");
    el.classList.remove("flex", "open");
    document.body.style.overflow = "";
  }
  function closeAllModals() {
    $$(".modal-overlay").forEach((el) => {
      el.classList.add("hidden");
      el.classList.remove("flex", "open");
    });
    document.body.style.overflow = "";
  }
  function confirmModal({ title, body, confirmLabel = "Confirm", variant = "danger" }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4";
      overlay.style.background = "rgba(15,23,42,.5)";
      overlay.style.backdropFilter = "blur(4px)";
      const palette = variant === "danger"
        ? "background:#e11d48;color:white"
        : "background:#2563eb;color:white";
      overlay.innerHTML = `
        <div style="background:white;border-radius:16px;max-width:440px;width:100%;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,.15)">
          <h2 style="font-weight:800;font-size:16px;margin-bottom:8px;color:#0f172a">${escapeHtml(title)}</h2>
          <div style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:20px">${body || ""}</div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button data-cancel style="padding:10px 16px;border-radius:8px;background:#f1f5f9;font-weight:600;font-size:13px;cursor:pointer;border:none">Cancel</button>
            <button data-confirm style="padding:10px 16px;border-radius:8px;${palette};font-weight:600;font-size:13px;cursor:pointer;border:none">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) { cleanup(); resolve(false); }
      });
      $("[data-cancel]", overlay).addEventListener("click", () => { cleanup(); resolve(false); });
      $("[data-confirm]", overlay).addEventListener("click", () => { cleanup(); resolve(true); });
      function cleanup() {
        overlay.remove();
        document.body.style.overflow = "";
      }
    });
  }

  // Backdrop close for any static modal in the markup.
  document.addEventListener("click", (e) => {
    const overlay = e.target.closest(".modal-overlay");
    if (!overlay) return;
    if (e.target !== overlay) return;
    overlay.classList.add("hidden");
    overlay.classList.remove("flex", "open");
    document.body.style.overflow = "";
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  /* 4. SIDEBAR (mobile drawer)*/
  function initSidebar() {
    const sidebar = $("#sidebar");
    const overlay = $("#overlay") || $("#sidebarOverlay");
    const openBtn = $("#openMenu") || $("#openSidebar");
    const closeBtn = $("#closeMenu") || $("#closeSidebar");

    if (!sidebar) return;

    const syncOverlay = (open) => {
      if (!overlay) return;
      overlay.classList.toggle("hidden", !open);
      overlay.classList.toggle("active", open);
    };

    function openMenu() {
      sidebar.classList.remove("-translate-x-full");
      sidebar.classList.add("open");
      syncOverlay(true);
      openBtn?.setAttribute("aria-expanded", "true");
      document.body.classList.add("overflow-hidden");
      document.body.style.overflow = "hidden";
    }
    function closeMenu() {
      sidebar.classList.add("-translate-x-full");
      sidebar.classList.remove("open");
      syncOverlay(false);
      openBtn?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("overflow-hidden");
      document.body.style.overflow = "";
    }

    openBtn?.addEventListener("click", openMenu);
    closeBtn?.addEventListener("click", closeMenu);
    overlay?.addEventListener("click", closeMenu);
    sidebar.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 1023px)").matches) closeMenu();
      })
    );
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
    window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => {
      if (e.matches) closeMenu();
    });
  }

  /* 5. LOGOUT*/
  function initLogout() {
    const btn = $("#logoutBtn") ||
      $$("aside a, aside button").find((el) => /log out/i.test(el.textContent));
    btn?.addEventListener("click", async (e) => {
      e.preventDefault();
      const ok = await confirmModal({
        title: "Log out?",
        body: "<p>You'll be signed out of the IMPACTRA admin console on this device.</p>",
        confirmLabel: "Log out",
      });
      if (!ok) return;
      try { await API.auth.logout(); } catch (_) { /* ignore */ }
      API.tokens.clear();
      sessionStorage.clear();
      window.location.href = LOGIN_URL;
    });
  }

  /*  6. BELL*/
  function initBell() {
    const bell = $("#bellBtn") ||
      $$("header button").find((b) => b.querySelector('span.bg-red-500, span.bg-\\[\\#e5372f\\], span.bg-\\[\\#BA1A1A\\], span.bg-\\[\\#F43F5E\\]'));
    bell?.addEventListener("click", async () => {
      // Remove any red-dot badge inside the bell
      $$("span.rounded-full, span.bg-red-600, span.bg-red-500, span.bg-\\[\\#e5372f\\], span.bg-\\[\\#F43F5E\\], span.bg-\\[\\#BA1A1A\\]", bell)
        .forEach((s) => {
          const isDot = s.classList.toString().match(/rounded-full|bg-\[#/);
          if (isDot) s.remove();
        });
      try { await API.notifications.markAllRead(); } catch (_) {}
      toast("You're all caught up", "success");
    });
  }

  /* 7. HEADER PROFILE*/
  function hydrateHeader() {
    if (!currentUser) return;
    const name = currentUser.name || currentUser.fullName || "Admin";
    const initials = initialsOf(name);

    $$("[data-user-name]").forEach((el) => (el.textContent = name.split(" ")[0]));
    $$("[data-user-initials]").forEach((el) => (el.textContent = initials));

    // Heuristic for old markup without data-* attributes
    const legacyHeader = $("header .leading-tight p:first-child");
    if (legacyHeader) legacyHeader.textContent = name.split(" ")[0];
  }

  /* 8. GLOBAL 401*/
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = LOGIN_URL), 900);
  });

  /* 9. DEMO DATA (used only when the backend endpoint is missing) */
  const DEMO_REPORTS = [
    { id: "R-2024-021", type: "user", title: "User: John Doe", sub: "ID: #USR-99214 • 3 previous notices", cat: "Inappropriate Behaviour", date: "2024-08-12T00:00:00", status: "open" },
    { id: "R-2024-020", type: "org", title: "Organization: Hope Foundation", sub: "Org Reg: #ORG-88421 • Registered NGO", cat: "Misleading information", date: "2024-08-11T00:00:00", status: "review" },
    { id: "R-2024-019", type: "opportunity", title: "Opportunity: Beach Cleanup", sub: "Location: Santa Monica Pier • 45 volunteers enrolled", cat: "Safety concern", date: "2024-08-10T00:00:00", status: "open", urgent: true },
    { id: "R-2024-018", type: "user", title: "User: Sarah K.", sub: "ID: #USR-77312 • Field volunteer", cat: "Harassment", date: "2024-08-09T00:00:00", status: "resolved" },
    { id: "R-2024-017", type: "org", title: "Organization: Youth for Change", sub: "Org Reg: #ORG-33104 • Youth Advocacy", cat: "Policy violation", date: "2024-08-08T00:00:00", status: "review" },
    { id: "R-2024-016", type: "content", title: "Content: Event post", sub: "Public campaign announcement • Community feed", cat: "Inappropriate content", date: "2024-08-07T00:00:00", status: "open", pill: true },
    { id: "R-2024-015", type: "user", title: "User: Michael T.", sub: "ID: #USR-66120 • Team lead", cat: "Harassment", date: "2024-08-06T00:00:00", status: "resolved" },
    { id: "R-2024-014", type: "org", title: "Organization: Green Roots", sub: "Org Reg: #ORG-21877 • Environmental", cat: "Policy violation", date: "2024-08-05T00:00:00", status: "open" },
  ];

  const DEMO_REPORT_DETAIL = {
    "R-2024-021": {
      id: "R-2024-021",
      priority: "high",
      slaText: "Assigned to Admin Team Alpha (SLA: 4h 12m left)",
      reportee: { name: "John Doe", kind: "Volunteer", ref: "#V-89104", link: "#" },
      reporter: { name: "Mary A.", kind: "Verified Field Volunteer" },
      category: "Inappropriate behaviour",
      reportedAt: "2024-08-12T10:24:00Z",
      statement: "This user sent inappropriate messages during the regional water distribution event and made other volunteers uncomfortable. Despite verbal reminders from the area coordinator, the behavior persisted during the group cleanup shift.",
      mission: "Clean Water Initiative #04",
      witnesses: "2 Field Volunteers",
      priorViolations: "1 previous warning (Jun 2024)",
      evidence: [
        { name: "Screenshot 1.png", size: "PNG · 1.2 MB", url: "#" },
        { name: "Screenshot 2.png", size: "PNG · 950 KB", url: "#" },
        { name: "Chat transcript.pdf", size: "PDF · 420 KB", url: "#" },
      ],
      metadata: "Metadata confirmed: EXIF GPS matched event site.",
      reporterStanding: { label: "High Trust (99.4%)", value: 96 },
      missionsCount: "34 deployments",
      falseReports: "0 reported",
      notes: [{
        author: "Admin User (Lead Moderator)",
        initials: "AU",
        at: "2024-08-12T11:05:00Z",
        text: "Verified event logs against incident timestamp. Attached chat transcripts match time windows recorded by telemetry.",
      }],
      related: [],
    },
  };

  const DEMO_ACTIVITY = [
    { kind: "approved",  title: "Hope Foundation approved",            actor: "by Admin User",    when: "2 hours ago" },
    { kind: "dismissed", title: "Report #R-2024-018 dismissed",        actor: "by Admin User",    when: "4 hours ago" },
    { kind: "resolved",  title: "Support ticket #S-2024-032 resolved", actor: "by Support Team",  when: "6 hours ago" },
    { kind: "submitted", title: "New NGO application submitted",       actor: "by Bright Future", when: "1 day ago" },
  ];

  /*  10. PAGE: DASHBOARD (welcome-back.html)*/
  async function initDashboard() {
    // Current date chip
    const dateEl = $("[data-current-date]") || byText("span", /^(Sunday|Monday|Tuesday)/);
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: "long", day: "numeric", month: "short", year: "numeric",
      });
    }

    // Stats — try API.admin.dashboard(), fall back to demo values
    const DEMO_STATS = { reports: 8, support: 15, users: 2842, usersTrend: "+8.4% this month" };
    let stats = null;
    try {
      const res = await API.admin.dashboard();
      const s = res?.data || res || {};
      if (s.totalReports != null || s.totalUsers != null || s.totalSupport != null) {
        stats = {
          reports: s.totalReports ?? s.openReports ?? DEMO_STATS.reports,
          support: s.totalSupport ?? s.openTickets ?? DEMO_STATS.support,
          users:   s.totalUsers ?? DEMO_STATS.users,
          usersTrend: s.newUsersThisMonth != null
            ? `+${s.newUsersThisMonth} this month`
            : DEMO_STATS.usersTrend,
        };
      }
    } catch (err) {
      console.warn("[admin.js:dashboard] stats failed:", err);
    }
    const finalStats = stats || DEMO_STATS;
    const setStat = (key, value) => {
      const el = $(`[data-stat="${key}"]`);
      if (el) el.textContent = typeof value === "number" ? value.toLocaleString() : value;
    };
    setStat("reports", finalStats.reports);
    setStat("support", finalStats.support);
    setStat("users", finalStats.users);
    setStat("users-trend", finalStats.usersTrend);

    // Needs Your Attention — fetch pending organizations
    const attentionIconByType = {
      org: { icon: "building-2", bg: "bg-blue-100", color: "text-brand" },
      report: { icon: "circle-alert", bg: "bg-red-100", color: "text-red-600" },
      ticket: { icon: "ticket", bg: "bg-blue-100", color: "text-slate-800" },
      response: { icon: "clipboard-check", bg: "bg-green-100", color: "text-green-700" },
    };
    const attentionList = $("#attentionList");
    const attentionCount = $("#attentionCount");
    if (attentionList) {
      try {
        const res = await API.admin.pendingOrganizations();
        const list =
          (Array.isArray(res) && res) || res?.data || res?.organizations || res?.pendingOrganizations || [];
        const items = (Array.isArray(list) ? list : []).slice(0, 4).map((org) => ({
          type: "org",
          title: `New NGO application from ${org.name || "an organization"}`,
          sub: `Submitted ${relativeFromNow(org.createdAt || org.submittedAt)}`,
          href: `pages/application-review.html?id=${encodeURIComponent(org._id || org.id || "")}`,
          cta: "Review",
        }));

        if (!items.length) {
          attentionList.innerHTML = `<p class="text-sm text-slate-500 italic py-6 text-center">You're all caught up.</p>`;
          attentionCount?.classList.add("hidden");
        } else {
          if (attentionCount) {
            attentionCount.textContent = `${items.length} Action${items.length === 1 ? "" : "s"}`;
            attentionCount.classList.remove("hidden");
          }
          attentionList.innerHTML = items.map((item) => {
            const meta = attentionIconByType[item.type] || attentionIconByType.org;
            const cta = item.href
              ? `<a href="${escapeHtml(item.href)}" class="bg-brand text-white font-medium text-sm px-5 py-2 rounded-lg hover:bg-blue-800">${escapeHtml(item.cta || "Review")}</a>`
              : `<button class="text-sm font-medium px-5 py-2 rounded-lg hover:bg-slate-200">${escapeHtml(item.cta || "View")}</button>`;
            return `
              <div class="flex items-center gap-4 bg-slate-50 rounded-lg p-3">
                <span class="w-10 h-10 shrink-0 rounded-lg ${meta.bg} grid place-items-center">
                  <i data-lucide="${meta.icon}" class="w-5 h-5 ${meta.color}"></i>
                </span>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm truncate">${escapeHtml(item.title)}</p>
                  <p class="text-sm text-slate-600">${escapeHtml(item.sub)}</p>
                </div>
                ${cta}
              </div>`;
          }).join("");
          if (window.lucide?.createIcons) { try { lucide.createIcons(); } catch (_) {} }
        }
      } catch (err) {
        console.warn("[admin.js:dashboard] attention failed:", err);
        attentionList.innerHTML = `<p class="text-sm text-slate-500 italic py-6 text-center">Couldn't load pending items.</p>`;
      }
    }

    // Platform Activity (demo)
    const activityList = $("#activityList");
    if (activityList) {
      const iconMap = {
        approved: { icon: "badge-check", bg: "bg-green-100", color: "text-green-700" },
        dismissed: { icon: "circle-minus", bg: "bg-indigo-100", color: "text-slate-600" },
        resolved: { icon: "circle-check", bg: "bg-green-100", color: "text-green-700" },
        submitted: { icon: "building", bg: "bg-indigo-100", color: "text-brand" },
      };
      activityList.innerHTML = DEMO_ACTIVITY.map((item) => {
        const meta = iconMap[item.kind] || iconMap.submitted;
        return `
          <li class="flex items-start gap-4">
            <span class="w-9 h-9 shrink-0 rounded-full ${meta.bg} grid place-items-center">
              <i data-lucide="${meta.icon}" class="w-5 h-5 ${meta.color}"></i>
            </span>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm">${escapeHtml(item.title)}</p>
              <p class="text-sm text-slate-600">${escapeHtml(item.actor)}</p>
            </div>
            <span class="text-sm text-slate-600 whitespace-nowrap">${escapeHtml(item.when)}</span>
          </li>`;
      }).join("");
      if (window.lucide?.createIcons) { try { lucide.createIcons(); } catch (_) {} }
    }
  }

  /*  11. PAGE: ORGANIZATIONS LIST (Organisation.html*/
  async function initOrganizations() {
    const tbody = $("#rows");
    if (!tbody) return;

    const searchEl = $("#searchInput");

    let allOrgs = [];

    const statusPill = (status) => {
      const s = String(status || "pending").toLowerCase();
      const map = {
        pending:        { cls: "bg-amber-100 text-amber-900",     dot: "bg-amber-500",  label: "Pending" },
        info_requested: { cls: "bg-blue-100 text-blue-800",       dot: "bg-blue-600",   label: "Info Requested" },
        verified:       { cls: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500",label: "Verified" },
        approved:       { cls: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500",label: "Approved" },
        rejected:       { cls: "bg-rose-100 text-rose-800",       dot: "bg-rose-500",   label: "Rejected" },
      };
      const m = map[s] || map.pending;
      return `<span class="inline-flex items-center gap-1.5 text-xs font-medium ${m.cls} rounded-full px-2.5 py-1">
        <span class="w-1.5 h-1.5 rounded-full ${m.dot}"></span>${m.label}
      </span>`;
    };

    const shortRef = (org) =>
      org.referenceNumber || (org._id ? `#ORG-${String(org._id).slice(-6)}` : "#ORG");

    const categoryOf = (org) =>
      (Array.isArray(org.focusAreas) && org.focusAreas[0]) || org.category || "NGO";

    const renderRow = (org) => {
      const id = org._id || org.id || "";
      const name = escapeHtml(org.name || "Unnamed organization");
      const initials = escapeHtml(initialsOf(org.name));
      const ref = escapeHtml(shortRef(org));
      const cat = escapeHtml(categoryOf(org));
      const submitted = escapeHtml(formatDate(org.createdAt || org.submittedAt));
      const reviewHref = `application-review.html?id=${encodeURIComponent(id)}`;
      return `
        <tr class="grid grid-cols-2 gap-3 p-4 md:table-row md:p-0 hover:bg-slate-50/50">
          <td class="col-span-2 md:table-cell md:px-6 md:py-4">
            <div class="flex items-center gap-4">
              <span class="w-10 h-10 shrink-0 rounded-lg bg-blue-100 text-blue-700 grid place-items-center font-bold text-sm">
                ${initials}
              </span>
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">${name}</p>
                <p class="text-xs text-slate-600 truncate">${ref} • ${cat}</p>
              </div>
            </div>
          </td>
          <td class="self-center text-sm text-slate-700 md:table-cell md:px-6 md:py-4 whitespace-nowrap">
            <span class="md:hidden text-slate-500">Submitted: </span>${submitted}
          </td>
          <td class="self-center justify-self-end md:table-cell md:px-6 md:py-4">
            ${statusPill(org.verificationStatus)}
          </td>
          <td class="col-span-2 md:table-cell md:px-6 md:py-4 md:text-center">
            <a href="${reviewHref}"
               class="w-full md:w-auto inline-flex items-center justify-center gap-1.5 bg-brand text-white text-sm font-medium px-5 py-2.5 md:py-2 rounded-lg hover:bg-blue-800">
              Review
            </a>
          </td>
        </tr>`;
    };

    const renderEmpty = (msg) => {
      tbody.innerHTML = `
        <tr class="block md:table-row">
          <td colspan="4" class="block md:table-cell px-6 py-12 text-center text-sm text-slate-500">
            ${escapeHtml(msg)}
          </td>
        </tr>`;
    };

    const render = (list) => {
      if (!list.length) { renderEmpty("No organizations match your search."); return; }
      tbody.innerHTML = list.map(renderRow).join("");
    };

    const applySearch = () => {
      const q = (searchEl?.value || "").trim().toLowerCase();
      if (!q) { render(allOrgs); return; }
      render(allOrgs.filter((org) => JSON.stringify(org).toLowerCase().includes(q)));
    };

    let searchTimer;
    searchEl?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applySearch, 180);
    });

    renderEmpty("Loading organizations…");
    try {
      const res = await API.admin.pendingOrganizations();
      allOrgs =
        (Array.isArray(res) && res) || res?.data || res?.organizations || res?.pendingOrganizations || [];
      if (!Array.isArray(allOrgs)) allOrgs = [];
      render(allOrgs);
    } catch (err) {
      console.error("[admin.js:organizations] load failed:", err);
      renderEmpty("Couldn't load organizations. Please refresh.");
      toast(err.message || "Failed to load organizations", "error");
    }

    // Top stats (best-effort)
    try {
      const res = await API.admin.dashboard();
      const s = res?.data || res || {};
      const cEl = $('[data-stat="clearance"]');
      const sEl = $('[data-stat="sla"]');
      if (cEl && s.clearanceRate != null) cEl.textContent = `${s.clearanceRate}%`;
      if (sEl) {
        const sla = s.avgSlaHours ?? s.avgSlaTurnaround;
        if (sla != null) sEl.textContent = `${Number(sla).toFixed(1)} hrs`;
      }
    } catch (_) { /* decorative */ }
  }

  /* 12. PAGE: ORGANIZATION REVIEW
     (Green-initiative.html OR application-review.html) */
  async function initOrganizationReview() {
    const orgId = new URLSearchParams(location.search).get("id");
    let org = null;

    // Modal ids differ between the two variants
    const APPROVE_MODAL = document.getElementById("approveModal") ? "approveModal"
                        : document.getElementById("approvalModal") ? "approvalModal"
                        : null;
    const REJECT_MODAL = document.getElementById("rejectModal") ? "rejectModal" : null;

    const statusPillFor = (status) => {
      const s = String(status || "pending").toLowerCase();
      if (s === "verified" || s === "approved")
        return { cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "Verified" };
      if (s === "rejected")
        return { cls: "bg-rose-50 text-rose-700", dot: "bg-rose-500", label: "Rejected" };
      if (s === "info_requested")
        return { cls: "bg-blue-50 text-blue-700", dot: "bg-blue-500", label: "Info Requested" };
      return { cls: "bg-amber-50 text-amber-600", dot: "bg-amber-500", label: "Pending Review" };
    };

    function renderDocuments(docs) {
      const list = $("#documentsList");
      if (!list) return;
      const count = $("[data-doc-count]");
      if (!Array.isArray(docs) || !docs.length) {
        list.innerHTML = `<li class="text-sm text-slate-500 py-3">No documents uploaded.</li>`;
        if (count) count.textContent = "0";
        return;
      }
      if (count) count.textContent = String(docs.length);
      list.innerHTML = docs.map((doc) => {
        const url = typeof doc === "string" ? doc : doc.url || doc.path || "#";
        const name = (typeof doc === "object" && (doc.name || doc.filename)) || "Document.pdf";
        const size = typeof doc === "object" && doc.size
          ? typeof doc.size === "number" ? `${(doc.size / 1024).toFixed(0)} KB` : doc.size
          : "";
        return `
          <li class="doc-row bg-[#f8f8f8] p-3 rounded-xl flex items-center gap-2">
            <span class="material-symbols-outlined mr-2 text-rose-600 text-3xl">picture_as_pdf</span>
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">${escapeHtml(name)}</p>
              <p class="text-xs text-slate-600">PDF ${size ? `• ${escapeHtml(size)}` : ""}</p>
            </div>
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="mr-2 text-slate-700 hover:text-brand">
              <span class="material-symbols-outlined">visibility</span>
            </a>
            <a href="${escapeHtml(url)}" download class="text-slate-700 hover:text-brand">
              <span class="material-symbols-outlined">download</span>
            </a>
          </li>`;
      }).join("");
    }

    function hydrate(data) {
      org = data;

      document.title = `${data.name || "Organization"} · IMPACTRA Review`;
      setTextAll("[data-org-name]", data.name || "Unnamed Organization");
      setTextAll("[data-org-ref]", data.referenceNumber || (data._id ? `#ORG-${String(data._id).slice(-6)}` : "#ORG"));
      setTextAll("[data-org-submitted]", formatDate(data.createdAt || data.submittedAt));
      setTextAll("[data-org-submitted-full]", formatDateTime(data.createdAt || data.submittedAt));

      const pill = statusPillFor(data.verificationStatus);
      const pillEl = $("#statusPill");
      if (pillEl) {
        pillEl.className = `inline-flex items-center gap-2 ${pill.cls} text-sm font-semibold px-3 py-1.5 rounded-full`;
        const dot = pillEl.querySelector("span:first-child");
        if (dot) dot.className = `w-2 h-2 rounded-full ${pill.dot}`;
        setTextAll("[data-org-status]", pill.label);
      }

      const contactName = data.contactPerson?.name || data.contact?.name || data.owner?.name || "";
      const contactRole = data.contactPerson?.role || data.contact?.role || "Executive Director";
      setTextAll("[data-org-contact-name]", contactName || "—");
      setTextAll("[data-org-contact-role]", contactRole);
      setTextAll("[data-org-contact-initials]", initialsOf(contactName));

      const email = data.email || data.contactEmail || "";
      const emailLink = $("[data-org-email-link]");
      if (emailLink) emailLink.href = email ? `mailto:${email}` : "#";
      setTextAll("[data-org-email]", email || "—");
      setTextAll("[data-org-phone]", data.phone || "—");

      const website = data.website || "";
      const webEl = $("[data-org-website]");
      if (webEl) {
        webEl.href = website || "#";
        const textNode = Array.from(webEl.childNodes).find((n) => n.nodeType === 3);
        const label = website ? website.replace(/^https?:\/\//, "") : "—";
        if (textNode) textNode.nodeValue = label;
        else webEl.insertBefore(document.createTextNode(label), webEl.firstChild);
      }

      setTextAll("[data-org-mission]", data.description || data.missionStatement || "—");

      const loc = data.location || {};
      const address =
        [loc.streetAddress, loc.cityCountry, loc.landmark].filter(Boolean).join(", ") ||
        (typeof data.location === "string" ? data.location : "") || "—";
      setTextAll("[data-org-address]", address);

      const reg = data.registrationDetails || {};
      setTextAll("[data-org-cac]", reg.registrationNumber || "—");
      setTextAll("[data-org-tax]", reg.tin || reg.taxId || "—");

      const logoUrl = data.logo?.url || (typeof data.logo === "string" ? data.logo : "");
      const logoImg = $("#orgLogoImg");
      const logoFallback = $("#orgLogoFallback");
      if (logoUrl && logoImg) {
        logoImg.src = logoUrl;
        logoImg.style.display = "block";
        logoImg.classList.remove("hidden");
        if (logoFallback) { logoFallback.style.display = "none"; logoFallback.classList.add("hidden"); }
      } else {
        if (logoImg) { logoImg.style.display = "none"; logoImg.classList.add("hidden"); }
        if (logoFallback) { logoFallback.style.display = "flex"; logoFallback.classList.remove("hidden"); }
      }
      setTextAll("[data-org-logo-name]", (data.name || "—").toUpperCase());
      const logoFilename = $("[data-org-logo-filename]");
      if (logoFilename) {
        const fname = data.logo?.filename || data.logoFilename;
        logoFilename.textContent = fname || (logoUrl ? "logo.png" : "no-logo");
      }
      const downloadLogo = $("#downloadLogo");
      if (downloadLogo) downloadLogo.href = logoUrl || "#";

      renderDocuments(data.supportingDocuments || data.documents || []);
    }

    async function load() {
      if (!orgId) { toast("No organization id in URL", "error"); return; }
      try {
        const res = await API.admin.allOrganizations();
        const list = (Array.isArray(res) && res) || res?.data || res?.organizations || [];
        const found = (Array.isArray(list) ? list : []).find((o) => (o._id || o.id) === orgId);
        if (!found) { toast("Organization not found", "error"); return; }
        hydrate(found);
      } catch (err) {
        console.error("[admin.js:organization-review] load failed:", err);
        toast(err.message || "Couldn't load organization", "error");
      }
    }

    /*  Approve  */
    $("#approveBtn")?.addEventListener("click", () => {
      if (!org) { toast("Organization not loaded", "error"); return; }
      if (APPROVE_MODAL) openModal(APPROVE_MODAL);
    });
    $("#closeApprove")?.addEventListener("click", () => APPROVE_MODAL && closeModal(APPROVE_MODAL));
    $("#cancelApprove")?.addEventListener("click", () => APPROVE_MODAL && closeModal(APPROVE_MODAL));

    $("#confirmApprove")?.addEventListener("click", (ev) => {
      if (!org) return;
      withBusy(ev.currentTarget, "Approving…", async () => {
        try {
          await API.admin.approveOrganization(org._id || org.id);
          if (APPROVE_MODAL) closeModal(APPROVE_MODAL);
          toast("Organization approved", "success");
          setTimeout(() => (window.location.href = "Organisation.html"), 800);
        } catch (err) {
          console.error("[admin.js:organization-review] approve failed:", err);
          toast(err.message || "Couldn't approve organization", "error");
        }
      });
    });

    /*  Reject  */
    $("#rejectBtn")?.addEventListener("click", () => {
      if (!org) { toast("Organization not loaded", "error"); return; }
      const reasonEl = $("#rejectReason");
      if (reasonEl) reasonEl.value = "";
      if (REJECT_MODAL) openModal(REJECT_MODAL);
    });
    $("#closeReject")?.addEventListener("click", () => REJECT_MODAL && closeModal(REJECT_MODAL));
    $("#cancelReject")?.addEventListener("click", () => REJECT_MODAL && closeModal(REJECT_MODAL));

    $("#confirmReject")?.addEventListener("click", (ev) => {
      if (!org) return;
      const reason = $("#rejectReason")?.value.trim();
      if (!reason) {
        toast("Please provide a reason for the rejection", "error");
        $("#rejectReason")?.focus();
        return;
      }
      withBusy(ev.currentTarget, "Rejecting…", async () => {
        try {
          await API.admin.rejectOrganization(org._id || org.id, reason);
          if (REJECT_MODAL) closeModal(REJECT_MODAL);
          toast("Organization rejected", "info");
          setTimeout(() => (window.location.href = "Organisation.html"), 800);
        } catch (err) {
          console.error("[admin.js:organization-review] reject failed:", err);
          toast(err.message || "Couldn't reject organization", "error");
        }
      });
    });

    /* Request more information (clipboard compose) */
    $("#requestInfoBtn")?.addEventListener("click", async () => {
      if (!org) return;
      const email = org.email || org.contactEmail || "";
      const subject = `Additional information required for ${org.name || "your organization"}`;
      const body = [
        `Hi ${org.contactPerson?.name || "there"},`,
        "",
        `While reviewing ${org.name || "your organization"}, our team needs a bit more information before we can proceed.`,
        "Please reply to this email with the requested details.",
        "",
        "— IMPACTRA Platform Admin",
      ].join("\n");
      try {
        await navigator.clipboard.writeText(`To: ${email}\nSubject: ${subject}\n\n${body}`);
        toast(email ? `Message copied — reach out to ${email}` : "Message copied", "success");
      } catch (_) {
        toast("Couldn't access clipboard", "error");
      }
    });

    /*  Tabs (visual state only)  */
    const tabs = $$("#tabs .tab, #tabs .tab-item, #tabs [data-tab]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.remove("border-brand", "text-brand", "font-semibold", "active");
          t.classList.add("border-transparent", "text-[#2b3048]", "font-medium");
        });
        tab.classList.remove("border-transparent", "text-[#2b3048]", "font-medium");
        tab.classList.add("border-brand", "text-brand", "font-semibold", "active");
      });
    });

    load();
  }

  /* 13. PAGE: REPORTS LIST (report.html) */
  async function initReports() {
    const rowsEl = $("#rows");
    if (!rowsEl) return;

    const rangeEl  = $("#range");
    const totalEl  = $("#total");
    const pagerEl  = $("#pager");
    const searchEl = $("#search");
    const demoBadge = $("#demoBadge");

    let allReports = [];
    let page = 1;
    let perPage = 6;
    let query = "";
    let statusFilter = "all";
    let isDemo = false;

    const iconsByType = { user: "i-user", org: "i-building", opportunity: "i-heart", content: "i-doc" };

    const statusBadge = {
      open: `<span class="inline-flex items-center rounded-full bg-danger-soft px-2.5 py-1 text-[10.5px] font-semibold text-danger">Open</span>`,
      review: `<span class="inline-flex items-center gap-1.5 rounded-2xl bg-[#dbe5ff] px-3 py-[7px] text-left text-[10.5px] font-semibold leading-tight text-[#1c3fa6]"><i class="h-1 w-1 rounded-full bg-[#1c3fa6]"></i><span>Under<br/>Review</span></span>`,
      resolved: `<span class="inline-flex items-center rounded-full bg-ok-soft px-2.5 py-1 text-[10.5px] font-semibold text-ok-dark">Resolved</span>`,
    };

    const reviewBtn = `<button data-action="review" class="h-8 rounded-md bg-brand px-4 text-xs font-semibold text-white hover:bg-brand-dark">Review</button>`;
    const viewBtn   = `<button data-action="view" class="inline-flex h-8 items-center gap-2 rounded-md bg-field px-4 text-xs font-semibold hover:bg-[#e0e3f6]"><svg class="ic"><use href="#i-eye"/></svg>View</button>`;

    const catChip = (r) => {
      const rounded = r.pill ? "rounded-full" : "rounded-md";
      const tone = r.urgent ? "border-danger-border text-danger" : "border-[#8a93b8] text-ink";
      return `<span class="inline-block max-w-[96px] border bg-white px-2 py-[5px] text-center text-[10.5px] font-medium leading-tight ${rounded} ${tone}">${escapeHtml(r.cat)}</span>`;
    };
    const idCell = (id) => {
      const i = id.lastIndexOf("-");
      if (i === -1) return escapeHtml(id);
      return `${escapeHtml(id.slice(0, i + 1))}<br/>${escapeHtml(id.slice(i + 1))}`;
    };
    const formatReportDate = (raw) => {
      if (!raw) return "—";
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return `${day}<br/>${d.getFullYear()}`;
    };

    function render() {
      const q = query.toLowerCase();
      const filtered = allReports.filter((r) => {
        const matchesQuery = !q || `${r.id} ${r.title} ${r.sub} ${r.cat}`.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || r.status === statusFilter;
        return matchesQuery && matchesStatus;
      });

      const pages = Math.max(1, Math.ceil(filtered.length / perPage));
      page = Math.min(page, pages);
      const start = (page - 1) * perPage;
      const slice = filtered.slice(start, start + perPage);

      rowsEl.innerHTML = slice.map((r) => `
        <tr class="border-b border-[#f1f2f9] last:border-0 hover:bg-[#fafbff]">
          <td class="py-3 pl-9 pr-2 font-mono text-[11.5px] font-semibold leading-normal text-[#1c2036]">${idCell(r.id)}</td>
          <td class="py-3 pl-6 pr-2">
            <div class="flex items-center gap-2.5">
              <span class="grid h-[30px] w-[30px] flex-none place-items-center rounded-lg bg-brand-soft text-[#1f3fa8]">
                <svg class="ic"><use href="#${iconsByType[r.type] || "i-doc"}"/></svg>
              </span>
              <div>
                <div class="text-[12.5px] font-semibold">${escapeHtml(r.title)}</div>
                <div class="mt-0.5 text-[11px] text-muted">${escapeHtml(r.sub)}</div>
              </div>
            </div>
          </td>
          <td class="px-2 py-3 text-center">${catChip(r)}</td>
          <td class="whitespace-nowrap px-2 py-3 text-xs text-[#2b3048]">${formatReportDate(r.date)}</td>
          <td class="px-2 py-3 text-center">${statusBadge[r.status] || ""}</td>
          <td class="py-3 pl-2 pr-4 text-center">
            <button data-report-id="${escapeHtml(r.id)}" data-report-status="${escapeHtml(r.status)}" class="contents">
              ${r.status === "open" ? reviewBtn : viewBtn}
            </button>
          </td>
        </tr>`).join("") ||
        `<tr><td colspan="6" class="py-10 text-center text-muted">No reports found.</td></tr>`;

      rowsEl.querySelectorAll("[data-report-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.location.href = `reportdetail.html?id=${encodeURIComponent(btn.dataset.reportId)}`;
        });
      });

      if (rangeEl) rangeEl.textContent = filtered.length ? `${start + 1}-${start + slice.length}` : "0";
      if (totalEl) totalEl.textContent = filtered.length;
      renderPager(pages);
      renderStats(filtered);
      renderPriorityBreakdown(filtered);
    }

    function renderPager(pages) {
      if (!pagerEl) return;
      const nav = "grid h-6 w-6 place-items-center rounded-md bg-field text-xs font-medium disabled:opacity-40";
      pagerEl.innerHTML =
        `<button class="${nav}" data-go="${page - 1}" ${page === 1 ? "disabled" : ""} aria-label="Previous"><svg class="ic !h-3 !w-3"><use href="#i-left"/></svg></button>` +
        Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
          `<button data-go="${n}" class="grid h-6 w-6 place-items-center rounded-md text-xs font-medium ${n === page ? "bg-brand text-white" : "bg-field"}">${n}</button>`
        ).join("") +
        `<button class="${nav}" data-go="${page + 1}" ${page === pages ? "disabled" : ""} aria-label="Next"><svg class="ic !h-3 !w-3"><use href="#i-right"/></svg></button>` +
        `<select id="perPage" class="ml-3 h-[30px] w-[86px] appearance-none rounded-md bg-field bg-[length:10px] bg-[right_10px_center] bg-no-repeat pl-3 pr-7 text-xs">
          ${[6, 12, 24].map((n) => `<option value="${n}" ${n === perPage ? "selected" : ""}>${n} per page</option>`).join("")}
        </select>`;
    }

    function renderStats(list) {
      const open = list.filter((r) => r.status === "open").length;
      const review = list.filter((r) => r.status === "review").length;
      const resolved = list.filter((r) => r.status === "resolved").length;
      const setStat = (key, value) => {
        const el = $(`[data-stat="${key}"]`);
        if (el) el.textContent = value;
      };
      setStat("open", open);
      setStat("review", review);
      setStat("resolved", resolved);
      setStat("open-sub", open ? `${open} awaiting review` : "Nothing pending");
      setStat("review-sub", review ? `${review} in progress` : "All clear");
      setStat("resolved-sub", resolved ? `${Math.round((resolved / Math.max(1, list.length)) * 100)}% resolution rate` : "—");
    }

    function renderPriorityBreakdown(list) {
      const host = $("#priorityList");
      if (!host) return;
      if (!list.length) { host.innerHTML = `<p class="text-xs text-muted">No reports to break down.</p>`; return; }
      const buckets = new Map();
      list.forEach((r) => buckets.set(r.cat, (buckets.get(r.cat) || 0) + 1));
      const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      const total = list.length;
      host.innerHTML = sorted.map(([cat, count]) => {
        const pct = Math.round((count / total) * 100);
        const isUrgent = /harass|safety|danger/i.test(cat);
        const barColor = isUrgent ? "bg-danger-border" : "bg-brand";
        const textColor = isUrgent ? "text-danger" : "text-ink";
        return `
          <div>
            <div class="mb-1.5 flex justify-between text-[11.5px]">
              <span>${escapeHtml(cat)}</span>
              <b class="font-semibold ${textColor}">${pct}%</b>
            </div>
            <div class="h-1.5 overflow-hidden rounded bg-field">
              <span class="block h-full ${barColor} rounded" style="width:${pct}%"></span>
            </div>
          </div>`;
      }).join("");
    }

    pagerEl?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-go]");
      if (b && !b.disabled) { page = +b.dataset.go; render(); }
    });
    pagerEl?.addEventListener("change", (e) => {
      if (e.target.id === "perPage") { perPage = +e.target.value; page = 1; render(); }
    });

    let searchTimer;
    searchEl?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        query = e.target.value.trim();
        page = 1;
        render();
      }, 150);
    });

    $("#filterBtn")?.addEventListener("click", () => {
      const next = prompt("Filter by status:\n  all\n  open\n  review\n  resolved", statusFilter);
      if (next == null) return;
      const val = next.trim().toLowerCase();
      if (!["all", "open", "review", "resolved"].includes(val)) {
        toast("Unknown status — try all, open, review, or resolved", "error");
        return;
      }
      statusFilter = val;
      page = 1;
      $("#filterDot")?.classList.toggle("hidden", statusFilter === "all");
      render();
      toast(`Filtered by: ${statusFilter}`, "info");
    });

    $("#exportBtn")?.addEventListener("click", () => {
      const q = query.toLowerCase();
      const filtered = allReports.filter((r) => {
        const matchesQuery = !q || `${r.id} ${r.title} ${r.sub} ${r.cat}`.toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || r.status === statusFilter;
        return matchesQuery && matchesStatus;
      });
      if (!filtered.length) { toast("Nothing to export", "info"); return; }
      const rows = [
        ["ID", "Title", "Subtitle", "Category", "Status", "Date"],
        ...filtered.map((r) => [
          r.id, r.title, r.sub, r.cat, r.status,
          new Date(r.date).toISOString().slice(0, 10),
        ]),
      ];
      const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `impactra-reports-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported ${filtered.length} report${filtered.length === 1 ? "" : "s"}`, "success");
    });

    // Load
    rowsEl.innerHTML = `<tr><td colspan="6" class="py-10 text-center text-muted">Loading reports…</td></tr>`;
    try {
      if (typeof API.admin?.reports === "function") {
        const res = await API.admin.reports();
        const list = res?.data || res?.reports || res || [];
        if (Array.isArray(list) && list.length) {
          allReports = list.map((r) => ({
            id: r.referenceNumber || r._id || "—",
            type: r.type || "content",
            title: r.title || r.subject || "Untitled report",
            sub: r.subtitle || r.description || "",
            cat: r.category || "Unspecified",
            date: r.createdAt || r.date || Date.now(),
            status: (r.status || "open").toLowerCase(),
            urgent: r.priority === "high" || r.urgent === true,
          }));
          isDemo = false;
          render();
          return;
        }
      }
    } catch (err) {
      console.warn("[admin.js:reports] API reports failed, falling back to demo:", err);
    }
    allReports = DEMO_REPORTS.slice();
    isDemo = true;
    demoBadge?.classList.remove("hidden");
    render();
  }

  /* 14. PAGE: REPORT DETAIL (reportdetail.html)*/
  async function initReportDetail() {
    const reportId = new URLSearchParams(location.search).get("id");
    let report = null;

    function renderEvidence(list, metadata) {
      const host = $("#evidenceList");
      if (!host) return;
      if (!list.length) {
        host.innerHTML = `<p class="text-[11px] text-muted italic">No evidence attached.</p>`;
        return;
      }
      const items = list.map((ev) => `
        <div class="flex items-center gap-2.5 rounded-lg bg-panel p-1.5 pr-3">
          <div class="h-[38px] w-[38px] flex-none overflow-hidden rounded-md bg-white ring-1 ring-line grid place-items-center">
            <span class="text-[10px] font-semibold text-muted uppercase">
              ${escapeHtml((ev.name || "").split(".").pop()?.slice(0, 4) || "file")}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-[12px] font-semibold">${escapeHtml(ev.name)}</div>
            <div class="text-[10px] text-muted">${escapeHtml(ev.size || "")}</div>
          </div>
          <a href="${escapeHtml(ev.url || "#")}" download
             class="text-[#3a3f58] hover:text-brand"
             aria-label="Download ${escapeHtml(ev.name)}">
            <svg class="ic !h-3.5 !w-3.5"><use href="#i-download"/></svg>
          </a>
        </div>`).join("");
      const metaBox = metadata
        ? `<div class="flex items-start gap-2 rounded-lg bg-tint px-3 py-2.5 text-[10.5px] leading-snug text-[#1c2036]">
            <svg class="ic mt-px !h-3.5 !w-3.5 text-brand"><use href="#i-shield-check"/></svg>
            <span>${escapeHtml(metadata)}</span>
          </div>`
        : "";
      host.innerHTML = items + metaBox;
    }

    function renderNotes(list) {
      const host = $("#notes");
      if (!host) return;
      if (!list.length) {
        host.innerHTML = `<li class="text-[11px] text-muted italic">No admin notes yet.</li>`;
        return;
      }
      host.innerHTML = list.map((n) => `
        <li class="flex gap-2.5">
          <span class="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-black text-[7.5px] font-semibold text-white">
            ${escapeHtml(initialsOf(n.author || "AU"))}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <span class="text-[10.5px] font-semibold">${escapeHtml(n.author || "Admin")}</span>
              <span class="text-[10px] text-muted">${escapeHtml(formatDateTime(n.at))}</span>
            </div>
            <p class="mt-0.5 text-[10.5px] leading-snug text-muted">${escapeHtml(n.text || "")}</p>
          </div>
        </li>`).join("");
    }

    function hydrate(r) {
      report = r;
      setTextAll("#reportTitle", `Report #${r.id}`);
      document.title = `${r.id} · Incident Review · IMPACTRA`;

      const priorityChip = $("#priorityChip");
      if (priorityChip) {
        const isHigh = (r.priority || "").toLowerCase() === "high";
        priorityChip.textContent = isHigh ? "High priority" : "Standard priority";
        priorityChip.className = isHigh
          ? "rounded-full border border-danger-border px-2 py-0.5 text-[10.5px] font-medium text-danger"
          : "rounded-full border border-line px-2 py-0.5 text-[10.5px] font-medium text-muted";
      }
      if (r.slaText) setTextAll("#slaText", r.slaText);

      const reportee = r.reportee || {};
      setTextAll("[data-reportee-name]", reportee.name || "—");
      setTextAll("[data-reportee-meta]",
        `${reportee.kind || ""} ${reportee.ref ? "· " + reportee.ref : ""}`.trim() || "—");
      setTextAll("[data-reportee-initials]", initialsOf(reportee.name));
      const reporteeLink = $("[data-reportee-link]");
      if (reporteeLink) reporteeLink.href = reportee.link || "#";

      const reporter = r.reporter || {};
      setTextAll("[data-reporter-name]", reporter.name || "—");
      setTextAll("[data-reporter-meta]", reporter.kind || "—");
      setTextAll("[data-reporter-initials]", initialsOf(reporter.name));

      setTextAll("[data-category]", r.category || "—");
      setTextAll("[data-reported-at]", formatDateTime(r.reportedAt));
      setTextAll("[data-statement]", r.statement || "—");
      setTextAll("[data-mission]", r.mission || "—");
      setTextAll("[data-witnesses]", r.witnesses || "—");
      setTextAll("[data-prior-violations]", r.priorViolations || "—");

      const standing = r.reporterStanding || {};
      const standingEl = $("[data-standings]");
      if (standingEl) {
        standingEl.innerHTML = `<svg class="ic !h-3.5 !w-3.5"><use href="#i-check-circle"/></svg>${escapeHtml(standing.label || "—")}`;
      }
      setTextAll("[data-missions-count]", r.missionsCount || "—");
      setTextAll("[data-false-reports]", r.falseReports || "—");
      const bar = $("[data-standings-bar]");
      if (bar) {
        const pct = Math.max(0, Math.min(100, Number(standing.value) || 0));
        bar.style.width = pct + "%";
      }

      renderEvidence(r.evidence || [], r.metadata);
      renderNotes(r.notes || []);

      setTextAll("[data-evidence-count]", String((r.evidence || []).length));
      setTextAll("[data-related-count]", String((r.related || []).length));
      setTextAll("[data-evidence-count-label]",
        `${(r.evidence || []).length} item${(r.evidence || []).length === 1 ? "" : "s"}`);
    }

    $("#addNote")?.addEventListener("click", async (ev) => {
      const input = $("#noteInput");
      const text = input?.value.trim();
      if (!text) { toast("Write a note first", "info"); input?.focus(); return; }
      if (!report) { toast("Report not loaded yet", "error"); return; }

      withBusy(ev.currentTarget, "Adding…", async () => {
        try {
          const endpointExists = typeof API.admin?.addReportNote === "function";
          if (endpointExists) {
            await API.admin.addReportNote(report.id, text);
          } else {
            report.notes = report.notes || [];
            report.notes.push({
              author: currentUser?.name || "Admin User (Lead Moderator)",
              at: new Date().toISOString(),
              text,
            });
          }
          renderNotes(report.notes);
          input.value = "";
          toast(endpointExists ? "Note saved" : "Note added (not persisted — backend route missing)", "success");
        } catch (err) {
          console.error("[admin.js:report-detail] add note failed:", err);
          toast(err.message || "Couldn't add note", "error");
        }
      });
    });

    // Tabs (visual state only)
    const tabs = $$("#tabs .tab, #tabs .tab-item, #tabs [data-tab]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          t.classList.remove("border-brand", "text-brand", "font-semibold", "active");
          t.classList.add("border-transparent", "text-[#2b3048]", "font-medium");
        });
        tab.classList.remove("border-transparent", "text-[#2b3048]", "font-medium");
        tab.classList.add("border-brand", "text-brand", "font-semibold", "active");
      });
    });

    if (!reportId) {
      setTextAll("#reportTitle", "Report not specified");
      toast("No report id in the URL", "error");
      return;
    }

    try {
      if (typeof API.admin?.report === "function") {
        const res = await API.admin.report(reportId);
        const data = res?.data || res;
        if (data) { hydrate(normalizeReportDetail(data)); return; }
      }
    } catch (err) {
      console.warn("[admin.js:report-detail] API fetch failed, using demo:", err);
    }

    const demo = DEMO_REPORT_DETAIL[reportId];
    if (demo) hydrate(demo);
    else {
      setTextAll("#reportTitle", `Report #${reportId}`);
      toast("This report isn't available yet", "info");
    }
  }

  function normalizeReportDetail(r) {
    return {
      id: r.referenceNumber || r._id || r.id || "—",
      priority: r.priority || (r.urgent ? "high" : "standard"),
      slaText: r.slaText || (r.assignedTo ? `Assigned to ${r.assignedTo}` : undefined),
      reportee: {
        name: r.reportee?.name || r.reporteeName || "—",
        kind: r.reportee?.kind || r.reporteeKind || "",
        ref: r.reportee?.ref || r.reporteeRef || "",
        link: r.reportee?.link || r.reporteeLink || "#",
      },
      reporter: {
        name: r.reporter?.name || r.reporterName || "—",
        kind: r.reporter?.kind || r.reporterKind || "",
      },
      category: r.category || "—",
      reportedAt: r.createdAt || r.reportedAt || null,
      statement: r.statement || r.description || "—",
      mission: r.mission?.title || r.missionTitle || "—",
      witnesses: r.witnesses != null ? `${r.witnesses} Field Volunteers` : "—",
      priorViolations: r.priorViolations || "—",
      evidence: Array.isArray(r.evidence) ? r.evidence : [],
      metadata: r.metadata || null,
      reporterStanding: r.reporterStanding || { label: "—", value: 0 },
      missionsCount: r.missionsCount != null ? `${r.missionsCount} deployments` : "—",
      falseReports: r.falseReports != null ? `${r.falseReports} reported` : "—",
      notes: Array.isArray(r.notes) ? r.notes : [],
      related: Array.isArray(r.related) ? r.related : [],
    };
  }

  /* 15. ROUTER */
  function detectPage() {
    // Preferred: explicit <body data-page="...">
    const explicit = document.body?.dataset?.page;
    if (explicit) return explicit;

    // Fallback: element sniffing
    if ($("#attentionList") && $("#activityList")) return "dashboard";
    if ($("#rows") && $("#priorityList")) return "reports";
    if ($("#reportTitle") && $("#evidenceList")) return "report-detail";
    if ($("#documentsList") && ($("#approveBtn") || $("#rejectBtn"))) return "organization-review";
    if ($("#rows") && $("table thead th")) {
      const firstTh = $("table thead th")?.textContent?.toLowerCase() || "";
      if (firstTh.includes("organization")) return "organizations";
    }
    return null;
  }

  const HANDLERS = {
    dashboard: initDashboard,
    organizations: initOrganizations,
    "organization-review": initOrganizationReview,
    reports: initReports,
    "report-detail": initReportDetail,
  };

  /*  16. BOOT*/
  function boot() {
    // Shared shell
    initSidebar();
    initLogout();
    initBell();
    hydrateHeader();

    // Lucide icons for the static markup
    if (window.lucide?.createIcons) {
      try { lucide.createIcons(); } catch (_) { /* non-blocking */ }
    }

    // Page-specific
    const page = detectPage();
    console.log("[admin.js] detected page:", page);
    if (page && HANDLERS[page]) {
      Promise.resolve(HANDLERS[page]()).catch((err) => {
        console.error(`[admin.js] ${page} init failed:`, err);
        toast(`Couldn't load ${page}`, "error");
      });
    } else if (page) {
      console.warn(`[admin.js] No handler for page "${page}"`);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();