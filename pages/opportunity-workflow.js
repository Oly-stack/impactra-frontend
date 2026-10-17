/* IMPACTRA — Opportunity Workflow (single shared controller)*/
(() => {
  "use strict";

  /*  CONSTANTS  */
  const DRAFT_KEY     = "impactraOpportunityDraft";
  const PUBLISHED_KEY = "impactraPublishedOpportunity";

  const CATEGORY_ENUM_MAP = {
    "Community Support": "Community Service",
    "Education":         "education",
    "Healthcare":        "healthcare",
    "Skills Training":   "education",
    "Environment":       "environment",
  };

  const AGE_LABELS = {
    "16_plus":  "16+ years",
    "18_plus":  "18+ years",
    "all_ages": "All ages (family-friendly)",
  };
  const EXP_LABELS = {
    "none_needed":      "None needed",
    "intermediate":     "Intermediate experience",
    "prior_experience": "Prior experience required",
  };

  /*  HELPERS  */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  function formatDate(value) {
    if (!value) return "";
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatTime12(v) {
    if (!v) return "";
    const [h, m] = v.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
  }

  function setText(id, value, fallback = "Not specified") {
    const el = document.getElementById(id);
    if (!el) return;
    const has = value !== undefined && value !== null && String(value).trim() !== "";
    el.textContent = has ? String(value) : fallback;
  }

  function toast(message, variant = "default") {
    let host = document.getElementById("toast-host");
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
    el.className = `pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
      palette[variant] || palette.default
    }`;
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

  function markInvalid(field, message) {
    if (!field) return toast(message, "error");
    field.classList.add("ring-2", "ring-rose-400");
    field.focus();
    toast(message, "error");
  }
  function clearInvalid(field) {
    field?.classList.remove("ring-2", "ring-rose-400");
  }

  /*  DRAFT / FILE HELPERS  */
  const loadDraft = () => {
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}"); }
    catch { return {}; }
  };
  const saveDraft = (patch) => {
    const next = { ...loadDraft(), ...patch };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch {}
    return next;
  };
  const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch {} };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  function dataUrlToFile(dataUrl, filename, mimeType) {
    const [head, b64] = dataUrl.split(",");
    const mime = mimeType || (head.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], filename || "cover.jpg", { type: mime });
  }

  /*  STEP 1  */
  function initStep1() {
    console.log("[step1] init");

    const titleEl  = document.getElementById("oppName");
    const descEl   = document.getElementById("oppDesc");
    const venueEl  = document.getElementById("venue");
    const hubEl    = document.getElementById("hub");
    const capacityEl   = document.getElementById("volunteerCapacity");
    const coverEl      = document.getElementById("coverImage");
    const coverPreview = document.getElementById("coverPreview");
    const pvImage      = document.getElementById("pvImage");
    const chips        = $$("#categories .chip[data-cat]");

    if (!titleEl) return console.warn("[step1] #oppName missing — aborting");

    /* restore from draft */
    const draft = loadDraft();
    if (draft.title)                 titleEl.value = draft.title;
    if (draft.description)           descEl.value  = draft.description;
    if (draft.location?.venueAddress) venueEl.value = draft.location.venueAddress;
    if (draft.location?.hubRegion)    hubEl.value   = draft.location.hubRegion;
    if (capacityEl && draft.volunteerCapacity)
      capacityEl.value = draft.volunteerCapacity;
    if (draft.category) {
      chips.forEach((c) => {
        const mapped = CATEGORY_ENUM_MAP[c.dataset.cat] || c.dataset.cat;
        if (mapped === draft.category) {
          c.classList.add("chip-active", "bg-blue-600", "text-white");
        }
      });
    }
    if (draft.coverImage?.dataUrl && coverPreview) {
      coverPreview.src = draft.coverImage.dataUrl;
      coverPreview.classList.remove("hidden");
    }
    if (draft.coverImage?.dataUrl && pvImage) {
      pvImage.src = draft.coverImage.dataUrl;
    }

    /* preview sync */
    const syncPreview = () => {
      setText("nameCount",
        `${titleEl.value.length} / 80 characters`, "0 / 80 characters");
      const words = descEl.value.trim()
        ? descEl.value.trim().split(/\s+/).length : 0;
      setText("descCount", `${words} / 300 words`, "0 / 300 words");

      const pvTitle = document.getElementById("pvTitle");
      if (pvTitle) pvTitle.textContent = titleEl.value || "Untitled opportunity";
      const pvDesc = document.getElementById("pvDesc");
      if (pvDesc) pvDesc.textContent = descEl.value || "…";
      const pvVenue = document.getElementById("pvVenue");
      if (pvVenue) pvVenue.textContent = venueEl?.value || "";
      const pvHub = document.getElementById("pvHub");
      if (pvHub) pvHub.textContent = hubEl?.value || "";
    };
    [titleEl, descEl, venueEl].forEach((el) =>
      el?.addEventListener("input", syncPreview));
    hubEl?.addEventListener("change", syncPreview);
    syncPreview();

    /* chip selection */
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) =>
          c.classList.remove("chip-active", "bg-blue-600", "text-white"));
        chip.classList.add("chip-active", "bg-blue-600", "text-white");
        const pvCat = document.getElementById("pvCategory");
        if (pvCat) pvCat.textContent = chip.dataset.cat || "Community Support";
      });
    });

    /* clear invalid ring on input */
    [titleEl, descEl, venueEl, hubEl, capacityEl].forEach((el) => {
      el?.addEventListener("input",  () => clearInvalid(el));
      el?.addEventListener("change", () => clearInvalid(el));
    });

    /* cover image upload */
    coverEl?.addEventListener("change", async () => {
      const file = coverEl.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        if (coverPreview) {
          coverPreview.src = dataUrl;
          coverPreview.classList.remove("hidden");
        }
        if (pvImage) pvImage.src = dataUrl;
        saveDraft({ coverImage: { dataUrl, name: file.name, type: file.type } });
      } catch {
        toast("Couldn't read the image", "error");
      }
    });

    /* NEXT */
    const nextBtn =
      Array.from(document.querySelectorAll("button")).find((b) =>
        /^\s*next\b/i.test(b.textContent.trim())) ||
      document.getElementById("nextBtn");

    if (!nextBtn) return console.warn("[step1] NEXT button not found");

    nextBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const title       = titleEl.value.trim();
      const description = descEl.value.trim();
      const venueAddress = venueEl?.value.trim() || "";
      const hubRegion    = hubEl?.value.trim()   || "";
      const type = document.querySelector('input[name="locType"]:checked')?.value
                || "in_person";

      const activeChip = chips.find((c) =>
        c.classList.contains("chip-active") ||
        c.classList.contains("bg-blue-600"));
      const rawCategory = activeChip?.dataset.cat || "";
      const category    = CATEGORY_ENUM_MAP[rawCategory] || rawCategory;

      const volunteerCapacity = capacityEl ? Number(capacityEl.value) : 10;
      const coverFile = coverEl?.files?.[0] || null;
      const existing  = loadDraft().coverImage;

      /* validate */
      if (title.length < 4)
        return markInvalid(titleEl, "Title must be at least 4 characters");
      if (!rawCategory)
        return toast("Please choose a category", "error");
      if (description.length < 20)
        return markInvalid(descEl, "Description must be at least 20 characters");
      if (type !== "remote" && !venueAddress)
        return markInvalid(venueEl, "Please enter a venue address");
      if (type !== "remote" && !hubRegion)
        return markInvalid(hubEl, "Please enter a hub region");
      if (!volunteerCapacity || volunteerCapacity < 1)
        return markInvalid(capacityEl, "Please enter at least 1 volunteer slot");

      /* cover is optional; only complain if user started picking one */
      const payload = {
        title, category, description, volunteerCapacity,
        location: {
          type,
          venueAddress: type === "remote" ? "" : venueAddress,
          hubRegion:    type === "remote" ? "" : hubRegion,
        },
      };

      if (coverFile) {
        try {
          const dataUrl = await fileToDataUrl(coverFile);
          saveDraft({
            ...payload,
            coverImage: { dataUrl, name: coverFile.name, type: coverFile.type },
          });
        } catch {
          return toast("Couldn't save the cover image", "error");
        }
      } else {
        saveDraft(payload);
        if (!existing) {
          // No cover — that's fine; step 3 will skip it.
        }
      }

      toast("Step 1 saved", "success");
      setTimeout(() => {
        window.location.href = "create-opportunities-step-2.html";
      }, 400);
    });
  }

  /*  STEP 2 (legacy — only if #detailsForm exists)  */
  function initStep2() {
    const form = document.getElementById("detailsForm");
    if (!form) {
      console.log("[step2] #detailsForm not present — inline script owns this page");
      return;
    }
    // …legacy behavior kept as-is…
    console.log("[step2] legacy init");
  }

  /*  STEP 3  */
  function initStep3() {
    console.log("[step3] init");

    const basicWrap  = document.getElementById("basicInfo");
    const extraWrap  = document.getElementById("extraInfo");
    const publishBtn = document.getElementById("publishButton");
    if (!publishBtn) return console.warn("[step3] #publishButton missing");

    const draft = loadDraft();

    const addDetail = (wrap, label, value) => {
      if (!wrap) return;
      const row = document.createElement("div");
      row.className = "detail";
      row.innerHTML =
        `<strong>${escapeHtml(label)}</strong>` +
        `<span>${escapeHtml(value || "Not provided")}</span>`;
      wrap.appendChild(row);
    };

    addDetail(basicWrap, "Title",              draft.title);
    addDetail(basicWrap, "Category",           draft.category);
    addDetail(basicWrap, "Description",        draft.description);
    addDetail(basicWrap, "Location Type",      draft.location?.type);
    addDetail(basicWrap, "Venue Address",      draft.location?.venueAddress || "—");
    addDetail(basicWrap, "Hub Region",         draft.location?.hubRegion    || "—");
    addDetail(basicWrap, "Volunteer Capacity", draft.volunteerCapacity);
    addDetail(basicWrap, "Cover Image",        draft.coverImage?.name || "Not attached");

    addDetail(extraWrap, "Shifts",
      (draft.shifts || []).map((s) =>
        `${formatDate(s.date)} · ${s.startTime}–${s.endTime} (${s.type})`
      ).join(" | ") || "Not provided");
    addDetail(extraWrap, "Minimum Age",
      AGE_LABELS[draft.requirements?.minimumAge] || draft.requirements?.minimumAge);
    addDetail(extraWrap, "Experience Level",
      EXP_LABELS[draft.requirements?.experienceLevel] || draft.requirements?.experienceLevel);
    addDetail(extraWrap, "Tasks",
      (draft.tasks || []).map((t) => `${t.order}. ${t.title}`).join(" | ") || "None");

    publishBtn.addEventListener("click", async () => {
      const missing = [];
      if (!draft.title)                         missing.push("Title");
      if (!draft.category)                      missing.push("Category");
      if (!draft.description)                   missing.push("Description");
      if (!draft.location?.type)                missing.push("Location type");
      if (!draft.volunteerCapacity)             missing.push("Volunteer capacity");
      if (!draft.shifts?.length)                missing.push("Shifts");
      if (!draft.requirements?.minimumAge)      missing.push("Minimum age");
      if (!draft.requirements?.experienceLevel) missing.push("Experience level");

      if (missing.length) {
        toast(`Missing: ${missing.join(", ")}`, "error");
        return;
      }

      const original = publishBtn.innerHTML;
      publishBtn.disabled = true;
      publishBtn.textContent = "Publishing…";

      try {
        const fd = new FormData();
        fd.append("title",             draft.title);
        fd.append("category",          draft.category);
        fd.append("description",       draft.description);
        fd.append("volunteerCapacity", String(draft.volunteerCapacity));
        fd.append("location", JSON.stringify({
          type:         draft.location.type,
          venueAddress: draft.location.venueAddress || "",
          hubRegion:    draft.location.hubRegion    || "",
        }));
        fd.append("shifts",       JSON.stringify(draft.shifts));
        fd.append("requirements", JSON.stringify(draft.requirements));
        fd.append("tasks",        JSON.stringify(draft.tasks || []));

        if (draft.coverImage?.dataUrl) {
          const coverFile = dataUrlToFile(
            draft.coverImage.dataUrl,
            draft.coverImage.name || "cover.jpg",
            draft.coverImage.type || "image/jpeg"
          );
          fd.append("coverImage", coverFile);
        }

        if (!window.API?.organization?.opportunities?.create) {
          throw new Error("API module not loaded (check API.js path)");
        }

        const createRes = await API.organization.opportunities.create(fd);
        const created   = createRes?.opportunity || createRes?.data || createRes || null;
        const createdId = created?._id || created?.id;
        if (!createdId) throw new Error("Backend did not return an opportunity ID");

        await API.organization.opportunities.publish(createdId);

        sessionStorage.setItem(PUBLISHED_KEY, JSON.stringify({
          ...draft,
          id: createdId,
          status: "active",
          publishedAt: new Date().toISOString(),
        }));

        clearDraft();
        toast("Opportunity published", "success");
        setTimeout(() => {
          window.location.href = "opportunities-success.html";
        }, 600);
      } catch (err) {
        console.error("[step3] publish failed:", err);
        publishBtn.disabled = false;
        publishBtn.innerHTML = original;
        toast(err?.message || "Couldn't publish — please try again", "error");
      }
    });
  }

  /*  LIST  */
  function initList() {
    const searchEl = document.getElementById("search");
    const gridEl   = document.getElementById("opportunities");
    const emptyEl  = document.getElementById("empty");
    let all = [];

    const render = (list) => {
      if (!gridEl) return;
      if (!list.length) {
        gridEl.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "block";
        return;
      }
      if (emptyEl) emptyEl.style.display = "none";
      gridEl.innerHTML = list.map((opp) => {
        const loc  = opp.location?.hubRegion || opp.location?.venueAddress || "Remote";
        const date = opp.shifts?.[0]?.date ? formatDate(opp.shifts[0].date) : "";
        const status = (opp.status || "draft").toLowerCase();
        const badge =
          status === "active"
            ? `<span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>`
            : status === "completed"
              ? `<span class="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">Completed</span>`
              : `<span class="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Draft</span>`;
        return `
          <article class="card">
            <div class="flex items-start justify-between gap-2 mb-2">
              <h2 class="text-lg font-bold">${escapeHtml(opp.title || "Untitled")}</h2>
              ${badge}
            </div>
            <p class="text-sm text-gray-600 line-clamp-3">${escapeHtml(opp.description || "")}</p>
            <p class="mt-3 text-sm"><strong>Category:</strong> ${escapeHtml(opp.category || "—")}</p>
            <p class="text-sm"><strong>Location:</strong> ${escapeHtml(loc)}</p>
            ${date ? `<p class="text-sm"><strong>Next shift:</strong> ${escapeHtml(date)}</p>` : ""}
            <a href="opportunity-details.html?id=${encodeURIComponent(opp._id || opp.id)}"
               class="inline-block mt-4 px-4 py-2 bg-[#4f46e5] text-white rounded-md text-sm font-semibold hover:bg-[#4338ca]">
              View Details
            </a>
          </article>`;
      }).join("");
    };

    const applySearch = () => {
      const q = (searchEl?.value || "").trim().toLowerCase();
      render(!q ? all : all.filter((o) => JSON.stringify(o).toLowerCase().includes(q)));
    };
    searchEl?.addEventListener("input", () => {
      clearTimeout(applySearch._t);
      applySearch._t = setTimeout(applySearch, 150);
    });

    (async () => {
      try {
        if (!window.API) throw new Error("API not loaded");
        const res = await API.opportunities.list({ limit: 100 });
        all = Array.isArray(res) ? res : (res?.data || res?.opportunities || []);
        render(all);
      } catch (err) {
        console.warn("[list] load failed:", err);
        render([]);
      }
    })();
  }

  /*  SUCCESS  */
  function initSuccess() {
    console.log("[success] init");

    let published = {};
    try { published = JSON.parse(sessionStorage.getItem(PUBLISHED_KEY) || "{}"); }
    catch {}

    const summary = document.getElementById("publishedSummary");
    const status  = document.getElementById("flowStatus");

    if (!published || !published.id) {
      if (status) {
        status.hidden = false;
        status.textContent =
          "We couldn't find the published opportunity in this session. " +
          "Try publishing again, or browse existing opportunities.";
      }
      return;
    }

    setText("opportunityTitle",    published.title);
    setText("opportunityCategory", published.category);
    setText("referenceNumber",     `REFERENCE: #${published.id}`);

    const firstShift = published.shifts?.[0];
    if (firstShift) {
      setText("opportunityDate", formatDate(firstShift.date));
      setText("opportunityTime",
        `${formatTime12(firstShift.startTime)} – ${formatTime12(firstShift.endTime)}`);
    }

    setText("opportunityVenue",    published.location?.venueAddress || "—");
    setText("opportunityRegion",   published.location?.hubRegion    || "—");
    setText("opportunityStaffing",
      `${published.volunteerCapacity || 0} Volunteers`);
    setText("staffingTarget",      published.volunteerCapacity || 0);
    setText("confirmedCount",      0);

    if (summary) summary.hidden = false;

    const viewBtn = document.getElementById("viewOpportunityBtn");
    if (viewBtn) {
      viewBtn.href = `opportunity-details.html?id=${encodeURIComponent(published.id)}`;
    }
  }

  /*  DETAILS  */
  function initDetails() {
    console.log("[details] init");
    let current = null;

    const render = (opp) => {
      setText("title",            opp.title, "Opportunity Details");
      setText("category",         opp.category, "Opportunity");
      setText("sideCategory",     opp.category);
      const loc = opp.location?.hubRegion || opp.location?.venueAddress || "Remote";
      setText("location",         loc);
      setText("sideLocation",     loc);
      setText("type",             opp.location?.type);
      setText("description",      opp.description, "No description provided.");
      setText("shortDescription", opp.description, "Explore this opportunity.");
      setText("requirements",
        opp.requirements ? JSON.stringify(opp.requirements) : "No requirements provided.");
      setText("benefits",         opp.benefits, "No benefits specified.");
      setText("startDate",        formatDate(opp.shifts?.[0]?.date));
      setText("endDate",          formatDate(opp.shifts?.[opp.shifts.length - 1]?.date));
      setText("deadline",         formatDate(opp.deadline));
      setText("sideDeadline",     formatDate(opp.deadline));
      setText("slots",            opp.volunteerCapacity);
      if (opp.title) document.title = `${opp.title} · IMPACTRA`;
    };

    (async () => {
      const urlId = new URLSearchParams(window.location.search).get("id");
      let opp = null;
      if (window.API && urlId) {
        try {
          const res = await API.opportunities.get(urlId);
          opp = res?.data || res || null;
        } catch (err) { console.warn("[details] fetch failed:", err); }
      }
      if (!opp) {
        try {
          opp = JSON.parse(
            sessionStorage.getItem(PUBLISHED_KEY) ||
            sessionStorage.getItem(DRAFT_KEY) || "{}");
        } catch {}
      }
      if (!opp || !Object.keys(opp).length) {
        toast("No opportunity to display", "info");
        return;
      }
      current = opp;
      render(opp);
    })();

    window.applyForOpportunity = async function () {
      if (!current) return toast("Nothing to apply to yet", "error");
      const btn = $$("button").find((b) => /apply/i.test(b.textContent || ""));
      const original = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.textContent = "Applying…"; }
      try { toast("Application flow is handled by volunteers via the mobile app", "info"); }
      finally { if (btn) { btn.disabled = false; btn.innerHTML = original; } }
    };
  }

  /*  ROUTER  */
  function detectPage() {
    const explicit = document.body?.dataset?.opportunityPage;
    if (explicit) return explicit;

    if (document.getElementById("oppName"))            return "step1";
    if (document.getElementById("detailsForm"))        return "step2";
    if (document.getElementById("publishButton"))      return "step3";
    if (document.getElementById("search") &&
        document.getElementById("opportunities"))      return "list";
    if (document.getElementById("opportunityTitle") &&
        document.getElementById("opportunityCategory"))return "success";
    if (document.getElementById("applyButton"))        return "details";
    return null;
  }

  const INIT = {
    step1: initStep1, step2: initStep2, step3: initStep3,
    list: initList, success: initSuccess, details: initDetails,
  };

  const page = detectPage();
  console.log("[opportunity-workflow] page:", page);
  if (page && INIT[page]) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", INIT[page]);
    } else {
      INIT[page]();
    }
  }

  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });
})();