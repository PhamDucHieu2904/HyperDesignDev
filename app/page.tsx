import {
  BadgeCheck, Bot, Box, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Code2, Command,
  Folder, Gamepad2, Feather, Leaf, Grid2X2, Frame, Image as ImageIcon, LogOut, MapPin, PenTool,
  Moon, Music2, Power, RefreshCw, FilePlus2,
  Sparkles, Square, Terminal, TimerReset,
  X, type LucideIcon, type LucideProps,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { PortfolioScene } from "./portfolio-scenes";
import { PortfolioApp } from "./portfolio/PortfolioApp";
import type { Filter } from "./portfolio/types";
import { DesktopWindow } from "./desktop/DesktopWindow";
import { DesktopViewport } from "./desktop/DesktopViewport";
import { ProjectLauncher } from "./project-launcher/ProjectLauncher";

type View = "desktop" | "about" | "portfolio" | "terminal" | "files" | "new-project";
type Overlay = "dashboard" | "launcher" | "session" | null;

const layouts = [
  { id: 2, theme: "graphite", name: "Graphite", detail: "Charcoal · copper", icon: Moon },
  { id: 3, theme: "blueprint", name: "Blueprint", detail: "Android · 3D / AI", icon: Grid2X2 },
  { id: 4, theme: "sage", name: "Sage", detail: "Packaging · image · motion", icon: Leaf },
  { id: 5, theme: "gallery", name: "Code Lab", detail: "App · web · game · AI", icon: Frame },
  { id: 1, theme: "paper", name: "Paper", detail: "Original · warm parchment", icon: Feather },
];
const layoutStorageKey = "hyperd-layout";

const profileFacts = [
  { label: "Full name", value: "Pham Duc Hieu" },
  { label: "Base", value: "Ho Chi Minh City, Vietnam" },
  { label: "Class", value: "Graphic Designer / UI-UX Engineer / Web & Game Developer" },
];

const profileMetrics = [
  { value: "2022", label: "started shipping" },
  { value: "3D", label: "product systems" },
  { value: "AI", label: "workflow lead" },
];

const experienceRecords = [
  {
    period: "2022 - 2023",
    company: "Lucky Tech",
    role: "Junior Game Developer",
    detail: "Built inside a blockchain game ecosystem and contributed to Space Hunter, an NFT-based game project.",
  },
  {
    period: "2023 - Present",
    company: "Nam Viet Group",
    role: "Head of Design & Technology Lead",
    detail: "Directed packaging, labels and promotional systems for an F&B export corporation, then expanded the design department with internal tools, AI workflows and training protocols.",
  },
];

const capabilityGroups = [
  { title: "Commercial packaging", copy: "Labels, dielines, mockups, product campaigns and export-ready visual systems." },
  { title: "3D product environment", copy: "Realistic packaging scenes, booth visualization, Unity rendering and product presentation tools." },
  { title: "Internal applications", copy: "Web, desktop and game interfaces that turn repeated team work into faster workflows." },
  { title: "Automation & database", copy: "Clean data flow, searchable assets, versioned content and AI-supported operation pipelines." },
];

const stackGroups = [
  ["Design Lab", "Photoshop", "Illustrator", "Blender", "Packaging", "Retouch"],
  ["Dev Portal", "Unity", "C#", "JavaScript", "React", "TypeScript"],
  ["AI Skilled", "GPT/Codex", "Gemini", "Claude", "Automation", "Systems"],
];

function IconButton({ label, icon: Icon, onClick, active = false, className = "", disabled = false }: {
  label: string; icon: LucideIcon; onClick?: () => void; active?: boolean; className?: string; disabled?: boolean;
}) {
  return <button type="button" className={`icon-button ${active ? "active" : ""} ${className}`}
    aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon aria-hidden="true" /></button>;
}

function DSquaredMark() {
  return <svg className="arch-mark-logo" viewBox="0 0 281.31 187.04" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M181.21 79.3l-7.12-11.15 13.71-33.23 12-8.28h-8.6l1.68-4.1c-.74-.05-1.49-.07-2.25-.07H69.48c-4.39 0-9.45 3.64-11.17 8.07-22.8 58.83-36.7 94.56-45.17 116.39C-.21 181.33-.06 181.22 0 182.6a4.33 4.33 0 0 0 2.31 3.77c.78.4.88.58 10 .64 12.52.09 42.09 0 114 0 21.87 0 46.56-17.81 55-39.68l26.36-68Zm-16.59-9.77L137.7 139c-1.71 4.4-6.59 8-11.06 8H60l33.32-86h66c4.68 0 7.11 3.86 5.3 8.53Z" />
    <path fill="currentColor" d="M216.09 52.66h46.71l-9.25 22.58h-70.12l-4.78-7.5 12.44-30.17 10.85-7.49h38.94l3.09-7.5h-46.72L206.51 0h70.11l4.69 7.5-12.33 30.07-10.87 7.59h-38.94l-3.08 7.5Z" />
    <path fill="currentColor" d="m104.7 114.9-20.23-9.23.92-5.81 23.15-9.24-1.1 6.95-14 5.21 12.35 5.22-1.09 6.9Zm13.3-26.96h4l-11.73 29.67h-3.92L118 87.94Zm2.77 20.06 14-5.21-12.35-5.21 1.1-6.95 20.22 9.24-.92 5.81-23.15 9.23 1.1-6.91Z" />
  </svg>;
}

const DesignForgeMark: LucideIcon = forwardRef<SVGSVGElement, LucideProps>(function DesignForgeMark(props, ref) {
  return <svg {...props} ref={ref} className="design-forge-mark" viewBox="0 0 113.52 81.74" aria-hidden="true" focusable="false">
    <path className="design-forge-mark-main" d="M84.18 34.11V20.72h29.34V.11H63.69V13.8a41.56 41.56 0 0 1 6.21 10 42.56 42.56 0 0 1-.12 34.08 44.21 44.21 0 0 1-6.09 10v13.74h20.49V56.47a17.77 17.77 0 0 1 7-1 18.49 18.49 0 0 1 11.65 4V36.68a48.46 48.46 0 0 0-11.18-1.75c-1.51 0-2.91.12-4.31.23a30.27 30.27 0 0 0-3.26.47c-.81.23-1.74.46-2.91.81s-1.86.58-1.86.58a13.78 13.78 0 0 1 2.44-1.74 11.26 11.26 0 0 1 2.43-1.17Z" />
    <path className="design-forge-mark-main" d="M18.63 81.62H0V.12h17.82V0H28a42.92 42.92 0 0 1 16.3 3.14 46 46 0 0 1 13.62 8.62A40.1 40.1 0 0 1 67.3 24.92a39.15 39.15 0 0 1 3.26 15.95 38.73 38.73 0 0 1-3.37 15.84A42.32 42.32 0 0 1 57.87 70 41.65 41.65 0 0 1 44.25 78.6 42.92 42.92 0 0 1 28 81.74h-9.37Zm2-21.89a21.42 21.42 0 0 1-5-.11 11.92 11.92 0 0 0 5.82 1.63H28a22.37 22.37 0 0 0 15.83-6.17A18.87 18.87 0 0 0 50 40.87a18.78 18.78 0 0 0-6.17-14.09A22.19 22.19 0 0 0 28 20.61h-7.39Z" />
    <circle className="design-forge-mark-accent" cx="104.81" cy="73.03" r="8.71" />
  </svg>;
});

function LeftRail({ now, workspace, setWorkspace, view, overlay, openView, openPortfolio, toggleOverlay }: {
  now: Date | null; workspace: number; setWorkspace: (workspace: number) => void; view: View;
  overlay: Overlay; openView: (view: View) => void; openPortfolio: (category: Filter) => void;
  toggleOverlay: (overlay: Exclude<Overlay, null>) => void;
}) {
  const layoutPickerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startId: number; previewId: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [previewLayout, setPreviewLayout] = useState<number | null>(null);
  const [isLayoutDragging, setIsLayoutDragging] = useState(false);
  const layoutAtPoint = (clientX: number, clientY: number) => {
    const target = document.elementFromPoint(clientX, clientY)?.closest<HTMLButtonElement>(".layout-option");
    if (!target || !layoutPickerRef.current?.contains(target)) return null;
    const id = Number(target.dataset.layoutId);
    return layouts.some(layout => layout.id === id) ? id : null;
  };
  const finishLayoutDrag = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (cancelled && drag.moved) setWorkspace(drag.startId);
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setIsLayoutDragging(false);
    setPreviewLayout(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <aside className="rail" aria-label="Caelestia bar">
    <button type="button" className="arch-mark" aria-label="Open launcher" onClick={() => toggleOverlay("launcher")}>
      <DSquaredMark />
    </button>
    <IconButton label="Open dashboard" icon={Moon} className="dashboard-toggle" active={overlay === "dashboard"} onClick={() => toggleOverlay("dashboard")} />
    <div className="workspaces">
      <div ref={layoutPickerRef} className="layout-picker" role="group" aria-label="Website layouts; drag to switch"
        data-dragging={isLayoutDragging ? "true" : undefined}>
        {layouts.map(({ id, name, detail, icon: Icon }) => <button type="button"
          className="layout-option" key={id} data-layout-id={id} data-preview={previewLayout === id ? "true" : undefined}
          aria-label={`${name} layout`} aria-pressed={workspace === id}
          onClick={(event) => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              // A captured pointer can still synthesize a click on the origin
              // button after release. Clear its focus so its tooltip cannot
              // remain visible after the live drag has switched layouts.
              event.currentTarget.blur();
              return;
            }
            setWorkspace(id);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startId: workspace, previewId: id, moved: false };
            setPreviewLayout(id);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
            if (distance > 8 && !drag.moved) {
              drag.moved = true;
              setIsLayoutDragging(true);
              (document.activeElement as HTMLElement | null)?.blur?.();
            }
            if (!drag.moved) return;
            const nextId = layoutAtPoint(event.clientX, event.clientY);
            if (nextId === null || nextId === drag.previewId) return;
            // Pointer capture keeps the original button as the event target. Blur it
            // as soon as the drag enters another layout so its focus styling cannot
            // leave a stale highlight behind the live-selected button.
            event.currentTarget.blur();
            drag.previewId = nextId;
            setPreviewLayout(nextId);
            setWorkspace(nextId);
          }}
          onPointerUp={(event) => finishLayoutDrag(event)}
          onPointerCancel={(event) => finishLayoutDrag(event, true)}
          onKeyDown={(event) => {
            const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
            if (!offset && event.key !== "Home" && event.key !== "End") return;
            event.preventDefault();
            const index = event.key === "Home" ? 0 : event.key === "End" ? layouts.length - 1
              : (layouts.findIndex(layout => layout.id === id) + offset + layouts.length) % layouts.length;
            setWorkspace(layouts[index].id);
            (event.currentTarget.parentElement?.children[index] as HTMLButtonElement)?.focus();
          }}>
          <span className="layout-orb"><Icon aria-hidden="true" /></span>
          <span className="layout-tooltip" aria-hidden="true"><strong>{name}</strong><small>{detail}</small></span>
        </button>)}
      </div>
    </div>
    <div className="rail-center">
      <button type="button" className="rail-new-project" data-open-project
        aria-label={view === "new-project" ? "Minimize new project" : "Create a new project"}
        title={view === "new-project" ? "New project" : "Create"}
        aria-pressed={view === "new-project"} onClick={() => openView(view === "new-project" ? "desktop" : "new-project")}>
        {view === "new-project" ? <FilePlus2 aria-hidden="true" /> : <Square aria-hidden="true" />}
        <span>{view === "new-project" ? "New project" : "Create"}</span>
      </button>
    </div>
    <div className="rail-bottom">
      <div className="rail-shortcuts" role="group" aria-label="Portfolio shortcuts">
      <IconButton label="Adobe Photoshop — open Visual portfolio" icon={ImageIcon} className="rail-shortcut" onClick={() => openPortfolio("photoshop")} />
      <IconButton label="Adobe Illustrator — open Brand portfolio" icon={PenTool} className="rail-shortcut" onClick={() => openPortfolio("illustrator")} />
      <IconButton label="Blender — open 3D portfolio" icon={Box} className="rail-shortcut" onClick={() => openPortfolio("blender")} />
      <span className="rail-music-accent" aria-hidden="true"><Music2 /></span>
      <div className="rail-calendar" aria-label={now ? `Today: ${now.toLocaleDateString("en-GB")}` : "Loading date"}>
        <CalendarDays aria-hidden="true" />
        <time dateTime={now ? now.toISOString().slice(0, 10) : undefined}>
          <span>{now ? String(now.getMonth() + 1).padStart(2, "0") : "--"}</span>
          <span>{now ? String(now.getDate()).padStart(2, "0") : "--"}</span>
        </time>
      </div>
      <IconButton label="Unity — open Game portfolio" icon={Gamepad2} className="rail-shortcut" onClick={() => openPortfolio("game")} />
      <IconButton label="Visual Studio Code — open Web portfolio" icon={Code2} className="rail-shortcut" onClick={() => openPortfolio("web")} />
      <IconButton label="Codex — coming soon" icon={Bot} className="rail-shortcut rail-shortcut-pending" disabled />
      </div>
      <IconButton label="Power menu" icon={Power} className="power" active={overlay === "session"} onClick={() => toggleOverlay("session")} />
    </div>
  </aside>;
}

