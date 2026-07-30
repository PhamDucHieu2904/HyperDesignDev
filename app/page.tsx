"use client";

import Image from "next/image";
import {
  Bluetooth, CalendarDays, ChevronLeft, ChevronRight, Command, Download, Eye,
  Folder, Gamepad2, Heart, Home, Image as ImageIcon, ListMusic, LogOut, Menu,
  Moon, MoreVertical, Music2, Pause, Play, Power, RefreshCw, Repeat2, Rocket,
  Search, Settings2, Shuffle, SkipBack, SkipForward,
  Sparkles, Square, Terminal, TimerReset, Trash2, Upload, UsersRound, Volume2,
  Wifi, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type View = "desktop" | "music" | "terminal" | "files";
type Overlay = "dashboard" | "launcher" | "session" | "media" | null;

const albums = [
  { title: "ONE SPARK", artist: "TWICE", tone: "rose", mark: "ONE\nSPARK" },
  { title: "Nobody Knows", artist: "KISS OF LIFE", tone: "ink", mark: "KISS\nOF LIFE" },
  { title: "I GOT YOU", artist: "TWICE", tone: "field", mark: "I GOT\nYOU" },
  { title: "UNTOUCHABLE", artist: "ITZY", tone: "ember", mark: "BORN\nTO BE" },
  { title: "DASH", artist: "NMIXX", tone: "portrait", mark: "DASH" },
];
const library = [
  { title: "GOLD", artist: "ABBA", tone: "gold", mark: "ABBA" },
  { title: "Layover", artist: "V", tone: "blue", mark: "LAYOVER" },
  { title: "Love wins all", artist: "IU", tone: "film", mark: "LOVE\nWINS ALL" },
  { title: "Supernova", artist: "aespa", tone: "silver", mark: "SUPERNOVA" },
  { title: "Drama", artist: "aespa", tone: "violet", mark: "DRAMA" },
];
const tracks = [
  ["Burn It’s Destiny", "10cm", "3:51", "5"], ["Star", "N.Flying", "3:38", "1"],
  ["Everytime", "CHEN, Punch", "3:09", "12"], ["Reset", "Tiger JK", "4:02", "4"],
  ["Call Me Maybe", "SAya", "3:21", "5"], ["All With You", "TAEYEON", "3:55", "9"],
  ["Love Virus", "Kihyun, Seol.A", "3:27", "6"], ["You Are My Everything", "Gummy", "4:00", "8"],
  ["I Remember You", "I.O.I", "4:08", "8"], ["A Little More", "JinHo, Rothy", "3:24", "5"],
  ["It’s you", "Jeong Sewoon", "3:39", "7"],
];

function IconButton({ label, icon: Icon, onClick, active = false, className = "" }: {
  label: string; icon: LucideIcon; onClick?: () => void; active?: boolean; className?: string;
}) {
  return <button type="button" className={`icon-button ${active ? "active" : ""} ${className}`}
    aria-label={label} title={label} onClick={onClick}><Icon aria-hidden="true" /></button>;
}

function AlbumCard({ album }: { album: { title: string; artist: string; tone: string; mark: string } }) {
  return <button type="button" className="album-card" aria-label={`Open ${album.title}`}>
    <span className={`album-cover ${album.tone}`}>
      {album.mark.split("\n").map((part) => <b key={part}>{part}</b>)}
    </span>
    <strong>{album.title}</strong><small>{album.artist}</small>
  </button>;
}

function LeftRail({ now, workspace, setWorkspace, view, overlay, openView, toggleOverlay }: {
  now: Date; workspace: number; setWorkspace: (workspace: number) => void; view: View;
  overlay: Overlay; openView: (view: View) => void; toggleOverlay: (overlay: Exclude<Overlay, null>) => void;
}) {
  const label = view === "music" ? "(Paused)  (24 / 53)  Reset – Tiger JK"
    : view === "terminal" ? "Terminal" : view === "files" ? "Files" : "Desktop";
  return <aside className="rail" aria-label="Caelestia bar">
    <button type="button" className="arch-mark" aria-label="Open launcher" onClick={() => toggleOverlay("launcher")}>A</button>
    <div className="workspaces" aria-label="Workspaces">
      <IconButton label="Open dashboard" icon={Moon} active={overlay === "dashboard"} onClick={() => toggleOverlay("dashboard")} />
      <IconButton label="Wallpaper workspace" icon={ImageIcon} active={workspace === 2} onClick={() => setWorkspace(2)} />
      {[3, 4, 5].map(number => <button type="button" className={`workspace-dot ${workspace === number ? "active" : ""}`}
        aria-label={`Workspace ${number}`} key={number} onClick={() => setWorkspace(number)} />)}
      <button type="button" className={`workspace-orb ${workspace === 1 ? "active" : ""}`}
        aria-label="Workspace 1" onClick={() => setWorkspace(1)}><Moon /></button>
    </div>
    <button type="button" className="active-window" onClick={() => openView(view === "desktop" ? "terminal" : "desktop")}
      aria-label={`Active window: ${label}`}>
      {view === "desktop" ? <Square /> : view === "music" ? <Music2 /> : view === "files" ? <Folder /> : <Terminal />}
      <span>{label}</span>
    </button>
    <div className="rail-bottom">
      <Bluetooth className="muted" aria-hidden="true" />
      <IconButton label="Eye comfort" icon={Eye} /><IconButton label="Games" icon={Gamepad2} />
      <IconButton label="Open Feishin" icon={Music2} className="spotify" active={view === "music"} onClick={() => openView("music")} />
      <IconButton label="Calendar" icon={CalendarDays} onClick={() => toggleOverlay("dashboard")} />
      <button type="button" className="clock" aria-label="Open dashboard" onClick={() => toggleOverlay("dashboard")}>
        <span>{String(now.getHours()).padStart(2, "0")}</span><span>{String(now.getMinutes()).padStart(2, "0")}</span>
      </button>
      <div className="status-stack" aria-label="System status"><Wifi /><Bluetooth /><Rocket /></div>
      <IconButton label="Power menu" icon={Power} className="power" active={overlay === "session"} onClick={() => toggleOverlay("session")} />
    </div>
  </aside>;
}

function DesktopWallpaper({ workspace }: { workspace: number }) {
  return <div className={`wallpaper workspace-${workspace}`}>
    <Image
      src="/hieu-wallpaper.png"
      alt="Hieu Pham monochrome ink-wash portrait"
      fill
      priority
      sizes="100vw"
      unoptimized
    />
    <div className="paper-light" /><div className="desktop-stamp" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}

function MusicApp({ playing, setPlaying, onClose, openMedia }: {
  playing: boolean; setPlaying: (playing: boolean) => void; onClose: () => void; openMedia: () => void;
}) {
  const [musicQuery, setMusicQuery] = useState("");

  return <section className="music-window" aria-label="Feishin music player">
    <aside className="music-nav">
      <div className="window-nav">
        <IconButton label="Back" icon={ChevronLeft} />
        <IconButton label="Forward" icon={ChevronRight} />
      </div>
      <IconButton label="Close Feishin" icon={X} className="mobile-close" onClick={onClose} />
      <button type="button" className="nav-logo" aria-label="Feishin menu"><Menu /><span>Menu</span></button>
      <nav>
        <button type="button" className="selected"><Home /><span>Home</span></button>
        <button type="button"><Search /><span>Search</span></button>
        <button type="button"><ListMusic /><span>Playlists</span></button>
        <button type="button"><Settings2 /><span>Settings</span></button>
        <button type="button"><UsersRound /><span>Artists</span></button>
      </nav>
    </aside>
    <div className="music-main">
      <label className="music-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={musicQuery}
          onChange={(event) => setMusicQuery(event.target.value)}
          placeholder="Search albums, artists and tracks"
          aria-label="Search music"
        />
        <kbd>Esc</kbd>
      </label>
      <section className="music-hero">
        <div className="book-cover"><small>YOASOBI</small><i /></div>
        <div className="hero-copy"><h1>THE BOOK 3</h1><h2>YOASOBI</h2><span>2023</span>
          <button type="button" onClick={() => setPlaying(true)}>Play</button></div>
        <div className="hero-arrows"><IconButton label="Previous album" icon={ChevronLeft} /><IconButton label="Next album" icon={ChevronRight} /></div>
      </section>
      <section className="album-section"><header><h2>Recently played</h2><div>
        <IconButton label="Previous" icon={ChevronLeft} /><IconButton label="Next" icon={ChevronRight} />
      </div></header><div className="album-row">{albums.map(album => <AlbumCard key={album.title} album={album} />)}</div></section>
      <section className="album-section library-section"><header><h2>Explore from your library</h2><RefreshCw /></header>
        <div className="album-row">{library.map(album => <AlbumCard key={album.title} album={album} />)}</div></section>
    </div>
    <aside className="track-list">
      <header><div className="track-actions">
        <IconButton label="Shuffle" icon={Shuffle} /><IconButton label="Refresh" icon={RefreshCw} />
        <IconButton label="Download" icon={Download} /><IconButton label="Upload" icon={Upload} /><IconButton label="Clear" icon={Trash2} />
      </div><IconButton label="Close Feishin" icon={X} className="window-close" onClick={onClose} /></header>
      <div className="track-head"><span>#</span><span>Title</span><span>◷</span><span>Plays</span><Heart /></div>
      <div className="tracks">{tracks.map(([title, artist, duration, plays], index) =>
        <button type="button" className={title === "Reset" ? "active" : ""} key={title} onClick={() => { setPlaying(true); openMedia(); }}>
          <span>{index + 21}</span><i className={`track-art art-${index % 5}`} />
          <span className="track-title"><strong>{title}</strong><small>{artist}</small></span>
          <span>{duration}</span><span>{plays}</span><Heart className={index === 6 ? "liked" : ""} />
        </button>)}</div>
    </aside>
    <footer className="player-bar">
      <button type="button" className="now-track" onClick={openMedia}><i className="reset-cover">R</i>
        <span><strong>Reset</strong><small>Tiger JK</small><em>학교 2015 OST</em></span><MoreVertical /></button>
      <div className="transport"><div><IconButton label="Stop" icon={Square} /><IconButton label="Shuffle" icon={Shuffle} />
        <IconButton label="Previous" icon={SkipBack} /><IconButton label={playing ? "Pause" : "Play"} icon={playing ? Pause : Play} onClick={() => setPlaying(!playing)} />
        <IconButton label="Next" icon={SkipForward} /><IconButton label="Repeat" icon={Repeat2} /></div>
        <div className="song-progress"><span>0:00</span><i><b /></i><span>4:02</span></div></div>
      <div className="volume"><Heart /><ListMusic /><Volume2 /><i><b /></i></div>
    </footer>
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

function MediaPopout({ playing, setPlaying, close, closing }: {
  playing: boolean; setPlaying: (playing: boolean) => void; close: () => void; closing: boolean;
}) {
  return <section className={`media-popout ${closing ? "closing" : ""}`} aria-label="Media controls"><header>
    <button type="button" onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button>
    <span><strong>({playing ? "Playing" : "Paused"}) (24 / 53) Reset – Tiger JK</strong><small>feishin</small></span>
    <IconButton label="Close media controls" icon={X} onClick={close} /></header>
    <div className="media-preview"><div className="preview-album"><span>THE BOOK 3</span><i /></div>
      <div className="preview-list">{[0, 1, 2, 3, 4].map(item => <i key={item} />)}</div></div>
    <div className="popout-progress"><span /></div>
  </section>;
}

function SessionDrawer({ close, closing }: { close: () => void; closing: boolean }) {
  return <><button type="button" className={`scrim ${closing ? "closing" : ""}`} aria-label="Close power menu" onClick={close} />
    <section className={`session-drawer ${closing ? "closing" : ""}`} aria-label="Power menu">
      <IconButton label="Log out" icon={LogOut} className="focused" /><IconButton label="Shut down" icon={Power} />
      <span className="session-gif"><Image src="/bongocat.gif" alt="Animated shell companion" width={66} height={66} unoptimized /></span>
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

function LauncherDrawer({ close, openView, closing }: { close: () => void; openView: (view: View) => void; closing: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const apps: { name: string; view: View; icon: LucideIcon }[] = [
    { name: "Feishin", view: "music", icon: Music2 }, { name: "Terminal", view: "terminal", icon: Terminal },
    { name: "Files", view: "files", icon: Folder }, { name: "Desktop", view: "desktop", icon: ImageIcon },
  ];
  const filtered = apps.filter(app => app.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 460);
    return () => window.clearTimeout(focusTimer);
  }, []);
  return <section className={`launcher-drawer ${closing ? "closing" : ""}`} aria-label="Application launcher"><header><Command /><span>Applications</span>
    <IconButton label="Close launcher" icon={X} onClick={close} /></header>
    <div className="launcher-apps">{filtered.map(({ name, view, icon: Icon }) => <button type="button" key={name} onClick={() => openView(view)}>
      <span><Icon /></span><strong>{name}</strong><small>Open</small></button>)}</div>
    <label><Search /><input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)}
      placeholder="Search applications" /><kbd>esc</kbd></label>
  </section>;
}

