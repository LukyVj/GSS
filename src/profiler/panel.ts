import "./panel.css";
import { createProfiler, type FrameProbe } from "./profiler";
import { createGpuTimer } from "./gpu-timer";
import type { GpuTimer } from "./gpu-timer";
import { createWebGPUTimer, type WebGPUTimer } from "./webgpu-timer";
import { reportRows } from "./format";

let profiler: ReturnType<typeof createProfiler> | null = null;
let timerFactory: (() => GpuTimer | WebGPUTimer) | null = null;
let timer: GpuTimer | WebGPUTimer | null = null;
let backendLabel = "WebGL2";
let wanted = false; // the panel has been opened at least once
let lastShaderMs: number | null = null; // the build before the panel opened, shown when it does

// Where the visitor's choice is kept. Not "gss-perf": while the panel was open by
// default, every visit saved "1" there, so it would keep the panel open for them.
export const STORAGE_KEY = "gss-perf-panel";

// Given to createRenderer: view.ts calls it once, with its WebGL context.
// Nothing is measured until the panel is first opened (decision 87): no GPU timer,
// no query, the probe's calls do nothing. Once opened, it keeps measuring.
export function profile(gl: WebGL2RenderingContext): FrameProbe {
  backendLabel = "WebGL2";
  return connect(() => createGpuTimer(gl));
}

export function profileWebGPU(device: GPUDevice): FrameProbe {
  backendLabel = "WebGPU";
  return connect(() => createWebGPUTimer(device));
}

function connect(factory: () => GpuTimer | WebGPUTimer): FrameProbe {
  timerFactory = factory;
  if (wanted) start();
  return {
    frameStart: (now, width, height) => profiler?.frameStart(now, width, height),
    drawStart: () => profiler?.drawStart(),
    drawEnd: () => profiler?.drawEnd(),
    shaderBuilt: (ms) => {
      lastShaderMs = ms;
      profiler?.shaderBuilt(ms);
    },
    timestampWrites: (first, last) => timer && "timestampWrites" in timer ? timer.timestampWrites(first, last) : undefined,
    resolveTimestamps: encoder => { if (timer && "resolve" in timer) timer.resolve(encoder); },
    timestampsSubmitted: () => { if (timer && "submitted" in timer) timer.submitted(); },
    destroy: () => { timer?.destroy(); timer = null; profiler = null; timerFactory = null; },
  };
}

// The profiler, made the first time the panel opens (or when the scene's context
// arrives, if the panel was already open)
function start(): void {
  wanted = true;
  if (profiler || !timerFactory) return;
  timer = timerFactory();
  profiler = createProfiler(timer);
  if (lastShaderMs !== null) profiler.shaderBuilt(lastShaderMs);
}

// The panel over the scene, its toggle in the status bar; Alt+P shows or hides it.
// Public on gss-lang.dev (decision 87), hidden until someone opens it.
export function mountPanel(statusbar: HTMLElement): void {
  const panel = document.createElement("section");
  panel.className = "perf-panel";
  panel.hidden = true;
  panel.innerHTML = `<h2>performance · ${backendLabel}</h2><dl></dl>`;
  document.body.append(panel); // a grid item of <body>: the CSS puts it in the scene cell
  const list = panel.querySelector("dl")!;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "perf-toggle";
  toggle.textContent = "perf";
  statusbar.append(toggle);

  function render() {
    if (!profiler || !visible) return;
    const rows = reportRows(profiler.report());
    list.replaceChildren(
      ...rows.flatMap((row) => {
        const dt = document.createElement("dt");
        dt.textContent = row.label;
        const dd = document.createElement("dd");
        dd.textContent = row.value;
        dd.classList.toggle("missing", row.missing === true);
        dd.classList.toggle("warning", row.warning === true);
        return [dt, dd];
      }),
    );
  }

  let visible = false; // the state lives here; the DOM only shows it

  // remember: only a choice of the visitor is kept, never the default
  function setVisible(next: boolean, remember = true) {
    visible = next;
    if (next) start();
    panel.hidden = !next;
    toggle.setAttribute("aria-pressed", String(visible));
    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, visible ? "1" : "0"); // remembered across reloads
      } catch {} // private window: just not remembered
    }
    render();
  }

  toggle.addEventListener("click", () => setVisible(!visible));
  window.addEventListener("keydown", (event) => {
    // event.code, not event.key: on a Mac, Alt+P types "π"
    if (event.altKey && event.code === "KeyP") {
      event.preventDefault();
      setVisible(!visible);
    }
  });
  setInterval(render, 500); // twice a second: readable, and cheap

  // Closed by default (decision 87): opened with the perf button or Alt+P, and then
  // remembered across reloads
  let remembered = false;
  try {
    remembered = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {}
  setVisible(remembered, false);
}
