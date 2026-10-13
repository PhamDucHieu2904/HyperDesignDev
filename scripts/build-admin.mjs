import { build, transform } from "esbuild";
import { copyFile, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(projectRoot, "dist", "admin");
if (!destination.startsWith(resolve(projectRoot, "dist") + sep)) throw new Error("Refusing to clean an unsafe admin build path.");

// Workerd can hold the output directory open on Windows. Clear its generated
// files without removing watched directories, so a running preview can rebuild.
async function clearGeneratedFiles(directory) {
  if (directory !== destination && !directory.startsWith(destination + sep)) throw new Error("Unsafe admin cleanup path.");
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await clearGeneratedFiles(path);
    else await rm(path, { force: true });
  }
}
await clearGeneratedFiles(destination);
await mkdir(destination, { recursive: true });
await mkdir(resolve(destination, "public"), { recursive: true });
const browser = await build({
  absWorkingDir: projectRoot,
  entryPoints: ["app/admin/main.tsx"],
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  target: "es2020",
  minify: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const styles = await Promise.all(["../app/admin/admin.css", "../app/admin/analytics.css", "../app/portfolio/quencha.css", "../app/admin/workspace.css"].map(path => readFile(new URL(path, import.meta.url), "utf8")));
const css = await transform(styles.join("\n"), {
  loader: "css", minify: true, target: "es2020",
});
await Promise.all([
  copyFile(resolve(projectRoot, "public", "GoogleSansFlex.ttf"), resolve(destination, "public", "GoogleSansFlex.ttf")),
  writeFile(resolve(destination, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hyper D Admin</title><link rel="stylesheet" href="/admin.css"></head>
<body><div id="root"><main class="admin-loading"><span>Loading Hyper D Admin…</span></main></div><script src="/admin.js" defer></script></body></html>`),
  writeFile(resolve(destination, "admin.css"), css.code),
  writeFile(resolve(destination, "admin.js"), browser.outputFiles[0].contents),
  writeFile(resolve(destination, "_headers"), `/*
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
`),
]);
console.log("Built Hyper D Admin assets in dist/admin.");
