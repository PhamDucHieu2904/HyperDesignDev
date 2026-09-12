import type { CSSProperties, ReactNode } from "react";
import type { ArticleBlock, ArticleDocument, MediaDescriptor, RichSpan } from "../../shared/contracts";

type ArticleStyle = CSSProperties & { "--pf-block-accent"?: string };

function richSpan(span: RichSpan, key: number): ReactNode {
  let content: ReactNode = span.text;
  if (span.bold) content = <strong>{content}</strong>;
  if (span.italic) content = <em>{content}</em>;
  if (span.href) content = <a href={span.href} target="_blank" rel="noreferrer">{content}</a>;
  return <span key={key}>{content}</span>;
}

function blockProps(block: ArticleBlock) {
  const blockStyle = "style" in block ? block.style : undefined;
  const style: ArticleStyle | undefined = blockStyle?.accentColor
    ? { "--pf-block-accent": blockStyle.accentColor }
    : undefined;
  return {
    className: ["pf-article-block", `pf-block-${block.type}`, `pf-block-width-${blockStyle?.width ?? "reading"}`,
      `pf-block-bg-${blockStyle?.background ?? "transparent"}`, `pf-block-pad-${blockStyle?.padding ?? "none"}`].join(" "),
    style,
  };
}

function ArticleBlockView({ block, media }: { block: ArticleBlock; media: Map<string, MediaDescriptor> }) {
  const props = blockProps(block);
  if (block.type === "text") return <div {...props}>{block.paragraphs.map((paragraph, index) =>
    <p key={index}>{paragraph.spans.map(richSpan)}</p>)}</div>;
  if (block.type === "heading") {
    const Heading = block.level === 2 ? "h2" : "h3";
    return <Heading {...props}>{block.text}</Heading>;
  }
  if (block.type === "image") {
    const asset = media.get(block.assetId);
    return <figure {...props}>{asset
      ? <img src={asset.url} alt={block.alt || asset.alt} width={asset.width} height={asset.height} loading="lazy" style={{ objectFit: block.fit }} />
      : <div className="pf-article-missing">Image unavailable</div>}
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>;
  }
  if (block.type === "gallery") return <div {...props} data-columns={block.columns}>{block.items.map((item, index) => {
    const asset = media.get(item.assetId);
    return asset
      ? <figure key={`${item.assetId}-${index}`}><img src={asset.url} alt={item.alt || asset.alt} width={asset.width} height={asset.height} loading="lazy" /></figure>
      : <div key={`${item.assetId}-${index}`} className="pf-article-missing">Image unavailable</div>;
  })}</div>;
  if (block.type === "columns") return <div {...props}>{block.columns.map((column, index) =>
    <div className="pf-article-column" key={index}>{column.map(child => <ArticleBlockView key={child.id} block={child} media={media} />)}</div>)}</div>;
  if (block.type === "video") {
    const asset = media.get(block.assetId);
    const poster = media.get(block.posterAssetId);
    return <figure {...props}>{asset
      ? <video controls preload="metadata" poster={poster?.url}><source src={asset.url} type={asset.mime} /></video>
      : <div className="pf-article-missing">Video unavailable</div>}
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>;
  }
  if (block.type === "links") return <nav {...props} aria-label="Project links">{block.items.map(item =>
    <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.label}</a>)}</nav>;
  return <div {...props} data-size={block.size} aria-hidden="true" />;
}

export function ArticleRenderer({ document, media }: { document: ArticleDocument; media: MediaDescriptor[] }) {
  const mediaById = new Map(media.map(asset => [asset.id, asset]));
  if (!document.blocks.length) return <section className="pf-article-empty" aria-live="polite">
    <small>Portfolio story</small><h2>Content is being prepared.</h2>
    <p>This project is published, but its detailed presentation has not been added yet.</p>
  </section>;
  return <div className="pf-article">{document.blocks.map(block =>
    <ArticleBlockView key={block.id} block={block} media={mediaById} />)}</div>;
}
