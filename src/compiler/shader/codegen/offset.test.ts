import { describe, it, expect } from "vitest";
import { tokenize } from "../../syntax/tokenizer";
import { readOffsetPath, pointAt, readOffsetRotate } from "./offset";
import { compileScene } from "../../index";
import { formatGss } from "../../../docs/format";

const path = (text: string) => readOffsetPath(tokenize(text))!;
const close = (value: { x: number; y: number; dx: number; dy: number }) =>
  Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Math.round(v * 1000) / 1000 + 0]));

describe("offset-path: reading", () => {
  it("is none by default", () => {
    expect(readOffsetPath(undefined)).toBeNull();
    expect(readOffsetPath(tokenize("none"))).toBeNull();
  });

  it("centers a path on itself and flips y, like the path shape", () => {
    const line = path('path("M0 0 L4 0")');
    expect(line.type).toBe("path");
    if (line.type !== "path") return;
    expect(line.length).toBe(4);
    expect(close(pointAt(line, 0))).toEqual({ x: -2, y: 0, dx: 1, dy: 0 });
    // SVG y goes down: in the scene, a line drawn downwards goes down too
    const down = path('path("M0 0 L0 4")');
    expect(close(pointAt(down, 0))).toEqual({ x: 0, y: 2, dx: 0, dy: -1 });
  });

  it("measures the distance along the path, and stops at its ends", () => {
    const corner = path('path("M0 0 L2 0 L2 2")');
    expect(close(pointAt(corner, 1))).toEqual({ x: 0, y: 1, dx: 1, dy: 0 });
    expect(close(pointAt(corner, 3))).toEqual({ x: 1, y: 0, dx: 0, dy: -1 });
    expect(close(pointAt(corner, -5))).toEqual(close(pointAt(corner, 0)));
    expect(close(pointAt(corner, 9))).toEqual(close(pointAt(corner, 4)));
  });

  it("goes round a closed path (Z), like CSS", () => {
    const square = path('path("M0 0 L2 0 L2 2 L0 2 Z")');
    if (square.type !== "path") return;
    expect(square.closed).toBe(true);
    expect(square.length).toBe(8);
    expect(close(pointAt(square, 9))).toEqual(close(pointAt(square, 1)));
    expect(close(pointAt(square, -1))).toEqual(close(pointAt(square, 7)));
  });

  it("follows curves and arcs", () => {
    const circle = path('path("M-1 0 A1 1 0 1 1 1 0 A1 1 0 1 1 -1 0 Z")');
    if (circle.type !== "path") return;
    expect(circle.length).toBeGreaterThan(2 * Math.PI * 0.999);
    expect(circle.length).toBeLessThan(2 * Math.PI * 1.001);
  });

  it("reads ray(), like CSS: 0deg points up, angles turn clockwise", () => {
    expect(close(pointAt(path("ray(0deg)"), 2))).toEqual({ x: 0, y: 2, dx: 0, dy: 1 });
    expect(close(pointAt(path("ray(90deg)"), 2))).toEqual({ x: 2, y: 0, dx: 1, dy: 0 });
  });

  it.each([
    ["circle(2)", /path\(\) or ray\(\)/],
    ['path("L1 1")', /starts with "M"/],
    ['path("M1 1")', /draws nothing/],
    ["ray(1)", /angle/],
    ["ray(45deg closest-side)", /angle only/],
  ])("refuses %s", (text, message) => {
    expect(() => path(text)).toThrow(message);
  });
});

describe("offset-rotate: reading", () => {
  it.each([
    [undefined, { auto: true, reverse: false, angle: 0 }],
    ["auto", { auto: true, reverse: false, angle: 0 }],
    ["reverse", { auto: true, reverse: true, angle: 0 }],
    ["30deg", { auto: false, reverse: false, angle: 30 }],
    ["auto 90deg", { auto: true, reverse: false, angle: 90 }],
    ["90deg auto", { auto: true, reverse: false, angle: 90 }],
  ])("%s", (text, expected) => {
    expect(readOffsetRotate(text === undefined ? undefined : tokenize(text))).toEqual(expected);
  });

  it("refuses anything else", () => {
    expect(() => readOffsetRotate(tokenize("sideways"))).toThrow(/auto, reverse/);
  });
});

