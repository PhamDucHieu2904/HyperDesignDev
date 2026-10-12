import {
  normalizeSearchText, validateArticleDocument, validateProjectMetadata, validatePublishProjectInput,
  validateRestoreProjectRevisionInput, type AdminRevision, type AdminRevisionPage, type AdminRevisionSummary,
  type ContentState, type PublishProjectResult,
} from "../../../shared/contracts";
import { ApiException, isRecord, readJson } from "./http";
import { ensureReadyAssets, getProject, projectAssetIds } from "./projects";
import type { Actor, D1Database, D1PreparedStatement } from "./types";

type RevisionRow = {
  id: string; project_id: string; source_version: number; meta_json: string; body_json: string;
  schema_version: number; created_by: string; created_at: string; is_public: number;
};

const revisionSelect = `SELECT r.id, r.project_id, r.source_version, r.meta_json, r.body_json,
  r.schema_version, r.created_by, r.created_at,
  CASE WHEN pp.revision_id = r.id THEN 1 ELSE 0 END AS is_public
  FROM project_revisions r LEFT JOIN public_projects pp ON pp.project_id = r.project_id`;

function contentState(bodyJson: string): ContentState {
  try {
    const body: unknown = JSON.parse(bodyJson);
    return isRecord(body) && Array.isArray(body.blocks) && body.blocks.length > 0 ? "ready" : "empty";
  } catch { return "empty"; }
}

function revisionSummary(row: RevisionRow): AdminRevisionSummary {
  return {
    id: row.id, sourceVersion: row.source_version, schemaVersion: row.schema_version,
    contentState: contentState(row.body_json), createdBy: row.created_by, createdAt: row.created_at,
    isPublic: row.is_public === 1,
  };
}

async function getRevision(db: D1Database, projectId: string, revisionId: string) {
  const row = await db.prepare(`${revisionSelect} WHERE r.project_id = ? AND r.id = ?`).bind(projectId, revisionId).first<RevisionRow>();
  if (!row) throw new ApiException(404, "REVISION_NOT_FOUND", "Project revision was not found.");
  return row;
}

export async function getRevisionDetail(db: D1Database, projectId: string, revisionId: string): Promise<AdminRevision> {
  await getProject(db, projectId);
  const row = await getRevision(db, projectId, revisionId);
  const metadata = validateProjectMetadata(JSON.parse(row.meta_json));
  const document = validateArticleDocument(JSON.parse(row.body_json));
  if (!metadata.ok || !document.ok) throw new ApiException(503, "REVISION_INVALID", "This revision cannot be previewed because its stored content is invalid.");
  return { ...revisionSummary(row), metadata: metadata.value, document: document.value };
}

function decodeCursor(value: string | null): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed: unknown = JSON.parse(atob(padded));
    if (isRecord(parsed) && typeof parsed.createdAt === "string" && typeof parsed.id === "string") return { createdAt: parsed.createdAt, id: parsed.id };
  } catch { /* handled below */ }
  throw new ApiException(400, "INVALID_CURSOR", "Pagination cursor is invalid.");
}