function DesktopWallpaper({ workspace, active }: { workspace: number; active: boolean }) {
  const wallpaperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wallpaper = wallpaperRef.current;
    const surface = wallpaper?.parentElement;
    if (!wallpaper || !surface || typeof window.matchMedia !== "function") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    let frame = 0;
    let x = 0;
    let y = 0;
    let lightX = 28;
    let lightY = 42;
    let targetX = 0;
    let targetY = 0;
    let targetLightX = 28;
    let targetLightY = 42;
    let bounds = surface.getBoundingClientRect();

    const render = () => {
      x += (targetX - x) * .14;
      y += (targetY - y) * .14;
      lightX += (targetLightX - lightX) * .11;
      lightY += (targetLightY - lightY) * .11;
      wallpaper.style.setProperty("--parallax-x", `${x.toFixed(2)}px`);
      wallpaper.style.setProperty("--parallax-y", `${y.toFixed(2)}px`);
      wallpaper.style.setProperty("--light-x", `${lightX.toFixed(2)}%`);
      wallpaper.style.setProperty("--light-y", `${lightY.toFixed(2)}%`);

      const settled = Math.abs(targetX - x) < .02 && Math.abs(targetY - y) < .02
        && Math.abs(targetLightX - lightX) < .05 && Math.abs(targetLightY - lightY) < .05;
      if (settled) {
        frame = 0;
        wallpaper.classList.remove("is-reactive");
        return;
      }
      frame = window.requestAnimationFrame(render);
    };
    const queueRender = () => {
      wallpaper.classList.add("is-reactive");
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    const resetMotion = () => {
      targetX = 0;
      targetY = 0;
      targetLightX = 28;
      targetLightY = 42;
      queueRender();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!active || reducedMotion.matches || !finePointer.matches) return;
      const pointerX = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const pointerY = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      targetX = (0.5 - pointerX) * 8;
      targetY = (0.5 - pointerY) * 6;
      targetLightX = Math.min(58, Math.max(12, pointerX * 68));
      targetLightY = Math.min(88, Math.max(12, pointerY * 100));
      queueRender();
    };
    const updateBounds = () => { bounds = surface.getBoundingClientRect(); };
    const onPreferenceChange = () => {
      if (reducedMotion.matches || !finePointer.matches) resetMotion();
    };

    surface.addEventListener("pointermove", onPointerMove, { passive: true });
    surface.addEventListener("pointerenter", updateBounds, { passive: true });
    surface.addEventListener("pointerleave", resetMotion);
    window.addEventListener("resize", updateBounds, { passive: true });
    reducedMotion.addEventListener("change", onPreferenceChange);
    finePointer.addEventListener("change", onPreferenceChange);
    return () => {
      surface.removeEventListener("pointermove", onPointerMove);
      surface.removeEventListener("pointerenter", updateBounds);
      surface.removeEventListener("pointerleave", resetMotion);
      window.removeEventListener("resize", updateBounds);
      reducedMotion.removeEventListener("change", onPreferenceChange);
      finePointer.removeEventListener("change", onPreferenceChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active]);

  return <div ref={wallpaperRef} className={`wallpaper workspace-${workspace}`} data-paused={!active || undefined} inert={!active}>
    <div className="wallpaper-motion">
      {(workspace === 1 || workspace === 2) && <img
        src="./public/hieu-wallpaper.png"
        alt="Hieu Pham monochrome ink-wash portrait"
        fetchPriority="high"
      />}
    </div>
    <div className="paper-light" />
    <div className="layout-texture" aria-hidden="true" />
    <PortfolioScene workspace={workspace === 3 && !active ? 0 : workspace} />
  </div>;
}

