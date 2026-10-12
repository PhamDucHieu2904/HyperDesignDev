import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

async function loadWorker(entryPoint, namedExport) {
  const result = await build({ entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "cjs", target: "node22" });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, () => { throw new Error("Unexpected runtime dependency"); });
  return module.exports[namedExport];
}

const adminWorker = await loadWorker("workers/admin/src/index.ts", "adminWorker");
const publicWorker = await loadWorker("workers/public/src/index.ts", "publicWorker");
const assets = { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`) };

function createR2TestBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value) {
      const bytes = new Uint8Array(value.slice(0));
      objects.set(key, bytes);
      return { size: bytes.byteLength, httpEtag: `"${bytes.byteLength}"` };
    },
    async head(key) {
      const bytes = objects.get(key);
      return bytes ? { size: bytes.byteLength, httpEtag: `"${bytes.byteLength}"` } : null;
    },
    async get(key) {
      const bytes = objects.get(key);
      return bytes ? { size: bytes.byteLength, httpEtag: `"${bytes.byteLength}"`, body: new Blob([bytes]).stream() } : null;
    },
    async delete(key) { objects.delete(key); },
  };
}

async function createD1TestAdapter() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(await readFile(new URL("../db/migrations/0001_initial.sql", import.meta.url), "utf8"));
  sqlite.exec(await readFile(new URL("../db/seeds/portfolio-seed.sql", import.meta.url), "utf8"));
  const adapter = {
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...nextValues) { values = nextValues; return statement; },
        async first(columnName) {
          const row = sqlite.prepare(sql).get(...values) ?? null;
          return columnName && row ? row[columnName] ?? null : row;
        },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...values), meta: { changes: 0 } }; },
        async run() { return { success: true, results: [], meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { adapter, sqlite };
}

function localEnv(adapter, bucket = {}) {
  return { DB: adapter, MEDIA: bucket, ASSETS: assets, DEPLOY_ENV: "local", LOCAL_ADMIN_BYPASS: "true", LOCAL_CSRF_TOKEN: "local-dev-csrf" };
}

function encodeJwtPart(value) {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

async function createAccessJwt(claims) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const header = encodeJwtPart({ alg: "RS256", kid: "test-access-key", typ: "JWT" });
  const payload = encodeJwtPart(claims);
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(signingInput));
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { token: `${signingInput}.${Buffer.from(signature).toString("base64url")}`, jwk: { ...jwk, kid: "test-access-key" } };
}

test("admin worker stays locked without deployed auth and exposes the local bypass only in local mode", async () => {
  const db = { prepare: () => ({ first: async () => ({ ok: 1 }) }) };
  const locked = await adminWorker.fetch(new Request("https://admin.example/"), { DB: db, MEDIA: {}, ASSETS: assets, DEPLOY_ENV: "staging" });
  assert.equal(locked.status, 503);
  const local = await adminWorker.fetch(new Request("http://localhost/"), { DB: db, MEDIA: {}, ASSETS: assets, DEPLOY_ENV: "local", LOCAL_ADMIN_BYPASS: "true" });
  assert.equal(local.status, 200);
});

test("admin worker verifies the standard Cloudflare Access JWT when Worker access context is unavailable", async () => {
  const domain = "test-team.cloudflareaccess.com";
  const audience = "test-audience";
  const email = "owner@example.com";
  const now = Math.floor(Date.now() / 1000);
  const { token, jwk } = await createAccessJwt({
    aud: [audience], email, exp: now + 300, iss: `https://${domain}`, nbf: now - 10, sub: "owner-subject",
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), `https://${domain}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] });
  };
  try {
    const db = { prepare: () => ({ first: async () => ({ ok: 1 }) }) };
    const response = await adminWorker.fetch(new Request("https://admin.example/", {
      headers: { "Cf-Access-Jwt-Assertion": token },
    }), {
      DB: db, MEDIA: {}, ASSETS: assets, DEPLOY_ENV: "staging", ADMIN_EMAIL: email,
      ADMIN_ORIGIN: "https://admin.example", ACCESS_AUD: audience, ACCESS_TEAM_DOMAIN: domain, CSRF_SECRET: "test-secret",
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "asset:/");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ADM-01 project library API supports summaries, metadata save, trash and restore", async () => {
  const { adapter, sqlite } = await createD1TestAdapter();
  const origin = "http://localhost";
  const env = localEnv(adapter);
  const headers = { "Content-Type": "application/json", Origin: origin, "X-HyperD-CSRF": "local-dev-csrf" };
  const metadata = {
    categoryId: "illustrator", title: "ADM project", shortTitle: "ADM project", subtitle: "Created in ADM-01 test",
    thumbnailAssetId: "seed-media-portfolio-placeholder", tags: ["admin"], tools: ["Worker"], isFeatured: false, sortOrder: 70,
  };
  const createdResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects`, { method: "POST", headers, body: JSON.stringify({ metadata }) }), env);
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.contentState, "empty");

  const summary = await (await adminWorker.fetch(new Request(`${origin}/api/admin/projects?q=ADM`), env)).json();
  assert.ok(summary.items.some(project => project.id === created.id));
  assert.equal(summary.items.find(project => project.id === created.id).contentState, "empty");

  const saved = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${created.id}/draft`, {
    method: "PUT", headers, body: JSON.stringify({ expectedVersion: 1, metadata: { ...metadata, title: "ADM updated" }, document: { schemaVersion: 1, blocks: [] } }),
  }), env);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).version, 2);
  assert.equal((await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${created.id}/draft`, {
    method: "PUT", headers, body: JSON.stringify({ expectedVersion: 1, metadata, document: { schemaVersion: 1, blocks: [] } }),
  }), env)).status, 409);

  const trashed = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${created.id}`, { method: "DELETE", headers }), env);
  assert.equal((await trashed.json()).state, "trash");
  const trash = await (await adminWorker.fetch(new Request(`${origin}/api/admin/projects?state=trash`), env)).json();
  assert.ok(trash.items.some(project => project.id === created.id));
  const restored = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${created.id}/restore`, { method: "POST", headers }), env);
  assert.equal((await restored.json()).state, "draft");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE entity_id = ?").get(created.id).count, 4);
});

