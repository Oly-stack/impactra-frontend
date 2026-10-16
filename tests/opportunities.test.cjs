/* Real-browser regressions. API responses are isolated fixtures, never live writes. */
const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const prefix = "/impactra-frontend/";
const imageData =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF7sAAAAASUVORK5CYII=";
const draft = {
  title: "Food Relief Distribution",
  category: "Community Service",
  description:
    "Help us pack and distribute essential food items to vulnerable families in Surulere.",
  volunteerCapacity: 10,
  location: {
    type: "in_person",
    venueAddress: "Surulere Community Hall, 14 Bishop Street",
    hubRegion: "Lagos",
  },
  coverImage: { dataUrl: imageData, name: "cover.png", type: "image/png" },
  shifts: [
    {
      date: "2099-10-14",
      startTime: "09:00",
      endTime: "13:00",
      type: "one_time",
    },
  ],
  requirements: { minimumAge: "16_plus", experienceLevel: "none_needed" },
  tasks: [
    { title: "Orientation & safety walkthrough", order: 1 },
    { title: "Packing food boxes", order: 2 },
  ],
};
const record = { ...draft, _id: "opportunity-42", status: "published" };
let server, browser, base, context, page, requests, apiHandler, pageErrors;

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const target = path.resolve(
      root,
      decodeURIComponent(url.pathname.slice(prefix.length)),
    );
    if (
      !url.pathname.startsWith(prefix) ||
      !target.startsWith(root + path.sep)
    ) {
      res.writeHead(404).end();
      return;
    }
    try {
      const data = await fs.readFile(target);
      const types = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
      };
      res
        .writeHead(200, {
          "Content-Type":
            types[path.extname(target)] || "application/octet-stream",
        })
        .end(data);
    } catch (_) {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

beforeEach(async () => {
  requests = [];
  pageErrors = [];
  apiHandler = () => ({ status: 200, body: { data: record } });
  context = await browser.newContext();
  context.setDefaultTimeout(5000);
  await context.route(
    "https://impactra-api-dev.onrender.com/api/v1/**",
    async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      if (method === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
            "Access-Control-Allow-Headers": "authorization,content-type",
          },
        });
        return;
      }
      const item = {
        method,
        path: url.pathname.replace("/api/v1", ""),
        body: request.postData(),
        headers: request.headers(),
      };
      requests.push(item);
      const response = await apiHandler(item);
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(response.body),
      });
    },
  );
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

afterEach(async () => {
  await context?.close();
  assert.deepEqual(
    pageErrors,
    [],
    "Opportunity screens must have no uncaught JavaScript errors",
  );
});

async function open(name, seed = {}, authenticated = true, query = "") {
  seed = {
    impactra_user: {
      name: "Test User",
      role: "volunteer",
      organizationName: "Green Route Initiative",
    },
    ...seed,
  };
  await context.addInitScript(
    ({ seed, authenticated }) => {
      if (!sessionStorage.getItem("qa-initialized")) {
        sessionStorage.setItem("qa-initialized", "true");
        for (const [key, value] of Object.entries(seed))
          sessionStorage.setItem(key, JSON.stringify(value));
      }
      if (authenticated) localStorage.setItem("impactra_token", "qa-token");
      else localStorage.removeItem("impactra_token");
    },
    { seed, authenticated },
  );
  await page.goto(`${base}pages/${name}.html${query}`);
}

async function see(selector, expected) {
  await page.waitForFunction(
    ({ selector, expected }) =>
      document.querySelector(selector)?.textContent.includes(expected),
    { selector, expected },
  );
}

const submit = 'form:not(.header-search) button[type="submit"]';

test("basic edits preserve schedule and returning from step 2 saves unfinished changes", async () => {
  await open("create-opportunities-step-1", {
    impactraOpportunityDraft: draft,
  });
  await page.fill("#title", "Updated relief opportunity");
  await page.click(submit);
  await page.waitForURL("**/create-opportunities-step-2.html");
  assert.equal(await page.inputValue(".shift-start"), "09:00");
  await page.fill(".shift-start", "10:00");
  await page.click("[data-back-to]");
  await page.waitForURL("**/create-opportunities-step-1.html");
  assert.equal(await page.inputValue("#title"), "Updated relief opportunity");
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("impactraOpportunityDraft")).shifts[0]
          .startTime,
    ),
    "10:00",
  );
});