function encodeCursor(row: RevisionRow) {
  return btoa(JSON.stringify({ createdAt: row.created_at, id: row.id })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function listRevisions(db: D1Database, projectId: string, url: URL): Promise<AdminRevisionPage> {
  await getProject(db, projectId);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 48) throw new ApiException(400, "INVALID_LIMIT", "Limit must be an integer from 1 to 48.");
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const clauses = ["r.project_id = ?"];
  const values: unknown[] = [projectId];
  if (cursor) { clauses.push("(r.created_at < ? OR (r.created_at = ? AND r.id > ?))"); values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
  const result = await db.prepare(`${revisionSelect} WHERE ${clauses.join(" AND ")} ORDER BY r.created_at DESC, r.id ASC LIMIT ?`)
    .bind(...values, limit + 1).all<RevisionRow>();
  const rows = result.results ?? [];
  const visible = rows.slice(0, limit);
  return { items: visible.map(revisionSummary), nextCursor: rows.length > limit ? encodeCursor(visible[visible.length - 1]) : null };
}

function auditId(actor: Actor, requestId: string, action: string) {
  return `project:${actor.sub}:${requestId}:${action}`;
}

function readyAssetGuard(assetIds: string[]) {
  const placeholders = assetIds.map(() => "?").join(",");
  return `(SELECT COUNT(*) FROM media_assets m WHERE m.id IN (${placeholders})
    AND m.state = 'ready' AND m.deleted_at IS NULL) = ?`;
}

export async function publishProject(db: D1Database, projectId: string, request: Request, actor: Actor): Promise<PublishProjectResult> {
  const validation = validatePublishProjectInput(await readJson(request, 16 * 1024));
  if (!validation.ok) throw new ApiException(400, "VALIDATION_FAILED", "Publish input is invalid.", validation.issues);
  const { expectedVersion, requestId } = validation.value;

  const prior = await db.prepare(`SELECT entity_id, detail_json FROM audit_events
    WHERE actor_sub = ? AND request_id = ? AND action = 'project.publish' LIMIT 1`)
    .bind(actor.sub, requestId).first<{ entity_id: string; detail_json: string }>();
  if (prior) {
    if (prior.entity_id !== projectId) throw new ApiException(409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for another project.");
    const detail: unknown = JSON.parse(prior.detail_json);
    if (!isRecord(detail) || typeof detail.revisionId !== "string" || detail.sourceVersion !== expectedVersion) {
      throw new ApiException(409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for another publish operation.");
    }
    return { project: await getProject(db, projectId), revision: revisionSummary(await getRevision(db, projectId, detail.revisionId)) };
  }

  const project = await getProject(db, projectId);
  if (project.state === "trash") throw new ApiException(409, "PROJECT_TRASHED", "A trashed project cannot be published.");
  if (project.version !== expectedVersion) throw new ApiException(409, "VERSION_CONFLICT", "Draft changed before it could be published. Reload before publishing.");
  const metadataValidation = validateProjectMetadata(project.metadata);
  const documentValidation = validateArticleDocument(project.document);
  if (!metadataValidation.ok || !documentValidation.ok) {
    throw new ApiException(400, "VALIDATION_FAILED", "Draft is not valid enough to publish.", [
      ...(!metadataValidation.ok ? metadataValidation.issues.map(issue => ({ ...issue, path: `$.metadata${issue.path.slice(1)}` })) : []),
      ...(!documentValidation.ok ? documentValidation.issues.map(issue => ({ ...issue, path: `$.document${issue.path.slice(1)}` })) : []),
    ]);
  }
  const metadata = metadataValidation.value;
  const document = documentValidation.value;
  const assetIds = projectAssetIds(metadata, document);
  await ensureReadyAssets(db, assetIds);

  const existing = await db.prepare(`${revisionSelect} WHERE r.project_id = ? AND r.source_version = ?`).bind(projectId, expectedVersion).first<RevisionRow>();
  if (project.publicRevisionId && existing?.id === project.publicRevisionId) return { project, revision: revisionSummary(existing) };
  const revisionId = existing?.id ?? `${projectId}:v${expectedVersion}`;
  const now = new Date().toISOString();
  const searchText = normalizeSearchText([metadata.title, metadata.shortTitle, metadata.subtitle, ...metadata.tags, ...metadata.tools].join(" "));
  const state: ContentState = document.blocks.length ? "ready" : "empty";
  const guard = db.prepare(`UPDATE projects SET draft_version = draft_version WHERE id = ? AND draft_version = ? AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM categories WHERE id = ?) AND ${readyAssetGuard(assetIds)}`)
    .bind(projectId, expectedVersion, metadata.categoryId, ...assetIds, assetIds.length);
  const statements: D1PreparedStatement[] = [
    guard,
    db.prepare(`INSERT OR IGNORE INTO project_revisions
      (id, project_id, source_version, meta_json, body_json, schema_version, created_by, created_at)
      SELECT ?, p.id, p.draft_version, p.draft_meta_json, p.draft_body_json, ?, ?, ? FROM projects p
      WHERE p.id = ? AND p.draft_version = ? AND p.deleted_at IS NULL`)
      .bind(revisionId, document.schemaVersion, actor.sub, now, projectId, expectedVersion),
    ...assetIds.map(assetId => db.prepare(`INSERT OR IGNORE INTO revision_assets (revision_id, asset_id)
      SELECT ?, m.id FROM media_assets m WHERE m.id = ? AND m.state = 'ready' AND m.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM project_revisions r WHERE r.id = ? AND r.project_id = ? AND r.source_version = ?)`)
      .bind(revisionId, assetId, revisionId, projectId, expectedVersion)),
    db.prepare(`INSERT INTO public_projects
      (project_id, revision_id, category_id, title, short_title, subtitle, thumbnail_asset_id, sort_order,
       is_featured, search_text, content_state, published_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS
      (SELECT 1 FROM project_revisions r WHERE r.id = ? AND r.project_id = ? AND r.source_version = ?)
      ON CONFLICT(project_id) DO UPDATE SET revision_id = excluded.revision_id, category_id = excluded.category_id,
      title = excluded.title, short_title = excluded.short_title, subtitle = excluded.subtitle,
      thumbnail_asset_id = excluded.thumbnail_asset_id, sort_order = excluded.sort_order,
      is_featured = excluded.is_featured, search_text = excluded.search_text,
      content_state = excluded.content_state, published_at = excluded.published_at`)
      .bind(projectId, revisionId, metadata.categoryId, metadata.title, metadata.shortTitle, metadata.subtitle,
        metadata.thumbnailAssetId, metadata.sortOrder, metadata.isFeatured ? 1 : 0, searchText, state, now,
        revisionId, projectId, expectedVersion),
    db.prepare(`INSERT INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
      SELECT ?, ?, 'project.publish', 'project', ?, ?, ?, ? WHERE EXISTS
      (SELECT 1 FROM public_projects WHERE project_id = ? AND revision_id = ?)`)
      .bind(auditId(actor, requestId, "publish"), actor.sub, projectId, requestId,
        JSON.stringify({ revisionId, sourceVersion: expectedVersion }), now, projectId, revisionId),
  ];
  const results = await db.batch(statements);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new ApiException(409, "VERSION_CONFLICT", "Draft or media changed before publish completed. Reload before publishing.");
  return { project: await getProject(db, projectId), revision: revisionSummary(await getRevision(db, projectId, revisionId)) };
}

export async function unpublishProject(db: D1Database, projectId: string, actor: Actor, requestId: string) {
  const current = await getProject(db, projectId);
  if (current.state === "trash") throw new ApiException(409, "PROJECT_TRASHED", "A trashed project cannot be unpublished.");
  if (!current.publicRevisionId) return current;
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare("DELETE FROM public_projects WHERE project_id = ?").bind(projectId),
    db.prepare(`INSERT INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
      SELECT ?, ?, 'project.unpublish', 'project', ?, ?, ?, ? WHERE changes() = 1`)
      .bind(auditId(actor, requestId, "unpublish"), actor.sub, projectId, requestId,
        JSON.stringify({ revisionId: current.publicRevisionId }), now),
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new ApiException(409, "PUBLICATION_CONFLICT", "Project publication changed before it could be removed.");
  return getProject(db, projectId);
}

export async function restoreRevision(db: D1Database, projectId: string, revisionId: string, request: Request, actor: Actor, requestId: string) {
  const validation = validateRestoreProjectRevisionInput(await readJson(request, 16 * 1024));
  if (!validation.ok) throw new ApiException(400, "VALIDATION_FAILED", "Revision restore input is invalid.", validation.issues);
  const current = await getProject(db, projectId);
  if (current.state === "trash") throw new ApiException(409, "PROJECT_TRASHED", "Restore the project from trash before restoring a revision.");
  if (current.version !== validation.value.expectedVersion) throw new ApiException(409, "VERSION_CONFLICT", "Draft changed before the revision could be restored.");
  await getRevision(db, projectId, revisionId);
  const now = new Date().toISOString();
  const nextVersion = current.version + 1;
  const results = await db.batch([
    db.prepare(`UPDATE projects SET draft_meta_json = (SELECT meta_json FROM project_revisions WHERE id = ? AND project_id = ?),
      draft_body_json = (SELECT body_json FROM project_revisions WHERE id = ? AND project_id = ?),
      draft_version = ?, updated_at = ? WHERE id = ? AND draft_version = ? AND deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM project_revisions WHERE id = ? AND project_id = ?)`)
      .bind(revisionId, projectId, revisionId, projectId, nextVersion, now, projectId, current.version, revisionId, projectId),
    db.prepare(`DELETE FROM draft_assets WHERE project_id = ? AND EXISTS
      (SELECT 1 FROM projects WHERE id = ? AND draft_version = ? AND updated_at = ?)`)
      .bind(projectId, projectId, nextVersion, now),
    db.prepare(`INSERT INTO draft_assets (project_id, asset_id)
      SELECT ?, ra.asset_id FROM revision_assets ra WHERE ra.revision_id = ? AND EXISTS
      (SELECT 1 FROM projects WHERE id = ? AND draft_version = ? AND updated_at = ?)`)
      .bind(projectId, revisionId, projectId, nextVersion, now),
    db.prepare(`INSERT OR IGNORE INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
      SELECT ?, ?, 'project.revision.restore', 'project', ?, ?, ?, ? WHERE EXISTS
      (SELECT 1 FROM projects WHERE id = ? AND draft_version = ? AND updated_at = ?)`)
      .bind(`${projectId}:project.revision.restore:${nextVersion}`, actor.sub, projectId, requestId,
        JSON.stringify({ revisionId, version: nextVersion }), now, projectId, nextVersion, now),
  ]);
  if ((results[0]?.meta?.changes ?? 0) !== 1) throw new ApiException(409, "VERSION_CONFLICT", "Draft changed before the revision could be restored.");
  return getProject(db, projectId);
}
