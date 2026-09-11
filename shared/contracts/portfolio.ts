export const categoryDefinitions = [
  { id: "illustrator", label: "Brand", discipline: "design", sortOrder: 10 },
  { id: "photoshop", label: "Visual", discipline: "design", sortOrder: 20 },
  { id: "blender", label: "3D", discipline: "design", sortOrder: 30 },
  { id: "game", label: "Game", discipline: "development", sortOrder: 40 },
  { id: "web", label: "Web", discipline: "development", sortOrder: 50 },
  { id: "app", label: "App", discipline: "development", sortOrder: 60 },
] as const;

export type CategoryId = typeof categoryDefinitions[number]["id"];
export type Discipline = typeof categoryDefinitions[number]["discipline"];
export type ContentState = "empty" | "ready";
export type ProjectAdminState = "draft" | "published" | "unpublished-changes" | "trash";

const categoryIds = new Set<string>(categoryDefinitions.map(category => category.id));
export const isCategoryId = (value: unknown): value is CategoryId => typeof value === "string" && categoryIds.has(value);

export const articleSchemaVersion = 1 as const;
export const emptyArticleDocument: ArticleDocument = { schemaVersion: articleSchemaVersion, blocks: [] };
export const maxArticleBlocks = 200;
export const maxArticleJsonBytes = 512 * 1024;

export type BlockWidth = "reading" | "wide" | "full";
export type BlockBackground = "transparent" | "surface" | "accent";
export type BlockPadding = "none" | "sm" | "md" | "lg";

export type BlockStyle = {
  width?: BlockWidth;
  background?: BlockBackground;
  accentColor?: string;
  padding?: BlockPadding;
};

export type RichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
};

export type RichParagraph = { spans: RichSpan[] };
export type GalleryItem = { assetId: string; alt: string };
export type LinkItem = { label: string; url: string };

export type ArticleBlock =
  | { id: string; type: "text"; style?: BlockStyle; paragraphs: RichParagraph[] }
  | { id: string; type: "heading"; level: 2 | 3; text: string; style?: BlockStyle }
  | { id: string; type: "image"; assetId: string; alt: string; caption?: string; fit: "contain" | "cover"; style?: BlockStyle }
  | { id: string; type: "gallery"; items: GalleryItem[]; columns: 2 | 3; style?: BlockStyle }
  | { id: string; type: "columns"; columns: ArticleBlock[][]; style?: BlockStyle }
  | { id: string; type: "video"; assetId: string; posterAssetId: string; caption?: string; style?: BlockStyle }
  | { id: string; type: "links"; items: LinkItem[] }
  | { id: string; type: "spacer"; size: "sm" | "md" | "lg" };

export type ArticleDocument = {
  schemaVersion: typeof articleSchemaVersion;
  blocks: ArticleBlock[];
};

export type ProjectMetadata = {
  categoryId: CategoryId;
  title: string;
  shortTitle: string;
  subtitle: string;
  thumbnailAssetId: string;
  coverAssetId?: string;
  tags: string[];
  tools: string[];
  role?: string;
  year?: string;
  isFeatured: boolean;
  sortOrder: number;
};

export type MediaDescriptor = {
  id: string;
  url: string;
  alt: string;
  mime: string;
  width?: number;
  height?: number;
};

export type ProjectSummary = {
  id: string;
  slug: string;
  categoryId: CategoryId;
  title: string;
  shortTitle: string;
  subtitle: string;
  thumbnail: MediaDescriptor;
  isFeatured: boolean;
  sortOrder: number;
  contentState: ContentState;
  revisionId: string;
  publishedAt: string;
};

export type ProjectDetail = ProjectSummary & {
  document: ArticleDocument;
  cover?: MediaDescriptor;
  tags: string[];
  tools: string[];
  role?: string;
  year?: string;
};

export type ProjectPage = {
  items: ProjectSummary[];
  nextCursor: string | null;
};

export type AdminProject = {
  id: string;
  slug: string;
  metadata: ProjectMetadata;
  document: ArticleDocument;
  version: number;
  state: ProjectAdminState;
  publicRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  slug?: string;
  metadata: ProjectMetadata;
};

export type SaveProjectDraftInput = {
  expectedVersion: number;
  metadata: ProjectMetadata;
  document: ArticleDocument;
};

export type PublishProjectInput = {
  expectedVersion: number;
  requestId: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type ValidationIssue = { path: string; message: string };
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

type UnknownRecord = Record<string, unknown>;
type ValidationContext = {
  issues: ValidationIssue[];
  blockIds: Set<string>;
  blockCount: number;
};

const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isSafeInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);
const isHttpUrl = (value: string) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
};
const isIdentifier = (value: string) => /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);

