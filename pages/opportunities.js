/* Shared behavior for the six opportunity screens. API.js loads first. */
(() => {
  "use strict";

  const DRAFT_KEY = "impactraOpportunityDraft";
  const PUBLISHED_KEY = "impactraPublishedOpportunity";
  const $ = (id) => document.getElementById(id);
  const page = document.body.dataset.opportunityPage;
  const basicFields = ["title", "category", "location", "description"];
  const detailFields = ["type", "startDate", "endDate", "deadline", "slots", "requirements", "benefits"];

  function readSaved(key) {
    try {
      const data = JSON.parse(sessionStorage.getItem(key) || "null");
      return data && typeof data === "object" && !Array.isArray(data) ? data : null;
    } catch (_) {
      return null;
    }
  }

  function idOf(record) {
    const id = record?.id ?? record?._id;
    return (typeof id === "string" || typeof id === "number") && String(id).trim()
      ? String(id) : null;
  }

  function assertSuccess(response) {
    if (response?.success === false) {
      throw new Error(response.message || "The request was not accepted. Please try again.");
    }
    return response;
  }

  function recordFrom(response) {
    assertSuccess(response);
    const data = response?.data ?? response;
    const record = data?.opportunity ?? response?.opportunity ?? data;
    return record && typeof record === "object" && !Array.isArray(record) && idOf(record)
      ? { ...record, id: idOf(record) } : null;
  }

  function text(value, fallback = "Not specified") {
    if (Array.isArray(value)) return value.map((item) => text(item, "")).filter(Boolean).join(", ") || fallback;
    if (value && typeof value === "object") return text(value.name ?? value.label, fallback);
    return value !== undefined && value !== null && String(value).trim() ? String(value) : fallback;
  }

  function normalize(record) {
    const location = record.location;
    return {
      ...record,
      id: idOf(record),
      category: text(record.category),
      location: typeof location === "object" && location
        ? [location.venueAddress, location.hubRegion].filter(Boolean).join(", ") : location,
      type: record.type ?? record.mode,
      slots: record.slots ?? record.volunteerCapacity ?? record.capacity,
      deadline: record.deadline ?? record.applicationDeadline,
      startDate: record.startDate ?? record.shifts?.[0]?.date,
      endDate: record.endDate ?? record.shifts?.[record.shifts.length - 1]?.date,
    };
  }

  function setText(id, value, fallback) {
    if ($(id)) $(id).textContent = text(value, fallback);
  }

  function dateLabel(value) {
    if (!value) return "Not specified";
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? "Not specified" : date.toLocaleDateString("en-NG", {
      day: "numeric", month: "long", year: "numeric",
    });
  }

  function toast(message, variant = "info") {
    let host = $("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const item = document.createElement("div");
    item.className = "flow-toast";
    item.dataset.variant = variant;
    item.setAttribute("role", variant === "error" ? "alert" : "status");
    item.textContent = message;
    host.appendChild(item);
    setTimeout(() => item.remove(), 6000);
  }

  function status(message, variant = "info", retry) {
    const box = $("flowStatus");
    if (!box) return;
    box.replaceChildren();
    box.textContent = message;
    box.dataset.variant = variant;
    box.hidden = !message;
    box.setAttribute("role", variant === "error" ? "alert" : "status");
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Try again";
      button.addEventListener("click", retry);
      box.appendChild(button);
    }
  }

  function method(...path) {
    let owner = window.API;
    for (const key of path.slice(0, -1)) owner = owner?.[key];
    const fn = owner?.[path[path.length - 1]];
    if (typeof fn !== "function") throw new Error("Unable to connect. Reload the page and try again.");
    return fn.bind(owner);
  }

  function requireSignIn() {
    if (!window.API) throw new Error("Unable to connect. Reload the page and try again.");
    if (!window.API?.tokens?.isAuthenticated) throw new Error("Please sign in before continuing.");
  }

  function invalid(id, message) {
    const field = $(id);
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
    toast(message, "error");
    return false;
  }

  function validateBasic(data) {
    if (typeof data.title !== "string" || data.title.trim().length < 4) return invalid("title", "Enter a title with at least 4 characters.");
    if (!data.category) return invalid("category", "Choose a category.");
    if (typeof data.location !== "string" || !data.location.trim()) return invalid("location", "Enter a location.");
    if (typeof data.description !== "string" || data.description.trim().length < 20) return invalid("description", "Add a description with at least 20 characters.");
    return true;
  }

  function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }

  function validateDetails(data) {
    if (!["On-site", "Remote", "Hybrid"].includes(data.type)) return invalid("type", "Choose an opportunity type.");
    for (const id of ["startDate", "endDate", "deadline"]) {
      if (!validDate(data[id])) return invalid(id, "Choose valid start, end, and deadline dates.");
    }
    if (data.endDate < data.startDate) return invalid("endDate", "End date cannot be before the start date.");
    if (data.deadline > data.startDate) return invalid("deadline", "Deadline must be on or before the start date.");
    if (!Number.isSafeInteger(Number(data.slots)) || Number(data.slots) < 1) return invalid("slots", "Enter a whole number of available slots, at least 1.");
    if (typeof data.requirements !== "string" || !data.requirements.trim()) return invalid("requirements", "Describe the volunteer requirements.");
    return true;
  }

  function setupDraftForm(fields, formId, next, validate) {
    const saved = readSaved(DRAFT_KEY) || {};
    fields.forEach((id) => {
      if (saved[id] != null) $(id).value = saved[id];
      $(id).addEventListener("input", () => $(id).removeAttribute("aria-invalid"));
      $(id).addEventListener("change", () => $(id).removeAttribute("aria-invalid"));
    });
    $(formId).addEventListener("submit", (event) => {
      event.preventDefault();
      const changes = Object.fromEntries(fields.map((id) => [id, $(id).value.trim()]));
      if (!validate(changes)) return;
      if ("slots" in changes) changes.slots = Number(changes.slots);
      try {
        // Keep step 2 and a partially created server record when editing step 1.
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...(readSaved(DRAFT_KEY) || {}), ...changes }));
        window.location.href = next;
      } catch (_) {
        toast("Unable to save your draft. Allow browser storage and try again.", "error");
      }
    });
  }

  function apiPayload(draft) {
    return Object.fromEntries([...basicFields, ...detailFields].map((key) => [key, draft[key] ?? ""]));
  }

  function rememberDraft(draft) {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (_) { /* Keep the in-memory copy for retries. */ }
  }

  async function setupReview() {
    let draft = readSaved(DRAFT_KEY);
    const button = $("publishButton");
    if (!draft || !validateBasic(draft) || !validateDetails(draft)) {
      button.disabled = true;
      status("Your draft is incomplete. Go back to Basic Information to finish it.", "error");
      return;
    }
    const labels = {
      title: "Opportunity Title", category: "Category", location: "Location", description: "Description",
      type: "Opportunity Type", startDate: "Start Date", endDate: "End Date", deadline: "Application Deadline",
      slots: "Available Slots", requirements: "Requirements", benefits: "Benefits",
    };
    [...basicFields, ...detailFields].forEach((key) => {
      const row = document.createElement("div");
      row.className = "detail";
      const label = document.createElement("strong");
      label.textContent = labels[key];
      const value = document.createElement("span");
      value.textContent = key.endsWith("Date") || key === "deadline" ? dateLabel(draft[key]) : text(draft[key], "None specified");
      row.append(label, value);
      $(basicFields.includes(key) ? "basicInfo" : "extraInfo").appendChild(row);
    });
    let publishing = false;
    button.addEventListener("click", async () => {
      if (publishing) return;
      publishing = true;
      button.disabled = true;
      button.textContent = "Publishing…";
      status("");
      try {
        requireSignIn();
        const create = method("organization", "opportunities", "create");
        const publish = method("organization", "opportunities", "publish");
        const payload = apiPayload(draft);
        let created;
        if (draft.serverId) {
          // A failed publish can be retried without creating a duplicate record.
          if (draft.serverPayload !== JSON.stringify(payload)) {
            assertSuccess(await method("organization", "opportunities", "update")(draft.serverId, payload));
          }
          created = { ...payload, id: draft.serverId };
        } else {
          const formData = new FormData();
          Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
          created = recordFrom(await create(formData));
          if (!created) throw new Error("The server did not return an opportunity ID. Publication could not be confirmed.");
        }
        draft = { ...draft, serverId: created.id, serverPayload: JSON.stringify(payload) };
        rememberDraft(draft);
        // Some deployments create an active record immediately; draft records need the publish endpoint.
        const alreadyPublished = ["active", "published"].includes(String(created.status).toLowerCase());
        const response = alreadyPublished ? created : assertSuccess(await publish(created.id));
        const remote = recordFrom(response) || {};
        if (remote.id && remote.id !== created.id) {
          throw new Error("The server returned a different opportunity. Publication could not be confirmed.");
        }
        if (remote.status && !["active", "published"].includes(String(remote.status).toLowerCase())) {
          throw new Error("The server has saved this opportunity but has not published it. Please try again.");
        }
        const published = {
          ...payload, ...created, ...remote, id: created.id,
          status: remote.status || (alreadyPublished ? created.status : "published"),
          publicationConfirmed: true, publishedAt: new Date().toISOString(),
        };
        try {
          sessionStorage.setItem(PUBLISHED_KEY, JSON.stringify(published));
          sessionStorage.removeItem(DRAFT_KEY);
        } catch (_) { /* The ID in the URL lets the success page recover from the server. */ }
        window.location.href = `opportunities-success.html?id=${encodeURIComponent(published.id)}`;
      } catch (error) {
        status(error.message || "Unable to publish. Your draft has been kept so you can try again.", "error");
        button.disabled = false;
        button.textContent = "Publish Opportunity";
      } finally {
        publishing = false;
      }
    });
  }

  function cachedFor(id) {
    const saved = readSaved(PUBLISHED_KEY);
    return saved?.publicationConfirmed && idOf(saved) && (!id || idOf(saved) === id) ? saved : null;
  }

  async function setupSuccess() {
    const urlId = new URLSearchParams(window.location.search).get("id");
    let opportunity = cachedFor(urlId);
    try {
      if (!opportunity && urlId) {
        const remote = recordFrom(await method("opportunities", "get")(urlId));
        if (remote?.id === urlId && ["active", "published"].includes(String(remote.status).toLowerCase())) opportunity = remote;
      }
      if (!opportunity) throw new Error("No published opportunity was found. Return to your draft or browse opportunities.");
      opportunity = normalize(opportunity);
      setText("opportunityTitle", opportunity.title);
      setText("opportunityCategory", opportunity.category);
      setText("opportunityLocation", opportunity.location);
      $("viewOpportunity").href = `opportunity-details.html?id=${encodeURIComponent(opportunity.id)}`;
      $("publishedSummary").hidden = false;
      $("successHeading").textContent = "Opportunity Published Successfully!";
    } catch (error) {
      $("successHeading").textContent = "Publication could not be confirmed";
      status(error.message, "error");
    }
  }

  function recordsFrom(response) {
    assertSuccess(response);
    const data = response?.data ?? response;
    const records = Array.isArray(data) ? data : data?.opportunities ?? response?.opportunities;
    if (!Array.isArray(records)) throw new Error("The server returned an unexpected opportunity list. Please try again.");
    return records.map(recordFrom).filter(Boolean).map(normalize);
  }

  async function setupList() {
    const container = $("opportunities");
    const search = $("search");
    let records = [];
    let loaded = false;
    function render() {
      const query = search.value.toLocaleLowerCase().trim();
      const matching = records.filter((record) => [record.title, record.category, record.description, record.location]
        .some((value) => text(value, "").toLocaleLowerCase().includes(query)));
      container.replaceChildren();
      matching.forEach((record) => {
        const card = document.createElement("article");
        card.className = "card";
        card.dataset.opportunityId = record.id;
        const heading = document.createElement("h2");
        heading.textContent = text(record.title, "Untitled Opportunity");
        const description = document.createElement("p");
        description.textContent = text(record.description, "View the opportunity for details.");
        const location = document.createElement("p");
        location.textContent = `Location: ${text(record.location)}`;
        const link = document.createElement("a");
        link.href = `opportunity-details.html?id=${encodeURIComponent(record.id)}`;
        link.textContent = "View Details";
        link.setAttribute("aria-label", `View details for ${text(record.title, "this opportunity")}`);
        card.append(heading, description, location, link);
        container.appendChild(card);
      });
      $("empty").hidden = !loaded || matching.length > 0;
      $("empty").textContent = records.length ? "No matching opportunities found." : "No opportunities are available yet.";
    }
    search.addEventListener("input", render);
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { search.value = ""; render(); }
    });
    async function load() {
      status("Loading opportunities…");
      container.setAttribute("aria-busy", "true");
      loaded = false;
      records = [];
      render();
      try {
        records = recordsFrom(await method("opportunities", "list")({ limit: 100 }));
        loaded = true;
        status("");
        render();
      } catch (error) {
        status(error.message || "Unable to load opportunities.", "error", load);
      } finally {
        container.setAttribute("aria-busy", "false");
      }
    }
    await load();
  }

  async function setupDetails() {
    const button = $("applyButton");
    let opportunity = null;
    let applying = false;
    function canApply(record) {
      if (!idOf(record)) return false;
      const state = String(record.status || "").toLowerCase();
      if (["draft", "closed", "completed", "cancelled", "unpublished"].includes(state)) return false;
      const deadline = record.deadline;
      if (!deadline) return true;
      // A date-only deadline remains open through that local calendar day.
      const end = new Date(/^\d{4}-\d{2}-\d{2}$/.test(deadline) ? `${deadline}T23:59:59.999` : deadline);
      return !Number.isNaN(end.getTime()) && end.getTime() >= Date.now();
    }
    function render(record) {
      for (const id of ["title", "category", "location", "type", "description", "requirements", "benefits", "slots"]) setText(id, record[id]);
      setText("shortDescription", record.description);
      setText("sideCategory", record.category);
      setText("sideLocation", record.location);
      for (const id of ["startDate", "endDate", "deadline"]) setText(id, dateLabel(record[id]));
      setText("sideDeadline", dateLabel(record.deadline));
      document.title = `${text(record.title, "Opportunity Details")} | Impactra`;
      $("opportunityContent").hidden = false;
    }
    async function load() {
      opportunity = null;
      button.disabled = true;
      button.textContent = "Apply for Opportunity";
      $("opportunityContent").hidden = true;
      status("Loading opportunity…");
      const urlId = new URLSearchParams(window.location.search).get("id");
      const cached = cachedFor(urlId);
      const id = urlId || idOf(cached);
      try {
        if (!id) throw new Error("Select an opportunity from the list to view its details.");
        const remote = recordFrom(await method("opportunities", "get")(id));
        if (!remote || remote.id !== id) throw new Error("This opportunity could not be found.");
        opportunity = normalize(remote);
        render(opportunity);
        button.disabled = !canApply(opportunity);
        if (button.disabled) {
          button.textContent = "Applications unavailable";
          status("This opportunity is not accepting applications.");
        } else {
          status("");
        }
      } catch (error) {
        if (cached) render(normalize(cached));
        status(error.message || "Unable to load this opportunity. Please try again.", "error", id ? load : null);
      }
    }
    button.addEventListener("click", async () => {
      if (applying || button.disabled || !opportunity) return;
      applying = true;
      button.disabled = true;
      button.textContent = "Applying…";
      try {
        requireSignIn();
        if (!canApply(opportunity)) throw new Error("This opportunity is no longer accepting applications.");
        assertSuccess(await method("volunteer", "applications", "submit")(opportunity.id, {}));
        button.textContent = "Applied";
        status("Application submitted successfully.", "success");
      } catch (error) {
        button.disabled = !canApply(opportunity);
        button.textContent = "Apply for Opportunity";
        status(error.message || "Unable to submit your application. Please try again.", "error");
      } finally {
        applying = false;
      }
    });
    await load();
  }

  document.addEventListener("api:unauthorized", () => {
    toast("Your session expired. Please sign in again.", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 1200);
  });

  document.querySelectorAll("[data-back-to]").forEach((button) => {
    button.addEventListener("click", () => { window.location.href = button.dataset.backTo; });
  });

  const screens = {
    basic: () => setupDraftForm(basicFields, "opportunityForm", "create-opportunities-step-2.html", validateBasic),
    details: () => setupDraftForm(detailFields, "detailsForm", "create-opportunities-steps-3.html", validateDetails),
    review: setupReview,
    success: setupSuccess,
    list: setupList,
    opportunity: setupDetails,
  };
  Promise.resolve().then(() => screens[page]?.()).catch((error) => {
    status("Unable to load this screen. Reload the page and try again.", "error");
    console.error("[opportunities]", error);
  });
})();
