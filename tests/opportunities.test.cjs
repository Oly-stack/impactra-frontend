/* Real-browser regressions. API responses are isolated fixtures, never live writes. */
const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const prefix = "/impactra-frontend/";
const draft = {
  title: "Community Learning Volunteers", category: "Volunteering", location: "Lagos, Nigeria",
  description: "Help learners build practical skills in our community.", type: "On-site",
  startDate: "2099-11-01", endDate: "2099-11-02", deadline: "2099-10-25", slots: 5,
  requirements: "Comfortable supporting a small group of learners.", benefits: "",
};
const record = { ...draft, _id: "opportunity-42", status: "published" };
let server, browser, base, context, page, requests, apiHandler, pageErrors;

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const target = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)));
    if (!url.pathname.startsWith(prefix) || !target.startsWith(root + path.sep)) {
      res.writeHead(404).end(); return;
    }
    try {
      const data = await fs.readFile(target);
      const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
      res.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream" }).end(data);
    } catch (_) { res.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
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
  await context.route("https://impactra-api-dev.onrender.com/api/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      } });
      return;
    }
    const item = { method, path: url.pathname.replace("/api/v1", ""), body: request.postData(), headers: request.headers() };
    requests.push(item);
    const response = await apiHandler(item);
    await route.fulfill({ status: response.status, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(response.body) });
  });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

afterEach(async () => {
  await context?.close();
  assert.deepEqual(pageErrors, [], "Opportunity screens must have no uncaught JavaScript errors");
});

async function open(name, seed = {}, authenticated = true, query = "") {
  await context.addInitScript(({ seed, authenticated }) => {
    if (!sessionStorage.getItem("qa-initialized")) {
      sessionStorage.setItem("qa-initialized", "true");
      for (const [key, value] of Object.entries(seed)) sessionStorage.setItem(key, JSON.stringify(value));
    }
    if (authenticated) localStorage.setItem("impactra_token", "qa-token");
    else localStorage.removeItem("impactra_token");
  }, { seed, authenticated });
  await page.goto(`${base}pages/${name}.html${query}`);
}

async function see(selector, expected) {
  await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.textContent.includes(expected), { selector, expected });
}

test("draft edits preserve step 2 and all Back buttons resolve", async () => {
  await open("create-opportunities-step-1", { impactraOpportunityDraft: draft });
  await page.fill("#title", "Updated Community Opportunity");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/create-opportunities-step-2.html");
  assert.equal(await page.inputValue("#requirements"), draft.requirements);
  await page.click("[data-back-to]");
  await page.waitForURL("**/create-opportunities-step-1.html");
  assert.equal(await page.inputValue("#title"), "Updated Community Opportunity");
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("impactraOpportunityDraft")));
  assert.equal(saved.slots, 5);
  assert.equal(saved.endDate, draft.endDate);
});

test("creation sends multipart data, publishes, and displays the returned ID and summary", async () => {
  apiHandler = (req) => ({ status: 200, body: { data: { ...record, status: req.path.endsWith("/create") ? "draft" : "published" } } });
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft });
  await page.click("#publishButton");
  await page.waitForURL("**/opportunities-success.html?id=opportunity-42");
  await see("#opportunityTitle", draft.title);
  assert.equal(await page.locator("#publishedSummary").isVisible(), true);
  assert.equal(await page.locator("#viewOpportunity").getAttribute("href"), "opportunity-details.html?id=opportunity-42");
  assert.deepEqual(requests.map((r) => [r.method, r.path]), [
    ["POST", "/organization/opportunity/create"], ["PATCH", "/organization/opportunities/opportunity-42/publish"],
  ]);
  assert.match(requests[0].headers["content-type"], /^multipart\/form-data; boundary=/);
  assert.match(requests[0].body, /name="title"/);
  assert.match(requests[0].body, /Community Learning Volunteers/);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("impactraOpportunityDraft")), null);
});

test("missing API script cannot report a publication or clear the draft", async () => {
  await context.route("**/API.js", (route) => route.abort());
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft });
  await page.click("#publishButton");
  await see("#flowStatus", "Unable to connect");
  assert.match(page.url(), /create-opportunities-steps-3/);
  assert.equal(requests.length, 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("impactraPublishedOpportunity")), null);
  assert.ok(await page.evaluate(() => sessionStorage.getItem("impactraOpportunityDraft")));
});

