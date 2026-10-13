import { Activity, BarChart3, Bot, MousePointer2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { featureLabels, trafficLabels, type AnalyticsReport, type TrafficClass } from '../../shared/contracts';
import { formatNumber as fmt, reportDateTime as dateTime, HistoryPagination, ReportControls, useReport } from './Reporting';

const classes: TrafficClass[] = ['human', 'bot', 'suspected', 'unknown'];

function TrafficChart({ report }: { report: AnalyticsReport }) {
  const [table, setTable] = useState(false);
  const points = useMemo(() => {
    if (report.period !== 'year' && report.period !== 'quarter') return report.timeline;
    const groups = new Map<string, typeof report.timeline[number]>();
    for (const point of report.timeline) {
      const key = point.day.slice(0, 7); const group = groups.get(key) ?? { day: key, human: 0, bot: 0, suspected: 0, unknown: 0, actions: 0, accepted: 0, blocked: 0 };
      for (const field of [...classes, 'actions', 'accepted', 'blocked'] as const) group[field] += point[field];
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [report]);
  const max = Math.max(1, ...points.map(point => classes.reduce((sum, key) => sum + point[key], 0)));
  const plotWidth = 840; const slot = plotWidth / Math.max(1, points.length);
  return <section className="analytics-panel analytics-trend"><header><div><h2>Traffic over time</h2><p>Document requests received by the public Worker</p></div><button type="button" className="admin-button admin-button-quiet" aria-expanded={table} onClick={() => setTable(value => !value)}>{table ? 'Hide data table' : 'View data table'}</button></header>
    <div className="analytics-legend">{classes.map(key => <span key={key}><i data-class={key} />{trafficLabels[key]}</span>)}</div>
    <svg viewBox="0 0 920 270" role="img" aria-label={`Traffic from ${report.start} to ${report.end}. Data table available below.`}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="52" x2="892" y1={218 - fraction * 180} y2={218 - fraction * 180} stroke="currentColor" opacity=".15" /><text x="45" y={223 - fraction * 180} textAnchor="end">{fmt(Math.round(max * fraction))}</text></g>)}
      {points.map((point, index) => { let offset = 0; return <g key={point.day}>
        {classes.map(key => { const height = point[key] / max * 180; const y = 218 - offset - height; offset += height;
          return <rect key={key} className="analytics-bar" data-class={key} x={52 + index * slot + slot * .16} y={y} width={slot * .68} height={height}><title>{point.day}: {trafficLabels[key]} {point[key]}</title></rect>; })}
        {(points.length <= 12 || index % 5 === 0 || index === points.length - 1) && <text x={52 + index * slot + slot / 2} y="247" textAnchor="middle">{point.day.slice(5)}</text>}
      </g>; })}
    </svg>
    {!classes.some(key => report.totals[key] > 0) && <p className="analytics-empty-inline">No traffic recorded for this period.</p>}
    {table && <div className="admin-table-wrap"><table className="analytics-table"><caption className="admin-visually-hidden">Traffic chart data</caption><thead><tr><th>Date</th>{classes.map(key => <th key={key}>{trafficLabels[key]}</th>)}<th>Actions</th><th>Accepted Create</th><th>Blocked Create</th></tr></thead><tbody>{points.map(point => <tr key={point.day}><td>{point.day}</td>{classes.map(key => <td key={key}>{fmt(point[key])}</td>)}<td>{fmt(point.actions)}</td><td>{fmt(point.accepted)}</td><td>{fmt(point.blocked)}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function AnalyticsPage() {
  const state = useReport(); const { report, busy } = state;
  const [audience, setAudience] = useState<TrafficClass | 'all'>('human');
  const features = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of report?.features ?? []) if (audience === 'all' || item.classification === audience) result.set(item.event, (result.get(item.event) ?? 0) + item.count);
    return [...result].sort((a, b) => b[1] - a[1]);
  }, [report, audience]);
  return <>
    <header className="admin-page-header"><div><p className="admin-eyebrow">Audience & activity</p><h1>Website analytics<span className="admin-heading-dot">.</span></h1><p className="admin-page-lead">Understand your traffic and the things people use.</p></div></header>
    <ReportControls state={state} />
    {report && <div aria-busy={busy} className={busy ? 'analytics-content is-loading' : 'analytics-content'}>
      <div className="analytics-cards">
        {[{ title: 'Likely human visits', value: report.totals.human, icon: Users, hint: 'Estimated document requests' },
          { title: 'Bot traffic', value: report.totals.bot + report.totals.suspected, icon: Bot, hint: `${fmt(report.totals.bot)} verified · ${fmt(report.totals.suspected)} suspected` },
          { title: 'Unclassified', value: report.totals.unknown, icon: Activity, hint: 'Insufficient identification signals' },
          { title: 'Feature interactions', value: report.actions, icon: MousePointer2, hint: `${fmt(report.browserLoads)} interactive browser loads` }].map(({ title, value, icon: Icon, hint }) => <section key={title} className="analytics-metric"><span><Icon aria-hidden="true" />{title}</span><strong>{fmt(value)}</strong><small>{hint}</small></section>)}
      </div>
      <div className="analytics-two-columns"><TrafficChart report={report} /><section className="analytics-panel"><header><div><h2><BarChart3 aria-hidden="true" />Feature usage</h2><p>Ranked by explicit interactions.</p></div></header>
        <label className="analytics-audience">Audience<select value={audience} onChange={event => setAudience(event.target.value as typeof audience)}><option value="all">All traffic</option>{classes.map(key => <option key={key} value={key}>{trafficLabels[key]}</option>)}</select></label>
        {features.length ? <ol className="analytics-ranking">{features.map(([event, count], index) => <li key={event}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{featureLabels[event as keyof typeof featureLabels] ?? event}</strong><i style={{ width: `${count / features[0][1] * 100}%` }} /></div><b>{fmt(count)}</b></li>)}</ol> : <p className="analytics-empty-inline">No feature usage for this audience yet.</p>}
        <p className="analytics-footnote">Counts represent actions, not unique people. Automatic slides are excluded.</p>
      </section></div>
      <section className="analytics-panel"><header><div><h2>Traffic & interaction history</h2><p>Classification and evidence for each recorded event.</p></div><span className="admin-count-badge">{fmt(report.historyCounts.traffic)} events</span></header>
        {report.trafficHistory.length ? <div className="admin-table-wrap"><table className="analytics-table"><thead><tr><th scope="col">Time (UTC+7)</th><th scope="col">Source / event</th><th scope="col">Classification</th><th scope="col">Evidence</th><th scope="col">Score</th><th scope="col">Status</th></tr></thead><tbody>{report.trafficHistory.map(item => <tr key={item.id}><td>{dateTime(item.createdAt)}</td><td>{item.source} / {featureLabels[item.event as keyof typeof featureLabels] ?? item.event}<small>{item.path}</small></td><td><span className="analytics-chip" data-class={item.classification}>{trafficLabels[item.classification]}</span></td><td>{item.reason}</td><td>{item.score ?? '—'}</td><td>{item.status}</td></tr>)}</tbody></table></div> : <p className="analytics-empty-inline">No traffic history in this period.</p>}
        <HistoryPagination label="events" page={state.traffic.page} limit={state.limit} count={report.trafficHistory.length} total={report.historyCounts.traffic} busy={busy} hasNext={Boolean(report.nextTrafficCursor)} onNext={state.traffic.next} onPrevious={state.traffic.previous} onFirst={state.traffic.first} onLimit={state.changeLimit} />
      </section>
      <details className="analytics-notes"><summary>How to read these numbers</summary><p>Human and bot labels are estimates. Cloudflare bot scores and verified-bot signals take priority when available. Without them, User-Agent checks are only heuristics. Visits count document requests rather than image or API downloads. Requests blocked before reaching the Worker are not included here.</p><p>Raw traffic history is retained for 90 days; daily totals remain available for longer comparisons. Browser events can be blocked or forged. Create requests and mail status are available in Orders.</p></details>
    </div>}
  </>;
}
