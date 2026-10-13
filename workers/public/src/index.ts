import { corsHeaders, json, PublicApiException, publicError } from "./http";
import { getAdjacentProjects, getPublicMedia, getPublicProject, listCategories, listPublicProjects } from "./projects";
import type { PublicEnv } from "./types";
import { ingestEvents, recordEdge } from './telemetry';
import { deliverNotifications, requestConfig, submitRequest } from './requests';

export type { PublicEnv } from "./types";

export const publicWorker = {
  async fetch(request: Request, env: PublicEnv, context?: { waitUntil(promise: Promise<unknown>): void }): Promise<Response> {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith("/api/");
    const isMedia = url.pathname.startsWith("/media/");
    const cors = corsHeaders(request, env);
    const requestId = crypto.randomUUID();

    if ((isApi || isMedia) && cors === null) return publicError(new PublicApiException(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed."), requestId);
    if (request.method === "OPTIONS" && (isApi || isMedia)) return new Response(null, { status: 204, headers: cors ?? {} });

    if (request.method === "GET" && url.pathname === "/api/v1/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({ ok: result?.ok === 1, service: "hyperd-public", environment: env.DEPLOY_ENV ?? "unknown" }, result?.ok === 1 ? 200 : 503, cors ?? {});
      } catch {
        return json({ ok: false, service: "hyperd-public", error: "DATABASE_UNAVAILABLE" }, 503, cors ?? {});
      }
    }

    try {
      if (url.pathname === '/api/v1/events' && request.method === 'POST') return json(await ingestEvents(request, env), 200, cors ?? {});
      if (url.pathname === '/api/v1/project-requests/config' && request.method === 'GET') return json(requestConfig(env), 200, cors ?? {});
      if (url.pathname === '/api/v1/project-requests' && request.method === 'POST') return json(await submitRequest(request, env), 201, cors ?? {});
      const cache = "public, max-age=60, stale-while-revalidate=300";
      if (request.method === "GET" && url.pathname === "/api/v1/categories") {
        return json(await listCategories(env.DB), 200, cors ?? {}, "public, max-age=3600, stale-while-revalidate=86400");
      }
      if (request.method === "GET" && url.pathname === "/api/v1/projects") return json(await listPublicProjects(env.DB, url), 200, cors ?? {}, cache);

      const adjacentRoute = /^\/api\/v1\/projects\/([a-zA-Z0-9._:-]+)\/adjacent$/.exec(url.pathname);
      if (request.method === "GET" && adjacentRoute) return json(await getAdjacentProjects(env.DB, adjacentRoute[1]), 200, cors ?? {}, cache);
      const detailRoute = /^\/api\/v1\/projects\/([a-zA-Z0-9._:-]+)$/.exec(url.pathname);
      if (request.method === "GET" && detailRoute) return json(await getPublicProject(env.DB, detailRoute[1]), 200, cors ?? {}, cache);

      const mediaRoute = /^\/media\/([a-zA-Z0-9._:-]+)$/.exec(url.pathname);
      if ((request.method === "GET" || request.method === "HEAD") && mediaRoute) {
        const response = await getPublicMedia(env.DB, env.MEDIA, mediaRoute[1], request.method === "HEAD");
        const headers = new Headers(response.headers);
        Object.entries(cors ?? {}).forEach(([name, value]) => headers.set(name, String(value)));
        return new Response(response.body, { status: response.status, headers });
      }

      if (isApi || isMedia) throw new PublicApiException(404, "NOT_FOUND", "Public endpoint not found.");
      const response = await env.ASSETS.fetch(request);
      const recording = recordEdge(request, response, env).catch(() => { console.warn('Traffic recording unavailable'); });
      if (context) context.waitUntil(recording); else await recording;
      return response;
    } catch (error) {
      if (error instanceof PublicApiException) return publicError(error, requestId, cors ?? {});
      console.error("Public request failed", { requestId, error });
      return publicError(new PublicApiException(503, "SERVICE_UNAVAILABLE", "Public service is temporarily unavailable."), requestId, cors ?? {});
    }
  },
  async scheduled(_event: unknown, env: PublicEnv, context: { waitUntil(promise: Promise<unknown>): void }) {
    context.waitUntil(deliverNotifications(env));
    context.waitUntil((async () => {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM analytics_events WHERE created_at<?').bind(new Date(Date.now() - 90 * 86400000).toISOString()),
        env.DB.prepare('DELETE FROM create_attempts WHERE created_at<?').bind(new Date(Date.now() - 365 * 86400000).toISOString()),
        env.DB.prepare('DELETE FROM create_requests WHERE created_at<?').bind(new Date(Date.now() - 365 * 86400000).toISOString()),
        env.DB.prepare('DELETE FROM request_limits WHERE expires_at<?').bind(new Date().toISOString()),
      ]);
    })());
  },
};

export default publicWorker;