function PortfolioIntro({ onOpenAbout, onOpenPortfolio }: { onOpenAbout: () => void; onOpenPortfolio: () => void }) {
  return <section className="portfolio-intro" aria-labelledby="portfolio-title">
    <img
      className="portfolio-logo"
      src="./public/hyperd-logo.svg"
      alt="HyperD Squared — HyperDsquared.com"
      width={743}
      height={147}
    />
    <div className="portfolio-copy">
    <h1 id="portfolio-title">Hieu Pham - Designer x Developer</h1>
    <p className="portfolio-manifesto">I don’t just design ideas. I engineer how they work.</p>
    <p className="portfolio-summary">Where a Developer's logic meets a Designer's aesthetic. From high-end commercial packaging and realistic 3D environments to automated workflows and seamless database systems. Beautiful on the surface, robust under the hood.</p>
    <nav className="portfolio-actions" aria-label="Portfolio navigation">
      <button type="button" className="portfolio-action" data-action="about" onClick={onOpenAbout}>
        <span className="portfolio-index" aria-hidden="true">01</span><span className="portfolio-action-label">About Hyper D²</span>
      </button>
      <button type="button" className="portfolio-action" data-action="portfolio" onClick={onOpenPortfolio}>
        <span className="portfolio-index" aria-hidden="true">02</span><span className="portfolio-action-label">Portfolio</span>
      </button>
    </nav>
    </div>
  </section>;
}

