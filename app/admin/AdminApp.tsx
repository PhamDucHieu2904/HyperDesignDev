import {
  ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, CircleAlert, Clock3, Copy,
  FilePlus2, FolderOpen, Grid2X2, Image as ImageIcon, LayoutList, LoaderCircle, MoreHorizontal,
  Pencil, Plus, RefreshCw, RotateCcw, Search, Settings2, Tag, Trash2, Upload, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsPage } from './AnalyticsPage';
import { AdminShell, sectionFromHash, type AdminSection } from './AdminShell';
import { HomePage } from './HomePage';
import { OrdersPage } from './OrdersPage';
import {
  categoryDefinitions, emptyArticleDocument, type AdminIdentity, type AdminMediaAsset,
  type AdminProject, type AdminProjectSummary, type ArticleDocument,
  type CategoryId, type ProjectAdminState, type ProjectMetadata,
} from "../../shared/contracts";
import {
  AdminApiError, createAdminProject, getAdminIdentity, getAdminProject, listAdminMedia,
  listAdminProjects, restoreAdminProject, saveAdminProject, trashAdminProject, uploadAdminMedia,
} from "./repository";
import { ArticleEditor } from "./ArticleEditor";

type LibraryStatus = "all" | ProjectAdminState;
type DisciplineFilter = "all" | "design" | "development";
type ViewMode = "grid" | "table";
type Page = AdminSection | "metadata" | "content";
type FormMode = "create" | "edit";

const categoryLabels: Record<CategoryId, string> = Object.fromEntries(
  categoryDefinitions.map(category => [category.id, category.label]),
) as Record<CategoryId, string>;

const categoryGroups: Record<DisciplineFilter, CategoryId[]> = {
  all: categoryDefinitions.map(category => category.id),
  design: categoryDefinitions.filter(category => category.discipline === "design").map(category => category.id),
  development: categoryDefinitions.filter(category => category.discipline === "development").map(category => category.id),
};

const stateLabels: Record<ProjectAdminState, string> = {
  draft: "Draft",
  published: "Published",
  "unpublished-changes": "Unpublished changes",
  trash: "Trash",
};

