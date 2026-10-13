import { Archive, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleAlert, Clock3, FilePlus2, Inbox, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { categoryDefinitions, reportingDay, type AdminMediaAsset, type AdminProjectSummary } from '../../shared/contracts';
import { listAdminMedia, listAdminProjects } from './repository';
import { formatNumber as fmt, useReport } from './Reporting';
import type { AdminSection } from './AdminShell';

export function HomePage({ onNavigate, onCreate, onOpen }: {
  onNavigate: (section: AdminSection) => void; onCreate: () => void; onOpen: (project: AdminProjectSummary) => void;
}) {
  const state = useReport();
  const [projects, setProjects] = useState<AdminProjectSummary[]>([]); const [media, setMedia] = useState<AdminMediaAsset[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.all([listAdminProjects(), listAdminMedia()]).then(([items, assets]) => { if (active) { setProjects(items); setMedia(assets); } })
      .catch(next => { if (active) setError(next instanceof Error ? next.message : 'Workspace could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const published = projects.filter(project => project.publicRevisionId).length;
  const currentPublished = projects.filter(project => project.state === 'published').length;
  const drafts = projects.filter(project => project.state === 'draft').length;
  const changed = projects.filter(project => project.state === 'unpublished-changes').length;
  const featured = projects.find(project => project.metadata.isFeatured) ?? projects[0];
  const artwork = media.find(asset => asset.id === featured?.metadata.thumbnailAssetId && asset.state === 'ready');
  const date = new Date(`${state.date}T00:00:00Z`); const year = date.getUTCFullYear(); const month = date.getUTCMonth();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const selectedUpdates = projects.filter(project => reportingDay(new Date(project.updatedAt)) === state.date).length;
  const updatedDays = useMemo(() => new Set(projects.map(project => reportingDay(new Date(project.updatedAt)))), [projects]);
  const moveMonth = (step: number) => state.changeDate(new Date(Date.UTC(year, month + step, 1)).toISOString().slice(0, 10));
  const monthLabel = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthly = state.report?.requests;
  return <>
    <header className="admin-page-header"><div><p className="admin-eyebrow">Your creative workspace</p><h1>Workspace overview<span className="admin-heading-dot">.</span></h1><p className="admin-page-lead">A little clarity. More room to create.</p></div><button type="button" className="admin-button admin-button-primary" onClick={onCreate}><Plus aria-hidden="true" />New project</button></header>
    {(error || state.error) && <div className="admin-alert admin-alert-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error || state.error}</span><button type="button" className="admin-button admin-button-quiet" onClick={() => { setReload(value => value + 1); state.refresh(); }}>Retry</button></div>}
    <div className="admin-home-metrics" aria-busy={loading || state.busy}>
      {[{ label: 'Projects in library', value: loading || error ? '—' : fmt(projects.length), note: `${published} published`, icon: Archive },
        { label: 'Likely human visits', value: state.report ? fmt(state.report.totals.human) : '—', note: `Estimated visits · ${monthLabel}`, icon: BarChart3 },
        { label: 'Project requests', value: monthly ? fmt(monthly.accepted) : '—', note: `Received · ${monthLabel}`, icon: Inbox }].map(({ label, value, note, icon: Icon }) => <section key={label}><span className="admin-metric-icon"><Icon aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></section>)}
      <button type="button" className="admin-icon-button" aria-label="Refresh overview" disabled={loading || state.busy} onClick={() => { setReload(value => value + 1); state.refresh(); }}><RefreshCw className={loading || state.busy ? 'admin-spin' : ''} aria-hidden="true" /></button>
    </div>
    <div className="admin-home-grid">
      <section className="admin-home-panel admin-calendar"><header><h2>Workspace calendar</h2><Clock3 aria-hidden="true" /></header><div className="admin-calendar-month"><button type="button" className="admin-icon-button" aria-label="Previous month" disabled={year === 2020 && month === 0} onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" /></button><strong>{monthLabel}</strong><button type="button" className="admin-icon-button" aria-label="Next month" disabled={year === 2100 && month === 11} onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" /></button></div>
        <div className="admin-calendar-week" aria-hidden="true">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}</div>
        <div className="admin-calendar-days">{Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`; return <button key={value} type="button" aria-label={`${value}${updatedDays.has(value) ? ', project updated' : ''}`} aria-pressed={state.date === value} data-updated={updatedDays.has(value)} onClick={() => state.changeDate(value)}>{index + 1}</button>; })}</div><p>{loading ? 'Loading activity…' : `${selectedUpdates} ${selectedUpdates === 1 ? 'project edited' : 'projects edited'} on ${state.date}`} · UTC+7</p>
      </section>
      <section className="admin-home-panel admin-pipeline"><header><h2>Publication pipeline</h2><button type="button" className="admin-icon-button" aria-label="Open publication library" onClick={() => onNavigate('library')}><ArrowUpRight aria-hidden="true" /></button></header><strong className="admin-pipeline-total">{loading || error ? '—' : fmt(projects.length)} <span>projects</span></strong><p>From first draft to the public portfolio.</p>
        <div className="admin-pipeline-step"><span>Published & up to date<strong>{loading || error ? '—' : currentPublished}</strong></span><ArrowUpRight aria-hidden="true" /></div><div className="admin-pipeline-step is-lime"><span>Drafts in progress<strong>{loading || error ? '—' : drafts}</strong></span><FilePlus2 aria-hidden="true" /></div><div className="admin-pipeline-step is-dark"><span>Changes waiting to publish<strong>{loading || error ? '—' : changed}</strong></span><Archive aria-hidden="true" /></div>
      </section>
      <section className="admin-home-spotlight">{artwork ? <img src={artwork.contentUrl} alt={featured.metadata.title} /> : <div className="admin-spotlight-placeholder"><Archive aria-hidden="true" /></div>}<span className="admin-spotlight-label">Project spotlight</span><div><span>{categoryDefinitions.find(category => category.id === featured?.metadata.categoryId)?.label ?? 'Your next idea'}</span><h2>{featured?.metadata.title ?? 'Make something great.'}</h2><button type="button" className="admin-button" onClick={() => featured ? onOpen(featured) : onCreate}>{featured ? 'Open project' : 'Create project'}<ArrowUpRight aria-hidden="true" /></button></div></section>
      <section className="admin-home-panel admin-recent"><header><div><h2>Recently edited</h2><p>Pick up where you left off.</p></div><button type="button" className="admin-icon-button" aria-label="View all projects" onClick={() => onNavigate('library')}><ArrowUpRight aria-hidden="true" /></button></header>
        <div className="admin-recent-grid">{projects.slice(0, 4).map((project, index) => <button type="button" key={project.id} className={index === 0 ? 'is-lime' : ''} onClick={() => onOpen(project)}><span>{new Date(project.updatedAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' })}</span><strong>{project.metadata.title}</strong><small>{project.state === 'published' ? 'Published' : project.state === 'draft' ? 'Draft' : 'Unpublished changes'}</small><ArrowUpRight aria-hidden="true" /></button>)}</div>
        {!projects.length && <p className="analytics-empty-inline">{loading ? 'Loading your projects…' : error ? 'Library unavailable. Use Retry to load it.' : 'Your first project starts here.'}</p>}
      </section>
      <section className="admin-home-panel admin-home-inbox"><header><h2>Request inbox</h2><button type="button" className="admin-icon-button" aria-label="Open request inbox" onClick={() => onNavigate('orders')}><ArrowUpRight aria-hidden="true" /></button></header><dl><div><dt>Accepted requests</dt><dd>{monthly ? fmt(monthly.accepted) : '—'}</dd></div><div><dt>Pending mail</dt><dd>{monthly ? fmt(monthly.pending) : '—'}</dd></div><div><dt>Mail needs review</dt><dd>{monthly ? fmt(monthly.failed) : '—'}</dd></div></dl><button type="button" className="admin-button admin-button-primary" onClick={() => onNavigate('orders')}>Manage requests<ArrowUpRight aria-hidden="true" /></button></section>
    </div>
  </>;
}
