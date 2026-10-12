import {
  collectArticleAssetIds, emptyArticleDocument, normalizeSearchText,
  validateProjectMetadata, validateSaveProjectDraftInput,
  type AdminProject, type AdminProjectPage, type AdminProjectSummary,
  type ArticleDocument, type ProjectAdminState, type ProjectMetadata,
} from "../../../shared/contracts";
import { ApiException, isRecord, readJson } from "./http";
import type { Actor, D1Database, D1PreparedStatement } from "./types";

type ProjectRow = {
  id: string; slug: string; draft_meta_json: string; draft_body_json: string; draft_version: number;
  created_at: string; updated_at: string; deleted_at: string | null;
  public_revision_id: string | null; public_source_version: number | null;
};

const projectSelect = `SELECT p.id, p.slug, p.draft_meta_json, p.draft_body_json, p.draft_version,
  p.created_at, p.updated_at, p.deleted_at, pp.revision_id AS public_revision_id,
  pr.source_version AS public_source_version
  FROM projects p
  LEFT JOIN public_projects pp ON pp.project_id = p.id
  LEFT JOIN project_revisions pr ON pr.id = pp.revision_id`;

function stateOf(row: ProjectRow): ProjectAdminState {
  if (row.deleted_at) return "trash";
  if (!row.public_revision_id) return "draft";
  return row.public_source_version === row.draft_version ? "published" : "unpublished-changes";
}