function pushIssue(context: ValidationContext | { issues: ValidationIssue[] }, path: string, message: string) {
  context.issues.push({ path, message });
}

function stringValue(value: unknown, path: string, context: { issues: ValidationIssue[] }, options: {
  min?: number; max: number; allowEmpty?: boolean;
}): string | null {
  if (typeof value !== "string") {
    pushIssue(context, path, "Must be a string.");
    return null;
  }
  const length = value.trim().length;
  if ((!options.allowEmpty && length < (options.min ?? 1)) || length > options.max) {
    pushIssue(context, path, `Must contain ${options.allowEmpty ? "0" : options.min ?? 1}–${options.max} characters.`);
  }
  return value;
}

function identifierValue(value: unknown, path: string, context: { issues: ValidationIssue[] }): string | null {
  const result = stringValue(value, path, context, { max: 128 });
  if (result !== null && !isIdentifier(result)) pushIssue(context, path, "Must be a stable identifier using letters, numbers, dot, colon, underscore or hyphen.");
  return result;
}

function optionalString(value: unknown, path: string, context: { issues: ValidationIssue[] }, max: number): string | undefined {
  if (value === undefined) return undefined;
  const result = stringValue(value, path, context, { max, allowEmpty: true });
  return result ?? undefined;
}

function parseStyle(value: unknown, path: string, context: ValidationContext): BlockStyle | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    pushIssue(context, path, "Must be an object.");
    return undefined;
  }
  const style: BlockStyle = {};
  if (value.width !== undefined) {
    if (["reading", "wide", "full"].includes(String(value.width))) style.width = value.width as BlockWidth;
    else pushIssue(context, `${path}.width`, "Must be reading, wide or full.");
  }
  if (value.background !== undefined) {
    if (["transparent", "surface", "accent"].includes(String(value.background))) style.background = value.background as BlockBackground;
    else pushIssue(context, `${path}.background`, "Must be transparent, surface or accent.");
  }
  if (value.padding !== undefined) {
    if (["none", "sm", "md", "lg"].includes(String(value.padding))) style.padding = value.padding as BlockPadding;
    else pushIssue(context, `${path}.padding`, "Must be none, sm, md or lg.");
  }
  if (value.accentColor !== undefined) {
    if (typeof value.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.accentColor)) style.accentColor = value.accentColor;
    else pushIssue(context, `${path}.accentColor`, "Must be a six-digit hex color.");
  }
  return style;
}

function parseSpans(value: unknown, path: string, context: ValidationContext): RichSpan[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
    pushIssue(context, path, "Must contain 1–100 spans.");
    return [];
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      pushIssue(context, itemPath, "Must be an object.");
      return { text: "" };
    }
    const span: RichSpan = { text: stringValue(item.text, `${itemPath}.text`, context, { max: 10_000, allowEmpty: true }) ?? "" };
    if (item.bold !== undefined) isBoolean(item.bold) ? span.bold = item.bold : pushIssue(context, `${itemPath}.bold`, "Must be a boolean.");
    if (item.italic !== undefined) isBoolean(item.italic) ? span.italic = item.italic : pushIssue(context, `${itemPath}.italic`, "Must be a boolean.");
    if (item.href !== undefined) {
      const href = stringValue(item.href, `${itemPath}.href`, context, { max: 2_048 });
      if (href !== null && isHttpUrl(href)) span.href = href;
      else if (href !== null) pushIssue(context, `${itemPath}.href`, "Must use http or https.");
    }
    return span;
  });
}

