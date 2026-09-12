import { corsHeaders, json, PublicApiException, publicError } from "./http";
import { getAdjacentProjects, getPublicMedia, getPublicProject, listCategories, listPublicProjects } from "./projects";
import type { PublicEnv } from "./types";

export type { PublicEnv } from "./types";

export const publicWorker = {
  async fetch(request: Request, env: PublicEnv): Promise<Response> {
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
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof PublicApiException) return publicError(error, requestId, cors ?? {});
      console.error("Public request failed", { requestId, error });
      return publicError(new PublicApiException(503, "SERVICE_UNAVAILABLE", "Public service is temporarily unavailable."), requestId, cors ?? {});
    }
  },
};

export default publicWorker;
