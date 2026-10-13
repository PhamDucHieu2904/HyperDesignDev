import { CheckCheck, CircleAlert, Inbox, Mail, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getCreateRequest } from './repository';
import { formatNumber as fmt, reportDateTime as dateTime, HistoryPagination, ReportControls, useReport } from './Reporting';

const mailLabels: Record<string, string> = { pending: 'Queued', sending: 'Sending', sent: 'Provider accepted', failed: 'Needs review' };
export function OrdersPage() {
  const state = useReport(); const { report, busy } = state;
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getCreateRequest>> | null>(null);
  const [detailBusy, setDetailBusy] = useState(false); const [detailError, setDetailError] = useState('');
  const generation = useRef(0); const detailRef = useRef<HTMLElement>(null);
  const clearDetail = () => { generation.current++; setDetail(null); setDetailBusy(false); setDetailError(''); };
  useEffect(() => { clearDetail(); return () => { generation.current++; }; }, [state.period, state.date, state.requests.page, state.limit]);
  const openDetail = async (id: string) => {
    const current = ++generation.current; setDetail(null); setDetailError(''); setDetailBusy(true);
    try { const next = await getCreateRequest(id); if (generation.current === current) setDetail(next); }
    catch (next) { if (generation.current === current) setDetailError(next instanceof Error ? next.message : 'Request could not load.'); }
    finally { if (generation.current === current) setDetailBusy(false); }
  };
  useEffect(() => { if (detail || detailBusy || detailError) detailRef.current?.focus(); }, [detail, detailBusy, detailError]);
  return <>
    <header className="admin-page-header"><div><p className="admin-eyebrow">Requests & notifications</p><h1>Project orders<span className="admin-heading-dot">.</span></h1><p className="admin-page-lead">Review Create requests and keep an eye on their mail status.</p></div></header>
    <ReportControls state={state} />
    {report && <div aria-busy={busy} className={busy ? 'analytics-content is-loading' : 'analytics-content'}>
      <div className="analytics-cards">
        {[{ title: 'Requests received', value: report.requests.accepted, icon: Inbox, hint: 'Accepted Create submissions' },
          { title: 'Attempts blocked', value: report.requests.blocked, icon: ShieldCheck, hint: 'Validation, quotas or protection' },
          { title: 'Mail queued', value: report.requests.pending, icon: Mail, hint: `${fmt(report.requests.failed)} notifications need review` },
          { title: 'Provider accepted', value: report.requests.sent, icon: CheckCheck, hint: 'Accepted by the email provider' }].map(({ title, value, icon: Icon, hint }) => <section key={title} className="analytics-metric"><span><Icon aria-hidden="true" />{title}</span><strong>{fmt(value)}</strong><small>{hint}</small></section>)}
      </div>
      <section className="analytics-panel"><header><div><h2>Request history</h2><p>Accepted requests and blocked attempts in this period.</p></div><span className="admin-count-badge">{fmt(report.historyCounts.requests)} attempts</span></header>
        {report.requestHistory.length ? <div className="admin-table-wrap"><table className="analytics-table orders-table"><thead><tr><th scope="col">Time (UTC+7)</th><th scope="col">Email</th><th scope="col">Category</th><th scope="col">Outcome</th><th scope="col">Mail</th><th scope="col">Details</th></tr></thead><tbody>{report.requestHistory.map(item => <tr key={item.id}><td>{dateTime(item.createdAt)}</td><td>{item.emailHint || '—'}</td><td>{item.category || '—'}</td><td><span className={`analytics-chip ${item.outcome}`}>{item.outcome === 'accepted' ? 'Received' : 'Blocked'}</span><small>{item.reason}</small></td><td>{item.notification ? <span className={`analytics-chip mail-${item.notification}`}>{mailLabels[item.notification] ?? item.notification}</span> : '—'}</td><td>{item.outcome === 'accepted' && item.requestId ? <button type="button" className="admin-button admin-button-quiet" onClick={() => void openDetail(item.requestId!)}>View request</button> : '—'}</td></tr>)}</tbody></table></div> : <p className="analytics-empty-inline">No requests in this period.</p>}
        <HistoryPagination label="requests" page={state.requests.page} limit={state.limit} count={report.requestHistory.length} total={report.historyCounts.requests} busy={busy} hasNext={Boolean(report.nextRequestCursor)} onNext={state.requests.next} onPrevious={state.requests.previous} onFirst={state.requests.first} onLimit={state.changeLimit} />
      </section>
      {(detail || detailBusy || detailError) && <section ref={detailRef} tabIndex={-1} className="analytics-request-detail" aria-label="Request details"><button type="button" className="admin-icon-button" aria-label="Close request details" onClick={clearDetail}><X aria-hidden="true" /></button>{detailBusy ? <p role="status">Loading request…</p> : detailError ? <p role="alert"><CircleAlert aria-hidden="true" />{detailError}</p> : detail && <><p className="admin-eyebrow">Project request</p><h2>{detail.email}</h2><dl className="orders-detail-meta"><div><dt>Received</dt><dd>{dateTime(detail.created_at)}</dd></div><div><dt>Category</dt><dd>{detail.category || 'Unspecified'}</dd></div><div><dt>Budget</dt><dd>{detail.budget_mode === 'undecided' ? 'To be discussed' : detail.budget_text || detail.budget_mode}</dd></div><div><dt>Mail status</dt><dd>{mailLabels[detail.notification] ?? detail.notification}</dd></div></dl><h3>Project description</h3><p className="analytics-description">{detail.description}</p><a className="admin-button admin-button-primary" href={`mailto:${encodeURIComponent(detail.email)}`}>Compose reply<Mail aria-hidden="true" /></a></>}</section>}
      <details className="analytics-notes"><summary>Create protection & mail settings</summary><dl className="analytics-limits"><div><dt>Per email / day</dt><dd>10 requests</dd></div><div><dt>Per source / day</dt><dd>30 requests</dd></div><div><dt>Entire site / day</dt><dd>100 requests</dd></div><div><dt>Per source / minute</dt><dd>15 attempts</dd></div></dl><p>Turnstile is required outside local development. Local requests queue notifications without sending real email. Provider acceptance does not confirm delivery. The visitor supplies their email address. Request history is retained for 365 days.</p></details>
    </div>}
  </>;
}