test("remote venues are hidden and whole-number capacity is required", async () => {
  await open("create-opportunities-step-1", {
    impactraOpportunityDraft: draft,
  });
  await page.check('[value="remote"]');
  assert.equal(await page.locator("#venueFields").isVisible(), false);
  await page.fill("#volunteerCapacity", "1.5");
  await page.click(submit);
  await see("#toast-host", "whole number");
  await page.fill("#volunteerCapacity", "12");
  await page.click(submit);
  await page.waitForURL("**/create-opportunities-step-2.html");
  assert.deepEqual(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("impactraOpportunityDraft")).location,
    ),
    { type: "remote", venueAddress: "", hubRegion: "" },
  );
});

test("cover uploads persist across pages and reject unsupported files", async () => {
  await open("create-opportunities-step-1", {
    impactraOpportunityDraft: { ...draft, coverImage: null },
  });
  await page.setInputFiles("#coverImage", {
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await see("#toast-host", "PNG, JPG or WebP");
  await page.setInputFiles("#coverImage", {
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(imageData.split(",")[1], "base64"),
  });
  await page.waitForSelector("#coverPreviewWrap", { state: "visible" });
  await page.click(submit);
  await page.waitForURL("**/create-opportunities-step-2.html");
  const cover = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("impactraOpportunityDraft")).coverImage,
  );
  assert.equal(cover.name, "photo.png");
  assert.equal(cover.dataUrl, imageData);
});

test("storage failure keeps the user on the form with an actionable error", async () => {
  await open("create-opportunities-step-1", {
    impactraOpportunityDraft: draft,
  });
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota", "QuotaExceededError");
    };
  });
  await page.click(submit);
  await see("#toast-host", "Unable to save your draft");
  assert.match(page.url(), /step-1/);
});

test("incomplete shifts are not silently discarded and end times are validated", async () => {
  await open("create-opportunities-step-2", {
    impactraOpportunityDraft: draft,
  });
  await page.click("#addShiftBtn");
  await page.click(submit);
  await see("#toast-host", "valid date for shift 2");
  await page.locator(".shift-row").last().locator(".shift-remove").click();
  await page.fill(".shift-end", "08:00");
  await page.click(submit);
  await see("#toast-host", "end after its start");
  await page.fill(".shift-end", "14:00");
  await page.click(submit);
  await page.waitForURL("**/create-opportunities-steps-3.html");
  await see("#reviewCredit", "5 Hours");
});

test("review uses actual draft fields, calculated hours, tasks, preview, and working edit links", async () => {
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: draft,
  });
  await see("#reviewTitle", draft.title);
  await see("#reviewCredit", "4 Hours");
  await see("#previewSpots", "10 spots open");
  assert.equal(await page.locator(".milestone-task").count(), 2);
  assert.equal(
    await page.locator("#reviewCover").getAttribute("src"),
    imageData,
  );
  assert.equal(
    await page.locator(".review-edit").first().getAttribute("href"),
    "create-opportunities-step-1.html",
  );
  await page.click("#saveReviewDraft");
  await see("#toast-host", "Draft saved");
  assert.equal(requests.length, 0);
});

test("incomplete drafts cannot be published by skipping directly to review", async () => {
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: { title: "Partial" },
  });
  await see("#flowStatus", "draft is incomplete");
  assert.equal(await page.isDisabled("#publishButton"), true);
  assert.equal(requests.length, 0);
});

test("create sends the current multipart schema, publishes, and shows the server ID", async () => {
  apiHandler = (req) => ({
    status: 200,
    body: {
      data: {
        opportunity: {
          ...record,
          status: req.path.endsWith("/create") ? "draft" : "published",
        },
      },
    },
  });
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: draft,
  });
  await page.click("#publishButton");
  await page.waitForURL("**/opportunities-success.html?id=opportunity-42");
  await see("#opportunityTitle", draft.title);
  assert.equal(await page.locator("#publishedSummary").isVisible(), true);
  assert.equal(
    await page.locator("#viewOpportunity").getAttribute("href"),
    "opportunity-details.html?id=opportunity-42",
  );
  const create = requests.find((r) => r.method === "POST");
  assert.equal(create.path, "/organization/opportunity/create");
  assert.match(create.headers["content-type"], /multipart\/form-data/);
  for (const field of [
    "volunteerCapacity",
    "location",
    "shifts",
    "requirements",
    "tasks",
    "coverImage",
  ])
    assert.ok(create.body.includes(`name="${field}"`), field);
  assert.ok(
    create.body.includes(
      '"venueAddress":"Surulere Community Hall, 14 Bishop Street"',
    ),
  );
  assert.ok(create.body.includes('filename="cover.png"'));
  assert.deepEqual(
    requests.filter((r) => r.method === "PATCH").map((r) => r.path),
    ["/organization/opportunities/opportunity-42/publish"],
  );
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("impactraOpportunityDraft"),
    ),
    null,
  );
});

