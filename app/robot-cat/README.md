# Blueprint robot cat

Source snapshot: `D:/3D model/Robot Cat/web-cat`, 2026-09-17.
The approved GLB, ten face PNGs and behaviors manifest are kept in `source/`.
`director.mjs` is copied unchanged from the source project. Do not run Blender
generators or decimate the model when updating this integration.

`RobotCat.tsx` loads `assets/robot-cat.js` only when Blueprint is shown.
`runtime.mjs` adapts the original renderer to a disposable instance. The build
embeds the compressed model and emoji assets into this separate classic script
so both direct index.html and hosted subpaths work without cross-origin fetches.
Run `npm run build` after replacing source assets. No external hosting is needed.

Interactions: region-based touch, 550 ms head hold, 8 px drag threshold, orbit
without zoom/pan; Enter greets and Space pauses on the focused canvas. Original
autoplay and expression cues are preserved. Reduced motion starts paused.
Changing theme or leaving Desktop disposes the instance; hidden tabs skip updates.

The fallback is the upstream preview (may contain the older expression artwork).
The live model always uses the ten current user-drawn PNGs. No visible controls
or captions are added. Model/LED materials and morph tracks retain their source
values; lighting is adapted from the source demo. DPR is capped at 1.5.

Validation limitation: DOM tests stub WebGL because jsdom has no GPU. In-app
browser loaded the Blueprint canvas, but screenshot review was unavailable due
to automatic approval service capacity. Mobile GPU performance and visual
verification of every clip still require browser/device checks.
