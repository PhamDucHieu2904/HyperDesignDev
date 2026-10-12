import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { prepareQuenchaImport } from "../scripts/import-quencha.mjs";
import { prepareUniformImport } from "../scripts/import-uniform.mjs";

test("Uniform collection belongs to Visual, ends with thanks and preserves existing content on import and replay", async () => {
  const { content, sql } = await prepareUniformImport();
  assert.equal(content.metadata.categoryId, "photoshop");
  assert.equal(content.metadata.thumbnailAssetId, "uniform-thumbnail");
  assert.equal(content.media.length, 8);
  assert.deepEqual(content.document.blocks.filter(block => block.type === "image").map(block => block.assetId),
    Array.from({ length: 7 }, (_, index) => `uniform-artboard-${index + 1}`));
  assert.equal(content.document.blocks.at(-2).text, "Thank you for watching");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(await readFile(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8"));
    db.exec(await readFile(new URL("../db/seeds/portfolio-seed.sql", import.meta.url), "utf8"));
    db.exec((await prepareQuenchaImport()).sql);
    const tables = ["projects", "public_projects", "media_assets", "project_revisions", "draft_assets", "revision_assets", "audit_events"];
    const originals = tables.map(table => db.prepare(`SELECT * FROM ${table}`).all());
    db.exec(sql);
    db.exec(sql);
    for (const [index, table] of tables.entries()) {
      const current = new Set(db.prepare(`SELECT * FROM ${table}`).all().map(row => JSON.stringify(row)));
      for (const row of originals[index]) assert.ok(current.has(JSON.stringify(row)), `${table}: original row changed`);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects WHERE id = ?").get(content.id).n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM revision_assets WHERE revision_id = ?").get(content.revisionId).n, 8);
    db.prepare("UPDATE projects SET draft_version = 2, updated_at = ? WHERE id = ?").run("2026-10-12T03:00:00.000Z", content.id);
    db.prepare("DELETE FROM public_projects WHERE project_id = ?").run(content.id);
    db.exec(sql);
    assert.equal(db.prepare("SELECT draft_version FROM projects WHERE id = ?").get(content.id).draft_version, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM public_projects WHERE project_id = ?").get(content.id).n, 0);
  } finally { db.close(); }
});
