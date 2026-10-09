import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { desktopViewport } from "./viewport";

export function DesktopViewport({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ReturnType<typeof desktopViewport> | null>(null);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const pointer = window.matchMedia?.("(pointer: fine)");
    const resize = () => {
      const next = desktopViewport(frame.clientWidth || window.innerWidth, frame.clientHeight || window.innerHeight, pointer?.matches);
      setViewport(current => current?.width === next.width && current.height === next.height && current.scale === next.scale
        && current.desktop === next.desktop ? current : next);
    };
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(frame);
    window.addEventListener("resize", resize);
    pointer?.addEventListener("change", resize);
    return () => { observer?.disconnect(); window.removeEventListener("resize", resize); pointer?.removeEventListener("change", resize); };
  }, []);
  return <div className="desktop-viewport" ref={frameRef}>
    <div className="desktop-canvas" data-mode={viewport?.desktop ? "desktop" : "responsive"}
      style={{ width: viewport?.width, height: viewport?.height, "--desktop-scale": viewport?.scale ?? 1 } as CSSProperties}>
      {children}
    </div>
  </div>;
}
