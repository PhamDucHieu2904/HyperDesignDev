import {
  BadgeCheck, Bot, Box, BriefcaseBusiness, CalendarDays, ChevronLeft, ChevronRight, Code2, Command,
  Folder, Gamepad2, Feather, Leaf, Grid2X2, Frame, Image as ImageIcon, LogOut, MapPin, PenTool,
  Moon, Power, RefreshCw, Search,
  Sparkles, Square, Terminal, TimerReset, UsersRound,
  X, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PortfolioScene } from "./portfolio-scenes";
import { PortfolioApp } from "./portfolio/PortfolioApp";
import type { Filter } from "./portfolio/types";

type View = "desktop" | "about" | "portfolio" | "terminal" | "files";
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

function LeftRail({ workspace, setWorkspace, view, overlay, openView, openPortfolio, toggleOverlay }: {
  workspace: number; setWorkspace: (workspace: number) => void; view: View;
  overlay: Overlay; openView: (view: View) => void; openPortfolio: (category: Filter) => void;
  toggleOverlay: (overlay: Exclude<Overlay, null>) => void;
}) {
  const layoutPickerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; startId: number; previewId: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [previewLayout, setPreviewLayout] = useState<number | null>(null);
  const [isLayoutDragging, setIsLayoutDragging] = useState(false);
  const label = view === "portfolio" ? "Portfolio"
    : view === "terminal" ? "Terminal" : view === "files" ? "Files" : view === "about" ? "About Hyper D²" : "Desktop";
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
    <button type="button" className="arch-mark" aria-label="Open launcher" onClick={() => toggleOverlay("launcher")}>A</button>
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
    <button type="button" className="active-window" onClick={() => openView(view === "desktop" ? "terminal" : "desktop")}
      aria-label={`Active window: ${label}`}>
      {view === "desktop" ? <Square /> : view === "portfolio" ? <Frame /> : view === "files" ? <Folder /> : view === "about" ? <UsersRound /> : <Terminal />}
      <span>{label}</span>
    </button>
    <div className="rail-bottom">
      <IconButton label="Adobe Photoshop — open Visual portfolio" icon={ImageIcon} className="rail-shortcut" onClick={() => openPortfolio("photoshop")} />
      <IconButton label="Adobe Illustrator — open Brand portfolio" icon={PenTool} className="rail-shortcut" onClick={() => openPortfolio("illustrator")} />
      <IconButton label="Blender — open 3D portfolio" icon={Box} className="rail-shortcut" onClick={() => openPortfolio("blender")} />
      <IconButton label="Unity — open Game portfolio" icon={Gamepad2} className="rail-shortcut" onClick={() => openPortfolio("game")} />
      <IconButton label="Visual Studio Code — open Web portfolio" icon={Code2} className="rail-shortcut" onClick={() => openPortfolio("web")} />
      <IconButton label="Codex — coming soon" icon={Bot} className="rail-shortcut rail-shortcut-pending" disabled />
      <IconButton label="Power menu" icon={Power} className="power" active={overlay === "session"} onClick={() => toggleOverlay("session")} />
    </div>
  </aside>;
}

