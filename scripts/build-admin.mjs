import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(projectRoot, "dist", "admin");
if (!destination.startsWith(resolve(projectRoot, "dist") + "\\")) throw new Error("Refusing to clean an unsafe admin build path.");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all([
  writeFile(resolve(destination, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hyper D Admin</title><link rel="stylesheet" href="/admin.css"></head>
<body><main><p>Hyper D</p><h1>Admin infrastructure ready</h1><p>The data manager and portfolio editor will be implemented in ADM-01 and ADM-02.</p></main></body></html>`),
  writeFile(resolve(destination, "admin.css"), `:root{font-family:system-ui,sans-serif;color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#171b1c;color:#f8f2e8}main{max-width:42rem;padding:3rem;border:1px solid #4b5152;border-radius:1.5rem;background:#222728}p{line-height:1.6;color:#c9c3b9}h1{font-size:clamp(2rem,6vw,4rem);margin:.25rem 0}`),
  writeFile(resolve(destination, "_headers"), `/*
  Cache-Control: no-store
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
`),
]);
console.log("Built locked admin placeholder assets in dist/admin.");
