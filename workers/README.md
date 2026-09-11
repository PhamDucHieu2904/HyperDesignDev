# Hyper D Cloudflare Workers

The repository has two separate Workers that share one D1 database and one private R2 bucket per environment.

- `public`: Hyper D static assets, public read API and published media routes.
- `admin`: future admin static assets and write API. CF-01 keeps it fail-closed until API-01 adds complete Cloudflare Access JWT verification.

## Build and local verification

```powershell
npm run build:cloud
npm run build:admin
npm run check
npm run test:workers
npm run cf:local:migrate
npm run cf:local:seed
```

Both local Workers use `.wrangler/state` as their shared persistence root. To view the temporary admin infrastructure page locally, copy `workers/admin/.dev.vars.example` to `workers/admin/.dev.vars`. `LOCAL_ADMIN_BYPASS` is accepted only when `DEPLOY_ENV=local`; never configure it as a deployed variable.

Run the Workers separately:

```powershell
npm run cf:dev:public
npm run cf:dev:admin
```

## Staging resources

- D1 name: `hyperd-content-staging`
- D1 region: APAC
- D1 ID is stored in both Wrangler configs.
- R2 name: `hyperd-media-staging`
- Public URL: `https://hyperd-public-staging.hieu-caelestia-portfolio.workers.dev`
- Admin URL: `https://hyperd-admin-staging.hieu-caelestia-portfolio.workers.dev` (intentionally returns 503 except for the health endpoint until API-01).

Remote migration is explicit:

```powershell
npm run cf:staging:migrate
npm run cf:smoke
```

Do not seed the remote database until the matching files have been uploaded to R2. Do not deploy the Admin Worker until API-01 authentication and Cloudflare Access are configured. Production will use separate configs and separate D1/R2 resources.
