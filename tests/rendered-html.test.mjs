import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Caelestia portfolio shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Hieu Pham — Caelestia Portfolio Shell<\/title>/i);
  assert.match(html, /aria-label="Desktop controls"/);
  assert.match(html, /aria-label="Caelestia dashboard"/);
  assert.match(html, /Hieu Pham/);
  assert.match(html, /Caelestia Web/);
  assert.match(html, /Ho Chi Minh City/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("ships the local visual assets and finished metadata", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"use client"/);
  assert.match(page, /Ctrl K/);
  assert.match(page, /NotificationSidebar/);
  assert.match(layout, /generateMetadata/);
  assert.match(layout, /summary_large_image/);
  assert.match(packageJson, /"lucide-react"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await Promise.all([
    access(new URL("../public/caelestia-wallpaper.webp", import.meta.url)),
    access(new URL("../public/caelestia-logo.svg", import.meta.url)),
    access(new URL("../public/GoogleSansFlex.ttf", import.meta.url)),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/CAELESTIA-LICENSE.txt", import.meta.url)),
  ]);
});
