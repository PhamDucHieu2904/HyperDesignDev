type D1Statement = { first<T = unknown>(): Promise<T | null> };
type D1Database = { prepare(query: string): D1Statement };
type AssetFetcher = { fetch(request: Request): Promise<Response> };

export type PublicEnv = {
  ASSETS: AssetFetcher;
  DB: D1Database;
  MEDIA: unknown;
  DEPLOY_ENV?: string;
  PUBLIC_CORS_ORIGINS?: string;
};

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
});

function corsHeaders(request: Request, env: PublicEnv): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = new Set((env.PUBLIC_CORS_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  if (!allowed.has(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", Vary: "Origin" };
}

export const publicWorker = {
  async fetch(request: Request, env: PublicEnv): Promise<Response> {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith("/api/");
    const isMedia = url.pathname.startsWith("/media/");
    const cors = corsHeaders(request, env);

    if ((isApi || isMedia) && cors === null) return json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "Origin is not allowed." } }, 403);
    if (request.method === "OPTIONS" && (isApi || isMedia)) return new Response(null, { status: 204, headers: cors ?? {} });

    if (request.method === "GET" && url.pathname === "/api/v1/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({ ok: result?.ok === 1, service: "hyperd-public", environment: env.DEPLOY_ENV ?? "unknown" }, result?.ok === 1 ? 200 : 503, cors ?? {});
      } catch {
        return json({ ok: false, service: "hyperd-public", error: "DATABASE_UNAVAILABLE" }, 503, cors ?? {});
      }
    }

    if (isApi || isMedia) return json({ error: { code: "NOT_FOUND", message: "Public endpoint not found." } }, 404, cors ?? {});
    return env.ASSETS.fetch(request);
  },
};

export default publicWorker;
