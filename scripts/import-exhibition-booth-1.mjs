import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareAuthoredImport, runLocalAuthoredImport } from "./lib/import-authored.mjs";

const options = {
  projectId: "exhibition-booth-1", assetDirectory: "exhibition-booth-1", label: "Exhibition Booth 1",
  createdAt: "2026-10-14T00:00:00.000Z", actor: "content-import:exhibition-booth-1-v1", isFeatured: false,
  scriptName: "scripts/import-exhibition-booth-1.mjs", importSource: "Supplied THAIFEX 2025 Exhibition Booth 1 artboards and original WebP assets",
  requestId: "exhibition-booth-1-template-v1",
  retireProjectIds: ["vinut-coco-boba-label", "coco-boba-tini-world", "nam-viet-exhibition"],
};

export const prepareExhibitionBooth1Import = () => prepareAuthoredImport(options);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runLocalAuthoredImport(options);
