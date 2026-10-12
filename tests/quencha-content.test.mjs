import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { prepareQuenchaImport } from "../scripts/import-quencha.mjs";

test("Quencha template imports nine original assets, publishes once and preserves later admin edits", async () => {
  const { content, sql } = await prepareQuenchaImport();
  assert.equal(content.metadata.thumbnailAssetId, "quencha-thumbnail");
  assert.equal(content.media.length, 9);
  assert.deepEqual(content.document.blocks.filter(block => block.type === "image").map(block => block.assetId), [
    "quencha-hero", "quencha-banner", "quencha-labels", "quencha-mango-catalogue", "quencha-cans",
    "quencha-watermelon-poster", "quencha-storefront", "quencha-banner", "quencha-brand-mockups",
  ]);
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(await readFile(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8"));
    db.exec(await readFile(new URL("../db/seeds/portfolio-seed.sql", import.meta.url), "utf8"));
    const originals = db.prepare("SELECT * FROM projects ORDER BY id").all();
    db.exec(sql);
    db.exec(sql);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM projects WHERE id = 'quencha-beverage'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM revision_assets WHERE revision_id = 'quencha-revision-v1'").get().n, 9);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM media_assets WHERE id LIKE 'quencha-%'").get().n, 9);
    assert.deepEqual(db.prepare("SELECT * FROM projects WHERE id != 'quencha-beverage' ORDER BY id").all(), originals);
    db.prepare("UPDATE projects SET draft_version = 2, draft_body_json = ?, updated_at = ? WHERE id = 'quencha-beverage'")
      .run('{"schemaVersion":1,"blocks":[]}', "2026-10-12T01:00:00.000Z");
    db.exec("DELETE FROM public_projects WHERE project_id = 'quencha-beverage'");
    db.exec(sql);
    assert.equal(db.prepare("SELECT draft_version FROM projects WHERE id = 'quencha-beverage'").get().draft_version, 2);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM public_projects WHERE project_id = 'quencha-beverage'").get().n, 0, "Replay must not republish an admin-unpublished project");
  } finally { db.close(); }
});
