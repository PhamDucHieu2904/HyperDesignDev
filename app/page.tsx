"use client";

import {
  Activity,
  AppWindow,
  BatteryMedium,
  BedDouble,
  Bell,
  Bluetooth,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  CloudSun,
  Code2,
  Cpu,
  FileText,
  Folder,
  Gauge,
  Github,
  Globe2,
  HardDrive,
  Headphones,
  Image as ImageIcon,
  Keyboard,
  LayoutDashboard,
  Leaf,
  LogOut,
  Maximize2,
  MemoryStick,
  MessageCircle,
  Mic2,
  Minus,
  Monitor,
  Moon,
  MoreHorizontal,
  MousePointer2,
  Music2,
  Network,
  Pause,
  Play,
  Power,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  SkipBack,
  SkipForward,
  Sparkles,
  Sun,
  Terminal,
  Volume2,
  Waves,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type MainPanel = "dashboard" | "launcher" | "session" | null;
type DashboardTab = "dashboard" | "media" | "performance" | "weather";

const dashboardTabs: {
  id: DashboardTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "media", label: "Media", icon: Music2 },
  { id: "performance", label: "Performance", icon: Gauge },
  { id: "weather", label: "Weather", icon: CloudSun },
];

const launcherApps: {
  name: string;
  subtitle: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    name: "Portfolio",
    subtitle: "Your selected work",
    icon: BriefcaseBusiness,
    accent: "lilac",
  },
  { name: "About me", subtitle: "Profile & story", icon: FileText, accent: "pink" },
  { name: "Projects", subtitle: "Case studies", icon: Code2, accent: "cyan" },
  { name: "Terminal", subtitle: "Developer console", icon: Terminal, accent: "green" },
  { name: "Browser", subtitle: "Explore the web", icon: Globe2, accent: "blue" },
  { name: "Files", subtitle: "Documents & assets", icon: Folder, accent: "amber" },
  { name: "Wallpapers", subtitle: "Appearance", icon: ImageIcon, accent: "purple" },
];

const resourceRows = [
  { name: "CPU", value: 42, detail: "3.8 GHz", icon: Cpu, color: "cyan" },
  { name: "Memory", value: 61, detail: "9.8 / 16 GB", icon: MemoryStick, color: "pink" },
  { name: "Storage", value: 74, detail: "352 / 476 GB", icon: HardDrive, color: "amber" },
  { name: "Network", value: 28, detail: "14.2 MB/s", icon: Network, color: "purple" },
];

const forecast = [
  { day: "Thu", temp: "28°", icon: CloudSun },
  { day: "Fri", temp: "27°", icon: CloudRain },
  { day: "Sat", temp: "29°", icon: Sun },
  { day: "Sun", temp: "28°", icon: CloudSun },
  { day: "Mon", temp: "26°", icon: CloudRain },
];

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function monthMatrix(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  active = false,
  className = "",
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

function Toggle({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className={`toggle-tile ${value ? "enabled" : ""}`}
      type="button"
      onClick={onChange}
      aria-pressed={value}
    >
      <span className="toggle-icon">
        <Icon />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{value ? "On" : "Off"}</small>
      </span>
    </button>
  );
}

function CalendarCard({ now }: { now: Date }) {
  const days = monthMatrix(now);
  const month = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <article className="card calendar-card">
      <header className="card-heading compact-heading">
        <div>
          <span className="eyebrow">Calendar</span>
          <h3>{month}</h3>
        </div>
        <div className="mini-actions">
          <IconButton label="Previous month" icon={ChevronLeft} />
          <IconButton label="Next month" icon={ChevronRight} />
        </div>
      </header>
      <div className="calendar-weekdays">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day, index) => (
          <span
            key={`${day ?? "empty"}-${index}`}
            className={day === now.getDate() ? "today" : ""}
          >
            {day}
          </span>
        ))}
      </div>
    </article>
  );
}

