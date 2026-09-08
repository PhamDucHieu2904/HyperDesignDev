import assert from "node:assert/strict";
import { access, copyFile, mkdtemp, readFile, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { once } from "node:events";
import test from "node:test";
import { JSDOM, ResourceLoader, VirtualConsole } from "jsdom";
import { renderDocument } from "../scripts/html.mjs";
import { createPreviewServer } from "../scripts/preview.mjs";
import site from "../site.config.mjs";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("assets/app.css", root), "utf8");
const script = await readFile(new URL("assets/app.js", root), "utf8");

async function until(condition, message) {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  // Let React flush passive effects (including the updated keyboard listener)
  // before dispatching the next event in this production-bundle DOM test.
  await new Promise((resolve) => setTimeout(resolve, 20));
}

test("ships real HTML, metadata and a classic browser bundle without a runtime server", async () => {
  const dom = new JSDOM(html);
  try {
    const { document } = dom.window;
    assert.equal(document.title, site.title);
    assert.ok(document.querySelector('[aria-label="Caelestia bar"]'));
    assert.ok(document.querySelector('[aria-label="Caelestia desktop"]'));
    assert.match(document.body.textContent, /Explore the shell/);
    assert.match(document.body.textContent, /Hieu Pham - Designer x Developer/);
    assert.match(document.body.textContent, /I don’t just design ideas\. I engineer how they work\./);
    assert.match(document.body.textContent, /Where a Developer's logic meets a Designer's aesthetic/);
    assert.equal(document.querySelector(".portfolio-logo").getAttribute("src"), "./public/hyperd-logo.svg");
    assert.ok(document.querySelector(".wallpaper-motion"));
    assert.equal(document.querySelectorAll(".portfolio-action").length, 2);
    assert.match(document.querySelector(".portfolio-actions").textContent, /About Hyper D²/);
    assert.match(document.querySelector(".portfolio-actions").textContent, /Portfolio/);
    assert.equal(document.querySelector(".portfolio-skills"), null);
    assert.equal(document.querySelector(".desktop-stamp"), null);
    assert.equal(document.querySelector(".rainbow-mascot"), null);
    assert.match(document.querySelector('meta[property="og:image"]').content, /\/public\/og\.png$/);
    assert.equal(document.querySelectorAll("script").length, 1);
    assert.equal(document.querySelector("script").type, "");
    assert.equal(document.querySelector("script").defer, true);
    assert.doesNotThrow(() => new Script(script));
    assert.doesNotMatch(html, /_next|__next|localhost|cloudflare|type="module"|codex-preview/i);
    assert.doesNotMatch(script, /import\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket/);
    await access(new URL(".nojekyll", root));
    await access(new URL("public/CAELESTIA-LICENSE.txt", root));
    await access(new URL("public/designer-normal.otf", root));
    await access(new URL("public/designer-light.otf", root));
    assert.match(css, /font-family:Designer/);
    assert.match(css, /color:#504c47/);
    assert.match(css, /color:#79726b/);
    assert.match(css, /logo-ink-reveal/);
    assert.match(css, /prefers-reduced-motion:reduce/);
  } finally { dom.window.close(); }
});

test("all document and stylesheet assets resolve locally and under a GitHub Pages subpath", async () => {
  const dom = new JSDOM(html);
  try {
    const refs = [...dom.window.document.querySelectorAll('[src], link[rel="stylesheet"], link[rel="icon"], link[rel="preload"]')]
      .map((element) => element.getAttribute("src") ?? element.getAttribute("href"));
    for (const ref of refs) {
      assert.ok(ref.startsWith("./"), ref);
      await access(new URL(ref, new URL("index.html", root)));
      const hosted = new URL(ref, "https://example.github.io/my-cv/");
      assert.ok(hosted.pathname.startsWith("/my-cv/"), hosted.href);
    }
    for (const [, ref] of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
      await access(new URL(ref, new URL("assets/app.css", root)));
      assert.ok(new URL(ref, "https://example.github.io/my-cv/assets/app.css").pathname.startsWith("/my-cv/"));
    }
  } finally { dom.window.close(); }
});

test("social URLs preserve repository paths and can switch to a custom domain", () => {
  for (const url of ["https://example.github.io/my-cv", "https://cv.example.com/"]) {
    const base = `${url.replace(/\/$/, "")}/`;
    const dom = new JSDOM(renderDocument("<main>CV</main>", { ...site, siteUrl: url, title: 'CV <&"' }));
    try {
      assert.equal(dom.window.document.title, 'CV <&"');
      assert.equal(dom.window.document.querySelector('link[rel="canonical"]').href, base);
      assert.equal(dom.window.document.querySelector('meta[property="og:image"]').content, `${base}public/og.png`);
    } finally { dom.window.close(); }
  }
  assert.throws(() => renderDocument("", { ...site, siteUrl: "javascript:alert(1)" }));
});

for (const mode of ["file", "github-subpath"]) {
  test(`interactive shell hydrates and works using only static files (${mode})`, async () => {
    const errors = [];
    const requests = [];
    const base = mode === "file" ? root.href : "https://example.github.io/my-cv/";
    class OfflineAssets extends ResourceLoader {
      fetch(url) {
        requests.push(url);
        assert.ok(url.startsWith(base), `Unexpected external dependency: ${url}`);
        const relative = url.slice(base.length);
        assert.ok(["assets/app.css", "assets/app.js"].includes(relative), relative);
        return readFile(new URL(relative, root));
      }
    }
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (error) => errors.push(error.message));
    virtualConsole.on("error", (...args) => errors.push(args.join(" ")));
    const dom = new JSDOM(html, {
      url: new URL("index.html", base).href,
      runScripts: "dangerously", resources: new OfflineAssets(),
      pretendToBeVisual: true, virtualConsole,
      beforeParse(window) {
        window.fetch = () => { assert.fail("The static CV must not call an API"); };
      },
    });
    const { window } = dom;
    const { document } = window;
    const click = (selector) => {
      const element = document.querySelector(selector);
      assert.ok(element, `Missing control: ${selector}`);
      element.click();
    };
    const key = (value, ctrlKey = false) => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: value, ctrlKey }));
    try {
      await until(() => document.querySelector(".clock")?.textContent !== "----", "Clock did not hydrate");
      assert.equal(document.querySelectorAll(".shell").length, 1);
      assert.ok(document.querySelector(".dashboard-toggle"));
      assert.equal(document.querySelector(".workspaces .icon-button"), null);
      assert.equal(document.querySelector(".dashboard-toggle").parentElement.classList.contains("rail"), true);
      assert.equal(document.querySelector(".layout-picker").getAttribute("aria-label"), "Website layouts; drag to switch");
      key("k", true);
      await until(() => document.querySelector(".launcher-drawer"), "Ctrl+K did not open launcher");
      const search = document.querySelector(".launcher-drawer input");
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(search, "term");
      search.dispatchEvent(new window.Event("input", { bubbles: true }));
      await until(() => document.querySelectorAll(".launcher-apps button").length === 1, "Launcher search did not filter");
      assert.match(document.querySelector(".launcher-apps").textContent, /Terminal/);
      click(".launcher-apps button");
      await until(() => document.querySelector(".terminal-window"), "Terminal did not open");
      key("Escape");
      await until(() => !document.querySelector(".terminal-window"), "Escape did not close terminal");

      for (const [name, theme] of [["Graphite", "graphite"], ["Blueprint", "blueprint"], ["Sage", "sage"], ["Code Lab", "gallery"], ["Paper", "paper"]]) {
        click(`[aria-label="${name} layout"]`);
        await until(() => document.querySelector(".shell").dataset.layout === theme, `${name} layout did not apply`);
        assert.equal(document.querySelectorAll('.layout-option[aria-pressed="true"]').length, 1);
        if (name === "Sage") {
          assert.equal(document.querySelectorAll(".design-card").length, 3);
          for (const image of document.querySelectorAll(".design-card img")) await access(new URL(image.getAttribute("src"), root));
          assert.deepEqual(
            [...document.querySelectorAll(".design-card img")].map((image) => image.getAttribute("src")),
            ["./public/vinut-coco-boba-label.webp", "./public/coco-boba-poster.webp", "./public/nam-viet-group-booth.webp"],
          );
          assert.match(document.querySelector(".design-card--label").textContent, /Vinut coco boba\.ai/);
          assert.match(document.querySelector(".design-card--retouch").textContent, /Coco boba tini world\.psd/);
          assert.equal(document.querySelector('img[src="./public/sage-studio.png"]'), null);
        }
        if (name === "Blueprint" || name === "Code Lab") {
          const portrait = document.querySelector(".android-portrait");
          await access(new URL(portrait.getAttribute("src"), root));
          if (name === "Blueprint") assert.match(portrait.style.maskImage, /^url\(data:image\/png;base64,/);
          else {
            assert.equal(document.querySelectorAll(".code-panel").length, 4);
            assert.equal(document.querySelectorAll(".binary-matrix").length, 0);
            assert.equal(document.querySelectorAll(".developer-particles i").length, 14);
            const codeBackdrop = document.querySelector('.developer-code-backdrop img[src="./public/code-field.svg"]');
            assert.ok(codeBackdrop);
            await access(new URL(codeBackdrop.getAttribute("src"), root));
          }
        }
      }
      const paper = document.querySelector('[aria-label="Paper layout"]');
      paper.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await until(() => document.querySelector('.shell[data-layout="graphite"]'), "Arrow key did not select next layout");
      assert.equal(document.activeElement.getAttribute("aria-label"), "Graphite layout");
      if (mode !== "file") assert.equal(window.localStorage.getItem("hyperd-layout"), "2");
      click('[aria-label="Open dashboard"]');
      await until(() => document.querySelector(".dashboard-drawer"), "Dashboard did not open");
      key("Escape");
      await until(() => !document.querySelector(".dashboard-drawer"), "Dashboard did not close");

      click('[aria-label="Power menu"]');
      await until(() => document.querySelector(".session-gif img"), "Power menu did not open");
      const companion = document.querySelector(".session-gif img").getAttribute("src");
      await access(new URL(companion, root));
      assert.ok(new URL(companion, base).href.startsWith(base));
      key("Escape");
      await until(() => !document.querySelector(".session-drawer"), "Power menu did not close");

      click('[aria-label="Open Feishin"]');
      await until(() => document.querySelector(".music-window"), "Music window did not open");
      click('.transport [aria-label="Play"]');
      await until(() => document.querySelector('.transport [aria-label="Pause"]'), "Play did not update state");
      click(".now-track");
      await until(() => document.querySelector(".media-popout"), "Media popout did not open");
      assert.match(document.querySelector(".media-popout").textContent, /Playing/);
      key("Escape");
      await until(() => !document.querySelector(".media-popout"), "Media popout did not close");
      key("Escape");
      await until(() => !document.querySelector(".music-window"), "Music window did not close");

      key("k", true);
      await until(() => document.querySelector(".launcher-apps"), "Launcher did not reopen");
      [...document.querySelectorAll(".launcher-apps button")].find((button) => button.textContent.includes("Files")).click();
      await until(() => document.querySelector(".files-window"), "Files window did not open");
      assert.match(document.querySelector(".files-window").textContent, /Resume.pdf/);
      click('[aria-label="Close files"]');
      await until(() => !document.querySelector(".files-window"), "Files window did not close");
      assert.equal(requests.length, 2);
      assert.deepEqual(errors, [], "Hydration or script errors occurred");
    } finally { window.close(); }
  });
}

