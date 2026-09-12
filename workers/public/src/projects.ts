import {
  isCategoryId, normalizeSearchText, validateArticleDocument,
  validateProjectMetadata, type AdjacentProject, type AdjacentProjects, type CategoryId,
  type MediaDescriptor, type ProjectDetail, type ProjectMetadata, type ProjectPage, type ProjectSummary,
} from "../../../shared/contracts";
import { PublicApiException } from "./http";
import type { D1Database, R2Bucket } from "./types";

type PublicProjectRow = {
  project_id: string; slug: string; revision_id: string; category_id: CategoryId; category_sort: number;
  title: string; short_title: string; subtitle: string; thumbnail_asset_id: string;
  sort_order: number; is_featured: number; content_state: "empty" | "ready"; published_at: string;
  meta_json: string; body_json: string; thumbnail_mime: string; thumbnail_width: number | null;
  thumbnail_height: number | null; thumbnail_alt: string;
};

type MediaRow = { id: string; mime: string; width: number | null; height: number | null; alt_default: string };
type AdjacentRow = { project_id: string; slug: string; category_id: CategoryId; short_title: string; category_sort: number; sort_order: number };

const projectSelect = `SELECT pp.project_id, p.slug, pp.revision_id, pp.category_id, c.sort_order AS category_sort,
  pp.title, pp.short_title, pp.subtitle, pp.thumbnail_asset_id, pp.sort_order, pp.is_featured,
  pp.content_state, pp.published_at, pr.meta_json, pr.body_json,
  thumb.mime AS thumbnail_mime, thumb.width AS thumbnail_width, thumb.height AS thumbnail_height,
  thumb.alt_default AS thumbnail_alt
  FROM public_projects pp
  JOIN projects p ON p.id = pp.project_id AND p.deleted_at IS NULL
  JOIN categories c ON c.id = pp.category_id
  JOIN project_revisions pr ON pr.id = pp.revision_id AND pr.project_id = pp.project_id
  JOIN media_assets thumb ON thumb.id = pp.thumbnail_asset_id AND thumb.state = 'ready' AND thumb.deleted_at IS NULL`;

function descriptor(id: string, mime: string, width: number | null, height: number | null, alt: string): MediaDescriptor {
  return { id, url: `/media/${encodeURIComponent(id)}`, alt, mime, ...(width !== null && { width }), ...(height !== null && { height }) };
}

function summary(row: PublicProjectRow): ProjectSummary {
  return {
    id: row.project_id, slug: row.slug, categoryId: row.category_id, title: row.title,
    shortTitle: row.short_title, subtitle: row.subtitle,
    thumbnail: descriptor(row.thumbnail_asset_id, row.thumbnail_mime, row.thumbnail_width, row.thumbnail_height, row.thumbnail_alt),
    isFeatured: row.is_featured === 1, sortOrder: row.sort_order, contentState: row.content_state,
    revisionId: row.revision_id, publishedAt: row.published_at,
  };
}

type ProjectCursor = { category: string; query: string; categorySort: number; sortOrder: number; id: string };

function encodeCursor(row: PublicProjectRow, category: string, query: string) {
  return btoa(JSON.stringify({ category, query, categorySort: row.category_sort, sortOrder: row.sort_order, id: row.project_id }))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeCursor(value: string | null, category: string, query: string): ProjectCursor | null {
  if (!value) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed: unknown = JSON.parse(atob(padded));
    if (typeof parsed === "object" && parsed !== null) {
      const cursor = parsed as Partial<ProjectCursor>;
      if (cursor.category === category && cursor.query === query && Number.isSafeInteger(cursor.categorySort) &&
          Number.isSafeInteger(cursor.sortOrder) && typeof cursor.id === "string") return cursor as ProjectCursor;
    }
  } catch { /* handled below */ }
  throw new PublicApiException(400, "INVALID_CURSOR", "Pagination cursor is invalid or belongs to different filters.");
}

export async function listCategories(db: D1Database) {
  const result = await db.prepare("SELECT id, label, discipline, sort_order FROM categories ORDER BY sort_order ASC").all<{
    id: CategoryId; label: string; discipline: "design" | "development"; sort_order: number;
  }>();
  return (result.results ?? []).map(row => ({ id: row.id, label: row.label, discipline: row.discipline, sortOrder: row.sort_order }));
}

export async function listPublicProjects(db: D1Database, url: URL): Promise<ProjectPage> {
  const limit = Number(url.searchParams.get("limit") ?? 24);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 48) throw new PublicApiException(400, "INVALID_LIMIT", "Limit must be an integer from 1 to 48.");
  const category = (url.searchParams.get("category") ?? "").trim();
  if (category && !isCategoryId(category)) throw new PublicApiException(400, "INVALID_CATEGORY", "Category is not supported.");
  const rawQuery = (url.searchParams.get("q") ?? "").trim();
  if (rawQuery.length > 120) throw new PublicApiException(400, "INVALID_SEARCH", "Search must contain at most 120 characters.");
  const query = normalizeSearchText(rawQuery);
  const cursor = decodeCursor(url.searchParams.get("cursor"), category, query);
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (category) { clauses.push("pp.category_id = ?"); values.push(category); }
  if (query) {
    clauses.push("pp.search_text LIKE ? ESCAPE '\\'");
    values.push(`%${query.replace(/[\\%_]/g, character => `\\${character}`)}%`);
  }
  if (cursor) {
    clauses.push(`(c.sort_order > ? OR (c.sort_order = ? AND
      (pp.sort_order > ? OR (pp.sort_order = ? AND pp.project_id > ?))))`);
    values.push(cursor.categorySort, cursor.categorySort, cursor.sortOrder, cursor.sortOrder, cursor.id);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const result = await db.prepare(`${projectSelect}${where} ORDER BY c.sort_order ASC, pp.sort_order ASC, pp.project_id ASC LIMIT ?`)
    .bind(...values, limit + 1).all<PublicProjectRow>();
  const rows = result.results ?? [];
  const visible = rows.slice(0, limit);
  return { items: visible.map(summary), nextCursor: rows.length > limit ? encodeCursor(visible[visible.length - 1], category, query) : null };
}

