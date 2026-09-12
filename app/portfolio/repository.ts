import type { AdjacentProjects, MediaDescriptor, ProjectDetail, ProjectPage, ProjectSummary } from "../../shared/contracts";
import { portfolioProjects } from "./data";
import { selectPortfolioProjects } from "./selectors";
import type { Category, Filter, PortfolioMedia, PortfolioProject } from "./types";

const listCache = new Map<string, PortfolioProject[]>();
const detailCache = new Map<string, PortfolioProject>();
const latestDetailKey = new Map<string, string>();

export class PortfolioApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

function apiRoot() {
  return new URL("./api/v1/", document.baseURI);
}

function apiUrl(path: string) {
  return new URL(path.replace(/^\//, ""), apiRoot());
}

export function canUsePortfolioApi() {
  return typeof window !== "undefined" && /^https?:$/.test(window.location.protocol) && typeof fetch === "function";
}

async function readJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PortfolioApiError("The live portfolio service could not be reached.");
  }
  if (!response.ok) {
    let message = `Portfolio request failed (${response.status}).`;
    try {
      const body = await response.json() as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch { /* retain the status-based message */ }
    throw new PortfolioApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

function mediaUrl(url: string) {
  return new URL(url, apiRoot()).href;
}

function toMedia(media: MediaDescriptor): PortfolioMedia {
  return {
    src: mediaUrl(media.url), alt: media.alt,
    width: media.width ?? 1200, height: media.height ?? 900,
    fit: "cover",
  };
}

function discipline(category: Category): "design" | "development" {
  return ["illustrator", "photoshop", "blender"].includes(category) ? "design" : "development";
}

export function projectFromSummary(project: ProjectSummary): PortfolioProject {
  const category = project.categoryId as Category;
  const thumbnail = toMedia(project.thumbnail);
  return {
    id: project.id, title: project.title, shortTitle: project.shortTitle, summary: project.subtitle,
    primaryCategory: category, discipline: discipline(category), tags: [], status: "published",
    order: project.sortOrder, thumbnail, cover: { ...thumbnail, fit: "contain" },
    role: project.subtitle, year: project.publishedAt.slice(0, 4), tools: [], sections: [],
    revisionId: project.revisionId, contentState: project.contentState,
  };
}

export function projectFromDetail(project: ProjectDetail): PortfolioProject {
  const result = projectFromSummary(project);
  return {
    ...result,
    cover: { ...toMedia(project.cover ?? project.thumbnail), fit: "contain" },
    tags: project.tags,
    role: project.role ?? project.subtitle,
    year: project.year ?? project.publishedAt.slice(0, 4),
    tools: project.tools,
    document: project.document,
    media: project.media.map(media => ({ ...media, url: mediaUrl(media.url) })),
  };
}

export async function listCloudProjects(category: Filter, query: string, signal?: AbortSignal) {
  const normalizedQuery = query.trim();
  const key = `${category}:${normalizedQuery.toLocaleLowerCase()}`;
  const cached = listCache.get(key);
  if (cached) return cached;

  const projects: PortfolioProject[] = [];
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const url = apiUrl("projects");
    url.searchParams.set("limit", "48");
    if (category !== "all") url.searchParams.set("category", category);
    if (normalizedQuery) url.searchParams.set("q", normalizedQuery);
    if (cursor) url.searchParams.set("cursor", cursor);
    const page = await readJson<ProjectPage>(url, signal);
    if (!Array.isArray(page.items)) throw new PortfolioApiError("The portfolio service returned an invalid project list.");
    projects.push(...page.items.map(projectFromSummary));
    cursor = page.nextCursor;
    if (!cursor) {
      listCache.set(key, projects);
      return projects;
    }
  }
  throw new PortfolioApiError("The portfolio list exceeded its safe pagination limit.");
}

export async function getCloudProject(id: string, revisionId?: string, signal?: AbortSignal) {
  const requestedKey = revisionId ? `${id}:${revisionId}` : latestDetailKey.get(id);
  if (requestedKey) {
    const cached = detailCache.get(requestedKey);
    if (cached) return cached;
  }
  const detail = await readJson<ProjectDetail>(apiUrl(`projects/${encodeURIComponent(id)}`), signal);
  const project = projectFromDetail(detail);
  const key = `${detail.id}:${detail.revisionId}`;
  detailCache.set(key, project);
  latestDetailKey.set(detail.id, key);
  return project;
}

export function getCloudAdjacent(id: string, signal?: AbortSignal) {
  return readJson<AdjacentProjects>(apiUrl(`projects/${encodeURIComponent(id)}/adjacent`), signal);
}

export function listLocalProjects(category: Filter, query: string) {
  return selectPortfolioProjects(portfolioProjects, category, query);
}

