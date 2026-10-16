/* IMPACTRA — Dashboard */
(() => {
  "use strict";

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* 0. AUTH GUARD: Redirect if not logged in */
  if (!window.API || !API.tokens.isAuthenticated) {
    window.location.href = "pages/login.html";
    return;
  }

  /* 1. ROLE GUARD: Redirect admins to their own dashboard */
  let currentUser = null;
  try {
    currentUser = JSON.parse(sessionStorage.getItem("impactra_user") || "null");
  } catch (_) {}

  if (currentUser?.role === "platform_admin") {
    window.location.href = "admin-dashboard.html";
    return;
  }

  /* 2. PERSONALIZE the header with the logged-in user */
  if (currentUser) {
    const nameEl = $(".avatar-info p:first-child");
    const roleEl = $(".avatar-info p:last-child");
    if (nameEl && currentUser.name) nameEl.textContent = currentUser.name.split(" ")[0];
    if (roleEl) roleEl.textContent = "NGO";
  }

  /* 3. TOAST HELPER */
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

  /* 4. HYDRATE METRICS from /organization/dashboard/overview */
  async function loadOverview() {
    try {
      const res = await API.get("/organization/dashboard/overview");
      const data = res?.data || res || {};

      // Applications
      setText("#metricApplications", data.totalApplications ?? data.applications ?? 0);
      setText("#metricApplicationsFooter", `• ${data.pendingApplications ?? 0} pending review`);

      // Activities (Contributions)
      setText("#metricActivities", data.totalContributions ?? data.activities ?? 0);
      setText("#metricActivitiesFooter", `⏱ ${data.pendingHours ?? 0} hours pending confirmation`);

      // Opportunities
      setText("#metricOpportunities", data.totalOpportunities ?? data.opportunities ?? 0);
      setText("#metricOpportunitiesFooter", `${data.activeOpportunities ?? 0} currently active`);

      // Volunteers
      setText("#metricVolunteers", data.totalVolunteers ?? data.volunteers ?? 0);
      setText("#metricVolunteersFooter", `+${data.newVolunteersThisMonth ?? 0} onboarded this month`);

    } catch (err) {
      console.warn("[dashboard] overview failed:", err);
      toast("Couldn't load dashboard metrics", "error");
    }
  }

  /* 5. HYDRATE ACTIVE OPPORTUNITIES TABLE from /organization/opportunities */
  async function loadActiveOpportunities() {
    const tbody = $("#activeOpportunitiesBody");
    if (!tbody) return;

    try {
      const res = await API.get("/organization/opportunities", { status: "active" });
      const list = Array.isArray(res) ? res : (res?.data || res?.opportunities || []);

      if (!list.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding: 40px; color: #94a3b8;">
              No active opportunities yet. Click "New Opportunity" to create one.
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = list.slice(0, 5).map((opp) => {
        const filled = opp.approvedVolunteers ?? opp.filledSlots ?? 0;
        const capacity = opp.volunteerCapacity ?? opp.capacity ?? 1;
        const percent = Math.round((filled / capacity) * 100);

        const startDate = opp.shifts?.[0]?.date
          ? new Date(opp.shifts[0].date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
          : "TBD";

        const isUrgent = percent >= 90 && percent < 100;
        const barClass = isUrgent ? "progress-fill-red" : "progress-fill-blue";
        const badgeClass = isUrgent ? "status-badge-urgent" : "status-badge-active";
        const dotClass = isUrgent ? "dot-red" : "dot-green";
        const label = isUrgent ? "Urgent" : "Active";

        return `
          <tr>
            <td>
              <div class="cell-title">${opp.title || "Untitled"}</div>
              <div class="cell-sub">${opp.category || "Community Service"}</div>
            </td>
            <td>
              <div class="cell-title">${opp.location?.hubRegion || opp.location?.venueAddress || "Remote"}</div>
              <div class="cell-sub">${startDate}</div>
            </td>
            <td>
              <div style="display: flex; gap: 8px; font-weight: 700; font-size: 10px;">
                <span>${filled}/${capacity} Filled</span>
                <span style="color: #94a3b8;">${percent}%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="${barClass}" style="width: ${percent}%;"></div>
              </div>
            </td>
            <td>
              <span class="${badgeClass}">
                <span class="${dotClass}"></span> ${label}
              </span>
            </td>
            <td style="text-align: right;">
              ${opp._id || opp.id ? `<a href="pages/opportunity-details.html?id=${encodeURIComponent(opp._id || opp.id)}" class="manage-link">Manage →</a>` : "<span>No details available</span>"}
            </td>
          </tr>`;
      }).join("");

    } catch (err) {
      console.warn("[dashboard] opportunities failed:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 40px; color: #ef4444;">
            Couldn't load opportunities.
          </td>
        </tr>`;
    }
  }

  /* 6. HYDRATE QUARTERLY TARGET WIDGET */
  async function loadQuarterlyTarget() {
    try {
      const res = await API.get("/organization/contributions/stats");
      const data = res?.data || res || {};

      const verified = data.verifiedHours ?? data.totalVerified ?? 0;
      const goal = data.quarterlyGoal ?? 2000;
      const percent = goal > 0 ? Math.round((verified / goal) * 100) : 0;

      setText("#targetVerified", verified.toLocaleString());
      setText("#targetGoal", goal.toLocaleString());
      setText("#targetPercent", `${percent}%`);
      setText("#statDirectImpact", (data.beneficiariesReached ?? 0).toLocaleString());
      setText("#statRetention", `${data.retentionRate ?? 0}%`);

      // Update the conic-gradient chart
      const chart = $(".circle-chart");
      if (chart) {
        chart.style.background = `conic-gradient(#2563eb 0% ${percent}%, #e2e8f0 ${percent}% 100%)`;
      }

    } catch (err) {
      console.warn("[dashboard] target failed:", err);
    }
  }

  /* 7. HELPER: Set text content safely */
  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value;
  }

  /* 8. NOTIFICATION BELL */
  const bellBtn = $("#bellBtn");
  async function loadUnreadCount() {
    try {
      const res = await API.get("/notifications/unread-count");
      const count = res?.count ?? res?.data?.count ?? 0;
      const badge = bellBtn?.querySelector(".bell-badge");
      if (badge) badge.style.display = count > 0 ? "block" : "none";
    } catch (_) { /* non-blocking */ }
  }

  bellBtn?.addEventListener("click", async () => {
    try {
      await API.patch("/notifications/read-all", {});
      const badge = bellBtn.querySelector(".bell-badge");
      if (badge) badge.style.display = "none";
      toast("All notifications marked as read", "success");
    } catch (err) {
      toast("Couldn't mark notifications", "error");
    }
  });

  /* 9. LOGOUT */
  $("#logoutBtn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("You'll be signed out of IMPACTRA. Continue?")) return;
    try {
      await API.auth.logout();
    } catch (_) { /* ignore */ }
    API.tokens.clear();
    sessionStorage.clear();
    window.location.href = "pages/login.html";
  });

  /* 10. GLOBAL 401 HANDLER */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "pages/login.html"), 900);
  });

  /* 11. KICK OFF */
  loadOverview();
  loadActiveOpportunities();
  loadQuarterlyTarget();
  loadUnreadCount();

})();
