import type { Filter, PortfolioProject } from "./types";

export const normalizePortfolioText = (text: string) => text.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();

export function selectPortfolioProjects(projects: PortfolioProject[], category: Filter, query: string) {
  const terms = normalizePortfolioText(query).split(/\s+/).filter(Boolean);
  return projects.filter(project => project.status !== "draft")
    .filter(project => category === "all" || project.primaryCategory === category)
    .filter(project => {
      const haystack = normalizePortfolioText([
        project.title, project.summary, ...project.tags, ...project.tools,
      ].join(" "));
      return terms.every(term => haystack.includes(term));
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