export default function HomePage() {
  const [now, setNow] = useState(() => new Date());
  const [workspace, setWorkspace] = useState(1);
  const [view, setView] = useState<View>("desktop");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [overlayClosing, setOverlayClosing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 10_000); return () => window.clearInterval(timer); }, []);
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
        } else if (view !== "desktop") {
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
  const toggleOverlay = (next: Exclude<Overlay, null>) => {
    if (overlay === next) closeOverlay();
    else showOverlay(next);
  };
  return <main className="shell">
    <LeftRail now={now} workspace={workspace} setWorkspace={setWorkspace} view={view} overlay={overlay}
      openView={openView} toggleOverlay={toggleOverlay} />
    <section className="desktop-surface" aria-label="Caelestia desktop">
      <DesktopWallpaper workspace={workspace} />
      {view === "music" && <MusicApp playing={playing} setPlaying={setPlaying} onClose={() => openView("desktop")} openMedia={() => showOverlay("media")} />}
      {view === "terminal" && <TerminalApp onClose={() => openView("desktop")} />}
      {view === "files" && <FilesApp onClose={() => openView("desktop")} />}
      {overlay === "dashboard" && <DashboardDrawer now={now} close={closeOverlay} closing={overlayClosing} />}
      {overlay === "launcher" && <LauncherDrawer close={closeOverlay} openView={openView} closing={overlayClosing} />}
      {overlay === "session" && <SessionDrawer close={closeOverlay} closing={overlayClosing} />}
      {view === "desktop" && !overlay && <button type="button" className="explore-pill" onClick={() => showOverlay("launcher")}>
        <Sparkles /> Explore the shell <kbd>Ctrl K</kbd></button>}
    </section>
    {overlay === "media" && <MediaPopout playing={playing} setPlaying={setPlaying} close={closeOverlay} closing={overlayClosing} />}
    <button type="button" className="rainbow-mascot" aria-label="Open Feishin" onClick={() => openView("music")}><span /></button>
  </main>;
}