function initialMetadata(): ProjectMetadata {
  return {
    categoryId: "illustrator", title: "", shortTitle: "", subtitle: "", thumbnailAssetId: "",
    tags: [], tools: [], isFeatured: false, sortOrder: 0,
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function mediaSource(media: AdminMediaAsset | undefined) {
  return media?.state === "ready" ? media.contentUrl : undefined;
}

function StatusChip({ state }: { state: ProjectAdminState }) {
  return <span className={`admin-status admin-status-${state}`}><span aria-hidden="true" />{stateLabels[state]}</span>;
}

function Thumbnail({ media, alt, className = "" }: { media?: AdminMediaAsset; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = mediaSource(media);
  return <span className={`admin-thumbnail ${className}`}>
    {src && !failed ? <img src={src} alt={alt} width={media?.width ?? 800} height={media?.height ?? 600} onError={() => setFailed(true)} />
      : <ImageIcon aria-hidden="true" />}
    {media?.state === "pending" && <span className="admin-thumbnail-badge">Processing</span>}
  </span>;
}

function ProjectCard({
  project, media, menuOpen, onToggleMenu, onOpen, onEdit, onDuplicate, onTrash, onRestore,
}: {
  project: AdminProjectSummary; media?: AdminMediaAsset; menuOpen: boolean; onToggleMenu: () => void;
  onOpen: () => void; onEdit: () => void; onDuplicate: () => void; onTrash: () => void; onRestore: () => void;
}) {
  return <article className="admin-project-card">
    <button type="button" className="admin-project-cover" onClick={onOpen} aria-label={`Open editor for ${project.metadata.title}`}>
      <Thumbnail media={media} alt="" />
    </button>
    <div className="admin-project-card-body">
      <div className="admin-project-card-heading">
        <div>
          <span className="admin-category-label">{categoryLabels[project.metadata.categoryId]}</span>
          <button type="button" className="admin-project-title" onClick={onOpen}>{project.metadata.title || "Untitled project"}</button>
        </div>
        <div className="admin-menu-wrap">
          <button type="button" className="admin-icon-button" aria-label={`Actions for ${project.metadata.title}`} title="Project actions"
            aria-expanded={menuOpen} onClick={event => { event.stopPropagation(); onToggleMenu(); }}><MoreHorizontal aria-hidden="true" /></button>
          {menuOpen && <div className="admin-menu" role="menu">
            <button type="button" role="menuitem" onClick={onEdit}><Pencil aria-hidden="true" />Edit details</button>
            <button type="button" role="menuitem" onClick={onOpen}><FolderOpen aria-hidden="true" />Open content editor</button>
            {project.state === "trash"
              ? <button type="button" role="menuitem" onClick={onRestore}><RotateCcw aria-hidden="true" />Restore</button>
              : <><button type="button" role="menuitem" onClick={onDuplicate}><Copy aria-hidden="true" />Duplicate as draft</button>
                <button type="button" role="menuitem" className="admin-menu-danger" onClick={onTrash}><Trash2 aria-hidden="true" />Move to trash</button></>}
          </div>}
        </div>
      </div>
      <p className="admin-project-subtitle">{project.metadata.subtitle || "No subtitle yet"}</p>
      <div className="admin-project-meta"><StatusChip state={project.state} />
        <span className={`admin-content-label ${project.contentState === "empty" ? "is-empty" : ""}`}>
          {project.contentState === "empty" ? "Content empty" : "Content ready"}
        </span>
      </div>
      <div className="admin-project-footer"><span><Clock3 aria-hidden="true" />{formatDate(project.updatedAt)}</span>
        {project.metadata.isFeatured && <span className="admin-featured"><CheckCircle2 aria-hidden="true" />Featured</span>}
      </div>
    </div>
  </article>;
}

function ProjectTable({
  projects, mediaById, menuOpenId, onToggleMenu, onOpen, onEdit, onDuplicate, onTrash, onRestore,
}: {
  projects: AdminProjectSummary[]; mediaById: Map<string, AdminMediaAsset>; menuOpenId: string | null;
  onToggleMenu: (id: string) => void; onOpen: (project: AdminProjectSummary) => void;
  onEdit: (project: AdminProjectSummary) => void; onDuplicate: (project: AdminProjectSummary) => void;
  onTrash: (project: AdminProjectSummary) => void; onRestore: (project: AdminProjectSummary) => void;
}) {
  return <div className="admin-table-wrap"><table className="admin-project-table"><thead><tr>
    <th scope="col">Project</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Content</th><th scope="col">Last edited</th><th scope="col"><span className="admin-visually-hidden">Actions</span></th>
  </tr></thead><tbody>{projects.map(project => <tr key={project.id}>
    <td><div className="admin-table-project"><button type="button" className="admin-table-thumb" onClick={() => onOpen(project)} aria-label={`Open editor for ${project.metadata.title}`}>
      <Thumbnail media={mediaById.get(project.metadata.thumbnailAssetId)} alt="" /></button><span><button type="button" className="admin-table-title" onClick={() => onOpen(project)}>{project.metadata.title || "Untitled project"}</button><small>{project.metadata.shortTitle}</small></span></div></td>
    <td><span className="admin-category-label">{categoryLabels[project.metadata.categoryId]}</span></td>
    <td><StatusChip state={project.state} /></td>
    <td><span className={`admin-content-label ${project.contentState === "empty" ? "is-empty" : ""}`}>{project.contentState === "empty" ? "Empty" : "Ready"}</span></td>
    <td><span className="admin-table-date">{formatDate(project.updatedAt)}</span></td>
    <td><div className="admin-menu-wrap"><button type="button" className="admin-icon-button" aria-label={`Actions for ${project.metadata.title}`} title="Project actions" aria-expanded={menuOpenId === project.id} onClick={() => onToggleMenu(project.id)}><MoreHorizontal aria-hidden="true" /></button>
      {menuOpenId === project.id && <div className="admin-menu admin-menu-right" role="menu"><button type="button" role="menuitem" onClick={() => onEdit(project)}><Pencil aria-hidden="true" />Edit details</button><button type="button" role="menuitem" onClick={() => onOpen(project)}><FolderOpen aria-hidden="true" />Open content editor</button>{project.state === "trash" ? <button type="button" role="menuitem" onClick={() => onRestore(project)}><RotateCcw aria-hidden="true" />Restore</button> : <><button type="button" role="menuitem" onClick={() => onDuplicate(project)}><Copy aria-hidden="true" />Duplicate as draft</button><button type="button" role="menuitem" className="admin-menu-danger" onClick={() => onTrash(project)}><Trash2 aria-hidden="true" />Move to trash</button></>}</div>}
    </div></td>
  </tr>)}</tbody></table></div>;
}

function MediaPicker({
  label, value, media, optional, onChange, onUpload,
}: { label: string; value: string; media: AdminMediaAsset[]; optional?: boolean; onChange: (id: string) => void; onUpload: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const readyImages = media.filter(asset => asset.state === "ready" && asset.mime.startsWith("image/"));
  return <fieldset className="admin-fieldset"><legend>{label}{optional && <span className="admin-optional">Optional</span>}</legend>
    <div className="admin-media-picker">
      <button type="button" className={`admin-media-choice admin-media-empty ${!value ? "selected" : ""}`} onClick={() => optional && onChange("")} disabled={!optional} aria-pressed={!value}>
        <span><X aria-hidden="true" /></span><strong>{optional ? "No cover" : "Choose an image"}</strong>
      </button>
      {readyImages.map(asset => <button type="button" key={asset.id} className={`admin-media-choice ${value === asset.id ? "selected" : ""}`} onClick={() => onChange(asset.id)} aria-pressed={value === asset.id}>
        <Thumbnail media={asset} alt="" /><strong>{asset.originalName}</strong><small>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : formatBytes(asset.bytes)}</small>
        {value === asset.id && <span className="admin-media-selected"><Check aria-hidden="true" /></span>}
      </button>)}
      <button type="button" className="admin-media-choice admin-media-upload" onClick={() => inputRef.current?.click()}>
        <span><Upload aria-hidden="true" /></span><strong>Upload image</strong><small>JPG, PNG, WebP or AVIF</small>
      </button>
    </div>
    <input ref={inputRef} className="admin-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} />
    {!readyImages.length && <p className="admin-field-help">Upload a ready image before saving this project.</p>}
  </fieldset>;
}

function MetadataForm({
  mode, form, slug, project, media, busy, error, fieldErrors, onChange, onSlugChange, onSubmit, onCancel, onUpload,
}: {
  mode: FormMode; form: ProjectMetadata; slug: string; project: AdminProjectSummary | null; media: AdminMediaAsset[];
  busy: boolean; error: string | null; fieldErrors: Record<string, string[]>; onChange: (change: Partial<ProjectMetadata>) => void;
  onSlugChange: (value: string) => void; onSubmit: () => void; onCancel: () => void; onUpload: (file: File) => void;
}) {
  const titleTouched = useRef(mode === "edit");
  const tagsValue = form.tags.join(", ");
  const toolsValue = form.tools.join(", ");
  const fieldError = (field: string) => fieldErrors[`$.metadata.${field}`]?.[0] ?? fieldErrors[`$.${field}`]?.[0];
  return <section className="admin-editor-page" aria-labelledby="metadata-form-title">
    <header className="admin-subpage-header"><div><button type="button" className="admin-back-button" onClick={onCancel}><ArrowLeft aria-hidden="true" />Back to library</button><p className="admin-eyebrow">{mode === "create" ? "New project" : "Project details"}</p><h1 id="metadata-form-title">{mode === "create" ? "Add project" : form.title || "Edit project"}</h1></div><div className="admin-subpage-actions"><button type="button" className="admin-button admin-button-quiet" onClick={onCancel}>Cancel</button><button type="button" className="admin-button admin-button-primary" disabled={busy} onClick={onSubmit}>{busy ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{busy ? "Saving" : "Save metadata"}</button></div></header>
    {error && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></div>}
    <div className="admin-form-layout"><div className="admin-form-main">
      <section className="admin-form-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Required metadata</p><h2>Make the project findable</h2></div><span className="admin-required-note">Required fields marked</span></div>
        <div className="admin-form-grid"><label className="admin-field"><span>Title <b aria-hidden="true">*</b></span><input value={form.title} onChange={event => { const title = event.target.value; onChange({ title, ...(titleTouched.current ? {} : { shortTitle: title.slice(0, 80) }) }); }} placeholder="e.g. Coco Boba — Tini World" autoComplete="off" aria-invalid={Boolean(fieldError("title"))} />{fieldError("title") && <small className="admin-field-error">{fieldError("title")}</small>}</label>
          <label className="admin-field"><span>Short title <b aria-hidden="true">*</b></span><input value={form.shortTitle} onFocus={() => { titleTouched.current = true; }} onChange={event => onChange({ shortTitle: event.target.value })} placeholder="Used on project cards" autoComplete="off" aria-invalid={Boolean(fieldError("shortTitle"))} />{fieldError("shortTitle") && <small className="admin-field-error">{fieldError("shortTitle")}</small>}</label>
          <label className="admin-field"><span>Group <b aria-hidden="true">*</b></span><select value={form.categoryId} onChange={event => onChange({ categoryId: event.target.value as CategoryId })}>{categoryDefinitions.map(category => <option key={category.id} value={category.id}>{category.discipline === "design" ? "Design" : "Development"} / {category.label}</option>)}</select></label>
          <label className="admin-field admin-field-wide"><span>Subtitle <b aria-hidden="true">*</b></span><textarea value={form.subtitle} onChange={event => onChange({ subtitle: event.target.value })} rows={3} placeholder="One sentence that explains what this project is." aria-invalid={Boolean(fieldError("subtitle"))} />{fieldError("subtitle") && <small className="admin-field-error">{fieldError("subtitle")}</small>}</label>
        </div>
      </section>
      <section className="admin-form-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Presentation</p><h2>Choose the artwork</h2></div><span className="admin-section-caption">Card image first, cover later</span></div>
        <MediaPicker label="Thumbnail" value={form.thumbnailAssetId} media={media} onChange={thumbnailAssetId => onChange({ thumbnailAssetId })} onUpload={onUpload} />
        <MediaPicker label="Cover image" value={form.coverAssetId ?? ""} media={media} optional onChange={coverAssetId => onChange({ coverAssetId: coverAssetId || undefined })} onUpload={onUpload} />
      </section>
      <section className="admin-form-section"><div className="admin-section-heading"><div><p className="admin-eyebrow">Search context</p><h2>Give the card useful context</h2></div><span className="admin-section-caption">Optional</span></div>
        <div className="admin-form-grid"><label className="admin-field"><span>Role</span><input value={form.role ?? ""} onChange={event => onChange({ role: event.target.value || undefined })} placeholder="e.g. Packaging design" /></label><label className="admin-field"><span>Year or period</span><input value={form.year ?? ""} onChange={event => onChange({ year: event.target.value || undefined })} placeholder="e.g. 2024" /></label><label className="admin-field admin-field-wide"><span>Tags</span><div className="admin-input-with-icon"><Tag aria-hidden="true" /><input value={tagsValue} onChange={event => onChange({ tags: event.target.value.split(",").map(item => item.trim()).filter(Boolean) })} placeholder="packaging, campaign, brand" /></div><small className="admin-field-help">Separate tags with commas.</small></label><label className="admin-field admin-field-wide"><span>Tools</span><input value={toolsValue} onChange={event => onChange({ tools: event.target.value.split(",").map(item => item.trim()).filter(Boolean) })} placeholder="Adobe Illustrator, Blender" /></label></div>
      </section>
    </div><aside className="admin-form-aside"><section className="admin-side-panel"><div className="admin-section-heading"><div><p className="admin-eyebrow">Publishing setup</p><h2>Library controls</h2></div><Settings2 aria-hidden="true" /></div><label className="admin-field"><span>Slug</span><input value={slug} onChange={event => onSlugChange(event.target.value)} placeholder="auto-generated from title" disabled={mode === "edit"} /><small className="admin-field-help">The URL label is fixed after creation.</small></label><label className="admin-check-row"><input type="checkbox" checked={form.isFeatured} onChange={event => onChange({ isFeatured: event.target.checked })} /><span><strong>Feature in All</strong><small>Use only when this project is ready for the main portfolio view.</small></span></label><label className="admin-field"><span>Sort order</span><input type="number" min="0" max="1000000" value={form.sortOrder} onChange={event => onChange({ sortOrder: Number(event.target.value) || 0 })} /></label></section><section className="admin-side-panel admin-side-note"><BookOpen aria-hidden="true" /><strong>{project ? `Draft version ${project.version}` : "Draft starts empty"}</strong><p>{project ? "Saving metadata keeps the current article body intact." : "Save now creates the card. Add the article body from the content editor."}</p></section></aside></div>
    <footer className="admin-mobile-save"><button type="button" className="admin-button admin-button-quiet" onClick={onCancel}>Cancel</button><button type="button" className="admin-button admin-button-primary" disabled={busy} onClick={onSubmit}>{busy ? "Saving" : "Save metadata"}</button></footer>
  </section>;
}

export function AdminApp() {
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]);
  const [media, setMedia] = useState<AdminMediaAsset[]>([]);
  const [page, setPageState] = useState<Page>(sectionFromHash);
  const [contentDirty, setContentDirty] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<LibraryStatus>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CategoryId>("all");
  const [search, setSearch] = useState("");
  const [deferredSearch, setDeferredSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<AdminProject | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [form, setForm] = useState<ProjectMetadata>(initialMetadata);
  const [slug, setSlug] = useState("");
  const [formDocument, setFormDocument] = useState<ArticleDocument>(emptyArticleDocument);
  const [formBusy, setFormBusy] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const requestRef = useRef(0);

  const setPage = (next: Page) => {
    if (next !== 'content') setContentDirty(false);
    setPageState(next);
    const section = next === 'metadata' || next === 'content' ? 'library' : next;
    if (next === 'metadata' || next === 'content') window.history.replaceState(null, '', `#${section}`);
    else if (window.location.hash !== `#${section}`) window.location.hash = section;
  };
  const canLeave = () => {
    if (formBusy) return false;
    const metadataDirty = page === 'metadata' && JSON.stringify(form) !== JSON.stringify(formMode === 'create' ? initialMetadata() : activeProject?.metadata) || page === 'metadata' && formMode === 'create' && Boolean(slug);
    if ((contentDirty || metadataDirty) && !window.confirm('This draft has unsaved changes. Leave this page?')) return false;
    setContentDirty(false); return true;
  };
  const navigate = (next: AdminSection) => { if (next === page || !canLeave()) return; setActiveProject(null); setMenuOpenId(null); setPage(next); };
  const hashHandler = useRef<() => void>(() => {});
  hashHandler.current = () => {
    if (window.location.hash === '#admin-content') return;
    const next = sectionFromHash();
    if (next === page) return;
    if (!canLeave()) { window.history.replaceState(null, '', `#${page === 'metadata' || page === 'content' ? 'library' : page}`); return; }
    setActiveProject(null); setPageState(next);
  };
  useEffect(() => { const handler = () => hashHandler.current(); window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);

  const mediaById = useMemo(() => new Map(media.map(asset => [asset.id, asset])), [media]);
  const refreshLibrary = useCallback(async (showSpinner = true) => {
    const request = ++requestRef.current;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [nextProjects, nextMedia] = await Promise.all([
        listAdminProjects({ query: deferredSearch, state: statusFilter === "all" ? undefined : statusFilter }),
        listAdminMedia(),
      ]);
      if (request !== requestRef.current) return;
      setProjects(nextProjects);
      setMedia(nextMedia);
    } catch (nextError) {
      if (request !== requestRef.current) return;
      setError(errorMessage(nextError, "The library could not be loaded."));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [deferredSearch, statusFilter]);

  useEffect(() => {
    let active = true;
    getAdminIdentity().then(nextIdentity => { if (active) setIdentity(nextIdentity); }).catch(nextError => { if (active) setError(errorMessage(nextError, "Admin authentication is required.")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredSearch(search.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!identity) return;
    void refreshLibrary();
  }, [identity, refreshLibrary]);

  const filteredProjects = useMemo(() => projects.filter(project => {
    const category = project.metadata.categoryId;
    return (disciplineFilter === "all" || categoryGroups[disciplineFilter].includes(category))
      && (categoryFilter === "all" || category === categoryFilter);
  }), [categoryFilter, disciplineFilter, projects]);

  const hasLibraryFilters = Boolean(search.trim()) || statusFilter !== "all" || disciplineFilter !== "all" || categoryFilter !== "all";

  const resetLibraryFilters = () => {
    setSearch("");
    setDeferredSearch("");
    setStatusFilter("all");
    setDisciplineFilter("all");
    setCategoryFilter("all");
  };

  const updateForm = (change: Partial<ProjectMetadata>) => setForm(current => ({ ...current, ...change }));
  const openCreate = () => {
    setFormMode("create"); setActiveProject(null); setForm(initialMetadata()); setSlug(""); setFormDocument(emptyArticleDocument);
    setFormError(null); setFieldErrors({}); setPage("metadata");
  };
  const openEdit = async (summary: AdminProjectSummary) => {
    setMenuOpenId(null); setPage("metadata"); setFormLoading(true); setFormError(null); setFieldErrors({});
    try {
      const project = await getAdminProject(summary.id);
      setFormMode("edit"); setActiveProject(project); setForm(project.metadata); setSlug(project.slug); setFormDocument(project.document);
    } catch (nextError) { setFormError(errorMessage(nextError, "Project details could not be loaded.")); }
    finally { setFormLoading(false); }
  };
  const openContent = async (summary: AdminProjectSummary) => {
    setMenuOpenId(null); setActiveProject(null); setPage("content"); setFormLoading(true); setFormError(null);
    try { setActiveProject(await getAdminProject(summary.id)); }
    catch (nextError) { setFormError(errorMessage(nextError, "Project content could not be loaded.")); }
    finally { setFormLoading(false); }
  };
  const validateForm = () => {
    const issues: Record<string, string[]> = {};
    if (!form.title.trim()) issues["$.title"] = ["Title is required."];
    if (!form.shortTitle.trim()) issues["$.shortTitle"] = ["Short title is required."];
    if (!form.subtitle.trim()) issues["$.subtitle"] = ["Subtitle is required."];
    if (!form.thumbnailAssetId) issues["$.thumbnailAssetId"] = ["Choose a thumbnail before saving."];
    setFieldErrors(issues);
    return Object.keys(issues).length === 0;
  };
  const submitForm = async () => {
    if (!validateForm()) { setFormError("Complete the required fields before saving."); return; }
    setFormBusy(true); setFormError(null);
    try {
      const saved = formMode === "create"
        ? await createAdminProject(form, slug.trim() || undefined)
        : activeProject ? await saveAdminProject(activeProject.id, activeProject.version, form, formDocument) : null;
      if (!saved) throw new Error("The project could not be saved.");
      setNotice(formMode === "create" ? "Project added to the library." : "Project metadata saved.");
      setPage("library"); setActiveProject(null); await refreshLibrary(false);
    } catch (nextError) {
      const apiError = nextError instanceof AdminApiError ? nextError : null;
      setFormError(errorMessage(nextError, "Project could not be saved."));
      if (apiError?.fieldErrors) setFieldErrors(apiError.fieldErrors);
    } finally { setFormBusy(false); }
  };
  const uploadForForm = async (file: File) => {
    setFormError(null); setFormBusy(true);
    try {
      const uploaded = await uploadAdminMedia(file, file.name.replace(/\.[^.]+$/, ""));
      setMedia(current => [uploaded, ...current.filter(asset => asset.id !== uploaded.id)]);
      if (!form.thumbnailAssetId) updateForm({ thumbnailAssetId: uploaded.id });
      setNotice(`${file.name} uploaded.`);
    } catch (nextError) { setFormError(errorMessage(nextError, "Image upload failed.")); }
    finally { setFormBusy(false); }
  };
  const duplicateProject = async (summary: AdminProjectSummary) => {
    setMenuOpenId(null); setNotice(null);
    const metadata = { ...summary.metadata, title: `${summary.metadata.title} Copy`.slice(0, 160), shortTitle: `${summary.metadata.shortTitle} Copy`.slice(0, 80), isFeatured: false };
    try { await createAdminProject(metadata); setNotice("Draft copy created."); await refreshLibrary(false); }
    catch (nextError) { setError(errorMessage(nextError, "The draft copy could not be created.")); }
  };
  const moveToTrash = async (summary: AdminProjectSummary) => {
    setMenuOpenId(null); setNotice(null);
    try { await trashAdminProject(summary.id); setNotice("Project moved to trash."); await refreshLibrary(false); }
    catch (nextError) { setError(errorMessage(nextError, "The project could not be moved to trash.")); }
  };
  const restoreProject = async (summary: AdminProjectSummary) => {
    setMenuOpenId(null); setNotice(null);
    try { await restoreAdminProject(summary.id); setNotice("Project restored as a draft."); await refreshLibrary(false); }
    catch (nextError) { setError(errorMessage(nextError, "The project could not be restored.")); }
  };

  const shell = { identity, section: page === 'content' || page === 'metadata' ? 'library' as const : page, onNavigate: navigate, onCreate: () => { if (canLeave()) openCreate(); } };
  if (!identity) return <AdminShell {...shell}>{error ? <div className="admin-alert admin-alert-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></div> : <LoadingState label="Verifying admin access" />}</AdminShell>;
  if (page === "metadata") return <AdminShell {...shell}>{formLoading ? <LoadingState label="Loading project details" /> : <MetadataForm mode={formMode} form={form} slug={slug} project={activeProject} media={media} busy={formBusy} error={formError} fieldErrors={fieldErrors} onChange={updateForm} onSlugChange={setSlug} onSubmit={submitForm} onCancel={() => { setPage("library"); setActiveProject(null); }} onUpload={uploadForForm} />}</AdminShell>;
  if (page === "content") return <AdminShell {...shell} editor>{formLoading ? <LoadingState label="Loading content editor" /> : formError || !activeProject ? <section className="admin-editor-load-error" role="alert"><CircleAlert aria-hidden="true" /><h1>Content editor unavailable</h1><p>{formError ?? "The project could not be loaded."}</p><button type="button" className="admin-button admin-button-quiet" onClick={() => { setPage("library"); setFormError(null); }}>Back to library</button></section> : <ArticleEditor key={activeProject.id} initialProject={activeProject} initialMedia={media} onDirtyChange={setContentDirty} onBack={() => { setPage("library"); setActiveProject(null); void refreshLibrary(false); }} onEditDetails={() => void openEdit(activeProject)} onProjectChange={updated => { setActiveProject(updated); setProjects(current => current.map(item => item.id === updated.id ? updated : item)); }} />}</AdminShell>;


  if (page === 'home') return <AdminShell {...shell}><HomePage onNavigate={navigate} onCreate={openCreate} onOpen={project => void openContent(project)} /></AdminShell>;
  if (page === 'analytics') return <AdminShell {...shell}><AnalyticsPage /></AdminShell>;
  if (page === 'orders') return <AdminShell {...shell}><OrdersPage /></AdminShell>;
  return <AdminShell {...shell}><header className="admin-page-header"><div><p className="admin-eyebrow">Content operations</p><h1>Project library<span className="admin-heading-dot">.</span></h1><p className="admin-page-lead">A home for everything you make.</p></div><button type="button" className="admin-button admin-button-primary" onClick={openCreate}><Plus aria-hidden="true" />Add project</button></header>
    {notice && <div className="admin-alert admin-alert-success" role="status"><CheckCircle2 aria-hidden="true" /><span>{notice}</span><button type="button" className="admin-alert-close" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X aria-hidden="true" /></button></div>}
    {error && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span><button type="button" className="admin-alert-close" aria-label="Dismiss error" onClick={() => setError(null)}><X aria-hidden="true" /></button></div>}
    <section className="admin-library-toolbar" aria-label="Project filters"><div className="admin-search-field"><Search aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, tag or tool" aria-label="Search projects" /></div><div className="admin-toolbar-actions"><button type="button" className="admin-icon-button" aria-label="Refresh library" title="Refresh library" onClick={() => void refreshLibrary()}><RefreshCw className={loading ? "admin-spin" : ""} aria-hidden="true" /></button><span className="admin-view-toggle" role="group" aria-label="Project view"><button type="button" className={viewMode === "grid" ? "is-active" : ""} aria-label="Grid view" title="Grid view" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}><Grid2X2 aria-hidden="true" /></button><button type="button" className={viewMode === "table" ? "is-active" : ""} aria-label="Table view" title="Table view" aria-pressed={viewMode === "table"} onClick={() => setViewMode("table")}><LayoutList aria-hidden="true" /></button></span></div></section>
    <section className="admin-filter-row" aria-label="Filter projects"><div className="admin-filter-tabs" role="group" aria-label="Project status"><button type="button" className={statusFilter === "all" ? "is-active" : ""} aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</button>{(["draft", "published", "unpublished-changes", "trash"] as ProjectAdminState[]).map(state => <button type="button" key={state} className={statusFilter === state ? "is-active" : ""} aria-pressed={statusFilter === state} onClick={() => setStatusFilter(state)}>{stateLabels[state]}</button>)}</div><label className="admin-filter-select"><span>Discipline</span><select value={disciplineFilter} onChange={event => { const value = event.target.value as DisciplineFilter; setDisciplineFilter(value); if (value !== "all" && categoryFilter !== "all" && !categoryGroups[value].includes(categoryFilter)) setCategoryFilter("all"); }}>{["all", "design", "development"].map(value => <option key={value} value={value}>{value === "all" ? "All disciplines" : value === "design" ? "Design" : "Development"}</option>)}</select><ChevronDown aria-hidden="true" /></label><label className="admin-filter-select"><span>Category</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as "all" | CategoryId)}><option value="all">All categories</option>{categoryGroups[disciplineFilter].map(id => <option key={id} value={id}>{categoryLabels[id]}</option>)}</select><ChevronDown aria-hidden="true" /></label></section>
    <div className="admin-library-summary"><span>{loading ? "Updating library" : `${filteredProjects.length} ${filteredProjects.length === 1 ? "project" : "projects"}`}</span><span className="admin-summary-rule" aria-hidden="true" /><span>{statusFilter === "trash" ? "Trash" : "Active library"}</span></div>
    {loading && !projects.length ? <LoadingState label="Loading project library" /> : filteredProjects.length === 0 ? <EmptyState trash={statusFilter === "trash"} search={search} hasFilters={hasLibraryFilters} onReset={resetLibraryFilters} onCreate={openCreate} /> : viewMode === "grid" ? <div className="admin-project-grid">{filteredProjects.map(project => <ProjectCard key={project.id} project={project} media={mediaById.get(project.metadata.thumbnailAssetId)} menuOpen={menuOpenId === project.id} onToggleMenu={() => setMenuOpenId(menuOpenId === project.id ? null : project.id)} onOpen={() => void openContent(project)} onEdit={() => void openEdit(project)} onDuplicate={() => void duplicateProject(project)} onTrash={() => void moveToTrash(project)} onRestore={() => void restoreProject(project)} />)}</div> : <ProjectTable projects={filteredProjects} mediaById={mediaById} menuOpenId={menuOpenId} onToggleMenu={id => setMenuOpenId(menuOpenId === id ? null : id)} onOpen={project => void openContent(project)} onEdit={project => void openEdit(project)} onDuplicate={project => void duplicateProject(project)} onTrash={project => void moveToTrash(project)} onRestore={project => void restoreProject(project)} />}
  </AdminShell>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="admin-loading" role="status"><LoaderCircle className="admin-spin" aria-hidden="true" /><span>{label}</span></div>;
}

function EmptyState({ trash, search, hasFilters, onReset, onCreate }: { trash: boolean; search: string; hasFilters: boolean; onReset: () => void; onCreate: () => void }) {
  const filtered = Boolean(search.trim()) || hasFilters;
  return <section className="admin-empty-state"><span className="admin-empty-icon">{trash ? <Trash2 aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}</span><p className="admin-eyebrow">{trash ? "Trash is clear" : filtered ? "No matches" : "Library is ready"}</p><h2>{trash ? "Nothing in the trash" : search.trim() ? `No projects match “${search}”.` : filtered ? "No projects in this view." : "Create the first project card."}</h2><p>{trash ? "Deleted cards will stay here until you restore them." : search.trim() ? "Try a broader title, tag or tool search." : filtered ? "Try another status, discipline or category." : "Start with metadata, then open the content editor when you are ready."}</p><div className="admin-empty-actions">{(filtered || trash) && <button type="button" className="admin-button admin-button-quiet" onClick={onReset}>View active library</button>}{!filtered && !trash && <button type="button" className="admin-button admin-button-primary" onClick={onCreate}><Plus aria-hidden="true" />Add project</button>}</div></section>;
}
