// Optional development convenience. Opening index.html does not use this server.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".pdf": "application/pdf",
};

export function createPreviewServer(root = projectRoot) {
  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const name = pathname === "/" ? "index.html" : pathname.slice(1);
      // Serve only the public deliverable, never .git, source, config or dependencies.
      if (name !== "index.html" && !/^(assets|public)\//.test(name)) throw new Error("Not public");
      if (name.split(/[\\/]/).some((part) => part.startsWith("."))) throw new Error("Not public");
      const target = resolve(root, name);
      if (!target.startsWith(resolve(root) + sep)) throw new Error("Not public");
      const info = await stat(target);
      if (!info.isFile()) throw new Error("Not a file");
      const contents = await readFile(target);
      response.writeHead(200, {
        "Content-Type": mime[extname(target)] ?? "application/octet-stream",
        "Content-Length": contents.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--build")) {
    const { buildSite } = await import("./build.mjs");
    await buildSite();
  }
  const port = Number(process.env.PORT || 3000);
  const server = createPreviewServer();
  server.on("error", (error) => {
    console.error(`Cannot start optional preview: ${error.message}. You can still open index.html directly.`);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Static preview: http://127.0.0.1:${server.address().port}`);
    console.log("Refresh the browser after editing. Ctrl+C stops this optional preview.");
  });
}
