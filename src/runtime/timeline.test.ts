import { describe, it, expect } from "vitest";
import { scrollProgress, viewProgress, findScroller } from "./timeline";

describe("scrollProgress", () => {
  it("goes from 0 at the start of the scroll to 1 at its end", () => {
    expect(scrollProgress(0, 3000, 1000)).toBe(0);
    expect(scrollProgress(1000, 3000, 1000)).toBe(0.5);
    expect(scrollProgress(2000, 3000, 1000)).toBe(1);
  });

  it("stays between 0 and 1 (overscroll)", () => {
    expect(scrollProgress(-40, 3000, 1000)).toBe(0);
    expect(scrollProgress(2100, 3000, 1000)).toBe(1);
  });

  it("is 0 when nothing scrolls", () => {
    expect(scrollProgress(0, 800, 800)).toBe(0);
  });
});

describe("viewProgress", () => {
  // a 200px scene in an 800px viewport: 0 when its top reaches the bottom of the
  // viewport, 1 when its bottom leaves at the top, like CSS view()
  it("follows the scene crossing its scroll container", () => {
    expect(viewProgress(800, 200, 0, 800)).toBe(0);
    expect(viewProgress(300, 200, 0, 800)).toBe(0.5);
    expect(viewProgress(-200, 200, 0, 800)).toBe(1);
  });

  it("is measured from the scroll container, not the page", () => {
    expect(viewProgress(500, 100, 100, 400)).toBe(0);
    expect(viewProgress(0, 100, 100, 400)).toBe(1);
  });

  it("stays between 0 and 1", () => {
    expect(viewProgress(2000, 200, 0, 800)).toBe(0);
    expect(viewProgress(-900, 200, 0, 800)).toBe(1);
  });
});

describe("findScroller", () => {
  type Fake = {
    parentElement: Fake | null;
    scrollHeight: number;
    clientHeight: number;
    scrollWidth: number;
    clientWidth: number;
    overflow: string;
  };
  const node = (overflow: string, parent: Fake | null, scrolls = true): Fake => ({
    parentElement: parent,
    scrollHeight: scrolls ? 2000 : 100,
    clientHeight: 100,
    scrollWidth: 100,
    clientWidth: 100,
    overflow,
  });
  const styleOf = (element: Element) => {
    const fake = element as unknown as Fake;
    return { overflowX: fake.overflow, overflowY: fake.overflow } as CSSStyleDeclaration;
  };
  const find = (from: Fake, vertical = true) =>
    findScroller(from as unknown as Element, vertical, styleOf) as unknown as Fake | null;

  it("is the closest ancestor that scrolls on that axis", () => {
    const outer = node("auto", null);
    const inner = node("scroll", outer);
    const box = node("visible", inner);
    const canvas = node("visible", box);
    expect(find(canvas)).toBe(inner);
  });

  it("skips an ancestor that could scroll but has nothing to scroll, or that hides it", () => {
    const outer = node("auto", null);
    const full = node("auto", outer, false);
    const hidden = node("hidden", full);
    const canvas = node("visible", hidden);
    expect(find(canvas)).toBe(outer);
  });

  it("crosses a shadow root, like the one of <gss-scene>", () => {
    const outer = node("auto", null);
    const host = node("visible", outer);
    const canvas = { ...node("visible", null), getRootNode: () => ({ host }) };
    expect(find(canvas as unknown as Fake)).toBe(outer);
  });

  it("is null for the page itself", () => {
    const canvas = node("visible", node("visible", null));
    expect(find(canvas)).toBeNull();
    // horizontally, nothing scrolls in these fakes
    expect(find(node("visible", node("auto", null)), false)).toBeNull();
  });
});
