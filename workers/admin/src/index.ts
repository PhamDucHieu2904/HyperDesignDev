import type { AdminIdentity } from "../../../shared/contracts";
import { authenticate, requireMutationProtection } from "./auth";
import { ApiException, errorResponse, getRequestId, json } from "./http";
import { deleteMedia, getMediaContent, listMedia, updateMedia, uploadMedia } from "./media";
import { createProject, deleteProject, getProject, listProjects, restoreProject, saveDraft } from "./projects";
import { getRevisionDetail, listRevisions, publishProject, restoreRevision, unpublishProject } from "./publishing";
import type { AccessContext, AdminEnv } from "./types";
import { analyticsReport } from './analytics';

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function decodeRouteId(value: string) {
  let decoded: string;
  try { decoded = decodeURIComponent(value); }
  catch { throw new ApiException(400, "INVALID_ROUTE_ID", "The requested resource identifier is invalid."); }
  if (!/^[a-zA-Z0-9._:-]+$/.test(decoded)) throw new ApiException(400, "INVALID_ROUTE_ID", "The requested resource identifier is invalid.");
  return decoded;
}

export const adminWorker = {
  async fetch(request: Request, env: AdminEnv, context: AccessContext = {}): Promise<Response> {
    const url = new URL(request.url);
    const requestId = getRequestId(request);

    if (request.method === "GET" && url.pathname === "/api/admin/health") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
        return json({
          ok: result?.ok === 1,
          service: "hyperd-admin",
          environment: env.DEPLOY_ENV ?? "unknown",
          accessMode: "required",
        }, result?.ok === 1 ? 200 : 503);
      } catch { return json({ ok: false, service: "hyperd-admin", error: "DATABASE_UNAVAILABLE" }, 503); }
    }

    try {
      const actor = await authenticate(request, env, context);
      if (mutationMethods.has(request.method)) requireMutationProtection(request, env, actor);
      if (request.method === 'GET' && url.pathname === '/api/admin/analytics') return json(await analyticsReport(env, url));
      const intakeDetail = /^\/api\/admin\/requests\/([a-z0-9-]{36})$/i.exec(url.pathname);
      if (request.method === 'GET' && intakeDetail) {
        const item = await env.DB.prepare('SELECT id,created_at,email,description,category,budget_mode,budget_text,notification FROM create_requests WHERE id=?').bind(intakeDetail[1]).first();
        if (!item) throw new ApiException(404, 'NOT_FOUND', 'Request not found.');
        return json(item);
      }

      if (request.method === "GET" && url.pathname === "/api/admin/me") {
        const identity: AdminIdentity = {
          sub: actor.sub,
          email: actor.email,
          capabilities: [
            "project:read", "project:write", "project:trash", "project:publish",
            "revision:read", "revision:restore", "media:read", "media:write", "media:delete",
            "analytics:read",
          ],
          csrfToken: actor.csrfToken,
        };
        return json(identity);
      }
      if (url.pathname === "/api/admin/projects" && request.method === "GET") return json(await listProjects(env.DB, url));
      if (url.pathname === "/api/admin/projects" && request.method === "POST") return json(await createProject(env.DB, request, actor, requestId), 201);
      if (url.pathname === "/api/admin/media" && request.method === "GET") return json(await listMedia(env.DB, url));
      if (url.pathname === "/api/admin/media" && request.method === "POST") return json(await uploadMedia(env.DB, env.MEDIA, request, actor, requestId), 201);

      const mediaRoute = /^\/api\/admin\/media\/([a-zA-Z0-9._:-]+)(?:\/(content))?$/.exec(url.pathname);
      if (mediaRoute) {
        const [, mediaId, action] = mediaRoute;
        if (action === "content" && request.method === "GET") return await getMediaContent(env.DB, env.MEDIA, mediaId);
        if (!action && request.method === "PATCH") return json(await updateMedia(env.DB, mediaId, request, actor, requestId));
        if (!action && request.method === "DELETE") {
          await deleteMedia(env.DB, env.MEDIA, mediaId, actor, requestId);
          return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
        }
      }

      const revisionRestoreRoute = /^\/api\/admin\/projects\/([a-zA-Z0-9._:-]+)\/revisions\/([^/]+)\/restore$/.exec(url.pathname);
      if (revisionRestoreRoute && request.method === "POST") {
        return json(await restoreRevision(env.DB, revisionRestoreRoute[1], decodeRouteId(revisionRestoreRoute[2]), request, actor, requestId));
      }

      const revisionDetailRoute = /^\/api\/admin\/projects\/([a-zA-Z0-9._:-]+)\/revisions\/([^/]+)$/.exec(url.pathname);
      if (revisionDetailRoute && request.method === "GET") {
        return json(await getRevisionDetail(env.DB, revisionDetailRoute[1], decodeRouteId(revisionDetailRoute[2])));
      }

      const publicationRoute = /^\/api\/admin\/projects\/([a-zA-Z0-9._:-]+)\/(publish|unpublish|revisions)$/.exec(url.pathname);
      if (publicationRoute) {
        const [, projectId, action] = publicationRoute;
        if (action === "publish" && request.method === "POST") return json(await publishProject(env.DB, projectId, request, actor));
        if (action === "unpublish" && request.method === "POST") return json(await unpublishProject(env.DB, projectId, actor, requestId));
        if (action === "revisions" && request.method === "GET") return json(await listRevisions(env.DB, projectId, url));
      }

      const projectRoute = /^\/api\/admin\/projects\/([a-zA-Z0-9._:-]+)(?:\/(draft|restore))?$/.exec(url.pathname);
      if (projectRoute) {
        const [, projectId, action] = projectRoute;
        if (!action && request.method === "GET") return json(await getProject(env.DB, projectId));
        if (action === "draft" && request.method === "PUT") return json(await saveDraft(env.DB, projectId, request, actor, requestId));
        if (!action && request.method === "DELETE") return json(await deleteProject(env.DB, projectId, actor, requestId));
        if (action === "restore" && request.method === "POST") return json(await restoreProject(env.DB, projectId, actor, requestId));
      }

      if (url.pathname.startsWith("/api/admin/")) throw new ApiException(404, "NOT_FOUND", "Admin endpoint not found.");
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof ApiException) return errorResponse(error, requestId);
      console.error("Admin request failed", { requestId, error });
      return errorResponse(new ApiException(503, "SERVICE_UNAVAILABLE", "Admin service is temporarily unavailable."), requestId);
    }
  },
};

export default adminWorker;
