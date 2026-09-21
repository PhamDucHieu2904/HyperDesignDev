# Blueprint robot cat

Source snapshot: `D:/3D model/Robot Cat/web-cat`, 2026-09-18.
The approved GLB, ten face PNGs and behaviors manifest are kept in `source/`.
`director.mjs` is copied unchanged from the source project. Do not run Blender
generators or decimate the model when updating this integration.

`RobotCat.tsx` loads `assets/robot-cat.js` only when Blueprint is shown.
`runtime.mjs` adapts the original renderer to a disposable instance. The build
embeds the compressed model and emoji assets into this separate classic script
so both direct index.html and hosted subpaths work without cross-origin fetches.
Run `npm run build` after replacing source assets. No external hosting is needed.

Interactions: region-based touch, 550 ms head hold and an 8 px drag threshold.
An invisible point moves around a 34-second circle and the cat follows that heading
continuously. The user can drag horizontally on the single Y-axis orbit; the drag
sets the current orbit phase and autoplay continues from that exact phase. There is
no return-to-home easing. Enter greets and
Space pauses on the focused canvas. Original autoplay and expression cues are
preserved. Reduced motion starts paused and disables the guide rotation.
Changing theme or leaving Desktop disposes the instance; hidden tabs skip updates.

The fallback is the upstream preview (may contain the older expression artwork).
The live model always uses the ten current user-drawn PNGs. No visible controls
or captions are added. Model/LED materials and morph tracks retain their source
values; lighting is adapted from the source demo. DPR is capped at 1.5.

2026-09-18: `Than` is attached to `CTRL_body` in both source Blender files,
preserving its world transform. `scripts/update-cat-model.py` exports evaluated
geometry from the current source and samples the existing 12 Actions; it does
not regenerate animations or emoji artwork. Timestamped Blender/GLB backups
are in the source folder. The updated mesh has 406,814 triangles, without
decimation; the compressed GLB is 1,686,312 bytes.

Source LED colors are sky cyan with HDR strengths 5 and 2. On the website,
body LEDs bypass ACES with display-referred cyan and intensity 1 so the highlights
retain their hue rather than clipping to white. This is self-emission, not a
full-screen bloom effect. Shell lighting is reduced to preserve surface detail.
The stage has a brighter ice-blue spotlight and a soft grounding ellipse.

Validation: GLB and portable GLB have zero validator errors/warnings. Desktop
browser screenshot confirms the new body, cyan headset/tail LEDs and spotlight.
DOM tests stub WebGL because jsdom has no GPU. Mobile GPU performance and visual
verification of every clip still require device checks.
