import { describe, it, expect } from "vitest";
import { tokenize } from "../syntax/tokenizer";
import { readTimeline } from "./timeline";
import { compileScene } from "../index";
import { toShadertoy } from "../shader/shadertoy";
import { formatGss } from "../../docs/format";

const timeline = (text: string) => readTimeline(tokenize(text));
const spin = "@keyframes spin { to { rotate-y: 360deg; } }";
const scene = (rules: string) => `@scene { cube; sphere; } ${rules} ${spin}`;

describe("animation-timeline: reading scroll() and view()", () => {
  it.each([
    ["auto", null],
    ["scroll()", { type: "scroll", scroller: "nearest", axis: "block" }],
    ["scroll(root)", { type: "scroll", scroller: "root", axis: "block" }],
    ["scroll(inline)", { type: "scroll", scroller: "nearest", axis: "inline" }],
    ["scroll(root x)", { type: "scroll", scroller: "root", axis: "x" }],
    ["scroll(y nearest)", { type: "scroll", scroller: "nearest", axis: "y" }],
    ["view()", { type: "view", axis: "block" }],
    ["view(inline)", { type: "view", axis: "inline" }],
  ])("%s", (text, expected) => {
    expect(timeline(text)).toEqual(expected);
  });

  it.each([
    ["scroll(self)", /root or nearest/],
    ["scroll(sideways)", /root or nearest/],
    ["scroll(root nearest)", /one scroller/],
    ["scroll(x y)", /one axis/],
    ["view(10%)", /inset/],
    ["view(root)", /block, inline, x or y/],
    ["--my-timeline", /scroll\(\) or view\(\)/],
    ["scroll() view()", /one timeline/],
  ])("refuses %s", (text, message) => {
    expect(() => timeline(text)).toThrow(message);
  });
});

describe("animation-timeline in the shader", () => {
  it("adds nothing to a scene that runs on time", () => {
    const compiled = compileScene(scene("cube { animation: spin 2s; }"));
    expect(compiled.timelines).toBeUndefined();
    expect(compiled.shader).not.toContain("uTimeline");
  });

  it("drives the animation with the progress of the timeline instead of the time", () => {
    const compiled = compileScene(
      scene("cube { animation: spin 2s linear; animation-timeline: scroll(); }"),
    );
    expect(compiled.timelines).toEqual([{ type: "scroll", scroller: "nearest", axis: "block" }]);
    expect(compiled.shader).toContain("uniform vec4 uTimeline;");
    expect(compiled.shader).toContain("uTimeline.x");
    expect(compiled.shader).not.toMatch(/iTime \/ 2\.0/);
  });

  it("is the same as playing the animation once, at the matching moment", () => {
    // a scroll() animation ignores the duration: the whole scroll is the whole animation
    const a = compileScene(scene("cube { animation: spin 2s; animation-timeline: scroll(); }")).shader;
    const b = compileScene(scene("cube { animation: spin 7s; animation-timeline: scroll(); }")).shader;
    expect(a).toBe(b);
  });

  it("plays the iterations and the direction along the scroll", () => {
    const compiled = compileScene(
      scene("cube { animation: spin 1s 2 alternate; animation-timeline: view(); }"),
    );
    expect(compiled.shader).toContain("playhead(uTimeline.x * 2.0, 1.0, 2.0, 2)");
    const reverse = compileScene(
      scene("cube { animation: spin 1s reverse; animation-timeline: scroll(); }"),
    );
    expect(reverse.shader).toContain("(1.0 - uTimeline.x)");
  });

  it("ignores the delay, like CSS", () => {
    expect(
      compileScene(scene("cube { animation: spin 1s 3s; animation-timeline: scroll(); }")).shader,
    ).toBe(compileScene(scene("cube { animation: spin 1s; animation-timeline: scroll(); }")).shader);
  });

  it("gives each different timeline its own component, shared by the objects that use it", () => {
    const compiled = compileScene(
      `@scene { cube; sphere; torus; } cube { animation: spin 1s; animation-timeline: scroll(); } sphere { animation: spin 1s; animation-timeline: view(); } torus { animation: spin 1s; animation-timeline: scroll(nearest block); } ${spin}`,
    );
    expect(compiled.timelines).toEqual([
      { type: "scroll", scroller: "nearest", axis: "block" },
      { type: "view", axis: "block" },
    ]);
    expect(compiled.shader).toContain("uTimeline.y");
    expect(compiled.shader).not.toContain("uTimeline.z");
  });

  it("takes at most four timelines", () => {
    const rules = ["scroll(root)", "scroll(inline)", "view()", "view(inline)", "scroll(root inline)"]
      .map((t, i) => `#o${i} { animation: spin 1s; animation-timeline: ${t}; }`)
      .join(" ");
    expect(() =>
      compileScene(`@scene { cube#o0; cube#o1; cube#o2; cube#o3; cube#o4; } ${rules} ${spin}`),
    ).toThrow(/4 timelines/);
  });

  it("works on a group", () => {
    const compiled = compileScene(
      `@scene { group#g { cube; } } #g { animation: spin 1s; animation-timeline: scroll(); } ${spin}`,
    );
    expect(compiled.shader).toContain("uTimeline.x");
  });

  it("needs an animation, like the other longhands", () => {
    expect(() => compileScene(scene("cube { animation-timeline: scroll(); }"))).toThrow(
      /write animation first/,
    );
  });

  it("lowers to WGSL after the hover slots, and to Shadertoy at the start of the scroll", () => {
    const compiled = compileScene(
      scene("cube { animation: spin 1s; animation-timeline: scroll(); } sphere:hover { scale: 1.2; }"),
    );
    expect(compiled.wgsl).toContain("timeline: vec4<f32>");
    expect(compiled.wgsl).toContain("gss.timeline.x");
    expect(compiled.wgsl!.indexOf("hover:")).toBeLessThan(compiled.wgsl!.indexOf("timeline:"));
    expect(toShadertoy(compiled)).toContain("const vec4 uTimeline = vec4(0.0);");
  });

  it("survives the formatter", () => {
    const source = scene("cube { animation: spin 1s; animation-timeline: scroll(root inline); }");
    expect(compileScene(formatGss(source)).shader).toBe(compileScene(source).shader);
  });
});

