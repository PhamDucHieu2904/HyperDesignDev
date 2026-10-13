import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const bundle = await readFile('dist/admin/admin.js', 'utf8');
const totals = { human: 30, bot: 3, suspected: 1, unknown: 2 };
const traffic = Array.from({ length: 25 }, (_, index) => ({ id: `event-${index}`, createdAt: '2026-10-13T03:00:00Z', source: 'edge', event: `event-${index}`, path: '/', classification: 'human', reason: 'browser-heuristic', score: null, status: 200 }));
const requests = Array.from({ length: 23 }, (_, index) => ({ id: `attempt-${index}`, requestId: `request-${index}`, createdAt: '2026-10-13T03:00:00Z', outcome: 'accepted', reason: 'ACCEPTED', emailHint: `visitor-${index}@example.invalid`, category: 'design', notification: 'pending' }));
const project = { id: 'project-1', slug: 'sample', state: 'published', contentState: 'empty', version: 1, publicRevisionId: 'revision-1', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z', metadata: { title: 'Sample project', shortTitle: 'Sample', subtitle: 'A sample project', categoryId: 'illustrator', thumbnailAssetId: 'image-1', tags: [], tools: [], isFeatured: true, sortOrder: 0 } };
async function until(check) {
  const deadline = Date.now() + 3000;
  while (!check()) { assert.ok(Date.now() < deadline, 'Admin did not reach the expected state'); await new Promise(resolve => setTimeout(resolve, 10)); }
  await new Promise(resolve => setTimeout(resolve, 20));
}
function fixture(hash = 'home') {
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost/#${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const calls = [];
  dom.window.Headers = Headers;
  dom.window.fetch = async path => {
    const url = new URL(path, 'http://localhost'); calls.push(url);
    let result;
    if (url.pathname === '/api/admin/me') result = { email: 'owner@example.invalid', csrfToken: 'test' };
    else if (url.pathname === '/api/admin/projects') result = { items: [project], nextCursor: null };
    else if (url.pathname === '/api/admin/media') result = { items: [], nextCursor: null };
    else if (url.pathname.startsWith('/api/admin/requests/')) result = { id: url.pathname.split('/').at(-1), email: 'visitor-0@example.invalid', created_at: '2026-10-13T03:00:00Z', description: 'A private request description.', category: 'design', budget_mode: 'undecided', budget_text: '', notification: 'pending' };
    else if (url.pathname === '/api/admin/analytics') {
      const limit = Number(url.searchParams.get('limit')); const tc = Number(url.searchParams.get('trafficCursor') ?? 0); const rc = Number(url.searchParams.get('requestCursor') ?? 0);
      result = { period: url.searchParams.get('period'), start: '2026-10-01', end: '2026-11-01', timezone: 'Asia/Bangkok', environment: 'local', generatedAt: '2026-10-13T03:00:00Z', totals, browserLoads: 30, actions: 12, timeline: [{ day: '2026-10-13', ...totals, actions: 12, accepted: 23, blocked: 0 }], features: [], requests: { accepted: 23, blocked: 0, pending: 23, sent: 0, failed: 0 }, trafficHistory: traffic.slice(tc, tc + limit), requestHistory: requests.slice(rc, rc + limit), historyLimit: limit, historyCounts: { traffic: 25, requests: 23 }, nextTrafficCursor: tc + limit < traffic.length ? String(tc + limit) : null, nextRequestCursor: rc + limit < requests.length ? String(rc + limit) : null };
    } else throw new Error(`Unexpected request ${url}`);
    return { ok: true, status: 200, json: async () => result };
  };
  dom.window.eval(bundle);
  return { dom, document: dom.window.document, calls };
}
const click = (document, selector) => { const node = document.querySelector(selector); assert.ok(node, selector); node.click(); };

test('admin separates all four sections, restores routes, and paginates both histories', async () => {
  const { dom, document, calls } = fixture();
  try {
    await until(() => document.querySelector('.admin-recent-grid button'));
    assert.deepEqual([...document.querySelectorAll('.admin-header-nav a')].map(node => node.textContent), ['Home', 'Library', 'Analytics', 'Orders']);
    click(document, '.admin-header-nav a[href="#analytics"]');
    await until(() => document.querySelector('.analytics-table tbody tr'));
    assert.equal(document.querySelectorAll('.analytics-table tbody tr').length, 10);
    assert.equal(document.querySelector('.analytics-table tbody tr:nth-child(1) td:nth-child(2)').textContent, 'edge / event-0/');
    assert.equal(document.querySelector('.orders-table'), null);
    click(document, '.analytics-periods button[aria-pressed="true"]');
    assert.equal(document.querySelector('.analytics-content.is-loading'), null, 'Selecting the current period must not leave the report loading');
    click(document, '[aria-label="Next events page"]');
    await until(() => document.querySelector('.admin-pagination').textContent.includes('Page 2 of 3') && !document.querySelector('.is-loading'));
    assert.match(document.querySelector('.analytics-table tbody').textContent, /event-10/);
    click(document, '[aria-label="Previous events page"]');
    await until(() => document.querySelector('.admin-pagination').textContent.includes('Page 1 of 3') && !document.querySelector('.is-loading'));
    const size = document.querySelector('[aria-label="events per page"]'); size.value = '20'; size.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await until(() => document.querySelectorAll('.analytics-table tbody tr').length === 20);
    click(document, '.admin-header-nav a[href="#orders"]');
    await until(() => document.querySelector('.orders-table tbody tr'));
    assert.equal(document.querySelectorAll('.orders-table tbody tr').length, 10);
    assert.equal(document.querySelector('.analytics-trend'), null);
    click(document, '.orders-table tbody tr button');
    await until(() => document.querySelector('.analytics-description'));
    assert.match(document.querySelector('.analytics-description').textContent, /private request description/);
    click(document, '[aria-label="Next requests page"]');
    await until(() => document.querySelector('.admin-pagination').textContent.includes('Page 2 of 3') && !document.querySelector('.is-loading'));
    assert.equal(document.querySelector('.analytics-description'), null);
    assert.match(document.querySelector('.orders-table tbody').textContent, /visitor-10/);
    click(document, '[aria-label="Previous requests page"]');
    await until(() => document.querySelector('.admin-pagination').textContent.includes('Page 1 of 3') && !document.querySelector('.is-loading'));
    dom.window.location.hash = 'library';
    await until(() => document.querySelector('.admin-project-grid'));
    assert.equal(document.querySelector('.admin-header-nav a[aria-current="page"]').textContent, 'Library');
    assert.ok(calls.some(url => url.searchParams.get('trafficCursor') === '10'));
    assert.ok(calls.some(url => url.searchParams.get('requestCursor') === '10'));
  } finally { dom.window.close(); }
});

test('direct Orders link loads the correct page and header navigation protects unsaved metadata', async () => {
  const { dom, document } = fixture('orders');
  try {
    await until(() => document.querySelector('.orders-table'));
    assert.equal(document.querySelector('.admin-header-nav a[aria-current="page"]').textContent, 'Orders');
    click(document, '.admin-header-nav a[href="#library"]'); await until(() => document.querySelector('.admin-project-grid'));
    click(document, '.admin-page-header button'); await until(() => document.querySelector('#metadata-form-title'));
    const input = document.querySelector('input[placeholder="e.g. Coco Boba — Tini World"]');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'Unsaved idea');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    let confirmations = 0; dom.window.confirm = () => { confirmations++; return false; };
    await until(() => input.value === 'Unsaved idea');
    click(document, '.admin-header-nav a[href="#home"]');
    assert.equal(confirmations, 1); assert.ok(document.querySelector('#metadata-form-title'));
    dom.window.confirm = () => true; click(document, '.admin-header-nav a[href="#home"]');
    await until(() => document.querySelector('.admin-home-grid'));
  } finally { dom.window.close(); }
});
