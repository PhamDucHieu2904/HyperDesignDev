import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node22' });
  const module = { exports: {} }; new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports); return module.exports;
}
const { publicWorker } = await load('workers/public/src/index.ts');
const { adminWorker } = await load('workers/admin/src/index.ts');
const { reportingDay, reportingRange } = await load('shared/contracts/analytics.ts');
const { classifyTraffic, privateHash } = await load('workers/public/src/telemetry.ts');
const { submitRequest, deliverNotifications } = await load('workers/public/src/requests.ts');
const { startAnalytics } = await load('app/analytics.ts');
const schema = await readFile('db/migrations/0002_analytics_requests.sql', 'utf8');
function fixture() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(schema);
  const DB = { prepare(sql) {
    let values = []; const statement = {
      bind(...input) { values = input; return statement; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { success: true, results: sqlite.prepare(sql).all(...values) }; },
      async run() { return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }; },
    }; return statement;
  }, async batch(statements) {
    sqlite.exec('BEGIN'); try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  return { sqlite, env: { DB, ASSETS: { fetch: async () => new Response('<html>portfolio</html>') }, MEDIA: {},
    DEPLOY_ENV: 'local', ANALYTICS_ENABLED: 'true', REQUESTS_ENABLED: 'true', LOCAL_ADMIN_BYPASS: 'true', LOCAL_CSRF_TOKEN: 'test' } };
}
const payload = () => ({ requestId: crypto.randomUUID(), email: 'Customer@example.com', projectDescription: 'A packaging design for tropical drinks.', projectCategory: 'design', budgetMode: 'undecided', _gotcha: '' });
const request = (body, path = '/api/v1/project-requests', origin = 'https://hyperd.example') => new Request(`https://hyperd.example${path}`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: JSON.stringify(body),
});

