import {
  ArrowLeft, Box, ChevronLeft, ChevronRight, Gamepad2, Globe2, Grid3X3, Image as ImageIcon,
  PenTool, Search, Smartphone, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArticleRenderer } from "./ArticleRenderer";
import { categoryDescriptions, categoryLabels, portfolioProjects } from "./data";
import { initialPortfolioState, portfolioReducer } from "./navigation";
import {
  canUsePortfolioApi, getCloudAdjacent, getCloudProject, listCloudProjects, listLocalProjects,
} from "./repository";
import { selectPortfolioProjects } from "./selectors";
import type { Filter, PortfolioProject } from "./types";

const designCategories: { id: Filter; icon: LucideIcon; title?: string }[] = [
  { id: "illustrator", icon: PenTool, title: "Brand design" },
  { id: "photoshop", icon: ImageIcon, title: "Visual design" },
  { id: "blender", icon: Box, title: "3D design" },
];
const developmentCategories: { id: Filter; icon: LucideIcon; title?: string }[] = [
  { id: "game", icon: Gamepad2 },
  { id: "web", icon: Globe2 },
  { id: "app", icon: Smartphone },
];

function ProjectCard({ project, onOpen }: { project: PortfolioProject; onOpen: (project: PortfolioProject) => void }) {
  return <button type="button" className={`pf-project-card ${project.status === "placeholder" ? "pf-project-placeholder" : ""}`} onClick={() => onOpen(project)}>
    <span className={`pf-card-media pf-media-${project.primaryCategory}`}>
      <img src={project.thumbnail.src} alt="" width={project.thumbnail.width} height={project.thumbnail.height}
        loading="lazy" style={{ objectFit: project.thumbnail.fit ?? "cover" }} />
      <span className="pf-card-arrow" aria-hidden="true"><ChevronRight /></span>
    </span>
    <span className="pf-card-copy">
      <small>{categoryLabels[project.primaryCategory]}</small>
      <strong>{project.shortTitle}</strong>
      <span>{project.role}</span>
    </span>
  </button>;
}

function Overview({ projects, category, query, featureIndex, onFeatureChange, onOpen, onReset }: {
  projects: PortfolioProject[]; category: Filter; query: string;
  featureIndex: number; onFeatureChange: (offset: number) => void;
  onOpen: (project: PortfolioProject) => void; onReset: () => void;
}) {
  const design = projects.filter(project => project.discipline === "design");
  const development = projects.filter(project => project.discipline === "development");
  const feature = projects.length ? projects[featureIndex % projects.length] : null;

  if (!projects.length) return <section className="pf-empty" aria-live="polite">
    <span>00 / No results</span>
    <h1>Nothing published here yet.</h1>
    <p>{query ? `No project matches “${query}”.` : `${categoryLabels[category]} projects are being prepared.`}</p>
    <button type="button" onClick={onReset}>View all projects</button>
  </section>;

  return <div className="pf-overview">
    <section className="pf-feature" aria-label="Featured portfolio project">
      {feature ? <>
        <figure className={`pf-feature-cover pf-media-${feature.primaryCategory}`}>
          <img src={feature.cover.src} alt={feature.cover.alt} width={feature.cover.width} height={feature.cover.height}
            style={{ objectFit: feature.cover.fit ?? "cover" }} />
        </figure>
        <div className="pf-feature-copy">
          <small>Featured / {categoryLabels[feature.primaryCategory]}</small>
          <h1>{feature.shortTitle}</h1>
          <p>{feature.summary}</p>
          <span>{feature.year}</span>
          <button type="button" onClick={() => onOpen(feature)}>View project</button>
        </div>
      </> : <>
        <div className="pf-feature-cover pf-feature-placeholder" aria-hidden="true"><Grid3X3 /></div>
        <div className="pf-feature-copy">
          <small>Portfolio preview</small><h1>{categoryLabels[category]}</h1>
          <p>{categoryDescriptions[category]}</p><span>Coming soon</span>
        </div>
      </>}
      {projects.length > 1 && <div className="pf-feature-arrows">
        <button type="button" aria-label="Previous featured project" onClick={() => onFeatureChange(-1)}><ChevronLeft aria-hidden="true" /></button>
        <button type="button" aria-label="Next featured project" onClick={() => onFeatureChange(1)}><ChevronRight aria-hidden="true" /></button>
      </div>}
    </section>
    {design.length > 0 && <section className="pf-project-section" aria-labelledby="hyper-design-title">
      <div className="pf-section-heading"><span>01</span><h2 id="hyper-design-title">Hyper Design</h2><small>{design.length} projects</small></div>
      <div className="pf-project-grid">{design.map(project => <ProjectCard key={project.id} project={project} onOpen={onOpen} />)}</div>
    </section>}
    {development.length > 0 && <section className="pf-project-section" aria-labelledby="hyper-development-title">
      <div className="pf-section-heading"><span>02</span><h2 id="hyper-development-title">Hyper Development</h2><small>{development.length} projects</small></div>
      <div className="pf-project-grid">{development.map(project => <ProjectCard key={project.id} project={project} onOpen={onOpen} />)}</div>
    </section>}
  </div>;
}

