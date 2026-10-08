import type { CompiledScene } from "../compiler";
import { createView, type ViewOptions } from "../runtime/view";
import { createViewAsync, type BackendOptions } from "../runtime/backend";
import { usesElements } from "../runtime/textures";
import { sleepOffscreen } from "../runtime/offscreen";

// gss-lang/runtime: draws a scene compiled at build time (the Vite plugin),
// without shipping the compiler (decision 63). gss-lang (index.ts) adds GSS text.
export type { CompiledScene };
export type { Backend, BackendOptions } from "../runtime/backend";
// No GPU: WebGL drawn on the CPU, where a scene freezes the page (decision 137)
export { softwareRendering } from "../runtime/software";

export type AsyncGssScene = Omit<GssScene, "update"> & {
  readonly backend: "webgl" | "webgpu";
  update(compiled: CompiledScene): Promise<void>;
};

export async function mountAsync(
  canvas: HTMLCanvasElement,
  compiled: CompiledScene,
  options: BackendOptions = {},
): Promise<AsyncGssScene> {
  // element(#id) is drawn with WebGL2 only for now (decision 101): auto picks it for such a scene
  const backend = (options.backend ?? "auto") === "auto" && usesElements(compiled) ? "webgl" : options.backend;
  const view = await createViewAsync(canvas, { ...options, backend });
  try { await view.show(compiled); }
  catch (error) { view.destroy(); throw error; }
  const lifecycle = observe(canvas, view);
  return { ...lifecycle, ...variables(view), backend: view.backend, update: next => view.show(next) };
}

export type MountOptions = ViewOptions;

export type GssScene = {
  // Another scene in the same canvas; the camera the user placed stays
  update(compiled: CompiledScene): void;
  // Stop and start drawing. A scene also sleeps on its own when it leaves the screen, and
  // stops when it is too heavy for the computer, with a gss-too-heavy event on the canvas:
  // play() then draws it anyway.
  pause(): void;
  play(): void;
  // Frees the GPU (a browser keeps about 16 WebGL contexts)
  destroy(): void;
  // A variable the scene registers with @property, set without compiling again, like
  // element.style.setProperty(): scene.setProperty("--speed", "8")
  setProperty(name: string, value: string | number): void;
  getPropertyValue(name: string): string;
  removeProperty(name: string): void;
};

export function mount(
  canvas: HTMLCanvasElement,
  compiled: CompiledScene,
  options: MountOptions = {},
): GssScene {
  const view = createView(canvas, options);
  // GLSL errors at once; a link error comes later, once the driver is done (decision 150)
  try { view.show(compiled).catch((error) => console.error(error)); }
  catch (error) { view.destroy(); throw error; }
  return { ...observe(canvas, view), ...variables(view), update: next => view.show(next) };
}

// @property (decision 105): the variables of the scene, set from the page
function variables(view: Pick<GssScene, "setProperty" | "getPropertyValue" | "removeProperty">) {
  return {
    setProperty: view.setProperty,
    getPropertyValue: view.getPropertyValue,
    removeProperty: view.removeProperty,
  };
}

function observe(canvas: HTMLCanvasElement, view: Pick<GssScene, "pause" | "play" | "destroy"> & { freeze(frozen: boolean): void }) {
  // Off screen: no frames, no GPU, and the clock waits (the animation resumes where it was)
  const sleep = sleepOffscreen(canvas, view);

  // prefers-reduced-motion: the scene is drawn (hover, drag), but the time stands still
  const motion =
    typeof matchMedia === "undefined"
      ? null
      : matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => view.freeze(motion?.matches ?? false);
  onMotion();
  motion?.addEventListener("change", onMotion);

  return {
    pause: sleep.pause,
    play: sleep.play,
    destroy() {
      sleep.stop();
      motion?.removeEventListener("change", onMotion);
      view.destroy();
    },
  };
}