function parseBlock(value: unknown, path: string, context: ValidationContext, columnDepth: number): ArticleBlock | null {
  context.blockCount += 1;
  if (context.blockCount > maxArticleBlocks) {
    if (context.blockCount === maxArticleBlocks + 1) pushIssue(context, path, `A document can contain at most ${maxArticleBlocks} blocks.`);
    return null;
  }
  if (!isRecord(value)) {
    pushIssue(context, path, "Must be an object.");
    return null;
  }
  const id = identifierValue(value.id, `${path}.id`, context) ?? `invalid-${context.blockCount}`;
  if (context.blockIds.has(id)) pushIssue(context, `${path}.id`, "Block IDs must be unique across the document.");
  context.blockIds.add(id);
  const type = value.type;
  const style = parseStyle(value.style, `${path}.style`, context);

  if (type === "text") {
    if (!Array.isArray(value.paragraphs) || value.paragraphs.length < 1 || value.paragraphs.length > 100) {
      pushIssue(context, `${path}.paragraphs`, "Must contain 1–100 paragraphs.");
      return { id, type, ...(style && { style }), paragraphs: [] };
    }
    const paragraphs = value.paragraphs.map((paragraph, index) => {
      if (!isRecord(paragraph)) {
        pushIssue(context, `${path}.paragraphs[${index}]`, "Must be an object.");
        return { spans: [{ text: "" }] };
      }
      return { spans: parseSpans(paragraph.spans, `${path}.paragraphs[${index}].spans`, context) };
    });
    return { id, type, ...(style && { style }), paragraphs };
  }
  if (type === "heading") {
    const level = value.level === 2 || value.level === 3 ? value.level : 2;
    if (value.level !== 2 && value.level !== 3) pushIssue(context, `${path}.level`, "Must be heading level 2 or 3.");
    const text = stringValue(value.text, `${path}.text`, context, { max: 240 }) ?? "";
    return { id, type, level, text, ...(style && { style }) };
  }
  if (type === "image") {
    const assetId = identifierValue(value.assetId, `${path}.assetId`, context) ?? "invalid-asset";
    const alt = stringValue(value.alt, `${path}.alt`, context, { max: 500, allowEmpty: true }) ?? "";
    const caption = optionalString(value.caption, `${path}.caption`, context, 1_000);
    const fit = value.fit === "contain" || value.fit === "cover" ? value.fit : "contain";
    if (value.fit !== "contain" && value.fit !== "cover") pushIssue(context, `${path}.fit`, "Must be contain or cover.");
    return { id, type, assetId, alt, fit, ...(caption !== undefined && { caption }), ...(style && { style }) };
  }
  if (type === "gallery") {
    const columns = value.columns === 2 || value.columns === 3 ? value.columns : 2;
    if (value.columns !== 2 && value.columns !== 3) pushIssue(context, `${path}.columns`, "Must be 2 or 3.");
    const rawItems = Array.isArray(value.items) ? value.items : [];
    if (rawItems.length < 1 || rawItems.length > 20) pushIssue(context, `${path}.items`, "Must contain 1–20 media items.");
    const items = rawItems.slice(0, 20).map((item, index) => {
      const itemPath = `${path}.items[${index}]`;
      if (!isRecord(item)) {
        pushIssue(context, itemPath, "Must be an object.");
        return { assetId: "invalid-asset", alt: "" };
      }
      return {
        assetId: identifierValue(item.assetId, `${itemPath}.assetId`, context) ?? "invalid-asset",
        alt: stringValue(item.alt, `${itemPath}.alt`, context, { max: 500, allowEmpty: true }) ?? "",
      };
    });
    return { id, type, items, columns, ...(style && { style }) };
  }
  if (type === "columns") {
    if (columnDepth >= 2) pushIssue(context, path, "Columns may be nested at most two levels deep.");
    const rawColumns = Array.isArray(value.columns) ? value.columns : [];
    if (rawColumns.length < 2 || rawColumns.length > 3) pushIssue(context, `${path}.columns`, "Must contain 2–3 columns.");
    const columns = rawColumns.slice(0, 3).map((column, columnIndex) => {
      if (!Array.isArray(column)) {
        pushIssue(context, `${path}.columns[${columnIndex}]`, "Must be an array of blocks.");
        return [];
      }
      return column.map((block, blockIndex) => parseBlock(block, `${path}.columns[${columnIndex}][${blockIndex}]`, context, columnDepth + 1))
        .filter((block): block is ArticleBlock => block !== null);
    });
    return { id, type, columns, ...(style && { style }) };
  }
  if (type === "video") {
    const assetId = identifierValue(value.assetId, `${path}.assetId`, context) ?? "invalid-asset";
    const posterAssetId = identifierValue(value.posterAssetId, `${path}.posterAssetId`, context) ?? "invalid-asset";
    const caption = optionalString(value.caption, `${path}.caption`, context, 1_000);
    return { id, type, assetId, posterAssetId, ...(caption !== undefined && { caption }), ...(style && { style }) };
  }
  if (type === "links") {
    const rawItems = Array.isArray(value.items) ? value.items : [];
    if (rawItems.length < 1 || rawItems.length > 10) pushIssue(context, `${path}.items`, "Must contain 1–10 links.");
    const items = rawItems.slice(0, 10).map((item, index) => {
      const itemPath = `${path}.items[${index}]`;
      if (!isRecord(item)) {
        pushIssue(context, itemPath, "Must be an object.");
        return { label: "", url: "" };
      }
      const label = stringValue(item.label, `${itemPath}.label`, context, { max: 120 }) ?? "";
      const url = stringValue(item.url, `${itemPath}.url`, context, { max: 2_048 }) ?? "";
      if (url && !isHttpUrl(url)) pushIssue(context, `${itemPath}.url`, "Must use http or https.");
      return { label, url };
    });
    return { id, type, items };
  }
  if (type === "spacer") {
    const size = value.size === "sm" || value.size === "md" || value.size === "lg" ? value.size : "md";
    if (!["sm", "md", "lg"].includes(String(value.size))) pushIssue(context, `${path}.size`, "Must be sm, md or lg.");
    return { id, type, size };
  }

  pushIssue(context, `${path}.type`, "Unsupported block type.");
  return null;
}

