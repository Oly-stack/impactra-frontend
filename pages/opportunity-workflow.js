/* IMPACTRA — Opportunity Workflow
   Single shared controller for:
     step1   → create-opportunities-step-1.html
     step2   → create-opportunities-step-2.html  (legacy form only)
     step3   → create-opportunities-steps-3.html
     list    → opportunities-list.html
     success → opportunities-success.html
     details → opportunity-details.html
*/
(() => {
  "use strict";

  /* ───────────────────────────  CONSTANTS  ─────────────────────────── */

  const DRAFT_KEY     = "impactraOpportunityDraft";
  const PUBLISHED_KEY = "impactraPublishedOpportunity";

  // UI chip labels  →  backend enum (Postman §5.1)
  const CATEGORY_ENUM_MAP = {
    "Community Support": "Community Service",
    "Education":         "education",
    "Healthcare":        "healthcare",
    "Skills Training":   "education",
    "Environment":       "environment",
  };

  const MIN_AGE_OPTIONS = [
    { value: "16_plus",  label: "16+ years" },
    { value: "18_plus",  label: "18+ years" },
    { value: "all_ages", label: "All ages (family-friendly)" },
  ];

  const EXPERIENCE_OPTIONS = [
    { value: "none_needed",      label: "None needed" },
    { value: "intermediate",     label: "Intermediate experience" },
    { value: "prior_experience", label: "Prior experience required" },
  ];

  /* ────────────────────────────  HELPERS  ──────────────────────────── */

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function formatDate(value) {
    if (!value) return "";
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
      month: "long", day: "numeric", year: "numeric",
    });
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
    el.className = `pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${palette[variant] || palette.default}`;
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
    if (!field) return;
    field.classList.add("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.remove("border-gray-200");
    field.focus();
    toast(message, "error");
  }

  function clearInvalid(field) {
    if (!field) return;
    field.classList.remove("border-[#F43F5E]", "ring-2", "ring-[#F43F5E]/20");
    field.classList.add("border-gray-200");
  }

  /* ───────────────────────  DRAFT + FILE HELPERS  ─────────────────── */

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function saveDraft(patch) {
    try {
      const next = { ...loadDraft(), ...patch };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      return next;
    } catch (err) {
      console.warn("[workflow] saveDraft failed:", err);
      return null;
    }
  }

  function clearDraft() {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) {}
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function dataUrlToFile(dataUrl, filename, mimeType) {
    const [head, b64] = dataUrl.split(",");
    const mime = mimeType || (head.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    const bin = atob(b64);
    const u8  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], filename || "cover.jpg", { type: mime });
  }

  /* ─────────────────────────────  STEP 1  ─────────────────────────────
     Basic Information page.
     Real DOM IDs:   #oppName  #oppDesc  #venue  #hub
                     #categories .chip[data-cat]
                     input[name="locType"]
                     (optional) #volunteerCapacity  #coverImage  #coverPreview
  ──────────────────────────────────────────────────────────────────── */
  function initStep1() {
    console.log("[step1] init");

    const titleEl  = document.getElementById("oppName");
    const descEl   = document.getElementById("oppDesc");
    const venueEl  = document.getElementById("venue");
    const hubEl    = document.getElementById("hub");
    const chips    = document.querySelectorAll("#categories .chip[data-cat]");
    const typeEls  = document.querySelectorAll('input[name="locType"], input[name="locationType"]');
    const capacityEl   = document.getElementById("volunteerCapacity");   // optional
    const coverEl      = document.getElementById("coverImage");          // optional
    const coverPreview = document.getElementById("coverPreview");        // optional

    if (!titleEl) {
      console.warn("[step1] #oppName not found — aborting step-1 init");
      return;
    }

    /* ─── restore draft ─── */
    const draft = loadDraft();
    if (draft.title)                         titleEl.value  = draft.title;
    if (draft.description)                   descEl.value   = draft.description;
    if (draft.volunteerCapacity && capacityEl) capacityEl.value = draft.volunteerCapacity;
    if (draft.location?.venueAddress)        venueEl.value  = draft.location.venueAddress;
    if (draft.location?.hubRegion)           hubEl.value    = draft.location.hubRegion;

    // Re-activate the previously selected category chip
    if (draft.category) {
      chips.forEach((c) => {
        const mapped = CATEGORY_ENUM_MAP[c.dataset.cat] || c.dataset.cat;
        if (mapped === draft.category) {
          c.classList.add("chip-active", "bg-blue-600", "text-white");
        }
      });
    }

    // Restore cover preview if the input exists and draft has one
    if (draft.coverImage?.dataUrl && coverPreview) {
      coverPreview.src = draft.coverImage.dataUrl;
      coverPreview.classList.remove("hidden");
    }

    /* ─── category chips: exclusive selection ─── */
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) =>
          c.classList.remove("chip-active", "bg-blue-600", "text-white")
        );
        chip.classList.add("chip-active", "bg-blue-600", "text-white");
        const pvCategory = document.getElementById("pvCategory");
        if (pvCategory) pvCategory.textContent = chip.dataset.cat || "Community Support";
      });
    });

    /* ─── clear invalid ring as user types ─── */
    [titleEl, descEl, venueEl, hubEl, capacityEl].forEach((el) => {
      el?.addEventListener("input",  () => clearInvalid(el));
      el?.addEventListener("change", () => clearInvalid(el));
    });

    /* ─── cover image → dataURL + preview + draft ─── */
    coverEl?.addEventListener("change", async () => {
      const file = coverEl.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        if (coverPreview) {
          coverPreview.src = dataUrl;
          coverPreview.classList.remove("hidden");
        }
        saveDraft({ coverImage: { dataUrl, name: file.name, type: file.type } });
      } catch (err) {
        console.error("[step1] cover preview failed:", err);
        toast("Couldn't read the image", "error");
      }
    });

    /* ─── "NEXT" button → validate + save + go to step 2 ─── */
    const nextBtn = Array.from(document.querySelectorAll("button"))
      .find((b) => /^\s*next\s*$/i.test(b.textContent.trim()));

    if (!nextBtn) {
      console.warn("[step1] NEXT button not found — cannot proceed to step 2");
      return;
    }

    nextBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const title       = titleEl.value.trim();
      const description = descEl.value.trim();
      const venueAddress = venueEl?.value.trim() || "";
      const hubRegion    = hubEl?.value.trim()   || "";
      const type         = document.querySelector('input[name="locType"]:checked')?.value
                        || document.querySelector('input[name="locationType"]:checked')?.value
                        || "in_person";

      const activeChip  = Array.from(chips).find((c) =>
        c.classList.contains("chip-active") || c.classList.contains("bg-blue-600")
      );
      const rawCategory = activeChip?.dataset.cat || "";
      const category    = CATEGORY_ENUM_MAP[rawCategory] || rawCategory;

      const volunteerCapacity = capacityEl ? Number(capacityEl.value) : 10;
      const coverFile = coverEl?.files?.[0] || null;

      /* validate */
      if (title.length < 4)   return markInvalid(titleEl, "Title must be at least 4 characters");
      if (!rawCategory)       return toast("Please choose a category", "error");
      if (description.length < 20)
        return markInvalid(descEl, "Description must be at least 20 characters");
      if (!type)              return toast("Please choose a location type", "error");
      if (type !== "remote" && !venueAddress)
        return markInvalid(venueEl, "Please enter a venue address");
      if (type !== "remote" && !hubRegion)
        return markInvalid(hubEl, "Please enter a hub region");
      if (!volunteerCapacity || volunteerCapacity < 1)
        return markInvalid(capacityEl, "Please enter at least 1 volunteer slot");

      // Cover image: require either a fresh file OR one already stashed in the draft.
      const existingCover = loadDraft().coverImage;
      if (!coverFile && !existingCover?.dataUrl && coverEl) {
        return toast("A cover image is required", "error");
      }

      /* assemble + save */
      const draftData = {
        title,
        category,
        description,
        volunteerCapacity,
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
            ...draftData,
            coverImage: { dataUrl, name: coverFile.name, type: coverFile.type },
          });
        } catch {
          return toast("Couldn't save the cover image", "error");
        }
      } else {
        saveDraft(draftData);
      }

      toast("Step 1 saved", "success");
      setTimeout(() => {
        window.location.href = "create-opportunities-step-2.html";
      }, 400);
    });
  }

  /* ─────────────────────────────  STEP 2  ─────────────────────────────
     LEGACY ONLY.  Fires only when the page has #detailsForm (old markup).
     Your new step-2 HTML ships its own inline script — this does nothing
     there, which is what we want.
  ──────────────────────────────────────────────────────────────────── */
  function initStep2() {
    const form = document.getElementById("detailsForm");
    if (!form) {
      console.log("[step2] #detailsForm not present — skipping legacy init");
      return;
    }
    console.log("[step2] legacy init");

    const shiftsWrap  = document.getElementById("shiftsList");
    const tasksWrap   = document.getElementById("tasksList");
    const addShiftBtn = document.getElementById("addShiftBtn");
    const addTaskBtn  = document.getElementById("addTaskBtn");
    const minAgeEl    = document.getElementById("minimumAge");
    const expEl       = document.getElementById("experienceLevel");

    if (minAgeEl) {
      minAgeEl.innerHTML = `<option value="">Select minimum age</option>` +
        MIN_AGE_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
    }
    if (expEl) {
      expEl.innerHTML = `<option value="">Select experience level</option>` +
        EXPERIENCE_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
    }

    function renderShift(shift = {}) {
      if (!shiftsWrap) return;
      const wrap = document.createElement("div");
      wrap.className = "shift-row border border-gray-200 rounded-lg p-3 mb-2 bg-white";
      wrap.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="block text-xs font-semibold text-gray-600 mb-1">Date</label>
            <input type="date" class="shift-date w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value="${escapeHtml(shift.date || "")}" /></div>
          <div><label class="block text-xs font-semibold text-gray-600 mb-1">Type</label>
            <select class="shift-type w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="one_time"  ${shift.type === "one_time"  ? "selected" : ""}>One-time</option>
              <option value="recurring" ${shift.type === "recurring" ? "selected" : ""}>Recurring</option>
            </select></div>
          <div><label class="block text-xs font-semibold text-gray-600 mb-1">Start time</label>
            <input type="time" class="shift-start w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value="${escapeHtml(shift.startTime || "")}" /></div>
          <div><label class="block text-xs font-semibold text-gray-600 mb-1">End time</label>
            <input type="time" class="shift-end w-full border border-gray-300 rounded-md px-3 py-2 text-sm" value="${escapeHtml(shift.endTime || "")}" /></div>
        </div>
        <button type="button" class="shift-remove mt-2 text-xs font-semibold text-[#E11D48] hover:underline">Remove shift</button>
      `;
      wrap.querySelector(".shift-remove").addEventListener("click", () => wrap.remove());
      shiftsWrap.appendChild(wrap);
    }

    function renderTask(task = {}) {
      if (!tasksWrap) return;
      const wrap = document.createElement("div");
      wrap.className = "task-row flex items-center gap-2 mb-2";
      wrap.innerHTML = `
        <input type="text" class="task-title flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. Packing food boxes" value="${escapeHtml(task.title || "")}" />
        <button type="button" class="task-remove text-xs font-semibold text-[#E11D48] hover:underline">Remove</button>
      `;
      wrap.querySelector(".task-remove").addEventListener("click", () => wrap.remove());
      tasksWrap.appendChild(wrap);
    }

    const draft = loadDraft();
    (draft.shifts?.length ? draft.shifts : [{}]).forEach(renderShift);
    (draft.tasks?.length  ? draft.tasks  : [{}]).forEach(renderTask);
    if (draft.requirements?.minimumAge && minAgeEl)    minAgeEl.value = draft.requirements.minimumAge;
    if (draft.requirements?.experienceLevel && expEl)  expEl.value    = draft.requirements.experienceLevel;

    addShiftBtn?.addEventListener("click", () => renderShift());
    addTaskBtn?.addEventListener("click",  () => renderTask());

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const shifts = $$(".shift-row", shiftsWrap).map((row) => ({
        date:      row.querySelector(".shift-date").value,
        startTime: row.querySelector(".shift-start").value,
        endTime:   row.querySelector(".shift-end").value,
        type:      row.querySelector(".shift-type").value,
      })).filter((s) => s.date && s.startTime && s.endTime);

      if (!shifts.length) { toast("Add at least one complete shift", "error"); return; }
      for (const s of shifts) if (s.endTime <= s.startTime) {
        toast("Each shift's end time must be after its start time", "error");
        return;
      }

      const tasks = $$(".task-row", tasksWrap).map((row, i) => ({
        title: row.querySelector(".task-title").value.trim(),
        order: i + 1,
      })).filter((t) => t.title);

      const minimumAge      = minAgeEl.value;
      const experienceLevel = expEl.value;
      if (!minimumAge)      return markInvalid(minAgeEl, "Please choose a minimum age");
      if (!experienceLevel) return markInvalid(expEl,   "Please choose an experience level");

      saveDraft({ shifts, tasks, requirements: { minimumAge, experienceLevel } });
      toast("Step 2 saved", "success");
      setTimeout(() => {
        window.location.href = "create-opportunities-steps-3.html";
      }, 400);
    });
  }

  /* ─────────────────────────────  STEP 3  ─────────────────────────────
     Review & Publish.
       POST   /organization/opportunity/create    (multipart)
       PATCH  /organization/opportunities/:id/publish
     On success → redirects to opportunities-success.html
  ──────────────────────────────────────────────────────────────────── */
  function initStep3() {
    console.log("[step3] init");

    const basicWrap  = document.getElementById("basicInfo");
    const extraWrap  = document.getElementById("extraInfo");
    const publishBtn = document.getElementById("publishButton");

    if (!publishBtn) {
      console.warn("[step3] #publishButton not found — cannot publish");
      return;
    }

    const draft = loadDraft();

    /* ─── Render the review summary ─── */
    function addDetail(wrap, label, value) {
      if (!wrap) return;
      const row = document.createElement("div");
      row.className = "detail";
      row.innerHTML =
        `<strong>${escapeHtml(label)}</strong>` +
        `<span>${escapeHtml(value || "Not provided")}</span>`;
      wrap.appendChild(row);
    }

    addDetail(basicWrap, "Title",             draft.title);
    addDetail(basicWrap, "Category",          draft.category);
    addDetail(basicWrap, "Description",       draft.description);
    addDetail(basicWrap, "Location Type",     draft.location?.type);
    addDetail(basicWrap, "Venue Address",     draft.location?.venueAddress || "—");
    addDetail(basicWrap, "Hub Region",        draft.location?.hubRegion    || "—");
    addDetail(basicWrap, "Volunteer Capacity", draft.volunteerCapacity);
    addDetail(basicWrap, "Cover Image",       draft.coverImage?.name || "Not attached");

    addDetail(extraWrap, "Shifts",
      (draft.shifts || []).map((s) =>
        `${formatDate(s.date)} · ${s.startTime}–${s.endTime} (${s.type})`
      ).join(" | ") || "Not provided");
    addDetail(extraWrap, "Minimum Age",      draft.requirements?.minimumAge);
    addDetail(extraWrap, "Experience Level", draft.requirements?.experienceLevel);
    addDetail(extraWrap, "Tasks",
      (draft.tasks || []).map((t) => `${t.order}. ${t.title}`).join(" | ") || "None");

    /* ─── Publish ─── */
    publishBtn.addEventListener("click", async () => {
      const missing = [];
      if (!draft.title)                         missing.push("Title");
      if (!draft.category)                      missing.push("Category");
      if (!draft.description)                   missing.push("Description");
      if (!draft.location?.type)                missing.push("Location type");
      if (!draft.volunteerCapacity)             missing.push("Volunteer capacity (step 1)");
      if (!draft.coverImage?.dataUrl)           missing.push("Cover image (step 1)");
      if (!draft.shifts?.length)                missing.push("Shifts (step 2)");
      if (!draft.requirements?.minimumAge)      missing.push("Minimum age (step 2)");
      if (!draft.requirements?.experienceLevel) missing.push("Experience level (step 2)");

      if (missing.length) {
        toast(`Missing: ${missing.join(", ")}`, "error");
        return;
      }

      const original = publishBtn.innerHTML;
      publishBtn.disabled = true;
      publishBtn.textContent = "Publishing…";

      try {
        /* 1. Build multipart payload */
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

        const coverFile = dataUrlToFile(
          draft.coverImage.dataUrl,
          draft.coverImage.name || "cover.jpg",
          draft.coverImage.type || "image/jpeg"
        );
        fd.append("coverImage", coverFile);

        /* 2. POST /organization/opportunity/create */
        const createRes = await API.organization.opportunities.create(fd);
        const created   = createRes?.opportunity || createRes?.data || createRes || null;
        const createdId = created?._id || created?.id;

        if (!createdId) {
          throw new Error("Backend did not return an opportunity ID");
        }

        /* 3. PATCH /organization/opportunities/:id/publish */
        await API.organization.opportunities.publish(createdId);

        /* 4. Persist for the success page */
        try {
          sessionStorage.setItem(PUBLISHED_KEY, JSON.stringify({
            ...draft,
            id:          createdId,
            status:      "active",
            publishedAt: new Date().toISOString(),
          }));
        } catch (_) {}

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

  /* ─────────────────────────────  LIST  ───────────────────────────── */
  function initList() {
    console.log("[list] init");

    const searchEl = document.getElementById("search");
    const gridEl   = document.getElementById("opportunities");
    const emptyEl  = document.getElementById("empty");

    let allOpportunities = [];

    function renderCards(list) {
      if (!gridEl) return;
      if (!list.length) {
        gridEl.innerHTML = "";
        if (emptyEl) emptyEl.style.display = "block";
        return;
      }
      if (emptyEl) emptyEl.style.display = "none";

      gridEl.innerHTML = list.map((opp) => {
        const loc   = opp.location?.hubRegion || opp.location?.venueAddress || "Remote";
        const date  = opp.shifts?.[0]?.date ? formatDate(opp.shifts[0].date) : "";
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
    }

    function applySearch() {
      const q = (searchEl?.value || "").trim().toLowerCase();
      const filtered = !q
        ? allOpportunities
        : allOpportunities.filter((opp) =>
            JSON.stringify(opp).toLowerCase().includes(q)
          );
      renderCards(filtered);
    }

    if (searchEl) {
      let t;
      searchEl.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(applySearch, 150);
      });
    }

    (async () => {
      try {
        if (!window.API) throw new Error("API not loaded");
        const res = await API.opportunities.list({ limit: 100 });
        allOpportunities = Array.isArray(res)
          ? res
          : (res?.data || res?.opportunities || []);
        renderCards(allOpportunities);
      } catch (err) {
        console.warn("[list] load failed:", err);
        renderCards([]);
      }
    })();
  }

  /* ─────────────────────────────  SUCCESS  ─────────────────────────────
     Reads PUBLISHED_KEY, fills the summary, and — crucially — unhides
     #publishedSummary and updates #successHeading so the user doesn't
     stare at a frozen "Checking Publication…" screen.
  ──────────────────────────────────────────────────────────────────── */
  function initSuccess() {
    console.log("[success] init");

    let published = {};
    try {
      published = JSON.parse(sessionStorage.getItem(PUBLISHED_KEY) || "{}");
    } catch (_) {}

    const heading = document.getElementById("successHeading");
    const summary = document.getElementById("publishedSummary");
    const status  = document.getElementById("flowStatus");

    /* Graceful failure: opened in a new tab, or session was cleared */
    if (!published || !published.id) {
      if (heading) heading.textContent = "Publication could not be confirmed";
      if (status) {
        status.hidden = false;
        status.textContent =
          "We couldn't find the published opportunity in this session. " +
          "Try publishing again, or browse existing opportunities.";
      }
      return;
    }

    setText("opportunityTitle", published.title);
    setText("opportunityCategory", published.category);
    setText("opportunityLocation",
      published.location?.hubRegion || published.location?.venueAddress || "—");

    /* THE TWO LINES THAT MAKE THE PAGE ACTUALLY WORK */
    if (heading) heading.textContent = "Opportunity Published Successfully!";
    if (summary) summary.hidden = false;

    /* Rewire the "View Opportunity" CTA to the real id */
    const viewBtn = $$("a").find((a) => /view opportunity/i.test(a.textContent || ""));
    if (viewBtn) {
      viewBtn.href = `opportunity-details.html?id=${encodeURIComponent(published.id)}`;
    }
  }

  /* ─────────────────────────────  DETAILS  ───────────────────────────── */
  function initDetails() {
    console.log("[details] init");

    let currentOpportunity = null;

    function render(opp) {
      setText("title",            opp.title, "Opportunity Details");
      setText("category",         opp.category, "Opportunity");
      setText("sideCategory",     opp.category);
      setText("location",         opp.location?.hubRegion || opp.location?.venueAddress || "Remote");
      setText("sideLocation",     opp.location?.hubRegion || opp.location?.venueAddress || "Remote");
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
    }

    (async () => {
      const urlId = new URLSearchParams(window.location.search).get("id");
      let opp = null;

      if (window.API && urlId) {
        try {
          const res = await API.opportunities.get(urlId);
          opp = res?.data || res || null;
        } catch (err) {
          console.warn("[details] fetch failed:", err);
        }
      }

      if (!opp) {
        try {
          opp = JSON.parse(
            sessionStorage.getItem(PUBLISHED_KEY) ||
            sessionStorage.getItem(DRAFT_KEY) ||
            "{}"
          );
        } catch (_) {}
      }

      if (!opp || !Object.keys(opp).length) {
        toast("No opportunity to display", "info");
        return;
      }

      currentOpportunity = opp;
      render(opp);
    })();

    window.applyForOpportunity = async function () {
      if (!currentOpportunity) {
        toast("Nothing to apply to yet", "error");
        return;
      }
      const btn = $$("button").find((b) => /apply/i.test(b.textContent || ""));
      const original = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.textContent = "Applying…"; }
      try {
        toast("Application flow is handled by volunteers via the mobile app", "info");
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
      }
    };
  }

  /* ─────────────────────────────  ROUTER  ───────────────────────────── */

  function detectPage() {
    // Preferred: explicit <body data-opportunity-page="...">
    const explicit = document.body?.dataset?.opportunityPage;
    if (explicit) return explicit;

    // Fallback DOM sniffing — matches the actual IDs used across your HTML
    if (document.getElementById("oppName"))                                 return "step1";
    if (document.getElementById("detailsForm"))                             return "step2";   // legacy
    if (document.getElementById("publishButton"))                           return "step3";
    if (document.getElementById("search") && document.getElementById("opportunities"))
      return "list";
    if (document.getElementById("opportunityTitle") && document.getElementById("opportunityCategory"))
      return "success";
    if (document.getElementById("applyButton"))                             return "details";

    return null;
  }

  const INIT = {
    step1:   initStep1,
    step2:   initStep2,
    step3:   initStep3,
    list:    initList,
    success: initSuccess,
    details: initDetails,
  };

  const page = detectPage();
  console.log("[opportunity-workflow] Detected page:", page);

  if (page && INIT[page]) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", INIT[page]);
    } else {
      INIT[page]();
    }
  }

  /* Global 401 */
  document.addEventListener("api:unauthorized", () => {
    toast("Session expired — please sign in again", "error");
    setTimeout(() => (window.location.href = "login.html"), 900);
  });

})();