function parseRow(row: ProjectRow): AdminProject {
  const document = JSON.parse(row.draft_body_json) as ArticleDocument;
  return {
    id: row.id, slug: row.slug,
    metadata: JSON.parse(row.draft_meta_json) as ProjectMetadata,
    document,
    contentState: document.blocks.length ? "ready" : "empty",
    version: row.draft_version, state: stateOf(row), publicRevisionId: row.public_revision_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const summaryOf = ({ document: _document, ...summary }: AdminProject): AdminProjectSummary => summary;

function slugify(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

export function projectAssetIds(metadata: ProjectMetadata, document: ArticleDocument) {
  return [...new Set([metadata.thumbnailAssetId, metadata.coverAssetId, ...collectArticleAssetIds(document)].filter((id): id is string => Boolean(id)))];
}

export async function ensureReadyAssets(db: D1Database, ids: string[]) {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.prepare(`SELECT id FROM media_assets WHERE id IN (${placeholders}) AND state = 'ready' AND deleted_at IS NULL`).bind(...ids).all<{ id: string }>();
  const found = new Set((result.results ?? []).map(row => row.id));
  const missing = ids.filter(id => !found.has(id));
  if (missing.length) throw new ApiException(400, "MEDIA_NOT_READY", "One or more media assets are missing or not ready.",
    missing.map(id => ({ path: "$.metadata.thumbnailAssetId", message: `Asset ${id} is not ready.` })));
}

function assetStatements(db: D1Database, projectId: string, ids: string[], version: number, updatedAt: string): D1PreparedStatement[] {
  return ids.map(id => db.prepare(`INSERT INTO draft_assets (project_id, asset_id)
    SELECT ?, ? WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND draft_version = ? AND updated_at = ?)
    ON CONFLICT(project_id, asset_id) DO NOTHING`).bind(projectId, id, projectId, version, updatedAt));
}

function auditStatement(db: D1Database, actor: Actor, action: string, projectId: string, requestId: string, version: number, updatedAt: string) {
  const auditId = `${projectId}:${action}:${version}`;
  return db.prepare(`INSERT OR IGNORE INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
    SELECT ?, ?, ?, 'project', ?, ?, ?, ? WHERE EXISTS
    (SELECT 1 FROM projects WHERE id = ? AND draft_version = ? AND updated_at = ?)`)
    .bind(auditId, actor.sub, action, projectId, requestId, JSON.stringify({ version }), updatedAt, projectId, version, updatedAt);
}

function decodeCursor(value: string | null): { updatedAt: string; id: string } | null {
  if (!value) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed: unknown = JSON.parse(atob(padded));
    if (isRecord(parsed) && typeof parsed.updatedAt === "string" && typeof parsed.id === "string") return { updatedAt: parsed.updatedAt, id: parsed.id };
    throw new Error("Invalid cursor shape");
  } catch { throw new ApiException(400, "INVALID_CURSOR", "Pagination cursor is invalid."); }
}

function encodeCursor(row: ProjectRow) {
  return btoa(JSON.stringify({ updatedAt: row.updated_at, id: row.id })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function listProjects(db: D1Database, url: URL): Promise<AdminProjectPage> {
  const limitValue = Number(url.searchParams.get("limit") ?? 24);
  if (!Number.isSafeInteger(limitValue) || limitValue < 1 || limitValue > 48) throw new ApiException(400, "INVALID_LIMIT", "Limit must be an integer from 1 to 48.");
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 120) throw new ApiException(400, "INVALID_SEARCH", "Search must contain at most 120 characters.");
  const state = url.searchParams.get("state");
  if (state && !["draft", "published", "unpublished-changes", "trash"].includes(state)) throw new ApiException(400, "INVALID_STATE", "Project state filter is invalid.");
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const stateSql = `CASE WHEN p.deleted_at IS NOT NULL THEN 'trash' WHEN pp.revision_id IS NULL THEN 'draft'
    WHEN pr.source_version = p.draft_version THEN 'published' ELSE 'unpublished-changes' END`;
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (!state) clauses.push("p.deleted_at IS NULL");
  else { clauses.push(`${stateSql} = ?`); values.push(state); }
  if (query) {
    clauses.push("lower(p.draft_meta_json) LIKE ? ESCAPE '\\'");
    values.push(`%${query.toLowerCase().replace(/[\\%_]/g, character => `\\${character}`)}%`);
  }
  if (cursor) { clauses.push("(p.updated_at < ? OR (p.updated_at = ? AND p.id > ?))"); values.push(cursor.updatedAt, cursor.updatedAt, cursor.id); }
  const result = await db.prepare(`${projectSelect} WHERE ${clauses.join(" AND ")} ORDER BY p.updated_at DESC, p.id ASC LIMIT ?`)
    .bind(...values, limitValue + 1).all<ProjectRow>();
  const rows = result.results ?? [];
  const hasMore = rows.length > limitValue;
  const visible = rows.slice(0, limitValue);
  return { items: visible.map(row => summaryOf(parseRow(row))), nextCursor: hasMore ? encodeCursor(visible[visible.length - 1]) : null };
}

export async function getProject(db: D1Database, projectId: string): Promise<AdminProject> {
  const row = await db.prepare(`${projectSelect} WHERE p.id = ?`).bind(projectId).first<ProjectRow>();
  if (!row) throw new ApiException(404, "PROJECT_NOT_FOUND", "Project was not found.");
  return parseRow(row);
}

export async function createProject(db: D1Database, request: Request, actor: Actor, requestId: string) {
  const body = await readJson(request);
  if (!isRecord(body)) throw new ApiException(400, "INVALID_INPUT", "Project input must be an object.");
  const validation = validateProjectMetadata(body.metadata);
  if (!validation.ok) throw new ApiException(400, "VALIDATION_FAILED", "Project metadata is invalid.", validation.issues);
  const slug = body.slug === undefined ? slugify(validation.value.title) : typeof body.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new ApiException(400, "INVALID_SLUG", "Slug must use lowercase letters, numbers and single hyphens.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const assets = projectAssetIds(validation.value, emptyArticleDocument);
  await ensureReadyAssets(db, assets);
  try {
    await db.batch([
      db.prepare(`INSERT INTO projects (id, slug, draft_meta_json, draft_body_json, draft_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)`).bind(id, slug, JSON.stringify(validation.value), JSON.stringify(emptyArticleDocument), now, now),
      ...assetStatements(db, id, assets, 1, now),
      auditStatement(db, actor, "project.create", id, requestId, 1, now),
    ]);
  } catch { throw new ApiException(409, "PROJECT_CONFLICT", "Project ID or slug already exists."); }
  return getProject(db, id);
}

export async function saveDraft(db: D1Database, projectId: string, request: Request, actor: Actor, requestId: string) {
  const validation = validateSaveProjectDraftInput(await readJson(request));
  if (!validation.ok) throw new ApiException(400, "VALIDATION_FAILED", "Draft input is invalid.", validation.issues);
  const assets = projectAssetIds(validation.value.metadata, validation.value.document);
  await ensureReadyAssets(db, assets);
  const now = new Date().toISOString();
  const nextVersion = validation.value.expectedVersion + 1;
  const results = await db.batch([
    db.prepare(`UPDATE projects SET draft_meta_json = ?, draft_body_json = ?, draft_version = ?, updated_at = ?
      WHERE id = ? AND draft_version = ? AND deleted_at IS NULL`)
      .bind(JSON.stringify(validation.value.metadata), JSON.stringify(validation.value.document), nextVersion, now, projectId, validation.value.expectedVersion),
    db.prepare(`DELETE FROM draft_assets WHERE project_id = ? AND EXISTS
      (SELECT 1 FROM projects WHERE id = ? AND draft_version = ? AND updated_at = ?)`)
      .bind(projectId, projectId, nextVersion, now),
    ...assetStatements(db, projectId, assets, nextVersion, now),
    auditStatement(db, actor, "project.draft.save", projectId, requestId, nextVersion, now),
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new ApiException(409, "VERSION_CONFLICT", "Draft changed in another session. Reload before saving.");
  return getProject(db, projectId);
}

export async function deleteProject(db: D1Database, projectId: string, actor: Actor, requestId: string) {
  const current = await getProject(db, projectId);
  if (current.state === "trash") throw new ApiException(409, "ALREADY_TRASHED", "Project is already in trash.");
  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const results = await db.batch([
    db.prepare("UPDATE projects SET deleted_at = ?, updated_at = ?, draft_version = ? WHERE id = ? AND deleted_at IS NULL AND draft_version = ?")
      .bind(now, now, nextVersion, projectId, current.version),
    db.prepare("DELETE FROM public_projects WHERE project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND deleted_at = ?)").bind(projectId, projectId, now),
    auditStatement(db, actor, "project.trash", projectId, requestId, nextVersion, now),
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new ApiException(409, "VERSION_CONFLICT", "Project changed before it could be moved to trash.");
  return getProject(db, projectId);
}

export async function restoreProject(db: D1Database, projectId: string, actor: Actor, requestId: string) {
  const current = await getProject(db, projectId);
  if (current.state !== "trash") throw new ApiException(409, "PROJECT_NOT_TRASHED", "Only trashed projects can be restored.");
  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const results = await db.batch([
    db.prepare("UPDATE projects SET deleted_at = NULL, updated_at = ?, draft_version = ? WHERE id = ? AND deleted_at IS NOT NULL AND draft_version = ?")
      .bind(now, nextVersion, projectId, current.version),
    auditStatement(db, actor, "project.restore", projectId, requestId, nextVersion, now),
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new ApiException(409, "VERSION_CONFLICT", "Project changed before it could be restored.");
  return getProject(db, projectId);
}
