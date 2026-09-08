import { Box, Braces, Cpu, Layers3, MousePointer2, PenTool, Scissors, Smartphone, Square, WandSparkles } from "lucide-react";
import androidMatte from "../public/hieu-android-mask.png";

const designStudies = [
  { id: "label", app: "Ai", file: "Vinut coco boba.ai", tool: "Illustrator", title: "Packaging & labels", image: "vinut-coco-boba-label.webp", alt: "Vinut Coco Boba coconut milk tea label artwork" },
  { id: "retouch", app: "Ps", file: "Coco boba tini world.psd", tool: "Photoshop", title: "Retouch & composite", image: "coco-boba-poster.webp", alt: "Vinut Coco Boba tiny world advertising poster" },
  { id: "motion", app: "Pr", file: "launch-film.prproj", tool: "Video & exhibition", title: "From product to space", image: "nam-viet-group-booth.webp", alt: "Nam Viet Group beverage exhibition booth" },
];

function DesignShowcase() {
  return <section className="design-showcase" aria-label="Illustrative design concept studies">
    {designStudies.map((study, index) => <figure key={study.id} className={`design-card design-card--${study.id}`}>
      <div className="editor-topbar" aria-hidden="true"><b>{study.app}</b><span>{study.file}</span><i /><i /><i /></div>
      <div className="editor-canvas">
        <div className="editor-tools" aria-hidden="true"><MousePointer2 /><PenTool /><Square /><WandSparkles /><Layers3 /></div>
        <img src={`./public/${study.image}`} alt={study.alt} width={1086} height={1448} />
        {study.id === "label" && <span className="artwork-selection" aria-hidden="true"><i /><i /><i /><i /></span>}
        {study.id === "retouch" && <span className="layer-indicator" aria-hidden="true"><Layers3 /> 08 layers</span>}
      </div>
      {study.id === "motion" && <div className="editor-timeline" aria-hidden="true"><Scissors /><div><i /><i /><i /></div><span /></div>}
      <figcaption><span>0{index + 1} / {study.tool}</span><strong>{study.title}</strong><small>Portfolio work</small></figcaption>
    </figure>)}
  </section>;
}

const developerPanels = [
  { id: "web", icon: Braces, file: "experience.tsx", title: "WEB", lines: [<>export default <b>function</b> Experience() {'{'}</>, <>  <b>return</b> &lt;<em>Canvas</em> /&gt;;</>, <>{'}'}</>], footer: "React / TypeScript" },
  { id: "app", icon: Smartphone, file: "AppShell.cs", title: "APP", lines: [<><b>await</b> app.<em>InitializeAsync</em>();</>, <>window.<em>Show</em>();</>, <>workspace.<em>Connect</em>();</>], footer: "C# / Desktop" },
  { id: "game", icon: Box, file: "World.cs", title: "GAME", lines: [<><b>void</b> Update() {'{'}</>, <>  world.<em>Simulate</em>(deltaTime);</>, <>{'}'}</>], footer: "Unity / Real-time 3D" },
  { id: "ai", icon: Cpu, file: "agent.py", title: "AI", lines: [<><b>async def</b> run(task):</>, <>  plan = <b>await</b> agent.<em>plan</em>(task)</>, <>  <b>return await</b> plan.<em>execute</em>()</>], footer: "Agents / Automation" },
];

function DeveloperAtmosphere() {
  return <>
    <div className="developer-code-backdrop" aria-hidden="true">
      <img src="./public/code-field.svg" alt="" width={1200} height={1200} />
    </div>
    <div className="developer-particles" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
    </div>
  </>;
}

function DeveloperPanels() {
  return <div className="developer-panels" aria-label="App, web, game and AI development illustrations">
    {developerPanels.map(({ id, icon: Icon, file, title, lines, footer }) => <figure key={id} className={`code-panel code-panel--${id}`}>
      <figcaption><Icon aria-hidden="true" /><strong>{title}</strong><span>{file}</span><i aria-hidden="true" /></figcaption>
      <div className="code-lines" aria-hidden="true">{lines.map((line, index) => <div key={index}><span>{index + 1}</span><code>{line}</code></div>)}</div>
      <footer>{footer}<span aria-hidden="true">↗</span></footer>
    </figure>)}
  </div>;
}

export function PortfolioScene({ workspace }: { workspace: number }) {
  if (workspace === 4) return <DesignShowcase />;
  if (workspace !== 3 && workspace !== 5) return null;
  return <div className={`technology-scene ${workspace === 5 ? "technology-scene--developer" : "technology-scene--android"}`}>
    {workspace === 5 && <DeveloperAtmosphere />}
    <div className="android-stage">
      <img className="android-portrait" src={workspace === 3 ? "./public/hieu-android-cutout.png" : "./public/hieu-android-red.png"}
        style={{ maskImage: `url(${androidMatte})`, maskMode: "luminance", maskSize: "contain", maskPosition: "bottom center", maskRepeat: "no-repeat" }}
        alt={workspace === 3 ? "Hieu Pham reimagined as a 3D ceramic and titanium android" : "Hieu Pham as a dark 3D android with crimson circuitry"}
        width={1024} height={1536} />
    </div>
    {workspace === 5 && <DeveloperPanels />}
  </div>;
}
