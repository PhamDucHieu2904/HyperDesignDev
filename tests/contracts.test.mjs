import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["shared/contracts/index.ts"], bundle: true, write: false, platform: "node", format: "cjs", target: "node22" });
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, () => { throw new Error("Unexpected runtime dependency"); });
const contracts = module.exports;

test("accepts an empty article and valid metadata", () => {
  assert.deepEqual(contracts.validateArticleDocument({ schemaVersion: 1, blocks: [] }), {
    ok: true, value: { schemaVersion: 1, blocks: [] },
  });
  const metadata = {
    categoryId: "illustrator", title: "Label system", shortTitle: "Label", subtitle: "Packaging work",
    thumbnailAssetId: "asset-thumb", tags: ["packaging"], tools: ["Illustrator"], isFeatured: false, sortOrder: 10,
  };
  assert.equal(contracts.validateProjectMetadata(metadata).ok, true);
  assert.equal(contracts.validateSaveProjectDraftInput({ expectedVersion: 1, metadata, document: contracts.emptyArticleDocument }).ok, true);
});

test("rejects unsupported categories, unsafe links and duplicate block IDs", () => {
  const invalidMetadata = contracts.validateProjectMetadata({ categoryId: "ai", title: "x", shortTitle: "x", subtitle: "x", thumbnailAssetId: "asset", tags: [], tools: [], isFeatured: false, sortOrder: 0 });
  assert.equal(invalidMetadata.ok, false);
  const invalidDocument = contracts.validateArticleDocument({ schemaVersion: 1, blocks: [
    { id: "same", type: "heading", level: 2, text: "Title" },
    { id: "same", type: "links", items: [{ label: "Bad", url: "javascript:alert(1)" }] },
  ] });
  assert.equal(invalidDocument.ok, false);
  assert.ok(invalidDocument.issues.some(issue => issue.message.includes("unique")));
  assert.ok(invalidDocument.issues.some(issue => issue.message.includes("http")));
});

test("limits nested columns and collects referenced media", () => {
  const deeplyNested = {
    id: "level-1", type: "columns", columns: [[
      { id: "level-2", type: "columns", columns: [[
        { id: "level-3", type: "columns", columns: [[], []] },
      ], []] },
    ], []],
  };
  const invalid = contracts.validateArticleDocument({ schemaVersion: 1, blocks: [deeplyNested] });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some(issue => issue.message.includes("two levels")));

  const document = { schemaVersion: 1, blocks: [
    { id: "hero", type: "image", assetId: "asset-hero", alt: "Hero", fit: "contain" },
    { id: "video", type: "video", assetId: "asset-video", posterAssetId: "asset-poster" },
    { id: "gallery", type: "gallery", columns: 2, items: [{ assetId: "asset-hero", alt: "Again" }] },
  ] };
  const valid = contracts.validateArticleDocument(document);
  assert.equal(valid.ok, true);
  assert.deepEqual(contracts.collectArticleAssetIds(valid.value), ["asset-hero", "asset-video", "asset-poster"]);
});

test("generated portfolio seed conforms to the shared contracts", async () => {
  const manifest = JSON.parse(await readFile(new URL("../db/seeds/portfolio-seed.json", import.meta.url), "utf8"));
  assert.equal(manifest.projects.length, 6);
  for (const project of manifest.projects) {
    assert.equal(contracts.validateProjectMetadata(project.metadata).ok, true, `${project.id} metadata is invalid`);
    assert.equal(contracts.validateArticleDocument(project.document).ok, true, `${project.id} document is invalid`);
  }
});
