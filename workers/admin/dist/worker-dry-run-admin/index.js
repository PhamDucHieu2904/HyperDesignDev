var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
}), "json");
var localBypassEnabled = /* @__PURE__ */ __name((env) => env.DEPLOY_ENV === "local" && env.LOCAL_ADMIN_BYPASS === "true", "localBypassEnabled");
var adminWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const localBypass = localBypassEnabled(env);
    if (request.method === "GET" && url.pathname === "/api/admin/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({
          ok: result?.ok === 1,
          service: "hyperd-admin",
          environment: env.DEPLOY_ENV ?? "unknown",
          accessMode: localBypass ? "local-bypass" : "locked"
        }, result?.ok === 1 ? 200 : 503);
      } catch {
        return json({ ok: false, service: "hyperd-admin", error: "DATABASE_UNAVAILABLE" }, 503);
      }
    }
    if (!localBypass) return json({ error: {
      code: "ADMIN_LOCKED",
      message: "Admin authentication is not connected yet."
    } }, 503);
    if (url.pathname.startsWith("/api/admin/")) return json({ error: {
      code: "NOT_IMPLEMENTED",
      message: "Admin CRUD is scheduled for API-01."
    } }, 501);
    return env.ASSETS.fetch(request);
  }
};
var index_default = adminWorker;
export {
  adminWorker,
  index_default as default
};
//# sourceMappingURL=index.js.map
