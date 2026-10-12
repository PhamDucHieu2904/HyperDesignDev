import type { AdminMediaAsset, AdminMediaPage, MediaAssetState } from "../../../shared/contracts";
import { ApiException, isRecord, readJson } from "./http";
import type { Actor, D1Database, R2Bucket } from "./types";

type MediaRow = {
  id: string; object_key: string; original_name: string; mime: string; bytes: number;
  width: number | null; height: number | null; alt_default: string; checksum: string | null;
  state: MediaAssetState; created_at: string; deleted_at: string | null;
  draft_usage_count: number; revision_usage_count: number;
};

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const videoMimes = new Set(["video/mp4", "video/webm"]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
  "video/mp4": "mp4", "video/webm": "webm",
};
const mediaSelect = `SELECT m.id, m.object_key, m.original_name, m.mime, m.bytes, m.width, m.height,
  m.alt_default, m.checksum, m.state, m.created_at, m.deleted_at,
  (SELECT COUNT(*) FROM draft_assets da WHERE da.asset_id = m.id) AS draft_usage_count,
  (SELECT COUNT(*) FROM revision_assets ra WHERE ra.asset_id = m.id) AS revision_usage_count
  FROM media_assets m`;

function parseMedia(row: MediaRow): AdminMediaAsset {
  return {
    id: row.id, originalName: row.original_name, mime: row.mime, bytes: row.bytes,
    width: row.width, height: row.height, altDefault: row.alt_default, checksum: row.checksum,
    state: row.state, createdAt: row.created_at,
    draftUsageCount: Number(row.draft_usage_count), revisionUsageCount: Number(row.revision_usage_count),
    contentUrl: `/api/admin/media/${encodeURIComponent(row.id)}/content`,
  };
}

async function getMediaRow(db: D1Database, id: string, includeDeleted = false) {
  const row = await db.prepare(`${mediaSelect} WHERE m.id = ?${includeDeleted ? "" : " AND m.deleted_at IS NULL"}`).bind(id).first<MediaRow>();
  if (!row) throw new ApiException(404, "MEDIA_NOT_FOUND", "Media asset was not found.");
  return row;
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

function encodeCursor(row: MediaRow) {
  return btoa(JSON.stringify({ createdAt: row.created_at, id: row.id })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function listMedia(db: D1Database, url: URL): Promise<AdminMediaPage> {
  const limit = Number(url.searchParams.get("limit") ?? 24);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 48) throw new ApiException(400, "INVALID_LIMIT", "Limit must be an integer from 1 to 48.");
  const query = (url.searchParams.get("q") ?? "").trim();
  if (query.length > 120) throw new ApiException(400, "INVALID_SEARCH", "Search must contain at most 120 characters.");
  const state = url.searchParams.get("state");
  if (state && !["pending", "ready", "failed"].includes(state)) throw new ApiException(400, "INVALID_STATE", "Media state filter is invalid.");
  const type = url.searchParams.get("type");
  if (type && !["image", "video"].includes(type)) throw new ApiException(400, "INVALID_TYPE", "Media type filter is invalid.");
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const clauses = ["m.deleted_at IS NULL"];
  const values: unknown[] = [];
  if (state) { clauses.push("m.state = ?"); values.push(state); }
  if (type) { clauses.push("m.mime LIKE ?"); values.push(`${type}/%`); }
  if (query) {
    clauses.push("(lower(m.original_name) LIKE ? ESCAPE '\\' OR lower(m.alt_default) LIKE ? ESCAPE '\\')");
    const escaped = `%${query.toLowerCase().replace(/[\\%_]/g, character => `\\${character}`)}%`;
    values.push(escaped, escaped);
  }
  if (cursor) { clauses.push("(m.created_at < ? OR (m.created_at = ? AND m.id > ?))"); values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
  const result = await db.prepare(`${mediaSelect} WHERE ${clauses.join(" AND ")} ORDER BY m.created_at DESC, m.id ASC LIMIT ?`)
    .bind(...values, limit + 1).all<MediaRow>();
  const rows = result.results ?? [];
  const visible = rows.slice(0, limit);
  return { items: visible.map(row => parseMedia(row)), nextCursor: rows.length > limit ? encodeCursor(visible[visible.length - 1]) : null };
}

function cleanName(value: string) {
  const name = value.replaceAll("\\", "/").split("/").pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim() ?? "";
  if (!name || name.length > 255) throw new ApiException(400, "INVALID_FILE_NAME", "File name must contain 1–255 characters.");
  return name;
}

function readU24LE(view: DataView, offset: number) {
  return view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
}

function imageDimensions(bytes: Uint8Array, mime: string): [number, number] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png" && bytes.length >= 24) return [view.getUint32(16), view.getUint32(20)];
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      }
      if (offset + 4 > bytes.length) break;
      const size = view.getUint16(offset + 2);
      if (size < 2) break;
      offset += 2 + size;
    }
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") return [1 + readU24LE(view, 24), 1 + readU24LE(view, 27)];
    if (chunk === "VP8 " && bytes.length >= 30) return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    if (chunk === "VP8L" && bytes.length >= 25) {
      const bits = view.getUint32(21, true);
      return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
    }
  }
  if (mime === "image/avif") {
    for (let offset = 0; offset + 12 <= bytes.length; offset += 1) {
      if (String.fromCharCode(...bytes.slice(offset, offset + 4)) === "ispe") return [view.getUint32(offset + 4), view.getUint32(offset + 8)];
    }
  }
  return null;
}

