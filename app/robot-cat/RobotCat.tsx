import { useEffect, useRef, useState } from "react";

type CatRuntime = { mount: (canvas: HTMLCanvasElement, ready: () => void, fail: (error: unknown) => void) => () => void };
declare global { interface Window { HyperDRobotCat?: CatRuntime } }
let runtime: Promise<CatRuntime> | undefined;
function loadRuntime() {
  return runtime ??= new Promise<CatRuntime>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("./assets/robot-cat.js", document.baseURI).href;
    script.onload = () => window.HyperDRobotCat ? resolve(window.HyperDRobotCat) : reject(new Error("Missing cat runtime"));
    script.onerror = () => { runtime = undefined; script.remove(); reject(new Error("Cat runtime unavailable")); };
    document.head.append(script);
  });
}

export function RobotCat() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    loadRuntime().then(module => {
      if (!cancelled && canvas.current) dispose = module.mount(canvas.current, () => setState("ready"), error => {
        console.error("Robot cat:", error); setState("fallback");
      });
    }).catch(error => { if (!cancelled) { console.error(error); setState("fallback"); } });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <div className="robot-cat-stage" data-state={state}>
    <div className="robot-cat-halo" aria-hidden="true" />
    <div className="robot-cat-platform" aria-hidden="true" />
    {state !== "ready" && <img className="robot-cat-fallback" src="./public/robot-cat-preview.png" alt="Robot cat" />}
    <canvas ref={canvas} tabIndex={0} aria-label="Interactive robot cat. Touch to interact, drag to rotate. Enter to greet, Space to pause." />
  </div>;
}
