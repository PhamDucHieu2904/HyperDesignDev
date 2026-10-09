import type { ReactNode, Ref } from "react";
import { Minus, X, type LucideIcon } from "lucide-react";

// Shared chrome for the shell's centered apps; navigation still belongs to HomePage.
export function DesktopWindow({ className, label, icon: Icon, onClose, children, headerRef, inert = false }: {
  className: string; label: string; icon: LucideIcon; onClose: () => void;
  children: ReactNode; headerRef?: Ref<HTMLSpanElement>; inert?: boolean;
}) {
  return <section className={`desktop-app-window ${className}`} role="dialog" aria-label={label} inert={inert}>
    <header className="desktop-app-header">
      <span ref={headerRef} tabIndex={-1}><Icon aria-hidden="true" />{label}</span>
      <div>
        <button type="button" className="icon-button" aria-label={`Minimize ${label}`} title="Return to Desktop" onClick={onClose}>
          <Minus aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" aria-label={`Close ${label}`} title="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
    {children}
  </section>;
}