test("creation errors and missing response IDs never show publication success", async () => {
  apiHandler = () => ({
    status: 500,
    body: { message: "Creation unavailable" },
  });
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: draft,
  });
  await page.click("#publishButton");
  await see("#flowStatus", "Creation unavailable");
  assert.equal(await page.isEnabled("#publishButton"), true);
  apiHandler = () => ({ status: 200, body: { message: "Created" } });
  await page.click("#publishButton");
  await see("#flowStatus", "did not return an opportunity ID");
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("impactraPublishedOpportunity"),
    ),
    null,
  );
});

test("failed publication retries the saved ID after reload without creating duplicates", async () => {
  let attempts = 0;
  apiHandler = (req) =>
    req.path.endsWith("/create")
      ? { status: 201, body: { data: { ...record, status: "draft" } } }
      : ++attempts === 1
        ? { status: 500, body: { message: "Publish unavailable" } }
        : { status: 200, body: { data: record } };
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: draft,
  });
  await page.click("#publishButton");
  await see("#flowStatus", "Publish unavailable");
  await page.reload();
  await page.click("#publishButton");
  await page.waitForURL("**/opportunities-success.html?id=opportunity-42");
  assert.equal(requests.filter((r) => r.path.endsWith("/create")).length, 1);
  assert.equal(attempts, 2);
});

test("editing a created draft updates that record before publication retry", async () => {
  let attempts = 0;
  apiHandler = (req) =>
    req.path.endsWith("/create")
      ? { status: 201, body: { data: { ...record, status: "draft" } } }
      : req.path.endsWith("/update")
        ? { status: 200, body: { data: record } }
        : ++attempts === 1
          ? { status: 500, body: { message: "Publish unavailable" } }
          : { status: 200, body: { data: record } };
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: draft,
  });
  await page.click("#publishButton");
  await see("#flowStatus", "Publish unavailable");
  await page.evaluate(() => {
    const d = JSON.parse(sessionStorage.getItem("impactraOpportunityDraft"));
    d.title = "Edited relief opportunity";
    sessionStorage.setItem("impactraOpportunityDraft", JSON.stringify(d));
  });
  await page.reload();
  await page.click("#publishButton");
  await page.waitForURL("**/opportunities-success.html?id=opportunity-42");
  assert.equal(requests.filter((r) => r.path.endsWith("/create")).length, 1);
  assert.equal(requests.filter((r) => r.path.endsWith("/update")).length, 1);
});

test("draft status and mismatched publication IDs cannot produce success", async () => {
  apiHandler = (req) => ({
    status: 200,
    body: {
      data: {
        ...record,
        _id: req.path.endsWith("/create") ? record._id : "wrong-id",
        status: "draft",
      },
    },
  });
  await open("create-opportunities-steps-3", {
    impactraOpportunityDraft: draft,
  });
  await page.click("#publishButton");
  await see("#flowStatus", "different opportunity");
  apiHandler = () => ({
    status: 200,
    body: { data: { ...record, status: "draft" } },
  });
  await page.click("#publishButton");
  await see("#flowStatus", "has not published");
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("impactraPublishedOpportunity"),
    ),
    null,
  );
});

test("success is guarded and can recover a published record by URL ID", async () => {
  await open("opportunities-success", { impactraOpportunityDraft: draft });
  await see("#successHeading", "could not be confirmed");
  assert.equal(await page.locator("#publishedSummary").isVisible(), false);
  await page.goto(`${base}pages/opportunities-success.html?id=opportunity-42`);
  await see("#opportunityTitle", draft.title);
  assert.equal(await page.locator("#publishedSummary").isVisible(), true);
});

