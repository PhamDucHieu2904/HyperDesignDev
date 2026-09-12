import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function loadWorker(entryPoint, namedExport) {
  const result = await build({ entryPoints: [entryPoint], bundle: true, write: false, platform: "node", format: "cjs", target: "node22" });
  const module = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(module, module.exports, () => { throw new Error("Unexpected runtime dependency"); });
  return module.exports[namedExport];
}

const publicWorker = await loadWorker("workers/public/src/index.ts", "publicWorker");
const db = { prepare: () => ({ first: async () => ({ ok: 1 }) }) };
const assets = { fetch: async request => new Response(`asset:${new URL(request.url).pathname}`) };

test("public worker exposes health, restricts CORS and does not SPA-fallback API routes", async () => {
  const env = { DB: db, MEDIA: {}, ASSETS: assets, DEPLOY_ENV: "test", PUBLIC_CORS_ORIGINS: "https://hyperd.example" };
  const health = await publicWorker.fetch(new Request("https://worker.example/api/v1/health", { headers: { Origin: "https://hyperd.example" } }), env);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("Access-Control-Allow-Origin"), "https://hyperd.example");
  assert.equal((await health.json()).service, "hyperd-public");

  const rejected = await publicWorker.fetch(new Request("https://worker.example/api/v1/health", { headers: { Origin: "https://evil.example" } }), env);
  assert.equal(rejected.status, 403);
  const missing = await publicWorker.fetch(new Request("https://worker.example/api/v1/missing"), env);
  assert.equal(missing.status, 404);
  assert.equal(await (await publicWorker.fetch(new Request("https://worker.example/portfolio"), env)).text(), "asset:/portfolio");
});