function DesktopWallpaper({ workspace }: { workspace: number }) {
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
      if (reducedMotion.matches || !finePointer.matches) return;
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
  }, []);

  return <div ref={wallpaperRef} className={`wallpaper workspace-${workspace}`}>
    <div className="wallpaper-motion">
      {(workspace === 1 || workspace === 2) && <img
        src="./public/hieu-wallpaper.png"
        alt="Hieu Pham monochrome ink-wash portrait"
        fetchPriority="high"
      />}
    </div>
    <div className="paper-light" />
    <div className="layout-texture" aria-hidden="true" />
    <PortfolioScene workspace={workspace} />
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
    <h1 id="portfolio-title">Hieu Pham - Designer x Developer</h1>
    <p className="portfolio-manifesto">I don’t just design ideas. I engineer how they work.</p>
    <p className="portfolio-summary">{`Where a Developer's logic meets a Designer's aesthetic. From high-end
commercial packaging and realistic 3D environments to automated workflows and
seamless database systems. Beautiful on the surface, robust under the hood.`}</p>
    <nav className="portfolio-actions" aria-label="Portfolio navigation">
      <button type="button" className="portfolio-action" data-action="about" onClick={onOpenAbout}>
        <span className="portfolio-index" aria-hidden="true">01</span><span className="portfolio-action-label">About Hyper D²</span>
      </button>
      <button type="button" className="portfolio-action" data-action="portfolio" onClick={onOpenPortfolio}>
        <span className="portfolio-index" aria-hidden="true">02</span><span className="portfolio-action-label">Portfolio</span>
      </button>
    </nav>
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
  return <section className="terminal-window" aria-label="Terminal window"><header>
    <span><Terminal /> hieu@caelestia: ~</span><div><IconButton label="Minimize terminal" icon={Square} />
      <IconButton label="Close terminal" icon={X} onClick={onClose} /></div></header>
    <div className="terminal-body"><pre aria-label="Caelestia terminal banner">{`   ______          __          __  _
  / ____/___ _____/ /__  _____/ /_(_)___ _
 / /   / __ \`/ __  / _ \\/ ___/ __/ / __ \`/
/ /___/ /_/ / /_/ /  __(__  ) /_/ / /_/ /
\\____/\\__,_/\\__,_/\\___/____/\\__/_/\\__,_/  `}</pre>
      <p><span>hieu@caelestia</span> portfolio shell</p>
      <p className="terminal-muted">A faithful web translation of the original QML desktop.</p><p><b>❯</b><i className="cursor" /></p>
    </div>
  </section>;
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

function LauncherDrawer({ close, openView, openPortfolio, closing }: {
  close: () => void; openView: (view: View) => void; openPortfolio: (category: Filter) => void; closing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const apps: { name: string; view: View; icon: LucideIcon }[] = [
    { name: "Portfolio", view: "portfolio", icon: Frame }, { name: "Terminal", view: "terminal", icon: Terminal },
    { name: "Files", view: "files", icon: Folder }, { name: "Desktop", view: "desktop", icon: ImageIcon },
  ];
  const filtered = apps.filter(app => app.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 460);
    return () => window.clearTimeout(focusTimer);
  }, []);
  return <section className={`launcher-drawer ${closing ? "closing" : ""}`} aria-label="Application launcher"><header><Command /><span>Applications</span>
    <IconButton label="Close launcher" icon={X} onClick={close} /></header>
    <div className="launcher-apps">{filtered.map(({ name, view, icon: Icon }) => <button type="button" key={name}
      onClick={() => view === "portfolio" ? openPortfolio("all") : openView(view)}>
      <span><Icon /></span><strong>{name}</strong><small>Open</small></button>)}</div>
    <label><Search /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Search applications" /><kbd>esc</kbd></label>
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
  return <main className="shell" data-layout={layouts.find(layout => layout.id === workspace)?.theme}>
    <LeftRail workspace={workspace} setWorkspace={selectLayout} view={view} overlay={overlay}
      openView={openView} openPortfolio={openPortfolio} toggleOverlay={toggleOverlay} />
    <section className="desktop-surface" aria-label="Caelestia desktop">
      <DesktopWallpaper workspace={workspace} />
      {view === "desktop" && <PortfolioIntro onOpenAbout={() => openView("about")} onOpenPortfolio={() => openPortfolio("all")} />}
      {view === "about" && <AboutPage onClose={() => openView("desktop")} />}
      {view === "portfolio" && <PortfolioApp key={portfolioEntry.request} initialCategory={portfolioEntry.category}
        onClose={() => openView("desktop")} />}
      {view === "terminal" && <TerminalApp onClose={() => openView("desktop")} />}
      {view === "files" && <FilesApp onClose={() => openView("desktop")} />}
      {overlay === "dashboard" && now && <DashboardDrawer now={now} close={closeOverlay} closing={overlayClosing} />}
      {overlay === "launcher" && <LauncherDrawer close={closeOverlay} openView={openView}
        openPortfolio={openPortfolio} closing={overlayClosing} />}
      {overlay === "session" && <SessionDrawer close={closeOverlay} closing={overlayClosing} />}
      {view === "desktop" && !overlay && <button type="button" className="explore-pill" onClick={() => showOverlay("launcher")}>
        <Sparkles /> Explore the shell <kbd>Ctrl K</kbd></button>}
    </section>
  </main>;
}
