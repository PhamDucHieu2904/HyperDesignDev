import assert from "node:assert/strict";
import { build } from "esbuild";
import test from "node:test";

const compiled = await build({ entryPoints: ["app/desktop/viewport.ts"], bundle: true, write: false, platform: "node", format: "cjs" });
const module = { exports: {} };
new Function("module", "exports", compiled.outputFiles[0].text)(module, module.exports);
const { desktopViewport } = module.exports;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("PC canvas fits small windows with one scale for both axes and keeps desktop dimensions", () => {
  for (const [width, height, scale] of [[1920, 1000, 1], [1140, 590, .59], [1366, 648, .648], [800, 450, 800 / 1920], [2560, 1440, 1]]) {
    const viewport = desktopViewport(width, height, true);
    assert.equal(viewport.desktop, true);
    close(viewport.scale, scale);
    close(viewport.width * viewport.scale, width);
    close(viewport.height * viewport.scale, height);
    assert.ok(viewport.width >= 1920 && viewport.height >= 1000);
  }
});

test("phone and compact touch layouts keep their readable responsive size", () => {
  for (const [width, height] of [[320, 568], [390, 844], [800, 450]]) {
    assert.deepEqual(desktopViewport(width, height), { desktop: false, scale: 1, width, height });
  }
  assert.equal(desktopViewport(800, 450, true).desktop, true, "Narrow PC windows should keep PC layout");
});
