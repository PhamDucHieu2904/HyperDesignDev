# Traffic, feature analytics and Create protection

Implemented end to end with public Worker intake, D1 persistence and authenticated
admin reporting. Nothing in this change deploys remotely or sends real mail.

## Local use

1. Run `npm run build:all`.
2. Apply `npm run cf:local:migrate:admin` (`Mo-Admin.bat` also does this).
3. Copy `workers/public/.dev.vars.example` to `workers/public/.dev.vars` on a new machine.
4. Start admin with `Mo-Admin.bat` (8788).
5. Run `npm run cf:dev:public:shared` and open `http://127.0.0.1:8789`.
6. In admin select **Analytics** for visits and interactions, or **Orders** for Create
   requests and mail status. Select Day/Month/Quarter/Year and a date in the period.

The shared public preview uses `.wrangler/admin/state` so its public events and
Create intake are visible in local admin. The original `.wrangler/state` preview
remains separate and is not overwritten. Local requests skip Turnstile and never
send real email. No fake traffic is seeded into either database. Browser testing
does create genuine local test events; these are local data, not production visits.
`file://` and GitHub Pages without an API retain the profile, but have no server
traffic metrics and cannot enforce server quotas. The form stays unavailable until
the Worker config responds with `enabled: true`.

## Connect Cloudflare later

- Deploy the public and admin Workers using their existing D1/R2 bindings to the
  same database. Apply migration `0002_analytics_requests.sql` remotely as a
  separate deployment step. Existing portfolio tables are not modified.
- Public `assets.run_worker_first` sends documents and APIs through the Worker;
  image, font and JS/CSS paths retain direct static asset delivery. Document
  requests are counted once at the Worker, not once per image/API download.
- Enable `ANALYTICS_ENABLED=true`. Store a random secret of at least 32 characters
  as `ANALYTICS_HASH_SECRET` with `wrangler secret put --config workers/public/wrangler.jsonc`.
  This HMAC key protects quota identifiers; no raw IP is stored. Keep it stable:
  changing it midway through a day resets the identifiers used for quotas.
- Create a Turnstile widget for the public hostname. Add public `TURNSTILE_SITE_KEY`
  and comma-separated `TURNSTILE_HOSTNAMES`; store `TURNSTILE_SECRET_KEY` as a
  Worker secret. Set `REQUESTS_ENABLED=true`. Outside `DEPLOY_ENV=local`, intake
  fails closed without complete configuration. Siteverify must succeed for action
  `create` and an allowed hostname. The browser loads the key through the config
  endpoint, renders the widget and passes its single-use token to the server.
- Keep admin protected by the existing Cloudflare Access/owner authentication.
  Analytics/history and full Create descriptions are private, no-store endpoints.
- Optional cross-origin frontend: set the public CORS allowlist and the public
  `app/project-launcher/config.ts` endpoint to the HTTPS Worker URL ending in
  `/api/v1/project-requests`; rebuild. Analytics currently uses the same-origin
  `/api/v1/events` route. Prefer hosting the profile on the public Worker.

## Connect notification email

An accepted Create request is saved before notification. Set secret `RESEND_API_KEY`,
and variables `REQUEST_EMAIL_FROM` (verified sender), `REQUEST_EMAIL_TO` (owner inbox),
`REQUEST_EMAIL_ENABLED=true`. Add a Cloudflare cron trigger, for example every
five minutes (`*/5 * * * *`), to the public Worker configuration when deploying.
It runs the notification adapter and history cleanup. No trigger is enabled by
this change. API keys remain in Worker secrets, never the browser or repository.

The adapter claims one database lease per message and uses a stable provider
Idempotency-Key. It retries stalled deliveries with the same key and stops after
five attempts / outside the safe 23-hour retry window. Failed/ambiguous rows remain
in admin for review; automatic resends outside that window are deliberately
avoided. A provider-accepted email does not guarantee inbox delivery.

## Measurement definitions and limits

- **Visits** = document requests reaching the public Worker, including scan paths.
  Image/API downloads and feature events are separate. No unique-person claim.
- **Verified bot** comes only from trusted `request.cf.botManagement.verifiedBot`.
  A bot-like User-Agent never becomes “verified”. **Suspected bot** includes known
  crawler/headless/scanner agents, scan paths or Cloudflare score <30.
  **Likely human** uses score >=30 when available, otherwise a browser User-Agent
  heuristic. **Unclassified** has insufficient signals. Spoofed browser User-Agents
  can be misclassified; this is an estimate, not a guaranteed identity.
  Local preview ignores Wrangler's synthetic bot metadata and uses heuristics.
- Cloudflare Bot Management score availability depends on the account/product.
  Lack of score does not silently produce a fake score. Requests blocked by WAF
  before the Worker are not in this app; use Cloudflare Security Analytics or a
  future authenticated import adapter for that dataset. WAF/rate limiting should
  protect `/api/v1/events` and `/api/v1/project-requests` at the edge as well.
- **Feature usage** counts explicit clicks/form actions, excludes auto carousel
  advances. The interactive-load event is sent on the first user click, not a
  unique visitor ID. Do Not Track is respected. No search term, email, form body,
  persistent cookie or fingerprint enters feature analytics. Client events can
  be forged or blocked; use them for product trends, not proof of human identity.
- Server decides timestamp and classification; client cannot submit a bot score.
  Allowlisted event names, bounded batch/body sizes, UUID deduplication and intake
  rate caps reduce replay and storage abuse. Extreme floods rejected before body
  parsing are not individually logged; this prevents attackers from flooding the
  history tables. Such events need edge/WAF monitoring.
- Daily accepted Create limits: 10/canonical email, 30/source, 100/site. Gmail
  dots/plus aliases are normalized for quota purposes. Email is not ownership
  verification; IP is HMAC-hashed and rotated daily. Shared networks can share a
  source quota. No user-controlled recipient address is used for notification.
- Attempt limits: 15/source/minute, 200/site/minute. Feature ingest: 60 batches/
  source/minute and 1,000/site/minute. Limits are atomic D1 writes, not browser state.
- UTC+7 calendar boundaries apply consistently to quotas and reports, including
  leap months, quarter/year transitions. Daily aggregates stay available after
  raw retention: traffic 90 days, Create details/attempts 365 days. Cleanup runs
  only when the scheduled trigger is configured. Admin history defaults to 10 rows/page,
  supports 20 rows, and has Previous/Next/Latest controls. The API accepts a bounded
  `limit` from 1 to 50 (default 50 for existing clients) and returns history counts.

## Validation

`npm run test:analytics` tests concurrent quotas, retry deduplication, aliases,
honeypots, origin enforcement, disabled production configuration, Turnstile
hostname/action, bot classification, event validation, private reports and mail
adapter leases/idempotency with a fake transport. It sends no real mail.

Primary references:
- https://developers.cloudflare.com/bots/reference/bot-management-variables/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
