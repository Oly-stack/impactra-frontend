/* IMPACTRA — Certificate Template Builder */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  if (!window.API) { console.error("[certificate.js] API not found."); return; }
  if (!API.tokens.isAuthenticated) { window.location.href = "login.html"; return; }

  /* TOAST */
  function toast(message, variant = "default") {
    let host = $("#toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.className = "pointer-events-none fixed bottom-6 left-1/2 z-[95] flex -translate-x-1/2 flex-col items-center gap-2";
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

  /* MOBILE SIDEBAR */
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");
  const toggleMenu = (open) => {
    sidebar?.classList.toggle("-translate-x-full", !open);
    overlay?.classList.toggle("hidden", !open);
  };
  $("#menuBtn")?.addEventListener("click", () => toggleMenu(true));
  overlay?.addEventListener("click", () => toggleMenu(false));

  /* HEADER USER */
  try {
    const user = JSON.parse(sessionStorage.getItem("impactra_user") || "null");
    if (user?.name) {
      const nameEl = $("header .leading-tight p:first-child");
      if (nameEl) nameEl.textContent = user.name.split(" ")[0];
    }
  } catch (_) {}

  /* NOTIFICATION BELL */
  $('header button[aria-label="Notifications"]')?.addEventListener("click", async (e) => {
    const dot = e.currentTarget.querySelector("span.bg-red-500");
    dot?.remove();
    try { await API.patch("/notifications/read-all", {}); } catch (_) {}
    toast("You're all caught up", "success");
  });

  /* LOGOUT */
  $$("aside a").forEach((a) => {
    if (!/log out/i.test(a.textContent)) return;
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!confirm("You'll be signed out of IMPACTRA. Continue?")) return;
      try { await API.auth.logout(); } catch (_) {}
      API.tokens.clear();
      sessionStorage.clear();
      window.location.href = "login.html";
    });
  });

  /* LIVE PREVIEW */
  const escapeHtml = (s) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function render() {
    $("#titleCount").textContent = $("#title").value.length + "/100";
    $("#orgCount").textContent = $("#org").value.length + "/100";
    $("#msgCount").textContent = $("#msg").value.length + "/200";

    $("#pTitle").textContent = $("#title").value;
    $("#pOrg").textContent = $("#org").value;

    const msg = escapeHtml($("#msg").value)
      .replace(/\{volunteer_name\}/g, "Chinyere Okafor")
      .replace(/\{activity\}/g, escapeHtml($("#activityLabel").value))
      .replace(/\{date\}/g, new Date().toLocaleDateString())
      .replace(/\{hours\}/g, '<span class="font-semibold text-blue-700">4.0</span>');
    $("#pMsg").innerHTML = msg;

    $("#pRole1").textContent = $("#role1").value;
    $("#pRole2").textContent = $("#role2").value;

    [1, 2].forEach((n) => {
      const hasImg = !$("#sigImg" + n).classList.contains("hidden");
      $("#sigText" + n).textContent = $("#name" + n).value;
      if (!hasImg) {
        $("#pSig" + n).textContent = $("#name" + n).value;
      }
    });
  }

  ["title", "org", "msg", "activityLabel", "skillsLabel", "name1", "role1", "name2", "role2"]
    .forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", render);
    });

  /* SIGNATURE UPLOAD / CLEAR */
  document.querySelectorAll("[data-upload]").forEach((btn) => {
    const n = btn.dataset.upload;
    btn.addEventListener("click", () => $("#file" + n).click());
    $("#file" + n).addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      $("#sigImg" + n).src = url;
      $("#sigImg" + n).classList.remove("hidden");
      $("#sigText" + n).classList.add("hidden");
      $("#pSig" + n).innerHTML = '<img src="' + url + '" class="max-h-10 object-contain" alt="Signature" />';
    });
  });

  document.querySelectorAll("[data-clear]").forEach((btn) => {
    const n = btn.dataset.clear;
    btn.addEventListener("click", () => {
      $("#sigImg" + n).classList.add("hidden");
      $("#sigImg" + n).removeAttribute("src");
      $("#sigText" + n).classList.remove("hidden");
      $("#file" + n).value = "";
      render();
    });
  });

  /* SAVE TEMPLATE — POST /certificates/template */
  const saveBtn = Array.from(document.querySelectorAll("button"))
    .find((b) => /Save Template/i.test(b.textContent));

  saveBtn?.addEventListener("click", (e) => {
    const title = $("#title").value.trim();
    const org = $("#org").value.trim();
    const msg = $("#msg").value.trim();
    const activityLabel = $("#activityLabel").value.trim() || "Activity";
    const skillsLabel = $("#skillsLabel").value.trim() || "Skills";
    const name1 = $("#name1").value.trim();
    const role1 = $("#role1").value.trim();
    const name2 = $("#name2").value.trim();
    const role2 = $("#role2").value.trim();

    if (!title) { toast("Certificate title is required", "error"); $("#title").focus(); return; }
    if (!org) { toast("Organization name is required", "error"); $("#org").focus(); return; }
    if (!msg) { toast("Recognition message is required", "error"); $("#msg").focus(); return; }
    if (!name1) { toast("Primary signatory name is required", "error"); $("#name1").focus(); return; }
    if (!role1) { toast("Primary signatory role is required", "error"); $("#role1").focus(); return; }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("recognitionMessage", msg);
    formData.append("activityLabel", activityLabel);
    formData.append("skillsLabel", skillsLabel);
    formData.append("signatoryNames", JSON.stringify([name1, name2].filter(Boolean)));
    formData.append("signatoryRoles", JSON.stringify([role1, role2].filter(Boolean)));

    withBusy(e.currentTarget, "Saving…", async () => {
      try {
        await API.post("/certificates/template", formData);
        toast("Certificate template saved", "success");
      } catch (err) {
        console.error("[certificate] save failed:", err);
        toast(err.message || "Couldn't save template", "error");
      }
    });
  });

  /* CANCEL — reset to defaults */
  Array.from(document.querySelectorAll("button"))
    .find((b) => /^Cancel$/i.test(b.textContent.trim()))
    ?.addEventListener("click", () => {
      if (!confirm("Discard your changes?")) return;
      $("#title").value = "Certificate of Participation";
      $("#org").value = "Hope Community Initiatives";
      $("#msg").value = "In recognition of dedicated service and verified impact. Total verified volunteering: {hours} Hours.";
      $("#activityLabel").value = "Volunteering Activity";
      $("#skillsLabel").value = "Skills Validated";
      $("#name1").value = "Amara Eze";
      $("#role1").value = "Field Director";
      $("#name2").value = "Toyin Balogun";
      $("#role2").value = "Executive Secretary";
      [1, 2].forEach((n) => {
        $("#sigImg" + n).classList.add("hidden");
        $("#sigImg" + n).removeAttribute("src");
        $("#sigText" + n).classList.remove("hidden");
        $("#file" + n).value = "";
      });
      render();
      toast("Changes discarded", "info");
    });

  /* GLOBAL 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    API.tokens.clear();
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

  /* KICK-OFF */
  render();

})();