import { reportingDay, type RequestPublicConfig } from '../../../shared/contracts';
import { PublicApiException } from './http';
import { boundedJson, classifyTraffic, privateHash, requirePublicOrigin, reserveLimit, sourceIp, validEventId } from './telemetry';
import type { PublicEnv } from './types';

export function requestConfig(env: PublicEnv): RequestPublicConfig {
  const local = env.DEPLOY_ENV === 'local';
  return { enabled: env.REQUESTS_ENABLED === 'true' && (local || Boolean((env.ANALYTICS_HASH_SECRET?.length ?? 0) >= 24 && env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY && env.TURNSTILE_HOSTNAMES)),
    turnstileSiteKey: local ? '' : env.TURNSTILE_SITE_KEY ?? '', local, dailyEmailLimit: 10 };
}
export function canonicalEmail(email: string) {
  const [name, rawDomain] = email.trim().toLowerCase().split('@');
  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain;
  return `${domain === 'gmail.com' ? name.split('+')[0].replace(/\./g, '') : name}@${domain}`;
}
type StoredRequest = { id: string; payload_hash: string; email: string; description: string; category: string; budget_mode: string; budget_text: string; created_at: string; notification: string };
export async function submitRequest(request: Request, env: PublicEnv, transport: typeof fetch = fetch) {
  requirePublicOrigin(request);
  if (!requestConfig(env).enabled) throw new PublicApiException(503, 'REQUESTS_DISABLED', 'Project requests are not connected yet. Your draft is safe.');
  const day = reportingDay(); const now = new Date().toISOString();
  const ip = await privateHash(`intake:${day}:${sourceIp(request, env)}`, env);
  // Bound work and storage before parsing or asking Turnstile to validate a token.
  if (!await reserveLimit(env.DB, 'intake:global', now.slice(0, 16), 200) || !await reserveLimit(env.DB, `intake:${ip}`, now.slice(0, 16), 15)) {
    throw new PublicApiException(429, 'RATE_LIMITED', 'Too many attempts. Please wait a minute before trying again.');
  }
  const body = await boundedJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const emailHash = email ? await privateHash(`email:${canonicalEmail(email)}`, env) : '';
  const hint = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `${email.slice(0, 1)}***@${email.split('@')[1]}`.slice(0, 80) : '';
  const attempt = async (outcome: 'accepted' | 'blocked', reason: string, requestId: string | null = null) => env.DB.prepare(
    'INSERT INTO create_attempts(id,request_id,created_at,local_day,outcome,reason,email_hint,email_hash) VALUES(?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), requestId, now, day, outcome, reason, hint, emailHash).run();
  const deny = async (code: string, status = 400, message = 'Your request could not be sent. Please review the form.') => {
    await attempt('blocked', code);
    throw new PublicApiException(status, code, message);
  };
  if (body._gotcha || body.honeypot) return deny('HONEYPOT', 400);
  const classification = classifyTraffic(request, env.DEPLOY_ENV === 'local');
  if (classification.classification === 'bot' || (classification.reason === 'cloudflare-score' && (classification.score ?? 99) < 30)) return deny('BOT_REJECTED', 403);
  const description = typeof body.projectDescription === 'string' ? body.projectDescription.trim() : '';
  const category = typeof body.projectCategory === 'string' ? body.projectCategory : '';
  const budgetMode = typeof body.budgetMode === 'string' ? body.budgetMode : 'undecided';
  const budgetText = budgetMode === 'specified' && typeof body.budgetText === 'string' ? body.budgetText.trim() : '';
  if (!validEventId(body.requestId) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || description.length < 15 || description.length > 3000 || !['', 'design', '3d-motion', 'web-app', 'other'].includes(category)
    || !['undecided', 'discuss', 'specified'].includes(budgetMode) || budgetText.length > 120) return deny('INVALID_FORM');
  const id = body.requestId;
  const payloadHash = await privateHash(JSON.stringify([email, description, category, budgetMode, budgetText]), env);
  const prior = await env.DB.prepare('SELECT id,payload_hash,notification FROM create_requests WHERE id=?').bind(id).first<StoredRequest>();
  if (prior) {
    if (prior.payload_hash !== payloadHash) return deny('IDEMPOTENCY_CONFLICT', 409);
    return { ok: true, id: prior.id, notification: prior.notification, duplicate: true };
  }
  if (env.DEPLOY_ENV !== 'local') {
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
    if (!token || token.length > 2048) return deny('CHALLENGE_REQUIRED', 403, 'Please complete the verification before sending.');
    let result: { success?: boolean; action?: string; hostname?: string };
    try {
      const response = await transport('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: sourceIp(request, env), idempotency_key: id }),
      });
      if (!response.ok) throw new Error(); result = await response.json();
    } catch { return deny('CHALLENGE_UNAVAILABLE', 503, 'Verification is temporarily unavailable. Please try again.'); }
    const hostnames = (env.TURNSTILE_HOSTNAMES ?? '').split(',').map(value => value.trim());
    if (!result.success || result.action !== 'create' || !hostnames.includes(result.hostname ?? '')) return deny('CHALLENGE_FAILED', 403, 'Verification expired or failed. Please try again.');
  }
  // One SQL write performs all daily quota checks atomically. Parallel submissions
  // cannot pass a separate count/read race. The primary key makes retry idempotent.
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO create_requests(id,payload_hash,created_at,local_day,email,email_hash,ip_hash,description,category,budget_mode,budget_text)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE
      (SELECT count(*) FROM create_requests WHERE local_day=? AND email_hash=?) < 10 AND
      (SELECT count(*) FROM create_requests WHERE local_day=? AND ip_hash=?) < 30 AND
      (SELECT count(*) FROM create_requests WHERE local_day=?) < 100`)
      .bind(id, payloadHash, now, day, email, emailHash, ip, description, category, budgetMode, budgetText, day, emailHash, day, ip, day),
    env.DB.prepare(`INSERT INTO create_attempts(id,request_id,created_at,local_day,outcome,reason,email_hint,email_hash)
      SELECT ?,?,?,?,'accepted','ACCEPTED',?,? WHERE changes()=1`).bind(crypto.randomUUID(), id, now, day, hint, emailHash),
  ]);
  if (!results[0].meta?.changes) {
    const concurrent = await env.DB.prepare('SELECT id,payload_hash,notification FROM create_requests WHERE id=?').bind(id).first<StoredRequest>();
    if (concurrent?.payload_hash === payloadHash) return { ok: true, id, duplicate: true, notification: concurrent.notification };
    return deny('DAILY_LIMIT', 429, 'Daily request limit reached. Each email can send up to 10 requests per day. Please try again tomorrow.');
  }
  return { ok: true, id, notification: 'pending' };
}

// Called by a Cloudflare scheduled event only after the owner enables mail.
// Local development never sends email. Ambiguous deliveries are quarantined
// after 23 hours rather than risking a retry outside the provider's dedup window.
export async function deliverNotifications(env: PublicEnv, transport: typeof fetch = fetch) {
  if (env.DEPLOY_ENV === 'local' || env.REQUEST_EMAIL_ENABLED !== 'true' || !env.RESEND_API_KEY || !env.REQUEST_EMAIL_FROM || !env.REQUEST_EMAIL_TO) return;
  const stale = new Date(Date.now() - 5 * 60000).toISOString();
  const candidates = await env.DB.prepare(`SELECT * FROM create_requests WHERE notification='pending'
    OR (notification='sending' AND last_attempt_at<?) ORDER BY created_at LIMIT 20`).bind(stale).all<StoredRequest & { notification_attempts: number; last_attempt_at: string | null }>();
  for (const item of candidates.results ?? []) {
    if (item.notification_attempts >= 5 || (item.last_attempt_at && Date.now() - Date.parse(item.created_at) > 23 * 3600000)) {
      await env.DB.prepare("UPDATE create_requests SET notification='failed' WHERE id=? AND notification!='sent'").bind(item.id).run(); continue;
    }
    const now = new Date().toISOString();
    const claimed = await env.DB.prepare(`UPDATE create_requests SET notification='sending',notification_attempts=notification_attempts+1,last_attempt_at=?
      WHERE id=? AND (notification='pending' OR (notification='sending' AND last_attempt_at<?)) RETURNING id`).bind(now, item.id, stale).first();
    if (!claimed) continue;
    try {
      const response = await transport('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Idempotency-Key': `hyperd-create-${item.id}` },
        body: JSON.stringify({ from: env.REQUEST_EMAIL_FROM, to: [env.REQUEST_EMAIL_TO], reply_to: item.email,
          subject: 'Hyper D² — New project request', text: `Request: ${item.id}\nEmail: ${item.email}\nCategory: ${item.category}\nBudget: ${item.budget_mode} ${item.budget_text}\n\n${item.description}` }),
      });
      if (!response.ok) throw new Error(); const result = await response.json() as { id?: string };
      if (!result.id) throw new Error();
      await env.DB.prepare("UPDATE create_requests SET notification='sent',notified_at=?,provider_id=? WHERE id=?").bind(now, result.id, item.id).run();
    } catch { /* Leave the lease in place; a later scheduled event can retry. */ }
  }
}
