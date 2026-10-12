import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function filesIn(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]));
  return groups.flat().sort();
}

test("public deployment contains the static profile deliverable without admin assets or private configuration", async () => {
  const files = await filesIn(new URL("dist/public/", root));
  assert.ok(files.includes("index.html"));
  assert.ok(files.includes("assets/app.js"));
  assert.ok(files.every(file => file === "index.html" || file === "_headers" || /^(assets|public)\//.test(file)));
  assert.ok(files.every(file => !/(^|\/)(admin|\.dev\.vars|wrangler\.jsonc|node_modules)(\/|$)/.test(file)));
  const bundle = await readFile(new URL("dist/public/assets/app.js", root), "utf8");
  assert.doesNotMatch(bundle, /\/api\/admin\/|X-HyperD-CSRF|Loading Hyper D Admin/);
  assert.equal(await readFile(new URL("dist/public/index.html", root), "utf8"), await readFile(new URL("index.html", root), "utf8"));
});

test("admin deployment has its own bundles and includes the font referenced by its stylesheet", async () => {
  assert.deepEqual(await filesIn(new URL("dist/admin/", root)), [
    "_headers", "admin.css", "admin.js", "index.html", "public/GoogleSansFlex.ttf",
  ]);
  const html = await readFile(new URL("dist/admin/index.html", root), "utf8");
  assert.match(html, /src="\/admin.js"/);
  assert.doesNotMatch(html, /assets\/app\.(js|css)/);
  const css = await readFile(new URL("dist/admin/admin.css", root), "utf8");
  assert.match(css, /\/public\/GoogleSansFlex\.ttf/);
  assert.deepEqual(await readFile(new URL("dist/admin/public/GoogleSansFlex.ttf", root)),
    await readFile(new URL("public/GoogleSansFlex.ttf", root)));
});
