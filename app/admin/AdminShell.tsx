import { Archive, Asterisk, BarChart3, Home, Inbox, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AdminIdentity } from '../../shared/contracts';

export type AdminSection = 'home' | 'library' | 'analytics' | 'orders';
const sections = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: Archive },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'orders', label: 'Orders', icon: Inbox },
] as const;

export function sectionFromHash(): AdminSection {
  const value = window.location.hash.slice(1);
  return sections.find(section => section.id === value)?.id ?? 'home';
}

export function AdminShell({ identity, section, onNavigate, onCreate, children, editor = false }: {
  identity: AdminIdentity | null; section: AdminSection; onNavigate: (section: AdminSection) => void;
  onCreate: () => void; children: ReactNode; editor?: boolean;
}) {
  return <div className="admin-app">
    <a className="admin-skip-link" href="#admin-content">Skip to content</a>
    <header className="admin-topbar">
      <a className="admin-brand" href="#home" onClick={event => { event.preventDefault(); onNavigate('home'); }} aria-label="Hyper D Home">
        <span className="admin-brand-mark"><Asterisk aria-hidden="true" /></span><span><strong>Hyper D²</strong><small>Workspace</small></span>
      </a>
      <nav className="admin-header-nav" aria-label="Admin sections">{sections.map(({ id, label }) =>
        <a key={id} href={`#${id}`} aria-current={section === id ? 'page' : undefined} onClick={event => { event.preventDefault(); onNavigate(id); }}>{label}</a>)}</nav>
      <div className="admin-identity"><span className="admin-session-label">Admin workspace</span><span className="admin-identity-avatar" title={identity?.email}>{identity?.email.slice(0, 1).toUpperCase() ?? 'H'}</span></div>
    </header>
    <div className="admin-shell-body"><aside className="admin-rail" aria-label="Workspace shortcuts">
      {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-label={`Open ${label}`} title={label} aria-current={section === id ? 'page' : undefined} onClick={() => onNavigate(id)}><Icon aria-hidden="true" /></button>)}
      <span className="admin-rail-divider" /><button type="button" onClick={onCreate} aria-label="Add project" title="Add project"><Plus aria-hidden="true" /></button>
      <span className="admin-rail-bottom" aria-hidden="true">H²</span>
    </aside><main id="admin-content" tabIndex={-1} className={`admin-main ${editor ? 'admin-main-editor' : ''}`}>{children}</main></div>
  </div>;
}