test('reporting uses UTC+7 calendar days and correct leap month, quarter and year boundaries', () => {
  assert.equal(reportingDay(new Date('2026-10-12T17:00:00Z')), '2026-10-13');
  assert.deepEqual(reportingRange('month', '2024-02-29'), { start: '2024-02-01', end: '2024-03-01' });
  assert.deepEqual(reportingRange('quarter', '2026-12-25'), { start: '2026-10-01', end: '2027-01-01' });
  assert.deepEqual(reportingRange('year', '2026-03-01'), { start: '2026-01-01', end: '2027-01-01' });
  assert.throws(() => reportingRange('day', '2026-02-30'));
});
test('classification trusts Cloudflare metadata and labels heuristic bots separately from verified bots', () => {
  const verified = new Request('https://hyperd.example/'); verified.cf = { botManagement: { verifiedBot: true, score: 1 } };
  assert.equal(classifyTraffic(verified).classification, 'bot');
  assert.equal(classifyTraffic(verified, true).classification, 'unknown', 'Ignore synthetic local CF metadata');
  const low = new Request('https://hyperd.example/'); low.cf = { botManagement: { score: 12 } };
  assert.equal(classifyTraffic(low).classification, 'suspected');
  assert.equal(classifyTraffic(new Request('https://hyperd.example/', { headers: { 'User-Agent': 'Googlebot' } })).reason, 'automated-user-agent');
  assert.equal(classifyTraffic(new Request('https://hyperd.example/.env')).reason, 'scanner-path');
  assert.equal(classifyTraffic(new Request('https://hyperd.example/', { headers: { 'cf-bot-score': '99' } })).classification, 'unknown');
});
test('Create enforces 10/email/day, normalizes case, records rejections and never sends local mail', async () => {
  const { env, sqlite } = fixture();
  for (let i = 0; i < 10; i++) assert.equal((await publicWorker.fetch(request(payload()), env)).status, 201);
  const rejected = await publicWorker.fetch(request({ ...payload(), email: ' customer@EXAMPLE.com ' }), env);
  assert.equal(rejected.status, 429); assert.equal((await rejected.json()).error.code, 'DAILY_LIMIT');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM create_requests').get().n, 10);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM create_attempts WHERE outcome='blocked'").get().n, 1);
  await deliverNotifications({ ...env, REQUEST_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'test', REQUEST_EMAIL_FROM: 'from@example.com', REQUEST_EMAIL_TO: 'owner@example.com' }, () => assert.fail('Local must never send mail'));
  sqlite.close();
});
test('daily email quota survives concurrent requests and Gmail aliases; retries do not duplicate history or intake', async () => {
  const { env, sqlite } = fixture();
  // Serialize the test adapter transactions like D1; invoke concurrent quota writes
  // directly as each INSERT is atomic, rather than overlapping SQLite BEGINs.
  const batch = env.DB.batch.bind(env.DB); let chain = Promise.resolve();
  env.DB.batch = statements => { const next = chain.then(() => batch(statements)); chain = next.catch(() => {}); return next; };
  const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => publicWorker.fetch(request({ ...payload(), email: index % 2 ? 'test.name+alias@gmail.com' : 'testname@googlemail.com' }), env)));
  assert.equal(responses.filter(response => response.status === 201).length, 10);
  const other = fixture(); const draft = payload();
  assert.equal((await publicWorker.fetch(request(draft), other.env)).status, 201);
  assert.equal((await publicWorker.fetch(request(draft), other.env)).status, 201);
  assert.equal(other.sqlite.prepare('SELECT count(*) AS n FROM create_attempts').get().n, 1);
  assert.equal((await publicWorker.fetch(request({ ...draft, projectDescription: 'A different request sharing the same retry ID.' }), other.env)).status, 409);
  sqlite.close(); other.sqlite.close();
});
test('Create rejects malformed data, honeypots, cross-origin traffic and fails closed until configured', async () => {
  const { env, sqlite } = fixture();
  assert.equal((await publicWorker.fetch(request(payload(), undefined, 'https://evil.example'), env)).status, 403);
  assert.equal((await publicWorker.fetch(request({ ...payload(), _gotcha: 'spam' }), env)).status, 400);
  assert.equal((await publicWorker.fetch(request({ ...payload(), projectCategory: '<script>' }), env)).status, 400);
  assert.equal((await publicWorker.fetch(request(payload()), { ...env, DEPLOY_ENV: 'staging' })).status, 503);
  const noOrigin = request(payload()); noOrigin.headers.delete('Origin');
  assert.equal((await publicWorker.fetch(noOrigin, env)).status, 403);
  assert.equal((await publicWorker.fetch(request({ ...payload(), projectDescription: 'x'.repeat(9000) }), env)).status, 413);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM create_requests').get().n, 0); sqlite.close();
});

