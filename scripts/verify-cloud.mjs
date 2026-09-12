import assert from "node:assert/strict";

const publicBase = "https://hyperd-public-staging.hieu-caelestia-portfolio.workers.dev";

const publicRoot = await fetch(publicBase);
assert.equal(publicRoot.status, 200, "Public static shell must be available.");
assert.match(publicRoot.headers.get("content-type") ?? "", /^text\/html/, "Public root must return HTML.");

const publicHealth = await fetch(`${publicBase}/api/v1/health`);
assert.equal(publicHealth.status, 200, "Public health must be available.");
assert.deepEqual(await publicHealth.json(), { ok: true, service: "hyperd-public", environment: "staging" });

const publicMissing = await fetch(`${publicBase}/api/v1/missing`);
assert.equal(publicMissing.status, 404, "Missing public API routes must not fall back to index.html.");
assert.match(publicMissing.headers.get("content-type") ?? "", /^application\/json/, "Missing API response must be JSON.");

const rejectedOrigin = await fetch(`${publicBase}/api/v1/health`, { headers: { Origin: "https://not-allowed.example" } });
assert.equal(rejectedOrigin.status, 403, "Unknown cross-origin requests must be rejected.");

const categories = await fetch(`${publicBase}/api/v1/categories`);
assert.equal(categories.status, 200, "Public categories must be available.");
const categoryBody = await categories.json();
assert.deepEqual(categoryBody.map(category => category.id), ["illustrator", "photoshop", "blender", "game", "web", "app"]);

const projects = await fetch(`${publicBase}/api/v1/projects?limit=2`);
assert.equal(projects.status, 200, "Public project index must be available.");
const projectBody = await projects.json();
assert.ok(Array.isArray(projectBody.items), "Public project index must expose an items array.");
assert.ok(projectBody.nextCursor === null || typeof projectBody.nextCursor === "string", "Public project cursor must be nullable text.");
assert.equal((await fetch(`${publicBase}/api/v1/projects?category=unknown`)).status, 400, "Unsupported public category must be rejected.");
assert.equal((await fetch(`${publicBase}/api/v1/projects/not-published`)).status, 404, "Draft or unknown project must stay private.");
assert.equal((await fetch(`${publicBase}/media/not-published`)).status, 404, "Draft or unknown media must stay private.");

console.log("Verified public staging Worker and published portfolio API.");