function DashboardHome({
  now,
  playing,
  setPlaying,
}: {
  now: Date;
  playing: boolean;
  setPlaying: (value: boolean) => void;
}) {
  return (
    <div className="dashboard-grid">
      <article className="card weather-hero">
        <div className="weather-icon-orbit">
          <CloudSun />
        </div>
        <div>
          <span className="eyebrow">Ho Chi Minh City</span>
          <div className="weather-reading">
            <strong>28°</strong>
            <div>
              <b>Partly cloudy</b>
              <small>Feels like 31°</small>
            </div>
          </div>
        </div>
      </article>

      <article className="card profile-card">
        <div className="profile-avatar">
          <span>HP</span>
          <i />
        </div>
        <div className="profile-copy">
          <span className="eyebrow">Welcome back</span>
          <h2>Hieu Pham</h2>
          <p>
            A creative workspace, ready to become your personal CV and portfolio.
          </p>
          <div className="profile-stats">
            <span>
              <Activity /> up 4 hours
            </span>
            <span>
              <AppWindow /> 4 workspaces
            </span>
          </div>
        </div>
      </article>

      <article className="card time-card">
        <span className="time-large">
          {formatTime(now).split(":").map((part, index) => (
            <span key={part}>
              {index === 1 && <i>•••</i>}
              {part}
            </span>
          ))}
        </span>
        <span className="date-line">
          {new Intl.DateTimeFormat("en", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(now)}
        </span>
      </article>

      <article className="card focus-card">
        <div className="focus-top">
          <span className="focus-icon">
            <Leaf />
          </span>
          <div>
            <span className="eyebrow">Focus mode</span>
            <h3>Stay in flow</h3>
          </div>
        </div>
        <button type="button" className="soft-button">
          Start session <Zap />
        </button>
      </article>

      <CalendarCard now={now} />

      <article className="card music-card">
        <div className="album-art">
          <Waves />
          <i />
          <i />
          <i />
        </div>
        <div className="track-copy">
          <span className="eyebrow">Now playing</span>
          <h3>A moment apart</h3>
          <p>ODESZA · A Moment Apart</p>
          <div className="track-progress">
            <span />
          </div>
          <div className="media-controls">
            <IconButton label="Previous" icon={SkipBack} />
            <IconButton
              label={playing ? "Pause" : "Play"}
              icon={playing ? Pause : Play}
              active
              onClick={() => setPlaying(!playing)}
            />
            <IconButton label="Next" icon={SkipForward} />
          </div>
        </div>
      </article>

      <article className="card resource-summary">
        <header className="card-heading compact-heading">
          <div>
            <span className="eyebrow">System</span>
            <h3>Resources</h3>
          </div>
          <Cpu />
        </header>
        <div className="resource-dials">
          {resourceRows.slice(0, 3).map((resource) => {
            const Icon = resource.icon;
            return (
              <div className={`mini-dial ${resource.color}`} key={resource.name}>
                <div style={{ "--value": resource.value } as React.CSSProperties}>
                  <Icon />
                </div>
                <span>{resource.value}%</span>
                <small>{resource.name}</small>
              </div>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function MediaTab({
  playing,
  setPlaying,
}: {
  playing: boolean;
  setPlaying: (value: boolean) => void;
}) {
  return (
    <div className="wide-tab media-tab">
      <article className="card media-feature">
        <div className="large-cover">
          <div className="cover-glow" />
          <Waves />
          <span>ODESZA</span>
        </div>
        <div className="media-detail">
          <span className="eyebrow">Playing from A Moment Apart</span>
          <h2>A moment apart</h2>
          <p>ODESZA</p>
          <div className="full-progress">
            <span />
          </div>
          <div className="time-labels">
            <span>2:18</span>
            <span>4:03</span>
          </div>
          <div className="large-media-controls">
            <IconButton label="Previous" icon={SkipBack} />
            <button
              className="primary-play"
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <IconButton label="Next" icon={SkipForward} />
          </div>
        </div>
      </article>
      <article className="card queue-card">
        <header className="card-heading">
          <div>
            <span className="eyebrow">Up next</span>
            <h3>Queue</h3>
          </div>
          <MoreHorizontal />
        </header>
        {["Bloom", "Line of sight", "Across the room"].map((track, index) => (
          <div className="queue-row" key={track}>
            <span>{index + 1}</span>
            <div>
              <b>{track}</b>
              <small>ODESZA</small>
            </div>
            <small>{["3:15", "4:28", "3:52"][index]}</small>
          </div>
        ))}
      </article>
    </div>
  );
}

function PerformanceTab() {
  return (
    <div className="wide-tab performance-tab">
      <article className="card performance-overview">
        <header className="card-heading">
          <div>
            <span className="eyebrow">Live overview</span>
            <h2>Everything looks good</h2>
          </div>
          <span className="status-badge">
            <ShieldCheck /> Healthy
          </span>
        </header>
        <div className="performance-chart" aria-label="Resource history chart">
          {[44, 62, 48, 73, 59, 81, 66, 54, 76, 69, 84, 71].map(
            (height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ),
          )}
        </div>
        <div className="chart-legend">
          <span>
            <i className="legend-primary" /> CPU activity
          </span>
          <span>Last 60 seconds</span>
        </div>
      </article>
      <div className="performance-list">
        {resourceRows.map((resource) => {
          const Icon = resource.icon;
          return (
            <article className="card resource-row-card" key={resource.name}>
              <span className={`resource-icon ${resource.color}`}>
                <Icon />
              </span>
              <div className="resource-row-copy">
                <div>
                  <b>{resource.name}</b>
                  <small>{resource.detail}</small>
                </div>
                <strong>{resource.value}%</strong>
                <div className="resource-bar">
                  <span style={{ width: `${resource.value}%` }} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WeatherTab() {
  return (
    <div className="wide-tab weather-tab">
      <article className="card weather-main">
        <div className="weather-main-top">
          <div>
            <span className="eyebrow">Ho Chi Minh City</span>
            <h2>28°</h2>
            <p>Partly cloudy · Feels like 31°</p>
          </div>
          <CloudSun />
        </div>
        <div className="weather-metrics">
          <span>
            <Waves />
            <b>74%</b>
            <small>Humidity</small>
          </span>
          <span>
            <NavigationIcon />
            <b>12 km/h</b>
            <small>Wind</small>
          </span>
          <span>
            <Sun />
            <b>High</b>
            <small>UV index</small>
          </span>
        </div>
      </article>
      <article className="card forecast-card">
        <header className="card-heading compact-heading">
          <div>
            <span className="eyebrow">This week</span>
            <h3>5-day forecast</h3>
          </div>
        </header>
        <div className="forecast-row">
          {forecast.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.day}>
                <b>{item.day}</b>
                <Icon />
                <strong>{item.temp}</strong>
              </span>
            );
          })}
        </div>
      </article>
    </div>
  );
}

function NavigationIcon() {
  return <Signal style={{ transform: "rotate(-35deg)" }} />;
}

function DashboardPanel({
  now,
  activeTab,
  setActiveTab,
  playing,
  setPlaying,
  close,
}: {
  now: Date;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  playing: boolean;
  setPlaying: (value: boolean) => void;
  close: () => void;
}) {
  return (
    <section className="panel dashboard-panel" aria-label="Caelestia dashboard">
      <div className="panel-handle" />
      <header className="dashboard-tabs">
        <div className="tab-list" role="tablist">
          {dashboardTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <IconButton label="Close dashboard" icon={X} onClick={close} />
      </header>
      <div className="dashboard-content">
        {activeTab === "dashboard" && (
          <DashboardHome
            now={now}
            playing={playing}
            setPlaying={setPlaying}
          />
        )}
        {activeTab === "media" && (
          <MediaTab playing={playing} setPlaying={setPlaying} />
        )}
        {activeTab === "performance" && <PerformanceTab />}
        {activeTab === "weather" && <WeatherTab />}
      </div>
    </section>
  );
}

function LauncherPanel({
  search,
  setSearch,
  close,
  openApp,
}: {
  search: string;
  setSearch: (value: string) => void;
  close: () => void;
  openApp: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = launcherApps.filter((app) =>
    `${app.name} ${app.subtitle}`.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <section className="panel launcher-panel" aria-label="Application launcher">
      <div className="launcher-results">
        <div className="launcher-heading">
          <div>
            <span className="eyebrow">Applications</span>
            <h3>{search ? `Results for “${search}”` : "Suggested"}</h3>
          </div>
          <span>{filtered.length} items</span>
        </div>
        <div className="app-list">
          {filtered.map((app, index) => {
            const Icon = app.icon;
            return (
              <button
                type="button"
                className={index === 0 ? "selected" : ""}
                key={app.name}
                onClick={() => openApp(app.name)}
              >
                <span className={`app-icon ${app.accent}`}>
                  <Icon />
                </span>
                <span>
                  <b>{app.name}</b>
                  <small>{app.subtitle}</small>
                </span>
                <span className="launch-key">{index === 0 ? "↵" : ""}</span>
              </button>
            );
          })}
          {!filtered.length && (
            <div className="empty-results">
              <Search />
              <b>No matching apps</b>
              <span>Try another name or type &gt; for a command.</span>
            </div>
          )}
        </div>
      </div>
      <label className="launcher-search">
        <Search />
        <input
          ref={inputRef}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={'Type ">" for commands'}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Enter" && filtered[0]) openApp(filtered[0].name);
          }}
        />
        <kbd>esc</kbd>
      </label>
    </section>
  );
}

function SessionPanel({ close }: { close: () => void }) {
  return (
    <section className="panel session-panel" aria-label="Power menu">
      <IconButton label="Log out" icon={LogOut} />
      <IconButton label="Shut down" icon={Power} />
      <Image
        src="/bongocat.gif"
        alt="Animated Bongo Cat"
        width={62}
        height={62}
        unoptimized
      />
      <IconButton label="Hibernate" icon={BedDouble} />
      <IconButton label="Restart" icon={RotateCcw} />
      <button type="button" className="session-close" onClick={close}>
        esc
      </button>
    </section>
  );
}

function QuickSettings({
  toggles,
  setToggle,
  volume,
  setVolume,
  brightness,
  setBrightness,
  close,
}: {
  toggles: Record<string, boolean>;
  setToggle: (key: string) => void;
  volume: number;
  setVolume: (value: number) => void;
  brightness: number;
  setBrightness: (value: number) => void;
  close: () => void;
}) {
  return (
    <section className="panel quick-settings" aria-label="Quick settings">
      <header className="card-heading">
        <div>
          <span className="eyebrow">Connected</span>
          <h3>Quick settings</h3>
        </div>
        <IconButton label="Close quick settings" icon={X} onClick={close} />
      </header>
      <div className="toggle-grid">
        <Toggle
          label="Wi-Fi"
          icon={Wifi}
          value={toggles.wifi}
          onChange={() => setToggle("wifi")}
        />
        <Toggle
          label="Bluetooth"
          icon={Bluetooth}
          value={toggles.bluetooth}
          onChange={() => setToggle("bluetooth")}
        />
        <Toggle
          label="Night light"
          icon={Moon}
          value={toggles.night}
          onChange={() => setToggle("night")}
        />
        <Toggle
          label="Do not disturb"
          icon={Bell}
          value={toggles.dnd}
          onChange={() => setToggle("dnd")}
        />
      </div>
      <label className="range-row">
        <span>
          <Volume2 />
          Volume
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
        <b>{volume}%</b>
      </label>
      <label className="range-row">
        <span>
          <Sun />
          Brightness
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness}
          onChange={(event) => setBrightness(Number(event.target.value))}
        />
        <b>{brightness}%</b>
      </label>
      <button className="settings-link" type="button">
        <Settings2 /> Open Settings <ChevronRight />
      </button>
    </section>
  );
}

function NotificationSidebar({
  close,
  clear,
  showNotifications,
}: {
  close: () => void;
  clear: () => void;
  showNotifications: boolean;
}) {
  return (
    <aside className="panel notification-sidebar" aria-label="Notifications">
      <header className="sidebar-header">
        <div>
          <span className="eyebrow">Today</span>
          <h2>Notifications</h2>
        </div>
        <div>
          <button type="button" onClick={clear}>
            Clear
          </button>
          <IconButton label="Close notifications" icon={X} onClick={close} />
        </div>
      </header>
      <div className="notification-list">
        {showNotifications ? (
          <>
            <article className="notification-card">
              <span className="notification-app blue">
                <Github />
              </span>
              <div>
                <header>
                  <b>GitHub</b>
                  <small>2m</small>
                </header>
                <strong>Portfolio build is ready</strong>
                <p>Your latest changes passed all checks.</p>
              </div>
            </article>
            <article className="notification-card">
              <span className="notification-app pink">
                <CalendarDays />
              </span>
              <div>
                <header>
                  <b>Calendar</b>
                  <small>18m</small>
                </header>
                <strong>Design review in 30 minutes</strong>
                <p>Final walkthrough · Studio room</p>
              </div>
            </article>
            <article className="notification-card">
              <span className="notification-app cyan">
                <MessageCircle />
              </span>
              <div>
                <header>
                  <b>Messages</b>
                  <small>1h</small>
                </header>
                <strong>Nice work on the new concept!</strong>
                <p>The transitions feel incredibly smooth.</p>
              </div>
            </article>
          </>
        ) : (
          <div className="all-clear">
            <Sparkles />
            <h3>All clear</h3>
            <p>You have no new notifications.</p>
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <span>
          <Moon /> Do not disturb
        </span>
        <button type="button" aria-label="Toggle do not disturb" />
      </div>
    </aside>
  );
}

function AppWindowPreview({
  app,
  close,
}: {
  app: string;
  close: () => void;
}) {
  return (
    <section className="desktop-window" aria-label={`${app} preview`}>
      <header>
        <span>
          <AppWindow />
          {app}
        </span>
        <div>
          <button type="button" aria-label="Minimize window">
            <Minus />
          </button>
          <button type="button" aria-label="Maximize window">
            <Maximize2 />
          </button>
          <button type="button" aria-label="Close window" onClick={close}>
            <X />
          </button>
        </div>
      </header>
      <div className="window-content">
        <span className="window-icon">
          {app === "Terminal" ? <Terminal /> : <BriefcaseBusiness />}
        </span>
        <span className="eyebrow">Caelestia web demo</span>
        <h2>{app} is ready for your content.</h2>
        <p>
          This simulated window will become a focused section of your CV and
          portfolio in the next iteration.
        </p>
        <button type="button" onClick={close}>
          Got it
        </button>
      </div>
    </section>
  );
}

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [mainPanel, setMainPanel] = useState<MainPanel>("dashboard");
  const [activeTab, setActiveTab] = useState<DashboardTab>("dashboard");
  const [activeWorkspace, setActiveWorkspace] = useState(1);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [search, setSearch] = useState("");
  const [openApp, setOpenApp] = useState<string | null>(null);
  const [volume, setVolume] = useState(72);
  const [brightness, setBrightness] = useState(84);
  const [toggles, setToggles] = useState({
    wifi: true,
    bluetooth: true,
    night: false,
    dnd: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowQuickSettings(false);
        setMainPanel((current) => (current === "launcher" ? null : "launcher"));
      }
      if (event.key === "Escape") {
        setMainPanel(null);
        setShowQuickSettings(false);
        setShowSidebar(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleSetting = (key: string) => {
    setToggles((current) => ({ ...current, [key]: !current[key as keyof typeof current] }));
  };

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  return (
    <main className={`desktop ${toggles.night ? "night-mode" : ""}`}>
      <div className="wallpaper" aria-hidden="true" />
      <div className="ambient-glow" aria-hidden="true" />

      <nav className="shell-rail" aria-label="Desktop controls">
        <button
          className={`caelestia-button ${mainPanel === "launcher" ? "active" : ""}`}
          type="button"
          onClick={() => {
            setMainPanel(mainPanel === "launcher" ? null : "launcher");
            setShowQuickSettings(false);
          }}
          aria-label="Open application launcher"
          title="Launcher · Ctrl K"
        >
          <Image
            src="/caelestia-logo.svg"
            alt=""
            width={27}
            height={27}
            priority
          />
        </button>

        <div className="workspace-switcher" aria-label="Workspaces">
          {[1, 2, 3, 4, 5].map((workspace) => (
            <button
              key={workspace}
              type="button"
              className={activeWorkspace === workspace ? "active" : ""}
              onClick={() => setActiveWorkspace(workspace)}
              aria-label={`Workspace ${workspace}`}
              aria-current={activeWorkspace === workspace ? "page" : undefined}
            >
              <span>{workspace}</span>
            </button>
          ))}
        </div>

        <div className="rail-spacer" />

        <button
          className={`active-app ${mainPanel === "dashboard" ? "active" : ""}`}
          type="button"
          onClick={() => {
            setMainPanel(mainPanel === "dashboard" ? null : "dashboard");
            setShowQuickSettings(false);
          }}
          aria-label="Toggle dashboard"
          title="Dashboard"
        >
          <Monitor />
          <span>Caelestia Web</span>
        </button>

        <div className="rail-tray">
          <IconButton label="Keyboard layout" icon={Keyboard} />
          <IconButton label="Microphone" icon={Mic2} />
        </div>

        <button
          className="rail-clock"
          type="button"
          onClick={() => setMainPanel("dashboard")}
          aria-label={`Current time ${formatTime(now)}`}
        >
          <span>{formatTime(now).split(":")[0]}</span>
          <i />
          <span>{formatTime(now).split(":")[1]}</span>
        </button>

        <button
          className={`status-cluster ${showQuickSettings ? "active" : ""}`}
          type="button"
          onClick={() => {
            setShowQuickSettings(!showQuickSettings);
            setMainPanel(null);
          }}
          aria-label="Open quick settings"
        >
          <Wifi />
          <Bluetooth />
          <BatteryMedium />
        </button>

        <button
          className={`power-button ${mainPanel === "session" ? "active" : ""}`}
          type="button"
          onClick={() => {
            setMainPanel(mainPanel === "session" ? null : "session");
            setShowQuickSettings(false);
          }}
          aria-label="Open power menu"
        >
          <Power />
        </button>
      </nav>

      <section className="desktop-greeting" aria-label="Desktop greeting">
        <span>{greeting}, Hieu</span>
        <small>Workspace {activeWorkspace} · Ready</small>
      </section>

      {mainPanel === "dashboard" && (
        <DashboardPanel
          now={now}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          playing={playing}
          setPlaying={setPlaying}
          close={() => setMainPanel(null)}
        />
      )}

      {mainPanel === "launcher" && (
        <LauncherPanel
          search={search}
          setSearch={setSearch}
          close={() => setMainPanel(null)}
          openApp={(app) => {
            setOpenApp(app);
            setMainPanel(null);
          }}
        />
      )}

      {mainPanel === "session" && (
        <>
          <button
            className="scrim"
            type="button"
            aria-label="Close power menu"
            onClick={() => setMainPanel(null)}
          />
          <SessionPanel close={() => setMainPanel(null)} />
        </>
      )}

      {showQuickSettings && (
        <QuickSettings
          toggles={toggles}
          setToggle={toggleSetting}
          volume={volume}
          setVolume={setVolume}
          brightness={brightness}
          setBrightness={setBrightness}
          close={() => setShowQuickSettings(false)}
        />
      )}

      <div className="desktop-utilities">
        <IconButton label="Headphones" icon={Headphones} />
        <IconButton
          label="Notifications"
          icon={Bell}
          active={showSidebar}
          onClick={() => setShowSidebar(!showSidebar)}
        />
        <IconButton label="Screen tools" icon={MousePointer2} />
      </div>

      {showSidebar && (
        <NotificationSidebar
          close={() => setShowSidebar(false)}
          clear={() => setShowNotifications(false)}
          showNotifications={showNotifications}
        />
      )}

      {openApp && (
        <AppWindowPreview app={openApp} close={() => setOpenApp(null)} />
      )}

      <div className="explore-hint">
        <Sparkles />
        <span>Explore the shell</span>
        <kbd>Ctrl K</kbd>
        <i />
        <span>Open launcher</span>
      </div>

      <a
        className="source-credit"
        href="https://github.com/caelestia-dots/shell"
        target="_blank"
        rel="noreferrer"
      >
        Inspired by Caelestia Shell <Github />
      </a>
    </main>
  );
}
