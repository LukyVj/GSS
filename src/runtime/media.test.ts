import { describe, it, expect, vi } from "vitest";
import { pickVariant, watchMedia } from "./media";
import type { CompiledScene } from "../compiler";

// A compiled scene with @media: one version per combination of its queries
const scene = (dpr: CompiledScene["dpr"]) => ({ dpr }) as CompiledScene;
const withMedia = {
  ...scene("auto"),
  media: {
    queries: ["(max-width: 600px)", "(prefers-color-scheme: dark)"],
    variants: [scene("auto"), scene(1), scene(2), scene(0.5)],
  },
} as CompiledScene;

describe("pickVariant", () => {
  it("is the scene itself without @media", () => {
    const plain = scene("max");
    expect(pickVariant(plain, () => true)).toBe(plain);
  });

  it("picks the version where the matching queries are set, bit by bit", () => {
    const matching = (list: string[]) => (query: string) =>
      list.includes(query);
    expect(pickVariant(withMedia, matching([])).dpr).toBe("auto");
    expect(pickVariant(withMedia, matching(["(max-width: 600px)"])).dpr).toBe(
      1,
    );
    expect(
      pickVariant(withMedia, matching(["(prefers-color-scheme: dark)"])).dpr,
    ).toBe(2);
    expect(
      pickVariant(
        withMedia,
        matching(["(max-width: 600px)", "(prefers-color-scheme: dark)"]),
      ).dpr,
    ).toBe(0.5);
  });
});

describe("watchMedia", () => {
  it("does nothing without matchMedia (Node, an old browser)", () => {
    expect(() => watchMedia(["(min-width: 1px)"], () => {})()).not.toThrow();
  });

  it("listens to every query, and stops listening", () => {
    const lists = new Map<
      string,
      { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }
    >();
    const fake = (query: string) => {
      const list = { add: vi.fn(), remove: vi.fn() };
      lists.set(query, list);
      return {
        matches: false,
        addEventListener: list.add,
        removeEventListener: list.remove,
      } as unknown as MediaQueryList;
    };
    const onChange = () => {};
    const stop = watchMedia(["(a)", "(b)"], onChange, fake);
    expect(lists.get("(a)")!.add).toHaveBeenCalledWith("change", onChange);
    expect(lists.get("(b)")!.add).toHaveBeenCalledWith("change", onChange);
    stop();
    expect(lists.get("(a)")!.remove).toHaveBeenCalledWith("change", onChange);
  });
});