test('source and site daily caps prevent rotating email addresses; minute caps bound invalid attempts', async () => {
  for (const [count, sameSource] of [[30, true], [100, false]]) {
    const { env, sqlite } = fixture(); const day = reportingDay();
    const ipHash = await privateHash(`intake:${day}:local`, env);
    const insert = sqlite.prepare(`INSERT INTO create_requests(id,payload_hash,created_at,local_day,email,email_hash,ip_hash,description,category,budget_mode,budget_text)
      VALUES(?,?,?,?,?,?,?,'Existing test request','design','undecided','')`);
    for (let i = 0; i < count; i++) insert.run(crypto.randomUUID(), 'hash', new Date().toISOString(), day, `seed${i}@example.invalid`, `email${i}`, sameSource ? ipHash : `source${i}`);
    const response = await publicWorker.fetch(request(payload()), env);
    assert.equal(response.status, 429); assert.equal((await response.json()).error.code, 'DAILY_LIMIT');
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM create_requests').get().n, count); sqlite.close();
  }
  const { env, sqlite } = fixture();
  for (let i = 0; i < 15; i++) assert.equal((await publicWorker.fetch(request({ ...payload(), _gotcha: 'bot' }), env)).status, 400);
  const limited = await publicWorker.fetch(request(payload()), env);
  assert.equal(limited.status, 429); assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM create_requests').get().n, 0); sqlite.close();
});
test('Turnstile verifies server-side action and hostname before intake; token replay is not sufficient', async () => {
  const { env, sqlite } = fixture(); const production = { ...env, DEPLOY_ENV: 'staging', ANALYTICS_HASH_SECRET: 'a-secret-that-is-long-enough-for-test', TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_HOSTNAMES: 'hyperd.example' };
  const draft = { ...payload(), turnstileToken: 'token' };
  await assert.rejects(submitRequest(request(draft), production, async () => new Response(JSON.stringify({ success: true, action: 'other', hostname: 'hyperd.example' }))), error => error.code === 'CHALLENGE_FAILED');
  await assert.rejects(submitRequest(request(draft), production, async () => new Response(JSON.stringify({ success: true, action: 'create', hostname: 'evil.example' }))), error => error.code === 'CHALLENGE_FAILED');
  assert.equal((await submitRequest(request(draft), production, async () => new Response(JSON.stringify({ success: true, action: 'create', hostname: 'hyperd.example' })))).ok, true);
  sqlite.close();
});
test('telemetry validates event allowlist, deduplicates IDs, ignores assets and admin report requires authentication', async () => {
  const { env, sqlite } = fixture(); const event = { id: crypto.randomUUID(), event: 'portfolio.open', email: 'ignored@example.com' };
  assert.equal((await publicWorker.fetch(request({ events: [event] }, '/api/v1/events'), env)).status, 200);
  assert.equal((await publicWorker.fetch(request({ events: [event] }, '/api/v1/events'), env)).status, 200);
  assert.equal((await publicWorker.fetch(request({ events: [{ ...event, event: 'private.email' }] }, '/api/v1/events'), env)).status, 400);
  await publicWorker.fetch(new Request('https://hyperd.example/public/photo.webp'), env);
  await publicWorker.fetch(new Request('https://hyperd.example/', { headers: { 'User-Agent': 'Mozilla/5.0' } }), env);
  assert.equal(sqlite.prepare('SELECT sum(count) AS n FROM analytics_daily').get().n, 2);
  const reportUrl = `https://hyperd.example/api/admin/analytics?period=day&date=${reportingDay()}`;
  assert.equal((await adminWorker.fetch(new Request(reportUrl), { ...env, LOCAL_ADMIN_BYPASS: 'false' })).status, 503);
  const response = await adminWorker.fetch(new Request(reportUrl.replace('hyperd.example', 'localhost')), env);
  assert.equal(response.status, 200); const report = await response.json();
  assert.equal(report.totals.human, 1); assert.equal(report.actions, 1); assert.equal(report.features[0].count, 1);
  assert.ok(!JSON.stringify(report).includes('ignored@example.com')); sqlite.close();
});
test('notification adapter leases work, uses provider idempotency and sends only to the configured owner', async () => {
  const { env, sqlite } = fixture(); await publicWorker.fetch(request(payload()), env);
  let calls = 0;
  const configured = { ...env, DEPLOY_ENV: 'staging', REQUEST_EMAIL_ENABLED: 'true', RESEND_API_KEY: 'key', REQUEST_EMAIL_FROM: 'verified@example.com', REQUEST_EMAIL_TO: 'owner@example.com' };
  await deliverNotifications(configured, async (url, init) => {
    calls++; assert.equal(url, 'https://api.resend.com/emails'); assert.match(init.headers['Idempotency-Key'], /^hyperd-create-/);
    assert.deepEqual(JSON.parse(init.body).to, ['owner@example.com']); return new Response('{"id":"provider-id"}');
  });
  await deliverNotifications(configured, () => assert.fail('Sent rows must not send twice'));
  assert.equal(calls, 1); assert.equal(sqlite.prepare('SELECT notification FROM create_requests').get().notification, 'sent'); sqlite.close();
});

