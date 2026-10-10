/* IMPACTRA — Volunteer Profile*/
(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const byText = (sel, text, root = document) =>
    $$(sel, root).find((el) =>
      el.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(text.toLowerCase())
    );

  /* Read volunteer id from URL */
  const urlParams   = new URLSearchParams(window.location.search);
  const VOLUNTEER_ID = urlParams.get("id") || "VOL4029";

  /* Global API guard */
  if (!window.API) {
    console.error("[volun.js] API client not found. Did you load api.js before volun.js?");
  }

  /*0. TOAST*/
  function toast(message, variant = "default") {
    let host = $("#toasthost");
    if (!host) {
      host = document.createElement("div");
      host.id = "toasthost";
      host.className =
        "pointereventsnone fixed bottom6 left1/2 z[90] flex translatex1/2 flexcol itemscenter gap2";
      document.body.appendChild(host);
    }
    const palette = {
      default: "bg[#0F172A] textwhite",
      success: "bg[#065F46] textwhite",
      error:   "bg[#991B1B] textwhite",
      info:    "bg[#1D4ED8] textwhite",
    };
    const el = document.createElement("div");
    el.className = `pointereventsauto roundedlg px4 py2.5 textsm fontmedium shadowlg ${palette[variant]}`;
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

  /*1. MOBILE SIDEBAR*/
  const sidebarToggle = $("#sidebartoggle");
  if (sidebarToggle) {
    const sync = () => {
      document.body.style.overflow = sidebarToggle.checked ? "hidden" : "";
    };
    sidebarToggle.addEventListener("change", sync);

    $("aside")?.addEventListener("click", (e) => {
      if (!e.target.closest("a")) return;
      if (window.matchMedia("(maxwidth: 1023px)").matches) {
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

    window.matchMedia("(minwidth: 1024px)").addEventListener("change", (e) => {
      if (e.matches) {
        sidebarToggle.checked = false;
        sync();
      }
    });
  }

  /*2. MODAL SYSTEM*/
  let activeModal = null;

  function ensureModalPortal() {
    let portal = $("#modalportal");
    if (!portal) {
      portal = document.createElement("div");
      portal.id = "modalportal";
      portal.className = "fixed inset0 z[80] hidden";
      portal.innerHTML = `
        <div datamodaloverlay class="absolute inset0 bgblack/50 backdropblursm"></div>
        <div class="relative z10 flex minhfull itemscenter justifycenter p4">
          <div datamodalcard
               role="dialog" ariamodal="true"
               class="wfull maxwlg overflowhidden roundedxl bgwhite shadow2xl
                      opacity0 scale95 transition duration200 easeout"></div>
        </div>`;
      document.body.appendChild(portal);
      portal.addEventListener("click", (e) => {
        if (e.target.matches("[datamodaloverlay]")) closeModal();
      });
    }
    return portal;
  }

  function openModal({ title, body, footer, size = "maxwlg" }) {
    const portal = ensureModalPortal();
    const card = $("[datamodalcard]", portal);
    card.className = card.className.replace(/maxw\S+/, size);

    card.innerHTML = `
      <div class="flex itemsstart justifybetween gap4 borderb border[#F1F5F9] px5 py4">
        <h2 class="textlg fontbold leading7 tracking[0.2px] text[#0F172A]">${title}</h2>
        <button type="button" datamodalclose arialabel="Close dialog"
                class="flex h8 w8 itemscenter justifycenter roundedlg textslate500 hover:bgslate100">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokewidth="1.8" strokelinecap="round"/>
          </svg>
        </button>
      </div>
      <div class="maxh[70vh] overflowyauto px5 py4 textsm leading6 text[#334155]">${body}</div>
      ${footer ? `<div class="flex flexcolreverse gap2 bordert border[#F1F5F9] px5 py4 sm:flexrow sm:justifyend">${footer}</div>` : ""}
    `;

    portal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => card.classList.remove("opacity0", "scale95"));
    activeModal = card;

    $("[datamodalclose]", card)?.addEventListener("click", closeModal);
    card.querySelectorAll("[datamodalcancel]").forEach((b) =>
      b.addEventListener("click", closeModal)
    );

    setTimeout(() => $("button, [href], input, select, textarea", card)?.focus(), 60);
  }

  function closeModal() {
    const portal = $("#modalportal");
    if (!portal || portal.classList.contains("hidden")) return;
    $("[datamodalcard]", portal).classList.add("opacity0", "scale95");
    setTimeout(() => {
      portal.classList.add("hidden");
      document.body.style.overflow = "";
      activeModal = null;
    }, 180);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeDropdowns();
    }
  });

  /* Focus trap */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !activeModal) return;
    const focusables = $$(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="1"])',
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

  /*3. HEADER: ⌘K SEARCH + NOTIFICATIONS*/
  const globalSearch = $('header input[type="text"]');
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      globalSearch?.focus();
      globalSearch?.select();
    }
  });

  const bell = $("header button");
  bell?.addEventListener("click", async () => {
    bell.querySelector("span.bg\\[\\#F43F5E\\]")?.remove();
    try {
      await API.notifications.markAllRead();
      toast("You're all caught up", "success");
    } catch (err) {
      // Nonblocking — still confirm the UI change
      toast("You're all caught up", "success");
    }
  });

  /*4. ACTIONS DROPDOWN*/
  const dropHost = document.createElement("div");
  dropHost.id = "actionsdropdown";
  dropHost.className =
    "fixed z[85] hidden w56 overflowhidden roundedxl border border[#E2E8F0] bgwhite shadowxl";
  dropHost.innerHTML = `
    <ul class="py1 textsm text[#0F172A]">
      <li><button dataaction="email"    class="flex wfull itemscenter gap2 px4 py2.5 textleft transition hover:bgslate50">Send email</button></li>
      <li><button dataaction="assign"   class="flex wfull itemscenter gap2 px4 py2.5 textleft transition hover:bgslate50">Assign to reviewer</button></li>
      <li><button dataaction="flag"     class="flex wfull itemscenter gap2 px4 py2.5 textleft transition hover:bgslate50">Flag for followup</button></li>
      <li><button dataaction="download" class="flex wfull itemscenter gap2 px4 py2.5 textleft transition hover:bgslate50">Download profile (PDF)</button></li>
      <li class="my1 hpx bg[#F1F5F9]"></li>
      <li><button dataaction="archive"  class="flex wfull itemscenter gap2 px4 py2.5 textleft text[#E11D48] transition hover:bgrose50">Archive volunteer</button></li>
    </ul>
  `;
  document.body.appendChild(dropHost);

  function closeDropdowns() {
    dropHost.classList.add("hidden");
  }

  const actionsBtn = byText("button", "Actions");
  actionsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!dropHost.classList.contains("hidden")) {
      closeDropdowns();
      return;
    }
    const r = actionsBtn.getBoundingClientRect();
    dropHost.style.top  = `${r.bottom + 8}px`;
    dropHost.style.left = `${Math.min(r.left, window.innerWidth - 240)}px`;
    dropHost.classList.remove("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!dropHost.contains(e.target)) closeDropdowns();
  });
  window.addEventListener("scroll", closeDropdowns, { passive: true });
  window.addEventListener("resize", closeDropdowns);

  dropHost.addEventListener("click", async (e) => {
    const btn = e.target.closest("[dataaction]");
    if (!btn) return;
    closeDropdowns();

    const action = btn.dataset.action;

    /*  ARCHIVE  */
    if (action === "archive") {
      openModal({
        title: "Archive Volunteer",
        body: `<p>Archiving will hide this volunteer from active lists. This action can be reversed by an admin.</p>`,
        footer: `
          <button datamodalcancel class="h10 roundedlg bg[#F1F5F9] px4 textsm fontsemibold transition hover:bgslate200">Cancel</button>
          <button datamodalconfirm class="h10 roundedlg bg[#E11D48] px4 textsm fontsemibold textwhite transition hover:bgrose700">Archive</button>
        `,
      });
      $("[datamodalconfirm]")?.addEventListener("click", (ev) => {
        withBusy(ev.currentTarget, "Archiving…", async () => {
          try {
            await API.volunteers.archive(VOLUNTEER_ID);
            closeModal();
            setTimeout(() => toast("Volunteer archived", "success"), 200);
          } catch (err) {
            toast(err.message || "Couldn't archive volunteer", "error");
          }
        });
      });
      return;
    }

    /*  EMAIL  */
    if (action === "email") {
      try {
        await API.volunteers.message(VOLUNTEER_ID, {
          subject: "Regarding your application",
          body: "",
        });
      } catch (_) {}
      window.location.href = "mailto:?subject=Regarding your application";
      return;
    }

    /*  ASSIGN  */
    if (action === "assign") {
      const reviewerId = window.prompt("Enter reviewer ID to assign:");
      if (!reviewerId) return;
      try {
        await API.volunteers.assignReviewer(VOLUNTEER_ID, reviewerId);
        toast("Assigned to reviewer", "success");
      } catch (err) {
        toast(err.message || "Couldn't assign reviewer", "error");
      }
      return;
    }

    /*  FLAG  */
    if (action === "flag") {
      try {
        await API.volunteers.flag(VOLUNTEER_ID, "Manual flag from profile");
        toast("Volunteer flagged for followup", "success");
      } catch (err) {
        toast(err.message || "Couldn't flag volunteer", "error");
      }
      return;
    }

    /*  DOWNLOAD  */
    if (action === "download") {
      try {
        const blob = await API.volunteers.exportProfile(VOLUNTEER_ID);
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = `volunteer${VOLUNTEER_ID}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Profile downloaded", "success");
      } catch (err) {
        toast(err.message || "Couldn't download profile", "error");
      }
      return;
    }
  });

  /*5. EXPORT SUMMARY*/
  byText("button", "Export Summary")?.addEventListener("click", (e) => {
    withBusy(e.currentTarget, "Generating…", async () => {
      try {
        const blob = await API.volunteers.exportProfile(VOLUNTEER_ID);
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url;
        a.download = `volunteersummary${VOLUNTEER_ID}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Summary downloaded", "success");
      } catch (err) {
        toast(err.message || "Export failed", "error");
      }
    });
  });

  /*6. BACK BUTTONS + NEXT VOLUNTEER*/
  byText("a", "Back")?.addEventListener("click", (e) => {
    e.preventDefault();
    // window.location.href = "volunteers.html";
    toast("Returning to Volunteers list…");
  });

  byText("a", "Back to Volunteers")?.addEventListener("click", (e) => {
    e.preventDefault();
    // window.location.href = "volunteers.html";
    toast("Returning to Volunteers list…");
  });

  byText("a", "View Next Volunteer")?.addEventListener("click", (e) => {
    e.preventDefault();
    // window.location.href = "volunteerprofile.html?id=VOL4031";
    toast("Loading next volunteer…");
  });

  /*7. MESSAGE MARY*/
  byText("button", "Message Mary")?.addEventListener("click", () => {
    openModal({
      title: "Message Volunteer",
      body: `
        <label class="block">
          <span class="text[11px] fontsemibold uppercase tracking[0.55px] text[#64748B]">Subject</span>
          <input datasubject type="text" placeholder="e.g. Community Cleanup application"
                 class="mt1.5 h10 wfull roundedlg border border[#E2E8F0] bgwhite px3 textsm focus:border[#2563EB] focus:outlinenone focus:ring2 focus:ring[#2563EB]/20"/>
        </label>
        <label class="mt3 block">
          <span class="text[11px] fontsemibold uppercase tracking[0.55px] text[#64748B]">Message</span>
          <textarea datamessage rows="5" placeholder="Write your message…"
                    class="mt1.5 wfull resizenone roundedlg border border[#E2E8F0] bgwhite p3 textsm leading5 focus:border[#2563EB] focus:outlinenone focus:ring2 focus:ring[#2563EB]/20"></textarea>
        </label>
      `,
      footer: `
        <button datamodalcancel class="h10 roundedlg bg[#F1F5F9] px4 textsm fontsemibold transition hover:bgslate200">Cancel</button>
        <button datamodalconfirm class="h10 roundedlg bg[#2563EB] px4 textsm fontsemibold textwhite transition hover:bg[#1D4ED8]">Send message</button>
      `,
    });

    $("[datamodalconfirm]")?.addEventListener("click", (ev) => {
      const subject = $("[datasubject]")?.value.trim() || "(no subject)";
      const msg     = $("[datamessage]")?.value.trim();

      if (!msg) {
        toast("Add a message before sending", "error");
        $("[datamessage]")?.focus();
        return;
      }

      withBusy(ev.currentTarget, "Sending…", async () => {
        try {
          await API.volunteers.message(VOLUNTEER_ID, { subject, body: msg });
          closeModal();
          setTimeout(() => toast("Message sent", "success"), 200);
        } catch (err) {
          toast(err.message || "Couldn't send message", "error");
        }
      });
    });
  });

  /*8. ASK A QUESTION*/
  byText("button", "Ask a Question")?.addEventListener("click", () => {
    openModal({
      title: "Ask a Question",
      body: `
        <p class="text[13px] leading5">This will be sent as a message and the volunteer will be notified by email.</p>
        <textarea dataquestion rows="5" placeholder="Type your question…"
                  class="mt3 wfull resizenone roundedlg border border[#E2E8F0] bgwhite p3 textsm leading5 focus:border[#2563EB] focus:outlinenone focus:ring2 focus:ring[#2563EB]/20"></textarea>
      `,
      footer: `
        <button datamodalcancel class="h10 roundedlg bg[#F1F5F9] px4 textsm fontsemibold transition hover:bgslate200">Cancel</button>
        <button datamodalconfirm class="h10 roundedlg bg[#2563EB] px4 textsm fontsemibold textwhite transition hover:bg[#1D4ED8]">Send question</button>
      `,
    });

    $("[datamodalconfirm]")?.addEventListener("click", (ev) => {
      const q = $("[dataquestion]")?.value.trim();
      if (!q) {
        toast("Please type your question", "error");
        $("[dataquestion]")?.focus();
        return;
      }

      withBusy(ev.currentTarget, "Sending…", async () => {
        try {
          await API.volunteers.askQuestion(VOLUNTEER_ID, q);
          closeModal();
          setTimeout(() => toast("Question sent", "success"), 200);
        } catch (err) {
          toast(err.message || "Couldn't send question", "error");
        }
      });
    });
  });

  /*9. APPROVE APPLICATION*/
  function markApproved() {
    const pill = byText("span", "Pending Review");
    if (pill) {
      pill.innerHTML = `
        <span class="h1.5 w1.5 roundedfull bg[#10B981]"></span>
        <span class="text[11px] fontsemibold text[#047857]">Approved</span>`;
      pill.classList.remove("border[#FDE68A]", "bg[#FFFBEB]");
      pill.classList.add("border[#A7F3D0]", "bg[#ECFDF5]");
    }

    const appliedBadge = byText("span", "Applied for Community Cleanup");
    if (appliedBadge) {
      appliedBadge.textContent = "Approved for Community Cleanup";
      appliedBadge.classList.remove("border[#BFDBFE]", "bg[#f0f3ff]", "text[#1D4ED8]");
      appliedBadge.classList.add("border[#A7F3D0]", "bg[#ECFDF5]", "text[#047857]");
    }

    [approveBtn, rejectBtn, askBtn].forEach((b) => {
      if (!b) return;
      b.disabled = true;
      b.classList.add("opacity60", "cursornotallowed");
      b.classList.remove("hover:bg[#1D4ED8]", "hover:bgrose50", "hover:bg[#E0E7FF]");
    });
    if (approveBtn) {
      approveBtn.innerHTML = `
        <span class="shrink0"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M16.0303 10.0303C16.3232 9.73744 16.3232 9.26256 16.0303 8.96967C15.7374 8.67678 15.2626 8.67678 14.9697 8.96967L10.5 13.4393L9.03033 11.9697C8.73744 11.6768 8.26256 11.6768 7.96967 11.9697C7.67678 12.2626 7.67678 12.7374 7.96967 13.0303L9.96967 15.0303C10.2626 15.3232 10.7374 15.3232 11.0303 15.0303L16.0303 10.0303Z" fill="currentColor"/>
          <path fillrule="evenodd" cliprule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
        </svg></span>
        Application Approved`;
      approveBtn.classList.add("bg[#059669]", "textwhite");
      approveBtn.classList.remove("bg[#2563EB]", "hover:bg[#1D4ED8]");
    }
  }

  const approveBtn = byText("button", "Approve Application");
  const rejectBtn  = byText("button", "Do Not Accept");
  const askBtn     = byText("button", "Ask a Question");

  approveBtn?.addEventListener("click", () => {
    openModal({
      title: "Approve Application",
      body: `
        <p>You're about to approve this volunteer for the
        <strong>Community Cleanup</strong> mission.</p>
        <div class="mt4 flex itemsstart gap2 roundedlg border border[#DBEAFE] bg[#EFF6FF]/70 p3 text[13px] leading[18px]">
          <span class="mt0.5 shrink0 text[#1D4ED8]">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path fillrule="evenodd" cliprule="evenodd" d="M12 1.25C6.06294 1.25 1.25 6.06294 1.25 12C1.25 17.9371 6.06294 22.75 12 22.75C17.9371 22.75 22.75 17.9371 22.75 12C22.75 6.06294 17.9371 1.25 12 1.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12Z" fill="currentColor"/>
            </svg>
          </span>
          The volunteer will be notified by email and can begin logging hours.
        </div>
      `,
      footer: `
        <button datamodalcancel class="h10 roundedlg bg[#F1F5F9] px4 textsm fontsemibold transition hover:bgslate200">Cancel</button>
        <button datamodalconfirm class="h10 roundedlg bg[#2563EB] px4 textsm fontsemibold textwhite transition hover:bg[#1D4ED8]">Yes, approve</button>
      `,
    });

    $("[datamodalconfirm]")?.addEventListener("click", (ev) => {
      withBusy(ev.currentTarget, "Approving…", async () => {
        try {
          await API.volunteers.approve(VOLUNTEER_ID);
          closeModal();
          setTimeout(() => {
            markApproved();
            toast("Application approved", "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't approve application", "error");
        }
      });
    });
  });

  /*10. DO NOT ACCEPT*/
  rejectBtn?.addEventListener("click", () => {
    openModal({
      title: "Do Not Accept Application",
      body: `
        <p class="text[13px] leading5">Please choose a reason and add an optional note. The volunteer will be notified by email.</p>

        <label class="mt4 block">
          <span class="text[11px] fontsemibold uppercase tracking[0.55px] text[#64748B]">Reason</span>
          <select datareason
                  class="mt1.5 h10 wfull roundedlg border border[#E2E8F0] bgwhite px3 textsm focus:border[#2563EB] focus:outlinenone focus:ring2 focus:ring[#2563EB]/20">
            <option value="capacity">Mission is at capacity</option>
            <option value="fit">Not a strong fit for this activity</option>
            <option value="availability">Availability mismatch</option>
            <option value="other">Other (explain below)</option>
          </select>
        </label>

        <label class="mt3 block">
          <span class="text[11px] fontsemibold uppercase tracking[0.55px] text[#64748B]">Note to volunteer (optional)</span>
          <textarea datanote rows="3"
                    class="mt1.5 wfull resizenone roundedlg border border[#E2E8F0] bgwhite p3 textsm leading5 focus:border[#2563EB] focus:outlinenone focus:ring2 focus:ring[#2563EB]/20"></textarea>
        </label>
      `,
      footer: `
        <button datamodalcancel class="h10 roundedlg bg[#F1F5F9] px4 textsm fontsemibold transition hover:bgslate200">Cancel</button>
        <button datamodalconfirm class="h10 roundedlg bg[#E11D48] px4 textsm fontsemibold textwhite transition hover:bgrose700">Do not accept</button>
      `,
    });

    $("[datamodalconfirm]")?.addEventListener("click", (ev) => {
      const reason = $("[datareason]")?.value || "other";
      const note   = $("[datanote]")?.value.trim() || "";

      withBusy(ev.currentTarget, "Submitting…", async () => {
        try {
          await API.volunteers.reject(VOLUNTEER_ID, reason, note);
          closeModal();
          setTimeout(() => {
            const pill = byText("span", "Pending Review");
            if (pill) {
              pill.innerHTML = `
                <span class="h1.5 w1.5 roundedfull bg[#F43F5E]"></span>
                <span class="text[11px] fontsemibold text[#9F1239]">Not Accepted</span>`;
              pill.classList.remove("border[#FDE68A]", "bg[#FFFBEB]");
              pill.classList.add("border[#FECDD3]", "bg[#FFF1F2]");
            }
            [approveBtn, rejectBtn, askBtn].forEach((b) => {
              if (!b) return;
              b.disabled = true;
              b.classList.add("opacity60", "cursornotallowed");
              b.classList.remove("hover:bg[#1D4ED8]", "hover:bgrose50", "hover:bg[#E0E7FF]");
            });
            toast("Application not accepted", "success");
          }, 220);
        } catch (err) {
          toast(err.message || "Couldn't submit decision", "error");
        }
      });
    });
  });

  /*11. VIEW FULL ACTIVITY HISTORY*/
  byText("a", "View Full Activity History")?.addEventListener("click", (e) => {
    e.preventDefault();
    // window.location.href = `volunteeractivities.html?id=${VOLUNTEER_ID}`;
    toast("Loading full activity history…");
  });

  /*12. LOG OUT (sidebar)*/
  byText("aside button", "Log out")?.addEventListener("click", () => {
    openModal({
      title: "Log out?",
      body: `<p>You'll be signed out of IMPACTRA on this device.</p>`,
      footer: `
        <button datamodalcancel class="h10 roundedlg bg[#F1F5F9] px4 textsm fontsemibold transition hover:bgslate200">Cancel</button>
        <button datamodalconfirm class="h10 roundedlg bg[#E11D48] px4 textsm fontsemibold textwhite transition hover:bgrose700">Log out</button>
      `,
    });
    $("[datamodalconfirm]")?.addEventListener("click", async () => {
      try { await API.auth.logout(); } catch (_) { /* ignore */ }
      window.location.href = "login.html";
    });
  });

  /*13. SEARCH — lightweight inpage feedback*/
  globalSearch?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && globalSearch.value.trim()) {
      toast(`Searching for "${globalSearch.value.trim()}"…`, "info");
    }
  });

  /*14. GLOBAL 401 HANDLER*/
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

  /*15. HYDRATE FROM API ON LOAD (besteffort, nonblocking)*/
  (async function loadVolunteer() {
    if (!window.API) return;
    try {
      const [profile, metrics] = await Promise.allSettled([
        API.volunteers.get(VOLUNTEER_ID),
        API.volunteers.metrics(VOLUNTEER_ID),
      ]);

      if (profile.status === "fulfilled" && profile.value) {
        const p = profile.value;
        // Header name
        const h1 = $("main h1");
        if (h1 && p.name) h1.textContent = p.name;

        // Header meta line (age, gender, location, occupation)
        const meta = byText("p", "Age:");
        if (meta && p.age) {
          const parts = [
            p.age ? `Age: ${p.age}` : null,
            p.gender ? `Gender: ${p.gender}` : null,
            p.location ? `Location: ${p.location}` : null,
            p.occupation ? `Occupation: ${p.occupation}` : null,
            p.joinedAt ? `Volunteer since ${new Date(p.joinedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : null,
          ].filter(Boolean);
          if (parts.length) meta.textContent = parts.join(" · ");
        }

        // About
        const about = $("section p.fontmedium");
        if (about && p.bio) about.textContent = p.bio;

        // Header ID badge text
        const idSpan = byText("span", "#VOL");
        if (idSpan && p.id) idSpan.textContent = `#${p.id}`;
      }

      if (metrics.status === "fulfilled" && metrics.value) {
        const m = metrics.value;
        // Verified hours metric card (the one whose label is "Verified Hours")
        const vhLabel = byText("p", "Verified Hours");
        const vhValue = vhLabel?.parentElement?.querySelector("p.fontbold");
        if (vhValue && m.verifiedHours != null) {
          vhValue.textContent = `${m.verifiedHours} hrs`;
        }

        // Activities metric card
        const actLabel = byText("p", "Activities");
        const actValue = actLabel?.parentElement?.querySelector("p.fontbold");
        if (actValue && m.activities != null) {
          actValue.textContent = String(m.activities);
        }

        // Certificates metric card
        const certLabel = byText("p", "Certificates");
        const certValue = certLabel?.parentElement?.querySelector("p.fontbold");
        if (certValue && m.certificates != null) {
          certValue.textContent = String(m.certificates);
        }
      }
    } catch (err) {
      // Nonblocking: page still shows the static sample data
      console.warn("[volun.js] Failed to hydrate from API:", err);
    }
  })();

})();