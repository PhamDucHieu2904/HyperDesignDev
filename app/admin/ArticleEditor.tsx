import {
  AlignLeft, ArrowDown, ArrowLeft, ArrowUp, Check, CircleAlert, Copy, Eye,
  FileText, GripVertical, Heading2, History as HistoryIcon, Image as ImageIcon, Laptop, LoaderCircle, Monitor, Plus, Redo2,
  RotateCcw, Save, Settings2, Smartphone, Trash2, Undo2, Upload, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  validateArticleDocument, type AdminMediaAsset, type AdminProject, type ArticleBlock,
  type ArticleDocument, type BlockStyle, type RichParagraph,
} from "../../shared/contracts";
import { AdminApiError, getAdminProject, publishAdminProject, restoreAdminRevision, saveAdminProject, uploadAdminMedia } from "./repository";
import {
  AdvancedCanvasContent, AdvancedInspectorFields, advancedBlockButtons, createAdvancedBlock,
  type AdvancedBlockType, type UploadTarget,
} from "./AdvancedBlockEditor";
import { ArticlePreview } from "./ArticlePreview";
import { RevisionHistory } from "./RevisionHistory";

type SaveState = "saved" | "unsaved" | "saving" | "error" | "conflict";
type PreviewSize = "desktop" | "mobile";
type HistoryState = { past: ArticleDocument[]; present: ArticleDocument; future: ArticleDocument[] };
type RecoveryDraft = { version: number; document: ArticleDocument; updatedAt: string };
type AddableBlockType = "heading" | "text" | "image" | AdvancedBlockType;

const deepCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const blockId = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function defaultStyle(): BlockStyle {
  return { width: "reading", background: "transparent", padding: "none" };
}

function createBlock(type: "heading" | "text" | "image", media: AdminMediaAsset[]): ArticleBlock | null {
  if (type === "heading") return { id: blockId(), type, level: 2, text: "New section", style: defaultStyle() };
  if (type === "text") return { id: blockId(), type, paragraphs: [{ spans: [{ text: "Add the project story here." }] }], style: defaultStyle() };
  const firstImage = media.find(asset => asset.state === "ready" && asset.mime.startsWith("image/"));
  if (!firstImage) return null;
  return { id: blockId(), type, assetId: firstImage.id, alt: firstImage.altDefault, fit: "contain", style: { ...defaultStyle(), width: "wide" } };
}

function typeLabel(block: ArticleBlock) {
  if (block.type === "heading") return "Heading";
  if (block.type === "text") return "Text";
  if (block.type === "image") return "Image";
  return block.type[0].toUpperCase() + block.type.slice(1);
}

function paragraphText(paragraphs: RichParagraph[]) {
  return paragraphs.map(paragraph => paragraph.spans.map(span => span.text).join("")).join("\n\n");
}

