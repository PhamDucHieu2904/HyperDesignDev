# Hyper D² layout collection

Paper is the default. The sidebar offers Graphite, Blueprint, Sage, Gallery, and Paper. Each preset themes the hero, rail, buttons, dashboard, launcher, media player, files and terminal chrome. Album covers keep their original artwork colors.

Theme tokens and scoped responsive composition live in `app/layouts.css`; definitions and local preference persistence live in `app/page.tsx`. `hyperd-layout` stores the selected numeric ID. Missing, invalid or unavailable storage falls back to Paper without blocking the UI.

- Paper: original portrait, parchment, terracotta, original composition.
- Graphite: monochrome portrait, charcoal, copper, inset frame.
- Blueprint: separate 3D android portrait, solid cobalt and subtle technical grid, rounded frame.
- Sage: solid matcha, three rounded design concept cards (label, Photoshop composite, video/exhibition).
- Gallery: crimson sidebar, rounded black canvas, red-lit android and floating app/web/game/AI code illustrations.

Current assets, generation prompts and the offline compositing strategy are documented in `portfolio-scene-revision.md`. The original Sage studio asset below is retained only as a previous iteration and is no longer displayed.

UI/UX Pro Max informed semantic theme tokens, stable hit areas, keyboard/pressed states, accessible dark palettes and reduced motion. Desktop hover/focus reveals the preset name; selected icons remain visible on touch devices.

## Generated asset provenance

Asset: `public/sage-studio.png`. Generated with the built-in image generation tool; original retained in Codex generated images.

Prompt:

Use case: stylized-concept. Asset type: full-bleed background wallpaper for a designer/developer portfolio, wide 16:9 1920x1080 composition. Create a refined photorealistic 3D still-life: a sculptural looping ribbon of pale sage ceramic and a single dark green ginkgo branch on a honed limestone plinth, all positioned in the RIGHT third of the frame. Architectural studio in muted sage green, soft natural side light, fine paper-like stone texture, calm sophisticated art direction. The entire LEFT 60% is clean pale sage plaster negative space, low contrast, for overlaid dark logo and website text. Keep the lower-left and upper-left completely clear. Object sculptural and elegant, realistically rendered premium materials, restrained shadows. NO text, NO letters, NO logo, NO watermark, NO UI, NO border, NO collage, NO people. Not a flat vector illustration.
