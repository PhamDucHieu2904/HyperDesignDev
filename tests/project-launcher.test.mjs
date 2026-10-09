import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

const compiled = await build({ entryPoints: ["app/project-launcher/request.ts"], bundle: true, write: false, platform: "node", format: "cjs" });
const requestModule = { exports: {} };
new Function("module", "exports", compiled.outputFiles[0].text)(requestModule, requestModule.exports);
const { emptyDraft, validateDraft, sendProjectRequest, isRequestConfigured } = requestModule.exports;
const endpoint = "https://formspree.io/f/testform";
const validDraft = () => ({ ...emptyDraft(), projectDescription: "  A website to showcase my packaging designs.  ", email: "  customer@example.com  " });

test("validates trimmed idea boundaries, email and optional budget/context", () => {
  assert.ok(validateDraft(emptyDraft(), 0).projectDescription);
  assert.deepEqual(validateDraft({ ...validDraft(), projectDescription: "x".repeat(15) }, 2), {});
  assert.ok(validateDraft({ ...validDraft(), projectDescription: "x".repeat(3001) }, 2).projectDescription);
  for (const email of ["", "person@", "person@example", "a b@example.com", "a@example.com\nother@example.com"]) {
    assert.ok(validateDraft({ ...validDraft(), email }, 2).email, email);
  }
  assert.deepEqual(validateDraft(validDraft(), 2), {});
  assert.deepEqual(validateDraft({ ...validDraft(), budgetMode: "specified", budgetText: "" }, 2), {});
  assert.ok(validateDraft({ ...validDraft(), budgetMode: "specified", budgetText: "x".repeat(121) }, 2).budgetText);
});

test("missing configuration and honeypot never make a request or claim success", async () => {
  let calls = 0;
  const transport = async () => { calls++; return new Response('{"ok":true}'); };
  for (const url of ["", "http://formspree.io/f/test", "https://example.com/form", "https://formspree.io/f/test?secret=x"]) {
    assert.equal(isRequestConfigured(url), false);
    await assert.rejects(sendProjectRequest(validDraft(), url, transport), error => error.status === "not-configured");
  }
  await assert.rejects(sendProjectRequest({ ...validDraft(), honeypot: "bot" }, endpoint, transport));
  await assert.rejects(sendProjectRequest(emptyDraft(), endpoint, transport));
  assert.equal(calls, 0);
});

test("real transport maps a minimal payload and only accepts a provider acknowledgment", async () => {
  await sendProjectRequest({ ...validDraft(), budgetText: "old hidden budget" }, endpoint, async (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.redirect, "error");
    const data = JSON.parse(options.body);
    assert.equal(data.email, "customer@example.com");
    assert.equal(data.projectDescription, "A website to showcase my packaging designs.");
    assert.equal(data.budgetText, "");
    assert.equal(data._gotcha, "");
    assert.equal(data.source, "hyperdesigndev-project-launcher");
    return new Response('{"ok":true}', { status: 200 });
  });
  for (const response of [new Response('no', { status: 500 }), new Response('rate limit', { status: 429 }),
    new Response('<html>Captcha</html>')]) {
    await assert.rejects(sendProjectRequest(validDraft(), endpoint, async () => response), error => error.status === "server-error");
  }
  await assert.rejects(sendProjectRequest(validDraft(), endpoint, async () => { throw new TypeError("Offline"); }));
});

// Test-only bundle replaces the public config. No mock transport/config enters the shipped app.
const browser = await build({ entryPoints: ["app/main.tsx"], bundle: true, write: false, format: "iife", platform: "browser",
  jsx: "automatic", loader: { ".png": "dataurl" }, define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "test-form-config", setup(builder) {
    builder.onLoad({ filter: /project-launcher[\\/]config\.ts$/ }, () => ({ contents: `export const projectRequestEndpoint = ${JSON.stringify(endpoint)};`, loader: "ts" }));
  } }],
});
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
async function until(condition, message) {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(message);
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  await new Promise(resolve => setTimeout(resolve, 20));
}

