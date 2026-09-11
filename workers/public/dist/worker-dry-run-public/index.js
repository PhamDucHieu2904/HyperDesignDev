var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
}), "json");
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = new Set((env.PUBLIC_CORS_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
  if (!allowed.has(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", Vary: "Origin" };
}
__name(corsHeaders, "corsHeaders");
var publicWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith("/api/");
    const isMedia = url.pathname.startsWith("/media/");
    const cors = corsHeaders(request, env);
    if ((isApi || isMedia) && cors === null) return json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } }, 403);
    if (request.method === "OPTIONS" && (isApi || isMedia)) return new Response(null, { status: 204, headers: cors ?? {} });
    if (request.method === "GET" && url.pathname === "/api/v1/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: result?.ok === 1, service: "hyperd-public", environment: env.DEPLOY_ENV ?? "unknown" }, result?.ok === 1 ? 200 : 503, cors ?? {});
      } catch {
        return json({ ok: false, service: "hyperd-public", error: "DATABASE_UNAVAILABLE" }, 503, cors ?? {});
      }
    }
    if (isApi || isMedia) return json({ error: { code: "NOT_FOUND", message: "Public endpoint not found." } }, 404, cors ?? {});
    return env.ASSETS.fetch(request);
  }
};
var index_default = publicWorker;
export {
  index_default as default,
  publicWorker
};
//# sourceMappingURL=index.js.map