function CaseStudy({ project, loading, nextBusy, error, onRetry, onBack, onOpenNext }: {
  project: PortfolioProject; loading: boolean; nextBusy: boolean; error: string | null; onRetry: () => void;
  onBack: () => void; onOpenNext: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, [project.id]);
  return <article className={`pf-case pf-case-${project.primaryCategory}`}>
    <button type="button" className="pf-back" onClick={onBack}><ArrowLeft aria-hidden="true" />Back to all projects</button>
    <header className="pf-case-header">
      <p>{categoryLabels[project.primaryCategory]} / {project.year}</p>
      <h1 ref={titleRef} tabIndex={-1}>{project.title}</h1>
      <span>{project.summary}</span>
      <dl>
        <div><dt>Role</dt><dd>{project.role}</dd></div>
        <div><dt>Tools</dt><dd>{project.tools.join(" · ")}</dd></div>
      </dl>
    </header>
    <figure className="pf-case-cover">
      <img src={project.cover.src} alt={project.cover.alt} width={project.cover.width} height={project.cover.height}
        style={{ objectFit: project.cover.fit ?? "contain" }} />
    </figure>
    {loading && <div className="pf-content-state" role="status"><span className="pf-spinner" aria-hidden="true" />Loading project story…</div>}
    {error && <div className="pf-content-state pf-content-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div>}
    {!loading && !error && project.document
      ? <ArticleRenderer document={project.document} media={project.media ?? []} />
      : !loading && !error && project.sections.map(section => <section className="pf-case-section" key={section.id}>
        <div className="pf-case-copy"><p>{section.eyebrow}</p><h2>{section.title}</h2><span>{section.copy}</span></div>
        {section.media && <figure><img src={section.media.src} alt={section.media.alt}
          width={section.media.width} height={section.media.height} loading="lazy"
          style={{ objectFit: section.media.fit ?? "contain" }} /></figure>}
      </section>)}
    <footer className="pf-case-next">
      <span>Continue exploring</span><button type="button" disabled={nextBusy} onClick={onOpenNext}>Next project <ChevronRight aria-hidden="true" /></button>
    </footer>
  </article>;
}

function stateForInitialCategory(category: Filter) {
  if (category === "all") return initialPortfolioState;
  const firstProject = selectPortfolioProjects(portfolioProjects, category, "")[0];
  return firstProject
    ? portfolioReducer(initialPortfolioState, { type: "open", project: firstProject, scrollTop: 0 })
    : { ...initialPortfolioState, category };
}

export function PortfolioApp({ onClose, initialCategory = "all" }: { onClose: () => void; initialCategory?: Filter }) {
  const [state, dispatch] = useReducer(portfolioReducer, initialCategory, stateForInitialCategory);
  const [searchFocused, setSearchFocused] = useState(false);
  const [featureIndex, setFeatureIndex] = useState(0);
  const [projects, setProjects] = useState<PortfolioProject[]>(portfolioProjects);
  const [source, setSource] = useState<"probing" | "local" | "cloud">("probing");
  const [listStatus, setListStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [listError, setListError] = useState<string | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailProjects, setDetailProjects] = useState<Record<string, PortfolioProject>>({});
  const [deferredQuery, setDeferredQuery] = useState("");
  const [reloadList, setReloadList] = useState(0);
  const [reloadDetail, setReloadDetail] = useState(0);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const pendingOpenCategory = useRef<Filter | null>(initialCategory === "all" ? null : initialCategory);
  const listRequest = useRef(0);
  const currentSummary = projects.find(project => project.id === state.projectId && project.status !== "draft") ?? null;
  const storedDetail = state.projectId ? detailProjects[state.projectId] : undefined;
  const currentProject = state.projectId
    ? storedDetail && (!currentSummary?.revisionId || storedDetail.revisionId === currentSummary.revisionId) ? storedDetail : currentSummary
    : null;
  const visibleProjects = useMemo(() => selectPortfolioProjects(
    projects, source === "cloud" ? "all" : currentProject ? currentProject.primaryCategory : state.category,
    source === "cloud" ? "" : currentProject ? "" : state.query,
  ), [currentProject, projects, source, state.category, state.query]);
  const scrollViewer = (top: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (typeof viewer.scrollTo === "function") viewer.scrollTo({ top });
    else viewer.scrollTop = top;
  };

  const openProject = (project: PortfolioProject) => {
    dispatch({ type: "open", project, scrollTop: viewerRef.current?.scrollTop ?? 0 });
    scrollViewer(0);
  };
  const selectCategory = (category: Filter) => {
    setFeatureIndex(0);
    if (source === "cloud") {
      pendingOpenCategory.current = category === "all" ? null : category;
      dispatch({ type: "category", value: category });
    } else if (category === "all") dispatch({ type: "category", value: "all" });
    else {
      const firstProject = listLocalProjects(category, "")[0];
      if (firstProject) dispatch({ type: "open", project: firstProject, scrollTop: viewerRef.current?.scrollTop ?? 0 });
      else dispatch({ type: "category", value: category });
    }
    scrollViewer(0);
  };
  const backToProjects = () => {
    const top = state.returnScroll;
    dispatch({ type: "back" });
    window.requestAnimationFrame(() => scrollViewer(top));
  };
  const openNext = async () => {
    if (!currentProject) return;
    if (source === "cloud") {
      setNavigationBusy(true);
      setDetailError(null);
      try {
        const adjacent = await getCloudAdjacent(currentProject.id);
        let targetId = adjacent.next?.id;
        if (!targetId) targetId = (await listCloudProjects("all", ""))[0]?.id;
        if (!targetId) return;
        const target = await getCloudProject(targetId);
        setDetailProjects(current => ({ ...current, [target.id]: target }));
        openProject(target);
      } catch (error) {
        setListStatus("error");
        setListError(error instanceof Error ? error.message : "The next project could not be opened.");
      } finally { setNavigationBusy(false); }
      return;
    }
    const published = portfolioProjects.filter(project => project.status !== "draft");
    const currentIndex = published.findIndex(project => project.id === currentProject.id);
    openProject(published[(currentIndex + 1) % published.length]);
  };

  useEffect(() => {
    if (source !== "cloud") { setDeferredQuery(state.query); return; }
    const timer = window.setTimeout(() => setDeferredQuery(state.query), 180);
    return () => window.clearTimeout(timer);
  }, [source, state.query]);

  useEffect(() => {
    if (!canUsePortfolioApi()) { setSource("local"); return; }
    const controller = new AbortController();
    listCloudProjects("all", "", controller.signal).then(cloudProjects => {
      if (!cloudProjects.length) { setSource("local"); return; }
      setProjects(cloudProjects);
      setSource("cloud");
    }).catch(error => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setSource("local");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (source !== "cloud") return;
    const controller = new AbortController();
    const requestId = ++listRequest.current;
    const category = state.category;
    const query = state.projectId ? "" : deferredQuery;
    setListStatus("loading");
    setListError(null);
    listCloudProjects(category, query, controller.signal).then(cloudProjects => {
      if (requestId !== listRequest.current) return;
      setProjects(cloudProjects);
      setListStatus("ready");
      const pending = pendingOpenCategory.current;
      if (pending === category) {
        pendingOpenCategory.current = null;
        if (cloudProjects[0]) dispatch({ type: "open", project: cloudProjects[0], scrollTop: viewerRef.current?.scrollTop ?? 0 });
      } else if (state.projectId && !cloudProjects.some(project => project.id === state.projectId) && cloudProjects[0]) {
        dispatch({ type: "open", project: cloudProjects[0], scrollTop: 0 });
      }
    }).catch(error => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestId !== listRequest.current) return;
      setListStatus("error");
      setListError(error instanceof Error ? error.message : "Projects could not be updated.");
    });
    return () => controller.abort();
  }, [deferredQuery, reloadList, source, state.category, state.projectId]);

  useEffect(() => {
    if (source !== "cloud" || !state.projectId || !currentProject) {
      setDetailStatus("idle");
      setDetailError(null);
      return;
    }
    if (currentProject.document && reloadDetail === 0) { setDetailStatus("ready"); return; }
    const controller = new AbortController();
    const projectId = state.projectId;
    setDetailStatus("loading");
    setDetailError(null);
    getCloudProject(projectId, currentProject.revisionId, controller.signal).then(project => {
      setDetailProjects(current => ({ ...current, [project.id]: project }));
      setDetailStatus("ready");
    }).catch(error => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDetailStatus("error");
      setDetailError(error instanceof Error ? error.message : "The project story could not be loaded.");
    });
    return () => controller.abort();
  }, [currentProject?.id, currentProject?.revisionId, reloadDetail, source, state.projectId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (state.query) dispatch({ type: "query", value: "" });
      else onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, state.query]);

  return <section className="pf-window" aria-label="Portfolio" data-searching={searchFocused ? "true" : undefined}
    data-source={source} aria-busy={listStatus === "loading" || detailStatus === "loading"}>
    <header className="pf-header">
      <label className="pf-search">
        <Search aria-hidden="true" />
        <input type="search" aria-label="Search portfolio" placeholder="Search projects, tools or disciplines…"
          value={state.query} onChange={event => dispatch({ type: "query", value: event.target.value })}
          onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
      </label>
      <button className="pf-close" type="button" aria-label="Close portfolio" title="Close portfolio" onClick={onClose}><X aria-hidden="true" /></button>
    </header>

    <nav className="pf-nav" aria-label="Portfolio categories">
      <div className="pf-nav-history">
        <button type="button" aria-label="Back to project list" disabled={!currentProject} onClick={backToProjects}><ChevronLeft aria-hidden="true" /></button>
        <button type="button" aria-label="Next project" disabled={!currentProject || navigationBusy} onClick={openNext}><ChevronRight aria-hidden="true" /></button>
      </div>
      <div className="pf-nav-group pf-nav-design" aria-label="Design categories">
        {designCategories.map(({ id, icon: Icon, title }) => <button type="button" key={id} data-category={id}
          title={title ?? categoryLabels[id]} aria-label={title ?? categoryLabels[id]}
          aria-pressed={state.category === id} onClick={() => selectCategory(id)}>
          <Icon aria-hidden="true" /><span>{categoryLabels[id]}</span>
        </button>)}
      </div>
      <button type="button" className="pf-nav-all" data-category="all" title={categoryLabels.all}
        aria-label={categoryLabels.all} aria-pressed={state.category === "all"} onClick={() => selectCategory("all")}>
        <Grid3X3 aria-hidden="true" /><span>{categoryLabels.all}</span>
      </button>
      <div className="pf-nav-group pf-nav-development" aria-label="Development categories">
        {developmentCategories.map(({ id, icon: Icon, title }) => <button type="button" key={id} data-category={id}
          title={title ?? categoryLabels[id]} aria-label={title ?? categoryLabels[id]}
          aria-pressed={state.category === id} onClick={() => selectCategory(id)}>
          <Icon aria-hidden="true" /><span>{categoryLabels[id]}</span>
        </button>)}
      </div>
    </nav>

    <main ref={viewerRef} className="pf-viewer" aria-label="Portfolio content">
      {listStatus === "loading" && <div className="pf-sync-status" role="status"><span className="pf-spinner" aria-hidden="true" />Updating projects…</div>}
      {listStatus === "error" && <div className="pf-sync-status pf-sync-error" role="alert"><span>{listError}</span><button type="button" onClick={() => setReloadList(value => value + 1)}>Retry</button></div>}
      {currentProject
        ? <CaseStudy project={currentProject} loading={detailStatus === "loading"} nextBusy={navigationBusy} error={detailError}
          onRetry={() => setReloadDetail(value => value + 1)} onBack={backToProjects} onOpenNext={openNext} />
        : <Overview projects={visibleProjects} category={state.category} query={state.query} featureIndex={featureIndex}
          onFeatureChange={offset => setFeatureIndex(current => (current + offset + visibleProjects.length) % visibleProjects.length)}
          onOpen={openProject} onReset={() => selectCategory("all")} />}
    </main>

    <aside className="pf-index" aria-label="Project list">
      <header><span>Project index</span><strong>{String(visibleProjects.length).padStart(2, "0")}</strong></header>
      {visibleProjects.length > 0 ? <ul>
        {visibleProjects.map((project, index) => <li key={project.id}>
          <button type="button" aria-current={currentProject?.id === project.id ? "true" : undefined} onClick={() => openProject(project)}>
            <span className="pf-index-number">{String(index + 1).padStart(2, "0")}</span>
            <img src={project.thumbnail.src} alt="" width={project.thumbnail.width} height={project.thumbnail.height} loading="lazy" />
            <span><strong>{project.shortTitle}</strong><small>{categoryLabels[project.primaryCategory]}</small></span>
          </button>
        </li>)}
      </ul> : <p className="pf-index-empty">No published projects</p>}
    </aside>
  </section>;
}
