import { compileScene, type CompiledScene } from "../compiler";
import { createView, type View, type ViewOptions } from "./view";
import { createViewAsync, type BackendOptions, type AsyncView } from "./backend";

export type AsyncRenderer = AsyncView & { load(source: string): Promise<CompiledScene> };

export async function createRendererAsync(canvas: HTMLCanvasElement, options?: BackendOptions): Promise<AsyncRenderer> {
  const view = await createViewAsync(canvas, options);
  return { ...view, async load(source) {
    const compiled = compileScene(source);
    await view.show(compiled);
    return compiled;
  } };
}

// Draws GSS text in a canvas: the compiler, then the view (view.ts).
// Used by the playground, the home page and every "Try it" in the docs.
export type Renderer = View & {
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
  return {
    ...view,
    load(source) {
      const compiled = compileScene(source); // GSS errors
      view.show(compiled); // GLSL errors
      return compiled;
    },
  };
}
