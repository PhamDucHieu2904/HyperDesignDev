import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";

const result = await build({ entryPoints: ["shared/contracts/admin.ts"], bundle: true, write: false, platform: "node", format: "cjs", target: "node22" });
const module = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, () => { throw new Error("Unexpected runtime dependency"); });
const contracts = module.exports;

const metadata = {
  categoryId: "illustrator", title: "Admin contract", shortTitle: "Admin contract",
  subtitle: "Contract test", thumbnailAssetId: "asset-thumb", tags: [], tools: [], isFeatured: false, sortOrder: 10,
};

test("admin draft input keeps metadata and document validation in the admin contract", () => {
  const valid = contracts.validateSaveProjectDraftInput({ expectedVersion: 1, metadata, document: { schemaVersion: 1, blocks: [] } });
  assert.equal(valid.ok, true);
  const invalid = contracts.validateSaveProjectDraftInput({ expectedVersion: 0, metadata, document: { schemaVersion: 1, blocks: [] } });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some(issue => issue.path === "$.expectedVersion"));
});

test("admin publish and revision restore inputs require safe positive versions", () => {
  assert.equal(contracts.validatePublishProjectInput({ expectedVersion: 2, requestId: "publish-2" }).ok, true);
  assert.equal(contracts.validatePublishProjectInput({ expectedVersion: 2, requestId: "bad request" }).ok, false);
  assert.equal(contracts.validateRestoreProjectRevisionInput({ expectedVersion: 3 }).ok, true);
  assert.equal(contracts.validateRestoreProjectRevisionInput({ expectedVersion: 0 }).ok, false);
});