function paragraphsFromText(value: string, template?: RichParagraph[]): RichParagraph[] {
  const firstSpan = template?.[0]?.spans[0];
  const formatting = firstSpan ? { ...(firstSpan.bold && { bold: true }), ...(firstSpan.italic && { italic: true }), ...(firstSpan.href && { href: firstSpan.href }) } : {};
  return value.split(/\n\s*\n/).map(text => ({ spans: [{ text, ...formatting }] }));
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label = state === "saving" ? "Saving…" : state === "saved" ? "Saved to cloud" : state === "conflict" ? "Version conflict" : state === "error" ? "Save failed" : "Unsaved changes";
  return <span className={`admin-save-indicator is-${state}`} role="status" aria-live="polite">
    {state === "saving" ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : state === "saved" ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{label}
  </span>;
}

function AddBlockControls({ media, onAdd }: { media: AdminMediaAsset[]; onAdd: (type: AddableBlockType) => void }) {
  const hasImage = media.some(asset => asset.state === "ready" && asset.mime.startsWith("image/"));
  const hasVideo = media.some(asset => asset.state === "ready" && asset.mime.startsWith("video/"));
  return <div className="admin-add-block-controls" role="group" aria-label="Add content block">
    <button type="button" aria-label="Add heading block" onClick={() => onAdd("heading")}><Heading2 aria-hidden="true" /><span>Heading</span></button>
    <button type="button" aria-label="Add text block" onClick={() => onAdd("text")}><AlignLeft aria-hidden="true" /><span>Text</span></button>
    <button type="button" aria-label="Add image block" onClick={() => onAdd("image")} disabled={!hasImage} title={hasImage ? "Add image block" : "Upload an image first"}><ImageIcon aria-hidden="true" /><span>Image</span></button>
    {advancedBlockButtons.map(item => <button type="button" aria-label={`Add ${item.label.toLowerCase()} block`} key={item.type} disabled={(item.type === "gallery" && !hasImage) || (item.type === "video" && (!hasImage || !hasVideo))} title={item.type === "video" && !hasVideo ? "Upload a video first" : undefined} onClick={() => onAdd(item.type)}>{item.icon}<span>{item.label}</span></button>)}
  </div>;
}

function CommonStyleFields({ block, onChange }: { block: ArticleBlock; onChange: (next: ArticleBlock) => void }) {
  if (!("style" in block)) return null;
  const style = block.style ?? {};
  const updateStyle = (change: Partial<BlockStyle>) => onChange({ ...block, style: { ...style, ...change } } as ArticleBlock);
  return <section className="admin-inspector-section"><h3>Layout</h3><div className="admin-inspector-grid">
    <label className="admin-field"><span>Width</span><select value={style.width ?? "reading"} onChange={event => updateStyle({ width: event.target.value as BlockStyle["width"] })}><option value="reading">Reading</option><option value="wide">Wide</option><option value="full">Full</option></select></label>
    <label className="admin-field"><span>Background</span><select value={style.background ?? "transparent"} onChange={event => updateStyle({ background: event.target.value as BlockStyle["background"] })}><option value="transparent">None</option><option value="surface">Surface</option><option value="accent">Accent border</option></select></label>
    <label className="admin-field"><span>Padding</span><select value={style.padding ?? "none"} onChange={event => updateStyle({ padding: event.target.value as BlockStyle["padding"] })}><option value="none">None</option><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>
    {style.background === "accent" && <label className="admin-field"><span>Accent</span><input type="color" value={style.accentColor ?? "#d6a575"} onChange={event => updateStyle({ accentColor: event.target.value })} /></label>}
  </div></section>;
}

function BlockInspector({ block, media, onChange, onUpload, onError }: {
  block: ArticleBlock | undefined; media: AdminMediaAsset[]; onChange: (next: ArticleBlock) => void;
  onUpload: (file: File, target: UploadTarget) => void; onError: (message: string) => void;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  if (!block) return <aside className="admin-block-inspector"><div className="admin-inspector-placeholder"><Settings2 aria-hidden="true" /><h2>Block settings</h2><p>Select a block to edit its content and layout.</p></div></aside>;
  const readyImages = media.filter(asset => asset.state === "ready" && asset.mime.startsWith("image/"));
  return <aside className="admin-block-inspector" aria-label={`${typeLabel(block)} settings`}><header><div><span>Selected block</span><h2>{typeLabel(block)}</h2></div><span className="admin-block-id">{block.id.slice(0, 8)}</span></header>
    <section className="admin-inspector-section"><h3>Content</h3>
      {block.type === "heading" && <div className="admin-inspector-grid"><label className="admin-field"><span>Level</span><select value={block.level} onChange={event => onChange({ ...block, level: Number(event.target.value) as 2 | 3 })}><option value="2">Heading 2</option><option value="3">Heading 3</option></select></label><label className="admin-field"><span>Text</span><textarea rows={4} value={block.text} onChange={event => onChange({ ...block, text: event.target.value })} /></label></div>}
      {block.type === "text" && <div className="admin-inspector-grid"><label className="admin-field"><span>Paragraphs</span><textarea rows={8} value={paragraphText(block.paragraphs)} onChange={event => onChange({ ...block, paragraphs: paragraphsFromText(event.target.value, block.paragraphs) })} /><small className="admin-field-help">Separate paragraphs with a blank line.</small></label><div className="admin-format-row" role="group" aria-label="Text formatting"><button type="button" aria-pressed={Boolean(block.paragraphs[0]?.spans[0]?.bold)} onClick={() => { const bold = !block.paragraphs[0]?.spans[0]?.bold; onChange({ ...block, paragraphs: block.paragraphs.map(paragraph => ({ spans: paragraph.spans.map(span => ({ ...span, bold: bold || undefined })) })) }); }}><strong>B</strong><span>Bold</span></button><button type="button" aria-pressed={Boolean(block.paragraphs[0]?.spans[0]?.italic)} onClick={() => { const italic = !block.paragraphs[0]?.spans[0]?.italic; onChange({ ...block, paragraphs: block.paragraphs.map(paragraph => ({ spans: paragraph.spans.map(span => ({ ...span, italic: italic || undefined })) })) }); }}><em>I</em><span>Italic</span></button></div><label className="admin-field"><span>Link entire block</span><input type="url" placeholder="https://" value={block.paragraphs[0]?.spans[0]?.href ?? ""} onChange={event => { const href = event.target.value || undefined; onChange({ ...block, paragraphs: block.paragraphs.map(paragraph => ({ spans: paragraph.spans.map(span => ({ ...span, href })) })) }); }} /></label></div>}
      {block.type === "image" && <div className="admin-inspector-grid"><label className="admin-field"><span>Media</span><select value={block.assetId} onChange={event => { const asset = readyImages.find(item => item.id === event.target.value); onChange({ ...block, assetId: event.target.value, alt: block.alt || asset?.altDefault || "" }); }}>{readyImages.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label><button type="button" className="admin-button admin-button-quiet admin-upload-inline" onClick={() => uploadRef.current?.click()}><Upload aria-hidden="true" />Upload and replace</button><input ref={uploadRef} className="admin-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file, { blockId: block.id, field: "image" }); event.currentTarget.value = ""; }} /><label className="admin-field"><span>Alternative text</span><textarea rows={3} value={block.alt} onChange={event => onChange({ ...block, alt: event.target.value })} /></label><label className="admin-field"><span>Caption</span><textarea rows={3} value={block.caption ?? ""} onChange={event => onChange({ ...block, caption: event.target.value || undefined })} /></label><label className="admin-field"><span>Image fit</span><select value={block.fit} onChange={event => onChange({ ...block, fit: event.target.value as "contain" | "cover" })}><option value="contain">Contain artwork</option><option value="cover">Cover frame</option></select></label></div>}
      <AdvancedInspectorFields block={block} media={media} makeId={blockId} onChange={onChange} onUpload={onUpload} onError={onError} />
    </section>
    <CommonStyleFields block={block} onChange={onChange} />
  </aside>;
}

function CanvasBlock({ block, selected, media, index, count, onSelect, onChange, onMove, onDuplicate, onDelete, onDragStart, onDrop }: {
  block: ArticleBlock; selected: boolean; media: Map<string, AdminMediaAsset>; index: number; count: number;
  onSelect: () => void; onChange: (next: ArticleBlock) => void; onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void; onDelete: () => void; onDragStart: () => void; onDrop: () => void;
}) {
  const asset = block.type === "image" ? media.get(block.assetId) : undefined;
  return <article className={`admin-canvas-block ${selected ? "is-selected" : ""}`} draggable onDragStart={onDragStart} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); onDrop(); }} onClick={onSelect}>
    <header><button type="button" className="admin-block-handle" aria-label={`Select and drag ${typeLabel(block)} block`} onClick={onSelect}><GripVertical aria-hidden="true" /><strong>{typeLabel(block)}</strong><small>{String(index + 1).padStart(2, "0")}</small></button><div className="admin-block-actions"><button type="button" onClick={event => { event.stopPropagation(); onMove(-1); }} disabled={index === 0} aria-label="Move block up" title="Move up"><ArrowUp aria-hidden="true" /></button><button type="button" onClick={event => { event.stopPropagation(); onMove(1); }} disabled={index === count - 1} aria-label="Move block down" title="Move down"><ArrowDown aria-hidden="true" /></button><button type="button" onClick={event => { event.stopPropagation(); onDuplicate(); }} aria-label="Duplicate block" title="Duplicate"><Copy aria-hidden="true" /></button><button type="button" className="is-danger" onClick={event => { event.stopPropagation(); onDelete(); }} aria-label="Delete block" title="Delete"><Trash2 aria-hidden="true" /></button></div></header>
    <div className="admin-canvas-block-content">
      {block.type === "heading" && <input className={`admin-canvas-heading is-h${block.level}`} value={block.text} aria-label="Heading text" onFocus={onSelect} onChange={event => onChange({ ...block, text: event.target.value })} />}
      {block.type === "text" && <textarea className="admin-canvas-text" rows={Math.max(3, paragraphText(block.paragraphs).split("\n").length)} value={paragraphText(block.paragraphs)} aria-label="Paragraph text" onFocus={onSelect} onChange={event => onChange({ ...block, paragraphs: paragraphsFromText(event.target.value, block.paragraphs) })} />}
      {block.type === "image" && (asset ? <figure><img src={asset.contentUrl} alt={block.alt || asset.altDefault} width={asset.width ?? undefined} height={asset.height ?? undefined} loading="lazy" /><figcaption>{block.caption || asset.originalName}</figcaption></figure> : <div className="admin-canvas-missing"><ImageIcon aria-hidden="true" />Choose an available image in Block settings.</div>)}
      <AdvancedCanvasContent block={block} media={media} />
    </div>
  </article>;
}

export function ArticleEditor({ initialProject, initialMedia, onBack, onEditDetails, onProjectChange, onDirtyChange }: {
  initialProject: AdminProject; initialMedia: AdminMediaAsset[]; onBack: () => void; onEditDetails: () => void;
  onProjectChange: (project: AdminProject) => void; onDirtyChange?: (dirty: boolean) => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [media, setMedia] = useState(initialMedia);
  const [history, setHistory] = useState<HistoryState>({ past: [], present: deepCopy(initialProject.document), future: [] });
  const [selectedId, setSelectedId] = useState<string | null>(initialProject.document.blocks[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewSize, setPreviewSize] = useState<PreviewSize>("desktop");
  const [publishOpen, setPublishOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryDraft | null>(null);
  const projectRef = useRef(project);
  const historyRef = useRef(history);
  const dirtyRef = useRef(dirty);
  const savedDocumentRef = useRef(deepCopy(initialProject.document));
  const savingRef = useRef(false);
  const changeSerial = useRef(0);
  const draggedId = useRef<string | null>(null);
  const storageKey = `hyperd-admin-draft:${initialProject.id}`;

  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { dirtyRef.current = dirty; onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as RecoveryDraft;
      const validated = validateArticleDocument(parsed.document);
      if (parsed.version === initialProject.version && validated.ok && JSON.stringify(parsed.document) !== JSON.stringify(initialProject.document)) setRecovery(parsed);
      else localStorage.removeItem(storageKey);
    } catch { localStorage.removeItem(storageKey); }
  }, [initialProject.document, initialProject.version, storageKey]);

  const applyHistory = useCallback((nextHistory: HistoryState) => {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    const changed = JSON.stringify(nextHistory.present) !== JSON.stringify(savedDocumentRef.current);
    dirtyRef.current = changed;
    setDirty(changed);
    setSaveState(changed ? "unsaved" : "saved");
    setError(null);
  }, []);

  const commit = useCallback((next: ArticleDocument | ((current: ArticleDocument) => ArticleDocument), selectId?: string | null) => {
    const current = historyRef.current;
    const document = typeof next === "function" ? next(current.present) : next;
    if (JSON.stringify(document) === JSON.stringify(current.present)) return;
    applyHistory({ past: [...current.past.slice(-49), deepCopy(current.present)], present: document, future: [] });
    changeSerial.current += 1;
    if (selectId !== undefined) setSelectedId(selectId);
  }, [applyHistory]);

  useEffect(() => {
    if (!dirty) return;
    const payload: RecoveryDraft = { version: project.version, document: history.present, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch { /* Browser storage is best-effort. */ }
  }, [dirty, history.present, project.version, storageKey]);

  const updateBlock = useCallback((next: ArticleBlock) => commit(current => ({ ...current, blocks: current.blocks.map(block => block.id === next.id ? next : block) })), [commit]);

  const addBlock = (type: AddableBlockType) => {
    const result = type === "heading" || type === "text" || type === "image"
      ? { block: createBlock(type, media), error: type === "image" ? "Upload an image before adding an image block." : undefined }
      : createAdvancedBlock(type, media, blockId);
    if (!result.block) { setError(result.error ?? "This block cannot be added yet."); return; }
    const block = result.block;
    commit(current => {
      const blocks = [...current.blocks];
      const selectedIndex = selectedId ? blocks.findIndex(item => item.id === selectedId) : -1;
      blocks.splice(selectedIndex >= 0 ? selectedIndex + 1 : blocks.length, 0, block);
      return { ...current, blocks };
    }, block.id);
  };

  const moveBlock = (id: string, direction: -1 | 1) => commit(current => {
    const blocks = [...current.blocks];
    const from = blocks.findIndex(block => block.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= blocks.length) return current;
    const [block] = blocks.splice(from, 1); blocks.splice(to, 0, block);
    return { ...current, blocks };
  }, id);

  const dropBlock = (targetId: string) => {
    const sourceId = draggedId.current;
    draggedId.current = null;
    if (!sourceId || sourceId === targetId) return;
    commit(current => {
      const blocks = [...current.blocks];
      const from = blocks.findIndex(block => block.id === sourceId);
      const to = blocks.findIndex(block => block.id === targetId);
      if (from < 0 || to < 0) return current;
      const [block] = blocks.splice(from, 1); blocks.splice(to, 0, block);
      return { ...current, blocks };
    }, sourceId);
  };

  const duplicateBlock = (id: string) => {
    const copyId = blockId();
    commit(current => {
    const blocks = [...current.blocks];
    const index = blocks.findIndex(block => block.id === id);
    if (index < 0) return current;
    const copy = { ...deepCopy(blocks[index]), id: copyId } as ArticleBlock;
    blocks.splice(index + 1, 0, copy);
    return { ...current, blocks };
    }, copyId);
  };

  const deleteBlock = (id: string) => {
    const current = historyRef.current.present;
    const index = current.blocks.findIndex(block => block.id === id);
    const blocks = current.blocks.filter(block => block.id !== id);
    commit({ ...current, blocks }, blocks[Math.min(index, blocks.length - 1)]?.id ?? null);
  };

  const undo = useCallback(() => {
    const current = historyRef.current;
    const previous = current.past.at(-1);
    if (!previous) return;
    applyHistory({ past: current.past.slice(0, -1), present: deepCopy(previous), future: [deepCopy(current.present), ...current.future].slice(0, 50) });
    changeSerial.current += 1;
  }, [applyHistory]);

  const redo = useCallback(() => {
    const current = historyRef.current;
    const next = current.future[0];
    if (!next) return;
    applyHistory({ past: [...current.past.slice(-49), deepCopy(current.present)], present: deepCopy(next), future: current.future.slice(1) });
    changeSerial.current += 1;
  }, [applyHistory]);

  const saveDraft = useCallback(async () => {
    if (savingRef.current) return null;
    const validation = validateArticleDocument(historyRef.current.present);
    if (!validation.ok) {
      setSaveState("error"); setError(validation.issues[0]?.message ?? "The article contains invalid content."); return null;
    }
    savingRef.current = true;
    const serial = changeSerial.current;
    const currentProject = projectRef.current;
    setSaveState("saving"); setError(null);
    try {
      const saved = await saveAdminProject(currentProject.id, currentProject.version, currentProject.metadata, validation.value);
      projectRef.current = saved; setProject(saved); onProjectChange(saved);
      if (serial === changeSerial.current) {
        savedDocumentRef.current = deepCopy(validation.value);
        setDirty(false); dirtyRef.current = false; setSaveState("saved"); localStorage.removeItem(storageKey);
      } else setSaveState("unsaved");
      return saved;
    } catch (nextError) {
      const conflict = nextError instanceof AdminApiError && nextError.code === "VERSION_CONFLICT";
      setSaveState(conflict ? "conflict" : "error");
      setError(conflict ? "This draft changed in another tab. Reload the cloud version before continuing." : nextError instanceof Error ? nextError.message : "The draft could not be saved.");
      return null;
    } finally { savingRef.current = false; }
  }, [onProjectChange, storageKey]);

  useEffect(() => {
    if (!dirty || saveState === "conflict" || saveState === "saving") return;
    const timer = window.setTimeout(() => { void saveDraft(); }, 2000);
    return () => window.clearTimeout(timer);
  }, [dirty, history.present, project.version, saveDraft, saveState]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") { event.preventDefault(); void saveDraft(); }
      if (key === "z" && !event.shiftKey) { event.preventDefault(); undo(); }
      if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [redo, saveDraft, undo]);

  const reloadCloud = async () => {
    try {
      const fresh = await getAdminProject(project.id);
      const nextHistory = { past: [], present: deepCopy(fresh.document), future: [] };
      setProject(fresh); projectRef.current = fresh; savedDocumentRef.current = deepCopy(fresh.document); historyRef.current = nextHistory; setHistory(nextHistory);
      setDirty(false); setSaveState("saved"); setError(null); setSelectedId(fresh.document.blocks[0]?.id ?? null); localStorage.removeItem(storageKey); onProjectChange(fresh);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "The cloud draft could not be reloaded."); }
  };

  const uploadMedia = async (file: File, target?: UploadTarget) => {
    setUploading(true); setError(null);
    try {
      const asset = await uploadAdminMedia(file, file.name.replace(/\.[^.]+$/, ""));
      setMedia(current => [asset, ...current.filter(item => item.id !== asset.id)]);
      if (target) {
        commit(current => ({ ...current, blocks: current.blocks.map(block => {
          if (block.id !== target.blockId) return block;
          if (target.field === "image" && block.type === "image") return { ...block, assetId: asset.id, alt: asset.altDefault || block.alt };
          if (target.field === "video" && block.type === "video") return { ...block, assetId: asset.id };
          if (target.field === "poster" && block.type === "video") return { ...block, posterAssetId: asset.id };
          return block;
        }) }), target.blockId);
      } else {
        const next = asset.mime.startsWith("video/") ? createAdvancedBlock("video", [asset, ...media], blockId) : { block: createBlock("image", [asset]) };
        if (next.block) commit(current => ({ ...current, blocks: [...current.blocks, next.block as ArticleBlock] }), next.block.id);
        else setError(next.error ?? "The media was uploaded. Select it when adding a compatible block.");
      }
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "Image upload failed."); }
    finally { setUploading(false); }
  };

  const publish = async () => {
    setPublishing(true); setError(null);
    try {
      let publishProject = projectRef.current;
      if (dirtyRef.current) {
        const saved = await saveDraft();
        if (!saved) return;
        publishProject = saved;
      }
      const result = await publishAdminProject(publishProject.id, publishProject.version);
      projectRef.current = result.project; setProject(result.project); setPublishOpen(false); setSaveState("saved"); onProjectChange(result.project);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "The project could not be published."); }
    finally { setPublishing(false); }
  };

  const leaveEditor = () => {
    if (dirty && !window.confirm("This draft still has unsaved changes. Leave the editor?")) return;
    onBack();
  };

  const restoreRevisionToDraft = async (revision: { id: string }) => {
    const restored = await restoreAdminRevision(projectRef.current.id, revision.id, projectRef.current.version);
    const nextHistory: HistoryState = { past: [], present: deepCopy(restored.document), future: [] };
    projectRef.current = restored; setProject(restored); savedDocumentRef.current = deepCopy(restored.document);
    historyRef.current = nextHistory; setHistory(nextHistory); setSelectedId(restored.document.blocks[0]?.id ?? null);
    dirtyRef.current = false; setDirty(false); setSaveState("saved"); setError(null); setRecovery(null);
    localStorage.removeItem(storageKey); changeSerial.current += 1; onProjectChange(restored);
  };

  const selectedBlock = history.present.blocks.find(block => block.id === selectedId);
  const mediaById = useMemo(() => new Map(media.map(asset => [asset.id, asset])), [media]);
  const referencedMediaCount = useMemo(() => {
    const ids = new Set<string>();
    const collect = (blocks: ArticleBlock[]) => blocks.forEach(block => {
      if (block.type === "image" || block.type === "video") ids.add(block.assetId);
      if (block.type === "video") ids.add(block.posterAssetId);
      if (block.type === "gallery") block.items.forEach(item => ids.add(item.assetId));
      if (block.type === "columns") block.columns.forEach(collect);
    });
    collect(history.present.blocks);
    return ids.size;
  }, [history.present.blocks]);

  return <section className="admin-article-editor" aria-labelledby="article-editor-title">
    <header className="admin-editor-toolbar"><div className="admin-editor-title"><button type="button" className="admin-icon-button" aria-label="Back to project library" title="Back to library" onClick={leaveEditor}><ArrowLeft aria-hidden="true" /></button><div><span>Content editor</span><h1 id="article-editor-title">{project.metadata.title}</h1></div><span className={`admin-status admin-status-${project.state}`}><span aria-hidden="true" />{project.state === "unpublished-changes" ? "Unpublished changes" : project.state[0].toUpperCase() + project.state.slice(1)}</span></div>
      <div className="admin-editor-actions"><SaveIndicator state={saveState} /><div className="admin-editor-history" role="group" aria-label="Edit history"><button type="button" disabled={!history.past.length} onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 aria-hidden="true" /></button><button type="button" disabled={!history.future.length} onClick={redo} aria-label="Redo" title="Redo (Ctrl+Y)"><Redo2 aria-hidden="true" /></button></div><button type="button" className="admin-button admin-button-quiet" onClick={onEditDetails}><Settings2 aria-hidden="true" />Details</button><button type="button" className="admin-button admin-button-quiet" onClick={() => setRevisionsOpen(true)}><HistoryIcon aria-hidden="true" />History</button><button type="button" className={`admin-button admin-button-quiet ${preview ? "is-active" : ""}`} aria-pressed={preview} onClick={() => setPreview(value => !value)}><Eye aria-hidden="true" />Preview</button><button type="button" className="admin-button admin-button-quiet" disabled={!dirty || saveState === "saving"} onClick={() => void saveDraft()}><Save aria-hidden="true" />Save draft</button><button type="button" className="admin-button admin-button-primary" disabled={publishing || saveState === "saving" || saveState === "conflict"} onClick={() => setPublishOpen(true)}>Publish</button></div>
    </header>

    {recovery && <div className="admin-alert admin-alert-warning" role="status"><RotateCcw aria-hidden="true" /><span>A local recovery copy from {new Date(recovery.updatedAt).toLocaleString()} is available.</span><button type="button" className="admin-alert-action" onClick={() => { commit(deepCopy(recovery.document), recovery.document.blocks[0]?.id ?? null); setRecovery(null); }}>Restore copy</button><button type="button" className="admin-alert-close" aria-label="Discard recovery copy" onClick={() => { localStorage.removeItem(storageKey); setRecovery(null); }}><X aria-hidden="true" /></button></div>}
    {error && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span>{saveState === "conflict" && <button type="button" className="admin-alert-action" onClick={() => void reloadCloud()}>Reload cloud draft</button>}<button type="button" className="admin-alert-close" aria-label="Dismiss error" onClick={() => setError(null)}><X aria-hidden="true" /></button></div>}

    {preview ? <div className="admin-preview-workspace"><header><div><p className="admin-eyebrow">Private draft preview</p><h2>{project.metadata.title}</h2><p>{project.metadata.subtitle}</p></div><div className="admin-preview-size" role="group" aria-label="Preview size"><button type="button" className={previewSize === "desktop" ? "is-active" : ""} aria-pressed={previewSize === "desktop"} onClick={() => setPreviewSize("desktop")}><Monitor aria-hidden="true" /><span>Desktop</span></button><button type="button" className={previewSize === "mobile" ? "is-active" : ""} aria-pressed={previewSize === "mobile"} onClick={() => setPreviewSize("mobile")}><Smartphone aria-hidden="true" /><span>Mobile</span></button></div></header><div className={`admin-preview-frame is-${previewSize}`}><article><header className="admin-preview-project-header"><span>{project.metadata.year || "Selected work"} / {project.metadata.categoryId}</span><h1>{project.metadata.title}</h1><p>{project.metadata.subtitle}</p>{(project.metadata.role || project.metadata.tools.length > 0) && <dl>{project.metadata.role && <div><dt>Role</dt><dd>{project.metadata.role}</dd></div>}{project.metadata.tools.length > 0 && <div><dt>Tools</dt><dd>{project.metadata.tools.join(" · ")}</dd></div>}</dl>}</header><ArticlePreview document={history.present} media={media} /></article></div></div>
      : <div className="admin-editor-workspace"><aside className="admin-block-library"><header><Plus aria-hidden="true" /><div><span>Block library</span><strong>Add content</strong></div></header><AddBlockControls media={media} onAdd={addBlock} /><div className="admin-block-library-note"><Laptop aria-hidden="true" /><p>Drag blocks to reorder on desktop. Move buttons remain available for keyboard and touch.</p></div><div className="admin-library-upload-actions"><button type="button" className="admin-button admin-button-quiet" disabled={uploading} onClick={() => document.getElementById("admin-editor-image-upload")?.click()}><Upload aria-hidden="true" />{uploading ? "Uploading…" : "Upload image"}</button><button type="button" className="admin-button admin-button-quiet" disabled={uploading} onClick={() => document.getElementById("admin-editor-video-upload")?.click()}><Upload aria-hidden="true" />Upload video</button></div><input id="admin-editor-image-upload" className="admin-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /><input id="admin-editor-video-upload" className="admin-visually-hidden" type="file" accept="video/mp4,video/webm" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadMedia(file); event.currentTarget.value = ""; }} /></aside>
        <main className="admin-editor-canvas" aria-label="Article blocks">{history.present.blocks.length === 0 ? <div className="admin-editor-empty"><span className="admin-editor-empty-icon"><FileText aria-hidden="true" /></span><p className="admin-eyebrow">Empty story</p><h2>Build the first project section.</h2><p>Start with a heading, supporting text or a full-width image. The card can remain published without body content.</p><AddBlockControls media={media} onAdd={addBlock} /></div> : <div className="admin-canvas-list">{history.present.blocks.map((block, index) => <CanvasBlock key={block.id} block={block} selected={selectedId === block.id} media={mediaById} index={index} count={history.present.blocks.length} onSelect={() => setSelectedId(block.id)} onChange={updateBlock} onMove={direction => moveBlock(block.id, direction)} onDuplicate={() => duplicateBlock(block.id)} onDelete={() => deleteBlock(block.id)} onDragStart={() => { draggedId.current = block.id; }} onDrop={() => dropBlock(block.id)} />)}<AddBlockControls media={media} onAdd={addBlock} /></div>}</main>
        <BlockInspector block={selectedBlock} media={media} onChange={updateBlock} onUpload={(file, target) => void uploadMedia(file, target)} onError={setError} />
      </div>}

    <footer className="admin-editor-mobile-bar"><button type="button" aria-label="Undo" disabled={!history.past.length} onClick={undo}><Undo2 aria-hidden="true" /></button><button type="button" className={preview ? "is-active" : ""} aria-label="Toggle preview" onClick={() => setPreview(value => !value)}><Eye aria-hidden="true" /></button><button type="button" aria-label="Revision history" onClick={() => setRevisionsOpen(true)}><HistoryIcon aria-hidden="true" /></button><button type="button" aria-label="Save draft" disabled={!dirty || saveState === "saving"} onClick={() => void saveDraft()}><Save aria-hidden="true" /></button><button type="button" className="is-publish" onClick={() => setPublishOpen(true)}>Publish</button></footer>

    {publishOpen && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !publishing) setPublishOpen(false); }}><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title"><header><div><p className="admin-eyebrow">Publication check</p><h2 id="publish-dialog-title">Publish “{project.metadata.shortTitle}”?</h2></div><button type="button" className="admin-icon-button" aria-label="Close publish dialog" disabled={publishing} onClick={() => setPublishOpen(false)}><X aria-hidden="true" /></button></header><p>Publishing creates an immutable snapshot. Later draft edits will not change the public portfolio until you publish again.</p><dl><div><dt>Blocks</dt><dd>{history.present.blocks.length}</dd></div><div><dt>Media assets</dt><dd>{referencedMediaCount}</dd></div><div><dt>Draft version</dt><dd>{project.version}</dd></div></dl>{history.present.blocks.length === 0 && <div className="admin-dialog-warning"><CircleAlert aria-hidden="true" /><span>This publishes the project card with “Content is being prepared” in the detail view.</span></div>}<footer><button type="button" className="admin-button admin-button-quiet" disabled={publishing} onClick={() => setPublishOpen(false)}>Cancel</button><button type="button" className="admin-button admin-button-primary" disabled={publishing} onClick={() => void publish()}>{publishing ? <LoaderCircle className="admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{publishing ? "Publishing…" : "Publish snapshot"}</button></footer></section></div>}
    {revisionsOpen && <RevisionHistory project={project} media={media} hasUnsavedChanges={dirty} onClose={() => setRevisionsOpen(false)} onRestore={restoreRevisionToDraft} />}
  </section>;
}
