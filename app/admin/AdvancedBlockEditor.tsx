import {
  ArrowDown, ArrowUp, Columns3, ExternalLink, Images, Link as LinkIcon,
  Plus, Space, Trash2, Upload, Video as VideoIcon,
} from "lucide-react";
import { useRef, type ReactNode } from "react";
import type { AdminMediaAsset, ArticleBlock, BlockStyle } from "../../shared/contracts";

export type AdvancedBlockType = "gallery" | "columns" | "video" | "links" | "spacer";
export type NestedBlockType = "heading" | "text" | "image" | "links" | "spacer";
export type UploadTarget = { blockId: string; field: "image" | "video" | "poster" };

type CreateResult = { block: ArticleBlock | null; error?: string };
type IdFactory = () => string;

const defaultStyle = (): BlockStyle => ({ width: "wide", background: "transparent", padding: "none" });
const readyImages = (media: AdminMediaAsset[]) => media.filter(asset => asset.state === "ready" && asset.mime.startsWith("image/"));
const readyVideos = (media: AdminMediaAsset[]) => media.filter(asset => asset.state === "ready" && asset.mime.startsWith("video/"));

function createNestedBlock(type: NestedBlockType, media: AdminMediaAsset[], makeId: IdFactory): CreateResult {
  if (type === "heading") return { block: { id: makeId(), type, level: 3, text: "Column heading" } };
  if (type === "text") return { block: { id: makeId(), type, paragraphs: [{ spans: [{ text: "Add column text." }] }] } };
  if (type === "links") return { block: { id: makeId(), type, items: [{ label: "Project link", url: "https://example.com" }] } };
  if (type === "spacer") return { block: { id: makeId(), type, size: "md" } };
  const image = readyImages(media)[0];
  return image
    ? { block: { id: makeId(), type: "image", assetId: image.id, alt: image.altDefault, fit: "contain" } }
    : { block: null, error: "Upload an image before adding an image to a column." };
}

export function createAdvancedBlock(type: AdvancedBlockType, media: AdminMediaAsset[], makeId: IdFactory): CreateResult {
  const images = readyImages(media);
  if (type === "gallery") return images[0]
    ? { block: { id: makeId(), type, columns: 2, items: [{ assetId: images[0].id, alt: images[0].altDefault }], style: defaultStyle() } }
    : { block: null, error: "Upload an image before adding a gallery." };
  if (type === "columns") return { block: {
    id: makeId(), type, columns: [
      [{ id: makeId(), type: "heading", level: 3, text: "First column" }],
      [{ id: makeId(), type: "text", paragraphs: [{ spans: [{ text: "Add supporting content." }] }] }],
    ], style: defaultStyle(),
  } };
  if (type === "video") {
    const video = readyVideos(media)[0];
    const poster = images[0];
    if (!video) return { block: null, error: "Upload an MP4 or WebM file before adding a video block." };
    if (!poster) return { block: null, error: "Upload an image to use as the video poster." };
    return { block: { id: makeId(), type, assetId: video.id, posterAssetId: poster.id, caption: "", style: defaultStyle() } };
  }
  if (type === "links") return { block: { id: makeId(), type, items: [{ label: "Project link", url: "https://example.com" }] } };
  return { block: { id: makeId(), type: "spacer", size: "md" } };
}

function MoveButtons({ index, count, onMove, onDelete, label, disableDelete = false }: {
  index: number; count: number; onMove: (direction: -1 | 1) => void; onDelete: () => void; label: string; disableDelete?: boolean;
}) {
  return <div className="admin-inline-actions">
    <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${label} up`}><ArrowUp aria-hidden="true" /></button>
    <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${label} down`}><ArrowDown aria-hidden="true" /></button>
    <button type="button" className="is-danger" disabled={disableDelete} onClick={onDelete} aria-label={`Delete ${label}`}><Trash2 aria-hidden="true" /></button>
  </div>;
}