test("ADM-01 media selection can use a ready upload and rejects deletion of referenced assets", async () => {
  const { adapter } = await createD1TestAdapter();
  const bucket = createR2TestBucket();
  const origin = "http://localhost";
  const env = localEnv(adapter, bucket);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.set("file", new File([png], "adm-pixel.png", { type: "image/png" }));
  form.set("altDefault", "ADM pixel");
  const upload = await (await adminWorker.fetch(new Request(`${origin}/api/admin/media`, { method: "POST", headers: { Origin: origin, "X-HyperD-CSRF": "local-dev-csrf" }, body: form }), env)).json();
  assert.equal(upload.state, "ready");
  assert.equal((await (await adminWorker.fetch(new Request(`${origin}/api/admin/media?type=image&q=adm-pixel`), env)).json()).items.some(asset => asset.id === upload.id), true);
  const projectMetadata = {
    categoryId: "illustrator", title: "Media reference test", shortTitle: "Media reference test",
    subtitle: "Draft used to verify reference-safe deletion", thumbnailAssetId: upload.id,
    tags: [], tools: [], isFeatured: false, sortOrder: 80,
  };
  const projectResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin, "X-HyperD-CSRF": "local-dev-csrf" },
    body: JSON.stringify({ metadata: projectMetadata }),
  }), env);
  assert.equal(projectResponse.status, 201);
  const referenced = await adminWorker.fetch(new Request(`${origin}/api/admin/media/${upload.id}`, {
    method: "DELETE", headers: { Origin: origin, "X-HyperD-CSRF": "local-dev-csrf" },
  }), env);
  assert.equal(referenced.status, 409);
});