test("list supports nested records, safe text, search, status and category filters", async () => {
  const unsafe = '<img src=x onerror="alert(1)">';
  apiHandler = () => ({
    status: 200,
    body: {
      data: {
        opportunities: [
          record,
          {
            ...record,
            _id: "remote-7",
            title: unsafe,
            category: "education",
            status: "draft",
            location: { type: "remote" },
            coverImage: null,
          },
        ],
      },
    },
  });
  await open("opportunities-list");
  await page.waitForSelector(".card");
  assert.equal(await page.locator(".card").count(), 2);
  assert.equal(
    await page.locator(".card a").first().getAttribute("href"),
    "opportunity-details.html?id=opportunity-42",
  );
  assert.equal(await page.locator(".card h2 img").count(), 0);
  await page.fill("#search", "Remote");
  assert.equal(await page.locator(".card").count(), 1);
  assert.equal(await page.locator(".card h2").textContent(), unsafe);
  await page.fill("#search", "");
  await page.click('[data-status-filter="active"]');
  assert.equal(await page.locator(".card").count(), 1);
  await page.click("#filterToggle");
  await page.selectOption("#categoryFilter", "education");
  assert.equal(await page.locator("#empty").isVisible(), true);
  await page.click("#clearFilters");
  assert.equal(await page.locator(".card").count(), 2);
});

test("list errors have a working retry and empty responses have no sample data", async () => {
  apiHandler = () => ({ status: 500, body: { message: "List unavailable" } });
  await open("opportunities-list");
  await see("#flowStatus", "List unavailable");
  assert.equal(await page.locator(".card").count(), 0);
  apiHandler = () => ({ status: 200, body: { data: [] } });
  await page.click("#flowStatus button");
  await page.waitForSelector("#empty", { state: "visible" });
  await see("#emptyHeading", "No opportunities yet");
  assert.equal(await page.locator("#empty").isVisible(), true);
  assert.equal(await page.locator("#totalCount").textContent(), "0");
});

test("header search reaches and filters the opportunity list", async () => {
  apiHandler = () => ({ status: 200, body: { data: [record] } });
  await open("create-opportunities-step-1");
  await page.fill("#workspaceSearch", "relief");
  await page.press("#workspaceSearch", "Enter");
  await page.waitForURL("**/opportunities-list.html?q=relief");
  assert.equal(await page.inputValue("#search"), "relief");
  assert.equal(await page.locator(".card").count(), 1);
});

test("URL IDs never display another cached record when the fetch fails", async () => {
  apiHandler = () => ({
    status: 404,
    body: { message: "Opportunity not found" },
  });
  await open(
    "opportunity-details",
    { impactraPublishedOpportunity: { ...record, publicationConfirmed: true } },
    true,
    "?id=another-id",
  );
  await see("#flowStatus", "Opportunity not found");
  assert.equal(await page.locator("#opportunityContent").isVisible(), false);
  assert.equal(await page.isDisabled("#applyButton"), true);
});

test("missing API never allows a fake application or publication", async () => {
  await context.route("**/API.js", (route) => route.abort());
  await open("opportunity-details", {}, true, "?id=opportunity-42");
  await see("#flowStatus", "Unable to connect");
  assert.equal(await page.isDisabled("#applyButton"), true);
  await page.goto(`${base}pages/create-opportunities-steps-3.html`);
  await page.evaluate(
    (draft) =>
      sessionStorage.setItem("impactraOpportunityDraft", JSON.stringify(draft)),
    draft,
  );
  await page.reload();
  await page.click("#publishButton");
  await see("#flowStatus", "Unable to connect");
  assert.equal(requests.length, 0);
});

test("volunteer application uses the existing endpoint and reports success only after acceptance", async () => {
  let fail = true;
  apiHandler = (req) =>
    req.method === "GET"
      ? { status: 200, body: { data: record } }
      : fail
        ? { status: 422, body: { message: "Complete your volunteer profile" } }
        : { status: 201, body: { success: true } };
  await open("opportunity-details", {}, true, "?id=opportunity-42");
  await page.waitForFunction(
    () => !document.querySelector("#applyButton").disabled,
  );
  await page.click("#applyButton");
  await see("#flowStatus", "Complete your volunteer profile");
  fail = false;
  await page.click("#applyButton");
  await see("#applyButton", "Applied");
  assert.equal(await page.isDisabled("#applyButton"), true);
  assert.deepEqual(
    requests.filter((r) => r.method === "POST").map((r) => r.path),
    [
      "/volunteer/opportunity-42/application-submit",
      "/volunteer/opportunity-42/application-submit",
    ],
  );
});

