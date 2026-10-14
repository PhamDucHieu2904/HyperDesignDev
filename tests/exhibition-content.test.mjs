import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { prepareExhibitionBooth1Import } from "../scripts/import-exhibition-booth-1.mjs";

test("Exhibition Booth 1 import adds the supplied artboards and retires only the named temporary projects", async () => {
  const { content, sql } = await prepareExhibitionBooth1Import();
  assert.equal(content.metadata.title, "Exhibition Booth 1 - THAIFEX 2025");
  assert.equal(content.metadata.thumbnailAssetId, "exhibition-thumbnail");
  assert.equal(content.media.length, 7);
  assert.equal(content.document.blocks.filter(block => block.type === "image").length, 6);
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(await readFile(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8"));
    db.exec(await readFile(new URL("../db/seeds/portfolio-seed.sql", import.meta.url), "utf8"));
    db.exec(sql);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM public_projects WHERE project_id=?").get(content.id).n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM revision_assets WHERE revision_id=?").get(content.revisionId).n, 7);
    for (const id of ["vinut-coco-boba-label", "coco-boba-tini-world", "nam-viet-exhibition"]) {
      assert.equal(db.prepare("SELECT deleted_at IS NOT NULL AS trashed FROM projects WHERE id=?").get(id).trashed, 1);
      assert.equal(db.prepare("SELECT COUNT(*) AS n FROM public_projects WHERE project_id=?").get(id).n, 0);
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM public_projects WHERE project_id='game-systems-preview'").get().n, 1);
    db.prepare("UPDATE projects SET draft_version=2, updated_at=? WHERE id=?").run("2026-10-15T00:00:00.000Z", content.id);
    db.exec(sql);
    assert.equal(db.prepare("SELECT draft_version FROM projects WHERE id=?").get(content.id).draft_version, 2);
  } finally { db.close(); }
});
