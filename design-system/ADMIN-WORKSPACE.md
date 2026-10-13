# Hyper D Admin workspace

Updated 2026-10-13. Reference: the NexusFlow dashboard supplied in “Đánh giá tách project admin”.

The reference leads visual choices: soft grey cards, black pill navigation and a lime
accent. The user requested a full-screen workspace: no outer black grid, page margin,
rounded outer frame or maximum app width. Use the existing Google Sans Flex
font and Lucide icons. The UI/UX skill's verified Flat Design recommendation supports
simple shapes, fast hover feedback and readable contrast; its default blue palette is
overridden by the user's reference.

## Pages

| Page | Purpose |
| --- | --- |
| Home | Real library counts, mutually exclusive publication states, latest edited projects, selectable update calendar and monthly request/mail totals. |
| Library | Existing project cards/table, filters, metadata and article editor. |
| Analytics | Audience metrics, traffic chart, interaction ranking and bounded event history. |
| Orders | Intake statistics, accepted/blocked history, private request detail and notification status. |

All pages share `AdminShell`. Hash links support direct navigation and browser history.
Header navigation checks for unsaved article or metadata changes before leaving.
No placeholder revenue, fake chart values or unused navigation items.

## Tokens and layout

`app/admin/admin.css` defines semantic tokens. `app/admin/workspace.css` supplies the
reference shell and page layouts after base editor/analytics styles.

- Background: `#d5d5d3`; cards: `#f1f1ef`; main text: `#151712`.
- Muted text: `#54584f`; subtle text: `#606459`; lime surface: `#b1ff5c`.
- Green text/focus: `#36580f`; use dark ink on lime buttons.
- Shared navigation: black selected pill with visible page labels.
- Desktop Home uses three columns and a slim shortcut rail; below 1100px use two
  columns, below 580px use one. The shortcut rail is fixed at the vertical center of
  the viewport during scrolling. Header navigation stays visible on phones.
- Data tables scroll inside their own containers, not the whole page.
- History defaults to 10 rows, supports 20, and fetches bounded cursor pages.
  Separate traffic/request cursor stacks support Previous, Next and Latest.
- Loading, error, empty and retry states are visible; repeated current-period selection
  must not leave the report loading. Disable pagination during fetches.

## Validation

`npm run test:admin-ui` builds admin and runs production-bundle DOM interaction tests.
`npm test` includes these tests alongside the API and deployment-isolation checks.
Browser verification covers Home, Library, Analytics and Orders on desktop and 375px,
traffic page navigation, real request detail and preservation of portfolio content.

The public portfolio renderer, database schema and deployment isolation remain unchanged
by this admin interface refactor. Online deployment and enabling email delivery require
the existing configuration steps in `workers/analytics/README.md`.