test("NGO detail view links to applications and does not offer a volunteer application action", async () => {
  await open(
    "opportunity-details",
    { impactra_user: { name: "NGO User", accountType: "organization" } },
    true,
    "?id=opportunity-42",
  );
  await page.waitForSelector("#opportunityContent", { state: "visible" });
  assert.equal(await page.locator("#applyButton").isVisible(), false);
  assert.equal(
    await page.locator("#manageApplications").getAttribute("href"),
    "../application.html",
  );
  await see("#detailRequirements", "16+ years");
  assert.equal(await page.locator("#detailTasks li").count(), 2);
});

test("closed opportunities and unsigned users cannot submit writes", async () => {
  apiHandler = () => ({
    status: 200,
    body: { data: { ...record, status: "closed" } },
  });
  await open("opportunity-details", {}, false, "?id=opportunity-42");
  await see("#flowStatus", "not accepting applications");
  assert.equal(await page.isDisabled("#applyButton"), true);
  apiHandler = () => ({ status: 200, body: { data: record } });
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector("#applyButton").disabled,
  );
  await page.click("#applyButton");
  await see("#flowStatus", "Please sign in");
  await page.evaluate(
    (draft) =>
      sessionStorage.setItem("impactraOpportunityDraft", JSON.stringify(draft)),
    draft,
  );
  await page.goto(`${base}pages/create-opportunities-steps-3.html`);
  await page.click("#publishButton");
  await see("#flowStatus", "Please sign in");
  assert.equal(requests.filter((r) => r.method !== "GET").length, 0);
});

test("mobile navigation supports opening, focus trapping, Escape and desktop resize", async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open("create-opportunities-step-1");
  assert.equal(
    await page.locator("#workspaceSidebar").evaluate((el) => el.inert),
    true,
  );
  await page.click("#openMenu");
  assert.equal(
    await page.locator("#openMenu").getAttribute("aria-expanded"),
    "true",
  );
  assert.equal(
    await page.locator("#workspace").evaluate((el) => el.inert),
    true,
  );
  await page.locator(".brand").focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "logoutBtn",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.classList.contains("brand"),
    ),
    true,
  );
  await page.press("#closeMenu", "Escape");
  assert.equal(await page.locator("#drawerOverlay").isVisible(), false);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "openMenu",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(
    () => !document.querySelector("#workspaceSidebar").inert,
  );
  assert.equal(
    await page.locator("#workspaceSidebar").evaluate((el) => el.inert),
    false,
  );
});

test("all six screens fit 375px and 768px widths and load the local Inter font", async () => {
  apiHandler = (req) =>
    req.path === "/opportunities"
      ? { status: 200, body: { data: [record] } }
      : { status: 200, body: { data: record } };
  await open("create-opportunities-step-1", {
    impactraOpportunityDraft: draft,
    impactraPublishedOpportunity: { ...record, publicationConfirmed: true },
  });
  const screens = [
    "create-opportunities-step-1",
    "create-opportunities-step-2",
    "create-opportunities-steps-3",
    "opportunities-list",
    "opportunities-success",
    "opportunity-details",
  ];
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const screen of screens) {
      await page.goto(
        `${base}pages/${screen}.html${screen === "opportunity-details" ? "?id=opportunity-42" : ""}`,
      );
      await page.evaluate(() => document.fonts.ready);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        screen + " must not overflow at " + width,
      );
      assert.equal(
        await page.evaluate(() => document.fonts.check("14px Inter")),
        true,
      );
    }
  }
});

test("all six screens have working local assets and navigation beneath a repository subpath", async () => {
  const screens = [
    "create-opportunities-step-1",
    "create-opportunities-step-2",
    "create-opportunities-steps-3",
    "opportunities-list",
    "opportunities-success",
    "opportunity-details",
  ];
  for (const screen of screens) {
    const html = await fs.readFile(
      path.join(root, "pages", screen + ".html"),
      "utf8",
    );
    assert.doesNotMatch(html, /onclick=|href="#"/);
    for (const match of html.matchAll(
      /(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g,
    )) {
      if (/^https?:/.test(match[1])) continue;
      await fs.access(path.resolve(root, "pages", match[1]));
    }
  }
});
