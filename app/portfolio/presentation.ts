import type { ArticleDocument } from "../../shared/contracts";

// These authored collections already include their introduction in the artwork.
export function isArtboardDocument(document?: ArticleDocument) {
  return document?.blocks.some(block => block.id === "quencha-title" || block.id === "uniform-page-1") ?? false;
}