describe("motion path in the shader", () => {
  const scene = (rules: string) => compileScene(`@scene { cube; } cube { ${rules} }`).shader;

  it("adds nothing to a scene without it", () => {
    expect(scene("translate: 0 1 0;")).not.toContain("offsetPath");
  });

  it("puts the object at the start of its path by default, turned along it", () => {
    const shader = scene('offset-path: path("M0 0 L4 0");');
    expect(shader).toContain("q.xy -= vec2(-2.0, 0.0);");
    expect(shader).not.toContain("dot(q.xy"); // along x already: nothing to turn
    expect(shader).not.toContain("offsetPath0");
    const up = scene('offset-path: path("M0 4 L0 0");');
    expect(up).toContain("q.xy = vec2(dot(q.xy, vec2(0.0, 1.0)), dot(q.xy, vec2(-1.0, 0.0)));");
    const back = scene('offset-path: path("M0 0 L4 0"); offset-rotate: reverse;');
    expect(back).toContain("q.xy = -vec2(dot(q.xy, vec2(1.0, 0.0)), dot(q.xy, vec2(0.0, 1.0)));");
  });

  it("reads offset-distance as units along the path, or a percentage of its length", () => {
    expect(scene('offset-path: path("M0 0 L4 0"); offset-distance: 1;')).toContain(
      "q.xy -= vec2(-1.0, 0.0);",
    );
    expect(scene('offset-path: path("M0 0 L4 0"); offset-distance: 75%;')).toContain(
      "q.xy -= vec2(1.0, 0.0);",
    );
  });

  it("does not turn with offset-rotate: 0deg, and turns like rotate-z with an angle", () => {
    const fixed = scene('offset-path: path("M0 0 L0 4"); offset-rotate: 0deg;');
    expect(fixed).not.toContain("dot(q.xy");
    const turned = scene('offset-path: path("M0 0 L0 4"); offset-rotate: 30deg;');
    const rotateZ = scene("rotate-z: 30deg;");
    const line = rotateZ.split("\n").find((l) => l.includes("rot("))!.trim();
    expect(turned).toContain(line);
  });

  it("writes a function of the distance when it is animated, computed in animate()", () => {
    const compiled = compileScene(
      '@scene { cube; } cube { offset-path: path("M0 0 L2 0 L2 2"); animation: go 2s; } @keyframes go { to { offset-distance: 100%; } }',
    );
    expect(compiled.shader).toMatch(/vec4 offsetPath0\(float s\)/);
    expect(compiled.shader).toMatch(/anim\d+ = offsetPath0\(/);
    expect(compiled.wgsl).toContain("fn g_offsetPath0");
  });

  it("can change on :hover, and follows the scroll", () => {
    expect(
      compileScene(
        '@scene { cube; } cube { offset-path: ray(90deg); transition: 0.3s; } cube:hover { offset-distance: 1.5; }',
      ).shader,
    ).toContain("uHover[0]");
    expect(
      compileScene(
        '@scene { cube; } cube { offset-path: path("M0 0 L4 0"); animation: go 1s; animation-timeline: scroll(); } @keyframes go { to { offset-distance: 100%; } }',
      ).shader,
    ).toContain("uTimeline.x");
  });

  it("refuses a percentage on a ray, which has no length", () => {
    expect(() => scene("offset-path: ray(0deg); offset-distance: 50%;")).toThrow(/ray has no length/);
  });

  it("refuses offset-distance and offset-rotate without offset-path", () => {
    expect(() => scene("offset-distance: 2;")).toThrow(/offset-path/);
    expect(() => scene("offset-rotate: auto;")).toThrow(/offset-path/);
  });

  it("works on a group", () => {
    const shader = compileScene(
      '@scene { group#g { cube; } } #g { offset-path: path("M0 0 L4 0"); offset-distance: 4; }',
    ).shader;
    expect(shader).toContain("q.xy -= vec2(2.0, 0.0);");
  });

  it("keeps the sphere of the scene, grown by the path", () => {
    const shader = scene('offset-path: path("M0 0 L8 0"); animation: go 2s; } @keyframes go { to { offset-distance: 100%; }');
    expect(shader).toContain("meets no object");
  });

  it("survives the formatter", () => {
    const source =
      '@scene { cube; } cube { offset-path: path("M0 0 C1 2 3 2 4 0"); offset-distance: 25%; offset-rotate: reverse 10deg; }';
    expect(compileScene(formatGss(source)).shader).toBe(compileScene(source).shader);
  });
});
