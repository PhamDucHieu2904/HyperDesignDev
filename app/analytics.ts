import type { FeatureEvent } from '../shared/contracts/analytics';

// Only event names are sent. No form values, search terms, email, fingerprint,
// persistent visitor ID or query string is collected. Respect Do Not Track.
export function startAnalytics() {
  if (!/^https?:$/.test(window.location.protocol) || navigator.doNotTrack === '1') return () => {};
  const queue: { id: string; event: FeatureEvent }[] = [];
  let timer: number | undefined; let interacted = false;
  const endpoint = new URL('./api/v1/events', document.baseURI).href;
  const flush = () => {
    timer = undefined;
    if (!queue.length) return;
    const events = queue.splice(0, 20);
    void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', keepalive: true, body: JSON.stringify({ events }) }).catch(() => {});
  };
  const track = (event: FeatureEvent) => {
    if (typeof crypto.randomUUID !== 'function') return;
    if (queue.length < 20) queue.push({ id: crypto.randomUUID(), event });
    if (!timer) timer = window.setTimeout(flush, 1000);
  };
  const click = (event: MouseEvent) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    if (!interacted) { interacted = true; track('page.view'); }
    const button = event.target.closest('button,a'); if (!button) return;
    const label = button.getAttribute('aria-label') ?? '';
    if (button.closest('.pf-nav') && button.hasAttribute('data-category')) track('portfolio.category');
    else if (button.matches('.pf-project-card,.pf-feature-open,.pf-index li button')) track('portfolio.project');
    else if (button.closest('.pf-case-next') || label === 'Next project') track('portfolio.next');
    else if (button.closest('.pf-feature-arrows')) track('portfolio.featured');
    else if (button.matches('[data-action="portfolio"]') || /open (Visual|Brand|3D|Game|Web) portfolio/.test(label)) track('portfolio.open');
    else if (button.hasAttribute('data-open-project') && button.getAttribute('aria-pressed') !== 'true'
      || button.closest('.launcher-shell-apps') && /New Project/.test(button.textContent ?? '')) track('create.open');
    else if (button.matches('[data-action="about"]')) track('about.open');
    else if (label === 'Open dashboard') track('dashboard.open');
    else if (label === 'Open launcher') track('launcher.open');
    else if (button.closest('.workspaces') || button.matches('.layout-option')) track('layout.change');
    else if (button.closest('.launcher-shell-apps') && /Terminal/.test(button.textContent ?? '')) track('terminal.open');
    else if (/music/i.test(label)) track('music.open');
  };
  const submit = (event: SubmitEvent) => {
    if (!event.isTrusted || !(event.target instanceof HTMLFormElement) || !event.target.matches('.project-form')) return;
    track(event.target.querySelector('#project-email') ? 'create.submit' : 'create.step');
  };
  let searchTimer: number | undefined;
  const input = (event: Event) => {
    if (!event.isTrusted || !(event.target instanceof Element) || !event.target.matches('.pf-search input')) return;
    window.clearTimeout(searchTimer); searchTimer = window.setTimeout(() => track('portfolio.search'), 1200);
  };
  const hidden = () => { if (document.hidden) flush(); };
  // Observe before React handles the action and changes the form step or removes
  // the clicked element. Otherwise Continue can be counted as a final submission.
  document.addEventListener('click', click, true); document.addEventListener('submit', submit, true);
  document.addEventListener('input', input); document.addEventListener('visibilitychange', hidden);
  return () => {
    window.clearTimeout(timer); window.clearTimeout(searchTimer);
    document.removeEventListener('click', click, true); document.removeEventListener('submit', submit, true);
    document.removeEventListener('input', input); document.removeEventListener('visibilitychange', hidden);
  };
}
