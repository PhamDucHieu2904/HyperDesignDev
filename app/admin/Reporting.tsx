import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { reportingDay, type AnalyticsReport, type ReportingPeriod } from '../../shared/contracts';
import { getAnalyticsReport } from './repository';

export const formatNumber = (value: number) => value.toLocaleString('en-US');
export const reportDateTime = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });
export function useReport() {
  const [period, setPeriod] = useState<ReportingPeriod>('month');
  const [date, setDate] = useState(reportingDay);
  const [limit, setLimit] = useState(10);
  const [trafficPages, setTrafficPages] = useState<(string | undefined)[]>([undefined]);
  const [requestPages, setRequestPages] = useState<(string | undefined)[]>([undefined]);
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  const trafficCursor = trafficPages.at(-1); const requestCursor = requestPages.at(-1);
  useEffect(() => {
    let active = true; setBusy(true); setError('');
    void getAnalyticsReport(period, date, trafficCursor, requestCursor, limit)
      .then(value => { if (active) setReport(value); })
      .catch(next => { if (active) { setReport(null); setError(next instanceof Error ? next.message : 'This report could not be loaded.'); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [period, date, trafficCursor, requestCursor, limit, reload]);
  const reset = () => { setBusy(true); setTrafficPages([undefined]); setRequestPages([undefined]); };
  return {
    period, date, limit, report, busy, error,
    changePeriod: (value: ReportingPeriod) => { if (value !== period) { reset(); setPeriod(value); } },
    changeDate: (value: string) => { if (value !== date) { reset(); setDate(value); } },
    changeLimit: (value: number) => { if (value !== limit) { reset(); setLimit(value); } },
    refresh: () => { reset(); setReload(value => value + 1); },
    traffic: { page: trafficPages.length, next: () => { if (!busy && report?.nextTrafficCursor) { setBusy(true); setTrafficPages(pages => [...pages, report.nextTrafficCursor!]); } }, previous: () => { if (!busy && trafficPages.length > 1) { setBusy(true); setTrafficPages(pages => pages.slice(0, -1)); } }, first: () => { if (!busy && trafficPages.length > 1) { setBusy(true); setTrafficPages([undefined]); } } },
    requests: { page: requestPages.length, next: () => { if (!busy && report?.nextRequestCursor) { setBusy(true); setRequestPages(pages => [...pages, report.nextRequestCursor!]); } }, previous: () => { if (!busy && requestPages.length > 1) { setBusy(true); setRequestPages(pages => pages.slice(0, -1)); } }, first: () => { if (!busy && requestPages.length > 1) { setBusy(true); setRequestPages([undefined]); } } },
  };
}

export function ReportControls({ state }: { state: ReturnType<typeof useReport> }) {
  return <><div className="analytics-controls"><div className="analytics-periods" role="group" aria-label="Reporting period">{(['day', 'month', 'quarter', 'year'] as const).map(value => <button key={value} type="button" aria-pressed={state.period === value} className={state.period === value ? 'is-active' : ''} onClick={() => state.changePeriod(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
    <label className="analytics-date"><CalendarDays aria-hidden="true" /><span>Date in period</span><input type="date" min="2020-01-01" max="2100-12-31" value={state.date} onChange={event => { if (event.target.value) state.changeDate(event.target.value); }} /></label>
    <button type="button" className="admin-button admin-button-quiet" disabled={state.busy} onClick={state.refresh}><RefreshCw className={state.busy ? 'admin-spin' : ''} aria-hidden="true" />Refresh</button></div>
    {state.error && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert aria-hidden="true" /><span>{state.error}</span><button type="button" className="admin-button admin-button-quiet" onClick={state.refresh}>Retry</button></div>}
    {state.busy && <p role="status" className="analytics-status">Loading selected period…</p>}
    {state.report && <p className="analytics-status"><span className="analytics-source">{state.report.environment === 'local' ? 'Local database' : 'Website data'}</span>{state.report.start} to {new Date(Date.parse(`${state.report.end}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)} · UTC+7 · Updated {reportDateTime(state.report.generatedAt)}</p>}
  </>;
}

export function HistoryPagination({ label, page, limit, count, total, hasNext, busy, onNext, onPrevious, onFirst, onLimit }: {
  label: string; page: number; limit: number; count: number; total: number; hasNext: boolean; busy: boolean;
  onNext: () => void; onPrevious: () => void; onFirst: () => void; onLimit: (value: number) => void;
}) {
  return <nav className="admin-pagination" aria-label={`${label} pagination`}>
    <span role="status">{busy ? 'Loading page…' : `${count ? `${formatNumber((page - 1) * limit + 1)}–${formatNumber((page - 1) * limit + count)}` : '0'} of ${formatNumber(total)} ${label}`}</span>
    <label>Rows<select aria-label={`${label} per page`} value={limit} disabled={busy} onChange={event => onLimit(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option></select></label>
    <div><button type="button" className="admin-button admin-button-quiet" disabled={busy || page === 1} onClick={onFirst}>Latest</button><button type="button" className="admin-icon-button" aria-label={`Previous ${label} page`} disabled={busy || page === 1} onClick={onPrevious}><ChevronLeft aria-hidden="true" /></button><span>Page {page} of {Math.max(1, Math.ceil(total / limit))}</span><button type="button" className="admin-icon-button" aria-label={`Next ${label} page`} disabled={busy || !hasNext} onClick={onNext}><ChevronRight aria-hidden="true" /></button></div>
  </nav>;
}