test("shell form preserves draft, disables duplicate sends, retries errors and resets only on request", async () => {
  const logs = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => logs.push(error.message));
  let finish;
  let calls = 0;
  const dom = new JSDOM(html, { url: "https://example.github.io/HyperDesignDev/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole });
  const { window } = dom;
  const { document } = window;
  window.fetch = async () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  window.eval(browser.outputFiles[0].text);
  const click = selector => { const target = document.querySelector(selector); assert.ok(target, selector); target.click(); };
  const fill = (selector, value) => {
    const target = document.querySelector(selector);
    const prototype = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(target, value);
    target.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  try {
    await until(() => document.querySelector('.rail-calendar time').dateTime, "Hydration failed");
    click('[data-open-project]');
    await until(() => document.querySelector('.project-form'), "Project form did not open");
    assert.equal(document.activeElement.textContent, "What would you like to create?");
    click('.project-primary');
    await until(() => document.querySelector('[aria-invalid="true"]'), "Idea validation failed");
    fill('#project-idea', validDraft().projectDescription);
    await until(() => document.querySelector('#project-idea').value.includes('showcase'), "Idea did not update");
    click('.project-primary');
    await until(() => document.querySelector('.project-budget-options'), "Budget did not open");
    click('.project-text-button');
    await until(() => document.querySelector('#project-email'), "Skip budget failed");
    click('.project-primary');
    await until(() => document.querySelector('#project-email').getAttribute('aria-invalid') === 'true', "Email validation failed");
    fill('#project-email', 'customer@example.com');
    await until(() => document.querySelector('#project-email').value === 'customer@example.com', "Email did not update");
    document.querySelector('[data-open-project]').focus();
    click('[aria-label="Minimize Hyper D² / new-project"]');
    await until(() => !document.querySelector('.project-window'), "Desktop did not close form");
    click('[data-open-project]');
    await until(() => document.querySelector('#project-email'), "Draft did not reopen at Contact");
    assert.equal(document.querySelector('#project-email').value, 'customer@example.com');
    assert.match(document.querySelector('.project-summary').textContent, /showcase my packaging/);
    assert.deepEqual(Object.keys(window.localStorage), [], "Draft leaked to persistent storage");
    click('.project-primary');
    await until(() => calls === 1, "Request not submitted");
    assert.equal(document.querySelector('.project-primary').disabled, true);
    document.querySelector('.project-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(calls, 1, "Duplicate request was sent");
    assert.equal(document.querySelector('.project-success'), null);
    finish(new Response('{"error":"Unavailable"}', { status: 503 }));
    await until(() => document.querySelector('.project-notice'), "Server error did not render");
    assert.equal(document.querySelector('#project-email').value, 'customer@example.com');
    assert.equal(document.querySelector('.project-success'), null);
    click('.project-primary');
    await until(() => calls === 2, "Retry failed");
    click('[aria-label="Minimize Hyper D² / new-project"]');
    await until(() => !document.querySelector('.project-window'), "Minimize failed");
    finish(new Response('{"ok":true}', { status: 200 }));
    click('[data-open-project]');
    await until(() => document.querySelector('.project-success'), "Confirmed receipt did not show success after reopening");
    assert.match(document.querySelector('.project-success').textContent, /customer@example.com/);
    const reset = [...document.querySelectorAll('.project-success button')].find(button => button.textContent === 'Start another idea');
    reset.click();
    await until(() => document.querySelector('#project-idea'), "New request did not reset");
    assert.equal(document.querySelector('#project-idea').value, '');
    window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    await until(() => !document.querySelector('.project-window'), "Escape did not close form");
    assert.equal(document.activeElement, document.querySelector('[data-open-project]'));
    assert.deepEqual(logs, []);
  } finally { window.close(); }
});
