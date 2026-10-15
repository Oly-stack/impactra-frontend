/* IMPACTRA — Impact Dashboard */
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase()
        .includes(text.toLowerCase())
    );

  if (!window.API) { console.error("[impact.js] API client not found."); return; }
  if (!API.tokens.isAuthenticated) { window.location.href = "pages/login.html"; return; }

  let currentUser = null;
  try { currentUser = JSON.parse(sessionStorage.getItem("impactra_user") || "null"); } catch (_) {}

  /*  TOAST  */
  function toast(message, variant = "default") {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "pointer-events-none fixed bottom-6 left-1/2 z-[95] flex -translate-x-1/2 flex-col items-center gap-2";
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
    }, 2800);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "0";
  }

  /*  SIDEBAR  */
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

  /*  HEADER PROFILE  */
  if (currentUser) {
    const name = currentUser.name || currentUser.fullName || "Admin";
    setText("headerUserName", name.split(" ")[0]);
  }

  /*  BELL  */
  const bellBtn = $$("header button").find((b) => b.querySelector("span.bg-\\[\\#BA1A1A\\]"));
  bellBtn?.addEventListener("click", async () => {
    bellBtn.querySelector("span.bg-\\[\\#BA1A1A\\]")?.remove();
    try { await API.patch("/notifications/read-all", {}); } catch (_) {}
    toast("You're all caught up", "success");
  });

  /*  DATE RANGE PICKER  */
  const PRESETS = {
    "30d": { label: "Last 30 days" },
    "90d": { label: "Last 90 days" },
    "ytd": { label: "Year to date" },
    "12m": { label: "Last 12 months" },
  };

  function formatShort(d) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function presetRange(key) {
    const to = new Date();
    const from = new Date();
    switch (key) {
      case "30d": from.setDate(to.getDate() - 30); break;
      case "90d": from.setDate(to.getDate() - 90); break;
      case "ytd": from.setMonth(0, 1);             break;
      case "12m": from.setFullYear(to.getFullYear() - 1); break;
    }
    return { from, to };
  }

  const dateBtn = byText("button", "Loading…") || $$("button").find((b) => /–|Jan 1, 2026/.test(b.textContent) && /[0-9]{4}/.test(b.textContent));

  // Initialize with "Year to date" default
  const initial = presetRange("ytd");
  setText("dateRangeLabel", `${formatShort(initial.from)} – ${formatShort(initial.to)}`);

  if (dateBtn) {
    const menu = document.createElement("div");
    menu.className = "fixed z-[70] hidden w-64 overflow-hidden rounded-xl border border-[#C6C6CD]/60 bg-white shadow-xl";
    menu.innerHTML = `
      <ul class="py-1 text-sm">
        <li><button data-range="30d" class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Last 30 days</button></li>
        <li><button data-range="90d" class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Last 90 days</button></li>
        <li><button data-range="ytd" class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Year to date</button></li>
        <li><button data-range="12m" class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Last 12 months</button></li>
      </ul>
    `;
    document.body.appendChild(menu);

    const close = () => menu.classList.add("hidden");
    const open = () => {
      const r = dateBtn.getBoundingClientRect();
      menu.style.top  = `${r.bottom + 8}px`;
      menu.style.left = `${Math.min(r.left, window.innerWidth - 280)}px`;
      menu.classList.remove("hidden");
    };

    dateBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.contains("hidden") ? open() : close();
    });

    document.addEventListener("click", (e) => { if (!menu.contains(e.target)) close(); });
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);

    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-range]");
      if (!btn) return;
      const range = btn.dataset.range;
      close();
      const { from, to } = presetRange(range);
      setText("dateRangeLabel", `${formatShort(from)} – ${formatShort(to)}`);
      toast(`Showing ${PRESETS[range].label.toLowerCase()}`, "info");
      loadImpact(from, to);
    });
  }

  /*  LOAD IMPACT DATA  */
  async function loadImpact(from, to) {
    try {
      const [overviewRes, statsRes] = await Promise.allSettled([
        API.get("/organization/dashboard/overview", { startDate: from?.toISOString?.().slice(0, 10), endDate: to?.toISOString?.().slice(0, 10) }),
        API.activities.contributions.orgStats(),
      ]);

      const overview = overviewRes.status === "fulfilled" ? (overviewRes.value?.data || overviewRes.value || {}) : {};
      const stats = statsRes.status === "fulfilled" ? (statsRes.value?.data || statsRes.value || {}) : {};

      // Top metric cards
      setText("metricActiveVolunteers", (overview.totalVolunteers ?? overview.activeVolunteers ?? 0).toLocaleString());
      setText("metricVerifiedHours", (stats.verifiedHours ?? overview.verifiedHours ?? 0).toLocaleString());
      setText("metricCompletedActivities", (overview.completedActivities ?? overview.totalContributions ?? 0).toLocaleString());
      setText("metricPeopleReached", (overview.beneficiariesReached ?? overview.peopleReached ?? 0).toLocaleString());

      // Chart badge — use total verified hours
      const totalHours = stats.verifiedHours ?? overview.verifiedHours ?? 0;
      setText("chartBadge", `${Number(totalHours).toLocaleString()} hrs`);

      // Total beneficiaries footer (approximate)
      setText("totalBeneficiaries", (overview.beneficiariesReached ?? 0).toLocaleString());

    } catch (err) {
      console.warn("[impact] load failed:", err);
      toast("Couldn't load impact data", "error");
    }
  }

  /*  EXPORT REPORT (client-side CSV)  */
  byText("button", "Export Report")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Preparing…";

    try {
      const rows = [
        ["Metric", "Value"],
        ["Active Volunteers",     $("#metricActiveVolunteers")?.textContent || "0"],
        ["Verified Hours",        $("#metricVerifiedHours")?.textContent || "0"],
        ["Completed Activities",  $("#metricCompletedActivities")?.textContent || "0"],
        ["People Reached",        $("#metricPeopleReached")?.textContent || "0"],
        ["Date Range",            $("#dateRangeLabel")?.textContent || "—"],
        ["Generated",             new Date().toISOString()],
      ];
      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `impactra-impact-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Report downloaded", "success");
    } catch (err) {
      toast(err.message || "Export failed", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  /*  MONTHLY / YEARLY CHART TOGGLE  */
  // NOTE: The backend has no time-series endpoint. The chart remains

  const monthlyRadio = document.getElementById("btn-monthly");
  const yearlyRadio  = document.getElementById("btn-yearly");
  const chartPath    = $("svg path[stroke='#0051D5']");
  const chartArea    = $("svg path[fill^='url']");
  const chartNodes   = () => $$("svg circle");
  const floatingBadge = document.getElementById("chartBadge");

  const CHART_DATA = {
    monthly: {
      line: "M 20,180 L 90,165 L 160,158 L 230,148 L 300,150 L 370,132 L 440,108 L 510,100 L 580,96 L 660,74",
      area: "M 20,180 L 90,165 L 160,158 L 230,148 L 300,150 L 370,132 L 440,108 L 510,100 L 580,96 L 660,74 L 660,260 L 20,260 Z",
      points: [
        [20,180],[90,165],[160,158],[230,148],[300,150],
        [370,132],[440,108],[510,100],[580,96],[660,74],
      ],
      highlightIndex: 9,
    },
    yearly: {
      line: "M 20,200 L 90,175 L 160,150 L 230,130 L 300,118 L 370,100 L 440,88 L 510,72 L 580,60 L 660,42",
      area: "M 20,200 L 90,175 L 160,150 L 230,130 L 300,118 L 370,100 L 440,88 L 510,72 L 580,60 L 660,42 L 660,260 L 20,260 Z",
      points: [
        [20,200],[90,175],[160,150],[230,130],[300,118],
        [370,100],[440,88],[510,72],[580,60],[660,42],
      ],
      highlightIndex: 9,
    },
  };

  function renderChart(mode) {
    const data = CHART_DATA[mode];
    if (!data || !chartPath) return;

    chartPath.setAttribute("d", data.line);
    if (chartArea) chartArea.setAttribute("d", data.area);

    const svg = chartPath.closest("svg");
    chartNodes().forEach((c) => c.remove());

    data.points.forEach(([cx, cy], i) => {
      const isLast = i === data.highlightIndex;
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", cx);
      c.setAttribute("cy", cy);
      c.setAttribute("r", isLast ? "6" : "4");
      c.setAttribute("fill", isLast ? "#0051D5" : "#FFFFFF");
      c.setAttribute("stroke", isLast ? "#FFFFFF" : "#0051D5");
      c.setAttribute("stroke-width", "2.5");
      svg.insertBefore(c, svg.querySelector("defs"));
    });
  }

  monthlyRadio?.addEventListener("change", () => {
    if (monthlyRadio.checked) {
      renderChart("monthly");
      toast("Showing monthly data", "info");
    }
  });
  yearlyRadio?.addEventListener("change", () => {
    if (yearlyRadio.checked) {
      renderChart("yearly");
      toast("Showing yearly data", "info");
    }
  });

  /*  VIEW BREAKDOWN  */
  byText("a", "View Breakdown")?.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Breakdown view coming soon", "info");
  });

  /*  LOG OUT  */
  $$("aside button").forEach((el) => {
    if (!/log out/i.test(el.textContent)) return;
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!confirm("You'll be signed out of IMPACTRA. Continue?")) return;
      try { await API.auth.logout(); } catch (_) {}
      API.tokens.clear();
      sessionStorage.clear();
      window.location.href = "pages/login.html";
    });
  });

  /*  GLOBAL 401  */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = "pages/login.html"), 900);
  });

  /*  KICK OFF  */
  renderChart("monthly");
  loadImpact(initial.from, initial.to);

})();