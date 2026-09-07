import { build, transform } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import site from "../site.config.mjs";
import { renderDocument } from "./html.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export async function buildSite() {
  // Inline the compositing matte so CSS masking also works when opened via file://.
  const options = { absWorkingDir: projectRoot, bundle: true, write: false, jsx: "automatic", loader: { ".png": "dataurl" } };
  const [browser, page, css] = await Promise.all([
    build({
      ...options, entryPoints: ["app/main.tsx"], platform: "browser",
      // A classic script works from file://; ES modules require an HTTP origin.
      format: "iife", target: "es2020", minify: true, legalComments: "inline",
      define: { "process.env.NODE_ENV": '"production"' },
    }),
    build({
      ...options, entryPoints: ["app/page.tsx"], platform: "node",
      format: "cjs", packages: "external",
    }),
    Promise.all(["globals.css", "layouts.css", "portfolio-scenes.css"].map(name => readFile(new URL(`../app/${name}`, import.meta.url), "utf8")))
      .then((sources) => transform(sources.join("\n"), { loader: "css", minify: true, target: "es2020" })),
  ]);

  // Execute only our compiled source, at build time, to put real HTML in index.html.
  // None of this renderer or Node code is shipped to visitors.
  const pageModule = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", page.outputFiles[0].text)(require, pageModule, pageModule.exports);
  const markup = renderToString(createElement(pageModule.exports.default));
  const html = renderDocument(markup, site);

  await mkdir(new URL("../assets/", import.meta.url), { recursive: true });
  await Promise.all([
    writeFile(new URL("../assets/app.js", import.meta.url), browser.outputFiles[0].contents),
    writeFile(new URL("../assets/app.css", import.meta.url), css.code),
  ]);
  await writeFile(new URL("../index.html", import.meta.url), html);
  console.log("Built index.html + assets/. Open index.html or Mo-Website.bat; no server needed.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await buildSite();
}
