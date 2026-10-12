# Hyper D public Cloudflare Worker

This repository contains the Hyper D static shell, public read API, published media routes and the authenticated admin app/Worker. The two Workers build and deploy independently. Admin instructions are in [admin/README.md](admin/README.md).

## Build and local verification

```powershell
npm run build:cloud
npm run check
npm run test:workers
npm run cf:local:migrate
npm run cf:local:seed
npm run cf:dev:public
```

The Public Worker uses `.wrangler/state` for local persistence and the `hyperd-content-staging` D1 plus `hyperd-media-staging` R2 bindings configured in `workers/public/wrangler.jsonc`.

The Admin Worker uses `.wrangler/admin/state` locally and port 8788. Its separate local storage preserves the previous standalone admin data without replacing the public local database. Both deployed staging Workers still bind to the same D1 and R2 resources. There is one shared migration directory at `db/migrations/`.

Remote migration and smoke verification remain explicit:

```powershell
npm run cf:staging:migrate
npm run cf:smoke
```

The public API exposes categories, published project summaries/details/adjacent projects and reference-gated published media. Draft content, draft media and historical-only assets are not public.
