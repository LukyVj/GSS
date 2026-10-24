import { describe, it, expect, vi } from "vitest";
import { createGpu, usesGpu, withGpu } from "./gpu";
import type { MediaViewport } from "./media";
import type { CompiledScene } from "../compiler";

// @gpu (slow) at run time (decision 211): GSS answers its conditions, the browser the
// @media queries beside them

const screen = (matching: string[]) => {
  const watched: string[][] = [];
  const viewport: MediaViewport = {
    matches: (query) => matching.includes(query),
    watch: (queries) => {
      watched.push(queries);
      return () => {};
    },
    destroy() {},
  };
  return { viewport, watched };
};

describe("createGpu", () => {
  it("is not slow at first, on a computer with a GPU", () => {
    expect(createGpu("auto", () => false).slow).toBe(false);
  });

  it("is slow from the start without a GPU, or when the page asks for it", () => {
    expect(createGpu("auto", () => true).slow).toBe(true);
    expect(createGpu("slow", () => false).slow).toBe(true);
  });

  it("asks whether the browser draws without a GPU only when a scene needs to know", () => {
    const software = vi.fn(() => false);
    const gpu = createGpu("auto", software);
    expect(software).not.toHaveBeenCalled();
    void gpu.slow;
    void gpu.slow;
    expect(software).toHaveBeenCalledTimes(1);
  });

  it("goes slow once, for good, and says so once", () => {
    const gpu = createGpu("auto", () => false);
    const onChange = vi.fn();
    gpu.watch(onChange);
    gpu.slowDown();
    gpu.slowDown();
    expect(gpu.slow).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("the reader can force it in the playground, and go back to what was measured", () => {
    const gpu = createGpu("auto", () => false);
    const onChange = vi.fn();
    gpu.watch(onChange);
    gpu.choose("slow");
    expect(gpu.slow).toBe(true);
    gpu.choose("auto");
    expect(gpu.slow).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
    gpu.slowDown();
    gpu.choose("slow");
    gpu.choose("auto");
    expect(gpu.slow).toBe(true); // measured slow: stays so
  });
});

describe("withGpu", () => {
  it("answers the conditions of @gpu, and leaves the queries of @media to the screen", () => {
    const gpu = createGpu("auto", () => false);
    const { viewport } = screen(["(max-width: 600px)"]);
    const media = withGpu(viewport, gpu);
    expect(media.matches("(max-width: 600px)")).toBe(true);
    expect(media.matches("@gpu (slow)")).toBe(false);
    expect(media.matches("@gpu not (slow)")).toBe(true);
    gpu.slowDown();
    expect(media.matches("@gpu (slow)")).toBe(true);
    expect(media.matches("@gpu not (slow)")).toBe(false);
  });

  it("listens to the screen for @media only, and to the GPU for @gpu", () => {
    const gpu = createGpu("auto", () => false);
    const { viewport, watched } = screen([]);
    const onChange = vi.fn();
    const stop = withGpu(viewport, gpu).watch(["(max-width: 600px)", "@gpu (slow)"], onChange);
    expect(watched).toEqual([["(max-width: 600px)"]]);
    gpu.slowDown();
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    gpu.choose("slow");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("usesGpu", () => {
  it("is true for a scene with a @gpu condition", () => {
    const scene = (queries: string[]) => ({ media: { queries, variants: [] } }) as unknown as CompiledScene;
    expect(usesGpu({} as CompiledScene)).toBe(false);
    expect(usesGpu(scene(["(max-width: 600px)"]))).toBe(false);
    expect(usesGpu(scene(["(max-width: 600px)", "@gpu (slow)"]))).toBe(true);
  });
});
