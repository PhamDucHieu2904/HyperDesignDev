import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { desktopViewport } from "../desktop/viewport";
import { categoryLabels } from "./data";
import type { PortfolioProject } from "./types";

function FeatureContent({ project }: { project: PortfolioProject }) {
  return <>
    <figure className="pf-feature-cover">
      <img src={project.thumbnail.src} alt={project.thumbnail.alt} width={project.thumbnail.width}
        height={project.thumbnail.height} />
    </figure>
    <div className="pf-feature-copy">
      <small>Featured / {categoryLabels[project.primaryCategory]}</small>
      <h1>{project.shortTitle}</h1>
      <p>{project.summary}</p>
      <span>{project.year}</span>
    </div>
  </>;
}

export function FeaturedCarousel({ projects, onOpen }: {
  projects: PortfolioProject[]; onOpen: (project: PortfolioProject) => void;
}) {
  const [slide, setSlide] = useState<{ id: string; previous: PortfolioProject | null }>({ id: projects[0]?.id ?? "", previous: null });
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [desktop, setDesktop] = useState(() => desktopViewport(window.innerWidth, window.innerHeight,
    window.matchMedia?.("(pointer: fine)").matches).desktop);
  const feature = projects.find(project => project.id === slide.id) ?? projects[0];
  const projectIds = projects.map(project => project.id).join("|");

  useEffect(() => {
    const pointer = window.matchMedia?.("(pointer: fine)");
    const update = () => setDesktop(desktopViewport(window.innerWidth, window.innerHeight, pointer?.matches).desktop);
    window.addEventListener("resize", update);
    pointer?.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      pointer?.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    setSlide({ id: projects[0]?.id ?? "", previous: null });
  }, [projectIds]);

  useEffect(() => {
    const onVisibilityChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const show = (next: PortfolioProject) => {
    if (!feature || next.id === feature.id) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setSlide({ id: next.id, previous: reducedMotion ? null : feature });
  };

  useEffect(() => {
    if (!desktop || !feature || projects.length < 2 || paused || hovered || keyboardFocused || hidden) return;
    const timer = window.setInterval(() => {
      const candidates = projects.filter(project => project.id !== feature.id);
      show(candidates[Math.floor(Math.random() * candidates.length)]);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [projects, feature?.id, paused, hovered, keyboardFocused, hidden, desktop]);

  useEffect(() => {
    if (!slide.previous) return;
    const timer = window.setTimeout(() => setSlide(current => ({ ...current, previous: null })), 450);
    return () => window.clearTimeout(timer);
  }, [slide.id, slide.previous]);

  if (!feature) return null;
  const move = (offset: number) => {
    const current = projects.findIndex(project => project.id === feature.id);
    show(projects[(current + offset + projects.length) % projects.length]);
  };

  return <section className="pf-feature" aria-label="Featured portfolio project" aria-live="off"
    data-project-id={feature.id} data-sliding={slide.previous ? "true" : "false"}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={event => setKeyboardFocused(event.target.matches(":focus-visible"))}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false); }}>
    {slide.previous && <div key={slide.previous.id} className="pf-feature-previous" aria-hidden="true" inert>
      <FeatureContent project={slide.previous} />
      <div className="pf-feature-footer" />
    </div>}
    <FeatureContent key={feature.id} project={feature} />
    <div className="pf-feature-footer">
      <button type="button" className="pf-feature-open" onClick={() => onOpen(feature)}>View project</button>
      {projects.length > 1 && <div className="pf-feature-arrows">
        <button type="button" aria-label={paused ? "Resume automatic portfolio rotation" : "Pause automatic portfolio rotation"}
          title={paused ? "Resume automatic portfolio rotation" : "Pause automatic portfolio rotation"}
          aria-pressed={paused} onClick={() => { setPaused(value => !value); setKeyboardFocused(false); }}>
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
        <button type="button" aria-label="Previous featured project" onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
        <button type="button" aria-label="Next featured project" onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      </div>}
    </div>
  </section>;
}
