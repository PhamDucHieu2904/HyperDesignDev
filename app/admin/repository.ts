import type {
  AdminIdentity, AdminMediaAsset, AdminProject, AdminProjectPage, AdminProjectSummary, AdminRevision, AdminRevisionPage,
  ArticleDocument, ProjectMetadata, PublishProjectResult,
} from "../../shared/contracts";
import type { AnalyticsReport, ReportingPeriod } from '../../shared/contracts';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public fieldErrors?: Record<string, string[]>,
  ) { super(message); }
}

let session: AdminIdentity | null = null;

function requestId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `admin-${Date.now()}`;
}

async function readResponse<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    if (!session) session = await getAdminIdentity();
    headers.set("X-HyperD-CSRF", session.csrfToken);
    headers.set("X-Request-ID", requestId());
  }
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  } catch (error) {
    throw new AdminApiError(error instanceof Error ? error.message : "The admin service could not be reached.");
  }
  if (!response.ok) {
    let message = `Admin request failed (${response.status}).`;
    let code: string | undefined;
    let fieldErrors: Record<string, string[]> | undefined;
    try {
      const body = await response.json() as { error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> } };
      message = body.error?.message ?? message;
      code = body.error?.code;
      fieldErrors = body.error?.fieldErrors;
    } catch { /* Keep the status-based message. */ }
    throw new AdminApiError(message, response.status, code, fieldErrors);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getAdminIdentity() {
  return readResponse<AdminIdentity>("/api/admin/me").then(identity => {
    session = identity;
    return identity;
  });
}
export function getAnalyticsReport(period: ReportingPeriod, date: string, trafficCursor?: string, requestCursor?: string, limit = 10) {
  const query = new URLSearchParams({ period, date, limit: String(limit) });
  if (trafficCursor) query.set('trafficCursor', trafficCursor);
  if (requestCursor) query.set('requestCursor', requestCursor);
  return readResponse<AnalyticsReport>(`/api/admin/analytics?${query}`);
}
export function getCreateRequest(id: string) {
  return readResponse<{ id: string; created_at: string; email: string; description: string; category: string; budget_mode: string; budget_text: string; notification: string }>(`/api/admin/requests/${encodeURIComponent(id)}`);
}

async function listProjectPage(query: string, state: string | undefined, cursor?: string | null) {
  const url = new URL("/api/admin/projects", window.location.origin);
  url.searchParams.set("limit", "48");
  if (query) url.searchParams.set("q", query);
  if (state) url.searchParams.set("state", state);
  if (cursor) url.searchParams.set("cursor", cursor);
  return readResponse<AdminProjectPage>(`${url.pathname}${url.search}`);
}

export async function listAdminProjects(options: { query?: string; state?: string } = {}) {
  const projects: AdminProjectSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const result = await listProjectPage(options.query?.trim() ?? "", options.state, cursor);
    projects.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor) return projects;
  }
  throw new AdminApiError("The project library exceeded its safe pagination limit.");
}

async function listMediaPage(cursor?: string | null) {
  const url = new URL("/api/admin/media", window.location.origin);
  url.searchParams.set("limit", "48");
  if (cursor) url.searchParams.set("cursor", cursor);
  return readResponse<{ items: AdminMediaAsset[]; nextCursor: string | null }>(`${url.pathname}${url.search}`);
}

export async function listAdminMedia() {
  const media: AdminMediaAsset[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const result = await listMediaPage(cursor);
    media.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor) return media;
  }
  throw new AdminApiError("The media library exceeded its safe pagination limit.");
}

export function getAdminProject(id: string) {
  return readResponse<AdminProject>(`/api/admin/projects/${encodeURIComponent(id)}`);
}

export function createAdminProject(metadata: ProjectMetadata, slug?: string) {
  return readResponse<AdminProject>("/api/admin/projects", {
    method: "POST",
    body: JSON.stringify({ ...(slug ? { slug } : {}), metadata }),
  });
}

export function saveAdminProject(id: string, expectedVersion: number, metadata: ProjectMetadata, document: ArticleDocument) {
  return readResponse<AdminProject>(`/api/admin/projects/${encodeURIComponent(id)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, metadata, document }),
  });
}

export function trashAdminProject(id: string) {
  return readResponse<AdminProject>(`/api/admin/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function restoreAdminProject(id: string) {
  return readResponse<AdminProject>(`/api/admin/projects/${encodeURIComponent(id)}/restore`, { method: "POST" });
}

export function uploadAdminMedia(file: File, altDefault: string) {
  const form = new FormData();
  form.set("file", file);
  if (altDefault.trim()) form.set("altDefault", altDefault.trim());
  return readResponse<AdminMediaAsset>("/api/admin/media", { method: "POST", body: form });
}

export function publishAdminProject(id: string, expectedVersion: number) {
  return readResponse<PublishProjectResult>(`/api/admin/projects/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion, requestId: requestId() }),
  });
}

export async function listAdminRevisions(id: string) {
  const revisions: AdminRevisionPage["items"] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`/api/admin/projects/${encodeURIComponent(id)}/revisions`, window.location.origin);
    url.searchParams.set("limit", "48");
    if (cursor) url.searchParams.set("cursor", cursor);
    const result = await readResponse<AdminRevisionPage>(`${url.pathname}${url.search}`);
    revisions.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor) return revisions;
  }
  throw new AdminApiError("Revision history exceeded its safe pagination limit.");
}

export function getAdminRevision(projectId: string, revisionId: string) {
  return readResponse<AdminRevision>(`/api/admin/projects/${encodeURIComponent(projectId)}/revisions/${encodeURIComponent(revisionId)}`);
}

export function restoreAdminRevision(projectId: string, revisionId: string, expectedVersion: number) {
  return readResponse<AdminProject>(`/api/admin/projects/${encodeURIComponent(projectId)}/revisions/${encodeURIComponent(revisionId)}/restore`, {
    method: "POST",
    body: JSON.stringify({ expectedVersion }),
  });
}