function AboutPage({ onClose }: { onClose: () => void }) {
  return <section className="about-page" aria-labelledby="about-title">
    <div className="about-toolbar">
    <button type="button" className="about-close" onClick={onClose} aria-label="Close CV" title="Close CV">
      <X aria-hidden="true" />
    </button>
    </div>

    <div className="about-scroll">
    <section className="about-hero" aria-label="CV identity">
      <figure className="about-profile-card">
        <div className="about-portrait-frame">
          <img className="about-portrait-logo" src="./public/hyperd-logo.svg" alt="" aria-hidden="true" width={743} height={147} />
          <img className="about-avatar" src="./public/hieu-about-avatar.webp" alt="Pham Duc Hieu portrait" width={1157} height={1359} />
        </div>
      </figure>
      <header className="about-header">
        <h1 id="about-title">Pham Duc Hieu</h1>
        <p className="about-role">Designer x Developer</p>
        <p className="about-lead">A hybrid designer and developer building practical visual systems: commercial packaging, 3D product presentation, internal apps, game workflows, databases and AI-assisted operations.</p>
        <div className="about-id-strip" aria-label="Profile facts">
          {profileFacts.map((fact) => <p key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></p>)}
        </div>
        <div className="about-metrics" aria-label="Profile highlights">
          {profileMetrics.map((metric) => <span key={metric.label}><strong>{metric.value}</strong><small>{metric.label}</small></span>)}
        </div>
      </header>
    </section>

    <section className="about-content" aria-label="CV details">
      <section className="about-panel about-experience">
        <div className="about-panel-title"><BriefcaseBusiness aria-hidden="true" /><h2>Experience Record</h2></div>
        <div className="about-records">
          {experienceRecords.map((record) => <article key={record.company} className="about-job">
            <span>{record.period}</span>
            <h3>{record.company}</h3>
            <strong>{record.role}</strong>
            <p>{record.detail}</p>
          </article>)}
        </div>
      </section>

      <section className="about-panel about-capabilities">
        <div className="about-panel-title"><Sparkles aria-hidden="true" /><h2>What I Build</h2></div>
        <div className="about-capability-grid">
          {capabilityGroups.map((capability) => <article key={capability.title}>
            <h3>{capability.title}</h3>
            <p>{capability.copy}</p>
          </article>)}
        </div>
      </section>

      <aside className="about-side">
        <section className="about-panel about-directive">
          <div className="about-panel-title"><BadgeCheck aria-hidden="true" /><h2>Core Directive</h2></div>
          <p>Innovate, iterate and create. Make the surface beautiful, then engineer the system so it stays reliable.</p>
          <div className="about-signal-row">
            <span><MapPin aria-hidden="true" />Ho Chi Minh City</span>
            <span><Code2 aria-hidden="true" />Design systems + software</span>
          </div>
        </section>

        <section className="about-panel about-stack">
          <div className="about-panel-title"><Frame aria-hidden="true" /><h2>Core Stack</h2></div>
          <div className="about-stack-groups">
            {stackGroups.map(([group, ...items]) => <div key={group} className="about-stack-row">
              <strong>{group}</strong>
              <div>{items.map((item) => <span key={item}>{item}</span>)}</div>
            </div>)}
          </div>
        </section>
      </aside>
    </section>

    </div>
  </section>;
}

function TerminalApp({ onClose }: { onClose: () => void }) {
  return <DesktopWindow className="terminal-window" label="Terminal" icon={Terminal} onClose={onClose}>
    <div className="terminal-body"><pre aria-label="Caelestia terminal banner">{`   ______          __          __  _
  / ____/___ _____/ /__  _____/ /_(_)___ _
 / /   / __ \`/ __  / _ \\/ ___/ __/ / __ \`/
/ /___/ /_/ / /_/ /  __(__  ) /_/ / /_/ /
\\____/\\__,_/\\__,_/\\___/____/\\__/_/\\__,_/  `}</pre>
      <p><span>hieu@caelestia</span> portfolio shell</p>
      <p className="terminal-muted">A faithful web translation of the original QML desktop.</p><p><b>❯</b><i className="cursor" /></p>
    </div>
  </DesktopWindow>;
}

function FilesApp({ onClose }: { onClose: () => void }) {
  const files = [["Portfolio", "12 items", true], ["Projects", "8 items", true], ["Resume.pdf", "842 KB", false], ["Notes.md", "24 KB", false]];
  return <section className="files-window" aria-label="Files window"><header><div>
    <IconButton label="Back" icon={ChevronLeft} /><IconButton label="Forward" icon={ChevronRight} /></div>
    <span>Home / hieu</span><IconButton label="Close files" icon={X} onClick={onClose} /></header>
    <div className="files-body">{files.map(([name, size, folder]) => <button type="button" key={String(name)}>
      {folder ? <Folder /> : <Square />}<strong>{name}</strong><small>{size}</small></button>)}</div>
  </section>;
}

function SessionDrawer({ close, closing }: { close: () => void; closing: boolean }) {
  return <><button type="button" className={`scrim ${closing ? "closing" : ""}`} aria-label="Close power menu" onClick={close} />
    <section className={`session-drawer ${closing ? "closing" : ""}`} aria-label="Power menu">
      <IconButton label="Log out" icon={LogOut} className="focused" /><IconButton label="Shut down" icon={Power} />
      <span className="session-gif"><img src="./public/bongocat.gif" alt="Animated shell companion" width={66} height={66} /></span>
      <IconButton label="Hibernate" icon={TimerReset} /><IconButton label="Restart" icon={RefreshCw} />
    </section></>;
}

function DashboardDrawer({ now, close, closing }: { now: Date; close: () => void; closing: boolean }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => now.getDate() - 3 + i), [now]);
  return <section className={`dashboard-drawer ${closing ? "closing" : ""}`} aria-label="Dashboard"><header><div><small>Good evening, Hieu</small>
    <strong>{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</strong></div>
    <IconButton label="Close dashboard" icon={X} onClick={close} /></header>
    <div className="dash-grid">
      <article className="weather-card"><Moon /><span><strong>27°</strong><small>Clear night</small></span><em>Ho Chi Minh City</em></article>
      <article className="calendar-card"><header><CalendarDays /><strong>{now.toLocaleString("en", { month: "long" })}</strong></header>
        <div>{days.map(day => <span className={day === now.getDate() ? "today" : ""} key={day}>{day}</span>)}</div></article>
      <article className="system-card"><span><b>CPU</b><i><em style={{ width: "42%" }} /></i><small>42%</small></span>
        <span><b>RAM</b><i><em style={{ width: "61%" }} /></i><small>61%</small></span></article>
    </div>
  </section>;
}

