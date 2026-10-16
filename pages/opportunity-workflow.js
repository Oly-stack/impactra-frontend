/* Shared opportunity workflow. Uses the current multipart API schema from main. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DRAFT_KEY = "impactraOpportunityDraft";
  const PUBLISHED_KEY = "impactraPublishedOpportunity";
  const CATEGORIES = [
    "Community Service",
    "healthcare",
    "environment",
    "education",
  ];
  const MIN_AGE_OPTIONS = {
    "16_plus": "16+ years",
    "18_plus": "18+ years",
    all_ages: "All ages (family-friendly)",
  };
  const EXPERIENCE_OPTIONS = {
    none_needed: "None needed",
    intermediate: "Intermediate experience",
    prior_experience: "Prior experience required",
  };
  const LOCATION_TYPES = {
    in_person: "In-person",
    remote: "Remote",
    hybrid: "Hybrid",
  };
  const page = document.body.dataset.opportunityPage;
  const readSaved = (key) => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) || "null");
      return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
    } catch (_) {
      return null;
    }
  };
  const user = readSaved("impactra_user") || {};
  const isVolunteer =
    user.role === "volunteer" || user.accountType === "volunteer";
  const string = (value, fallback = "Not specified") =>
    typeof value === "string" || typeof value === "number"
      ? String(value).trim() || fallback
      : fallback;
  const idOf = (record) => string(record?.id ?? record?._id, "") || null;
  const publishedState = (value) =>
    ["active", "published"].includes(String(value).toLowerCase());
  const locationLabel = (value) =>
    typeof value === "string"
      ? value
      : value?.type === "remote"
        ? "Remote"
        : [value?.venueAddress, value?.hubRegion].filter(Boolean).join(", ");
  const dateLabel = (value) => {
    if (!value) return "Not specified";
    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
    );
    return Number.isNaN(date.getTime())
      ? "Not specified"
      : date.toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };
  const timeLabel = (value) => {
    if (!/^\d{2}:\d{2}$/.test(value || "")) return "";
    const [hours, minutes] = value.split(":").map(Number);
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
  };
  function setText(id, value, fallback) {
    if ($(id)) $(id).textContent = string(value, fallback);
  }
  function element(tag, cls, value) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value != null) node.textContent = value;
    return node;
  }
  function assertSuccess(response) {
    if (response?.success === false)
      throw new Error(
        response.message || "The request was not accepted. Please try again.",
      );
    return response;
  }
  function recordFrom(response) {
    assertSuccess(response);
    const data = response?.data ?? response;
    const record = data?.opportunity ?? response?.opportunity ?? data;
    return record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      idOf(record)
      ? { ...record, id: idOf(record) }
      : null;
  }
  function method(...path) {
    let owner = window.API;
    for (const key of path.slice(0, -1)) owner = owner?.[key];
    const fn = owner?.[path.at(-1)];
    if (typeof fn !== "function")
      throw new Error("Unable to connect. Reload the page and try again.");
    return fn.bind(owner);
  }
  function requireSignIn() {
    if (!window.API)
      throw new Error("Unable to connect. Reload the page and try again.");
    if (!window.API.tokens?.isAuthenticated)
      throw new Error("Please sign in before continuing.");
  }
  function status(message = "", variant = "info", retry) {
    const box = $("flowStatus");
    box.replaceChildren(document.createTextNode(message));
    box.hidden = !message;
    box.dataset.variant = variant;
    box.setAttribute("role", variant === "error" ? "alert" : "status");
    if (retry) {
      const button = element("button", "", "Try again");
      button.type = "button";
      button.addEventListener("click", retry);
      box.appendChild(button);
    }
  }
  function toast(message, variant = "info") {
    const item = element("div", "flow-toast", message);
    item.dataset.variant = variant;
    item.setAttribute("role", variant === "error" ? "alert" : "status");
    $("toast-host").appendChild(item);
    setTimeout(() => item.remove(), 6000);
  }
  function invalid(field, message) {
    field?.setAttribute("aria-invalid", "true");
    field?.focus();
    toast(message, "error");
    return false;
  }
  function saveDraft(patch) {
    const next = { ...(readSaved(DRAFT_KEY) || {}), ...patch };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch (_) {
      throw new Error(
        "Unable to save your draft. Allow browser storage or choose a smaller image, then try again.",
      );
    }
    return next;
  }
  function coverUrl(record) {
    const candidate =
      record?.coverImage?.dataUrl ||
      record?.coverImage?.url ||
      record?.coverImageUrl ||
      record?.coverImage;
    if (typeof candidate !== "string") return null;
    if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(candidate))
      return candidate;
    try {
      const url = new URL(candidate, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch (_) {
      return null;
    }
  }
  function basicError(draft) {
    if (
      string(draft.title, "").length < 4 ||
      string(draft.title, "").length > 120
    )
      return ["title", "Enter a title between 4 and 120 characters."];
    if (!CATEGORIES.includes(draft.category))
      return ["category", "Choose a category."];
    if (
      string(draft.description, "").length < 20 ||
      string(draft.description, "").length > 1000
    )
      return [
        "description",
        "Add a description between 20 and 1,000 characters.",
      ];
    if (!LOCATION_TYPES[draft.location?.type])
      return ["venueAddress", "Choose a location type."];
    if (
      draft.location.type !== "remote" &&
      !string(draft.location.venueAddress, "")
    )
      return ["venueAddress", "Enter a venue address."];
    if (
      draft.location.type !== "remote" &&
      !string(draft.location.hubRegion, "")
    )
      return ["hubRegion", "Enter a hub region."];
    if (
      !Number.isSafeInteger(Number(draft.volunteerCapacity)) ||
      Number(draft.volunteerCapacity) < 1
    )
      return [
        "volunteerCapacity",
        "Enter a whole number of volunteer places, at least 1.",
      ];
    if (
      !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(
        draft.coverImage?.dataUrl || "",
      )
    )
      return ["coverImage", "Add a PNG, JPG or WebP cover image."];
    return null;
  }
  function detailsError(draft) {
    if (!Array.isArray(draft.shifts) || !draft.shifts.length)
      return ["shiftsList", "Add at least one complete shift."];
    for (let i = 0; i < draft.shifts.length; i++) {
      const shift = draft.shifts[i];
      const date = new Date(`${shift.date}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(shift.date || "") ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== shift.date
      )
        return ["shiftsList", `Choose a valid date for shift ${i + 1}.`];
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.startTime || "") ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(shift.endTime || "")
      )
        return [
          "shiftsList",
          `Complete the start and end times for shift ${i + 1}.`,
        ];
      if (shift.endTime <= shift.startTime)
        return ["shiftsList", `Shift ${i + 1} must end after its start time.`];
      if (!["one_time", "recurring"].includes(shift.type))
        return ["shiftsList", `Choose a valid type for shift ${i + 1}.`];
    }
    if (!MIN_AGE_OPTIONS[draft.requirements?.minimumAge])
      return ["minimumAge", "Choose the minimum age."];
    if (!EXPERIENCE_OPTIONS[draft.requirements?.experienceLevel])
      return ["experienceLevel", "Choose the experience level."];
    return null;
  }
  function report(error) {
    if (!error) return true;
    const field = $(error[0]);
    return invalid(
      field?.matches("input,select,textarea")
        ? field
        : field?.querySelector("input"),
      error[1],
    );
  }
  function fillSelect(id, options, placeholder) {
    const select = $(id);
    select.replaceChildren(new Option(placeholder, ""));
    Object.entries(options).forEach(([value, label]) =>
      select.appendChild(new Option(label, value)),
    );
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({ dataUrl: reader.result, name: file.name, type: file.type });
      reader.onerror = () =>
        reject(new Error("Could not read that image. Please choose it again."));
      reader.readAsDataURL(file);
    });
  }
  function setupBasic() {
    fillSelect(
      "category",
      Object.fromEntries(
        CATEGORIES.map((c) => [c, c[0].toUpperCase() + c.slice(1)]),
      ),
      "Select a category",
    );
    const draft = readSaved(DRAFT_KEY) || {};
    for (const id of ["title", "category", "description", "volunteerCapacity"])
      if (draft[id] != null) $(id).value = draft[id];
    for (const id of ["venueAddress", "hubRegion"])
      $(id).value = draft.location?.[id] || "";
    for (const radio of document.querySelectorAll("[name=locationType]")) {
      radio.checked = radio.value === (draft.location?.type || "in_person");
      radio.addEventListener("change", toggleVenue);
    }
    function toggleVenue() {
      $("venueFields").hidden =
        document.querySelector("[name=locationType]:checked")?.value ===
        "remote";
    }
    toggleVenue();
    let cover = draft.coverImage || null;
    let reading = Promise.resolve();
    let fileError = null;
    let selection = 0;
    function preview() {
      $("coverPreviewWrap").hidden = !cover;
      if (cover && coverUrl({ coverImage: cover })) {
        $("coverPreview").src = cover.dataUrl;
        $("coverFilename").textContent = cover.name;
      } else {
        $("coverPreview").removeAttribute("src");
      }
    }
    preview();
    function choose(file) {
      if (!file) return;
      const current = ++selection;
      fileError = null;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        fileError = new Error(
          "Choose a PNG, JPG or WebP image smaller than 5 MB.",
        );
        $("coverImage").value = "";
        invalid($("coverImage"), fileError.message);
        return;
      }
      reading = readFile(file)
        .then((value) => {
          if (current !== selection) return;
          cover = value;
          $("coverImage").removeAttribute("aria-invalid");
          preview();
        })
        .catch((error) => {
          if (current === selection) {
            fileError = error;
            invalid($("coverImage"), error.message);
          }
        });
    }
    $("coverImage").addEventListener("change", () =>
      choose($("coverImage").files[0]),
    );
    $("removeCover").addEventListener("click", () => {
      selection++;
      cover = null;
      fileError = null;
      $("coverImage").value = "";
      preview();
    });
    const zone = $("uploadZone");
    for (const name of ["dragenter", "dragover"])
      zone.addEventListener(name, (e) => {
        e.preventDefault();
        zone.classList.add("dragging");
      });
    for (const name of ["dragleave", "drop"])
      zone.addEventListener(name, () => zone.classList.remove("dragging"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      choose(event.dataTransfer?.files[0]);
    });
    function collect() {
      const type = document.querySelector("[name=locationType]:checked")?.value;
      return {
        title: $("title").value.trim(),
        category: $("category").value,
        description: $("description").value.trim(),
        volunteerCapacity: Number($("volunteerCapacity").value),
        location: {
          type,
          venueAddress: type === "remote" ? "" : $("venueAddress").value.trim(),
          hubRegion: type === "remote" ? "" : $("hubRegion").value.trim(),
        },
        coverImage: cover,
      };
    }
    let saving = false;
    async function save(advance) {
      if (saving) return;
      saving = true;
      try {
        await reading;
        if (fileError) throw fileError;
        const patch = collect();
        if (advance && !report(basicError(patch))) return;
        saveDraft(patch);
        if (advance) window.location.href = "create-opportunities-step-2.html";
        else toast("Draft saved on this device.", "success");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        saving = false;
      }
    }
    $("opportunityForm").addEventListener("submit", (event) => {
      event.preventDefault();
      void save(true);
    });
    $("saveDraftButton").addEventListener("click", () => void save(false));
    const count = () =>
      setText(
        "descriptionCount",
        `${$("description").value.length.toLocaleString()} / 1,000 characters`,
      );
    $("description").addEventListener("input", count);
    count();
  }
  function setupSchedule() {
    fillSelect("minimumAge", MIN_AGE_OPTIONS, "Select minimum age");
    fillSelect(
      "experienceLevel",
      EXPERIENCE_OPTIONS,
      "Select experience level",
    );
    const draft = readSaved(DRAFT_KEY) || {};
    let serial = 0;
    function addShift(shift = {}) {
      const id = ++serial;
      const row = element("div", "shift-row");
      row.innerHTML = `<div class="shift-row-header"><h3>Volunteer shift</h3><button type="button" class="remove-button shift-remove">Remove shift</button></div><div class="field-grid"><div class="field"><label class="field-label" for="shift-date-${id}">Date <span class="required">*</span></label><input class="form-input shift-date" id="shift-date-${id}" type="date" required/></div><div class="field"><label class="field-label" for="shift-type-${id}">Shift type</label><select class="form-input shift-type" id="shift-type-${id}"><option value="one_time">One-time</option><option value="recurring">Recurring</option></select></div><div class="field"><label class="field-label" for="shift-start-${id}">Start time <span class="required">*</span></label><input class="form-input shift-start" id="shift-start-${id}" type="time" required/></div><div class="field"><label class="field-label" for="shift-end-${id}">End time <span class="required">*</span></label><input class="form-input shift-end" id="shift-end-${id}" type="time" required/></div></div>`;
      for (const [name, key] of [
        ["date", "date"],
        ["type", "type"],
        ["start", "startTime"],
        ["end", "endTime"],
      ])
        row.querySelector(`.shift-${name}`).value =
          shift[key] || (name === "type" ? "one_time" : "");
      row
        .querySelector(".shift-remove")
        .addEventListener("click", () => row.remove());
      $("shiftsList").appendChild(row);
    }
    function addTask(task = {}) {
      const id = ++serial;
      const row = element("div", "task-row");
      const label = element("label", "sr-only", "Volunteer task");
      label.htmlFor = `task-${id}`;
      const input = element("input", "form-input task-title");
      input.type = "text";
      input.id = `task-${id}`;
      input.maxLength = 300;
      input.placeholder = "e.g. Pack and distribute food boxes";
      input.value = task.title || "";
      const remove = element("button", "remove-button task-remove", "Remove");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove volunteer task");
      remove.addEventListener("click", () => row.remove());
      row.append(label, input, remove);
      $("tasksList").appendChild(row);
    }
    (Array.isArray(draft.shifts) && draft.shifts.length
      ? draft.shifts
      : [{}]
    ).forEach(addShift);
    (Array.isArray(draft.tasks) && draft.tasks.length
      ? draft.tasks
      : [{}]
    ).forEach(addTask);
    $("minimumAge").value = draft.requirements?.minimumAge || "";
    $("experienceLevel").value = draft.requirements?.experienceLevel || "";
    $("addShiftBtn").addEventListener("click", () => {
      addShift();
      $("shiftsList").lastElementChild.querySelector("input").focus();
    });
    $("addTaskBtn").addEventListener("click", () => {
      addTask();
      $("tasksList").lastElementChild.querySelector("input").focus();
    });
    function collect() {
      const shifts = [...document.querySelectorAll(".shift-row")].map(
        (row) => ({
          date: row.querySelector(".shift-date").value,
          startTime: row.querySelector(".shift-start").value,
          endTime: row.querySelector(".shift-end").value,
          type: row.querySelector(".shift-type").value,
        }),
      );
      const tasks = [...document.querySelectorAll(".task-title")]
        .map((input) => input.value.trim())
        .filter(Boolean)
        .map((title, i) => ({ title, order: i + 1 }));
      return {
        shifts,
        tasks,
        requirements: {
          minimumAge: $("minimumAge").value,
          experienceLevel: $("experienceLevel").value,
        },
      };
    }
    $("detailsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const patch = collect();
      if (!report(detailsError(patch))) return;
      try {
        saveDraft(patch);
        window.location.href = "create-opportunities-steps-3.html";
      } catch (error) {
        toast(error.message, "error");
      }
    });
    $("saveDraftButton").addEventListener("click", () => {
      try {
        saveDraft(collect());
        toast("Draft saved on this device.", "success");
      } catch (error) {
        toast(error.message, "error");
      }
    });
    document
      .querySelector("[data-back-to]")
      .addEventListener("click", (event) => {
        try {
          saveDraft(collect());
          window.location.href = event.currentTarget.dataset.backTo;
        } catch (error) {
          toast(error.message, "error");
        }
      });
  }
  function addDetail(parent, label, value) {
    const row = element("div", "detail");
    row.append(element("dt", "", label), element("dd", "", string(value)));
    parent.appendChild(row);
  }
  function payloadFrom(draft) {
    return {
      title: draft.title,
      category: draft.category,
      description: draft.description,
      volunteerCapacity: Number(draft.volunteerCapacity),
      location: draft.location,
      shifts: draft.shifts,
      requirements: draft.requirements,
      tasks: draft.tasks || [],
    };
  }
  function multipart(draft) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(payloadFrom(draft)))
      fd.append(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    const { dataUrl, name, type } = draft.coverImage;
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    fd.append(
      "coverImage",
      new File([bytes], name || "cover.jpg", { type: type || "image/jpeg" }),
    );
    return fd;
  }
  async function fingerprint(draft) {
    const data = new TextEncoder().encode(
      JSON.stringify({ ...payloadFrom(draft), coverImage: draft.coverImage }),
    );
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  function setupReview() {
    let draft = readSaved(DRAFT_KEY) || {};
    const button = $("publishButton");
    const error = basicError(draft) || detailsError(draft);
    if (error) {
      button.disabled = true;
      status(
        `Your draft is incomplete. ${error[1]} Use Edit to finish the relevant section.`,
        "error",
      );
    }
    const shifts = Array.isArray(draft.shifts) ? draft.shifts : [];
    const hours = shifts.reduce((sum, shift) => {
      const minutes = (time) => {
        const [h, m] = (time || "").split(":").map(Number);
        return h * 60 + m;
      };
      const duration = minutes(shift.endTime) - minutes(shift.startTime);
      return (
        sum + (Number.isFinite(duration) && duration > 0 ? duration / 60 : 0)
      );
    }, 0);
    const duration = hours
      ? `${Number(hours.toFixed(2))} ${hours === 1 ? "Hour" : "Hours"}`
      : "Not specified";
    setText("reviewTitle", draft.title);
    const category = element(
      "span",
      "review-category-pill",
      string(draft.category),
    );
    $("reviewCategory").replaceChildren(category);
    setText("reviewDescription", draft.description);
    $("reviewLocation").replaceChildren(
      element(
        "span",
        "review-location-label",
        LOCATION_TYPES[draft.location?.type] || "Not specified",
      ),
      element("small", "", locationLabel(draft.location) || "Not specified"),
    );
    function summary(id, value, note) {
      $(id).replaceChildren(element("strong", "", string(value)));
      if (note) $(id).appendChild(element("small", "", note));
    }
    const first = shifts[0] || {};
    summary(
      "reviewDate",
      dateLabel(first.date),
      first.type === "recurring" ? "Recurring shift" : "Single event",
    );
    summary(
      "reviewTime",
      first.startTime && first.endTime
        ? `${timeLabel(first.startTime)} – ${timeLabel(first.endTime)}`
        : "Not specified",
      "Local venue time",
    );
    summary("reviewCredit", duration, "Scheduled commitment");
    summary("reviewAge", MIN_AGE_OPTIONS[draft.requirements?.minimumAge]);
    summary(
      "reviewExperience",
      EXPERIENCE_OPTIONS[draft.requirements?.experienceLevel],
    );
    summary("reviewDemands", draft.requirements?.physicalDemands);
    if (shifts.length > 1) {
      $("additionalShifts").hidden = false;
      setText(
        "additionalShifts",
        shifts
          .slice(1)
          .map(
            (shift) =>
              `${dateLabel(shift.date)} · ${timeLabel(shift.startTime)}–${timeLabel(shift.endTime)}`,
          )
          .join("\n"),
      );
    }
    const tasks = Array.isArray(draft.tasks)
      ? [...draft.tasks].sort((a, b) => (a.order || 0) - (b.order || 0))
      : [];
    for (const [i, task] of tasks.entries()) {
      const item = element("li", "milestone-task"),
        content = element("div", "milestone-body");
      content.appendChild(element("h3", "", string(task.title)));
      if (task.description)
        content.appendChild(element("p", "", string(task.description)));
      item.append(element("span", "milestone-number", i + 1), content);
      if (task.startTime && task.endTime)
        item.appendChild(
          element(
            "span",
            "milestone-time",
            `${timeLabel(task.startTime)} – ${timeLabel(task.endTime)}`,
          ),
        );
      $("reviewTasks").appendChild(item);
    }
    if (!tasks.length)
      $("reviewTasks").appendChild(
        element(
          "li",
          "milestone-empty",
          "No volunteer tasks specified. Use Edit to add tasks.",
        ),
      );
    const cover = coverUrl(draft);
    if (cover) {
      $("reviewCover").src = cover;
      $("reviewCover").hidden = false;
    }
    setText("previewCategory", draft.category);
    setText("previewDuration", duration);
    setText("previewTitle", draft.title, "Your opportunity");
    setText("previewDescription", draft.description);
    setText("previewLocation", locationLabel(draft.location));
    setText(
      "previewOrganisation",
      user.organizationName || user.organization?.name || "Your organisation",
    );
    setText(
      "previewSpots",
      `${Number(draft.volunteerCapacity) || 0} spots open`,
    );
    $("saveReviewDraft").addEventListener("click", () => {
      try {
        saveDraft(draft);
        toast("Draft saved on this device.", "success");
      } catch (error) {
        toast(error.message, "error");
      }
    });
    let publishing = false;
    button.addEventListener("click", async () => {
      if (publishing || error) return;
      publishing = true;
      button.disabled = true;
      button.textContent = "Publishing…";
      status();
      try {
        requireSignIn();
        const snapshot = await fingerprint(draft);
        let created = null;
        if (draft.serverId) {
          if (draft.serverFingerprint !== snapshot)
            assertSuccess(
              await method(
                "organization",
                "opportunities",
                "update",
              )(draft.serverId, multipart(draft)),
            );
          created = { id: draft.serverId };
        } else {
          created = recordFrom(
            await method(
              "organization",
              "opportunities",
              "create",
            )(multipart(draft)),
          );
          if (!created)
            throw new Error(
              "The server did not return an opportunity ID. Publication could not be confirmed.",
            );
        }
        draft = { ...draft, serverId: created.id, serverFingerprint: snapshot };
        try {
          saveDraft(draft);
        } catch (_) {
          /* The in-memory ID still prevents duplicate retries on this page. */
        }
        const response = publishedState(created.status)
          ? created
          : assertSuccess(
              await method(
                "organization",
                "opportunities",
                "publish",
              )(created.id),
            );
        const remote = recordFrom(response);
        if (remote && remote.id !== created.id)
          throw new Error(
            "The server returned a different opportunity. Publication could not be confirmed.",
          );
        const returned =
          remote ||
          response?.data?.opportunity ||
          response?.data ||
          response ||
          {};
        if (returned.status && !publishedState(returned.status))
          throw new Error(
            "The server saved your opportunity but has not published it. Please try again.",
          );
        const published = {
          ...draft,
          ...created,
          ...remote,
          id: created.id,
          status: returned.status || "active",
          publicationConfirmed: true,
          publishedAt: new Date().toISOString(),
        };
        // Discard the local image bytes; the success page needs only the summary.
        delete published.coverImage;
        try {
          sessionStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
          sessionStorage.removeItem(DRAFT_KEY);
        } catch (_) {
          /* The URL contains the confirmed ID, allowing the success screen to fetch it. */
        }
        window.location.href = `opportunities-success.html?id=${encodeURIComponent(created.id)}`;
      } catch (error) {
        status(
          error.message ||
            "Unable to publish. Your draft has been kept for retry.",
          "error",
        );
        button.disabled = false;
        button.textContent = "Publish opportunity";
      } finally {
        publishing = false;
      }
    });
  }
  function cachedFor(id) {
    const saved = readSaved(PUBLISHED_KEY);
    return saved?.publicationConfirmed &&
      publishedState(saved.status) &&
      idOf(saved) &&
      (!id || idOf(saved) === id)
      ? saved
      : null;
  }
  async function setupSuccess() {
    const id = new URLSearchParams(window.location.search).get("id");
    let record = cachedFor(id);
    try {
      if (!record && id) {
        const remote = recordFrom(await method("opportunities", "get")(id));
        if (remote?.id === id && publishedState(remote.status)) record = remote;
      }
      if (!record)
        throw new Error(
          "No confirmed publication was found. Return to your draft or select an opportunity from the list.",
        );
      setText("opportunityTitle", record.title);
      setText("opportunityCategory", record.category);
      setText("opportunityLocation", locationLabel(record.location));
      $("viewOpportunity").href =
        `opportunity-details.html?id=${encodeURIComponent(idOf(record))}`;
      $("publishedSummary").hidden = false;
      setText("successHeading", "Your opportunity is live");
      setText(
        "successMessage",
        "Your opportunity has been published. Volunteers can now discover it, learn about your mission and get involved.",
      );
      setText("successLabel", "OPPORTUNITY PUBLISHED");
      $("successIcon").classList.remove("unconfirmed");
      $("successIcon").innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
      document.title = "Opportunity published | Impactra";
    } catch (error) {
      setText("successHeading", "Publication could not be confirmed");
      setText(
        "successMessage",
        "Your saved draft has not been treated as a published opportunity.",
      );
      $("successErrorActions").hidden = false;
      status(error.message, "error");
    }
  }
  function recordsFrom(response) {
    assertSuccess(response);
    const data = response?.data ?? response;
    const records = Array.isArray(data)
      ? data
      : (data?.opportunities ?? response?.opportunities);
    if (!Array.isArray(records))
      throw new Error(
        "The server returned an unexpected opportunity list. Please try again.",
      );
    return records.map(recordFrom).filter(Boolean);
  }
  function stateGroup(record) {
    return publishedState(record.status)
      ? "active"
      : ["completed", "closed"].includes(String(record.status).toLowerCase())
        ? "completed"
        : "draft";
  }
  function badge(record) {
    const state = string(record.status, "draft").toLowerCase();
    const node = element(
      "span",
      "status-badge",
      state[0].toUpperCase() + state.slice(1),
    );
    node.dataset.status = [
      "active",
      "published",
      "completed",
      "closed",
    ].includes(state)
      ? state
      : "draft";
    return node;
  }
  async function setupList() {
    let records = [],
      loaded = false,
      selectedStatus = "all";
    const search = $("search");
    search.value = new URLSearchParams(window.location.search).get("q") || "";
    $("workspaceSearch").value = search.value;
    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      const category = $("categoryFilter").value,
        location = $("locationFilter").value;
      const matching = records.filter(
        (record) =>
          (selectedStatus === "all" || stateGroup(record) === selectedStatus) &&
          (!category || record.category === category) &&
          (!location || record.location?.type === location) &&
          [
            record.title,
            record.category,
            record.description,
            locationLabel(record.location),
          ].some((v) => string(v, "").toLocaleLowerCase().includes(query)),
      );
      $("opportunities").replaceChildren();
      for (const record of matching) {
        const row = element("tr", "card");
        row.dataset.opportunityId = record.id;
        const identity = element("div", "opportunity-identity"),
          mark = element(
            "span",
            "opportunity-mark",
            string(record.title, "OP").slice(0, 2).toUpperCase(),
          );
        const cover = coverUrl(record);
        if (cover) {
          const image = element("img");
          image.src = cover;
          image.alt = "";
          image.loading = "lazy";
          image.addEventListener("error", () => image.remove());
          mark.replaceChildren(image);
        }
        const info = element("div");
        info.append(
          element("h2", "", string(record.title, "Untitled opportunity")),
          element("p", "row-subtitle", string(record.category)),
        );
        identity.append(mark, info);
        const titleCell = element("td");
        titleCell.appendChild(identity);
        const locationCell = element(
          "td",
          "row-location",
          locationLabel(record.location) || "Not specified",
        );
        const scheduleCell = element(
          "td",
          "row-schedule",
          dateLabel(record.shifts?.[0]?.date),
        );
        const statusCell = element("td", "row-status");
        statusCell.appendChild(badge(record));
        const action = element("td", "row-action");
        const link = element("a", "btn btn-primary", "View details");
        link.href = `opportunity-details.html?id=${encodeURIComponent(record.id)}`;
        link.setAttribute(
          "aria-label",
          `View details for ${string(record.title, "this opportunity")}`,
        );
        action.appendChild(link);
        row.append(titleCell, locationCell, scheduleCell, statusCell, action);
        $("opportunities").appendChild(row);
      }
      const filtered = Boolean(
        query || category || location || selectedStatus !== "all",
      );
      $("empty").hidden = !loaded || matching.length > 0;
      setText(
        "emptyHeading",
        filtered ? "No matching opportunities" : "No opportunities yet",
      );
      setText(
        "emptyMessage",
        filtered
          ? "Try a different search or clear your filters."
          : "Create your first opportunity and invite volunteers to make a difference.",
      );
      $("emptyCreate").hidden = filtered || isVolunteer;
      setText(
        "listSummary",
        loaded
          ? `Showing ${matching.length} of ${records.length} opportunities`
          : "Loading opportunities…",
      );
      for (const state of ["all", "active", "draft", "completed"])
        setText(
          `${state}TabCount`,
          loaded
            ? records.filter((r) => state === "all" || stateGroup(r) === state)
                .length
            : "—",
        );
      setText("totalCount", loaded ? records.length : "—");
      setText(
        "activeCount",
        loaded ? records.filter((r) => stateGroup(r) === "active").length : "—",
      );
      setText(
        "capacityCount",
        loaded
          ? records
              .reduce(
                (sum, r) =>
                  sum +
                  (Number.isFinite(Number(r.volunteerCapacity))
                    ? Number(r.volunteerCapacity)
                    : 0),
                0,
              )
              .toLocaleString()
          : "—",
      );
      setText(
        "listLimitNote",
        records.length === 100 ? "First 100 results" : "",
        "",
      );
    }
    async function load() {
      loaded = false;
      records = [];
      render();
      status("Loading opportunities…");
      $("opportunities").setAttribute("aria-busy", "true");
      try {
        records = recordsFrom(
          await method("opportunities", "list")({ limit: 100 }),
        );
        loaded = true;
        const existing = $("categoryFilter").value;
        $("categoryFilter").replaceChildren(new Option("All categories", ""));
        [
          ...new Set(
            records.map((r) => r.category).filter((v) => typeof v === "string"),
          ),
        ]
          .sort()
          .forEach((value) =>
            $("categoryFilter").appendChild(new Option(value, value)),
          );
        $("categoryFilter").value = existing;
        status();
        render();
      } catch (error) {
        status(error.message || "Unable to load opportunities.", "error", load);
        setText("listSummary", "Opportunities could not be loaded.");
      } finally {
        $("opportunities").setAttribute("aria-busy", "false");
      }
    }
    search.addEventListener("input", render);
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        search.value = "";
        render();
      }
    });
    for (const id of ["categoryFilter", "locationFilter"])
      $(id).addEventListener("change", render);
    document.querySelectorAll("[data-status-filter]").forEach((button) =>
      button.addEventListener("click", () => {
        selectedStatus = button.dataset.statusFilter;
        document
          .querySelectorAll("[data-status-filter]")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        render();
      }),
    );
    $("filterToggle").addEventListener("click", () => {
      $("listFilters").hidden = !$("listFilters").hidden;
      $("filterToggle").setAttribute(
        "aria-expanded",
        String(!$("listFilters").hidden),
      );
    });
    $("clearFilters").addEventListener("click", () => {
      search.value = "";
      $("categoryFilter").value = "";
      $("locationFilter").value = "";
      selectedStatus = "all";
      document
        .querySelectorAll("[data-status-filter]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.statusFilter === "all"),
          ),
        );
      render();
    });
    await load();
  }
  async function setupDetails() {
    const button = $("applyButton");
    let opportunity = null,
      applying = false;
    button.hidden = !isVolunteer;
    $("manageApplications").hidden = isVolunteer;
    if (isVolunteer)
      setText(
        "applicationNote",
        "Review the schedule and requirements before applying.",
      );
    function canApply(record) {
      if (!publishedState(record.status)) return false;
      if (!record.deadline) return true;
      const end = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(record.deadline)
          ? `${record.deadline}T23:59:59.999`
          : record.deadline,
      );
      return !Number.isNaN(end.getTime()) && end.getTime() >= Date.now();
    }
    function render(record) {
      setText("title", record.title, "Opportunity details");
      setText("category", record.category);
      $("opportunityStatus").replaceWith(
        Object.assign(badge(record), { id: "opportunityStatus" }),
      );
      for (const id of ["location", "sideLocation"])
        setText(id, locationLabel(record.location));
      setText("type", LOCATION_TYPES[record.location?.type] || record.type);
      setText("description", record.description);
      setText("shortDescription", record.description);
      setText("sideCategory", record.category);
      setText("slots", record.volunteerCapacity);
      const shifts = Array.isArray(record.shifts) ? record.shifts : [];
      const sorted = [...shifts].sort((a, b) =>
        string(a.date, "").localeCompare(string(b.date, "")),
      );
      setText("startDate", dateLabel(sorted[0]?.date));
      setText("endDate", dateLabel(sorted.at(-1)?.date));
      setText("nextShift", dateLabel(sorted[0]?.date));
      $("detailShifts").replaceChildren();
      for (const shift of sorted) {
        const item = element("div", "schedule-item"),
          date = element("div");
        date.append(
          element("strong", "", dateLabel(shift.date)),
          element(
            "span",
            "",
            shift.type === "recurring" ? "Recurring shift" : "One-time shift",
          ),
        );
        item.append(
          date,
          element(
            "span",
            "",
            `${timeLabel(shift.startTime)}–${timeLabel(shift.endTime)}`,
          ),
        );
        $("detailShifts").appendChild(item);
      }
      if (!shifts.length)
        $("detailShifts").appendChild(
          element("p", "body-copy", "No shifts specified."),
        );
      $("detailRequirements").replaceChildren();
      addDetail(
        $("detailRequirements"),
        "Minimum age",
        MIN_AGE_OPTIONS[record.requirements?.minimumAge],
      );
      addDetail(
        $("detailRequirements"),
        "Experience level",
        EXPERIENCE_OPTIONS[record.requirements?.experienceLevel],
      );
      $("detailTasks").replaceChildren();
      const tasks = Array.isArray(record.tasks)
        ? [...record.tasks].sort((a, b) => (a.order || 0) - (b.order || 0))
        : [];
      for (const task of tasks)
        $("detailTasks").appendChild(element("li", "", string(task.title)));
      if (!tasks.length)
        $("detailTasks").appendChild(element("li", "", "No tasks specified."));
      const cover = coverUrl(record);
      $("detailCover").hidden = !cover;
      if (cover) $("detailCover").src = cover;
      document.title = `${string(record.title, "Opportunity details")} | Impactra`;
      $("opportunityContent").hidden = false;
    }
    async function load() {
      opportunity = null;
      button.disabled = true;
      button.textContent = "Apply for opportunity";
      $("opportunityContent").hidden = true;
      status("Loading opportunity…");
      const urlId = new URLSearchParams(window.location.search).get("id");
      const cached = cachedFor(urlId),
        id = urlId || idOf(cached);
      try {
        if (!id)
          throw new Error(
            "Select an opportunity from the list to view its details.",
          );
        const remote = recordFrom(await method("opportunities", "get")(id));
        if (!remote || remote.id !== id)
          throw new Error("This opportunity could not be found.");
        opportunity = remote;
        render(remote);
        button.disabled = !canApply(remote);
        status(
          isVolunteer && button.disabled
            ? "This opportunity is not accepting applications."
            : "",
        );
      } catch (error) {
        if (cached) render(cached);
        status(
          error.message || "Unable to load this opportunity.",
          "error",
          id ? load : null,
        );
      }
    }
    button.addEventListener("click", async () => {
      if (!isVolunteer || applying || button.disabled || !opportunity) return;
      applying = true;
      button.disabled = true;
      button.textContent = "Applying…";
      status();
      try {
        requireSignIn();
        if (!canApply(opportunity))
          throw new Error(
            "This opportunity is no longer accepting applications.",
          );
        assertSuccess(
          await method(
            "volunteer",
            "applications",
            "submit",
          )(opportunity.id, {}),
        );
        button.textContent = "Applied";
        status("Application submitted successfully.", "success");
      } catch (error) {
        button.disabled = !canApply(opportunity);
        button.textContent = "Apply for opportunity";
        status(error.message || "Unable to submit your application.", "error");
      } finally {
        applying = false;
      }
    });
    await load();
  }
  function setupWorkspace() {
    setText("accountName", user.name || user.organizationName || "My account");
    setText(
      "accountInitial",
      string(user.name || user.organizationName, isVolunteer ? "V" : "N")
        .slice(0, 1)
        .toUpperCase(),
    );
    const avatar = coverUrl({
      coverImage: user.avatarUrl || user.avatar || user.profilePicture,
    });
    if (avatar) {
      $("accountAvatar").src = avatar;
      $("accountAvatar").hidden = false;
      $("accountInitial").hidden = true;
      $("accountAvatar").addEventListener("error", () => {
        $("accountAvatar").hidden = true;
        $("accountInitial").hidden = false;
      });
    }
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        const search = $("workspaceSearch");
        if (search.getClientRects().length) {
          event.preventDefault();
          search.focus();
        }
      }
    });
    document
      .querySelectorAll("[data-unavailable]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          toast(`${button.dataset.unavailable} is not available yet.`),
        ),
      );
    const narrow = window.matchMedia("(max-width: 800px)"),
      sidebar = $("workspaceSidebar"),
      opener = $("openMenu");
    function close(returnFocus = false) {
      sidebar.classList.remove("open");
      $("drawerOverlay").hidden = true;
      $("workspace").inert = false;
      sidebar.inert = narrow.matches;
      opener.setAttribute("aria-expanded", "false");
      document.body.classList.remove("drawer-open");
      if (returnFocus) opener.focus();
    }
    opener.addEventListener("click", () => {
      sidebar.inert = false;
      sidebar.classList.add("open");
      $("drawerOverlay").hidden = false;
      $("workspace").inert = true;
      opener.setAttribute("aria-expanded", "true");
      document.body.classList.add("drawer-open");
      $("closeMenu").focus();
    });
    $("closeMenu").addEventListener("click", () => close(true));
    $("drawerOverlay").addEventListener("click", () => close(true));
    document.addEventListener("keydown", (event) => {
      if (!sidebar.classList.contains("open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
      if (event.key === "Tab") {
        const links = [...sidebar.querySelectorAll("a,button")].filter(
          (el) => el.getClientRects().length && !el.disabled,
        );
        if (event.shiftKey && document.activeElement === links[0]) {
          event.preventDefault();
          links.at(-1).focus();
        } else if (!event.shiftKey && document.activeElement === links.at(-1)) {
          event.preventDefault();
          links[0].focus();
        }
      }
    });
    narrow.addEventListener("change", () => close());
    close();
    $("logoutBtn").addEventListener("click", async () => {
      $("logoutBtn").disabled = true;
      try {
        await method("auth", "logout")();
      } catch (_) {
        window.API?.tokens?.clear();
      }
      for (const key of [DRAFT_KEY, PUBLISHED_KEY, "impactra_user"])
        sessionStorage.removeItem(key);
      window.location.href = "login.html";
    });
    document.addEventListener("input", (event) =>
      event.target.removeAttribute("aria-invalid"),
    );
  }
  document.addEventListener("api:unauthorized", () => {
    toast("Your session expired. Please sign in again.", "error");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  });
  const screens = {
    basic: setupBasic,
    details: setupSchedule,
    review: setupReview,
    list: setupList,
    opportunity: setupDetails,
    success: setupSuccess,
  };
  Promise.resolve()
    .then(() => {
      setupWorkspace();
      return screens[page]?.();
    })
    .catch((error) => {
      status(
        "Unable to load this screen. Reload the page and try again.",
        "error",
      );
      console.error("[opportunities]", error);
    });
})();