function reorder<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function LinkFields({ block, onChange }: { block: Extract<ArticleBlock, { type: "links" }>; onChange: (next: ArticleBlock) => void }) {
  return <div className="admin-advanced-list">
    {block.items.map((item, index) => <fieldset className="admin-advanced-item" key={`${block.id}-link-${index}`}>
      <legend>Link {index + 1}</legend>
      <MoveButtons index={index} count={block.items.length} disableDelete={block.items.length === 1} label={`link ${index + 1}`} onMove={direction => onChange({ ...block, items: reorder(block.items, index, direction) })} onDelete={() => onChange({ ...block, items: block.items.filter((_, itemIndex) => itemIndex !== index) })} />
      <label className="admin-field"><span>Label</span><input value={item.label} onChange={event => onChange({ ...block, items: block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, label: event.target.value } : entry) })} /></label>
      <label className="admin-field"><span>URL</span><input type="url" value={item.url} aria-describedby={`${block.id}-link-help`} onChange={event => onChange({ ...block, items: block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, url: event.target.value } : entry) })} /></label>
    </fieldset>)}
    <small id={`${block.id}-link-help`} className="admin-field-help">Use a complete http:// or https:// address.</small>
    <button type="button" className="admin-button admin-button-quiet admin-add-row" disabled={block.items.length >= 10} onClick={() => onChange({ ...block, items: [...block.items, { label: "Project link", url: "https://example.com" }] })}><Plus aria-hidden="true" />Add link</button>
  </div>;
}

