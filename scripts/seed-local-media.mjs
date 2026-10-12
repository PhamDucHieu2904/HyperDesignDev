import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const wrangler = resolve(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const bucket = "hyperd-media-staging";
const fixtures = [
  ["coco-boba-poster.webp", "seed/original/coco-boba-poster.webp", "image/webp"],
  ["nam-viet-group-booth.webp", "seed/original/nam-viet-group-booth.webp", "image/webp"],
  ["portfolio-placeholder.svg", "seed/original/portfolio-placeholder.svg", "image/svg+xml"],
  ["vinut-coco-boba-label.webp", "seed/original/vinut-coco-boba-label.webp", "image/webp"],
];

for (const [fileName, objectKey, contentType] of fixtures) {
  const filePath = resolve(projectRoot, "public", fileName);
  await access(filePath);
  const args = [
    wrangler, "r2", "object", "put", `${bucket}/${objectKey}`,
    "--local", "--persist-to", ".wrangler/admin/state", "--config", "workers/admin/wrangler.jsonc",
    "--file", filePath, "--content-type", contentType, "--cache-control", "private, no-store", "--force",
  ];
  const result = await execFileAsync(process.execPath, args, { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 });
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}

console.log(`Seeded ${fixtures.length} local R2 media fixture(s).`);
