// @gpu (slow) at run time (decision 211). The compiler keeps the conditions of @gpu among
// the @media queries of a scene, so a version of the scene is ready for a slow GPU; GSS
// answers them instead of the browser. The GPU is slow when the frames stay slow at the
// lowest ratio (dpr.ts), when the browser draws without a GPU (software.ts), or when the
// page asks for it (<gss-scene gpu="slow">, mount(…, { gpu: "slow" })). Once slow, it stays
// slow for the page: the lighter version is fast by design, and its frames say nothing of
// the full one. The playground's menu forces it, both ways.
import type { CompiledScene } from "../compiler";
import type { MediaViewport } from "./media";
import { softwareRendering } from "./software";

export type GpuChoice = "auto" | "slow";

// The conditions of @gpu among the queries: "@gpu (slow)" and "@gpu not (slow)". The same
// test as the compiler's (syntax/ast.ts), which the runtime never imports (decision 63).
const isGpuCondition = (query: string): boolean => query.startsWith("@gpu ");

export type Gpu = ReturnType<typeof createGpu>;

export function createGpu(initial: GpuChoice = "auto", software: () => boolean = softwareRendering) {
  let choice = initial;
  let measured: boolean | undefined; // undefined: not asked yet (a WebGL context to make)
  const listeners = new Set<() => void>();
  const isSlow = () => choice === "slow" || (measured ??= software());
  const change = (apply: () => void) => {
    const before = isSlow();
    apply();
    if (isSlow() !== before) for (const listener of listeners) listener();
  };
  return {
    get slow(): boolean {
      return isSlow();
    },
    get choice(): GpuChoice {
      return choice;
    },
    // The frames stayed slow at the lowest ratio, or the scene was too heavy: for good
    slowDown(): void {
      change(() => (measured = true));
    },
    // The reader's choice, in the playground: slow, or back to what was measured
    choose(next: GpuChoice): void {
      change(() => (choice = next));
    },
    watch(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

// Does the scene have a version for a slow GPU?
export function usesGpu(compiled: CompiledScene): boolean {
  return compiled.media?.queries.some(isGpuCondition) ?? false;
}

// The queries of a scene: @gpu answered by the GPU, @media by the screen
export function withGpu(media: MediaViewport, gpu: Gpu): MediaViewport {
  return {
    matches: (query) => (isGpuCondition(query) ? gpu.slow === (query === "@gpu (slow)") : media.matches(query)),
    watch(queries, onChange) {
      const stopMedia = media.watch(queries.filter((query) => !isGpuCondition(query)), onChange);
      const stopGpu = queries.some(isGpuCondition) ? gpu.watch(onChange) : () => {};
      return () => {
        stopMedia();
        stopGpu();
      };
    },
    destroy: () => media.destroy(),
  };
}