function NestedEditor({ block, media, onChange }: {
  block: ArticleBlock; media: AdminMediaAsset[]; onChange: (next: ArticleBlock) => void;
}) {
  const images = readyImages(media);
  if (block.type === "heading") return <div className="admin-nested-fields"><label className="admin-field"><span>Heading level</span><select value={block.level} onChange={event => onChange({ ...block, level: Number(event.target.value) as 2 | 3 })}><option value="2">Heading 2</option><option value="3">Heading 3</option></select></label><label className="admin-field"><span>Text</span><input value={block.text} onChange={event => onChange({ ...block, text: event.target.value })} /></label></div>;
  if (block.type === "text") return <label className="admin-field"><span>Text</span><textarea rows={4} value={block.paragraphs.map(paragraph => paragraph.spans.map(span => span.text).join("")).join("\n\n")} onChange={event => onChange({ ...block, paragraphs: event.target.value.split(/\n\s*\n/).map(text => ({ spans: [{ text }] })) })} /></label>;
  if (block.type === "image") return <div className="admin-nested-fields"><label className="admin-field"><span>Image</span><select value={block.assetId} onChange={event => { const asset = images.find(item => item.id === event.target.value); onChange({ ...block, assetId: event.target.value, alt: block.alt || asset?.altDefault || "" }); }}>{images.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label><label className="admin-field"><span>Alternative text</span><input value={block.alt} onChange={event => onChange({ ...block, alt: event.target.value })} /></label></div>;
  if (block.type === "links") return <LinkFields block={block} onChange={onChange} />;
  if (block.type === "spacer") return <label className="admin-field"><span>Spacer size</span><select value={block.size} onChange={event => onChange({ ...block, size: event.target.value as "sm" | "md" | "lg" })}><option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option></select></label>;
  return <p className="admin-inspector-note">This nested {block.type} block remains preview-only. Use the top-level editor for full controls.</p>;
}

function ColumnsFields({ block, media, makeId, onChange, onError }: {
  block: Extract<ArticleBlock, { type: "columns" }>; media: AdminMediaAsset[]; makeId: IdFactory;
  onChange: (next: ArticleBlock) => void; onError: (message: string) => void;
}) {
  const updateColumn = (columnIndex: number, children: ArticleBlock[]) => onChange({ ...block, columns: block.columns.map((column, index) => index === columnIndex ? children : column) });
  return <div className="admin-columns-editor">
    <label className="admin-field"><span>Columns</span><select value={block.columns.length} onChange={event => {
      const count = Number(event.target.value);
      const columns = block.columns.slice(0, count);
      while (columns.length < count) columns.push([]);
      onChange({ ...block, columns });
    }}><option value="2">2 columns</option><option value="3">3 columns</option></select></label>
    {block.columns.map((column, columnIndex) => <section className="admin-column-editor" key={`${block.id}-column-${columnIndex}`}>
      <header><strong>Column {columnIndex + 1}</strong><small>{column.length} blocks</small></header>
      {column.length === 0 && <p className="admin-column-empty">This column is empty.</p>}
      {column.map((child, childIndex) => <article className="admin-nested-block" key={child.id}>
        <header><span>{child.type}</span><MoveButtons index={childIndex} count={column.length} label={`${child.type} block`} onMove={direction => updateColumn(columnIndex, reorder(column, childIndex, direction))} onDelete={() => updateColumn(columnIndex, column.filter(item => item.id !== child.id))} /></header>
        <NestedEditor block={child} media={media} onChange={next => updateColumn(columnIndex, column.map(item => item.id === child.id ? next : item))} />
      </article>)}
      <div className="admin-nested-add" role="group" aria-label={`Add block to column ${columnIndex + 1}`}>
        {(["heading", "text", "image", "links", "spacer"] as NestedBlockType[]).map(type => <button type="button" key={type} onClick={() => {
          const result = createNestedBlock(type, media, makeId);
          if (result.block) updateColumn(columnIndex, [...column, result.block]);
          else if (result.error) onError(result.error);
        }}>{type}</button>)}
      </div>
    </section>)}
  </div>;
}

export function AdvancedInspectorFields({ block, media, makeId, onChange, onUpload, onError }: {
  block: ArticleBlock; media: AdminMediaAsset[]; makeId: IdFactory; onChange: (next: ArticleBlock) => void;
  onUpload: (file: File, target: UploadTarget) => void; onError: (message: string) => void;
}): ReactNode {
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const posterUploadRef = useRef<HTMLInputElement>(null);
  const images = readyImages(media);
  const videos = readyVideos(media);
  if (block.type === "gallery") return <div className="admin-inspector-grid">
    <label className="admin-field"><span>Desktop columns</span><select value={block.columns} onChange={event => onChange({ ...block, columns: Number(event.target.value) as 2 | 3 })}><option value="2">2 columns</option><option value="3">3 columns</option></select></label>
    <div className="admin-advanced-list">{block.items.map((item, index) => <fieldset className="admin-advanced-item" key={`${block.id}-gallery-${index}`}><legend>Image {index + 1}</legend><MoveButtons index={index} count={block.items.length} label={`gallery image ${index + 1}`} onMove={direction => onChange({ ...block, items: reorder(block.items, index, direction) })} onDelete={() => { if (block.items.length === 1) onError("A gallery must keep at least one image."); else onChange({ ...block, items: block.items.filter((_, itemIndex) => itemIndex !== index) }); }} /><label className="admin-field"><span>Media</span><select value={item.assetId} onChange={event => { const asset = images.find(entry => entry.id === event.target.value); onChange({ ...block, items: block.items.map((entry, itemIndex) => itemIndex === index ? { assetId: event.target.value, alt: entry.alt || asset?.altDefault || "" } : entry) }); }}>{images.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label><label className="admin-field"><span>Alternative text</span><input value={item.alt} onChange={event => onChange({ ...block, items: block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, alt: event.target.value } : entry) })} /></label></fieldset>)}</div>
    <button type="button" className="admin-button admin-button-quiet admin-add-row" disabled={!images.length || block.items.length >= 20} onClick={() => { const asset = images.find(image => !block.items.some(item => item.assetId === image.id)) ?? images[0]; if (asset) onChange({ ...block, items: [...block.items, { assetId: asset.id, alt: asset.altDefault }] }); }}><Plus aria-hidden="true" />Add gallery image</button>
  </div>;
  if (block.type === "columns") return <ColumnsFields block={block} media={media} makeId={makeId} onChange={onChange} onError={onError} />;
  if (block.type === "video") return <div className="admin-inspector-grid">
    <label className="admin-field"><span>Video</span><select value={block.assetId} onChange={event => onChange({ ...block, assetId: event.target.value })}>{videos.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label>
    <button type="button" className="admin-button admin-button-quiet admin-upload-inline" onClick={() => videoUploadRef.current?.click()}><Upload aria-hidden="true" />Upload and replace video</button><input ref={videoUploadRef} className="admin-visually-hidden" type="file" accept="video/mp4,video/webm" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file, { blockId: block.id, field: "video" }); event.currentTarget.value = ""; }} />
    <label className="admin-field"><span>Poster image</span><select value={block.posterAssetId} onChange={event => onChange({ ...block, posterAssetId: event.target.value })}>{images.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label>
    <button type="button" className="admin-button admin-button-quiet admin-upload-inline" onClick={() => posterUploadRef.current?.click()}><Upload aria-hidden="true" />Upload and replace poster</button><input ref={posterUploadRef} className="admin-visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file, { blockId: block.id, field: "poster" }); event.currentTarget.value = ""; }} />
    <label className="admin-field"><span>Caption</span><textarea rows={3} value={block.caption ?? ""} onChange={event => onChange({ ...block, caption: event.target.value || undefined })} /></label>
    <small className="admin-field-help">Video uses controls, preload none and never autoplays.</small>
  </div>;
  if (block.type === "links") return <LinkFields block={block} onChange={onChange} />;
  if (block.type === "spacer") return <label className="admin-field"><span>Spacer size</span><select value={block.size} onChange={event => onChange({ ...block, size: event.target.value as "sm" | "md" | "lg" })}><option value="sm">Small · 16px</option><option value="md">Medium · 32px</option><option value="lg">Large · 64px</option></select></label>;
  return null;
}

