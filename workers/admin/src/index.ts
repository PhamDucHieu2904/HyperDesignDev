type D1Statement = { first<T = unknown>(): Promise<T | null> };
type D1Database = { prepare(query: string): D1Statement };
type AssetFetcher = { fetch(request: Request): Promise<Response> };

export type AdminEnv = {
  ASSETS: AssetFetcher;
  DB: D1Database;
  MEDIA: unknown;
  DEPLOY_ENV?: string;
  LOCAL_ADMIN_BYPASS?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_SUBJECT?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const localBypassEnabled = (env: AdminEnv) => env.DEPLOY_ENV === "local" && env.LOCAL_ADMIN_BYPASS === "true";

export const adminWorker = {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);
    const localBypass = localBypassEnabled(env);

    if (request.method === "GET" && url.pathname === "/api/admin/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({
          ok: result?.ok === 1,
          service: "hyperd-admin",
          environment: env.DEPLOY_ENV ?? "unknown",
          accessMode: localBypass ? "local-bypass" : "locked",
        }, result?.ok === 1 ? 200 : 503);
      } catch {
        return json({ ok: false, service: "hyperd-admin", error: "DATABASE_UNAVAILABLE" }, 503);
      }
    }

    // CF-01 intentionally fails closed. API-01 will replace this gate with full
    // Cloudflare Access JWT verification before any admin asset or API is served.
    if (!localBypass) return json({ error: {
      code: "ADMIN_LOCKED",
      message: "Admin authentication is not connected yet.",
    } }, 503);

    if (url.pathname.startsWith("/api/admin/")) return json({ error: {
      code: "NOT_IMPLEMENTED",
      message: "Admin CRUD is scheduled for API-01.",
    } }, 501);

    return env.ASSETS.fetch(request);
  },
};

export default adminWorker;
