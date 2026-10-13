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

  if (!window.API) {
    console.warn("[impact.js] API client not found. Load API.js first.");
  }

  /*  TOAST  */
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
      default: "bg-[#00174B] text-white",
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

  /*  SIDEBAR  */
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

  /*  NOTIFICATIONS  */
  const bellBtn = $$("header button").find((b) => b.querySelector("span.bg-\\[\\#BA1A1A\\]"));
  bellBtn?.addEventListener("click", async () => {
    bellBtn.querySelector("span.bg-\\[\\#BA1A1A\\]")?.remove();
    try {
      if (window.API) await API.notifications.markAllRead();
    } catch (_) { }
    toast("You're all caught up", "success");
  });

  /*  DATE RANGE PICKER  */
  const dateBtn = byText("button", "Jan 1, 2026");
  if (dateBtn) {
    // Build a dropdown that appears below the button
    const menu = document.createElement("div");
    menu.className =
      "fixed z-[70] hidden w-64 overflow-hidden rounded-xl border border-[#C6C6CD]/60 bg-white shadow-xl";
    menu.innerHTML = `
      <ul class="py-1 text-sm">
        <li><button data-range="30d"  class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Last 30 days</button></li>
        <li><button data-range="90d"  class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Last 90 days</button></li>
        <li><button data-range="ytd"  class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Year to date</button></li>
        <li><button data-range="12m"  class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Last 12 months</button></li>
        <li class="my-1 h-px bg-[#F1F5F9]"></li>
        <li><button data-range="custom" class="flex w-full px-4 py-2.5 text-left transition hover:bg-slate-50">Custom range…</button></li>
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

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) close();
    });
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);

    menu.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-range]");
      if (!btn) return;
      const range = btn.dataset.range;
      close();

      if (range === "custom") {
        promptCustomRange();
        return;
      }

      const { from, to, label } = presetRange(range);
      setDateLabel(label);
      toast(`Showing ${label.toLowerCase()}`, "info");
      await refreshForRange(from, to);
    });

    function promptCustomRange() {
      const from = window.prompt("From (YYYY-MM-DD):");
      if (!from) return;
      const to = window.prompt("To (YYYY-MM-DD):");
      if (!to) return;
      const fd = new Date(from);
      const td = new Date(to);
      if (isNaN(fd) || isNaN(td) || td < fd) {
        toast("Invalid date range", "error");
        return;
      }
      const label = `${formatShort(fd)} – ${formatShort(td)}`;
      setDateLabel(label);
      toast(`Showing ${label}`, "info");
      refreshForRange(fd.toISOString(), td.toISOString());
    }

    function setDateLabel(text) {
      const span = dateBtn.querySelector("span.truncate") || dateBtn.querySelectorAll("span")[1];
      if (span) span.textContent = text;
    }
  }

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
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${formatShort(from)} – ${formatShort(to)}`,
    };
  }

  async function refreshForRange(from, to) {
    if (!window.API) return;
    try {
      const [summary, programmes] = await Promise.allSettled([
        API.impact.summary({ from, to }),
        API.impact.programmes ? API.impact.programmes({ from, to }) : Promise.resolve(null),
      ]);

      if (summary.status === "fulfilled" && summary.value) {
        applySummary(summary.value?.data || summary.value);
      }
      
      if (programmes.status === "fulfilled" && programmes.value) {
        // renderProgrammes(programmes.value?.data || programmes.value);
      }
    } catch (err) {
      console.warn("[impact] refresh failed:", err);
    }
  }

  /*  EXPORT REPORT  */
  byText("button", "Export Report")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Preparing…";

    (async () => {
      try {
        if (window.API && API.impact.exportReport) {
          const blob = await API.impact.exportReport();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `impactra-impact-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // Offline fallback — build a small CSV from the visible metrics
          const csv = buildLocalCsv();
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `impactra-impact-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }
        toast("Report downloaded", "success");
      } catch (err) {
        toast(err?.message || "Export failed", "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    })();
  });

  function buildLocalCsv() {
    const rows = [["Metric", "Value"]];
    $$("section").forEach((sec) => {
      $$("p.font-semibold", sec).forEach((label) => {
        const card = label.closest("div");
        const value = card?.querySelector("span.font-bold")?.textContent.trim();
        if (label.textContent && value) {
          rows.push([label.textContent.trim(), value]);
        }
      });
    });
    return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  /*  MONTHLY / YEARLY CHART TOGGLE  */
  const monthlyRadio = document.getElementById("btn-monthly");
  const yearlyRadio  = document.getElementById("btn-yearly");
  const chartPath    = $("svg path[stroke='#0051D5']");
  const chartArea    = $("svg path[fill^='url']");
  const chartNodes   = $$("svg circle");
  const floatingBadge = $(".absolute.right-2.top-4");

  // Two data sets. Edit these to match the real series when you wire it up.
  const CHART_DATA = {
    monthly: {
      line: "M 20,180 L 90,165 L 160,158 L 230,148 L 300,150 L 370,132 L 440,108 L 510,100 L 580,96 L 660,74",
      area: "M 20,180 L 90,165 L 160,158 L 230,148 L 300,150 L 370,132 L 440,108 L 510,100 L 580,96 L 660,74 L 660,260 L 20,260 Z",
      points: [
        [20,180],[90,165],[160,158],[230,148],[300,150],
        [370,132],[440,108],[510,100],[580,96],[660,74],
      ],
      highlight: 742,
      highlightIndex: 9,
    },
    yearly: {
      line: "M 20,200 L 90,175 L 160,150 L 230,130 L 300,118 L 370,100 L 440,88 L 510,72 L 580,60 L 660,42",
      area: "M 20,200 L 90,175 L 160,150 L 230,130 L 300,118 L 370,100 L 440,88 L 510,72 L 580,60 L 660,42 L 660,260 L 20,260 Z",
      points: [
        [20,200],[90,175],[160,150],[230,130],[300,118],
        [370,100],[440,88],[510,72],[580,60],[660,42],
      ],
      highlight: 8740,
      highlightIndex: 9,
    },
  };

  function renderChart(mode) {
    const data = CHART_DATA[mode];
    if (!data || !chartPath) return;

    chartPath.setAttribute("d", data.line);
    if (chartArea) chartArea.setAttribute("d", data.area);

    // Rebuild data nodes
    const svg = chartPath.closest("svg");
    chartNodes.forEach((c) => c.remove());
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

    if (floatingBadge) {
      floatingBadge.textContent = `${data.highlight} hrs`;
    }
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

  /*  INFO TOOLTIPS  */
  $$('svg[width="16"]').forEach((icon) => {
    const trigger = icon.closest("span") || icon;
    
    if (!trigger.closest("h2, p")) return;

    let title = "";
    const heading = trigger.closest("h2, p")?.textContent.trim() || "";

    trigger.style.cursor = "help";
    trigger.setAttribute("tabindex", "0");

    const show = (e) => {
      const rect = trigger.getBoundingClientRect();
      let tip = document.getElementById("impact-tip");
      if (!tip) {
        tip = document.createElement("div");
        tip.id = "impact-tip";
        tip.className =
          "pointer-events-none fixed z-[100] max-w-xs rounded-lg bg-[#0F172A] px-3 py-2 text-xs leading-4 text-white shadow-lg opacity-0 transition-opacity duration-150";
        document.body.appendChild(tip);
      }
      tip.textContent = title || `${heading} — hover for details`;
      const top  = Math.max(8, rect.top - 44);
      const left = Math.min(window.innerWidth - 300, Math.max(8, rect.left - 20));
      tip.style.top = `${top}px`;
      tip.style.left = `${left}px`;
      requestAnimationFrame(() => tip.style.opacity = "1");
    };

    const hide = () => {
      const tip = document.getElementById("impact-tip");
      if (tip) {
        tip.style.opacity = "0";
        setTimeout(() => tip.remove(), 150);
      }
    };

    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", hide);
    trigger.addEventListener("focus", show);
    trigger.addEventListener("blur", hide);
  });

  /*  VIEW BREAKDOWN  */
  byText("a", "View Breakdown")?.addEventListener("click", (e) => {
    e.preventDefault();
    // window.location.href = "impact-breakdown.html";
    toast("Opening breakdown…", "info");
  });

  /*  GLOBAL 401 HANDLER  */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

  /*  HYDRATE FROM API  */
  function applySummary(s) {
    if (!s) return;

    // Update each metric card by matching the label
    const updates = [
      { label: "Active Volunteers",    value: s.activeVolunteers },
      { label: "Verified hrs",         value: s.verifiedHours },
      { label: "Completed Activities", value: s.completedActivities },
      { label: "People Reached",       value: s.peopleReached },
    ];

    updates.forEach(({ label, value }) => {
      if (value == null) return;
      const labelEl = byText("p", label);
      const card = labelEl?.closest("div")?.parentElement;
      const valueEl = card ? $$("span.font-bold", card)[0] : null;
      if (valueEl) {
        valueEl.textContent = typeof value === "number"
          ? value.toLocaleString()
          : String(value);
      }
    });
  }

  async function hydrateMetrics() {
    if (!window.API) return;
    try {
      const res = await API.impact.summary();
      applySummary(res?.data || res || {});
    } catch (err) {
      console.warn("[impact] hydrate metrics failed:", err);
    }
  }

  /*  KICK-OFF  */
  hydrateMetrics();
  renderChart("monthly");
})();