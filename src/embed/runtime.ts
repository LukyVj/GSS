import type { CompiledScene } from "../compiler";
import { createView, type ViewOptions } from "../runtime/view";

// gss-lang/runtime: draws a scene compiled at build time (the Vite plugin),
// without shipping the compiler (decision 63). gss-lang (index.ts) adds GSS text.
export type { CompiledScene };

export type MountOptions = ViewOptions;

export type GssScene = {
  // Another scene in the same canvas; the camera the user placed stays
  update(compiled: CompiledScene): void;
  // Stop and start drawing. A scene also sleeps on its own when it leaves the screen.
  pause(): void;
  play(): void;
  // Frees the GPU (a browser keeps about 16 WebGL contexts)
  destroy(): void;
};

export function mount(
  canvas: HTMLCanvasElement,
  compiled: CompiledScene,
  options: MountOptions = {},
): GssScene {
  const view = createView(canvas, options);
  view.show(compiled);

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
    update: (next) => view.show(next),
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