describe("animation-range: the part of the timeline the animation plays on, like CSS", () => {
  const timelines = (rules: string) => compileScene(scene(rules)).timelines;
  const edge = (name: string, offset: number, unit = "%") => ({ name, offset, unit });

  it("keeps the timeline as it was with normal", () => {
    expect(timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range: normal; }")).toEqual([
      { type: "view", axis: "block" },
    ]);
  });

  it("reads a named range, alone or with its percentages", () => {
    expect(timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range: entry; }")).toEqual([
      { type: "view", axis: "block", range: { start: edge("entry", 0), end: edge("entry", 100) } },
    ]);
    expect(timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range: entry 10% exit 90%; }")).toEqual([
      { type: "view", axis: "block", range: { start: edge("entry", 10), end: edge("exit", 90) } },
    ]);
    expect(timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range: contain exit; }")).toEqual([
      { type: "view", axis: "block", range: { start: edge("contain", 0), end: edge("exit", 100) } },
    ]);
  });

  it("reads percentages and pixels of the whole timeline", () => {
    expect(timelines("cube { animation: spin 1s; animation-timeline: scroll(); animation-range: 20% 80%; }")).toEqual([
      { type: "scroll", scroller: "nearest", axis: "block", range: { start: edge("cover", 20), end: edge("cover", 80) } },
    ]);
    expect(timelines("cube { animation: spin 1s; animation-timeline: scroll(); animation-range: 100px; }")).toEqual([
      { type: "scroll", scroller: "nearest", axis: "block", range: { start: edge("cover", 100, "px"), end: edge("cover", 100) } },
    ]);
  });

  it("takes the longhands, which win over the shorthand like the other longhands", () => {
    expect(
      timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range-start: entry 50%; animation-range: cover; animation-range-end: exit; }"),
    ).toEqual([{ type: "view", axis: "block", range: { start: edge("entry", 50), end: edge("exit", 100) } }]);
  });

  it("gives a timeline with another range its own component", () => {
    const compiled = compileScene(
      scene("cube { animation: spin 1s; animation-timeline: view(); } sphere { animation: spin 1s; animation-timeline: view(); animation-range: entry; }"),
    );
    expect(compiled.timelines).toHaveLength(2);
    expect(compiled.shader).toContain("uTimeline.y");
  });

  it("refuses a named range on scroll(), a wrong value, and a range without a timeline", () => {
    expect(() => timelines("cube { animation: spin 1s; animation-timeline: scroll(); animation-range: entry; }")).toThrow(/scroll\(\) takes percentages/);
    expect(() => timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range: middle; }")).toThrow(/animation-range expects/);
    expect(() => timelines("cube { animation: spin 1s; animation-timeline: view(); animation-range: entry 10% exit 90% cover; }")).toThrow(/animation-range expects/);
    expect(() => timelines("cube { animation: spin 1s; animation-range: entry; }")).toThrow(/animation-timeline/);
  });
});
