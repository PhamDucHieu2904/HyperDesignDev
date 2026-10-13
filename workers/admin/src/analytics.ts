import { reportingDay, reportingRange, reportingTimezone, type AnalyticsReport, type FeatureEvent, type ReportingPeriod, type TrafficClass } from '../../../shared/contracts';
import { ApiException } from './http';
import type { AdminEnv } from './types';

export async function analyticsReport(env: AdminEnv, url: URL): Promise<AnalyticsReport> {
  const period = (url.searchParams.get('period') ?? 'month') as ReportingPeriod;
  if (!['day', 'month', 'quarter', 'year'].includes(period)) throw new ApiException(400, 'INVALID_PERIOD', 'Choose day, month, quarter or year.');
  let range: { start: string; end: string };
  try { range = reportingRange(period, url.searchParams.get('date') ?? reportingDay()); }
  catch { throw new ApiException(400, 'INVALID_DATE', 'Choose a valid calendar date.'); }
  const { start, end } = range;
  const limit = Number(url.searchParams.get('limit') ?? 50);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new ApiException(400, 'INVALID_LIMIT', 'History limit must be an integer from 1 to 50.');
  const trafficCursor = url.searchParams.get('trafficCursor'); const requestCursor = url.searchParams.get('requestCursor');
  const parseCursor = (value: string | null) => {
    if (!value) return null;
    const [time, id] = value.split('|');
    if (!/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(time) || !/^[a-z0-9-]{1,100}$/i.test(id ?? '')) throw new ApiException(400, 'INVALID_CURSOR', 'Invalid history cursor.');
    return { time, id };
  };
  const tc = parseCursor(trafficCursor); const rc = parseCursor(requestCursor);
  const all = async <T>(sql: string, values: unknown[] = [start, end]) => (await env.DB.prepare(sql).bind(...values).all<T>()).results ?? [];
  try {
    const [daily, creates, notification, traffic, attempts, trafficCount, requestCount] = await Promise.all([
      all<{ day: string; source: string; event: FeatureEvent; classification: TrafficClass; count: number }>('SELECT * FROM analytics_daily WHERE day>=? AND day<? ORDER BY day'),
      all<{ day: string; outcome: string; count: number }>('SELECT day,outcome,sum(count) AS count FROM create_daily WHERE day>=? AND day<? GROUP BY day,outcome'),
      all<{ notification: string; count: number }>('SELECT notification,count(*) AS count FROM create_requests WHERE local_day>=? AND local_day<? GROUP BY notification'),
      all<AnalyticsReport['trafficHistory'][number]>(`SELECT id,created_at AS createdAt,source,event,path,classification,reason,score,status FROM analytics_events
        WHERE local_day>=? AND local_day<? ${tc ? 'AND (created_at<? OR (created_at=? AND id<?))' : ''} ORDER BY created_at DESC,id DESC LIMIT ?`,
        [start, end, ...(tc ? [tc.time, tc.time, tc.id] : []), limit + 1]),
      all<AnalyticsReport['requestHistory'][number]>(`SELECT a.id,a.request_id AS requestId,a.created_at AS createdAt,a.outcome,a.reason,a.email_hint AS emailHint,r.category,r.notification
        FROM create_attempts a LEFT JOIN create_requests r ON r.id=a.request_id WHERE a.local_day>=? AND a.local_day<?
        ${rc ? 'AND (a.created_at<? OR (a.created_at=? AND a.id<?))' : ''} ORDER BY a.created_at DESC,a.id DESC LIMIT ?`,
        [start, end, ...(rc ? [rc.time, rc.time, rc.id] : []), limit + 1]),
      all<{ count: number }>('SELECT count(*) AS count FROM analytics_events WHERE local_day>=? AND local_day<?'),
      all<{ count: number }>('SELECT count(*) AS count FROM create_attempts WHERE local_day>=? AND local_day<?'),
    ]);
    const totals = { human: 0, bot: 0, suspected: 0, unknown: 0 }; let browserLoads = 0; let actions = 0;
    const timeline = new Map<string, AnalyticsReport['timeline'][number]>();
    for (const date = new Date(`${start}T00:00:00Z`); date.toISOString().slice(0, 10) < end; date.setUTCDate(date.getUTCDate() + 1)) {
      const day = date.toISOString().slice(0, 10); timeline.set(day, { day, ...totals, actions: 0, accepted: 0, blocked: 0 });
    }
    const features = new Map<string, AnalyticsReport['features'][number]>();
    for (const row of daily) {
      const point = timeline.get(row.day)!;
      if (row.source === 'edge') { totals[row.classification] += row.count; point[row.classification] += row.count; }
      else if (row.event === 'page.view') browserLoads += row.count;
      else {
        actions += row.count; point.actions += row.count;
        const key = `${row.event}:${row.classification}`; const current = features.get(key);
        features.set(key, { event: row.event, classification: row.classification, count: (current?.count ?? 0) + row.count });
      }
    }
    const requests = { accepted: 0, blocked: 0, pending: 0, sent: 0, failed: 0 };
    for (const row of creates) {
      const key = row.outcome as 'accepted' | 'blocked'; requests[key] += row.count; timeline.get(row.day)![key] += row.count;
    }
    for (const row of notification) {
      const key = row.notification === 'sending' ? 'pending' : row.notification as 'pending' | 'sent' | 'failed'; requests[key] += row.count;
    }
    const cursor = (rows: { id: string; createdAt: string }[]) => rows.length > limit ? `${rows[limit - 1].createdAt}|${rows[limit - 1].id}` : null;
    return { period, start, end, timezone: reportingTimezone, generatedAt: new Date().toISOString(), environment: env.DEPLOY_ENV ?? 'unknown',
      totals, browserLoads, actions, timeline: [...timeline.values()], features: [...features.values()].sort((a, b) => b.count - a.count), requests,
      trafficHistory: traffic.slice(0, limit), requestHistory: attempts.slice(0, limit), nextTrafficCursor: cursor(traffic), nextRequestCursor: cursor(attempts),
      historyCounts: { traffic: trafficCount[0]?.count ?? 0, requests: requestCount[0]?.count ?? 0 }, historyLimit: limit };
  } catch (error) {
    if (error instanceof ApiException) throw error;
    throw new ApiException(503, 'ANALYTICS_UNAVAILABLE', 'Analytics storage is unavailable. Apply migration 0002 to the connected database and try again.');
  }
}