function NestedCanvasPreview({ block, media }: { block: ArticleBlock; media: Map<string, AdminMediaAsset> }) {
  if (block.type === "heading") return <strong className="admin-nested-preview-heading">{block.text}</strong>;
  if (block.type === "text") return <p>{block.paragraphs.map(paragraph => paragraph.spans.map(span => span.text).join("")).join(" ")}</p>;
  if (block.type === "image") { const asset = media.get(block.assetId); return asset ? <img src={asset.contentUrl} alt={block.alt || asset.altDefault} width={asset.width ?? undefined} height={asset.height ?? undefined} loading="lazy" /> : <span>Image unavailable</span>; }
  if (block.type === "links") return <span><LinkIcon aria-hidden="true" /> {block.items.length} links</span>;
  if (block.type === "spacer") return <span>Spacer · {block.size}</span>;
  return <span>{block.type} block</span>;
}

export function AdvancedCanvasContent({ block, media }: { block: ArticleBlock; media: Map<string, AdminMediaAsset> }): ReactNode {
  if (block.type === "gallery") return <div className="admin-canvas-gallery" data-columns={block.columns}>{block.items.map((item, index) => { const asset = media.get(item.assetId); return asset ? <figure key={`${block.id}-${index}`}><img src={asset.contentUrl} alt={item.alt || asset.altDefault} width={asset.width ?? undefined} height={asset.height ?? undefined} loading="lazy" /><figcaption>{item.alt || asset.originalName}</figcaption></figure> : <div className="admin-canvas-missing" key={`${block.id}-${index}`}>Image unavailable</div>; })}</div>;
  if (block.type === "columns") return <div className="admin-canvas-columns" data-columns={block.columns.length}>{block.columns.map((column, columnIndex) => <section key={`${block.id}-column-${columnIndex}`}><small>Column {columnIndex + 1}</small>{column.length ? column.map(child => <div className="admin-nested-preview" key={child.id}><NestedCanvasPreview block={child} media={media} /></div>) : <p>Empty column</p>}</section>)}</div>;
  if (block.type === "video") { const asset = media.get(block.assetId); const poster = media.get(block.posterAssetId); return asset ? <figure><video controls preload="none" poster={poster?.contentUrl}><source src={asset.contentUrl} type={asset.mime} /></video>{block.caption && <figcaption>{block.caption}</figcaption>}</figure> : <div className="admin-canvas-missing"><VideoIcon aria-hidden="true" />Choose an available video in Block settings.</div>; }
  if (block.type === "links") return <div className="admin-canvas-links">{block.items.map((item, index) => <a key={`${block.id}-${index}`} href={item.url} onClick={event => event.preventDefault()}><ExternalLink aria-hidden="true" /><span>{item.label || "Untitled link"}</span><small>{item.url}</small></a>)}</div>;
  if (block.type === "spacer") return <div className="admin-canvas-spacer" data-size={block.size}><Space aria-hidden="true" /><span>{block.size} spacer</span></div>;
  return null;
}

export const advancedBlockButtons: Array<{ type: AdvancedBlockType; label: string; icon: ReactNode }> = [
  { type: "gallery", label: "Gallery", icon: <Images aria-hidden="true" /> },
  { type: "columns", label: "Columns", icon: <Columns3 aria-hidden="true" /> },
  { type: "video", label: "Video", icon: <VideoIcon aria-hidden="true" /> },
  { type: "links", label: "Links", icon: <LinkIcon aria-hidden="true" /> },
  { type: "spacer", label: "Spacer", icon: <Space aria-hidden="true" /> },
];
