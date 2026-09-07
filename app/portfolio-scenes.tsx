import { Box, Braces, Cpu, Layers3, MousePointer2, PenTool, Scissors, Smartphone, Square, WandSparkles } from "lucide-react";
import androidMatte from "../public/hieu-android-mask.png";

const designStudies = [
  { id: "label", app: "Ai", file: "citrus-label.ai", tool: "Illustrator", title: "Packaging & labels", image: "concept-label.png", alt: "LUMA citrus beverage label concept with print artwork and crop marks" },
  { id: "retouch", app: "Ps", file: "citrus-campaign.psd", tool: "Photoshop", title: "Retouch & composite", image: "concept-retouch.png", alt: "Orange beverage can advertising composite with water splashes and citrus" },
  { id: "motion", app: "Pr", file: "launch-film.prproj", tool: "Video & exhibition", title: "From product to space", image: "concept-booth.png", alt: "LUMA beverage exhibition booth concept featuring a giant product can and video screen" },
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
      <figcaption><span>0{index + 1} / {study.tool}</span><strong>{study.title}</strong><small>Concept study</small></figcaption>
    </figure>)}
  </section>;
}

const developerPanels = [
  { id: "web", icon: Braces, file: "experience.tsx", title: "WEB", lines: [<>export default <b>function</b> Experience() {'{'}</>, <>  <b>return</b> &lt;<em>Canvas</em> /&gt;;</>, <>{'}'}</>], footer: "React / TypeScript" },
  { id: "app", icon: Smartphone, file: "AppShell.cs", title: "APP", lines: [<><b>await</b> app.<em>InitializeAsync</em>();</>, <>window.<em>Show</em>();</>, <>workspace.<em>Connect</em>();</>], footer: "C# / Desktop" },
  { id: "game", icon: Box, file: "World.cs", title: "GAME", lines: [<><b>void</b> Update() {'{'}</>, <>  world.<em>Simulate</em>(deltaTime);</>, <>{'}'}</>], footer: "Unity / Real-time 3D" },
  { id: "ai", icon: Cpu, file: "agent.py", title: "AI", lines: [<><b>async def</b> run(task):</>, <>  plan = <b>await</b> agent.<em>plan</em>(task)</>, <>  <b>return await</b> plan.<em>execute</em>()</>], footer: "Agents / Automation" },
];

const binaryRows = [
  "01101000 01101001 01100101 01110101 01110000",
  "01100100 01100101 01110011 01101001 01100111",
  "01101110 01100101 01110010 01100001 01110100",
  "01100101 01100100 01101111 01110010 01100101",
  "01111000 01100101 01100011 01110101 01110100",
  "01100101 01101100 01101111 01100111 01101001",
  "01100011 01100001 01101100 01101100 01111001",
  "01110011 01110100 01110010 01110101 01100011",
];

function BinaryMatrix() {
  return <div className="binary-matrix" aria-hidden="true">
    <div className="binary-matrix__stream">
      {binaryRows.concat(binaryRows, binaryRows).map((row, index) => <span key={`${row}-${index}`}>{row}</span>)}
    </div>
    <i className="binary-matrix__scan" />
  </div>;
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
    {workspace === 5 && <BinaryMatrix />}
    <div className="android-stage">
      <img className="android-portrait" src={workspace === 3 ? "./public/hieu-android-cutout.png" : "./public/hieu-android-red.png"}
        style={{ maskImage: `url(${androidMatte})`, maskMode: "luminance", maskSize: "contain", maskPosition: "bottom center", maskRepeat: "no-repeat" }}
        alt={workspace === 3 ? "Hieu Pham reimagined as a 3D ceramic and titanium android" : "Hieu Pham as a dark 3D android with crimson circuitry"}
        width={1024} height={1536} />
    </div>
    {workspace === 5 && <DeveloperPanels />}
  </div>;
}