function hasExpectedSignature(bytes: Uint8Array, mime: string) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 4) === "PNG";
  if (mime === "image/webp") return bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (mime === "image/avif") return bytes.length >= 16 && ascii(4, 8) === "ftyp" && [ascii(8, 12), ascii(12, 16)].some(brand => brand === "avif" || brand === "avis");
  if (mime === "video/mp4") return bytes.length >= 12 && ascii(4, 8) === "ftyp";
  if (mime === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return false;
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

function mediaAuditId(actor: Actor, requestId: string, action: string) {
  return `media:${actor.sub}:${requestId}:${action}`;
}

export async function uploadMedia(db: D1Database, bucket: R2Bucket, request: Request, actor: Actor, requestId: string) {
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiException(415, "UNSUPPORTED_MEDIA_TYPE", "Media uploads must use multipart/form-data.");
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 26 * 1024 * 1024) throw new ApiException(413, "PAYLOAD_TOO_LARGE", "Upload request is too large.");
  let form: FormData;
  try { form = await request.formData(); } catch { throw new ApiException(400, "INVALID_MULTIPART", "Upload form could not be read."); }
  const entry = form.get("file");
  if (!(entry instanceof File)) throw new ApiException(400, "FILE_REQUIRED", "A file field is required.");
  const mime = entry.type.toLowerCase();
  if (!imageMimes.has(mime) && !videoMimes.has(mime)) throw new ApiException(415, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, WebP, AVIF, MP4 and WebM files are supported.");
  const maxBytes = imageMimes.has(mime) ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
  if (entry.size < 1 || entry.size > maxBytes) throw new ApiException(413, "FILE_TOO_LARGE", imageMimes.has(mime) ? "Images must be 10 MB or smaller." : "Videos must be 25 MB or smaller.");
  const altDefault = String(form.get("altDefault") ?? "").trim();
  if (altDefault.length > 500) throw new ApiException(400, "INVALID_ALT", "Default alt text must contain at most 500 characters.");
  const originalName = cleanName(entry.name);
  const buffer = await entry.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!hasExpectedSignature(bytes, mime)) throw new ApiException(400, "FILE_SIGNATURE_MISMATCH", "File contents do not match the declared media type.");
  const dimensions = imageMimes.has(mime) ? imageDimensions(bytes, mime) : null;
  if (imageMimes.has(mime) && (!dimensions || dimensions[0] < 1 || dimensions[1] < 1)) throw new ApiException(400, "IMAGE_DIMENSIONS_UNREADABLE", "Image dimensions could not be read.");
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const checksum = toHex(new Uint8Array(digest));

  const priorAudit = await db.prepare("SELECT entity_id FROM audit_events WHERE actor_sub = ? AND request_id = ? AND action = 'media.upload.request' LIMIT 1")
    .bind(actor.sub, requestId).first<{ entity_id: string }>();
  let id = priorAudit?.entity_id;
  let objectKey: string;
  if (id) {
    const existing = await getMediaRow(db, id);
    if (existing.checksum !== checksum || existing.mime !== mime || existing.bytes !== entry.size) {
      throw new ApiException(409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for a different file.");
    }
    if (existing.state === "ready") return parseMedia(existing);
    objectKey = existing.object_key;
    await db.prepare("UPDATE media_assets SET state = 'pending' WHERE id = ? AND deleted_at IS NULL").bind(id).run();
  } else {
    id = crypto.randomUUID();
    const now = new Date().toISOString();
    objectKey = `original/${now.slice(0, 7).replace("-", "/")}/${id}.${extensions[mime]}`;
    await db.batch([
      db.prepare(`INSERT INTO media_assets
        (id, object_key, original_name, mime, bytes, width, height, alt_default, checksum, state, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
        .bind(id, objectKey, originalName, mime, entry.size, dimensions?.[0] ?? null, dimensions?.[1] ?? null, altDefault, checksum, actor.sub, now),
      db.prepare(`INSERT INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
        VALUES (?, ?, 'media.upload.request', 'media', ?, ?, ?, ?)`)
        .bind(mediaAuditId(actor, requestId, "request"), actor.sub, id, requestId, JSON.stringify({ bytes: entry.size, mime }), now),
    ]);
  }

  try {
    const stored = await bucket.put(objectKey, buffer, {
      httpMetadata: { contentType: mime, contentDisposition: "inline", cacheControl: "private, no-store" },
      customMetadata: { assetId: id, originalName, checksum }, sha256: digest,
    });
    const verified = stored ?? await bucket.head(objectKey);
    if (!verified || verified.size !== entry.size) throw new Error("R2 verification failed");
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE media_assets SET state = 'ready' WHERE id = ? AND state = 'pending' AND deleted_at IS NULL").bind(id),
      db.prepare(`INSERT OR IGNORE INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
        VALUES (?, ?, 'media.upload.ready', 'media', ?, ?, ?, ?)`)
        .bind(mediaAuditId(actor, requestId, "ready"), actor.sub, id, requestId, JSON.stringify({ objectKey }), now),
    ]);
  } catch (error) {
    await db.prepare("UPDATE media_assets SET state = 'failed' WHERE id = ? AND state = 'pending'").bind(id).run();
    console.error("R2 upload failed", { requestId, assetId: id, error });
    throw new ApiException(503, "MEDIA_UPLOAD_FAILED", "Media upload failed and can be retried with the same request ID.");
  }
  return parseMedia(await getMediaRow(db, id));
}

export async function getMediaContent(db: D1Database, bucket: R2Bucket, id: string) {
  const row = await getMediaRow(db, id);
  if (row.state !== "ready") throw new ApiException(409, "MEDIA_NOT_READY", "Media asset is not ready.");
  const object = await bucket.get(row.object_key);
  if (!object?.body) throw new ApiException(404, "MEDIA_OBJECT_MISSING", "Media object is missing from storage.");
  const headers = new Headers({
    "Content-Type": row.mime, "Content-Length": String(object.size), "Cache-Control": "private, no-store",
    "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff",
  });
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

export async function updateMedia(db: D1Database, id: string, request: Request, actor: Actor, requestId: string) {
  const body = await readJson(request, 16 * 1024);
  if (!isRecord(body)) throw new ApiException(400, "INVALID_INPUT", "Media metadata must be an object.");
  if (body.originalName === undefined && body.altDefault === undefined) throw new ApiException(400, "INVALID_INPUT", "Provide originalName or altDefault.");
  if (body.originalName !== undefined && typeof body.originalName !== "string") throw new ApiException(400, "INVALID_FILE_NAME", "File name must be a string.");
  if (body.altDefault !== undefined && typeof body.altDefault !== "string") throw new ApiException(400, "INVALID_ALT", "Default alt text must be a string.");
  const current = await getMediaRow(db, id);
  const originalName = body.originalName === undefined ? current.original_name : cleanName(body.originalName as string);
  const altDefault = body.altDefault === undefined ? current.alt_default : (body.altDefault as string).trim();
  if (!originalName) throw new ApiException(400, "INVALID_FILE_NAME", "File name is invalid.");
  if (altDefault.length > 500) throw new ApiException(400, "INVALID_ALT", "Default alt text must contain at most 500 characters.");
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE media_assets SET original_name = ?, alt_default = ? WHERE id = ? AND deleted_at IS NULL").bind(originalName, altDefault, id),
    db.prepare(`INSERT OR IGNORE INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
      VALUES (?, ?, 'media.metadata.update', 'media', ?, ?, '{}', ?)`)
      .bind(mediaAuditId(actor, requestId, "metadata"), actor.sub, id, requestId, now),
  ]);
  return parseMedia(await getMediaRow(db, id));
}

export async function deleteMedia(db: D1Database, bucket: R2Bucket, id: string, actor: Actor, requestId: string) {
  const current = await getMediaRow(db, id);
  if (current.draft_usage_count || current.revision_usage_count) {
    throw new ApiException(409, "MEDIA_IN_USE", `Media is referenced by ${current.draft_usage_count} draft(s) and ${current.revision_usage_count} revision(s).`);
  }
  const now = new Date().toISOString();
  const result = await db.prepare(`UPDATE media_assets SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM draft_assets WHERE asset_id = ?)
    AND NOT EXISTS (SELECT 1 FROM revision_assets WHERE asset_id = ?)`)
    .bind(now, id, id, id).run();
  if ((result.meta?.changes ?? 0) !== 1) throw new ApiException(409, "MEDIA_IN_USE", "Media became referenced before it could be deleted.");
  try { await bucket.delete(current.object_key); }
  catch (error) {
    await db.prepare("UPDATE media_assets SET deleted_at = NULL WHERE id = ? AND deleted_at = ?").bind(id, now).run();
    console.error("R2 delete failed", { requestId, assetId: id, error });
    throw new ApiException(503, "MEDIA_DELETE_FAILED", "Media could not be deleted from storage.");
  }
  await db.prepare(`INSERT OR IGNORE INTO audit_events (id, actor_sub, action, entity_type, entity_id, request_id, detail_json, created_at)
    VALUES (?, ?, 'media.delete', 'media', ?, ?, '{}', ?)`)
    .bind(mediaAuditId(actor, requestId, "delete"), actor.sub, id, requestId, now).run();
}