test("optional preview serves only static deliverables and supports HEAD", async () => {
  const server = createPreviewServer(fileURLToPath(root));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await (await fetch(origin)).text(), html);
    const response = await fetch(`${origin}/assets/app.js`, { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /javascript/);
    assert.equal(await response.text(), "");
    for (const path of ["/.git/config", "/package.json", "/app/page.tsx", "/public/%2e%2e%5cpackage.json", "/missing"]) {
      assert.equal((await fetch(origin + path)).status, 404, path);
    }
    assert.equal((await fetch(origin, { method: "POST" })).status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Windows launcher handles a different working directory and missing files", { skip: process.platform !== "win32" }, async () => {
  const scratch = await mkdtemp(join(tmpdir(), "cv-launcher-test-"));
  const original = fileURLToPath(new URL("Mo-Website.bat", root));
  const copy = join(scratch, "Mo-Website.bat");
  const check = (file) => spawnSync("cmd.exe", ["/d", "/s", "/c", `""${file}" --check"`], {
    cwd: scratch, encoding: "utf8", windowsHide: true, windowsVerbatimArguments: true, timeout: 5000,
  });
  try {
    const ready = check(original);
    assert.equal(ready.status, 0, ready.stderr);
    assert.match(ready.stdout, /Static website is ready/);
    await copyFile(original, copy);
    const missing = check(copy);
    assert.equal(missing.status, 1, missing.stderr);
    assert.match(missing.stdout, /Website files are missing/);
  } finally {
    // Only remove our single temporary copy and its now-empty test directory.
    await unlink(copy).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await rmdir(scratch);
  }
});