export function validateArticleDocument(value: unknown): ValidationResult<ArticleDocument> {
  const context: ValidationContext = { issues: [], blockIds: new Set(), blockCount: 0 };
  let jsonBytes = maxArticleJsonBytes + 1;
  try { jsonBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch { pushIssue(context, "$", "Must be JSON serializable."); }
  if (jsonBytes > maxArticleJsonBytes) pushIssue(context, "$", `Document exceeds ${maxArticleJsonBytes} bytes.`);
  if (!isRecord(value)) {
    pushIssue(context, "$", "Must be an object.");
    return { ok: false, issues: context.issues };
  }
  if (value.schemaVersion !== articleSchemaVersion) pushIssue(context, "$.schemaVersion", `Must equal ${articleSchemaVersion}.`);
  if (!Array.isArray(value.blocks)) {
    pushIssue(context, "$.blocks", "Must be an array.");
    return { ok: false, issues: context.issues };
  }
  const blocks = value.blocks.map((block, index) => parseBlock(block, `$.blocks[${index}]`, context, 0))
    .filter((block): block is ArticleBlock => block !== null);
  if (context.issues.length) return { ok: false, issues: context.issues };
  return { ok: true, value: { schemaVersion: articleSchemaVersion, blocks } };
}

function parseStringList(value: unknown, path: string, context: { issues: ValidationIssue[] }, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    pushIssue(context, path, `Must be an array with at most ${maxItems} items.`);
    return [];
  }
  return value.map((item, index) => stringValue(item, `${path}[${index}]`, context, { max: maxLength }) ?? "");
}

export function validateProjectMetadata(value: unknown): ValidationResult<ProjectMetadata> {
  const context = { issues: [] as ValidationIssue[] };
  if (!isRecord(value)) return { ok: false, issues: [{ path: "$", message: "Must be an object." }] };
  const categoryId = isCategoryId(value.categoryId) ? value.categoryId : "illustrator";
  if (!isCategoryId(value.categoryId)) pushIssue(context, "$.categoryId", "Must be a supported category ID.");
  const title = stringValue(value.title, "$.title", context, { max: 160 }) ?? "";
  const shortTitle = stringValue(value.shortTitle, "$.shortTitle", context, { max: 80 }) ?? "";
  const subtitle = stringValue(value.subtitle, "$.subtitle", context, { max: 280 }) ?? "";
  const thumbnailAssetId = identifierValue(value.thumbnailAssetId, "$.thumbnailAssetId", context) ?? "invalid-asset";
  const coverAssetId = value.coverAssetId === undefined ? undefined : identifierValue(value.coverAssetId, "$.coverAssetId", context) ?? undefined;
  const tags = parseStringList(value.tags, "$.tags", context, 30, 40);
  const tools = parseStringList(value.tools, "$.tools", context, 20, 80);
  const role = optionalString(value.role, "$.role", context, 120);
  const year = optionalString(value.year, "$.year", context, 80);
  const isFeatured = isBoolean(value.isFeatured) ? value.isFeatured : false;
  if (!isBoolean(value.isFeatured)) pushIssue(context, "$.isFeatured", "Must be a boolean.");
  const sortOrder = isSafeInteger(value.sortOrder) && value.sortOrder >= 0 && value.sortOrder <= 1_000_000 ? value.sortOrder : 0;
  if (sortOrder !== value.sortOrder) pushIssue(context, "$.sortOrder", "Must be an integer from 0 to 1,000,000.");
  if (context.issues.length) return { ok: false, issues: context.issues };
  return { ok: true, value: {
    categoryId, title, shortTitle, subtitle, thumbnailAssetId,
    ...(coverAssetId && { coverAssetId }), tags, tools,
    ...(role !== undefined && { role }), ...(year !== undefined && { year }), isFeatured, sortOrder,
  } };
}

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

export function collectArticleAssetIds(document: ArticleDocument): string[] {
  const ids = new Set<string>();
  const visit = (blocks: ArticleBlock[]) => blocks.forEach(block => {
    if (block.type === "image") ids.add(block.assetId);
    if (block.type === "gallery") block.items.forEach(item => ids.add(item.assetId));
    if (block.type === "video") { ids.add(block.assetId); ids.add(block.posterAssetId); }
    if (block.type === "columns") block.columns.forEach(visit);
  });
  visit(document.blocks);
  return [...ids];
}

export function normalizeSearchText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
}
