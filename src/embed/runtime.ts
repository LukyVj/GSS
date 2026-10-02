import type { CompiledScene } from "../compiler";
import { createView, type ViewOptions } from "../runtime/view";
import { createViewAsync, type BackendOptions } from "../runtime/backend";

// gss-lang/runtime: draws a scene compiled at build time (the Vite plugin),
// without shipping the compiler (decision 63). gss-lang (index.ts) adds GSS text.
export type { CompiledScene };
export type { Backend, BackendOptions } from "../runtime/backend";

export type AsyncGssScene = Omit<GssScene, "update"> & {
  readonly backend: "webgl" | "webgpu";
  update(compiled: CompiledScene): Promise<void>;
};

export async function mountAsync(
  canvas: HTMLCanvasElement,
  compiled: CompiledScene,
  options: BackendOptions = {},
): Promise<AsyncGssScene> {
  const view = await createViewAsync(canvas, options);
  try { await view.show(compiled); }
  catch (error) { view.destroy(); throw error; }
  const lifecycle = observe(canvas, view);
  return { ...lifecycle, ...variables(view), backend: view.backend, update: next => view.show(next) };
}

export type MountOptions = ViewOptions;

export type GssScene = {
  // Another scene in the same canvas; the camera the user placed stays
  update(compiled: CompiledScene): void;
  // Stop and start drawing. A scene also sleeps on its own when it leaves the screen.
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
  try { view.show(compiled); }
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

  let visible = true;
  let paused = false; // by the page, with pause(): the screen does not wake it up
  const update = () => (visible && !paused ? view.play() : view.pause());

  // Off screen: no frames, no GPU, and the clock waits (the animation resumes where it was)
  const observer =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          update();
        });
  observer?.observe(canvas);

  // prefers-reduced-motion: the scene is drawn (hover, drag), but the time stands still
  const motion =
    typeof matchMedia === "undefined"
      ? null
      : matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => view.freeze(motion?.matches ?? false);
  onMotion();
  motion?.addEventListener("change", onMotion);

  return {
    pause() {
      paused = true;
      update();
    },
    play() {
      paused = false;
      update();
    },
    destroy() {
      observer?.disconnect();
      motion?.removeEventListener("change", onMotion);
      view.destroy();
    },
  };
}
