import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareAuthoredImport, runLocalAuthoredImport } from "./lib/import-authored.mjs";

const options = {
  projectId: "vinut-corporate-uniform", assetDirectory: "uniform", label: "Vinut Corporate Uniform",
  createdAt: "2026-10-12T02:00:00.000Z", actor: "content-import:uniform-v1", isFeatured: false,
  scriptName: "scripts/import-uniform.mjs", importSource: "Supplied Vinut corporate uniform collection and original WebP assets",
};

export const prepareUniformImport = () => prepareAuthoredImport(options);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runLocalAuthoredImport(options);
