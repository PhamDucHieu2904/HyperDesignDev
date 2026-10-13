import { useEffect, useRef, useState } from 'react';
type Turnstile = { render(element: HTMLElement, options: Record<string, unknown>): string; remove(id: string): void };
declare global { interface Window { turnstile?: Turnstile } }
let loader: Promise<void> | undefined;
function load() {
  if (window.turnstile) return Promise.resolve();
  if (!loader) loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true; script.onload = () => resolve(); script.onerror = () => { loader = undefined; reject(new Error()); };
    document.head.append(script);
  });
  return loader;
}
export function Verification({ siteKey, reset, onToken }: { siteKey: string; reset: number; onToken: (value: string) => void }) {
  const ref = useRef<HTMLDivElement>(null); const [error, setError] = useState(false);
  useEffect(() => {
    let active = true; let widget: string | undefined; setError(false);
    void load().then(() => {
      if (!active || !ref.current || !window.turnstile) return;
      widget = window.turnstile.render(ref.current, { sitekey: siteKey, action: 'create', theme: 'auto', size: 'flexible',
        callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => { onToken(''); setError(true); } });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (widget) window.turnstile?.remove(widget); };
  }, [siteKey, reset, onToken]);
  return <div className="project-verification"><div ref={ref} />{error && <p role="alert">Verification could not load. Check your connection and try again.</p>}</div>;
}
