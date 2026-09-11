import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "./build.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(projectRoot, "dist", "public");
if (!destination.startsWith(resolve(projectRoot, "dist") + "\\")) throw new Error("Refusing to clean an unsafe cloud build path.");

await buildSite();
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all([
  cp(join(projectRoot, "index.html"), join(destination, "index.html")),
  cp(join(projectRoot, "assets"), join(destination, "assets"), { recursive: true }),
  cp(join(projectRoot, "public"), join(destination, "public"), { recursive: true }),
]);
await writeFile(join(destination, "_headers"), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
`);
console.log("Built allowlisted Cloudflare public assets in dist/public.");
