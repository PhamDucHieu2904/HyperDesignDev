import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const publicBase = process.env.HYPERD_PUBLIC_BASE ?? "https://hyperd-public-staging.hieu-caelestia-portfolio.workers.dev";
const seed = JSON.parse(await readFile(new URL("../db/seeds/portfolio-seed.json", import.meta.url), "utf8"));

async function json(path) {
  const response = await fetch(`${publicBase}${path}`, { headers: { Accept: "application/json" } });
  assert.equal(response.status, 200, `${path} must return 200.`);
  return response.json();
}

const page = await json("/api/v1/projects?limit=48");
assert.equal(page.nextCursor, null, "The migration fixture must fit in one page.");
const migratedItems = seed.projects.map(expected => page.items.find(project => project.id === expected.id));
assert.ok(migratedItems.every(Boolean), "Every MIG-01 project must remain published; later Admin content may coexist.");
assert.deepEqual(migratedItems.map(project => project.id), seed.projects.map(project => project.id), "MIG-01 project mapping must match the seed manifest.");

const mediaById = new Map(seed.media.map(asset => [asset.id, asset]));
for (const expected of seed.projects) {
  const summary = page.items.find(project => project.id === expected.id);
  assert.ok(summary, `Missing project ${expected.id}.`);
  for (const field of ["slug", "categoryId", "title", "shortTitle", "subtitle", "isFeatured", "sortOrder", "contentState", "revisionId"]) {
    const expectedValue = field === "categoryId" ? expected.metadata.categoryId :
      Object.hasOwn(expected.metadata, field) ? expected.metadata[field] : expected[field];
    assert.deepEqual(summary[field], expectedValue, `${expected.id}.${field} must match the seed manifest.`);
  }

  const detail = await json(`/api/v1/projects/${encodeURIComponent(expected.id)}`);
  assert.deepEqual(detail.document, expected.document, `${expected.id}.document must preserve the authored blocks.`);
  assert.deepEqual(detail.tags, expected.metadata.tags, `${expected.id}.tags must be preserved.`);
  assert.deepEqual(detail.tools, expected.metadata.tools, `${expected.id}.tools must be preserved.`);
  assert.equal(detail.role, expected.metadata.role, `${expected.id}.role must be preserved.`);
  assert.equal(detail.year, expected.metadata.year, `${expected.id}.year must be preserved.`);
  assert.deepEqual(detail.media.map(asset => asset.id).sort(), [...expected.assetIds].sort(), `${expected.id}.media must match its revision assets.`);
}

for (const expected of seed.media) {
  const response = await fetch(`${publicBase}/media/${encodeURIComponent(expected.id)}`);
  assert.equal(response.status, 200, `Media ${expected.id} must be public.`);
  assert.match(response.headers.get("content-type") ?? "", new RegExp(`^${expected.mime.replace("+", "\\+")}`), `Media ${expected.id} must keep its MIME type.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.byteLength, expected.bytes, `Media ${expected.id} must keep its byte length.`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.checksum, `Media ${expected.id} must keep its checksum.`);
  assert.ok(mediaById.has(expected.id));
}

const ready = seed.projects.filter(project => project.contentState === "ready");
const empty = seed.projects.filter(project => project.contentState === "empty");
assert.equal(ready.length, 3, "MIG-01 must publish three authored projects.");
assert.ok(ready.every(project => project.document.blocks.length === 7), "Each authored project must retain seven blocks.");
assert.equal(empty.length, 3, "MIG-01 must publish three placeholders.");
assert.ok(empty.every(project => project.document.blocks.length === 0), "Placeholders must not invent article content.");

console.log(`Verified MIG-01 on ${publicBase}: ${ready.length} authored projects, ${empty.length} empty placeholders, ${seed.media.length} byte-identical media assets.`);
