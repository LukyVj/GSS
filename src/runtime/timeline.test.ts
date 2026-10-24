import { describe, it, expect } from "vitest";
import { scrollProgress, viewProgress, findScroller, rangeProgress, scrollRangeProgress, findNamedTimeline, insetOf, timelineValues } from "./timeline";
import type { RangeEdge, RangeName } from "../compiler/features/timeline";

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

  it("is -1 before the timeline and 2 after it, so that an animation can stop applying, like CSS", () => {
    expect(viewProgress(2000, 200, 0, 800)).toBe(-1);
    expect(viewProgress(-900, 200, 0, 800)).toBe(2);
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

describe("rangeProgress (animation-range)", () => {
  const edge = (name: RangeName, offset: number, unit: "%" | "px" = "%"): RangeEdge => ({ name, offset, unit });
  // a 200px scene in an 800px viewport: the whole view() timeline is 1000px long
  const view = (position: number, start: RangeEdge, end: RangeEdge) =>
    rangeProgress(position, 1000, 200, 800, { start, end });

  it("plays entry while the scene comes in, exit while it goes out", () => {
    expect(view(0, edge("entry", 0), edge("entry", 100))).toBe(0);
    expect(view(100, edge("entry", 0), edge("entry", 100))).toBe(0.5);
    expect(view(200, edge("entry", 0), edge("entry", 100))).toBe(1);
    expect(view(900, edge("exit", 0), edge("exit", 100))).toBe(0.5);
  });

  it("plays contain while the scene is all inside, and cover from entering to leaving", () => {
    expect(view(200, edge("contain", 0), edge("contain", 100))).toBe(0);
    expect(view(500, edge("contain", 0), edge("contain", 100))).toBe(0.5);
    expect(view(500, edge("cover", 0), edge("cover", 100))).toBe(0.5);
  });

  it("reads the crossings, and pixels from the start of a range", () => {
    expect(view(100, edge("entry-crossing", 0), edge("entry-crossing", 100))).toBe(0.5);
    expect(view(900, edge("exit-crossing", 0), edge("exit-crossing", 100))).toBe(0.5);
    expect(view(150, edge("cover", 100, "px"), edge("cover", 200, "px"))).toBe(0.5);
  });

  it("is -1 before the range and 2 after it", () => {
    expect(view(950, edge("entry", 0), edge("entry", 100))).toBe(2);
    expect(view(10, edge("exit", 0), edge("exit", 100))).toBe(-1);
  });

  it("is after a range of no length once past it, before it otherwise", () => {
    expect(view(300, edge("cover", 30), edge("cover", 30))).toBe(2);
    expect(view(200, edge("cover", 30), edge("cover", 30))).toBe(-1);
  });
});

describe("scrollRangeProgress (scroll() with animation-range)", () => {
  const edge = (offset: number, unit: "%" | "px" = "%"): RangeEdge => ({ name: "cover", offset, unit });
  const middle = { start: edge(25), end: edge(75) };

  it("follows the scroll of the page", () => {
    expect(scrollRangeProgress(1000, 2000, 800, null, middle)).toBe(0.5);
    expect(scrollRangeProgress(400, 2000, 800, null, middle)).toBe(-1);
  });

  it("follows the slider of the playground over the length of the page", () => {
    expect(scrollRangeProgress(0, 2000, 800, 0.5, middle)).toBe(0.5);
    expect(scrollRangeProgress(0, 2000, 800, 0.75, middle)).toBe(1);
  });

  it("follows the slider where the page cannot scroll, as over one screen of scroll", () => {
    expect(scrollRangeProgress(0, 0, 800, 0, middle)).toBe(-1);
    expect(scrollRangeProgress(0, 0, 800, 0.5, middle)).toBe(0.5);
    expect(scrollRangeProgress(0, 0, 800, 1, middle)).toBe(2);
    expect(scrollRangeProgress(0, 0, 800, 0.25, { start: edge(100, "px"), end: edge(300, "px") })).toBe(0.5);
  });
});

describe("findNamedTimeline (animation-timeline: --name)", () => {
  type Fake = { styles: Record<string, string>; attribute?: string; isConnected?: boolean };
  const element = (styles: Record<string, string>, attribute?: string): Fake => ({ styles, attribute });
  const styleOf = (el: Element) => {
    const fake = el as unknown as Fake;
    return { getPropertyValue: (property: string) => fake.styles[property] ?? "" } as CSSStyleDeclaration;
  };
  const find = (name: string, elements: Fake[], supported = true) =>
    findNamedTimeline(
      name,
      elements.map((fake) => ({ ...fake, getAttribute: () => fake.attribute ?? null }) as unknown as Element),
      styleOf,
      supported,
    );

  it("finds the element whose view-timeline-name holds the name, with its axis and its inset", () => {
    const found = find("--b", [
      element({ "view-timeline-name": "none" }),
      element({ "view-timeline-name": "--a, --b", "view-timeline-axis": "block, inline", "view-timeline-inset": "auto, 10px 20%" }),
    ]);
    expect(found).toMatchObject({ kind: "view", axis: "inline", inset: ["10px", "20%"] });
  });

  it("finds a scroll timeline, scroll-timeline-name, the element itself being the scroller", () => {
    expect(find("--log", [element({ "scroll-timeline-name": "--log", "scroll-timeline-axis": "y" })])).toMatchObject({
      kind: "scroll",
      axis: "y",
    });
  });

  it("takes the first element in the order of the page", () => {
    const first = element({ "view-timeline-name": "--a" });
    const found = find("--a", [element({}), first, element({ "view-timeline-name": "--a" })]);
    expect(found?.element).toMatchObject({ styles: first.styles });
  });

  it("is null when no element declares the name", () => {
    expect(find("--c", [element({ "view-timeline-name": "--a" })])).toBeNull();
  });

  it("reads the style attribute in a browser that does not know view-timeline-name", () => {
    const found = find("--v7", [element({}, "padding: 0; view-timeline-name: --v7; view-timeline-axis: block")], false);
    expect(found).toMatchObject({ kind: "view", axis: "block" });
  });
});

describe("insetOf (view-timeline-inset)", () => {
  it("is 0 for auto, pixels as they are, a percentage of the scroll container", () => {
    expect(insetOf(["auto", "auto"], 800)).toEqual([0, 0]);
    expect(insetOf(["10px", "25%"], 800)).toEqual([10, 200]);
  });

  it("takes one value for both sides, like CSS", () => {
    expect(insetOf(["50px"], 800)).toEqual([50, 50]);
  });
});

describe("timelineValues", () => {
  it("sends one vec4 up to four timelines, and as many as needed past four", () => {
    const view = { type: "view", axis: "block" } as const;
    const canvas = {} as HTMLCanvasElement;
    expect(timelineValues([view, view], canvas, 0.5)).toHaveLength(4);
    expect([...timelineValues(Array(6).fill(view), canvas, 0.25)]).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0, 0]);
  });
});