test("failed creation and missing response IDs never show success", async () => {
  apiHandler = () => ({ status: 500, body: { message: "Creation unavailable" } });
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft });
  await page.click("#publishButton");
  await see("#flowStatus", "Creation unavailable");
  assert.equal(await page.isEnabled("#publishButton"), true);
  apiHandler = () => ({ status: 200, body: { message: "Created" } });
  await page.click("#publishButton");
  await see("#flowStatus", "did not return an opportunity ID");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("impactraPublishedOpportunity")), null);
  assert.match(page.url(), /create-opportunities-steps-3/);
});

test("a failed publication retries the saved ID without creating duplicate records", async () => {
  let publishAttempts = 0;
  apiHandler = (req) => {
    if (req.path.endsWith("/create")) return { status: 201, body: { data: { ...record, status: "draft" } } };
    publishAttempts++;
    return publishAttempts === 1 ? { status: 500, body: { message: "Publish unavailable" } } : { status: 200, body: { data: record } };
  };
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft });
  await page.click("#publishButton");
  await see("#flowStatus", "Publish unavailable");
  await page.reload();
  await page.click("#publishButton");
  await page.waitForURL("**/opportunities-success.html?id=opportunity-42");
  assert.equal(requests.filter((r) => r.path.endsWith("/create")).length, 1);
  assert.equal(publishAttempts, 2);
});

test("success page cannot show a success state for an unpublished draft", async () => {
  await open("opportunities-success", { impactraOpportunityDraft: draft });
  await see("#successHeading", "could not be confirmed");
  assert.equal(await page.locator("#publishedSummary").isVisible(), false);
});

test("success page can recover by ID when its saved summary is unavailable", async () => {
  await open("opportunities-success", {}, true, "?id=opportunity-42");
  await see("#opportunityTitle", draft.title);
  assert.equal(await page.locator("#publishedSummary").isVisible(), true);
});

test("listing renders real records, safe text, search, and ID-based detail links", async () => {
  const title = '<img src=x onerror="alert(1)">';
  apiHandler = () => ({ status: 200, body: { data: { opportunities: [record, { ...record, _id: "remote-7", title, location: "Remote" }] } } });
  await open("opportunities-list");
  await page.waitForSelector(".card");
  assert.equal(await page.locator(".card").count(), 2);
  assert.equal(await page.locator(".card a").first().getAttribute("href"), "opportunity-details.html?id=opportunity-42");
  assert.equal(await page.locator(".card img").count(), 0);
  await page.fill("#search", "Remote");
  assert.equal(await page.locator(".card").count(), 1);
  assert.equal(await page.locator(".card h2").textContent(), title);
  await page.fill("#search", "no match");
  assert.equal(await page.locator("#empty").isVisible(), true);
});

test("list errors show a working retry and an empty response has no sample cards", async () => {
  apiHandler = () => ({ status: 500, body: { message: "List unavailable" } });
  await open("opportunities-list");
  await see("#flowStatus", "List unavailable");
  assert.equal(await page.locator(".card").count(), 0);
  apiHandler = () => ({ status: 200, body: { data: [] } });
  await page.click("#flowStatus button");
  await page.waitForSelector("#empty", { state: "visible" });
  await see("#empty", "No opportunities are available");
  assert.equal(await page.locator("#empty").isVisible(), true);
});

test("URL IDs cannot fall back to a different cached opportunity", async () => {
  apiHandler = () => ({ status: 404, body: { message: "Opportunity not found" } });
  await open("opportunity-details", { impactraPublishedOpportunity: { ...record, publicationConfirmed: true } }, true, "?id=another-id");
  await see("#flowStatus", "Opportunity not found");
  assert.equal(await page.locator("#opportunityContent").isVisible(), false);
  assert.equal(await page.isDisabled("#applyButton"), true);
});

test("details without a record or API cannot submit a fake application", async () => {
  await context.route("**/API.js", (route) => route.abort());
  await open("opportunity-details", { impactraPublishedOpportunity: { ...record, publicationConfirmed: true } }, true, "?id=opportunity-42");
  await see("#flowStatus", "Unable to connect");
  assert.equal(await page.isDisabled("#applyButton"), true);
  assert.equal(requests.length, 0);
  assert.equal(await page.locator("#applyButton").textContent(), "Apply for Opportunity");
});

