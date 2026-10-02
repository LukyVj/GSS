import { compileScene, type CompiledScene } from "../compiler";
import {
  mount as mountCompiled,
  mountAsync as mountCompiledAsync,
  type AsyncGssScene,
  type BackendOptions,
  type GssScene,
  type MountOptions,
} from "./runtime";

// gss-lang: mount(canvas, "GSS text") compiles in the page, then draws (decision 63).
// A scene compiled at build time (import scene from "./logo.gss") works here too.
export type { CompiledScene, GssScene, MountOptions, AsyncGssScene, BackendOptions };
export type { CompileOptions } from "../compiler";
export type { Backend } from "../runtime/backend";
export { compileScene as compile };

export type EmbeddedScene = Omit<GssScene, "update"> & {
  update(scene: string | CompiledScene): void;
};

export type AsyncEmbeddedScene = Omit<AsyncGssScene, "update"> & {
  update(scene: string | CompiledScene): Promise<void>;
};

export async function mountAsync(
  canvas: HTMLCanvasElement,
  scene: string | CompiledScene,
  options?: BackendOptions,
): Promise<AsyncEmbeddedScene> {
  const mounted = await mountCompiledAsync(canvas, toCompiled(scene), options);
  return { ...mounted, update: next => mounted.update(toCompiled(next)) };
}

// GSS text → compiled; a compiled scene stays as it is. Throws the GSS error.
export function toCompiled(scene: string | CompiledScene): CompiledScene {
  return typeof scene === "string" ? compileScene(scene) : scene;
}

export function mount(
  canvas: HTMLCanvasElement,
  scene: string | CompiledScene,
  options?: MountOptions,
): EmbeddedScene {
  const mounted = mountCompiled(canvas, toCompiled(scene), options);
  return { ...mounted, update: (next) => mounted.update(toCompiled(next)) };
}
