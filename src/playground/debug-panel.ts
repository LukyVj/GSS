import "./debug-panel.css";
import type { CompiledScene } from "../compiler";
import type { DebugPanel } from "../compiler/features/debug-panel";
import { MAX_IMAGES } from "../compiler/features/textures";
import type { Row } from "../profiler/format";
import { STEPS_MAX, type Steps } from "./steps-reader";

// The debug panel (decision 204): over the bottom-left corner of the render, in the playground
// and in "Try it" of the docs, when the scene asks for it with @debug-panel. As much as the page
// knows about the scene: the colors of the axes the shader draws, the backend, the camera as the
// GSS that puts it there, what the scene holds, the steps of view: steps read back from the
// render, and in the playground the rows of the performance panel, measured while it is open.

type Scene = Pick<
  CompiledScene,
  "debugPanel" | "objects" | "lights" | "textures" | "shader" | "wgsl" | "properties" | "hover" | "active" | "timelines" | "passes" | "media"
>;
type Backend = "webgl" | "webgpu";
type Camera = { yaw: number; pitch: number; distance: number };

// The performance panel of the playground: its rows, and whether to measure for this panel
export type Perf = { rows(): Row[] | null; watch(on: boolean): void };

// What the page knows besides the compile: each is left out where the page does not know it
export type Sources = {
  perf?: Perf;
  backend?: Backend;
  camera?(): Camera;
  steps?(): Steps | null; // the last frame of view: steps, read back (steps-reader.ts)
};

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const lines = (code: string) => code.split("\n").length;

// What the scene holds, from its last compile; the rarer parts only when it uses them
export function debugRows(scene: Scene, backend: Backend = "webgl"): Row[] {
  const hover = scene.hover.length;
  const active = scene.active?.length ?? 0;
  const passes = scene.passes?.length ?? 0;
  // @gpu (decision 212): its conditions sit among the @media queries
  const conditions = scene.media?.queries ?? [];
  const lighter = conditions.some((query) => query.startsWith("@gpu "));
  const queries = conditions.filter((query) => !query.startsWith("@gpu ")).length;
  return [
    { label: "objects", value: String(scene.objects) },
    { label: "lights", value: String(scene.lights ?? 0) },
    { label: "images", value: `${scene.textures.length} / ${MAX_IMAGES}` },
    ...(scene.properties ? [{ label: "variables", value: String(scene.properties.length) }] : []),
    ...(hover + active > 0 ? [{ label: "states", value: `hover ${hover} · active ${active}` }] : []),
    ...(scene.timelines ? [{ label: "timelines", value: String(scene.timelines.length) }] : []),
    ...(passes > 0 ? [{ label: "filters", value: plural(passes, "pass", "passes") }] : []),
    ...(queries > 0 ? [{ label: "media", value: plural(queries, "query", "queries") }] : []),
    ...(lighter ? [{ label: "gpu", value: "lighter version" }] : []),
    // the code the GPU runs (the shader row of the performance panel is its build time)
    backend === "webgpu" && scene.wgsl
      ? { label: "wgsl", value: `${lines(scene.wgsl)} lines` }
      : { label: "glsl", value: `${lines(scene.shader)} lines` },
  ];
}

// Where the camera is, as the GSS that puts it there: drag the scene, then copy it
const degrees = (radians: number) => `${+((radians * 180) / Math.PI).toFixed(1)}deg`;
export const cameraRows = (camera: Camera): Row[] => [
  { label: "camera-angle", value: `${degrees(camera.yaw)} ${degrees(camera.pitch)}` },
  { label: "camera-distance", value: String(+camera.distance.toFixed(2)) },
];

// view: steps: the mean and the max of the calls of map() per pixel, and the share of pixels at
// the top of the scale; before the view shows them, where to read them
export function stepsRows(steps: Steps | null): Row[] {
  if (!steps) return [{ label: "steps", value: "view: steps", missing: true }];
  const top = (n: number) => (n >= STEPS_MAX ? `${STEPS_MAX}+` : String(Math.round(n)));
  const hot = +(steps.hot * 100).toFixed(1);
  return [
    { label: "steps", value: `mean ${Math.round(steps.mean)} · max ${top(steps.max)}` },
    { label: `${STEPS_MAX}+`, value: `${hot} % of pixels`, ...(hot > 0 ? { warning: true } : {}) },
  ];
}

// x, y and z in the colors of their axes
function axes(): HTMLElement {
  const dd = document.createElement("dd");
  dd.className = "debug-axes";
  dd.append(
    ...["x", "y", "z"].flatMap((name, i) => {
      const axis = document.createElement("span");
      axis.className = `debug-axis-${name}`;
      axis.textContent = name;
      return i === 0 ? [axis] : [" ", axis];
    }),
  );
  return dd;
}

function line(row: Row): HTMLElement[] {
  const dt = document.createElement("dt");
  dt.textContent = row.label;
  const dd = document.createElement("dd");
  dd.textContent = row.value;
  dd.classList.toggle("missing", row.missing === true);
  dd.classList.toggle("warning", row.warning === true);
  return [dt, dd];
}

let panels = 0;

export function mountDebugPanel(parent: HTMLElement, sources: Sources = {}) {
  const { perf } = sources;
  const panel = document.createElement("section");
  panel.className = "debug-panel";
  panel.hidden = true;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "debug-toggle";
  toggle.textContent = "debug";
  const list = document.createElement("dl");
  list.className = "debug-list";
  list.id = `debug-list-${++panels}`; // the docs may hold a panel of their own
  toggle.setAttribute("aria-controls", list.id);
  panel.append(toggle, list);
  parent.append(panel); // a grid item: the CSS puts it in the cell of the render

  let scene: Scene | null = null;
  let folded = false;
  let asked: DebugPanel | undefined; // the display the code asked for last
  let watching = false;

  function render(): void {
    if (!scene || panel.hidden || folded) return;
    const axesTerm = document.createElement("dt");
    axesTerm.textContent = "axes";
    const rows = [
      ...(sources.backend ? [{ label: "backend", value: sources.backend === "webgpu" ? "WebGPU" : "WebGL2" }] : []),
      ...(sources.camera ? cameraRows(sources.camera()) : []),
      ...debugRows(scene, sources.backend),
      // the shader of view: steps, whether the code or a chip asked for it
      ...(sources.steps ? stepsRows(scene.shader.includes("stepsColor(") ? sources.steps() : null) : []),
      ...(perf?.rows() ?? []),
    ];
    list.replaceChildren(axesTerm, axes(), ...rows.flatMap(line));
  }

  // Measure only while the numbers are on screen: then the scene draws every frame for them
  function show(): void {
    toggle.setAttribute("aria-expanded", String(!folded));
    list.hidden = folded;
    const watch = !panel.hidden && !folded;
    if (perf && watch !== watching) perf.watch(watch);
    watching = watch;
    render();
  }

  toggle.addEventListener("click", () => {
    folded = !folded;
    show();
  });
  const timer = setInterval(render, 500); // twice a second, like the performance panel

  return {
    // After each compile: the numbers of the scene now on screen, and its @debug-panel
    update(next: Scene): void {
      scene = next;
      const display = next.debugPanel;
      // The viewer's click holds until the code changes the display
      if (display && display !== asked) folded = display === "folded";
      asked = display;
      panel.hidden = !display;
      show();
    },
    destroy(): void {
      clearInterval(timer);
      if (perf && watching) perf.watch(false);
      panel.remove();
    },
  };
}
