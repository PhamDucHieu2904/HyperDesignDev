import { featureLabels, reportingDay, type TrafficClass } from '../../../shared/contracts';
import { PublicApiException } from './http';
import type { D1Database, PublicEnv } from './types';

export function classifyTraffic(request: Request, local = false) {
  // Wrangler can supply synthetic CF metadata. Local reports must not present
  // that metadata as real Cloudflare bot detection.
  const cf = local ? undefined : (request as Request & { cf?: { botManagement?: { score?: number; verifiedBot?: boolean } } }).cf;
  const score = cf?.botManagement?.score;
  if (cf?.botManagement?.verifiedBot === true) return { classification: 'bot' as TrafficClass, reason: 'cloudflare-verified', score: score ?? null };
  if (typeof score === 'number' && score >= 1 && score <= 99) return {
    classification: (score < 30 ? 'suspected' : 'human') as TrafficClass, reason: 'cloudflare-score', score,
  };
  const ua = request.headers.get('User-Agent') ?? '';
  const probe = /(?:\.env|wp-admin|wp-login|\.git|phpmyadmin|xmlrpc\.php|cgi-bin)/i.test(new URL(request.url).pathname);
  if (probe || /bot|crawler|spider|headless|curl|wget|python|scrapy|scanner|sqlmap/i.test(ua)) return {
    classification: 'suspected' as TrafficClass, reason: probe ? 'scanner-path' : 'automated-user-agent', score: null,
  };
  // A browser-shaped user agent is an estimate, never a verified identity.
  if (/Mozilla\//.test(ua)) return { classification: 'human' as TrafficClass, reason: 'browser-heuristic', score: null };
  return { classification: 'unknown' as TrafficClass, reason: 'insufficient-signals', score: null };
}

export async function privateHash(value: string, env: PublicEnv) {
  const secret = env.ANALYTICS_HASH_SECRET ?? (env.DEPLOY_ENV === 'local' ? 'hyperd-local-test-hash-only' : '');
  if (secret.length < 24) throw new PublicApiException(503, 'CONFIGURATION_REQUIRED', 'The service is not configured yet.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function sourceIp(request: Request, env: PublicEnv) {
  return env.DEPLOY_ENV === 'local' ? 'local' : request.headers.get('CF-Connecting-IP') ?? 'unavailable';
}
export async function reserveLimit(db: D1Database, key: string, window: string, limit: number) {
  const result = await db.prepare(`INSERT INTO request_limits(key,window,count,expires_at) VALUES(?,?,1,?)
    ON CONFLICT(key,window) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`)
    .bind(key, window, new Date(Date.now() + 2 * 86400000).toISOString(), limit).first<{ count: number }>();
  return Boolean(result);
}
export async function boundedJson(request: Request, max = 8192): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new PublicApiException(415, 'JSON_REQUIRED', 'Send JSON.');
  if (Number(request.headers.get('Content-Length')) > max) throw new PublicApiException(413, 'BODY_TOO_LARGE', 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new PublicApiException(400, 'INVALID_JSON', 'Request body is required.');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > max) { await reader.cancel(); throw new PublicApiException(413, 'BODY_TOO_LARGE', 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new PublicApiException(400, 'INVALID_JSON', 'JSON object is required.'); }
}
export function requirePublicOrigin(request: Request) {
  if (!request.headers.get('Origin')) throw new PublicApiException(403, 'ORIGIN_REQUIRED', 'A browser origin is required.');
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validEventId(id: unknown): id is string { return typeof id === 'string' && uuid.test(id); }
export async function ingestEvents(request: Request, env: PublicEnv) {
  if (env.ANALYTICS_ENABLED !== 'true') throw new PublicApiException(503, 'ANALYTICS_DISABLED', 'Analytics are not connected.');
  requirePublicOrigin(request);
  const minute = new Date().toISOString().slice(0, 16);
  const ip = await privateHash(`events:${reportingDay()}:${sourceIp(request, env)}`, env);
  if (!await reserveLimit(env.DB, 'analytics:global', minute, 1000) || !await reserveLimit(env.DB, `analytics:${ip}`, minute, 60)) {
    throw new PublicApiException(429, 'RATE_LIMITED', 'Please slow down.');
  }
  const body = await boundedJson(request);
  if (!Array.isArray(body.events) || !body.events.length || body.events.length > 20) throw new PublicApiException(400, 'INVALID_EVENTS', 'Send 1–20 events.');
  const classification = classifyTraffic(request, env.DEPLOY_ENV === 'local'); const now = new Date().toISOString();
  const statements = body.events.map((item: unknown) => {
    const event = item as { id?: unknown; event?: unknown };
    if (!event || !validEventId(event.id) || typeof event.event !== 'string' || !Object.hasOwn(featureLabels, event.event)) throw new PublicApiException(400, 'INVALID_EVENT', 'Unsupported event.');
    return env.DB.prepare(`INSERT OR IGNORE INTO analytics_events(id,created_at,local_day,source,event,path,classification,reason,score,status)
      VALUES(?,?,?,'client',?,'/',?,?,?,200)`).bind(event.id, now, reportingDay(), event.event,
      classification.classification, classification.reason, classification.score);
  });
  await env.DB.batch(statements);
  return { ok: true };
}
export async function recordEdge(request: Request, response: Response, env: PublicEnv) {
  if (env.ANALYTICS_ENABLED !== 'true' || request.method !== 'GET') return;
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/') || path.startsWith('/media/') || path.startsWith('/assets/') || path.startsWith('/public/')) return;
  if (/\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|map|woff2?|ttf|pdf)$/i.test(path)) return;
  const classification = classifyTraffic(request, env.DEPLOY_ENV === 'local');
  const safePath = path === '/' || path === '/index.html' || classification.reason === 'scanner-path' ? path.slice(0, 120) : '[other document]';
  await env.DB.prepare(`INSERT INTO analytics_events(id,created_at,local_day,source,event,path,classification,reason,score,status)
    VALUES(?,?,?,'edge','document.request',?,?,?,?,?)`).bind(crypto.randomUUID(), new Date().toISOString(), reportingDay(),
    safePath, classification.classification, classification.reason, classification.score, response.status).run();
}