export async function getPublicProject(db: D1Database, id: string): Promise<ProjectDetail> {
  const row = await db.prepare(`${projectSelect} WHERE pp.project_id = ?`).bind(id).first<PublicProjectRow>();
  if (!row) throw new PublicApiException(404, "PROJECT_NOT_FOUND", "Published project was not found.");
  let rawMetadata: unknown;
  let rawDocument: unknown;
  try { rawMetadata = JSON.parse(row.meta_json); rawDocument = JSON.parse(row.body_json); }
  catch { throw new PublicApiException(503, "CONTENT_UNAVAILABLE", "Published project content is temporarily unavailable."); }
  const metadata = validateProjectMetadata(rawMetadata);
  const document = validateArticleDocument(rawDocument);
  if (!metadata.ok || !document.ok) throw new PublicApiException(503, "CONTENT_UNSUPPORTED", "Published project uses an unsupported content schema.");
  const mediaResult = await db.prepare(`SELECT m.id, m.mime, m.width, m.height, m.alt_default
    FROM revision_assets ra JOIN media_assets m ON m.id = ra.asset_id
    WHERE ra.revision_id = ? AND m.state = 'ready' AND m.deleted_at IS NULL ORDER BY m.id ASC`)
    .bind(row.revision_id).all<MediaRow>();
  const media = (mediaResult.results ?? []).map(asset => descriptor(asset.id, asset.mime, asset.width, asset.height, asset.alt_default));
  const byId = new Map(media.map(asset => [asset.id, asset]));
  const meta: ProjectMetadata = metadata.value;
  return {
    ...summary(row), document: document.value, media,
    ...(meta.coverAssetId && byId.has(meta.coverAssetId) && { cover: byId.get(meta.coverAssetId) }),
    tags: meta.tags, tools: meta.tools, ...(meta.role !== undefined && { role: meta.role }), ...(meta.year !== undefined && { year: meta.year }),
  };
}

function adjacentValue(row: AdjacentRow | null): AdjacentProject | null {
  return row ? { id: row.project_id, slug: row.slug, categoryId: row.category_id, shortTitle: row.short_title } : null;
}

export async function getAdjacentProjects(db: D1Database, id: string): Promise<AdjacentProjects> {
  const current = await db.prepare(`SELECT pp.project_id, p.slug, pp.category_id, pp.short_title,
    c.sort_order AS category_sort, pp.sort_order FROM public_projects pp
    JOIN projects p ON p.id = pp.project_id AND p.deleted_at IS NULL JOIN categories c ON c.id = pp.category_id
    WHERE pp.project_id = ?`).bind(id).first<AdjacentRow>();
  if (!current) throw new PublicApiException(404, "PROJECT_NOT_FOUND", "Published project was not found.");
  const base = `SELECT pp.project_id, p.slug, pp.category_id, pp.short_title, c.sort_order AS category_sort, pp.sort_order
    FROM public_projects pp JOIN projects p ON p.id = pp.project_id AND p.deleted_at IS NULL
    JOIN categories c ON c.id = pp.category_id`;
  const previous = await db.prepare(`${base} WHERE c.sort_order < ? OR (c.sort_order = ? AND
    (pp.sort_order < ? OR (pp.sort_order = ? AND pp.project_id < ?)))
    ORDER BY c.sort_order DESC, pp.sort_order DESC, pp.project_id DESC LIMIT 1`)
    .bind(current.category_sort, current.category_sort, current.sort_order, current.sort_order, current.project_id).first<AdjacentRow>();
  const next = await db.prepare(`${base} WHERE c.sort_order > ? OR (c.sort_order = ? AND
    (pp.sort_order > ? OR (pp.sort_order = ? AND pp.project_id > ?)))
    ORDER BY c.sort_order ASC, pp.sort_order ASC, pp.project_id ASC LIMIT 1`)
    .bind(current.category_sort, current.category_sort, current.sort_order, current.sort_order, current.project_id).first<AdjacentRow>();
  return { previous: adjacentValue(previous), next: adjacentValue(next) };
}

export async function getPublicMedia(db: D1Database, bucket: R2Bucket, id: string, headOnly: boolean) {
  const row = await db.prepare(`SELECT m.object_key, m.mime, m.bytes FROM media_assets m
    WHERE m.id = ? AND m.state = 'ready' AND m.deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public_projects pp JOIN revision_assets ra ON ra.revision_id = pp.revision_id
      WHERE ra.asset_id = m.id
    )`).bind(id).first<{ object_key: string; mime: string; bytes: number }>();
  if (!row) throw new PublicApiException(404, "MEDIA_NOT_FOUND", "Published media was not found.");
  const object = headOnly ? await bucket.head(row.object_key) : await bucket.get(row.object_key);
  if (!object || (!headOnly && !object.body)) throw new PublicApiException(404, "MEDIA_OBJECT_MISSING", "Published media is missing from storage.");
  const headers = new Headers({
    "Content-Type": row.mime, "Content-Length": String(object.size), "Cache-Control": "public, max-age=60, must-revalidate",
    "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff",
  });
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  return new Response(headOnly ? null : object.body, { headers });
}
