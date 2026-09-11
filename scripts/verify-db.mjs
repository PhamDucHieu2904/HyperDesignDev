import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8");
const seed = await readFile(new URL("../db/seeds/portfolio-seed.sql", import.meta.url), "utf8");
const db = new DatabaseSync(":memory:");
db.exec(migration);
db.exec(seed);
db.exec(seed);

const count = table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
assert.deepEqual({
  categories: count("categories"),
  media: count("media_assets"),
  projects: count("projects"),
  revisions: count("project_revisions"),
  published: count("public_projects"),
}, { categories: 6, media: 4, projects: 6, revisions: 6, published: 6 });

assert.equal(db.prepare("SELECT COUNT(*) AS count FROM public_projects WHERE content_state = 'empty'").get().count, 3);
assert.equal(db.prepare("SELECT json_array_length(json_extract(body_json, '$.blocks')) AS count FROM project_revisions WHERE id = ?").get("seed-revision-game-systems-preview-v1").count, 0);

const originalPublicTitle = db.prepare("SELECT title FROM public_projects WHERE project_id = ?").get("vinut-coco-boba-label").title;
const update = db.prepare("UPDATE projects SET draft_meta_json = ?, draft_version = draft_version + 1, updated_at = ? WHERE id = ? AND draft_version = ?");
assert.equal(update.run('{"changed":true}', "2026-09-11T01:00:00.000Z", "vinut-coco-boba-label", 1).changes, 1);
assert.equal(update.run('{"stale":true}', "2026-09-11T02:00:00.000Z", "vinut-coco-boba-label", 1).changes, 0);
assert.equal(db.prepare("SELECT title FROM public_projects WHERE project_id = ?").get("vinut-coco-boba-label").title, originalPublicTitle);

assert.throws(() => db.prepare("INSERT INTO projects (id, slug, draft_meta_json, draft_body_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
  .run("invalid-json", "invalid-json", "not-json", "{}", "now", "now"));
assert.throws(() => db.prepare("INSERT INTO public_projects (project_id, revision_id, category_id, title, short_title, subtitle, thumbnail_asset_id, search_text, content_state, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
  .run("vinut-coco-boba-label", "seed-revision-vinut-coco-boba-label-v1", "unknown", "x", "x", "x", "seed-media-vinut-coco-boba-label", "x", "ready", "now"));
assert.throws(() => db.prepare("DELETE FROM media_assets WHERE id = ?").run("seed-media-portfolio-placeholder"));

console.log("Verified migration, idempotent seed, isolation, optimistic version guard and media references.");
