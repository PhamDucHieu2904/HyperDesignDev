# Portfolio implementation progress

Updated: 2026-09-11

## Completed

- P0: audited the existing static React/esbuild architecture, entry points, theme tokens, real image assets, and the legacy music window.
- P1: added typed project data, category/filter selectors with Vietnamese diacritic normalization, and reducer-based category/query/project/back state.
- P2: replaced the Music/Feishin view with Portfolio across the hero action, left rail, active-window label, launcher, and application render branch. Removed the music player component, its player bar, track data, and media popout from the application flow.
- P3: implemented the selected-work overview, Hyper Design/Hyper Development grouping, category navigation, search, empty states, synchronized project index, long-form case studies, next-project action, and list-state restoration.
- P4: implemented desktop three-column chrome, tablet project strip, and mobile search/viewer/horizontal project strip/two-row category dock. Search and close stay outside the scrolling viewer; controls use 44px minimum targets in the Portfolio UI.
- Build integration: added `app/portfolio.css` to the explicit CSS build pipeline and regenerated `index.html`, `assets/app.js`, and `assets/app.css`.

## Published project data

- Vinut Coco Boba — Label System: Adobe Illustrator / packaging.
- Coco Boba — Tini World: Photoshop / campaign compositing.
- Nam Viet Group — Exhibition Booth: Blender/3D / spatial presentation.

Only supplied, repository-local assets are published. Game, Web, and App currently use honest placeholder case pages without fabricated metrics or claims, so each category can still open directly while awaiting real work.

## Verification evidence

- `npm run check`: passes with unused-local and unused-parameter checks enabled.
- `npm test`: 7/7 tests pass after a production build.
- Interactive static-file tests cover: open Portfolio, default All state, direct category-to-first-project routing, synchronized category/index selection, return to the All lobby, search filtering, Escape-to-clear search without closing, placeholder category, reset, and close.
- The same interaction suite passes for both `file://` and GitHub Pages subpath modes.
- Asset and metadata resolution tests pass; the browser bundle remains a classic static script without runtime fetch/import dependencies.

## Files added or changed for Portfolio

- `app/portfolio/types.ts`
- `app/portfolio/data.ts`
- `app/portfolio/selectors.ts`
- `app/portfolio/navigation.ts`
- `app/portfolio/PortfolioApp.tsx`
- `app/portfolio.css`
- `app/page.tsx`
- `scripts/build.mjs`
- `tests/rendered-html.test.mjs`

## Remaining visual QA

Automated DOM/build checks do not prove pixel-level layout quality. Direct browser visual inspection of this local `file://` page was previously blocked in this thread, and the master plan explicitly forbids bypassing that restriction. Final screenshot review is therefore still required at 1920×1080, 1440×900, 1024×768, 390×844, 375×667, 320×568, and 844×390 across the five themes. Any refinements from that review should stay within the component and token architecture above.

## Layout revision after screenshot review

The first implementation was rejected because it departed too far from the original music-window composition: the overview title and project cards were oversized, while the grouped navigation rhythm was lost. The revised preview intentionally returns to that original shell:

- compact horizontal featured-project banner in place of the oversized Selected Work heading;
- five-column desktop project rows with compact labels, matching the original album density;
- left navigation restored as history controls, upper Design group, isolated All control, and lower Development group;
- temporary Development cards and index rows clearly marked Coming soon so layout density can be reviewed before real project data is supplied;
- the real data model and case-study behavior remain intact for the three supplied projects.

## Direct-routing and typography revision

- `All` is now the only lobby view. Brand, Visual, 3D, Game, Web, and App open project index 01 for the selected category immediately.
- Back from every case study returns to All; entering a query also returns to the All search context.
- Game, Web, and App each have a single clearly labelled temporary case page until repository-local project data is supplied.
- Portfolio headings, case-study titles, and index counts now use Google Sans Flex with a restrained editorial scale; the sporty Designer face is no longer used inside the Portfolio window.
- Mobile navigation is a two-row six-category dock with a compact dedicated All control, preserving the Design/Development grouping without the previous oversized active block.

## Category order and desktop shortcuts

- Display labels now describe output rather than software: Illustrator data is `Brand`, Photoshop data is `Visual`, and Blender data is `3D`. Stable internal IDs remain unchanged.
- The canonical project/navigation order is `Brand → Visual → 3D → Game → Web → App`; next-project controls and visual category order now agree.
- The outer desktop rail now exposes Photoshop, Illustrator, Blender, Unity, and VS Code shortcuts that open the corresponding category's first project directly.
- Codex is present as a semantically disabled Coming soon control; App intentionally has no outer shortcut; Power remains the final rail action.
