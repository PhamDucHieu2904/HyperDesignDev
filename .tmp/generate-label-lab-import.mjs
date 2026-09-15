import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const content = JSON.parse(await readFile(new URL("./label-lab-content.json", import.meta.url), "utf8"));
const bundled = await build({ entryPoints: [fileURLToPath(new URL("../shared/contracts/index.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "cjs", target: "node22" });
const module = { exports: {} };
new Function("module", "exports", "require", bundled.outputFiles[0].text)(module, module.exports, () => { throw new Error("Unexpected runtime dependency"); });
const contracts = module.exports;
assert.equal(contracts.validateProjectMetadata(content.metadata).ok, true, "Label Lab metadata must satisfy the shared contract.");
assert.equal(contracts.validateArticleDocument(content.document).ok, true, "Label Lab document must satisfy the shared contract.");

const createdAt = "2026-09-15T07:35:00.000Z";
const actor = "migration:label-lab-trial";
const revisionId = "label-lab-revision-v1";
const media = [
  { id: "label-lab-app-icon", objectKey: "projects/label-lab/app-icon.png", originalName: "1024.png", bytes: 86801, width: 1025, height: 1025, alt: "Label Lab application icon made from stacked geometric planes", checksum: "7951ca31ea2e670eaf8d638be49be09843b79431de3e7adb0ed3d2a784a89106" },
  { id: "label-lab-wordmark", objectKey: "projects/label-lab/wordmark.png", originalName: "LogoLL2.png", bytes: 40120, width: 2022, height: 423, alt: "Label Lab wordmark and geometric 3D mockup system logo", checksum: "0e19bc8482ddcfd6d49dd138b869362000a2212aeb21c73606b4f53c4c1fcfe6" },
  { id: "label-lab-package-1500", objectKey: "projects/label-lab/package-1500.png", originalName: "Thumb_Label_1500_Bottle_1.png", bytes: 73964, width: 250, height: 250, alt: "Label Lab thumbnail for a 1500 ml bottle preset", checksum: "0824c92cf07119aa2ff617d5d862712d830b6a2fa79f44ba8cf11c069e1b041c" },
  { id: "label-lab-package-500-short", objectKey: "projects/label-lab/package-500-short.png", originalName: "Thumb_Label_500_Bottle_1.png", bytes: 50682, width: 232, height: 228, alt: "Label Lab thumbnail for a short-label 500 ml bottle preset", checksum: "8c8561abe8b16c4c93936bcf851ee08ae236377d4c99735eff75bba529c07985" },
  { id: "label-lab-package-500-long", objectKey: "projects/label-lab/package-500-long.png", originalName: "Thumb_Label_500_Bottle_2.png", bytes: 50422, width: 230, height: 219, alt: "Label Lab thumbnail for a long-label 500 ml bottle preset", checksum: "52933cb285b386c24a79d9e746707d760c8da3460f6d90615c4e8a0e50670705" }
];
const referenced = new Set([content.metadata.thumbnailAssetId, content.metadata.coverAssetId, ...contracts.collectArticleAssetIds(content.document)]);
assert.deepEqual([...referenced].sort(), media.map(asset => asset.id).sort(), "Every referenced Label Lab asset must be declared exactly once.");

const q = value => `'${String(value).replaceAll("'", "''")}'`;
const metadata = JSON.stringify(content.metadata);
const document = JSON.stringify(content.document);
const searchText = [content.metadata.title, content.metadata.shortTitle, content.metadata.subtitle, ...content.metadata.tags, ...content.metadata.tools].join(" ").toLocaleLowerCase("en");
const lines = ["PRAGMA foreign_keys = ON;"];
for (const asset of media) lines.push(`INSERT INTO media_assets (id, object_key, original_name, mime, bytes, width, height, alt_default, checksum, state, created_by, created_at) VALUES (${q(asset.id)}, ${q(asset.objectKey)}, ${q(asset.originalName)}, 'image/png', ${asset.bytes}, ${asset.width}, ${asset.height}, ${q(asset.alt)}, ${q(asset.checksum)}, 'ready', ${q(actor)}, ${q(createdAt)}) ON CONFLICT(id) DO NOTHING;`);
lines.push(`INSERT INTO projects (id, slug, draft_meta_json, draft_body_json, draft_version, created_at, updated_at) VALUES (${q(content.id)}, ${q(content.slug)}, ${q(metadata)}, ${q(document)}, 1, ${q(createdAt)}, ${q(createdAt)}) ON CONFLICT(id) DO NOTHING;`);
lines.push(`INSERT INTO project_revisions (id, project_id, source_version, meta_json, body_json, schema_version, created_by, created_at) VALUES (${q(revisionId)}, ${q(content.id)}, 1, ${q(metadata)}, ${q(document)}, 1, ${q(actor)}, ${q(createdAt)}) ON CONFLICT(id) DO NOTHING;`);
for (const assetId of referenced) {
  lines.push(`INSERT INTO revision_assets (revision_id, asset_id) VALUES (${q(revisionId)}, ${q(assetId)}) ON CONFLICT(revision_id, asset_id) DO NOTHING;`);
  lines.push(`INSERT INTO draft_assets (project_id, asset_id) VALUES (${q(content.id)}, ${q(assetId)}) ON CONFLICT(project_id, asset_id) DO NOTHING;`);
}
lines.push(`INSERT INTO public_projects (project_id, revision_id, category_id, title, short_title, subtitle, thumbnail_asset_id, sort_order, is_featured, search_text, content_state, published_at) VALUES (${q(content.id)}, ${q(revisionId)}, ${q(content.metadata.categoryId)}, ${q(content.metadata.title)}, ${q(content.metadata.shortTitle)}, ${q(content.metadata.subtitle)}, ${q(content.metadata.thumbnailAssetId)}, ${content.metadata.sortOrder}, ${content.metadata.isFeatured ? 1 : 0}, ${q(searchText)}, 'ready', ${q(createdAt)}) ON CONFLICT(project_id) DO NOTHING;`);
lines.push(`INSERT INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at) VALUES ('audit-label-lab-v1', ${q(actor)}, 'publish', 'project', ${q(content.id)}, 'label-lab-trial-2026-09-15', ${q(JSON.stringify({ revisionId, source: "Unity project audit" }))}, ${q(createdAt)}) ON CONFLICT(id) DO NOTHING;`, "");
await writeFile(new URL("./label-lab-import.sql", import.meta.url), lines.join("\n"), "utf8");
console.log(`Validated Label Lab and generated ${lines.length - 2} idempotent SQL statements.`);