const tamAnTuEmblemMarkup = `
<g id="Layer_2" data-name="Layer 2">
<g id="Layer_1-2" data-name="Layer 1">
<path class="tam-an-tu-mark-shape" d="M260.92,78.12a3.72,3.72,0,0,0-5.84-4.44c-13.75,13.09-44,35.81-100.24,61.42C121.54,150.25,91.4,158.64,67,159.17c-31.36.68-53.32-10.29-61.29-22.53-.38-.58-1.39-3-.34-2.9,1.76.27,7.2,8.15,11.58,8.16,2.68,0-6.32-7.29-13.57-15.19-4.29-4.66-5.26,6.06,1.64,15.83S40.3,185,119.31,168C185.38,153.68,244.93,107.81,260.92,78.12Z"/>
<path class="tam-an-tu-mark-shape" d="M271.12,86.81s-24.56,45.61-104.37,79.36-133.21,8-133.21,8a82.62,82.62,0,0,0,36.14,17.6c22,4.56,35.29,2.87,38.56,24.91v202S109,435,84.87,438.53v2.68h84.86v-2.93s-22,.05-23.92-21.69V216.19S144,199.12,165.27,193,266.51,154.36,271.12,86.81Z"/>
<path class="tam-an-tu-mark-shape" d="M287.94,78.12a3.72,3.72,0,0,1,5.84-4.44c13.75,13.09,44,35.81,100.24,61.42,33.3,15.15,63.44,23.54,87.84,24.07,31.37.68,53.32-10.29,61.29-22.53.38-.58,1.39-3,.34-2.9-1.76.27-7.19,8.15-11.58,8.16-2.67,0,6.32-7.29,13.57-15.19,4.29-4.66,5.26,6.06-1.63,15.83S508.56,185,429.55,168C363.48,153.68,303.93,107.81,287.94,78.12Z"/>
<path class="tam-an-tu-mark-shape" d="M277.74,86.81s24.57,45.61,104.37,79.36,133.21,8,133.21,8a82.62,82.62,0,0,1-36.14,17.6c-22,4.56-35.29,2.87-38.56,24.91v202S439.87,435,464,438.53v2.68H379.13v-2.93s22,.05,23.92-21.69V216.19s1.84-17.07-19.45-23.17S282.35,154.36,277.74,86.81Z"/>
<path class="tam-an-tu-mark-shape" d="M274.3,0l-5.08,29.8,1.08.68V32.2a10.79,10.79,0,0,1-6.18,5.38c-4.35,1.34,3,7.22,3,7.22h14.37s7.15-5.73,2.68-7.18a8.79,8.79,0,0,1-5.62-5.47V30.32l1-.59Z"/>
<polygon class="tam-an-tu-mark-shape" points="267.18 47.15 281.25 47.15 283.59 50.87 264.76 50.87 267.18 47.15"/>
<path class="tam-an-tu-mark-shape" d="M274.55,53.11s10-.19,13.3.5,10.87,7.89-6,11.66-25.61-3.3-25.61-6.09,2-5.67,8.53-5.77S274.55,53.11,274.55,53.11Z"/>
<path class="tam-an-tu-mark-shape" d="M274.47,211.62c-8.58,6.72-18.26,9.61-29.11,8.25a37.6,37.6,0,0,1-22.8-11.66A38.13,38.13,0,0,1,260.31,190c0-.16,0-.26-.05-.37a35.75,35.75,0,0,1-.93-10.1.78.78,0,0,0-.36-.75,33.63,33.63,0,0,0-12.72-5.92,29.77,29.77,0,0,0-5.86-.83c-.91,0-1.81,0-2.72-.06-.32,0-.63,0-1,.06a33.91,33.91,0,0,0,3.95,17.82l-3.52,1.54a38.54,38.54,0,0,1-4-22.89,38.32,38.32,0,0,1,25.11,5.21,37.92,37.92,0,0,1,16.19,20c.08-.18.14-.29.19-.41A37,37,0,0,1,281.06,182a37.84,37.84,0,0,1,23.45-13.4,34.16,34.16,0,0,1,6.39-.43c1.46,0,2.93.15,4.39.23a2.5,2.5,0,0,1,.44.07,38.36,38.36,0,0,1-3.91,22.89l-3.52-1.54A33.87,33.87,0,0,0,312.24,172a31.16,31.16,0,0,0-8.13.52A33.74,33.74,0,0,0,289.57,179a30.42,30.42,0,0,1-.08,5.48,41.72,41.72,0,0,1-.88,5.43c.31,0,.58,0,.84-.06a38.19,38.19,0,0,1,28.33,8.38,38.67,38.67,0,0,1,8.39,9.68l.09.17s0,.06,0,.15a38.21,38.21,0,0,1-51.83,3.36Zm-7,.09a38.55,38.55,0,0,1-27-14.93,32.77,32.77,0,0,0-7.21,4.64,36.76,36.76,0,0,0-5.81,6.26,34.3,34.3,0,0,0,30.89,7.75A30.79,30.79,0,0,0,267.49,211.71Zm13.82-.06a32.72,32.72,0,0,0,13.43,4.54,33.92,33.92,0,0,0,17.59-2.68,31.79,31.79,0,0,0,9-5.84c-2.83-4.25-9.05-9.45-13-10.86a38,38,0,0,1-11.94,10.27A36.88,36.88,0,0,1,281.31,211.65Zm-11-3.64.05-.1c-.09-.1-.18-.21-.28-.31a37,37,0,0,1-8.36-13.24.6.6,0,0,0-.57-.46c-.89-.09-1.77-.21-2.66-.3a33.4,33.4,0,0,0-6.78,0,35.37,35.37,0,0,0-5.85,1.14c-.53.15-1.05.32-1.61.49a34,34,0,0,0,12.22,9.55A33.19,33.19,0,0,0,270.28,208Zm34.41-12.73A35.49,35.49,0,0,0,287.41,194a37.34,37.34,0,0,1-8.89,14c2.94.23,8.87-.71,14-3.14A34.17,34.17,0,0,0,304.69,195.28Zm-28.18,9.26a33.17,33.17,0,0,0,4.89-6.6,35.91,35.91,0,0,0,3.14-7.52c.86-2.89,1.44-7.29,1.16-8.06a2.61,2.61,0,0,1-.18.29,34.45,34.45,0,0,0-9,19A10.08,10.08,0,0,0,276.51,204.54Zm-4.19-.07.13,0c0-.4.07-.79.07-1.18a14.52,14.52,0,0,0-.09-1.62,34.34,34.34,0,0,0-9-19,1.86,1.86,0,0,0-.27-.22A34.25,34.25,0,0,0,272.32,204.47Z"/>
<path class="tam-an-tu-mark-shape" d="M263.78,174.43,260.43,172a36.54,36.54,0,0,1,4.45-10.72,39.18,39.18,0,0,1,9.57-10.57c.65.53,1.31,1,1.93,1.58a37.8,37.8,0,0,1,11,16.15c.37,1,.65,2.1.95,3.16.12.39.11.4-.21.63l-2.75,2-.28.17a33.89,33.89,0,0,0-10.69-18.71A34,34,0,0,0,263.78,174.43Z"/>
<path class="tam-an-tu-mark-shape" d="M211.44,339.42c-2.42.32-4.85.59-7.27,1-3.58.59-7.17,1.21-10.73,1.92-5.38,1.08-10.75,2.2-16.1,3.42a21.73,21.73,0,0,0-5.93,2,31.65,31.65,0,0,1-6,2.31,1.42,1.42,0,0,1-1.79-.57c-.32-.37-.79-.62-1.09-1s-.6-.84-.51-1.17a11.24,11.24,0,0,1,2.53-5.4c2.25-2.34,4.47-4.73,6.83-7a24.53,24.53,0,0,1,3.88-2.75A24.27,24.27,0,0,1,179,330c1.66-.71,3.41-1.21,5.13-1.76,2-.63,4-1.22,5.87-1.8-.9,1.67-.91,1.62-2.79,2.37a8.12,8.12,0,0,0-1.72,1.19l.21.52c1.91-.13,3.82-.24,5.73-.41,2.83-.25,5.65-.55,8.48-.82s5.8-.58,8.71-.79c3.39-.25,6.8-.44,10.2-.58a2,2,0,0,0,1.78-1.1c2.88-4.77,5.87-9.47,8.73-14.25q4-6.84,7.93-13.79c1.58-2.86,3-5.82,4.42-8.73,1.79-3.55,3.71-7,5.33-10.66,1.86-4.18,3.44-8.48,5.17-12.72,1-2.43,2.11-4.79,3-7.26a30,30,0,0,0,2.12-7.8c.24-3.42-.63-6.74-4.1-8.58-.49-.26-1.08-.32-1.58-.57a2.1,2.1,0,0,1-.9-.82c-.08-.16.24-.63.48-.83,1.09-.9,2.49-1.52,2.58-3.24,0-.18.42-.39.69-.5a14.82,14.82,0,0,0,3.11-1.36c1.38-1.09,3-1.27,4.56-1.62.29-.07.68-.15.81-.36.77-1.23,1.79-.76,2.69-.37a63,63,0,0,1,7.31,3.42,33,33,0,0,1,5.71,4.44c4.37,4,6.25,9.35,7.38,15,.37,1.86.86,3.68.35,5.58a42.31,42.31,0,0,0-1.22,4.58c-.35,2.27-.43,4.59-.73,6.87-.25,1.93-.66,3.84-1,5.75l-.32.12c-.31-.64-.62-1.29-.92-1.94H282c-.05.83-.12,1.66-.15,2.48a27.41,27.41,0,0,0,0,3.14,7,7,0,0,0,.58,1.65c.3.88.71,1.74-.18,2.58-.19.19-.18.64-.19,1a19.82,19.82,0,0,0,.17,5.16,29.33,29.33,0,0,1,.24,5.3c0,.19-.23.37-.28.58-.21.79-.73,1.69-.52,2.36a14,14,0,0,1,.27,5.46,19,19,0,0,0,.2,2.25v3.53c.15,2.52.28,5,.53,7.57s.68,4.79,1,7.19c.12.94.58,1.27,1.46,1.38,5.19.6,10.39,1.18,15.57,1.89a40,40,0,0,1,4.8,1.19,1.08,1.08,0,0,1-1.37.91c-2.29-.14-4.59-.13-6.88-.11-1.42,0-2.84.22-4.26.23s-2.81-.11-4.22-.13-2.91,0-4.36,0v.62l14.21,1.27v.43c-1.15.1-2.31.23-3.47.28-3.23.13-6.46.22-9.68.33-.88,0-.69.64-.59,1.15.73,3.76,1.29,7.56,2.26,11.25,1.23,4.62,2.72,9.19,4.25,13.72.86,2.54,2,5,3.08,7.44.76,1.7,1.68,3.34,2.52,5s1.52,3.19,2.38,4.73A55.12,55.12,0,0,0,310,392.69c1,.91,2.12,1.68,3.17,2.54.45.36.85.78,1.47,1.37l-2,.42c0,.5,0,1-.08,1.41l-.13-.27c-.86.46-1.71,1-2.59,1.37a3.66,3.66,0,0,1-1.29.36c-2.28.09-4.57.69-6.83-.09-1.36.75-2.54-.08-3.75-.45a8.2,8.2,0,0,1-1.9-1,77.67,77.67,0,0,1-8.45-5.53c-2.2-1.84-3.85-4.33-5.74-6.55-.49-.57-.91-1.21-1.42-1.77q-3.09-3.42-6.23-6.78c-.72-.77-1.52-1.47-2.29-2.2-3.06-2.94-6.08-5.93-9.2-8.81-1.81-1.66-3.79-3.12-5.64-4.79l1.16.43a5,5,0,0,0-3.33-2.23,4,4,0,0,1-.85-.18c-2-1.18-3.93-2.41-5.92-3.57s-3.77-2.09-5.64-3.16a5,5,0,0,1-1.59-1.4c1.55.85,3.06,1.79,4.66,2.52a45.33,45.33,0,0,0,5,1.86c2,.64,4,1.1,6,1.74,1.42.47,2.79,1.1,4.16,1.69,3.05,1.33,6.1,2.64,9.11,4,1.25.59,2.41,1.38,3.61,2.08l.38-.22c-.34-1.48-.66-3-1-4.42-.86-3.49-1.81-6.95-2.59-10.46-.83-3.73-1.51-7.49-2.24-11.25a8.85,8.85,0,0,1-.2-1.34c-.14-1.83-.14-1.87-1.93-1.79-3,.15-5.95.29-8.92.54-2,.18-4,.58-6,.82-2.41.28-4.82.46-7.22.75-3,.37-6.06,1.07-9.1,1.16-2.72.08-4,1.36-5.31,3.57a186.74,186.74,0,0,1-13.17,19.67c-1,1.3-1.79,2.81-2.76,4.16-1.14,1.56-2.4,3-3.57,4.56-.73,1-1.38,2-2.07,3a5.73,5.73,0,0,1-.47.63c-3.15,2.8-5.51,6.34-8.48,9.29a70.77,70.77,0,0,1-6.63,5.47c-1.82,1.41-3.72,2.74-5.65,4a21.7,21.7,0,0,1-8.33,3.11,61.72,61.72,0,0,1-7.55.67,8.82,8.82,0,0,1-3.63-.68,30.42,30.42,0,0,1-8.26-4.69,32.26,32.26,0,0,1-5.51-6.82,22.31,22.31,0,0,1-3.08-6.64c-.35-1.31-.28-1.43.74-2.62a9.16,9.16,0,0,0,10.37,6.07c5.34-1.1,10.47-2.74,15-5.9,2.16-1.52,4.24-3.16,6.33-4.79,1.38-1.09,2.68-2.29,4.07-3.37a11.77,11.77,0,0,1,1.6-.77,4.47,4.47,0,0,0,1-.94c.8-1,1.49-2.08,2.35-3,2-2.15,4.12-4.22,6.14-6.36,1.4-1.49,2.79-3,4.07-4.59,3.36-4.19,6.66-8.43,10-12.66Zm50.86-58.08c-8,15.31-14.92,31.13-24.24,46l28.28.43c-2.48-15.36-2.77-30.84-4-46.43Zm-5.45-12.49-.47-.2c-1.15,2.27-2.33,4.53-3.44,6.81-.94,1.91-1.79,3.86-2.7,5.79-1.79,3.79-3.53,7.62-5.42,11.37-1.33,2.65-2.93,5.17-4.3,7.8-1.8,3.45-3.49,7-5.22,10.44-.29.57-.5,1.19-.75,1.78l.33.16c1.63-3,3.23-6,4.88-9,2-3.65,4.21-7.21,6.1-10.92,2.1-4.14,3.93-8.41,5.91-12.61,1.49-3.15,3.55-6,4.42-9.47C256.36,270.17,256.63,269.52,256.85,268.85Zm31.56,94.72.22-.06a4.85,4.85,0,0,0-.08-.55c-1.42-5.12-2.89-10.23-4.26-15.36-.54-2-.88-4.14-1.29-6.22-.29-1.52-.53-3-.86-4.57-.05-.24-.42-.42-.64-.63-.1.25-.31.51-.29.75a67.69,67.69,0,0,0,2.56,12.74c.8,2.76,1.67,5.49,2.58,8.22C287,359.8,287.72,361.68,288.41,363.57Zm-8-35.21.52-.07q-1.2-14.57-2.39-29.14a2.24,2.24,0,0,0-.36,1.18c0,2.56,0,5.12.17,7.68q.48,7.65,1.15,15.28C279.65,325,280.1,326.67,280.41,328.36Zm-26.15,5.29v.29a9.39,9.39,0,0,0,1.08.12c3.61,0,7.21,0,10.82-.09a3.22,3.22,0,0,0,.93-.41c-.31-.2-.61-.56-.92-.57h-4c-2.32.13-4.65.3-7,.47A7,7,0,0,0,254.26,333.65Zm-39.15.42-.29-.34-7.36,1.46.06.3c2.24-.23,4.49-.44,6.73-.73C214.56,334.73,214.82,334.31,215.11,334.07Zm49.1,31.86.26-.42-4.78-3-.25.39ZM207,335.68l-.06-.37-6.54,1.11.06.35ZM244,300.29l-.3-.15-2.57,4.79.29.16q1.31-2.4,2.6-4.8Zm41.39,60.13.39-.12-1-3.54-.48.14Z"/>
<path class="tam-an-tu-mark-shape" d="M348.64,327.67l-.37.78c-.48-1.5-.89-3-1.41-4.36a2.08,2.08,0,0,0-2.54-1.47,2.06,2.06,0,0,0-1.08.72,8.73,8.73,0,0,0-1.52,2.1c-2.24,4.25-4.55,8.48-6.59,12.82-1.85,3.94-3.52,8-5,12.07-1.28,3.55-2.21,7.23-3.24,10.87-.8,2.86-1.58,5.74-2.25,8.64a19.18,19.18,0,0,0-.38,3.93c-.05,2.29-.13,2.46-2.36,3a.86.86,0,0,0-.48.29c-.78.89-1.58.51-2.34,0a5.54,5.54,0,0,0-2.46-.8c-1.09-.16-2.11-1.19-3-2a18.5,18.5,0,0,1-2.35-2.58c-1.25-1.6-2.5-3.22-3.59-4.93a3.26,3.26,0,0,1-.05-2c.44-3.19,1-6.37,1.39-9.56.37-3,.33-6,.94-8.93.87-4.12.94-8.29,1.27-12.44a37.59,37.59,0,0,0-.92-10.94c-.63-2.89-1.74-5.56-4.59-7.08-.34-.19-.53-.66-.79-1,.36-.15.7-.35,1.06-.46,1.94-.57,3.89-1.13,5.83-1.68a2.18,2.18,0,0,1,.88-.2,21.65,21.65,0,0,1,8.57,2.43,23.47,23.47,0,0,1,8,8.21,5,5,0,0,1,.51,2.39c.08,3.27-.94,6.36-1.72,9.48-.57,2.26-1.23,4.51-1.84,6.76a2.11,2.11,0,0,0,0,1c4-7.84,7.46-15.91,11.58-23.26,0-.7-.17-1.27,0-1.59.76-1.14,1.67-2.19,2.51-3.28a22.63,22.63,0,0,1,1.75-2.37,7.26,7.26,0,0,1,4.68-2.3,14.44,14.44,0,0,1,7.93,1.75,6.82,6.82,0,0,1,1.4,1.12,24.42,24.42,0,0,1,8.35,13.72,37.49,37.49,0,0,1,.44,12.05c-.11,1,.07,2.11,0,3.16a40.15,40.15,0,0,1-.55,6.74,12.54,12.54,0,0,0,.27,5.31c.38,2.26.67,4.54,1,6.82a9.44,9.44,0,0,0,2.76,5.34c1.34,1.35,3.2,1.21,4.93.58a25.32,25.32,0,0,0,6.09-3.2,56.48,56.48,0,0,0,8.62-8.17c2-2.22,4.1-4.37,6-6.71,1.35-1.7,2.37-3.67,3.55-5.5a15.52,15.52,0,0,1,1-1.42l.4.26c-.27.55-.5,1.13-.81,1.66q-2.25,3.81-4.53,7.62c-.13.22-.34.53-.53.55-1.32.15-1.71,1.29-2.36,2.13-1.54,2-3.06,4-4.59,6l.22.2c.81-.8,1.58-1.63,2.32-2.49,1.18-1.53,2.23-3.15,3.37-4.7a1.71,1.71,0,0,1,1.1-.62c-3.55,6.25-8.77,11.21-13,17l.24.22c1-1,2-2,2.91-3.06s1.85-2.16,2.77-3.25l.3.2a24.05,24.05,0,0,1-1.65,2.7c-2.33,2.82-4.48,5.81-7.45,8-1.46,1.11-2.78,2.42-4.24,3.54a9,9,0,0,1-8,1.64,19.81,19.81,0,0,1-12-9.24,27.66,27.66,0,0,1-4.23-15.32c0-1.4-.24-2.8-.22-4.19,0-1.2.33-2.4.32-3.6-.06-4.63.47-9.24.35-13.87C349.06,331.32,348.82,329.62,348.64,327.67Zm-11.39.79-1.18,2.08.4.23,2-3.36-.38-.24-.93,1.35c.66-1.51,1.28-3,2-4.51.49-1,1.08-2,1.63-3a5.89,5.89,0,0,0-1.78,2c-.84,1.59-1.58,3.24-2.31,4.88C336.69,327.93,337.07,328.25,337.25,328.46Z"/>
<line class="tam-an-tu-mark-shape" x1="41.89" y1="455.47" x2="506.97" y2="455.47"/>
<circle class="tam-an-tu-mark-shape" cx="516.73" cy="455.47" r="11.06"/>
<circle class="tam-an-tu-mark-shape" cx="32.13" cy="455.47" r="11.06"/>
</g>
</g>
`;

