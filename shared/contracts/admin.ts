import {
  validateArticleDocument, validateProjectMetadata,
  type ArticleDocument, type ContentState, type MediaAssetState, type ProjectMetadata,
  type ValidationIssue, type ValidationResult,
} from "./portfolio";

export type ProjectAdminState = "draft" | "published" | "unpublished-changes" | "trash";

export type AdminProject = {
  id: string;
  slug: string;
  metadata: ProjectMetadata;
  document: ArticleDocument;
  contentState: ContentState;
  version: number;
  state: ProjectAdminState;
  publicRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProjectSummary = Omit<AdminProject, "document">;
export type AdminProjectPage = { items: AdminProjectSummary[]; nextCursor: string | null };

export type AdminRevisionSummary = {
  id: string;
  sourceVersion: number;
  schemaVersion: number;
  contentState: ContentState;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
};

export type AdminRevisionPage = { items: AdminRevisionSummary[]; nextCursor: string | null };
export type AdminRevision = AdminRevisionSummary & {
  metadata: ProjectMetadata;
  document: ArticleDocument;
};
export type PublishProjectResult = { project: AdminProject; revision: AdminRevisionSummary };

export type AdminMediaAsset = {
  id: string;
  originalName: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  altDefault: string;
  checksum: string | null;
  state: MediaAssetState;
  createdAt: string;
  draftUsageCount: number;
  revisionUsageCount: number;
  contentUrl: string;
};

export type AdminMediaPage = { items: AdminMediaAsset[]; nextCursor: string | null };

export type AdminIdentity = {
  sub: string;
  email: string;
  capabilities: Array<
    "project:read" | "project:write" | "project:trash" | "project:publish" |
    "revision:read" | "revision:restore" | "media:read" | "media:write" | "media:delete" | "analytics:read"
  >;
  csrfToken: string;
};

export type CreateProjectInput = { slug?: string; metadata: ProjectMetadata };
export type SaveProjectDraftInput = { expectedVersion: number; metadata: ProjectMetadata; document: ArticleDocument };
export type PublishProjectInput = { expectedVersion: number; requestId: string };
export type RestoreProjectRevisionInput = { expectedVersion: number };

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isSafeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

export function validateSaveProjectDraftInput(value: unknown): ValidationResult<SaveProjectDraftInput> {
  if (!isRecord(value)) return { ok: false, issues: [{ path: "$", message: "Must be an object." }] };
  const metadata = validateProjectMetadata(value.metadata);
  const document = validateArticleDocument(value.document);
  const issues: ValidationIssue[] = [];
  if (!metadata.ok) issues.push(...metadata.issues.map(issue => ({ ...issue, path: `$.metadata${issue.path.slice(1)}` })));
  if (!document.ok) issues.push(...document.issues.map(issue => ({ ...issue, path: `$.document${issue.path.slice(1)}` })));
  const expectedVersion = value.expectedVersion;
  if (!isSafeInteger(expectedVersion) || expectedVersion < 1) issues.push({ path: "$.expectedVersion", message: "Must be a positive integer." });
  if (issues.length || !metadata.ok || !document.ok) return { ok: false, issues };
  return { ok: true, value: { expectedVersion: expectedVersion as number, metadata: metadata.value, document: document.value } };
}

export function validatePublishProjectInput(value: unknown): ValidationResult<PublishProjectInput> {
  if (!isRecord(value)) return { ok: false, issues: [{ path: "$", message: "Must be an object." }] };
  const issues: ValidationIssue[] = [];
  const expectedVersion = value.expectedVersion;
  const requestId = value.requestId;
  if (!isSafeInteger(expectedVersion) || expectedVersion < 1) issues.push({ path: "$.expectedVersion", message: "Must be a positive integer." });
  if (typeof requestId !== "string" || !/^[a-zA-Z0-9._:-]{1,128}$/.test(requestId)) issues.push({ path: "$.requestId", message: "Must contain 1–128 safe identifier characters." });
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { expectedVersion: expectedVersion as number, requestId: requestId as string } };
}

export function validateRestoreProjectRevisionInput(value: unknown): ValidationResult<RestoreProjectRevisionInput> {
  if (!isRecord(value)) return { ok: false, issues: [{ path: "$", message: "Must be an object." }] };
  const expectedVersion = value.expectedVersion;
  if (!isSafeInteger(expectedVersion) || expectedVersion < 1) {
    return { ok: false, issues: [{ path: "$.expectedVersion", message: "Must be a positive integer." }] };
  }
  return { ok: true, value: { expectedVersion: expectedVersion as number } };
}
