# Hyper D public Cloudflare Worker

The public project owns the Hyper D static shell, public read API and published media routes. The standalone admin project lives in `D:/program project/AdministratorHyperDesignDev`.

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

Remote migration and smoke verification remain explicit:

```powershell
npm run cf:staging:migrate
npm run cf:smoke
```

The public API exposes categories, published project summaries/details/adjacent projects and reference-gated published media. Draft content, draft media and historical-only assets are not public.
