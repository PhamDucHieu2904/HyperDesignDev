import assert from "node:assert/strict";

const publicBase = "https://hyperd-public-staging.hieu-caelestia-portfolio.workers.dev";
const adminBase = "https://hyperd-admin-staging.hieu-caelestia-portfolio.workers.dev";

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

const adminHealth = await fetch(`${adminBase}/api/admin/health`);
assert.equal(adminHealth.status, 200, "Admin infrastructure health must be available.");
assert.equal((await adminHealth.json()).accessMode, "locked", "Deployed admin must remain locked before API-01.");
assert.equal((await fetch(adminBase)).status, 503, "Admin static assets must fail closed.");
assert.equal((await fetch(`${adminBase}/api/admin/projects`)).status, 503, "Admin API must fail closed.");

console.log("Verified public staging and fail-closed admin staging Workers.");