const TamAnTuMark: LucideIcon = forwardRef<SVGSVGElement, LucideProps>(function TamAnTuMark(props, ref) {
  return <svg {...props} ref={ref} className="tam-an-tu-mark" viewBox="0 0 548.86 466.54" aria-hidden="true" focusable="false"
    dangerouslySetInnerHTML={{ __html: tamAnTuEmblemMarkup }} />;
});

function LauncherDrawer({ close, closing, openView }: { close: () => void; closing: boolean; openView: (view: View) => void }) {
  const projects: { name: string; detail: string; href?: string; icon: LucideIcon }[] = [
    { name: "Design Forge", detail: "Design system tool", href: "https://phamduchieu2904.github.io/DesignForge/", icon: DesignForgeMark },
    { name: "Tam An Tu", detail: "Project website", href: "https://phamduchieu2904.github.io/tamantu/", icon: TamAnTuMark },
    { name: "Project 03", detail: "Coming soon", icon: Folder },
    { name: "Project 04", detail: "Coming soon", icon: Sparkles },
  ];
  return <section className={`launcher-drawer ${closing ? "closing" : ""}`} aria-label="Application launcher"><header><Command /><span>Applications</span>
    <IconButton label="Close launcher" icon={X} onClick={close} /></header>
    <div className="launcher-shell-apps" aria-label="Desktop applications">
      <button type="button" onClick={() => openView("new-project")}><FilePlus2 aria-hidden="true" /><span><strong>New Project</strong><small>Let’s start a conversation</small></span><ChevronRight aria-hidden="true" /></button>
      <button type="button" onClick={() => openView("terminal")}><Terminal aria-hidden="true" /><span><strong>Terminal</strong><small>Explore the portfolio shell</small></span><ChevronRight aria-hidden="true" /></button>
    </div>
    <div className="launcher-apps">{projects.map(({ name, detail, href, icon: Icon }) => href
      ? <a className="launcher-project" href={href} target="_blank" rel="noopener noreferrer" key={name}
          aria-label={`Open ${name} in a new tab`}>
          <span><Icon aria-hidden="true" /></span><strong>{name}</strong><small>{detail}</small>
        </a>
      : <button className="launcher-project" type="button" disabled key={name}>
          <span><Icon aria-hidden="true" /></span><strong>{name}</strong><small>{detail}</small>
        </button>)}</div>
  </section>;
}

