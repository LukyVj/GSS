import { compileScene, type CompiledScene } from "../compiler";
import type { View as SceneView } from "../compiler/features/view";
import { createView, type View, type ViewOptions } from "./view";
import { createViewAsync, type BackendOptions, type AsyncView } from "./backend";

// setView: the view of the next compiles, over the view of the scene; null gives it back to
// the code (the chips of the playground and the docs, decision 131)
type Viewed = { setView(view: SceneView | null): void };

export type AsyncRenderer = AsyncView & Viewed & { load(source: string): Promise<CompiledScene> };

export async function createRendererAsync(canvas: HTMLCanvasElement, options?: BackendOptions): Promise<AsyncRenderer> {
  const view = await createViewAsync(canvas, options);
  let chosen: SceneView | undefined;
  return { ...view, async load(source) {
    const compiled = compileScene(source, { view: chosen });
    await view.show(compiled);
    return compiled;
  }, setView(next) {
    chosen = next ?? undefined;
  } };
}

// Draws GSS text in a canvas: the compiler, then the view (view.ts).
// Used by the playground, the home page and every "Try it" in the docs.
export type Renderer = View & Viewed & {
  // GSS text → scene on screen. Throws on the first error, before touching
  // the current scene: if the new code is invalid, the old scene stays visible.
  // Returns what the compiler produced (shader, camera, object count).
  load(source: string): CompiledScene;
};

export function createRenderer(
  canvas: HTMLCanvasElement,
  options?: ViewOptions,
): Renderer {
  const view = createView(canvas, options);
  let chosen: SceneView | undefined;
  return {
    ...view,
    load(source) {
      const compiled = compileScene(source, { view: chosen }); // GSS errors
      view.show(compiled); // GLSL errors
      return compiled;
    },
    setView(next) {
      chosen = next ?? undefined;
    },
  };
}
