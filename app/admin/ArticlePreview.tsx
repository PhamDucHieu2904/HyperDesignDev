import type { CSSProperties, ReactNode } from "react";
import type { AdminMediaAsset, ArticleBlock, ArticleDocument, RichSpan } from "../../shared/contracts";
import { isArtboardDocument } from "../portfolio/presentation";

type PreviewStyle = CSSProperties & { "--admin-preview-accent"?: string };

function renderSpan(span: RichSpan, index: number): ReactNode {
  let content: ReactNode = span.text;
  if (span.bold) content = <strong>{content}</strong>;
  if (span.italic) content = <em>{content}</em>;
  if (span.href) content = <a href={span.href} target="_blank" rel="noreferrer">{content}</a>;
  return <span key={index}>{content}</span>;
}

function blockProps(block: ArticleBlock) {
  const configured = "style" in block ? block.style : undefined;
  const style: PreviewStyle | undefined = configured?.accentColor
    ? { "--admin-preview-accent": configured.accentColor }
    : undefined;
  return {
    "data-block-id": block.id,
    className: ["admin-preview-block", `is-${block.type}`, `width-${configured?.width ?? "reading"}`,
      `background-${configured?.background ?? "transparent"}`, `padding-${configured?.padding ?? "none"}`].join(" "),
    style,
  };
}

function PreviewBlock({ block, media }: { block: ArticleBlock; media: Map<string, AdminMediaAsset> }) {
  const props = blockProps(block);
  if (block.type === "text") return <div {...props}>{block.paragraphs.map((paragraph, index) =>
    <p key={index}>{paragraph.spans.map(renderSpan)}</p>)}</div>;
  if (block.type === "heading") {
    const Heading = block.level === 2 ? "h2" : "h3";
    return <Heading {...props}>{block.text || "Untitled heading"}</Heading>;
  }
  if (block.type === "image") {
    const asset = media.get(block.assetId);
    return <figure {...props}>{asset
      ? <img src={asset.contentUrl} alt={block.alt || asset.altDefault} width={asset.width ?? undefined} height={asset.height ?? undefined} loading="lazy" style={{ objectFit: block.fit }} />
      : <div className="admin-preview-missing">Image unavailable</div>}
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>;
  }
  if (block.type === "gallery") return <div {...props} data-columns={block.columns}>{block.items.map((item, index) => {
    const asset = media.get(item.assetId);
    return asset ? <figure key={`${item.assetId}-${index}`}><img src={asset.contentUrl} alt={item.alt || asset.altDefault} width={asset.width ?? undefined} height={asset.height ?? undefined} loading="lazy" /></figure>
      : <div key={`${item.assetId}-${index}`} className="admin-preview-missing">Image unavailable</div>;
  })}</div>;
  if (block.type === "columns") return <div {...props}>{block.columns.map((column, index) =>
    <div className="admin-preview-column" key={index}>{column.map(child => <PreviewBlock key={child.id} block={child} media={media} />)}</div>)}</div>;
  if (block.type === "video") {
    const asset = media.get(block.assetId);
    const poster = media.get(block.posterAssetId);
    return <figure {...props}>{asset
      ? <video controls preload="none" poster={poster?.contentUrl}><source src={asset.contentUrl} type={asset.mime} /></video>
      : <div className="admin-preview-missing">Video unavailable</div>}
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>;
  }
  if (block.type === "links") return <nav {...props} aria-label="Project links">{block.items.map((item, index) =>
    <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer">{item.label}</a>)}</nav>;
  return <div {...props} data-size={block.size} aria-hidden="true" />;
}

export function ArticlePreview({ document, media }: { document: ArticleDocument; media: AdminMediaAsset[] }) {
  const mediaById = new Map(media.map(asset => [asset.id, asset]));
  if (!document.blocks.length) return <section className="admin-preview-empty">
    <small>Portfolio story</small><h2>Content is being prepared.</h2><p>Add a heading, text or image block to begin this project story.</p>
  </section>;
  return <div className={`admin-preview-article${isArtboardDocument(document) ? " portfolio-artboard" : ""}`}>{document.blocks.map(block =>
    <PreviewBlock key={block.id} block={block} media={mediaById} />)}</div>;
}