export default function HomePage() {
  // The initial HTML must match in every timezone; show local time after hydration.
  const [now, setNow] = useState<Date | null>(null);
  // Graphite is the calmer, higher-contrast starting point for the portfolio.
  // A previously selected workspace still wins when it is present in storage.
  const [workspace, setWorkspace] = useState(2);
  const [view, setView] = useState<View>("desktop");
  const [portfolioEntry, setPortfolioEntry] = useState<{ category: Filter; request: number }>({ category: "all", request: 0 });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [overlayClosing, setOverlayClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(layoutStorageKey));
      if (layouts.some(layout => layout.id === saved)) setWorkspace(saved);
    } catch { /* Storage may be unavailable for local files or private browsing. */ }
  }, []);
  const selectLayout = (id: number) => {
    setWorkspace(id);
    try { window.localStorage.setItem(layoutStorageKey, String(id)); } catch { /* The layout still works in memory. */ }
  };
  useEffect(() => {
    document.querySelector(".shell")?.setAttribute("data-hydrated", "true");
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const showOverlay = (next: Exclude<Overlay, null>) => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setOverlayClosing(false);
    setOverlay(next);
  };
  const closeOverlay = () => {
    if (!overlay || overlayClosing) return;
    setOverlayClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOverlay(null);
      setOverlayClosing(false);
      closeTimerRef.current = null;
    }, 500);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (overlay) {
          closeOverlay();
        } else if (view !== "desktop" && view !== "portfolio") {
          setView("desktop");
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (overlay === "launcher") closeOverlay();
        else showOverlay("launcher");
      }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [overlay, overlayClosing, view]);
  const openView = (next: View) => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setView(next);
    setOverlay(null);
    setOverlayClosing(false);
  };
  const openPortfolio = (category: Filter) => {
    setPortfolioEntry(current => ({ category, request: current.request + 1 }));
    openView("portfolio");
  };
  const toggleOverlay = (next: Exclude<Overlay, null>) => {
    if (overlay === next) closeOverlay();
    else showOverlay(next);
  };
  return <DesktopViewport><main className="shell" data-layout={layouts.find(layout => layout.id === workspace)?.theme}>
    <LeftRail now={now} workspace={workspace} setWorkspace={selectLayout} view={view} overlay={overlay}
      openView={openView} openPortfolio={openPortfolio} toggleOverlay={toggleOverlay} />
    <section className="desktop-surface" aria-label="Caelestia desktop">
      <DesktopWallpaper workspace={workspace} active={view === "desktop"} />
      {view === "desktop" && <PortfolioIntro onOpenAbout={() => openView("about")} onOpenPortfolio={() => openPortfolio("all")} />}
      {view === "about" && <AboutPage onClose={() => openView("desktop")} />}
      {view === "portfolio" && <PortfolioApp key={portfolioEntry.request} initialCategory={portfolioEntry.category}
        onClose={() => openView("desktop")} />}
      {view === "terminal" && <TerminalApp onClose={() => openView("desktop")} />}
      {view === "files" && <FilesApp onClose={() => openView("desktop")} />}
      <ProjectLauncher active={view === "new-project"} covered={overlay !== null}
        onClose={() => openView("desktop")} onPortfolio={() => openPortfolio("all")} />
      {overlay === "dashboard" && now && <DashboardDrawer now={now} close={closeOverlay} closing={overlayClosing} />}
      {overlay === "launcher" && <LauncherDrawer close={closeOverlay} closing={overlayClosing} openView={openView} />}
      {overlay === "session" && <SessionDrawer close={closeOverlay} closing={overlayClosing} />}
      {view === "desktop" && !overlay && <button type="button" className="explore-pill" onClick={() => showOverlay("launcher")}>
        <Sparkles /> Explore the shell <kbd>Ctrl K</kbd></button>}
    </section>
  </main></DesktopViewport>;
}