test("applications use the volunteer endpoint and only show Applied after success", async () => {
  let fail = true;
  apiHandler = (req) => req.method === "GET" ? { status: 200, body: { data: record } }
    : fail ? { status: 422, body: { message: "Complete your volunteer profile" } }
    : { status: 201, body: { success: true } };
  await open("opportunity-details", {}, true, "?id=opportunity-42");
  await page.waitForFunction(() => !document.querySelector("#applyButton").disabled);
  await page.click("#applyButton");
  await see("#flowStatus", "Complete your volunteer profile");
  assert.equal(await page.isEnabled("#applyButton"), true);
  fail = false;
  await page.click("#applyButton");
  await see("#applyButton", "Applied");
  assert.equal(await page.isDisabled("#applyButton"), true);
  assert.deepEqual(requests.filter((r) => r.method === "POST").map((r) => r.path), [
    "/volunteer/opportunity-42/application-submit", "/volunteer/opportunity-42/application-submit",
  ]);
});

test("closed opportunities keep application submission disabled", async () => {
  apiHandler = () => ({ status: 200, body: { data: { ...record, status: "closed" } } });
  await open("opportunity-details", {}, true, "?id=opportunity-42");
  await see("#flowStatus", "not accepting applications");
  assert.equal(await page.isDisabled("#applyButton"), true);
});

test("unsigned users cannot create or apply", async () => {
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft }, false);
  await page.click("#publishButton");
  await see("#flowStatus", "Please sign in");
  assert.equal(requests.length, 0);
  await page.goto(`${base}pages/opportunity-details.html?id=opportunity-42`);
  await page.waitForFunction(() => !document.querySelector("#applyButton").disabled);
  await page.click("#applyButton");
  await see("#flowStatus", "Please sign in");
  assert.equal(requests.filter((request) => request.method !== "GET").length, 0);
});

test("step 2 accepts optional benefits and validates dates and whole-number capacity", async () => {
  await open("create-opportunities-step-2", { impactraOpportunityDraft: draft });
  await page.fill("#slots", "1.5");
  await page.evaluate(() => document.querySelector("#detailsForm").dispatchEvent(new Event("submit", { cancelable: true })));
  await see("#toast-host", "whole number");
  await page.fill("#slots", "12");
  await page.fill("#endDate", "2099-10-30");
  await page.evaluate(() => document.querySelector("#detailsForm").dispatchEvent(new Event("submit", { cancelable: true })));
  await see("#toast-host", "End date cannot");
  await page.fill("#endDate", "2099-11-02");
  await page.fill("#benefits", "");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/create-opportunities-steps-3.html");
  assert.equal(await page.isEnabled("#publishButton"), true);
});

test("a server response that remains a draft cannot produce a publication success", async () => {
  apiHandler = () => ({ status: 200, body: { data: { ...record, status: "draft" } } });
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft });
  await page.click("#publishButton");
  await see("#flowStatus", "has not published");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("impactraPublishedOpportunity")), null);
});

test("a mismatched publication ID cannot replace the opportunity being published", async () => {
  apiHandler = (request) => ({ status: 200, body: { data: {
    ...record, _id: request.path.endsWith("/create") ? record._id : "wrong-opportunity",
    status: request.path.endsWith("/create") ? "draft" : "published",
  } } });
  await open("create-opportunities-steps-3", { impactraOpportunityDraft: draft });
  await page.click("#publishButton");
  await see("#flowStatus", "different opportunity");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("impactraPublishedOpportunity")), null);
});

test("mobile opportunity screens fit a 375px viewport", async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  apiHandler = (req) => req.path === "/opportunities" ? { status: 200, body: { data: [record] } } : { status: 200, body: { data: record } };
  for (const screen of ["create-opportunities-step-1", "create-opportunities-step-2", "create-opportunities-steps-3", "opportunities-list", "opportunity-details?id=opportunity-42"]) {
    const [name, query] = screen.split("?");
    await open(name, { impactraOpportunityDraft: draft }, true, query ? "?" + query : "");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), screen + " must not overflow horizontally");
  }
});

test("all six screens load their scripts/styles and local links from the project subpath", async () => {
  const screens = ["create-opportunities-step-1", "create-opportunities-step-2", "create-opportunities-steps-3", "opportunities-list", "opportunities-success", "opportunity-details"];
  for (const screen of screens) {
    const html = await fs.readFile(path.join(root, "pages", screen + ".html"), "utf8");
    assert.doesNotMatch(html, /onclick=|href="#"/);
    for (const match of html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)) {
      if (/^https?:/.test(match[1])) continue;
      const target = path.resolve(root, "pages", match[1]);
      await fs.access(target);
    }
  }
});