test("ADM-03 revision history previews immutable snapshots and restores only the draft", async () => {
  const { adapter, sqlite } = await createD1TestAdapter();
  const origin = "http://localhost";
  const env = localEnv(adapter, createR2TestBucket());
  const headers = { "Content-Type": "application/json", Origin: origin, "X-HyperD-CSRF": "local-dev-csrf" };
  const projectId = "vinut-coco-boba-label";
  sqlite.prepare(`INSERT INTO media_assets
    (id, object_key, original_name, mime, bytes, width, height, alt_default, checksum, state, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, NULL, '', ?, 'ready', ?, ?)`)
    .run("adm03-video", "tests/adm03-video.mp4", "adm03-video.mp4", "video/mp4", 64, "adm03-video-checksum", "test", "2026-09-14T00:00:00.000Z");
  const original = await (await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${projectId}`), env)).json();
  const advancedDocument = {
    schemaVersion: 1,
    blocks: [
      { id: "adm03-gallery", type: "gallery", columns: 2, items: [{ assetId: "seed-media-vinut-coco-boba-label", alt: "Label artwork" }] },
      { id: "adm03-columns", type: "columns", columns: [
        [{ id: "adm03-column-heading", type: "heading", level: 3, text: "System" }],
        [{ id: "adm03-column-text", type: "text", paragraphs: [{ spans: [{ text: "Production notes" }] }] }],
      ] },
      { id: "adm03-video-block", type: "video", assetId: "adm03-video", posterAssetId: "seed-media-vinut-coco-boba-label", caption: "Motion preview" },
      { id: "adm03-links", type: "links", items: [{ label: "Hyper D", url: "https://example.com/hyper-d" }] },
      { id: "adm03-spacer", type: "spacer", size: "md" },
    ],
  };
  const savedResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${projectId}/draft`, {
    method: "PUT", headers, body: JSON.stringify({ expectedVersion: original.version, metadata: original.metadata, document: advancedDocument }),
  }), env);
  assert.equal(savedResponse.status, 200);
  const saved = await savedResponse.json();

  const publishedResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${projectId}/publish`, {
    method: "POST", headers, body: JSON.stringify({ expectedVersion: saved.version, requestId: "adm03-publish" }),
  }), env);
  assert.equal(publishedResponse.status, 200);
  const published = await publishedResponse.json();
  assert.equal(published.revision.sourceVersion, saved.version);

  const historyResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${projectId}/revisions`), env);
  assert.equal(historyResponse.status, 200);
  const history = await historyResponse.json();
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].isPublic, true);

  const originalRevision = history.items.find(item => item.id === original.publicRevisionId);
  const encodedRevisionId = encodeURIComponent(originalRevision.id);
  const detailResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${projectId}/revisions/${encodedRevisionId}`), env);
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json();
  assert.equal(detail.document.blocks.length, original.document.blocks.length);
  assert.equal(detail.metadata.title, original.metadata.title);

  const restoredResponse = await adminWorker.fetch(new Request(`${origin}/api/admin/projects/${projectId}/revisions/${encodedRevisionId}/restore`, {
    method: "POST", headers, body: JSON.stringify({ expectedVersion: saved.version }),
  }), env);
  assert.equal(restoredResponse.status, 200);
  const restored = await restoredResponse.json();
  assert.equal(restored.version, saved.version + 1);
  assert.deepEqual(restored.document, original.document);
  assert.equal(restored.state, "unpublished-changes");
  assert.equal(sqlite.prepare("SELECT revision_id FROM public_projects WHERE project_id = ?").get(projectId).revision_id, published.revision.id);
});

test("shared admin/public content stays private until publish and disappears after unpublish", async () => {
  const { adapter, sqlite } = await createD1TestAdapter();
  const bucket = createR2TestBucket();
  const adminOrigin = "http://admin.local";
  const publicOrigin = "http://profile.local";
  const adminEnv = localEnv(adapter, bucket);
  const publicEnv = { DB: adapter, MEDIA: bucket, ASSETS: assets, DEPLOY_ENV: "test" };
  const mutationHeaders = { "Content-Type": "application/json", Origin: adminOrigin, "X-HyperD-CSRF": "local-dev-csrf" };
  const publicRead = path => publicWorker.fetch(new Request(`${publicOrigin}${path}`), publicEnv);
  try {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const form = new FormData();
    form.set("file", new File([png], "integration-pixel.png", { type: "image/png" }));
    form.set("altDefault", "Integration thumbnail");
    const uploadResponse = await adminWorker.fetch(new Request(`${adminOrigin}/api/admin/media`, {
      method: "POST", headers: { Origin: adminOrigin, "X-HyperD-CSRF": "local-dev-csrf" }, body: form,
    }), adminEnv);
    assert.equal(uploadResponse.status, 201);
    const media = await uploadResponse.json();
    assert.equal((await publicRead(`/media/${media.id}`)).status, 404);

    const metadata = {
      categoryId: "illustrator", title: "Private integration draft", shortTitle: "Integration",
      subtitle: "Publication integration test", thumbnailAssetId: media.id,
      tags: [], tools: [], isFeatured: false, sortOrder: 90,
    };
    const createdResponse = await adminWorker.fetch(new Request(`${adminOrigin}/api/admin/projects`, {
      method: "POST", headers: mutationHeaders, body: JSON.stringify({ metadata }),
    }), adminEnv);
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    const detailPath = `/api/v1/projects/${created.id}`;
    assert.equal((await publicRead(detailPath)).status, 404);

    const document = { schemaVersion: 1, blocks: [{ id: "integration-heading", type: "heading", level: 2, text: "Published content" }] };
    const savedResponse = await adminWorker.fetch(new Request(`${adminOrigin}/api/admin/projects/${created.id}/draft`, {
      method: "PUT", headers: mutationHeaders,
      body: JSON.stringify({ expectedVersion: created.version, metadata, document }),
    }), adminEnv);
    assert.equal(savedResponse.status, 200);
    const saved = await savedResponse.json();
    const publicationResponse = await adminWorker.fetch(new Request(`${adminOrigin}/api/admin/projects/${created.id}/publish`, {
      method: "POST", headers: mutationHeaders,
      body: JSON.stringify({ expectedVersion: saved.version, requestId: "integration-publish" }),
    }), adminEnv);
    assert.equal(publicationResponse.status, 200);
    const publication = await publicationResponse.json();
    const publicDetail = await (await publicRead(detailPath)).json();
    assert.equal(publicDetail.title, metadata.title);
    assert.equal(publicDetail.revisionId, publication.revision.id);
    assert.deepEqual(publicDetail.document, document);
    const publicMedia = await publicRead(`/media/${media.id}`);
    assert.equal(publicMedia.status, 200);
    assert.deepEqual(Buffer.from(await publicMedia.arrayBuffer()), png);

    const laterDraft = await adminWorker.fetch(new Request(`${adminOrigin}/api/admin/projects/${created.id}/draft`, {
      method: "PUT", headers: mutationHeaders,
      body: JSON.stringify({ expectedVersion: saved.version, metadata: { ...metadata, title: "Unpublished replacement" }, document }),
    }), adminEnv);
    assert.equal(laterDraft.status, 200);
    assert.equal((await (await publicRead(detailPath)).json()).title, metadata.title);
    assert.equal((await publicRead("/api/admin/projects")).status, 404);

    const unpublished = await adminWorker.fetch(new Request(`${adminOrigin}/api/admin/projects/${created.id}/unpublish`, {
      method: "POST", headers: mutationHeaders,
    }), adminEnv);
    assert.equal(unpublished.status, 200);
    assert.equal((await publicRead(detailPath)).status, 404);
    assert.equal((await publicRead(`/media/${media.id}`)).status, 404);
  } finally {
    sqlite.close();
  }
});