test('history pagination handles identical timestamps and rollups survive raw history retention', async () => {
  const { env, sqlite } = fixture(); const day = reportingDay(); const now = new Date().toISOString();
  const insert = sqlite.prepare("INSERT INTO analytics_events VALUES(?,?,?,'edge','document.request','/','human','browser-heuristic',NULL,200)");
  for (let i = 0; i < 55; i++) insert.run(crypto.randomUUID(), now, day);
  const url = `http://localhost/api/admin/analytics?period=year&date=${day}`;
  const first = await (await adminWorker.fetch(new Request(url), env)).json();
  const second = await (await adminWorker.fetch(new Request(`${url}&trafficCursor=${encodeURIComponent(first.nextTrafficCursor)}`), env)).json();
  assert.equal(first.trafficHistory.length, 50); assert.equal(second.trafficHistory.length, 5);
  assert.equal(new Set([...first.trafficHistory, ...second.trafficHistory].map(item => item.id)).size, 55);
  assert.deepEqual(first.historyCounts, { traffic: 55, requests: 0 });
  const pagedIds = []; let cursor;
  do {
    const page = await (await adminWorker.fetch(new Request(`${url}&limit=10${cursor ? `&trafficCursor=${encodeURIComponent(cursor)}` : ''}`), env)).json();
    assert.equal(page.historyLimit, 10); assert.ok(page.trafficHistory.length <= 10);
    assert.equal(page.historyCounts.traffic, 55);
    pagedIds.push(...page.trafficHistory.map(item => item.id)); cursor = page.nextTrafficCursor;
  } while (cursor);
  assert.equal(pagedIds.length, 55); assert.equal(new Set(pagedIds).size, 55);
  sqlite.exec('DELETE FROM analytics_events');
  const retained = await (await adminWorker.fetch(new Request(url), env)).json();
  assert.equal(retained.totals.human, 55); assert.equal(retained.trafficHistory.length, 0); sqlite.close();
});

test('request history uses bounded pages and rejects invalid page sizes', async () => {
  const { env, sqlite } = fixture(); const day = reportingDay(); const now = new Date().toISOString();
  const insert = sqlite.prepare("INSERT INTO create_attempts VALUES(?,NULL,?,?,'blocked','TEST','','')");
  for (let i = 0; i < 25; i++) insert.run(crypto.randomUUID(), now, day);
  const url = `http://localhost/api/admin/analytics?period=month&date=${day}`;
  const first = await (await adminWorker.fetch(new Request(`${url}&limit=10`), env)).json();
  const second = await (await adminWorker.fetch(new Request(`${url}&limit=10&requestCursor=${encodeURIComponent(first.nextRequestCursor)}`), env)).json();
  const third = await (await adminWorker.fetch(new Request(`${url}&limit=10&requestCursor=${encodeURIComponent(second.nextRequestCursor)}`), env)).json();
  assert.deepEqual([first.requestHistory.length, second.requestHistory.length, third.requestHistory.length], [10, 10, 5]);
  assert.equal(first.historyCounts.requests, 25); assert.equal(third.nextRequestCursor, null);
  assert.equal(new Set([...first.requestHistory, ...second.requestHistory, ...third.requestHistory].map(item => item.id)).size, 25);
  for (const limit of ['0', '51', '1.5', 'abc']) assert.equal((await adminWorker.fetch(new Request(`${url}&limit=${limit}`), env)).status, 400);
  sqlite.close();
});

test('client analytics observes form steps before React replaces fields and sends no form content', async () => {
  const dom = new JSDOM('<main><form class="project-form"><textarea id="project-idea">Private idea</textarea><button>Continue</button></form></main>', { url: 'https://hyperd.example/' });
  const saved = new Map(); const overrides = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    Element: dom.window.Element, HTMLFormElement: dom.window.HTMLFormElement };
  for (const [key, value] of Object.entries(overrides)) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); }
  const originalFetch = globalThis.fetch; const batches = [];
  globalThis.fetch = async (_url, init) => { batches.push(JSON.parse(init.body)); return new Response('{"ok":true}'); };
  let stop;
  try {
    stop = startAnalytics();
    const form = document.querySelector('form');
    // React's delegated handler updates the contact fields during bubbling.
    document.querySelector('main').addEventListener('submit', event => { event.preventDefault(); form.innerHTML = '<input id="project-email" value="private@example.com"><button>Send</button>'; });
    form.requestSubmit(); form.requestSubmit();
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert.deepEqual(batches[0].events.map(item => item.event), ['create.step', 'create.submit']);
    assert.ok(!JSON.stringify(batches).includes('private@example.com')); assert.ok(!JSON.stringify(batches).includes('Private idea'));
  } finally {
    stop?.(); globalThis.fetch = originalFetch; dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
