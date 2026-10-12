import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareAuthoredImport, runLocalAuthoredImport } from "./lib/import-authored.mjs";

const options = {
  projectId: "quencha-beverage", assetDirectory: "quencha", label: "Quencha",
  createdAt: "2026-10-12T00:00:00.000Z", actor: "content-import:quencha-v1", isFeatured: true,
  scriptName: "scripts/import-quencha.mjs", importSource: "Supplied Quencha template and original WebP assets",
  requestId: "quencha-template-v1",
};

export const prepareQuenchaImport = () => prepareAuthoredImport(options);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runLocalAuthoredImport(options);
